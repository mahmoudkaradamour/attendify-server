const { MongoClient } = require("mongodb");

let db = null;

async function connectDB() {
  if (db) return db;

  const client = new MongoClient(process.env.MONGO_URL);

  await client.connect();

  db = client.db("attendify");

  console.log("✅ MongoDB connected");

  return db;
}

module.exports = { connectDB };
