/**
 * =============================================================================
 * Attendify — Replay Protection & Idempotency Enforcement Middleware
 * =============================================================================
 *
 * FILE:
 *   src/middleware/replay-protection.js
 *
 * =============================================================================
 * 🎯 PURPOSE (FORMAL)
 * =============================================================================
 *
 * This middleware implements **Replay Attack Prevention** combined with
 * **Idempotency Enforcement**, forming a unified protection layer against:
 *
 *   ✅ Duplicate submissions
 *   ✅ Network replays
 *   ✅ Malicious re-injection of valid payloads
 *
 * -----------------------------------------------------------------------------
 * 🧠 CONCEPTUAL MODEL
 * -----------------------------------------------------------------------------
 *
 * Let:
 *
 *   R = incoming request
 *   K = idempotency key derived from R
 *
 * Then:
 *
 *   f(R):
 *
 *     if K ∉ Store → ACCEPT + STORE(K)
 *     if K ∈ Store → REJECT (REPLAY)
 *
 * -----------------------------------------------------------------------------
 * 📊 FLOW DIAGRAM (REPLAY CONTROL)
 * -----------------------------------------------------------------------------
 *
 *          Incoming Request
 *                 │
 *                 ▼
 *        Extract Deterministic Key
 *                 │
 *                 ▼
 *         ┌────────────────────┐
 *         │ Redis SETNX (K)    │
 *         └───────┬────────────┘
 *                 ▼
 *        ┌────────┴────────┐
 *        ▼                 ▼
 *     SUCCESS          ALREADY EXISTS
 *        │                 │
 *        ▼                 ▼
 *    ACCEPT           REJECT (409)
 *        │
 *        ▼
 *   Continue Pipeline
 *
 * -----------------------------------------------------------------------------
 * 🔐 SECURITY OBJECTIVES
 * -----------------------------------------------------------------------------
 *
 *   ✅ Enforce at-most-once processing
 *   ✅ Prevent replay of captured requests
 *   ✅ Guarantee deterministic deduplication
 *
 * -----------------------------------------------------------------------------
 * 🧱 DESIGN PRINCIPLES
 * -----------------------------------------------------------------------------
 *
 *   - Deterministic key derivation
 *   - Stateless middleware (Redis-backed state)
 *   - Fail-fast duplicate rejection
 *   - Uniform behavior across distributed nodes
 *
 * =============================================================================
 */

const crypto = require("crypto");

/**
 * Redis client must support:
 *
 *   SET key value NX EX ttl
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
 * TTL for idempotency keys (seconds)
 *
 * Balances:
 *   - replay protection window
 *   - memory footprint
 */
const IDEMPOTENCY_TTL = 60 * 5; // 5 minutes

/* =============================================================================
 * HELPER — KEY GENERATION
 * =============================================================================
 *
 * Deterministic key design:
 *
 *   K = SHA256(snapshotHash + companyId + employeeId)
 *
 * Properties:
 *
 *   - Same logical request → same key
 *   - Different request → different key
 *   - No time randomness
 */

function generateKey({ snapshotHash, companyId, employeeId }) {

  if (!snapshotHash || !companyId) {
    throw badRequestError("Invalid idempotency inputs");
  }

  const base = `${snapshotHash}:${companyId}:${employeeId || "anon"}`;

  return crypto
    .createHash("sha256")
    .update(base)
    .digest("hex");
}

/* =============================================================================
 * MAIN MIDDLEWARE
 * =============================================================================
 */

module.exports = async function replayProtection(req, res, next) {

  try {

    /**
     * -------------------------------------------------------------------------
     * STEP 1 — EXTRACT INPUT DATA
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
      throw badRequestError("Missing snapshotHash for replay protection");
    }

    /**
     * -------------------------------------------------------------------------
     * STEP 2 — GENERATE IDEMPOTENCY KEY
     * -------------------------------------------------------------------------
     */
    const key = generateKey({
      snapshotHash,
      companyId,
      employeeId
    });

    /**
     * -------------------------------------------------------------------------
     * STEP 3 — REDIS SETNX OPERATION
     * -------------------------------------------------------------------------
     *
     * SET key value NX EX ttl
     *
     * NX:
     *   Only set if key does NOT exist
     *
     * EX:
     *   Expiration time (automatic cleanup)
     *
     * RESULT:
     *   OK       → key inserted (first-time request)
     *   null     → key already exists (duplicate)
     */

    const result = await redisClient.set(
      key,
      "1",
      "NX",
      "EX",
      IDEMPOTENCY_TTL
    );

    /**
     * -------------------------------------------------------------------------
     * STEP 4 — REPLAY DETECTION
     * -------------------------------------------------------------------------
     */
    if (result === null) {

      /**
       * Existing key → replay or duplicate submission
       */
      throw conflictError("Duplicate or replayed request detected");
    }

    /**
     * -------------------------------------------------------------------------
     * STEP 5 — ATTACH CONTEXT
     * -------------------------------------------------------------------------
     */
    req.idempotencyKey = key;

    /**
     * Continue execution
     */
    return next();

  } catch (error) {
    return next(error);
  }
};

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
 *   → At-Most-Once Delivery Guarantee (approximation)
 *   → Replay Attack Mitigation
 *   → Distributed Idempotency Pattern
 *
 * -----------------------------------------------------------------------------
 * FORMAL CHARACTERIZATION
 * -----------------------------------------------------------------------------
 *
 * For any set of identical requests R:
 *
 *   ∀ r ∈ R:
 *
 *     f(r₁) = ACCEPT
 *     f(r₂..n) = REJECT
 *
 * -----------------------------------------------------------------------------
 * SECURITY IMPACT
 * -----------------------------------------------------------------------------
 *
 * Prevents:
 *
 *   ✅ network replay attacks
 *   ✅ duplicate submissions
 *   ✅ retry amplification abuse
 *
 * -----------------------------------------------------------------------------
 * DISTRIBUTED SYSTEM PROPERTY
 * -----------------------------------------------------------------------------
 *
 * Since Redis is shared:
 *
 *   → Multiple API instances remain consistent
 *   → No race condition in duplicate detection
 *
 * -----------------------------------------------------------------------------
 * CRITICAL REQUIREMENT
 * -----------------------------------------------------------------------------
 *
 * This middleware must run BEFORE:
 *
 *   - queue enqueue
 *   - downstream processing
 *
 * OTHERWISE:
 *
 *   ❗ duplicates can enter system
 *
 * =============================================================================
 */