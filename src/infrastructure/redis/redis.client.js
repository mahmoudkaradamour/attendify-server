/**
 * =============================================================================
 * Attendify — Redis Client (Resilient Distributed Infrastructure Layer)
 * =============================================================================
 *
 * PURPOSE
 *
 * This module provides a **fault-tolerant, observable, singleton Redis client**
 * used across the system for caching, locking, idempotency, and queue backend.
 *
 * =============================================================================
 *
 * 🧠 FORMAL MODEL (CONNECTION MANAGEMENT)
 *
 * Let:
 *
 *   C = client
 *   R = Redis instance
 *
 * Then:
 *
 *   C → R (singleton connection)
 *
 * ensuring:
 *
 *   - connection reuse
 *   - controlled lifecycle
 *   - minimal overhead
 *
 * =============================================================================
 *
 * 📊 EXECUTION FLOW
 *
 *        Operation Request
 *              │
 *              ▼
 *         Proxy Layer
 *              │
 *              ▼
 *        Ensure Connection
 *              │
 *      ┌───────┴────────┐
 *      ▼                ▼
 *   Connected        Not Connected
 *      │                │
 *      ▼                ▼
 *     Execute         Connect → Execute
 *
 * =============================================================================
 *
 * 🔐 DESIGN OBJECTIVES
 *
 *   ✅ Singleton connection (no duplication)
 *   ✅ Resilience against failures
 *   ✅ Safe command execution
 *   ✅ Deterministic lifecycle handling
 *
 * =============================================================================
 */

const { createClient } = require("redis");

const logger =
  require("../logging/logger");

/* =============================================================================
 * CONFIGURATION
 * =============================================================================
 */

const REDIS_URL =
  process.env.REDIS_URL || "redis://127.0.0.1:6379";

/* =============================================================================
 * INTERNAL STATE (SINGLETON)
 * =============================================================================
 */

let client = null;
let connectingPromise = null;

/* =============================================================================
 * CLIENT INITIALIZATION
 * =============================================================================
 */

function initClient() {

  if (client) return client;

  client = createClient({
    url: REDIS_URL,
    socket: {
      reconnectStrategy(retries) {

        const delay = Math.min(retries * 100, 3000);

        logger.warn("Redis reconnect attempt", {
          retries,
          delay
        });

        return delay;
      }
    }
  });

  client.on("connect", () => {
    logger.info("Redis connecting");
  });

  client.on("ready", () => {
    logger.info("Redis ready");
  });

  client.on("error", (err) => {
    logger.error("Redis error", err);
  });

  client.on("end", () => {
    logger.warn("Redis connection closed");
  });

  return client;
}

/* =============================================================================
 * CONNECT (RACE-SAFE)
 * =============================================================================
 */

async function connect() {

  const c = initClient();

  if (c.isOpen) {
    return c;
  }

  /**
   * Prevent concurrent multiple connections
   */
  if (!connectingPromise) {

    connectingPromise = c.connect()
      .then(() => {
        connectingPromise = null;
        return c;
      })
      .catch((err) => {
        connectingPromise = null;
        logger.error("Redis connection failed", err);
        throw err;
      });
  }

  return connectingPromise;
}

/* =============================================================================
 * SAFE EXECUTION WRAPPER
 * =============================================================================
 */

async function executeCommand(command, args) {

  const c = await connect();

  if (typeof c[command] !== "function") {
    throw new Error(`Invalid Redis command: ${command}`);
  }

  try {

    return await c[command](...args);

  } catch (err) {

    logger.error("Redis command failed", err, {
      command
    });

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

    if (client.isOpen) {

      logger.warn("Closing Redis connection");

      await client.quit();

      logger.warn("Redis connection closed");
    }

  } catch (err) {

    logger.error("Error closing Redis", err);

    throw err;
  }
}

/* =============================================================================
 * PROXY INTERFACE
 * =============================================================================
 *
 * Dynamically handles all Redis commands
 */

const redisProxy = new Proxy({}, {

  get(_, prop) {

    return async (...args) => {
      return executeCommand(prop, args);
    };
  }

});

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  /**
   * Direct access (advanced use)
   */
  getClient: connect,

  /**
   * Proxy interface (recommended)
   */
  ...redisProxy,

  /**
   * Lifecycle control
   */
  connect,
  close
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */
