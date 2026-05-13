/**
 * ============================================================
 * 🔐 NONCE SERVICE (ANTI-REPLAY CORE)
 * ============================================================
 *
 * 🎯 PURPOSE:
 *
 * This module provides a secure mechanism for generating
 * and validating NONCE values to prevent replay attacks.
 *
 * A "nonce" is defined as:
 *
 *   → Number used ONCE
 *
 * ------------------------------------------------------------
 *
 * 🧠 ROLE IN SECURITY MODEL:
 *
 *   Client generates request →
 *      includes nonce
 *
 *   Backend verifies:
 *      ✅ nonce is valid
 *      ✅ nonce is unused
 *      ✅ nonce is not expired
 *
 * ------------------------------------------------------------
 *
 * 🔬 SECURITY PROPERTIES:
 *
 *   ✅ Unpredictable (cryptographically random)
 *   ✅ Unique
 *   ✅ Short-lived
 *   ✅ Single-use
 *
 * ------------------------------------------------------------
 *
 * 📊 FLOW:
 *
 *   Client
 *     ↓
 *   GET /nonce
 *     ↓
 *   Receive nonce
 *     ↓
 *   Use nonce in signed request
 *     ↓
 *   Backend validates
 *
 * ------------------------------------------------------------
 */

const { randomHex } = require("../utils/crypto.util");

/**
 * Nonce expiration time (milliseconds)
 *
 * Example:
 *   5 minutes validity
 */
const NONCE_TTL = 5 * 60 * 1000; // 5 minutes


/**
 * ============================================================
 * 🧠 NONCE GENERATOR
 * ============================================================
 *
 * Generates a secure nonce with metadata
 *
 * OUTPUT STRUCTURE:
 *
 * {
 *   value: string,
 *   issuedAt: number,
 *   expiresAt: number
 * }
 *
 * ------------------------------------------------------------
 *
 * @returns {object}
 */
function generateNonce() {

  const now = Date.now();

  const nonce = {
    value: randomHex(32),   // cryptographically strong random value
    issuedAt: now,
    expiresAt: now + NONCE_TTL
  };

  return nonce;
}


/**
 * ============================================================
 * ✅ NONCE VALIDATION
 * ============================================================
 *
 * Validates expiration timing of nonce
 *
 * NOTE:
 * Replay detection is handled separately in replay.store.js
 *
 * ------------------------------------------------------------
 *
 * 📊 VALIDATION STEPS:
 *
 *   Check existence
 *      ↓
 *   Check expiration
 *
 * ------------------------------------------------------------
 *
 * @param {object} nonce
 * @returns {boolean}
 */
function isNonceValid(nonce) {

  if (!nonce) return false;

  const now = Date.now();

  /**
   * Check expiration
   */
  if (now > nonce.expiresAt) {
    return false;
  }

  return true;
}


module.exports = {
  generateNonce,
  isNonceValid,
  NONCE_TTL
};


/* ============================================================
   📊 NONCE LIFECYCLE (ACADEMIC VIEW)
   ============================================================ */

/**
 * 🔁 COMPLETE FLOW:
 *
 *   Step 1 → Client requests nonce
 *   Step 2 → Server generates nonce
 *   Step 3 → Client uses nonce in request
 *   Step 4 → Server verifies:
 *              - validity
 *              - not expired
 *              - not reused (via replay store)
 *   Step 5 → Server consumes nonce
 *
 *
 * ------------------------------------------------------------
 *
 * 🔐 ATTACK MITIGATION:
 *
 *   ❌ Replay Attack:
 *
 *      Attacker reuses old request →
 *      NONCE already used → rejected
 *
 *
 * ------------------------------------------------------------
 *
 * ⚡ PERFORMANCE:
 *
 *   Nonce generation is constant time O(1)
 *
 *
 * ------------------------------------------------------------
 *
 * 🧠 DESIGN DECISION:
 *
 *   NONCE does NOT store itself
 *   → Storage is external (replay.store)
 *
 * ============================================================
 */