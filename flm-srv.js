/*
 * Copyright (c) 2015 MovieLabs
 * 
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 * 
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * Author: Paul Jensen <pgj@movielabs.com>
 */

/******************************
 * node requires
 ******************************/

var crypto = require('crypto');
var express = require('express');
var fs = require('fs');
var http = require('http');
var https = require('https');
var libxmljs = require('libxmljs');
//var sprintf = require('sprintf-js').sprintf;
var util = require('util');
var xsd = require('libxml-xsd');

/******************************
 * Constants
 ******************************/
var http_port = 3000;
var https_port = http_port + 1;

var argv = require('optimist')
    .options('a', {
        alias: 'auth',
        default: 'none',
    }).options('t', {
	alias: 'tls',
	default: false
    }).argv;

var originator = 'http://127.0.0.1'; /* TODO; spec unclear */
var created = '2010-04-16T11:26:05-07:00'; /* TODO */
var sysname = 'mongo'; /* TODO */

var schema_path = './xsd/';
var flm_schema = '21DC-PD-ST-430-7-revision-20150602.xsd';
var sitelist_schema = '21DC Input FLM-x-20150602-SiteList.xsd';
var error_schema = '21DC Input FLM-x-20150602-Error.xsd';

var auth_path = './auth/';
var hash_password_file = auth_path + 'passwd.hash';
var key_file = 'key.pem';
var cert_file = 'cert.pem';

var options = {
    key: fs.readFileSync(auth_path + key_file),
    cert: fs.readFileSync(auth_path + cert_file)
};

/******************************
 * the main show
 ******************************/

// Validate schemas
var cwd = process.cwd(); process.chdir(schema_path);
var flmSchemaString = fs.readFileSync(flm_schema, 'utf8');
var flmSchemaDoc = xsd.parse(flmSchemaString);
var siteListSchemaString = fs.readFileSync(sitelist_schema, 'utf8');
var siteListSchemaDoc = xsd.parse(siteListSchemaString);
var errorSchemaString = fs.readFileSync(error_schema, 'utf8');
var errorSchemaDoc = xsd.parse(errorSchemaString);
process.chdir(cwd);

// Ingest authorizations
var pwdFileString = fs.readFileSync(hash_password_file, 'utf8');
var pwdFileList = pwdFileString.split('\n');
var atmp = [];
for (var i=0; i<pwdFileList.length; i++) {
    if (pwdFileList[i].length == 0)
	continue;
    var tmp = pwdFileList[i].split('|');
    var tmp2 = tmp[0].split(':');
    var tmp3 = new Object();
    tmp3.user = tmp2[0];
    tmp3.method = tmp2[1];
    tmp3.salt = tmp[1];
    tmp3.hash = tmp[2];
    atmp.push(tmp3);
}
pwdFileString = null;
pwdFileList = atmp;

var app = express();
app.use(function(req, res, next) { // collect POST data for later use, xml data only
        var contentType = req.headers['content-type'] || ''; // sneaky use of || operator
        var mime = contentType.split(';')[0];
        
        if (mime != 'application/xml') { // per ST-430-7 revision
            return next();
        }

        var data = '';
        req.setEncoding('utf8');
        req.on('data', function(chunk) {
            data += chunk;
        });
        req.on('end', function() {
            req.rawBody = data;
            next();
        });
    })
    .use(dispatch);

console.log('Auth=%s; https=%s', argv.a, argv.t);
http.createServer(app).listen(http_port); // HTTP port
if (argv.t)
    https.createServer(options, app).listen(https_port); // HTTPS port

/******************************
 * Methods
 ******************************/

/**
 * Utility function to convert a SQL datetime into an HTTP-compliant RFC 2616 date
 * @param {String} sqlTime - a SQL datetime
 * @return {String} the corresponding RFC 2616 section 14.29 conformant datetime
 */
function mod_date(sqlTime)
{
    var now = new Date();
    var d = new Date(Date.parse(sqlTime.replace(' ', 'T')));
    if (d > now) // RFC 2616 section 14.29
        d = now;
    return d.toUTCString();
}

/**
 * generate a SiteList XML document containing a list of facilities
 * @param {Object[]} facs - Array of rows returned from database
 * @return {Document} The generated XML document
 */
function gen_faclist(facs)
{
    var doc = new libxmljs.Document();
    var root = doc.node("tns:SiteList");
    root.defineNamespace('xsi', 'http://www.w3.org/2001/XMLSchema-instance');
    root.defineNamespace('xlink', 'http://www.w3.org/1999/xlink');
    root.defineNamespace('tns', 'http://smpte.org/XXXX');
    root.node("tns:Originator", originator);
    root.node("tns:SystemName", sysname);
    root.node("tns:DateTimeCreated", created);
    var facList = root.node("tns:FacilityList");
    for (var i=0; i<facs.length; i++) {
        facList.node("tns:Facility").attr({id: facs[i].facility_id,
                                           modified: facs[i].modified.replace(' ', 'T'),
                                           'xlink:href': originator + '/' + facs[i].facility_id,
                                           'xlink:type': 'simple'});
    }
    var validationErrors;
    try {
        validationErrors = siteListSchemaDoc.validate(doc.toString());
    } catch(err) {
        console.log("caught exception!!! " + err.message);
    }
    if (validationErrors != null)
        console.log("errors = <" + validationErrors + ">");
    return doc;
} /* gen_faclist() */

/**
 * Generate an Error XML document
 * @param {String} token - Error token per ST 430-7 revision
 * @param {String} msg - Descriptive message per ST 430-7 revision
 * @return {Document} The generated XML document
 */
function gen_error(token, msg)
{
    var doc = new libxmljs.Document();
    var root = doc.node("tns:Error");
    root.defineNamespace('xsi', 'http://www.w3.org/2001/XMLSchema-instance');
    root.defineNamespace('tns', 'http://smpte.org/XXXX');
    root.node("tns:Token", token);
    root.node("tns:Message", msg);

    var validationErrors;
    try {
        validationErrors = errorSchemaDoc.validate(doc.toString());
    } catch(err) {
        console.log("caught exception!!! " + err.message);
    }
    if (validationErrors != null)
        console.log("errors = <" + validationErrors + ">");
    return doc;
} /* gen_error() */

/**
 * Connect to MariaDB database using supplied authentication information;
 * use the 'flm' database.
 * @param {String} [from] - optional text describing caller
 * @return {DB_Client} - client object
 */
function db_connect(from)
{
    var DB_client = require('mariasql');
    var dbclient = new DB_client();

    dbclient.connect(
        {
  	    host: '127.0.0.1',
  	    user: 'flmtest',
  	    password: 'pwd',
            db: 'flm',
       }
    );

    dbclient.on
    (
        'connect', function() { console.log('dbclient connected from ' + 
                                            (from != null) ? from : 'n/a'); }
    ).on
    (
        'error', function(err) { console.log('dbclient error: ' + err); }
    ).on
    (
        'close', function(hadError) { console.log('dbclient closed ' + 
						  ((hadError) ? 'with' : 'without') +
						  ' error');}
    );

    return dbclient;
} /* db_connect() */

/**
 * Handle an HTTP request to delete a facility from the database
 * @param req - an Express HTTP request object
 * @param res - and Express HTTP response object
 * @param [next] - next route handler
 */
function req_Delete(req, res, next) {
    var fac_id = req.url.substring(1);

    var dbclient = new db_connect('req_Delete');
    dbclient.query("DELETE FROM flm WHERE facility_id='" + fac_id + "';").on
    (
        'result', 
        function(result) 
        {
	    result.on
	    (
	        'row', 
	        function(row) { 
                    a.push(row);
                }
	    ).on
	    (
	        'error', 
	        function(err) { console.log('Result Error: ' + inspect(err)); }
	    ).on
	    (
	        'end', 
	        function(info) { 
                    console.log('Completed successfully; replaced=' + info.affectedRows); 
                    if (info.affectedRows == 1) { // deleted successfully
                        //console.log("no match");
                        res.sendStatus(204); // No Content
                    } else {
                        res.status(410).send(gen_error('NoSuchFLM',
                                                       'No Such FLM: ' + fac_id).toString());
                    }
                }
	    );
        }
    ).on
    (
        'end', 
        function() { console.log('Done with all results'); dbclient.end(); }
    );
} /* req_Delete() */

/**
 * Handle an HTTP request to add/update a facility to/in the database
 * @param req - an Express HTTP request object
 * @param res - and Express HTTP response object
 * @param [next] - next route handler
 */
function req_AddUpdate(req, res, next) {
    if (typeof req.rawBody == 'undefined') {
        console.log("bad");
        return;
    }
    console.log('raw=' + req.rawBody.length);
    var validationErrors;
    try {
        validationErrors = flmSchemaDoc.validate(req.rawBody);
    } catch(err) {
        validationErrors = "caught exception";
        //console.log("caught exception!!! " + err.message);
    }
    if (validationErrors != null) {
        console.log("errors = <" + validationErrors + ">");
        res.type('application/xml');
        res.status(400).send(gen_error('MalformedXML', 'Malformed XML').toString());
        return;
    }
    var doc = libxmljs.parseXmlString(req.rawBody);
    var node = doc.get("flm:FacilityInfo/flm:FacilityID", 
                      {flm: "http://www.smpte-ra.org/schemas/430-7/20XX/FLM"});
    //console.log(node.name() + "=" + node.text());
    var fac_id = node.text();
    var dbclient = new db_connect('req_AddUpdate');
    var inspect = require('util').inspect;
    var a = [];
    dbclient.query("REPLACE flm (facility_id, xml_data) VALUES ('" + fac_id + 
                   "', '" + req.rawBody + "');").on
    (
        'result', 
        function(result) 
        {
	    result.on
	    (
	        'row', 
	        function(row) { 
                    a.push(row);
                }
	    ).on
	    (
	        'error', 
	        function(err) { console.log('Result Error: ' + inspect(err)); }
	    ).on
	    (
	        'end', 
	        function(info) { 
                    console.log('Completed successfully; replaced=' + info.affectedRows); 
                    if (info.affectedRows == 1) {
                        //console.log("no match");
                        res.sendStatus(201); // Created
                    } else {
                        //console.log("found match");
                        res.sendStatus(204); // No Content
                    }
                }
	    );
        }
    ).on
    (
        'end', 
        function() { console.log('Done with all results'); dbclient.end(); }
    );

} /* req_AddUpdate() */

/**
 * Handle an HTTP request to get information about an existing facility
 * @param req - an Express HTTP request object
 * @param res - and Express HTTP response object
 * @param [next] - next route handler
 */
function req_GetFac(req, res, next) {
    var inspect = require('util').inspect;
    var doc = "undefined";
    var fac_id = req.url.substring(1);

    var dbclient = new db_connect('req_GetFac');
    var a = [];
    dbclient.query('SELECT modified, xml_data FROM flm WHERE facility_id=\'' + fac_id + '\';', null , true).on
    (
        'result', 
        function(result) 
        {
	    result.on
	    (
	        'row', 
	        function(row) { 
                    a.push(row);
                }
	    ).on
	    (
	        'error', 
	        function(err) { console.log('Result Error: ' + inspect(err)); }
	    ).on
	    (
	        'end', 
	        function(info) { 
                    console.log('Completed successfully'); 
                    res.type('application/xml');
                    if (a.length == 1) {
                        res.append('Last-Modified', mod_date(a[0][0]));
                        res.status(200).end(a[0][1]);
                    } else {
                        res.status(410).send(gen_error('NoSuchFLM',
                                                       'No Such FLM: ' + fac_id).toString());
                    }
                }
	    );
        }
    ).on
    (
        'end', 
        function() { console.log('Done with all results'); dbclient.end(); }
    );

} /* req_GetFac() */

/**
 * Handle an HTTP request to get a list of all facilities
 * @param req - an Express HTTP request object
 * @param res - and Express HTTP response object
 * @param [next] - next route handler
 */
function req_GetFacList(req, res, next) {
    var inspect = require('util').inspect;
    var doc = "undefined";
    var dbclient = db_connect('req_GetFacList');

    var a = [];
    dbclient.query('SELECT facility_id, modified FROM flm;').on
    (
        'result', 
        function(result) 
        {
	    result.on
	    (
	        'row', 
	        function(row) { 
                    a.push(row);
                }
	    ).on
	    (
	        'error', 
	        function(err) { console.log('Result Error: ' + inspect(err)); }
	    ).on
	    (
	        'end', 
	        function(info) { 
                    console.log('Completed successfully'); 
                    doc = gen_faclist(a);
                    res.type('application/xml');
                    res.status(200).send(doc.toString());
                }
	    );
        }
    ).on
    (
        'end', 
        function() { console.log('Done with all results'); dbclient.end(); }
    );

} /* req_GetFacList() */

/**
 * Create a hashed password resistent to Rainbow Table attacks
 * @param {String} - cleartext password string
 * @param {String} [method] - hash function; defaults to SHA-1
 * @param {String} [salt] - base64-encoded salt value
 * @return {Object} hash/salt/method tuple of password hash
 */
var create_password = function(passwd, method, salt) {
    var hmac;
    method || (method = "sha1");
    salt || (salt = crypto.randomBytes(6).toString('base64'));
    hmac = crypto.createHmac(method, salt);
    hmac.end(passwd);
    return {
	hash: hmac.read().toString('hex'),
	salt: salt,
	method: method
    };
};

/**
 * check to see if an HTTP client is authorized to access this FLM database
 * @param {String} authString - a base64-encoded Basic Authorization string
 * @return {Boolean} true iff the client is authorized
 */
function check_authorization(authString) {
    var auth = new Buffer(authString, 'base64').toString('utf8').split(':');
    //console.log("username=(" + auth[0] + "); pwd=(" + auth[1] + ")");
    for (var i=0; i<pwdFileList.length; i++) {
	if (auth[0] == pwdFileList[i].user) {
	    var pwd = create_password(auth[1], pwdFileList[i].method, pwdFileList[i].salt);
	    // console.log('u=' + auth[0] + ' pwd=' + auth[1] + " h1=" + pwdFileList[i].hash +
	    // 		' h2=' + pwd.hash);
	    if (pwd.hash == pwdFileList[i].hash)
		return true;
	    else
		return false;
	}
    }
    return false;
} /* check_authorization() */

/**
 * Main Express dispatch loop for handling HTTP requests
 * @param req - an Express HTTP request object
 * @param res - and Express HTTP response object
 * @param [next] - next route handler
 */
function dispatch(req, res, next) {
    console.log(util.format('Request received from %s: %s, %s',
                            req.ip, req.method, req.url));
    if (argv.a == 'basic') {
        var isAuthorized = (typeof req.headers['authorization'] != 'undefined') && 
            check_authorization(req.headers['authorization'].split(' ')[1]);
        console.log('isAuthorized=' + isAuthorized);
        if (!isAuthorized) {
            res.writeHead(401 , {'WWW-Authenticate': 'Basic realm="FLM"'});
            res.end();
            return;
        }
    }
    switch(req.method) {
    case "GET":
        if (req.url == '/') {
            req_GetFacList(req, res, next);
        } else
            req_GetFac(req, res, next);
        break;
    case "POST":
        if (req.url == '/') {
            req_AddUpdate(req, res, next);
        } else {
            res.type('application/xml');
            res.status(405).send(gen_error('MethodNotAllowed', 'Method not allowed').toString());
        }
        break;
    case "DELETE":
        req_Delete(req, res, next);
        break;
    default:
        res.type('application/xml');
        res.status(405).send(gen_error('MethodNotAllowed', 'Method not allowed').toString());
        break;
    }
} /* dispatch() */
