/**
 * ============================================================
 * 🔐 REPLAY PROTECTION STORE (ANTI-REPLAY ENGINE)
 * ============================================================
 *
 rejecting any reuse attempt. * 🎯 PURPOSE:
 *
 * ------------------------------------------------------------
 *
 * 🧠 DEFINITION:
 *
 * A replay attack occurs when:
 *
 *   → An attacker captures a valid request
 *   → Re-sends it later to gain unauthorized effect
 *
 * ------------------------------------------------------------
 *
 * ✅ SOLUTION STRATEGY:
 *
 *   Store every used nonce in memory (or storage)
 *   and mark it as "consumed".
 *
 *   Any attempt to reuse it:
 *      → rejected immediately
 *
 * ------------------------------------------------------------
 *
 * 📊 SYSTEM FLOW:
 *
 *   Request arrives
 *        ↓
 *   Extract nonce
 *        ↓
 *   Check store:
 *        → exists → REJECT ❌
 *        → not exists → ACCEPT ✅
 *        ↓
 *   Save nonce
 *        ↓
 *   Process request
 *
 * ------------------------------------------------------------
 *
 * 🔬 SECURITY PROPERTIES:
 *
 *   ✅ One-time usage enforcement
 *   ✅ Time-based expiration (TTL)
 *   ✅ Constant-time lookup (Map)
 *
 * ------------------------------------------------------------
 *
 * ⚠️ LIMITATION (IMPORTANT):
 *
 *   This implementation is memory-based:
 *
 *   → Lost if server restarts
 *   → Not shared across instances
 *
 *   ✅ For production scaling → use Redis
 *
 * ------------------------------------------------------------
 */


/* ============================================================
   🧠 INTERNAL STORAGE (IN-MEMORY MAP)
   ============================================================ */

/**
 * Map structure:
 *
 *   key   → nonce value
 *   value → expiration timestamp
 *
 * Example:
 *
 *   {
 *     "abc123": 1710000000000
 *   }
 *
 * ------------------------------------------------------------
 *
 * TIME COMPLEXITY:
 *
 *   lookup → O(1)
 */
const store = new Map();


/* ============================================================
   ⏱️ CONFIGURATION
   ============================================================ */

/**
 * Cleanup interval (milliseconds)
 */
const CLEANUP_INTERVAL = 60 * 1000; // every 60 seconds



/* ============================================================
   ✅ FUNCTION: isReplay(nonce)
   ============================================================ */

/**
 * Determines if nonce has already been used
 *
 * ------------------------------------------------------------
 *
 * 📊 LOGIC:
 *
 *   If nonce exists AND not expired → replay attack
 *
 * ------------------------------------------------------------
 *
 * @param {string} nonce
 * @returns {boolean}
 */
function isReplay(nonce) {

  const now = Date.now();

  const expiresAt = store.get(nonce);

  /**
   * If nonce exists and still valid → replay detected
   */
  if (expiresAt && now < expiresAt) {
    return true;
  }

  return false;
}



/* ============================================================
   ✅ FUNCTION: rememberNonce(nonce, ttl)
   ============================================================ */

/**
 * Stores nonce for future replay detection
 *
 * ------------------------------------------------------------
 *
 * 📊 LOGIC:
 *
 *   nonce → saved with expiration time
 *
 * ------------------------------------------------------------
 *
 * @param {string} nonce
 * @param {number} ttl (milliseconds)
 */
function rememberNonce(nonce, ttl) {

  const expiresAt = Date.now() + ttl;

  store.set(nonce, expiresAt);
}



/* ============================================================
   🧹 FUNCTION: cleanupExpired()
   ============================================================ */

/**
 * Periodically removes expired nonces
 *
 * ------------------------------------------------------------
 *
 * PURPOSE:
 *
 *   Prevent memory growth
 *
 * ------------------------------------------------------------
 *
 * 📊 FLOW:
 *
 *   Iterate over store
 *        ↓
 *   Remove expired entries
 *
 */
function cleanupExpired() {

  const now = Date.now();

  for (const [nonce, expiresAt] of store.entries()) {
    if (now > expiresAt) {
      store.delete(nonce);
    }
  }
}


/**
 * Schedule automatic cleanup
 */
setInterval(cleanupExpired, CLEANUP_INTERVAL);



/* ============================================================
   ✅ FUNCTION: consumeNonce(nonce, ttl)
   ============================================================ */

/**
 * Main function combining:
 *
 *   ✅ Replay detection
 *   ✅ Recording nonce usage
 *
 * ------------------------------------------------------------
 *
 * 📊 FLOW:
 *
 *   Check replay
 *      ↓
 *   If replay → reject
 *      ↓
 *   Else:
 *      → store nonce
 *      → allow request
 *
 * ------------------------------------------------------------
 *
 * @param {string} nonce
 * @param {number} ttl
 * @returns {boolean} (true if valid, false if replay)
 */
function consumeNonce(nonce, ttl) {

  /**
   * Step 1: Check replay
   */
  if (isReplay(nonce)) {
    return false;
  }

  /**
   * Step 2: Store nonce
   */
  rememberNonce(nonce, ttl);

  return true;
}



/* ============================================================
   📤 EXPORTS
   ============================================================ */

module.exports = {
  isReplay,
  rememberNonce,
  consumeNonce
};


/* ============================================================
   📊 ACADEMIC MODEL OF REPLAY DEFENSE
   ============================================================ */

/**
 * 🔁 FULL SECURITY FLOW:
 *
 *   Client:
 *      → gets nonce
 *      → signs request
 *      → sends payload
 *
 *   Backend:
 *      → extract nonce
 *      → consumeNonce()
 *
 *         CASE 1:
 *             first time → allowed ✅
 *
 *         CASE 2:
 *             reused → rejected ❌
 *
 *
 * ------------------------------------------------------------
 *
 * 🔐 ATTACK MITIGATION:
 *
 *   ❌ Replay Attack:
 *
 *      Attacker captures request →
 *      tries to resend →
 *
 *      System sees nonce already used →
 *      REJECT ✅
 *
 *
 * ------------------------------------------------------------
 *
 * ⚡ PERFORMANCE:
 *
 *   Map-based lookup → O(1)
 *   Cleanup → O(n) periodic
 *
 *
 * ------------------------------------------------------------
 *
 * 🔮 SCALABILITY IMPROVEMENTS:
 *
 *   Replace Map with:
 *
 *   ✅ Redis (distributed)
 *   ✅ Memcached
 *
 *
 * ------------------------------------------------------------
 *
 * 🧠 DESIGN PRINCIPLE:
 *
 *   Stateless request validation +
 *   minimal in-memory state
 *
 *
 * ============================================================
 *
 * 🏁 END OF MODULE
 * ============================================================
 */

