/**
 * ========================================================= 🔐 PASSWORD HASHING UTILITY MODULE (CRYPTOGRAPHIC SECURITY LAYER) * ============================================================
 * ============================================================
 *
 * 🎯 PURPOSE:
 *
 * This module provides a fully abstracted, secure, and reusable
 * implementation for password hashing and verification.
 *
 * It encapsulates cryptographic operations to ensure:
 *
 *   ✅ Secure password storage (one-way transformation)
 *   ✅ Safe password comparison (constant-time)
 *   ✅ Centralized cryptographic control
 *
 * ------------------------------------------------------------
 *
 * 🧠 ARCHITECTURAL ROLE:
 *
 *   Application Layer (Routes)
 *           ↓
 *   Hash Utility Layer  ← THIS FILE
 *           ↓
 *   Cryptographic Engine (bcrypt)
 *
 * ------------------------------------------------------------
 *
 * 🔬 CRYPTOGRAPHIC FOUNDATION:
 *
 * The system utilizes bcrypt:
 *
 *   - Key Derivation Function (KDF)
 *   - Designed for password hashing (NOT general hashing)
 *   - Resistant to GPU/ASIC brute-force attacks
 *
 * ------------------------------------------------------------
 *
 * 📊 HIGH-LEVEL PASSWORD STORAGE MODEL:
 *
 *      Plain Password
 *           ↓
 *      Validate Input
 *           ↓
 *      Generate Salt
 *           ↓
 *      bcrypt(password + salt)
 *           ↓
 *      Store Hashed Output
 *
 * ------------------------------------------------------------
 *
 * 📊 VERIFICATION MODEL:
 *
 *      Input Password
 *           ↓
 *      Retrieve Stored Hash
 *           ↓
 *      bcrypt.compare()
 *           ↓
 *      Boolean Result (true / false)
 *
 * ------------------------------------------------------------
 */


/* ============================================================
   📦 MODULE IMPORT
   ============================================================ */

/**
 * bcryptjs:
 * Pure JavaScript implementation of bcrypt
 *
 * Provides:
 *   - Salt generation
 *   - Hashing
 *   - Secure comparison
 */
const bcrypt = require("bcryptjs");


/* ============================================================
   ⚙️ CONFIGURATION
   ============================================================ */

/**
 * Computational cost factor
 *
 * Higher value → more secure, slower
 *
 * Default range:
 *   10 → good balance (production standard)
 *   12+ → high security environments
 */
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS) || 10;


/* ============================================================
   🔐 HASH PASSWORD FUNCTION
   ============================================================ */

/**
 * ============================================================
 * FUNCTION: hashPassword
 * ============================================================
 *
 * PURPOSE:
 *   Converts plaintext password into a secure hash
 *
 * PARAMETERS:
 *   @param {string} password
 *
 * RETURNS:
 *   @returns {string} hashed password
 *
 * ------------------------------------------------------------
 *
 * 📊 FLOW:
 *
 *   Input Password
 *         ↓
 *   Validation Layer
 *         ↓
 *   Salt Generation (bcrypt.genSalt)
 *         ↓
 *   Hash Computation (bcrypt.hash)
 *         ↓
 *   Return Hash
 *
 * ------------------------------------------------------------
 */
async function hashPassword(password) {

  /* ========================================================
     🧠 STEP 1: INPUT VALIDATION
     ======================================================== */

  if (typeof password !== "string" || password.length < 6) {
    throw new Error("Password must be a string with at least 6 characters");
  }


  /* ========================================================
     🧠 STEP 2: SALT GENERATION
     ======================================================== */

  /**
   * Salt adds randomness to hashing process
   * Prevents identical hashes for identical passwords
   */
  const salt = await bcrypt.genSalt(SALT_ROUNDS);


  /* ========================================================
     🔐 STEP 3: HASH COMPUTATION
     ======================================================== */

  const hash = await bcrypt.hash(password, salt);


  /* ========================================================
     📤 STEP 4: RETURN HASH
     ======================================================== */

  return hash;
}


/* ============================================================
   🔐 COMPARE PASSWORD FUNCTION
   ============================================================ */

/**
 * ============================================================
 * FUNCTION: comparePassword
 * ============================================================
 *
 * PURPOSE:
 *   Verifies if plaintext password matches stored hash
 *
 * PARAMETERS:
 *   @param {string} password
 *   @param {string} hashed
 *
 * RETURNS:
 *   @returns {boolean}
 *
 * ------------------------------------------------------------
 *
 * 📊 FLOW:
 *
 *   Input Password
 *        ↓
 *   Retrieve Stored Hash
 *        ↓
 *   bcrypt.compare()
 *        ↓
 *   Secure Comparison
 *        ↓
 *   true / false
 *
 * ------------------------------------------------------------
 */
async function comparePassword(password, hashed) {

  /* ========================================================
     🧠 INPUT VALIDATION
     ======================================================== */

  if (typeof password !== "string" || typeof hashed !== "string") {
    throw new Error("Invalid input types for password comparison");
  }


  /* ========================================================
     🔐 SECURE COMPARISON
     ======================================================== */

  /**
   * bcrypt.compare performs:
   *
   *   - Re-hashing using stored salt
   *   - Constant-time comparison (resists timing attacks)
   */
  return await bcrypt.compare(password, hashed);
}


/* ============================================================
   🔬 CRYPTOGRAPHIC ANALYSIS (ACADEMIC SECTION)
   ============================================================ */

/**
 * 🔬 WHY NOT SHA256?
 *
 * Traditional hashing algorithms (SHA256, MD5):
 *
 *   ❌ Too fast (vulnerable to brute-force)
 *   ❌ No built-in salt
 *
 * ------------------------------------------------------------
 *
 * ✅ WHY BCRYPT:
 *
 *   ✅ Adaptive cost factor (configurable complexity)
 *   ✅ Built-in salt generation
 *   ✅ Designed specifically for passwords
 *
 * ------------------------------------------------------------
 *
 * 🔐 SECURITY LAYERS:
 *
 *   Layer 1: Input validation
 *   Layer 2: Salt randomness
 *   Layer 3: Hash computational cost
 *
 * ------------------------------------------------------------
 *
 * ⚠️ THREAT MODEL:
 *
 *   Threat: Database breach
 *     → Mitigation: passwords are hashed
 *
 *   Threat: Rainbow table attacks
 *     → Mitigation: unique salt per password
 *
 *   Threat: Brute-force attacks
 *     → Mitigation: slow hashing (cost factor)
 *
 * ------------------------------------------------------------
 *
 * ✅ BEST PRACTICES:
 *
 *   - Always hash passwords before storage
 *   - Never log passwords or hashes
 *   - Use environment-configurable cost factor
 *
 */


/* ============================================================
   📦 EXPORT
   ============================================================ */

module.exports = {
  hashPassword,
  comparePassword
};


/* ============================================================
   🏁 END OF FILE
   ============================================================ */

