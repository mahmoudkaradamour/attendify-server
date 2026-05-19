/**
 * =============================================================================
 * Attendify — Evidence Worker (Asynchronous Processing Engine)
 * =============================================================================
 *
 * PURPOSE
 *
 * This module implements a **resilient, context-isolated background worker**
 * responsible for consuming and processing jobs from the queue.
 *
 * =============================================================================
 *
 * 🧠 FORMAL MODEL (ASYNC PROCESSING)
 *
 * Let:
 *
 *   Q = queue
 *   J = job
 *   W = worker
 *
 * Then:
 *
 *   W: Q → execute(J) → outcome
 *
 * Where:
 *
 *   outcome ∈ { success, failure, retry }
 *
 * =============================================================================
 *
 * 📊 EXECUTION FLOW
 *
 *           Job arrives (J)
 *                 │
 *                 ▼
 *        Context Initialization (ALS)
 *                 │
 *                 ▼
 *           Trace Span Created
 *                 │
 *                 ▼
 *         Business Logic Execution
 *                 │
 *         ┌───────┴─────────┐
 *         ▼                 ▼
 *     SUCCESS            FAILURE
 *         │                 │
 *         ▼                 ▼
 *    Complete         Retry / Fail
 *
 * =============================================================================
 *
 * 🔐 CORE GUARANTEES
 *
 *   ✅ Context isolation per job
 *   ✅ Trace correlation across async boundaries
 *   ✅ Deterministic execution
 *   ✅ Observability visibility
 *
 * =============================================================================
 */

const evidenceQueue =
  require("../jobs/evidence.queue");

const attendanceService =
  require("../services/attendance.service");

const logger =
  require("../infrastructure/logging/logger");

const {
  trace
} = require("../infrastructure/tracing/tracer");

const {
  runWithContext
} = require("../observability/request-context");

/* =============================================================================
 * UTIL — SAFE CONTEXT CREATION
 * =============================================================================
 */

function createWorkerContext(job) {

  const data = job.data || {};

  return {
    requestId: data.requestId || `job-${job.id}`,
    traceId: data.traceId || null,
    userId: null, // CRITICAL: prevent context bleed
    metadata: {
      source: "worker",
      jobId: job.id
    }
  };
}

/* =============================================================================
 * JOB HANDLER
 * =============================================================================
 */

async function processJob(job) {

  const context = createWorkerContext(job);

  /**
   * Bind execution to isolated context
   */
  return runWithContext(context, async () => {

    return trace("worker.evidence.process", async (span) => {

      logger.info("Worker job started", {
        jobId: job.id
      });

      try {

        /**
         * Execute business logic
         */
        await attendanceService.processEvidence(job.data);

        logger.info("Worker job completed", {
          jobId: job.id
        });

      } catch (err) {

        /**
         * Attach error metadata to span
         */
        if (span) {
          span.metadata.error = err.message;
        }

        logger.error(
          "Worker job failed during execution",
          err,
          {
            jobId: job.id
          }
        );

        throw err; // propagate to queue retry mechanism
      }
    });
  });
}

/* =============================================================================
 * WORKER INITIALIZATION
 * =============================================================================
 */

const worker = evidenceQueue.createWorker(processJob);

/* =============================================================================
 * EVENT HANDLERS
 * =============================================================================
 *
 * These handlers observe queue-level events (outside execution context)
 */

worker.on("failed", (job, err) => {

  logger.error(
    "Worker job failed (queue event)",
    err,
    {
      jobId: job.id
    }
  );
});

worker.on("completed", (job) => {

  logger.info(
    "Worker job completed (queue event)",
    {
      jobId: job.id
    }
  );
});

/* =============================================================================
 * GRACEFUL SHUTDOWN SUPPORT
 * =============================================================================
 */

async function close() {

  logger.warn("Worker shutting down");

  await worker.close();

  logger.warn("Worker stopped");
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  worker,
  close
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */
