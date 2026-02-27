import { MongoClient } from "mongodb";

async function test() {
    const uri = "mongodb+srv://scridddhub:%40scridddhub17@cluster0.0m3kxkb.mongodb.net/?appName=Cluster0";
    const client = new MongoClient(uri);
    try {
        await client.connect();
        console.log("Connected successfully to server");
        const databases = await client.db().admin().listDatabases();
        console.log("Databases:", databases.databases.map(d => d.name));
    } catch (e) {
        console.error("Connection failed", e);
    } finally {
        await client.close();
    }
}

test();
