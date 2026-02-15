const http = require('http');

console.log('Triggering Library Rescan to fix database relationships...');

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/metadata/rescan',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
});

req.on('error', (e) => {
    console.error(`Error triggering rescan: ${e.message}`);
    console.error('Make sure the server is running!');
});

req.write(JSON.stringify({}));
req.end();
