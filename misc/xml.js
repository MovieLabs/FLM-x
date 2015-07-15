var fs = require('fs');
var xsd = require('libxml-xsd');
var doc = process.argv[2]; //"f1.xml";

var schemaPath = "21DC-PD-ST-430-7-revision-20150602.xsd";
var schemaString = fs.readFileSync(schemaPath, 'utf8');

var documentString = fs.readFileSync(doc, 'utf8');

var schema = xsd.parse(schemaString);
 
var validationErrors;
console.log("validating " + doc + " against " + schemaPath);
try {
    validationErrors = schema.validate(documentString);
} catch(err) {
    console.log("caught exception!!! " + err.message);
}
if (validationErrors != null)
    console.log("errors = <" + validationErrors + ">");

// wait for the result, then use it
//console.log(data);

// xsd.parseFile(schemaPath, function(err, schema){
//   schema.validate(documentString, function(err, validationErrors){
//     // err contains any technical error 
//     // validationError is an array, empty if the validation is ok 
//   });  
// });
