/**
 * =============================================================================Production Bootstrap Orchestrator) * =============================================================================
 * =============================================================================
 *
 * FILE:
 * src/app.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module is the authoritative bootstrap and lifecycle controller of the
 * Attendify backend runtime.
 *
 * It guarantees:
 *
 *   - deterministic startup sequence
 *   - infrastructure readiness before serving requests
 *   - centralized lifecycle management
 *   - graceful shutdown execution
 *
 * -----------------------------------------------------------------------------
 * SYSTEM INITIALIZATION FLOW
 * -----------------------------------------------------------------------------
 *
 *   PROCESS START
 *       │
 *       ▼
 *   load config (env.js)
 *       │
 *       ▼
 *   connectMongo()
 *       │
 *       ▼
 *   connectRedis()
 *       │
 *       ▼
 *   createApp()
 *       │
 *       ▼
 *   http.createServer()
 *       │
 *       ▼
 *   server.listen()
 *
 * -----------------------------------------------------------------------------
 * SHUTDOWN FLOW
 * -----------------------------------------------------------------------------
 *
 *   SIGNAL (SIGINT / SIGTERM)
 *         │
 *         ▼
 *   graceful-shutdown handler
 *         │
 *         ▼
 *   stop accepting connections
 *         │
 *         ▼
 *   wait for in-flight requests
 *         │
 *         ▼
 *   close MongoDB
 *         │
 *         ▼
 *   close Redis
 *         │
 *         ▼
 *   process.exit()
 *
 * -----------------------------------------------------------------------------
 * CORE DESIGN PRINCIPLES
 * -----------------------------------------------------------------------------
 *
 *   1. FAIL-FAST:
 *      If infrastructure is not available → terminate immediately
 *
 *   2. SINGLE SOURCE OF LIFECYCLE CONTROL:
 *      No duplicated shutdown logic
 *
 *   3. DETERMINISTIC BOOT:
 *      Same order every time (no race conditions)
 *
 * -----------------------------------------------------------------------------
 * FORMAL GUARANTEE
 * -----------------------------------------------------------------------------
 *
 *   ∀ request R:
 *     R is processed only after:
 *       MongoDB ∧ Redis ∧ App are READY
 *
 * =============================================================================
 */

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

const http = require("http");

const config = require("./config/env");

const logger = require("./observability/logger");

const { createApp } = require("./app/create-app");

/**
 * Infrastructure
 */
const {
  connectMongo,
  disconnectMongo
} = require("./infrastructure/mongo/mongo.connection");

const {
  connectRedis,
  disconnectRedis
} = require("./infrastructure/redis/redis.client");

/**
 * Shutdown system
 */
const {
  createShutdownHandler,
  registerShutdownSignals
} = require("./infrastructure/graceful-shutdown");

/* =============================================================================
 * BOOTSTRAP (ASYNC ENTRYPOINT)
 * =============================================================================
 */

async function bootstrap() {

  /**
   * Guard against partial startup failures
   */
  let server = null;

  try {

    logger.info("Bootstrapping Attendify application");

    /* -------------------------------------------------------------------------
     * STEP 1: CONNECT MONGODB
     * ------------------------------------------------------------------------- */
    await connectMongo();

    /* -------------------------------------------------------------------------
     * STEP 2: CONNECT REDIS
     * ------------------------------------------------------------------------- */
    await connectRedis();

    /* -------------------------------------------------------------------------
     * STEP 3: CREATE EXPRESS APP
     * ------------------------------------------------------------------------- */
    const app = createApp();

    /* -------------------------------------------------------------------------
     * STEP 4: CREATE HTTP SERVER
     * ------------------------------------------------------------------------- */
    server = http.createServer(app);

    /* -------------------------------------------------------------------------
     * STEP 5: START LISTENING
     * ------------------------------------------------------------------------- */
    await new Promise((resolve) => {
      server.listen(config.PORT, resolve);
    });

    logger.info("Attendify server is ready", {
      context: {
        port: config.PORT,
        env: config.NODE_ENV,
        pid: process.pid
      }
    });

    /* -------------------------------------------------------------------------
     * STEP 6: REGISTER SHUTDOWN HANDLERS
     * ------------------------------------------------------------------------- */
    const shutdownHandler =
      createShutdownHandler({
        server,
        timeout: 10000
      });

    registerShutdownSignals(shutdownHandler);

  } catch (error) {

    logger.error("FATAL: Application bootstrap failed", {
      error
    });

    /**
     * Attempt safe cleanup in safe order
     */
    await safeCleanup(server);

    process.exit(1);
  }
}

/* =============================================================================
 * SAFE CLEANUP (FAILURE PATH ONLY)
 * =============================================================================
 */

async function safeCleanup(server) {

  /**
   * Close HTTP server if exists
   */
  if (server) {
    try {
      server.close();
    } catch (_) {}
  }

  /**
   * Close Mongo
   */
  try {
    await disconnectMongo();
  } catch (_) {}

  /**
   * Close Redis
   */
  try {
    await disconnectRedis();
  } catch (_) {}
}

/* =============================================================================
 * START APPLICATION
 * =============================================================================
 */

bootstrap();

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */
