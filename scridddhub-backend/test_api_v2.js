const http = require('http');

const data = JSON.stringify({
    label: "TestField",
    type: "text",
    required: false,
    material_scope: ["Plastic"]
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/erp/TENANT-001/inventory/fields',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);

    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (error) => {
    console.error(error);
});

req.write(data);
req.end();
