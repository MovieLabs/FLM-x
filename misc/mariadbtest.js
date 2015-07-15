// adapted from https://github.com/mscdex/node-mariasql

var inspect = require('util').inspect;
var Client = require('mariasql');

var client = new Client();
client.connect
(
    {
  	host: '127.0.0.1',
  	user: 'flmtest',
  	password: 'pwd'
    }
);

client.on
(
    'connect', function() { console.log('Client connected'); }
).on
(
    'error', function(err) { console.log('Client error: ' + err); }
).on
(
    'close', function(hadError) { console.log('Client closed'); }
);

client.query('SHOW DATABASES').on
(
    'result', 
    function(result) 
    {
	result.on
	(
	    'row', 
	    function(row) { console.log('Result: ' + inspect(row)); }
	).on
	(
	    'error', 
	    function(err) { console.log('Result Error: ' + inspect(err)); }
	).on
	(
	    'end', 
	    function(info) { console.log('Completed successfully'); }
	);
    }
).on
(
    'end', 
    function() { console.log('Done with all results'); }
);

client.end();
