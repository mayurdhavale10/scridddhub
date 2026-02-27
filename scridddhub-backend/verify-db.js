const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env.local manually
const envPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const uri = process.env.MONGODB_URI;
console.log('Testing MongoDB Connection...');
console.log('URI:', uri ? uri.replace(/:([^:@]+)@/, ':****@') : 'Undefined'); // Mask password

if (!uri) {
    console.error('❌ MONGODB_URI is missing!');
    process.exit(1);
}

const client = new MongoClient(uri);

async function run() {
    try {
        console.log('Connecting...');
        await client.connect();
        console.log('✅ Connected successfully to server');

        const db = client.db();
        console.log('Database Name:', db.databaseName);

        const collections = await db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));

        // Test write
        console.log('Testing Write...');
        const col = db.collection('_test_verify_db');
        await col.insertOne({ test: true, date: new Date() });
        console.log('✅ Write Successful');

        await col.deleteMany({ test: true });
        console.log('✅ Cleanup Successful');

    } catch (err) {
        console.error('❌ MongoDB Connection Failed:', err);
    } finally {
        await client.close();
    }
}

run();
