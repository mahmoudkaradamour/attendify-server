/**
 * ============================================================
 * 🔐 CRYPTOGRAPHIC UTILITIES MODULE (HARDENED CORE SECURITY)
 🧠 SYSTEM POSITION: * ============================================================
 *
 *   Client (Flutter)
 *        ↓
 *   Payload generation
 *        ↓
 *   Canonicalization + Signing
 *        ↓
 *   Transport (network)
 *        ↓
 *   Backend → Verification (this module)
 *
 * ------------------------------------------------------------
 *
 * 🔬 CRYPTOGRAPHIC MODEL:
 *
 *   Payload → Canonical Form → HMAC-SHA256 → Signature
 *
 * ------------------------------------------------------------
 *
 * ⚠️ SECURITY PRINCIPLES:
 *
 *   ✅ Trust nothing from the client
 *   ✅ Use constant-time comparisons
 *   ✅ Ensure deterministic serialization
 *   ✅ Avoid weak randomness sources
 *   ✅ Fail safely on any anomaly
 *
 * ------------------------------------------------------------
 */

const crypto = require("crypto");


/* ============================================================
   🔑 HASH FUNCTION (SHA-256)
   ============================================================ */

/**
 * Produces a SHA-256 hash
 *
 * @param {string|Buffer} data
 * @returns {string}
 */
function hash(data) {

  return crypto
    .createHash("sha256")
    .update(data)
    .digest("hex");
}


/* ============================================================
   🧪 DEEP CANONICALIZATION (CRITICAL SECURITY COMPONENT)
   ============================================================ */

/**
 * 🔬 FUNCTION: canonicalize()
 *
 * PURPOSE:
 *   Convert any JavaScript object into a deterministic string.
 *
 * WHY:
 *   JSON.stringify is NOT deterministic for objects.
 *
 * ------------------------------------------------------------
 *
 * 📊 FLOW:
 *
 *   Input
 *     ↓
 *   Sort keys recursively
 *     ↓
 *   Normalize structure
 *     ↓
 *   Serialize to JSON string
 *
 * ------------------------------------------------------------
 *
 * SECURITY IMPACT:
 *
 *   Prevents signature mismatch between:
 *     Client vs Server
 *
 * ------------------------------------------------------------
 *
 * @param {any} input
 * @returns {string}
 */
function canonicalize(input) {

  /**
   * Primitive values → directly stringify
   */
  if (input === null || typeof input !== "object") {
    return JSON.stringify(input);
  }

  /**
   * Arrays → preserve order but canonicalize elements
   */
  if (Array.isArray(input)) {
    return JSON.stringify(
      input.map(item => JSON.parse(canonicalize(item)))
    );
  }

  /**
   * Objects → sort keys recursively
   */
  const sortedKeys = Object.keys(input).sort();
  const result = {};

  for (const key of sortedKeys) {
    result[key] = JSON.parse(canonicalize(input[key]));
  }

  return JSON.stringify(result);
}


/* ============================================================
   🔏 HMAC SIGNING
   ============================================================ */

/**
 * 🔬 FUNCTION: sign()
 *
 * PURPOSE:
 *   Produce HMAC-SHA256 signature
 *
 * SECURITY:
 *   Ensures:
 *     ✅ Data authenticity
 *     ✅ Data integrity
 *
 * ------------------------------------------------------------
 *
 * @param {string|object} data
 * @param {string} secret
 * @returns {string}
 */
function sign(data, secret) {

  /**
   * Ensure deterministic input
   */
  if (typeof data !== "string") {
    data = canonicalize(data);
  }

  return crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("hex");
}


/* ============================================================
   ✅ SIGNATURE VERIFICATION
   ============================================================ */

/**
 * 🔬 FUNCTION: verifySignature()
 *
 * PURPOSE:
 *   Validate HMAC signature securely
 *
 * ------------------------------------------------------------
 *
 * SECURITY:
 *
 *   ✅ Constant-time comparison
 *   ✅ Length validation
 *   ✅ Safe failure handling
 *
 * ------------------------------------------------------------
 *
 * @param {string|object} data
 * @param {string} signature
 * @param {string} secret
 * @returns {boolean}
 */
function verifySignature(data, signature, secret) {

  try {

    /**
     * Normalize data before verification
     */
    if (typeof data !== "string") {
      data = canonicalize(data);
    }

    const expected = sign(data, secret);

    const sigBuffer = Buffer.from(signature, "hex");
    const expBuffer = Buffer.from(expected, "hex");

    /**
     * Prevent length-based oracle attacks
     */
    if (sigBuffer.length !== expBuffer.length) {
      return false;
    }

    /**
     * ✅ Timing-safe comparison
     */
    return crypto.timingSafeEqual(sigBuffer, expBuffer);

  } catch (err) {

    /**
     * Fail securely
     */
    return false;
  }
}


/* ============================================================
   🎲 CRYPTOGRAPHIC RANDOM GENERATOR
   ============================================================ */

/**
 * 🔬 FUNCTION: randomHex()
 *
 * PURPOSE:
 *   Generate secure random string
 *
 * ------------------------------------------------------------
 *
 * INTERNAL:
 *   Uses OS-level entropy pool
 *
 * ------------------------------------------------------------
 *
 * @param {number} length (bytes)
 * @returns {string}
 */
function randomHex(length = 32) {

  return crypto
    .randomBytes(length)
    .toString("hex");
}


/* ============================================================
   📤 EXPORTS
   ============================================================ */

module.exports = {
  hash,
  sign,
  verifySignature,
  randomHex,
  canonicalize
};

/* ============================================================
   🏁 END OF MODULE
   ============================================================
 */