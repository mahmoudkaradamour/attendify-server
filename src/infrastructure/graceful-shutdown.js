/**
 * =============================================================================
 * Attendify — Graceful Shutdown Manager (Deterministic Lifecycle Orchestrator)
 * =============================================================================
 *
 * PURPOSE
 *
 * This module coordinates a **safe, deterministic shutdown sequence**
 * for all system resources.
 *
 * =============================================================================
 *
 * 🧠 FORMAL MODEL (ORDERED RESOURCE TERMINATION)
 *
 * Let:
 *
 *   R = { r₁, r₂, ..., rₙ }  (ordered resources)
 *
 * Then:
 *
 *   shutdown(R):
 *
 *     for i = 1 → n:
 *        close(rᵢ) safely
 *
 * =============================================================================
 *
 * 📊 SHUTDOWN FLOW (STRICT ORDER)
 *
 *      SIGNAL (SIGINT / SIGTERM)
 *              │
 *              ▼
 *      Prevent re-entry
 *              │
 *              ▼
 *      Execute resources in order:
 *
 *          [1] HTTP Server  (stop intake)
 *          [2] Worker       (stop processing)
 *          [3] Redis        (release infra)
 *          [4] Mongo        (final persistence layer)
 *
 *              │
 *              ▼
 *         Process Exit
 *
 * =============================================================================
 *
 * 🔐 CRITICAL GUARANTEES
 *
 *   ✅ Idempotent execution
 *   ✅ Bounded shutdown time
 *   ✅ Resource-level isolation
 *   ✅ Deterministic order
 *
 * =============================================================================
 */

const logger = require("./logging/logger");

/* =============================================================================
 * INTERNAL STATE
 * =============================================================================
 */

let isShuttingDown = false;

const resources = [];

/* =============================================================================
 * CONFIGURATION
 * =============================================================================
 */

const SHUTDOWN_TIMEOUT = 10000;
const RESOURCE_TIMEOUT = 5000;

/* =============================================================================
 * REGISTER RESOURCE
 * =============================================================================
 */

function registerResource(name, closeFn) {

  if (typeof closeFn !== "function") {
    throw new Error("Invalid close function");
  }

  resources.push({
    name,
    close: closeFn
  });
}

/* =============================================================================
 * SAFE RESOURCE CLOSE (WITH TIMEOUT)
 * =============================================================================
 */

async function closeWithTimeout(resource) {

  return Promise.race([

    (async () => {
      await resource.close();
      return "completed";
    })(),

    new Promise((_, reject) =>
      setTimeout(() =>
        reject(new Error("Resource close timeout")),
        RESOURCE_TIMEOUT
      )
    )

  ]);
}

/* =============================================================================
 * SHUTDOWN EXECUTION
 * =============================================================================
 */

async function shutdown(signal) {

  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  logger.warn("Shutdown initiated", { signal });

  /**
   * Global safeguard timeout
   */
  const globalTimeout = setTimeout(() => {
    logger.error("Global shutdown timeout reached");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  try {

    /**
     * Execute resources sequentially (ORDER MATTERS)
     */
    for (const resource of resources) {

      const start = Date.now();

      try {

        logger.info("Closing resource", {
          name: resource.name
        });

        await closeWithTimeout(resource);

        const duration = Date.now() - start;

        logger.info("Resource closed", {
          name: resource.name,
          duration
        });

      } catch (err) {

        logger.error(
          "Resource close failed",
          err,
          { name: resource.name }
        );
      }
    }

    clearTimeout(globalTimeout);

    logger.warn("Shutdown completed successfully");

    /**
     * Allow logs to flush
     */
    setTimeout(() => {
      process.exit(0);
    }, 50);

  } catch (err) {

    logger.error("Unexpected shutdown failure", err);

    process.exit(1);
  }
}

/* =============================================================================
 * SIGNAL HANDLERS
 * =============================================================================
 */

function registerShutdownHandlers() {

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception", err);
    shutdown("uncaughtException");
  });

  process.on("unhandledRejection", (err) => {
    logger.error("Unhandled rejection", err);
    shutdown("unhandledRejection");
  });
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  registerResource,
  registerShutdownHandlers
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */
