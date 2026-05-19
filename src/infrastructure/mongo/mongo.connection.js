/**
 * =============================================================================
 * Attendify — MongoDB Connection Manager (Resilient Data Access Layer)
 * =============================================================================
 *
 * PURPOSE
 *
 * This module implements a **fault-tolerant, singleton MongoDB connection layer**
 * responsible for managing database connectivity across the system.
 *
 * =============================================================================
 *
 * 🧠 FORMAL MODEL (CONNECTION LIFECYCLE)
 *
 * Let:
 *
 *   M = MongoDB cluster
 *   C = client instance
 *   D = database instance
 *
 * Then:
 *
 *   C → M
 *   D = C.db(name)
 *
 * ensuring:
 *
 *   - single connection pool
 *   - optimized resource usage
 *   - controlled lifecycle
 *
 * =============================================================================
 *
 * 📊 EXECUTION FLOW
 *
 *        Operation Request
 *              │
 *              ▼
 *          getDb()
 *              │
 *      ┌───────┴────────┐
 *      ▼                ▼
 *   Available       Not Available
 *      │                │
 *      ▼                ▼
 *    Return         connect()
 *
 * =============================================================================
 *
 * 🔐 DESIGN OBJECTIVES
 *
 *   ✅ Singleton connection reuse
 *   ✅ Race-safe initialization
 *   ✅ Safe shutdown handling
 *   ✅ Observability integration
 *
 * =============================================================================
 */

const { MongoClient } = require("mongodb");

const logger =
  require("../logging/logger");

/* =============================================================================
 * CONFIGURATION
 * =============================================================================
 */

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017";

const DB_NAME =
  process.env.MONGO_DB_NAME || "attendify";

/* =============================================================================
 * INTERNAL STATE
 * =============================================================================
 */

let client = null;
let dbInstance = null;
let connectingPromise = null;

/* =============================================================================
 * INITIALIZE CLIENT
 * =============================================================================
 */

function initClient() {

  if (client) return client;

  client = new MongoClient(MONGO_URI, {
    maxPoolSize: 10,
    connectTimeoutMS: 5000,
    serverSelectionTimeoutMS: 5000
  });

  return client;
}

/* =============================================================================
 * CONNECT (RACE-SAFE)
 * =============================================================================
 */

async function connect() {

  if (dbInstance) {
    return dbInstance;
  }

  const c = initClient();

  /**
   * Prevent concurrent connection attempts
   */
  if (!connectingPromise) {

    logger.info("Connecting to MongoDB");

    connectingPromise = c.connect()
      .then(() => {

        dbInstance = c.db(DB_NAME);

        logger.info("MongoDB connected", {
          dbName: DB_NAME
        });

        connectingPromise = null;

        return dbInstance;
      })
      .catch((err) => {

        connectingPromise = null;

        logger.error("MongoDB connection failed", err);

        throw err;
      });
  }

  return connectingPromise;
}

/* =============================================================================
 * GET DATABASE INSTANCE
 * =============================================================================
 */

async function getDb() {

  if (dbInstance) {
    return dbInstance;
  }

  return connect();
}

/* =============================================================================
 * HEALTH CHECK (SAFE)
 * =============================================================================
 */

async function ping() {

  try {

    const db = await getDb();

    return await db.command({ ping: 1 });

  } catch (err) {

    logger.error("MongoDB ping failed", err);

    throw err;
  }
}

/* =============================================================================
 * CLOSE CONNECTION (SAFE SHUTDOWN)
 * =============================================================================
 */

async function close() {

  if (!client) return;

  try {

    if (client) {

      logger.warn("Closing MongoDB connection");

      await client.close();

      client = null;
      dbInstance = null;
      connectingPromise = null;

      logger.warn("MongoDB connection closed");
    }

  } catch (err) {

    logger.error("Error closing MongoDB", err);

    throw err;
  }
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  connect,
  getDb,
  close,
  ping
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */
