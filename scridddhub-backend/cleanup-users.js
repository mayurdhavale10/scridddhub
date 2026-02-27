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
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db();
        const users = db.collection('users');
        const otps = db.collection('otp_codes');

        console.log('Cleaning up DB...');
        await users.deleteMany({});
        await otps.deleteMany({});
        console.log('✅ All users and OTPs deleted.');

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

run();
