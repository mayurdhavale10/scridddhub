
const http = require('http');

// Batch ID obtained from your mock_inventory.json
const batchId = 'SCRID-YARD-001-20260210-2286';
const tenantId = 'TENANT-001';

const postData = JSON.stringify({
    status: 'pass',
    notes: 'Manual Test via Script',
    checkedBy: 'TEST_SCRIPT'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: `/api/erp/${tenantId}/inventory/${batchId}/qc`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

console.log(`Testing QC Submit for Batch: ${batchId}`);
console.log(`Target URL: http://localhost:3000${options.path}`);

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('Response Body:', body);
    });
});

req.on('error', (e) => {
    console.error(`PROBLEM with request: ${e.message}`);
});

req.write(postData);
req.end();
