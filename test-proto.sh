#!/usr/bin/sh
echo "testing get facility list:"
curl -X GET -H "Authorization: Basic dXNlcjE6VGVycHNpY2hvcmQ=" http://localhost:3000
echo "testing get specific facility (xyz:123456)"
curl -X GET -H "Authorization: Basic dXNlcjE6VGVycHNpY2hvcmQ=" http://localhost:3000/xyz:123456
curl -X DELETE -H "Authorization: Basic dXNlcjE6VGVycHNpY2hvcmQ=" http://localhost:3000/xyz:583054
echo "testing insert (xyz:583054)"
curl -X POST -H "Content-Type: application/xml" --data-binary @database/f2.xml -H "Authorization: Basic dXNlcjE6VGVycHNpY2hvcmQ=" http://localhost:3000/

