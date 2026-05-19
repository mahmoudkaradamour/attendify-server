/**
 * Attendify — Evidence Queue Definition (Enterprise-Grade) * =============================================================================
 * =============================================================================
 *
 * FILE:
 *   src/jobs/evidence.queue.js
 *
 * =============================================================================
 * 🎯 PURPOSE (FORMAL)
 * =============================================================================
 *
 * This module defines the **Queue Abstraction Layer** responsible for managing
 * asynchronous job scheduling for evidence delivery.
 *
 * -----------------------------------------------------------------------------
 * 🧠 CONCEPTUAL MODEL
 * -----------------------------------------------------------------------------
 *
 * Let:
 *
 *   R = incoming request
 *   J = job representation of R
 *   Q = queue system
 *
 * Then:
 *
 *   f(R) → enqueue(J) → Q
 *
 * where J is executed asynchronously by worker processes.
 *
 * -----------------------------------------------------------------------------
 * 📊 SYSTEM FLOW (QUEUE FLOW)
 * -----------------------------------------------------------------------------
 *
 *     API REQUEST
 *         │
 *         ▼
 *   ┌─────────────────┐
 *   │ enqueueEvidence │
 *   └─────────┬───────┘
 *             ▼
 *       ┌───────────┐
 *       │   QUEUE   │
 *       └─────┬─────┘
 *             ▼
 *        WORKER PROCESS
 *             ▼
 *     Company Integration
 *
 * -----------------------------------------------------------------------------
 * 🚀 BENEFITS OF QUEUE MODEL
 * -----------------------------------------------------------------------------
 *
 *   ✅ Non-blocking API responses (low latency)
 *   ✅ Improved fault tolerance
 *   ✅ Scalability via parallel workers
 *   ✅ Controlled retry and failure isolation
 *
 * -----------------------------------------------------------------------------
 * 🧱 DESIGN PRINCIPLES
 * -----------------------------------------------------------------------------
 *
 *   - Decoupled execution
 *   - Retry-driven resilience
 *   - Deterministic job processing
 *   - Backpressure control
 *
 * =============================================================================
 */

const { Queue } = require("bullmq");

/**
 * Redis connection (shared infrastructure)
 */
const redisConnection =
  require("../infrastructure/redis/redis.client");

/* =============================================================================
 * QUEUE CONFIGURATION
 * =============================================================================
 */

/**
 * Queue name (global identifier)
 */
const QUEUE_NAME = "evidence-delivery";

/**
 * Default retry attempts
 */
const DEFAULT_ATTEMPTS = 5;

/**
 * Base delay for exponential backoff (ms)
 */
const BASE_DELAY = 500;

/**
 * Remove completed jobs automatically
 * Prevents memory bloat
 */
const REMOVE_ON_COMPLETE = true;

/**
 * Retain failed jobs for debugging
 */
const REMOVE_ON_FAIL = false;

/* =============================================================================
 * QUEUE INITIALIZATION
 * =============================================================================
 *
 * BullMQ Queue Instance
 */

const evidenceQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection
});

/* =============================================================================
 * JOB CREATION FUNCTION
 * =============================================================================
 *
 * Wraps BullMQ add() with standardized configuration.
 *
 * -----------------------------------------------------------------------------
 * INPUT:
 *
 *   payload:
 *     {
 *       companyId,
 *       evidence,
 *       metadata,
 *       employeeToken,
 *       employeeId,
 *       requestId,
 *       timestamp,
 *       version
 *     }
 *
 * -----------------------------------------------------------------------------
 * OUTPUT:
 *
 *   Promise → job created
 *
 * -----------------------------------------------------------------------------
 * RETRY STRATEGY
 * -----------------------------------------------------------------------------
 *
 * Exponential backoff:
 *
 *   delay = base * 2^attempt
 *
 * Controlled retries:
 *
 *   prevents system overload
 *   prevents infinite retry loops
 *
 * -----------------------------------------------------------------------------
 */

async function addEvidenceJob(payload) {

  /**
   * Validate minimal payload integrity (defensive layer)
   */
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid job payload");
  }

  /**
   * Add job to queue
   */
  return await evidenceQueue.add(
    "process-evidence",
    payload,
    {
      attempts: DEFAULT_ATTEMPTS,

      /**
       * Backoff strategy
       */
      backoff: {
        type: "exponential",
        delay: BASE_DELAY
      },

      /**
       * Cleanup behavior
       */
      removeOnComplete: REMOVE_ON_COMPLETE,
      removeOnFail: REMOVE_ON_FAIL,

      /**
       * Job-level identity
       *
       * If idempotency key exists:
       *   → use it as jobId to prevent duplicates in queue
       */
      jobId:
        payload.idempotencyKey ||
        payload.requestId ||
        undefined
    }
  );
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = evidenceQueue;
module.exports.addEvidenceJob = addEvidenceJob;

/**
 * =============================================================================
 * 🏁 END OF FILE
 * =============================================================================
 *
 * =============================================================================
 * 🧠 ACADEMIC INSIGHT
 * =============================================================================
 *
 * This module implements:
 *
 *   → Message Queue Pattern
 *   → Deferred Execution Model
 *   → Retry-Oriented Fault Recovery
 *
 * -----------------------------------------------------------------------------
 * FORMAL GUARANTEE
 * -----------------------------------------------------------------------------
 *
 * Given a job J:
 *
 *   execution(J) ∈ {0, 1, ... retryLimit}
 *
 * bounded retries ensure:
 *
 *   - system stability
 *   - predictable recovery behavior
 *
 * -----------------------------------------------------------------------------
 * SYSTEM PROPERTIES
 * -----------------------------------------------------------------------------
 *
 *   ✅ At-least-once processing
 *   ✅ Controlled retry behavior
 *   ✅ Load leveling (backpressure handling)
 *
 * -----------------------------------------------------------------------------
 * CRITICAL INTEGRATION REQUIREMENT
 * -----------------------------------------------------------------------------
 *
 * Must be paired with:
 *
 *   → Worker system (Consumer)
 *
 * without worker:
 *
 *   ❗ jobs are never processed
 *
 * -----------------------------------------------------------------------------
 * DISTRIBUTED SYSTEM NOTE
 * -----------------------------------------------------------------------------
 *
 * Multiple workers can consume from the same queue:
 *
 *   → horizontal scalability
 *   → parallel execution
 *
 * =============================================================================
 */
