const fetch = require('node-fetch');

async function test() {
    try {
        const res = await fetch('http://localhost:3000/api/erp/TENANT-001/inventory/fields', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                label: "TestField",
                type: "text",
                required: false,
                material_scope: ["Plastic"]
            })
        });

        console.log("Status:", res.status);
        const json = await res.json();
        console.log("Body:", json);
    } catch (e) {
        console.error(e);
    }
}

test();
