const postData = JSON.stringify({
    materialId: "MAT-001",
    supplierId: "SUP-001",
    yardId: "YARD-001",
    employeeId: "EMP-001",
    grossWeight: 1000,
    tareWeight: 100,
    weighMethod: "digital_scale",
    intakeType: "purchase",
    vehicleNumber: "MH-12-AB-1234",
    vehicleType: "truck"
});

console.log("Sending POST request to http://127.0.0.1:3000/api/erp/demo-tenant/inventory...");

fetch('http://127.0.0.1:3000/api/erp/demo-tenant/inventory', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: postData,
})
    .then(async response => {
        const text = await response.text();
        try {
            const data = JSON.parse(text);
            console.log('Response Status:', response.status);
            console.log('Response Body:', JSON.stringify(data, null, 2));
        } catch (e) {
            console.log('Response Status:', response.status);
            console.log('Response Text (Non-JSON):', text);
        }
    })
    .catch((error) => console.error('Fetch Error:', error));
