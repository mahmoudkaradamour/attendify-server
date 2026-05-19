/**
 * =============================================================================
 * Attendify — Nonce Replay Protection Store (Enterprise Security Module)
 * =============================================================================
 *
 * OVERVIEW
 * =============================================================================
 *
 * This module implements a **distributed replay attack prevention mechanism**
 * using Redis as a **strong consistency guard for nonce uniqueness**.
 *
 * In distributed systems, replay attacks are a critical threat when dealing with
 * signed requests (e.g., HMAC-signed attendance submissions). Even if a request
 * is cryptographically valid, it MAY NOT be unique.
 *
 * This module enforces **temporal uniqueness constraints** via nonce tracking.
 *
 * =============================================================================
 *
 * 🧠 FORMAL SECURITY MODEL
 * =============================================================================
 *
 * Let:
 *
 *   N = nonce value
 *   T = validity window (TTL)
 *   S = set of previously observed nonces within T
 *
 * Then:
 *
 *   VALID(N)   ⇔ N ∉ S
 *   INVALID(N) ⇔ N ∈ S
 *
 * This implies:
 *
 *   ∀ request R:
 *     accept(R) only if nonce is unseen within its validity window
 *
 * =============================================================================
 *
 * 📊 DISTRIBUTED REPLAY PROTECTION FLOW
 * =============================================================================
 *
 *                  Incoming Signed Request
 *                           │
 *                           ▼
 *                     Extract Nonce
 *                           │
 *                           ▼
 *             Generate Redis Key → nonce:<value>
 *                           │
 *                           ▼
 *                Attempt Atomic Insert (SET NX)
 *                           │
 *           ┌───────────────┴───────────────┐
 *           ▼                               ▼
 *     Key does NOT exist               Key exists already
 *           │                               │
 *           ▼                               ▼
 *     Store nonce (TTL)              Replay Attack Detected
 *           │                               │
 *           ▼                               ▼
 *        Continue                   Reject Request (Security Error)
 *
 * =============================================================================
 *
 * 🔐 SECURITY GUARANTEES
 * =============================================================================
 *
 * This module guarantees:
 *
 *   ✅ Strong replay protection across distributed instances
 *   ✅ Atomicity via Redis SET NX operation
 *   ✅ Time-bounded memory using TTL
 *   ✅ Horizontal scalability (multi-node safe)
 *
 * =============================================================================
 *
 * ⚙️ UNDERLYING MECHANISM
 * =============================================================================
 *
 * Redis command used:
 *
 *   SET key value NX EX ttlSeconds
 *
 * Where:
 *
 *   NX → Only set if key does NOT already exist
 *   EX → Expiration in seconds
 *
 * This operation is:
 *
 *   ✔ Atomic
 *   ✔ O(1) time complexity
 *   ✔ Lock-free
 *
 * =============================================================================
 *
 * ⚠️ CRITICAL SECURITY CONSIDERATIONS
 * =============================================================================
 *
 * 1. Nonce MUST be:
 * ---------------------------------------------------------------------------
 *   • Cryptographically unpredictable
 *   • Unique per request
 *   • Time-bound (short TTL)
 *
 * 2. TTL MUST be aligned with:
 * ---------------------------------------------------------------------------
 *   • Signature validity window
 *   • Device clock drift tolerance
 *
 * 3. Redis MUST be:
 * ---------------------------------------------------------------------------
 *   • Highly available (production cluster)
 *   • Low latency
 *
 * =============================================================================
 */

const redis =
  require("../../infrastructure/cache/redis.client");

/**
 * =============================================================================
 * INTERNAL VALIDATION UTILITIES
 * =============================================================================
 */

/**
 * Validates nonce integrity and format.
 *
 * @param {any} nonce
 */
function validateNonce(nonce) {

  if (
    typeof nonce !== "string" ||
    nonce.trim().length === 0
  ) {
    throw new Error("Nonce must be a non-empty string");
  }

  /**
   * Optional hardening (length constraint)
   */
  if (nonce.length > 256) {
    throw new Error("Nonce exceeds maximum allowed length");
  }
}

/**
 * Validates TTL value.
 *
 * @param {any} ttlSeconds
 */
function validateTTL(ttlSeconds) {

  if (
    typeof ttlSeconds !== "number" ||
    !Number.isInteger(ttlSeconds) ||
    ttlSeconds <= 0
  ) {
    throw new Error("TTL must be a positive integer in seconds");
  }

  /**
   * Upper bound protection (avoid memory abuse)
   */
  if (ttlSeconds > 3600 * 24) {
    throw new Error("TTL exceeds maximum allowed limit (24h)");
  }
}

/* =============================================================================
 * CORE FUNCTION
 * =============================================================================
 */

/**
 * ensureNonceUnique()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * ---------------------------------------------------------------------------
 *
 * Enforces nonce uniqueness across the distributed system.
 *
 * ---------------------------------------------------------------------------
 * EXECUTION MODEL:
 * ---------------------------------------------------------------------------
 *
 * 1. Validate inputs
 * 2. Generate Redis key
 * 3. Attempt atomic insert (SET NX EX)
 * 4. Detect replay via null response
 *
 * ---------------------------------------------------------------------------
 *
 * @param {string} nonce - unique request identifier
 * @param {number} ttlSeconds - validity window
 *
 * @returns {Promise<void>}
 *
 * @throws {Error} when replay attack is detected
 */
async function ensureNonceUnique(
  nonce,
  ttlSeconds
) {

  /**
   * STEP 1 — Input Validation
   */
  validateNonce(nonce);
  validateTTL(ttlSeconds);

  /**
   * STEP 2 — Key Derivation
   *
   * Namespace isolation prevents collisions with other features.
   */
  const key = `nonce:${nonce}`;

  /**
   * STEP 3 — Atomic Insert
   *
   * Redis SET NX EX ensures:
   *
   *   • Key is created only once
   *   • Automatically expires after TTL
   */
  let result;

  try {

    result = await redis.set(
      key,
      "1",
      "NX",
      "EX",
      ttlSeconds
    );

  } catch (error) {

    /**
     * Infrastructure-level failure (Redis unavailable)
     *
     * DESIGN DECISION:
     * -----------------------------------------------------------------------
     * Fail closed (secure default):
     *
     *   We reject the request rather than allowing possible replay.
     */
    throw new Error(
      "Replay protection system unavailable"
    );
  }

  /**
   * STEP 4 — Replay Detection
   */
  if (!result) {

    /**
     * This means:
     *
     *   • Key already exists
     *   • Nonce was previously used
     *
     * Therefore → REPLAY ATTACK
     */
    throw new Error(
      "Replay attack detected: nonce already used"
    );
  }
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {

  ensureNonceUnique
};

/**
 * =============================================================================
 * ADVANCED ARCHITECTURAL NOTES
 * =============================================================================
 *
 * 1. TIME COMPLEXITY
 * ---------------------------------------------------------------------------
 * Redis SET operation is O(1), ensuring constant-time replay verification.
 *
 * -----------------------------------------------------------------------------
 *
 * 2. DISTRIBUTED CONSISTENCY
 * ---------------------------------------------------------------------------
 *
 * Because Redis is shared across all instances:
 *
 *   • Replay prevention is global
 *   • Works across multiple containers
 *
 * -----------------------------------------------------------------------------
 *
 * 3. MEMORY MODEL
 * ---------------------------------------------------------------------------
 *
 * Memory usage = O(number_of_requests_within_TTL)
 *
 * Automatically bounded due to TTL expiration.
 *
 * -----------------------------------------------------------------------------
 *
 * 4. FAILURE STRATEGY
 * ---------------------------------------------------------------------------
 *
 * This module adopts:
 *
 *   FAIL-CLOSED STRATEGY
 *
 * Meaning:
 *
 *   If Redis fails → reject request
 *
 * This is critical for security-sensitive systems.
 *
 * -----------------------------------------------------------------------------
 *
 * 5. FUTURE ENHANCEMENTS
 * ---------------------------------------------------------------------------
 *
 *   • Bloom filters for ultra-high throughput
 *   • Sliding window replay detection
 *   • Cryptographic nonce derivation validation
 *
 * =============================================================================
 *
 * END OF FILE
 * =============================================================================
 */
