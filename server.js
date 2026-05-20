/**
 * =============================================================================
 * Attendify — Server Bootstrap (Deterministic System Orchestrator)
 * =============================================================================
 *
 * OVERVIEW
 * =============================================================================
 *
 * This module acts as the **composition root** of the system.
 * It orchestrates the initialization and lifecycle of:
 *
 *   • Configuration (C)
 *   • Infrastructure (I)
 *   • Application (A)
 *   • Background Workers (W)
 *
 * =============================================================================
 *
 * 🧠 FORMAL BOOTSTRAP MODEL
 * =============================================================================
 *
 * Let:
 *
 *   C = validated configuration
 *   I = infrastructure layer (Redis, MongoDB)
 *   A = HTTP application (Express)
 *   W = background workers (BullMQ)
 *
 * Then:
 *
 *   SYSTEM = validate(C) → init(I) → start(A) → attach(W) → manageLifecycle()
 *
 * =============================================================================
 *
 * 📊 STARTUP PIPELINE (STRICT ORDER)
 * =============================================================================
 *
 *       ENV LOAD
 *          │
 *          ▼
 *   CONFIG VALIDATION
 *          │
 *          ▼
 *   INFRASTRUCTURE READY
 *          │
 *          ▼
 *   APP CONSTRUCTION
 *          │
 *          ▼
 *   HTTP SERVER START
 *          │
 *          ▼
 *   WORKER ATTACHMENT
 *          │
 *          ▼
 *   SHUTDOWN REGISTRATION
 *          │
 *          ▼
 *        READY ✅
 *
 * =============================================================================
 *
 * 📊 SHUTDOWN FLOW (ORDERED RESOURCE RELEASE)
 * =============================================================================
 *
 *   1. Stop HTTP intake
 *   2. Stop background workers
 *   3. Close Redis
 *   4. Close MongoDB
 *
 * =============================================================================
 *
 * 🔐 GUARANTEES
 * =============================================================================
 *
 *   ✅ Fail-fast on invalid config
 *   ✅ Deterministic initialization
 *   ✅ Zero resource leakage
 *   ✅ Graceful shutdown behavior
 *
 * =============================================================================
 */

require("dotenv").config();

const http = require("http");

/* =============================================================================
 * CONFIG VALIDATION
 * =============================================================================
 */

const {
  validateConfig
} = require("./src/config/config.validator");

/**
 * 🚨 System MUST NOT start with invalid configuration
 */
validateConfig();

/* =============================================================================
 * APPLICATION
 * =============================================================================
 */

const createApp =
  require("./src/app/create-app");

/* =============================================================================
 * INFRASTRUCTURE
 * =============================================================================
 */

/**
 * ✅ FIX:
 * Correct path (cache, not redis/)
 */
const redis =
  require("./src/infrastructure/cache/redis.client");

const mongo =
  require("./src/infrastructure/mongo/mongo.connection");

/* =============================================================================
 * WORKER
 * =============================================================================
 *
 * Importing worker initializes it immediately (BullMQ model)
 */

const evidenceWorker =
  require("./src/workers/evidence.worker");

/* =============================================================================
 * LIFECYCLE MANAGEMENT
 * =============================================================================
 */

const {
  registerResource,
  registerShutdownHandlers
} = require("./src/infrastructure/graceful-shutdown");

/* =============================================================================
 * OBSERVABILITY
 * =============================================================================
 */

const logger =
  require("./src/infrastructure/logging/logger");

/* =============================================================================
 * CONFIGURATION
 * =============================================================================
 */

const PORT = process.env.PORT || 3000;

let isShuttingDown = false;

/* =============================================================================
 * BOOTSTRAP FUNCTION
 * =============================================================================
 */

async function bootstrap() {

  try {

    logger.info("Bootstrap phase: START");

    /**
     * -------------------------------------------------------------------------
     * STEP 1 — INITIALIZE INFRASTRUCTURE
     * -------------------------------------------------------------------------
     *
     * NOTE:
     *
     * ioredis connects automatically → NO manual connect()
     */

    logger.info("Initializing infrastructure");

    /**
     * Mongo requires explicit connection
     */
    await mongo.connect();

    logger.info("Infrastructure: READY");

    /**
     * -------------------------------------------------------------------------
     * STEP 2 — CREATE APPLICATION
     * -------------------------------------------------------------------------
     */

    const app = createApp();

    /**
     * -------------------------------------------------------------------------
     * READINESS GUARD
     * -------------------------------------------------------------------------
     *
     * Reject new requests during shutdown phase
     */
    app.use((req, res, next) => {

      if (isShuttingDown) {

        return res.status(503).json({
          error: "Service Unavailable",
          message: "Server is shutting down"
        });
      }

      next();
    });

    const server = http.createServer(app);

    /**
     * -------------------------------------------------------------------------
     * STEP 3 — START HTTP SERVER
     * -------------------------------------------------------------------------
     */

    await new Promise((resolve, reject) => {

      server.once("error", reject);
      server.listen(PORT, resolve);

    });

    logger.info("HTTP server started", {
      port: PORT
    });

    /**
     * -------------------------------------------------------------------------
     * STEP 4 — REGISTER SHUTDOWN SEQUENCE
     * -------------------------------------------------------------------------
     */

    /**
     * 1️⃣ HTTP SERVER
     */
    registerResource("http-server", async () => {

      isShuttingDown = true;

      logger.warn("Closing HTTP server");

      await new Promise((resolve, reject) => {
        server.close(err => {
          if (err) return reject(err);
          resolve();
        });
      });

      logger.warn("HTTP server closed");
    });

    /**
     * 2️⃣ WORKER (BullMQ)
     */
    registerResource(
      "worker",
      evidenceWorker.close
    );

    /**
     * 3️⃣ REDIS
     *
     * NOTE:
     * ioredis uses quit() instead of close()
     */
    registerResource("redis", async () => {

      logger.warn("Closing Redis");

      await redis.quit();

      logger.warn("Redis closed");
    });

    /**
     * 4️⃣ MONGO
     */
    registerResource(
      "mongo",
      mongo.close
    );

    /**
     * -------------------------------------------------------------------------
     * STEP 5 — ATTACH SIGNAL HANDLERS
     * -------------------------------------------------------------------------
     */

    registerShutdownHandlers();

    /**
     * -------------------------------------------------------------------------
     * SYSTEM READY
     * -------------------------------------------------------------------------
     */

    logger.info("System READY ✅");

  } catch (error) {

    /**
     * FAIL-FAST STRATEGY
     */
    logger.error("Bootstrap failed", error);

    process.exit(1);
  }
}

/* =============================================================================
 * ENTRY POINT
 * =============================================================================
 */

bootstrap();

/**
 * =============================================================================
 * ADVANCED ARCHITECTURAL NOTES
 * =============================================================================
 *
 * 1. INITIALIZATION ORDER
 * -----------------------------------------------------------------------------
 *
 * initialize(I) before start(A)
 *
 * ensures no request hits uninitialized dependencies
 *
 * -----------------------------------------------------------------------------
 *
 * 2. REDIS DESIGN DECISION
 * -----------------------------------------------------------------------------
 *
 * ioredis is:
 *   • lazy-loaded
 *   • auto-connected
 *
 * therefore:
 *
 *   connect() ❌
 *   quit() ✅
 *
 * -----------------------------------------------------------------------------
 *
 * 3. WORKER MODEL
 * -----------------------------------------------------------------------------
 *
 * Importing worker module:
 *
 *   require(worker) → initializes Worker()
 *
 * No explicit start() required.
 *
 * -----------------------------------------------------------------------------
 *
 * 4. SHUTDOWN SAFETY
 * -----------------------------------------------------------------------------
 *
 * Order matters:
 *
 *   HTTP → Worker → Redis → DB
 *
 * Prevents:
 *
 *   • orphan jobs
 *   • lost writes
 *   • race conditions
 *
 * -----------------------------------------------------------------------------
 *
 * 5. FAILURE STRATEGY
 * -----------------------------------------------------------------------------
 *
 * System uses:
 *
 *   FAIL-FAST on startup
 *   GRACEFUL shutdown on exit
 *
 * =============================================================================
 *
 * END OF FILE
 * =============================================================================
 */
