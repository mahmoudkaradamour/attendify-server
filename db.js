/**
 * =========================================================️ DATABASE CONNECTION MODULE (MONGODB RESOURCE MANAGER) * ============================================================
 * ============================================================
 *
 * 🎯 PURPOSE:
 *
 * This module is responsible for:
 *
 *   ✅ Establishing connection to MongoDB
 *   ✅ Managing connection lifecycle
 *   ✅ Providing a shared database instance
 *   ✅ Preventing redundant connections
 *
 * ------------------------------------------------------------
 *
 * 🧠 ARCHITECTURAL ROLE:
 *
 *   Application Layer (Express Server)
 *             ↓
 *   Database Module (THIS FILE)
 *             ↓
 *   MongoDB Driver (Node.js)
 *             ↓
 *   MongoDB Atlas Cluster
 *
 * ------------------------------------------------------------
 *
 * 📊 CONNECTION FLOW DIAGRAM:
 *
 *   Server Startup
 *        ↓
 *   connectDB()
 *        ↓
 *   Check existing connection
 *        ↓
 *   If NOT connected:
 *        ↓
 *   Create MongoClient instance
 *        ↓
 *   Establish TCP + TLS connection
 *        ↓
 *   Select database
 *        ↓
 *   Store reference (singleton)
 *        ↓
 *   Return db instance
 *
 * ------------------------------------------------------------
 *
 * 🧠 DESIGN PRINCIPLE:
 *
 * This module implements a **Singleton Pattern**
 *
 * WHY?
 *
 *   ❌ Creating multiple DB connections is expensive
 *   ❌ Causes resource exhaustion
 *   ✅ Reuse single connection across application
 *
 * ------------------------------------------------------------
 */


/* ============================================================
   📦 MODULE IMPORTS
   ============================================================ */

/**
 * MongoDB Native Driver
 *
 * Provides:
 *   - MongoClient for connection
 *   - Low-level access to MongoDB
 */
const { MongoClient } = require("mongodb");


/* ============================================================
   ⚙️ INTERNAL STATE (CONNECTION CACHE)
   ============================================================ */

/**
 * Cached database instance
 *
 * Acts as Singleton storage
 */
let db = null;

/**
 * Cached client instance (for advanced control)
 */
let client = null;


/* ============================================================
   🔐 CONNECTION CONFIGURATION
   ============================================================ */

/**
 * MongoDB connection URI
 */
const MONGO_URI = process.env.MONGO_URL;

/**
 * Database name
 */
const DB_NAME = "attendify";


/* ============================================================
   🔌 MAIN CONNECTION FUNCTION
   ============================================================ */

/**
 * ============================================================
 * FUNCTION: connectDB
 * ============================================================
 *
 * PURPOSE:
 * Establish and return a MongoDB connection (singleton)
 *
 * RETURNS:
 *   Promise<Db>
 *
 * ------------------------------------------------------------
 *
 * 🧠 EXECUTION STRATEGY:
 *
 *   If connection exists → reuse
 *   Else → create new connection
 *
 * ------------------------------------------------------------
 *
 * 📊 EXECUTION FLOW:
 *
 *   call connectDB()
 *        ↓
 *   check if db exists
 *        ↓
 *   YES → return db ✅
 *   NO  → create connection
 *
 */
async function connectDB() {

  /* ========================================================
     🧠 STEP 1: CHECK EXISTING CONNECTION
     ======================================================== */

  if (db) {
    return db; // ✅ reuse existing connection
  }


  /* ========================================================
     🧠 STEP 2: VALIDATE CONFIGURATION
     ======================================================== */

  if (!MONGO_URI) {
    throw new Error("MONGO_URL is not defined in environment variables");
  }


  /* ========================================================
     🧠 STEP 3: INITIALIZE CLIENT
     ======================================================== */

  /**
   * MongoClient configuration:
   *
   * useNewUrlParser:
   *   Enables modern connection string parsing
   *
   * useUnifiedTopology:
   *   Uses new server discovery engine
   *
   * serverSelectionTimeoutMS:
   *   Timeout for server discovery
   */
  client = new MongoClient(MONGO_URI, {
    maxPoolSize: 10,                // ✅ connection pooling
    serverSelectionTimeoutMS: 5000, // ✅ fail fast if DB unreachable
  });


  /* ========================================================
     🔌 STEP 4: ESTABLISH CONNECTION
     ======================================================== */

  await client.connect();


  /* ========================================================
     🧠 STEP 5: SELECT DATABASE
     ======================================================== */

  db = client.db(DB_NAME);


  /* ========================================================
     📊 STEP 6: LOG CONNECTION SUCCESS
     ======================================================== */

  console.log("✅ MongoDB connected successfully");


  /* ========================================================
     📤 STEP 7: RETURN INSTANCE
     ======================================================== */

  return db;
}


/* ============================================================
   🔒 OPTIONAL: CONNECTION CLOSE HANDLER
   ============================================================ */

/**
 * Graceful shutdown (advanced)
 *
 * Ensures:
 *   - Connections closed properly
 *   - No memory leaks
 */
async function closeDB() {
  if (client) {
    await client.close();
    console.log("🔌 MongoDB connection closed");
  }
}


/* ============================================================
   📊 DATABASE ARCHITECTURE ANALYSIS
   ============================================================ */

/**
 * 🔬 MONGODB ARCHITECTURE MODEL:
 *
 *   Collection-Based (NoSQL)
 *
 *   Example:
 *     DB: attendify
 *        → collection: companies
 *        → collection: logs (future)
 *        → collection: sessions (future)
 *
 * ------------------------------------------------------------
 *
 * ✅ BENEFITS:
 *
 *   - Schema flexibility
 *   - Horizontal scaling
 *   - JSON-like documents
 *
 * ------------------------------------------------------------
 *
 * 🔐 SECURITY MODEL:
 *
 *   - Connection over TLS
 *   - Authentication via URI credentials
 *
 * ------------------------------------------------------------
 *
 * ⚡ PERFORMANCE MODEL:
 *
 *   - Connection pooling (maxPoolSize)
 *   - Reuse connections (singleton)
 *
 */


/* ============================================================
   📦 EXPORT
   ============================================================ */

module.exports = {
  connectDB,
  closeDB
};


/* ============================================================
   🏁 END OF FILE
   ============================================================ */
