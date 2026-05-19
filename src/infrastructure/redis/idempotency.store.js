/**
 * =============================================================================
 * Attendify — Idempotency Store (Redis-Based Deduplication Layer)
 * =============================================================================
 *
 * FILE:
 *   src/infrastructure/redis/idempotency.store.js
 *
 * =============================================================================
 * 🎯 PURPOSE (FORMAL — DISTRIBUTED SYSTEMS)
 * =============================================================================
 *
 * This module implements a **distributed idempotency storage mechanism**
 * using Redis as a centralized consistency layer.
 *
 * It is responsible for:
 *
 *   ✅ Enforcing uniqueness of request processing
 *   ✅ Providing atomic deduplication via SETNX
 *   ✅ Managing expiration (TTL) for temporal validity
 *
 * -----------------------------------------------------------------------------
 * 🧠 CONCEPTUAL MODEL
 * -----------------------------------------------------------------------------
 *
 * Let:
 *
 *   K = idempotency key
 *   S = Redis store
 *
 * Then:
 *
 *   f(K):
 *
 *     if SETNX(K) succeeds → ACCEPT
 *     if SETNX(K) fails    → DUPLICATE
 *
 * -----------------------------------------------------------------------------
 * 📊 FLOW DIAGRAM (ATOMIC DEDUPLICATION)
 * -----------------------------------------------------------------------------
 *
 *          Incoming Key (K)
 *                 │
 *                 ▼
 *     ┌────────────────────────────┐
 *     │ Redis SET K value NX EX TTL│
 *     └──────────────┬─────────────┘
 *                    ▼
 *           ┌────────┴────────┐
 *           ▼                 ▼
 *       SUCCESS           KEY EXISTS
 *           │                 │
 *           ▼                 ▼
 *       ACCEPT           REJECT/DUPLICATE
 *
 * -----------------------------------------------------------------------------
 * 🔐 DISTRIBUTED SYSTEM GUARANTEE
 * -----------------------------------------------------------------------------
 *
 * Redis ensures:
 *
 *   - Atomic SET operation (SETNX)
 *   - Cross-instance consistency
 *   - No race condition under concurrency
 *
 * -----------------------------------------------------------------------------
 * 🧱 DESIGN PRINCIPLES
 * -----------------------------------------------------------------------------
 *
 *   - Stateless API layer (state moves to Redis)
 *   - Atomic operations only
 *   - Time-bounded memory usage (TTL)
 *   - Deterministic key semantics
 *
 * =============================================================================
 */

/**
 * Redis client abstraction
 *
 * Must support:
 *   set(key, value, "NX", "EX", ttl)
 */
const redisClient =
  require("./redis.client");

/* =============================================================================
 * CONFIGURATION
 * =============================================================================
 */

/**
 * Default TTL for idempotency keys (seconds)
 *
 * Defines replay protection window.
 */
const DEFAULT_TTL = 60 * 5; // 5 minutes

/**
 * Key namespace prefix
 *
 * Prevents collisions with other Redis usages.
 */
const KEY_PREFIX = "idemp:";

/* =============================================================================
 * HELPER — NORMALIZE KEY
 * =============================================================================
 *
 * Ensures:
 *   - consistent key names
 *   - namespace isolation
 */

function normalizeKey(key) {

  if (!key || typeof key !== "string") {
    throw new Error("Invalid idempotency key");
  }

  return KEY_PREFIX + key;
}

/* =============================================================================
 * CORE FUNCTION — SETNX WITH TTL
 * =============================================================================
 *
 * Attempts to store the idempotency key atomically.
 *
 * -----------------------------------------------------------------------------
 * INPUT:
 *
 *   key: string
 *   ttl: number (optional)
 *
 * -----------------------------------------------------------------------------
 * OUTPUT:
 *
 *   {
 *     created: boolean,
 *     key: string
 *   }
 *
 * -----------------------------------------------------------------------------
 * SEMANTICS:
 *
 *   created = true  → first time (accepted)
 *   created = false → duplicate (already exists)
 *
 * -----------------------------------------------------------------------------
 * LOW-LEVEL REDIS COMMAND:
 *
 *   SET key value NX EX ttl
 *
 * -----------------------------------------------------------------------------
 */

async function setIfNotExists(key, ttl = DEFAULT_TTL) {

  const normalizedKey = normalizeKey(key);

  /**
   * Value is irrelevant (deduplication marker only)
   */
  const value = "1";

  /**
   * Redis Command:
   *   SET key value NX EX ttl
   */
  const result = await redisClient.set(
    normalizedKey,
    value,
    "NX",
    "EX",
    ttl
  );

  return {
    created: result === "OK",
    key: normalizedKey
  };
}

/* =============================================================================
 * OPTIONAL — CHECK EXISTENCE (READ-ONLY)
 * =============================================================================
 */

async function exists(key) {

  const normalizedKey = normalizeKey(key);

  const result = await redisClient.exists(normalizedKey);

  return result === 1;
}

/* =============================================================================
 * OPTIONAL — DELETE KEY (MANUAL CLEANUP)
 * =============================================================================
 *
 * Rarely used in production, but useful for testing/debugging.
 */

async function remove(key) {

  const normalizedKey = normalizeKey(key);

  await redisClient.del(normalizedKey);
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  setIfNotExists,
  exists,
  remove
};

/**
 * =============================================================================
 * 🏁 END OF FILE
 * =============================================================================
 *
 * =============================================================================
 * 🧠 ACADEMIC INSIGHTS
 * =============================================================================
 *
 * This module implements:
 *
 *   → Distributed Idempotency Store Pattern
 *   → Atomic Deduplication Mechanism
 *   → Temporal Consistency Window
 *
 * -----------------------------------------------------------------------------
 * FORMAL GUARANTEE
 * -----------------------------------------------------------------------------
 *
 * ∀ identical keys K:
 *
 *   first invocation → created = true
 *   subsequent invocations → created = false
 *
 * -----------------------------------------------------------------------------
 * SYSTEM PROPERTIES
 * -----------------------------------------------------------------------------
 *
 *   ✅ At-most-once request admission (approximation)
 *   ✅ Linearizable behavior (via Redis atomicity)
 *   ✅ Bounded memory footprint (TTL)
 *
 * -----------------------------------------------------------------------------
 * FAILURE SCENARIOS
 * -----------------------------------------------------------------------------
 *
 * Redis unavailable:
 *
 *   → system must fail-safe
 *   → recommendation: reject request
 *
 * -----------------------------------------------------------------------------
 * SECURITY CONTRIBUTION
 * -----------------------------------------------------------------------------
 *
 * Protects against:
 *
 *   ✅ replay attacks
 *   ✅ duplicate processing
 *   ✅ retry amplification issues
 *
 * -----------------------------------------------------------------------------
 * CRITICAL USAGE NOTE
 * -----------------------------------------------------------------------------
 *
 * Must be invoked BEFORE:
 *
 *   - queue enqueue
 *   - execution layer
 *
 * OTHERWISE:
 *
 *   ❗ duplicate jobs can enter system
 *
 * =============================================================================
 */