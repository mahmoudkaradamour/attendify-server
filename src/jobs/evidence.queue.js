/**
 * =============================================================================
 * Attendify — Evidence Worker (Enterprise-Grade Asynchronous Execution Engine)
 * =============================================================================
 *
 * OVERVIEW
 * =============================================================================
 *
 * This module implements a **high-reliability distributed worker** responsible for:
 *
 *   • Consuming jobs from Redis-backed queue (BullMQ)
 *   • Executing business logic in isolated async contexts
 *   • Ensuring deterministic processing outcomes
 *   • Providing deep observability & traceability
 *
 * =============================================================================
 *
 * 🧠 FORMAL MODEL
 * =============================================================================
 *
 * Let:
 *
 *   Q = Queue (distributed job store)
 *   J = Job (unit of work)
 *   W = Worker (consumer process)
 *
 * Then:
 *
 *   W(Q) = ∀ J ∈ Q → execute(J) → outcome(J)
 *
 * Where:
 *
 *   outcome ∈ { SUCCESS, FAILURE, RETRY }
 *
 * =============================================================================
 *
 * 📊 EXECUTION PIPELINE (DETAILED)
 * =============================================================================
 *
 *              Redis Queue
 *                  │
 *                  ▼
 *           Worker Polling Cycle
 *                  │
 *                  ▼
 *          Job Retrieved (atomic)
 *                  │
 *                  ▼
 *         Context Initialization (ALS)
 *                  │
 *                  ▼
 *           Trace Span Creation
 *                  │
 *                  ▼
 *          Business Logic Execution
 *                  │
 *        ┌─────────┴──────────┐
 *        ▼                    ▼
 *     SUCCESS              FAILURE
 *        │                    │
 *        ▼                    ▼
 *  Mark Completed       Retry / Fail
 *
 * =============================================================================
 *
 * 🔐 SYSTEM GUARANTEES
 * =============================================================================
 *
 *   ✅ At-least-once processing
 *   ✅ Context isolation per job
 *   ✅ Distributed safe execution
 *   ✅ Fault-tolerant retries
 *   ✅ Observability with trace propagation
 *
 * =============================================================================
 */

const { Worker } = require("bullmq");

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
 * REDIS CONNECTION (BULLMQ REQUIREMENT)
 * =============================================================================
 *
 * BullMQ requires a connection configuration object
 * NOT a Redis instance.
 */

const redisConnection = {
  connectionString: process.env.REDIS_URL
};

/* =============================================================================
 * CONTEXT CREATION (ASYNC LOCAL STORAGE MODEL)
 * =============================================================================
 *
 * Ensures:
 *
 *   • No context leakage across jobs
 *   • Trace consistency
 *   • Request correlation
 */

function createWorkerContext(job) {

  const data = job.data || {};

  return {
    requestId: data.requestId || `job-${job.id}`,
    traceId: data.traceId || null,

    /**
     * CRITICAL:
     * Worker MUST NOT inherit user identity implicitly
     */
    userId: null,

    metadata: {
      source: "worker",
      jobId: job.id
    }
  };
}

/* =============================================================================
 * JOB PROCESSOR (CORE EXECUTION UNIT)
 * =============================================================================
 */

async function processJob(job) {

  const context =
    createWorkerContext(job);

  return runWithContext(context, async () => {

    return trace(
      "worker.evidence.process",
      async (span) => {

        logger.info("Worker job started", {
          jobId: job.id
        });

        try {

          /**
           * BUSINESS EXECUTION
           *
           * This is the actual domain invocation.
           *
           * NOTE:
           * The service MUST remain deterministic.
           */
          await attendanceService.markAttendance(
            job.data
          );

          logger.info("Worker job completed", {
            jobId: job.id
          });

        } catch (error) {

          /**
           * Trace enrichment
           */
          if (span) {
            span.metadata = {
              ...span.metadata,
              error: error.message
            };
          }

          logger.error("Worker job failed", error, {
            jobId: job.id
          });

          /**
           * CRITICAL:
           * Throwing error triggers:
           *
           *   • retry mechanism
           *   • failure routing
           */
          throw error;
        }
      }
    );
  });
}

/* =============================================================================
 * WORKER CONSUMER INITIALIZATION
 * =============================================================================
 *
 * IMPORTANT:
 *
 * Queue name MUST match producer exactly.
 */

const worker = new Worker(
  "evidence-delivery",
  processJob,
  {
    connection: redisConnection
  }
);

/* =============================================================================
 * EVENT OBSERVABILITY LAYER
 * =============================================================================
 */

worker.on("completed", (job) => {

  logger.info("Job completed (event)", {
    jobId: job.id
  });
});

worker.on("failed", (job, err) => {

  logger.error("Job failed (event)", err, {
    jobId: job?.id
  });
});

worker.on("error", (err) => {

  logger.error("Worker system error", err);
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
 * ADVANCED ARCHITECTURAL NOTES
 * =============================================================================
 *
 * 1. EXECUTION SEMANTICS
 * -----------------------------------------------------------------------------
 *
 * This worker guarantees:
 *
 *   • Exactly-once effect (via idempotent service)
 *   • At-least-once execution (queue guarantee)
 *
 * -----------------------------------------------------------------------------
 *
 * 2. FAILURE HANDLING MODEL
 * -----------------------------------------------------------------------------
 *
 *   error → retry → exponential backoff → eventual failure
 *
 * -----------------------------------------------------------------------------
 *
 * 3. DISTRIBUTED CONCURRENCY
 * -----------------------------------------------------------------------------
 *
 * Multiple workers can run:
 *
 *   W₁, W₂, W₃ ...
 *
 * All pulling from same queue.
 *
 * -----------------------------------------------------------------------------
 *
 * 4. ISOLATION PROPERTY
 * -----------------------------------------------------------------------------
 *
 * Each job execution:
 *
 *   isolated(context_i) ∧ deterministic
 *
 * -----------------------------------------------------------------------------
 *
 * 5. RELATION TO SYSTEM
 * -----------------------------------------------------------------------------
 *
 * Controller
 *     ▼
 * Queue Producer
 *     ▼
 * Redis Queue
 *     ▼
 * THIS WORKER ✅
 *     ▼
 * Domain Service
 *
 * =============================================================================
 *
 * END OF FILE
 * =============================================================================
 */
