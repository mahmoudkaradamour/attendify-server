/**
 * =============================================================================
 * Attendify — Idempotency Middleware (Enterprise-Grade)
 * =============================================================================
 *
 * FILE:
 *   src/middleware/idempotency.js
 *
 * =============================================================================
 * 🎯 PURPOSE (FORMAL — ACADEMIC)
 * =============================================================================
 *
 * This middleware enforces **Idempotent Request Processing** by ensuring that
 * logically identical requests are executed only once within a bounded time window.
 *
 * -----------------------------------------------------------------------------
 * 🧠 CONCEPTUAL MODEL
 * -----------------------------------------------------------------------------
 *
 * Let:
 *
 *   R = Request
 *   K = Deterministic Idempotency Key
 *   S = Redis Store
 *
 * Then:
 *
 *   f(R):
 *
 *     if SETNX(K) succeeds → ACCEPT
 *     if SETNX(K) fails    → REJECT (duplicate)
 *
 * -----------------------------------------------------------------------------
 * 📊 FLOW DIAGRAM (IDEMPOTENCY PIPELINE)
 * -----------------------------------------------------------------------------
 *
 *        Incoming Request
 *               │
 *               ▼
 *     Extract Deterministic Inputs
 *               │
 *               ▼
 *     Generate Idempotency Key (K)
 *               │
 *               ▼
 *    ┌────────────────────────────┐
 *    │ Redis SETNX(K, value, TTL) │
 *    └──────────────┬─────────────┘
 *                   ▼
 *          ┌────────┴────────┐
 *          ▼                 ▼
 *       SUCCESS          ALREADY EXISTS
 *          │                 │
 *          ▼                 ▼
 *      ACCEPT           REJECT (409)
 *
 * -----------------------------------------------------------------------------
 * 🔐 SECURITY OBJECTIVES
 * -----------------------------------------------------------------------------
 *
 *   ✅ Prevent duplicate job submission to queue
 *   ✅ Protect against retry storms
 *   ✅ Enforce at-most-once delivery semantics (approximate)
 *
 * -----------------------------------------------------------------------------
 * 🧱 DESIGN PRINCIPLES
 * -----------------------------------------------------------------------------
 *
 *   - Deterministic identity mapping
 *   - Stateless middleware (state in Redis)
 *   - Fail-fast on duplicates
 *   - Distributed-safe (multi-instance compatible)
 *
 * =============================================================================
 */

const crypto = require("crypto");

/**
 * Redis client must support:
 *   set(key, value, "NX", "EX", ttl)
 */
const redisClient =
  require("../infrastructure/redis/redis.client");

const {
  conflictError,
  badRequestError
} = require("../shared/errors/app-error");

/* =============================================================================
 * CONFIGURATION
 * =============================================================================
 */

/**
 * Idempotency key lifetime
 *
 * Defines replay/deduplication window.
 */
const IDEMPOTENCY_TTL = 60 * 5; // 5 minutes

/**
 * Key prefix to avoid namespace collisions
 */
const KEY_PREFIX = "idemp:";

/* =============================================================================
 * HELPER — DETERMINISTIC KEY GENERATION
 * =============================================================================
 *
 * Key Strategy:
 *
 *   K = SHA256(
 *         snapshotHash + ":" +
 *         companyId     + ":" +
 *         employeeId
 *       )
 *
 * Properties:
 *
 *   ✅ Deterministic (same input → same key)
 *   ✅ Collision-resistant
 *   ✅ No time dependency
 *   ✅ Independent of request repetition
 */

function generateIdempotencyKey({
  snapshotHash,
  companyId,
  employeeId
}) {

  if (!snapshotHash || !companyId) {
    throw badRequestError(
      "Invalid fields for idempotency key generation"
    );
  }

  const base = `${snapshotHash}:${companyId}:${employeeId || "anonymous"}`;

  const hash = crypto
    .createHash("sha256")
    .update(base)
    .digest("hex");

  return KEY_PREFIX + hash;
}

/* =============================================================================
 * MAIN MIDDLEWARE
 * =============================================================================
 */

module.exports = async function idempotencyMiddleware(req, res, next) {

  try {

    /**
     * -------------------------------------------------------------------------
     * STEP 1 — EXTRACT INPUTS
     * -------------------------------------------------------------------------
     */
    const { companyId, evidence } = req.body;

    const snapshotHash =
      evidence && evidence.snapshotHash;

    const employeeId =
      req.user && req.user.id
        ? req.user.id
        : null;

    if (!snapshotHash) {
      throw badRequestError(
        "Missing snapshotHash for idempotency"
      );
    }

    /**
     * -------------------------------------------------------------------------
     * STEP 2 — GENERATE KEY
     * -------------------------------------------------------------------------
     */
    const key = generateIdempotencyKey({
      snapshotHash,
      companyId,
      employeeId
    });

    /**
     * -------------------------------------------------------------------------
     * STEP 3 — REDIS DEDUPLICATION (SETNX)
     * -------------------------------------------------------------------------
     *
     * SET key value NX EX TTL
     *
     * NX:
     *   Ensures key is set ONLY IF NOT EXISTS
     *
     * EX:
     *   Automatic expiration
     *
     * RETURN:
     *   OK     → success
     *   null   → key already exists
     */

    const result = await redisClient.set(
      key,
      "1",
      "NX",
      "EX",
      IDEMPOTENCY_TTL
    );

    if (result === null) {

      /**
       * Duplicate request detected
       */
      throw conflictError(
        "Duplicate request (idempotency violation)"
      );
    }

    /**
     * -------------------------------------------------------------------------
     * STEP 4 — ATTACH CONTEXT
     * -------------------------------------------------------------------------
     *
     * Useful for:
     *   - logging
     *   - debugging
     *   - tracing
     */
    req.idempotencyKey = key;

    /**
     * Continue request pipeline
     */
    return next();

  } catch (err) {
    return next(err);
  }
};

/* =============================================================================
 * UTILITY EXPORT (OPTIONAL USE BY OTHER LAYERS)
 * =============================================================================
 */

module.exports.generateIdempotencyKey =
  generateIdempotencyKey;

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
 *   → Idempotent Messaging Pattern
 *   → Distributed Deduplication Mechanism
 *
 * -----------------------------------------------------------------------------
 * FORMAL GUARANTEE
 * -----------------------------------------------------------------------------
 *
 * For identical request set R:
 *
 *   f(r₁) = ACCEPT
 *   f(r₂..n) = REJECT
 *
 * -----------------------------------------------------------------------------
 * DISTRIBUTED SYSTEM PROPERTY
 * -----------------------------------------------------------------------------
 *
 * Redis ensures:
 *
 *   - global consistency across instances
 *   - atomic SETNX operation
 *
 * preventing race conditions in concurrent execution.
 *
 * -----------------------------------------------------------------------------
 * SECURITY BENEFITS
 * -----------------------------------------------------------------------------
 *
 * Protects against:
 *
 *   ✅ replay attacks
 *   ✅ accidental duplicate submissions
 *   ✅ retry storm amplification
 *   ✅ queue flooding
 *
 * -----------------------------------------------------------------------------
 * CRITICAL ORDERING
 * -----------------------------------------------------------------------------
 *
 * Must be executed BEFORE:
 *
 *   - queue enqueue
 *   - downstream processing
 *
 * -----------------------------------------------------------------------------
 * FAILURE MODE
 * -----------------------------------------------------------------------------
 *
 * Redis unavailable →
 *   → system must fail safely (reject or fallback strategy)
 *
 * =============================================================================
 */