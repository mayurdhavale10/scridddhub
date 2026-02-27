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

        console.log('--- USERS IN DB ---');
        const allUsers = await users.find({}).toArray();
        if (allUsers.length === 0) console.log('No users found.');

        allUsers.forEach(u => {
            console.log(`Email: ${u.email}`);
            console.log(`ID: ${u._id}`);
            console.log(`Verified: ${u.isVerified}`);
            console.log(`Has PasswordHash: ${!!u.passwordHash}`);
            console.log(`GoogleSub: ${u.googleSub}`);
            console.log('-------------------');
        });

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

run();
