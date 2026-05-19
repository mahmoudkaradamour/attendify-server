/**
 * =============================================================================
 * Attendify — Server Bootstrap (Deterministic System Orchestrator)
 * =============================================================================
 *
 * PURPOSE
 *
 * This module is the **composition root and lifecycle coordinator**
 * of the entire system.
 *
 * It guarantees:
 *
 *   ✅ Valid configuration before execution
 *   ✅ Deterministic infrastructure initialization
 *   ✅ Safe application startup
 *   ✅ Strict shutdown orchestration
 *
 * =============================================================================
 *
 * 🧠 FORMAL MODEL (SYSTEM INITIALIZATION FUNCTION)
 *
 * Let:
 *
 *   C = configuration
 *   I = infrastructure (Redis, Mongo)
 *   A = application (Express)
 *
 * Then:
 *
 *   System = validate(C) → init(I) → start(A) → manageLifecycle()
 *
 * =============================================================================
 *
 * 📊 STARTUP PIPELINE (STRICTLY ORDERED)
 *
 *       ENV LOAD
 *          │
 *          ▼
 *   CONFIG VALIDATION (FAIL FAST)
 *          │
 *          ▼
 *   INFRASTRUCTURE INIT
 *          │
 *          ▼
 *     APP COMPOSITION
 *          │
 *          ▼
 *     HTTP SERVER START
 *          │
 *          ▼
 *     SHUTDOWN REGISTRATION
 *          │
 *          ▼
 *        READY ✅
 *
 * =============================================================================
 *
 * 📊 SHUTDOWN FLOW (CRITICAL ORDER)
 *
 *   1. Stop HTTP intake (server.close)
 *   2. Stop workers
 *   3. Close Redis
 *   4. Close Mongo
 *
 * =============================================================================
 *
 * 🔐 SYSTEM GUARANTEES
 *
 *   ✅ No invalid startup state
 *   ✅ No partial execution
 *   ✅ No resource leakage
 *   ✅ Deterministic lifecycle transitions
 *
 * =============================================================================
 */

require("dotenv").config();

const http = require("http");

/* =============================================================================
 * CONFIG VALIDATION (CRITICAL — MUST EXECUTE FIRST)
 * =============================================================================
 */

const {
  validateConfig
} = require("./src/config/config.validator");

/**
 * 🚨 HARD GUARANTEE:
 * System MUST NOT start with invalid configuration
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

const redis =
  require("./src/infrastructure/redis/redis.client");

const mongo =
  require("./src/infrastructure/mongo/mongo.connection");

/* =============================================================================
 * WORKER
 * =============================================================================
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

/**
 * Indicates if system is shutting down (readiness control)
 */
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
     * STEP 1 — CONNECT INFRASTRUCTURE
     * -------------------------------------------------------------------------
     */

    logger.info("Connecting infrastructure");

    await redis.connect();
    await mongo.connect();

    logger.info("Infrastructure: READY");

    /**
     * -------------------------------------------------------------------------
     * STEP 2 — CREATE APPLICATION
     * -------------------------------------------------------------------------
     */

    const app = createApp();

    /**
     * Readiness guard during shutdown
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
     * STEP 3 — START SERVER (SAFE)
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
     * 1️⃣ STOP HTTP INTAKE
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
     * 2️⃣ STOP WORKERS
     */
    registerResource("worker", evidenceWorker.close);

    /**
     * 3️⃣ CLOSE REDIS
     */
    registerResource("redis", redis.close);

    /**
     * 4️⃣ CLOSE MONGO
     */
    registerResource("mongo", mongo.close);

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

  } catch (err) {

    /**
     * -------------------------------------------------------------------------
     * FAIL-FAST TERMINATION
     * -------------------------------------------------------------------------
     */

    logger.error("Bootstrap failed", err);

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
 * END OF FILE
 * =============================================================================
 */
