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

