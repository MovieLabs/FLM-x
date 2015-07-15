/*
 * 
 * @author Paul Jensen <pgj@movielabs.com>
 * 
 */

var crypto = require('crypto');
var fs = require('fs');

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

// var check_password = function(hashed, passwd) {
//     var hash, hashp, method, salt, _ref;
//     _ref = hashed.split("$"), method = _ref[0], salt = _ref[1], hashp = _ref[2];
//     hash = create_password(passwd, method, salt).hash;
//     return hash === hashp;
// };

/**
 * read a file of colon-delimited username:password tuples and generate
 * a corresponding list colon-delimited username:hash tuples. Invoke
 * with 'node pwd-gen.js <password-file>'.  Hashed passwords are output to
 * stdout.
 */
var doc = process.argv[2]; 
var documentString = fs.readFileSync(doc, 'utf8');
var lines = documentString.split('\n');
for (var i=0; i<lines.length; i++) {
    if (lines[i].length > 0) {
	var fld = lines[i].split(':');
	var hpwd = create_password(fld[1]);
	console.log(fld[0] + ':' + hpwd.method + '|' + hpwd.salt + '|' + hpwd.hash);
    }
}

