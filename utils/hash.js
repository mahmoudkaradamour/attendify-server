/**
 * ============================================================
 * 🔐 PASSWORD HASHING UTILITY MODULE (CRYPTANALYTIC COMPONENT)
 * ============================================================
 *
 * 🎯 PURPOSE:
 *
 * This module provides a secure abstraction layer for handling
 * password hashing and verification using modern cryptographic
 * standards.
 *
 * It implements:
 *
 *   ✅ Password hashing (one-way transformation)
 *   ✅ Password verification (secure comparison)
 *
 * ------------------------------------------------------------
 *
 * 🧠 BACKGROUND:
 *
 * Passwords MUST NOT be stored in plaintext.
 *
 * Instead, we store:
 *
 *   HASH(password + salt)
 *
 * ------------------------------------------------------------
 *
 * 🔬 CRYPTOGRAPHIC MODEL:
 *
 * The system uses bcrypt, a key derivation function (KDF)
 * specifically designed for password hashing.
 *
 * Properties of bcrypt:
 *
 *   ✅ Adaptive (cost factor adjustable)
 *   ✅ Salted hashing (prevents rainbow tables)
 *   ✅ Slow computation (resists brute-force attacks)
 *
 * ------------------------------------------------------------
 *
 * 🧬 HIGH-LEVEL PASSWORD FLOW:
 *
 *   USER INPUT PASSWORD
 *           ↓
 *   bcrypt.generateSalt()
 *           ↓
 *   bcrypt.hash(password + salt)
 *           ↓
 *   Store HASH in database
 *
 * ------------------------------------------------------------
 *
 * 🧬 VERIFICATION FLOW:
 *
 *   USER INPUT PASSWORD
 *           ↓
 *   Retrieve stored HASH
 *           ↓
 *   bcrypt.compare(input, hash)
 *           ↓
 *   Boolean result (true / false)
 *
 * ------------------------------------------------------------
 */


// ============================================================
// 📦 MODULE IMPORT
// ============================================================

/**
 * bcryptjs:
 *
 * JavaScript implementation of bcrypt.
 * Provides:
 *   - secure hashing
 *   - salt generation
 *   - password comparison
 *
 * Note:
 * bcryptjs is CPU-bound, designed to be intentionally slow.
 */
const bcrypt = require("bcryptjs");


// ============================================================
// 🔐 HASH PASSWORD FUNCTION
// ============================================================

/**
 * ============================================================
 * 🔐 FUNCTION: hashPassword
 * ============================================================
 *
 * PURPOSE:
 *   Converts a plaintext password into a secure hashed form
 *
 * PARAMETERS:
 *   @param {string} password
 *
 * RETURNS:
 *   @returns {string} hashed password
 *
 * ------------------------------------------------------------
 *
 * 🔬 INTERNAL STEPS:
 *
 *   1. Generate cryptographic salt
 *   2. Combine salt with password
 *   3. Apply bcrypt hashing algorithm
 *
 * ------------------------------------------------------------
 *
 * 📊 FLOW DIAGRAM:
 *
 *   Plain Password
 *        ↓
 *   Generate Salt (random)
 *        ↓
 *   Combine Password + Salt
 *        ↓
 *   Apply Hash Function (bcrypt)
 *        ↓
 *   Return Hashed Output
 *
 * ------------------------------------------------------------
 *
 * 🧠 SECURITY NOTES:
 *
 *   - Salt ensures uniqueness of hashes
 *   - Even identical passwords generate different hashes
 *   - Protects against rainbow table attacks
 *
 * ------------------------------------------------------------
 */
async function hashPassword(password) {

  const saltRounds = 10; // Adjustable computational cost

  /**
   * Step 1: Generate Salt
   */
  const salt = await bcrypt.genSalt(saltRounds);

  /**
   * Step 2: Generate Hash
   */
  const hash = await bcrypt.hash(password, salt);

  /**
   * Step 3: Return Hash
   */
  return hash;
}


// ============================================================
// 🔐 COMPARE PASSWORD FUNCTION
// ============================================================

/**
 * ============================================================
 * 🔐 FUNCTION: comparePassword
 * ============================================================
 *
 * PURPOSE:
 *   Verifies whether a plaintext password matches a stored hash
 *
 * PARAMETERS:
 *   @param {string} password - user input
 *   @param {string} hashed   - stored hash
 *
 * RETURNS:
 *   @returns {boolean} true if match, false otherwise
 *
 * ------------------------------------------------------------
 *
 * 📊 FLOW DIAGRAM:
 *
 *   Input Password
 *         ↓
 *   Retrieve Stored Hash
 *         ↓
 *   Extract Salt
 *         ↓
 *   Hash Input Using Same Salt
 *         ↓
 *   Compare Results
 *         ↓
 *   Return true / false
 *
 * ------------------------------------------------------------
 *
 * 🧠 SECURITY NOTES:
 *
 *   - Resistant to timing attacks
 *   - No direct password comparison used
 *   - Ensures safe authentication
 *
 * ------------------------------------------------------------
 */
async function comparePassword(password, hashed) {

  return await bcrypt.compare(password, hashed);
}


// ============================================================
// 📊 CRYPTOGRAPHIC ANALYSIS (ACADEMIC)
// ============================================================

/**
 * 🔬 WHY BCRYPT?
 *
 * Traditional hashing (e.g., SHA256) is NOT suitable for passwords
 * because it is:
 *
 *   ❌ Too fast (vulnerable to brute-force attacks)
 *
 * bcrypt solves this by:
 *
 *   ✅ Adding computational cost (deliberately slow)
 *   ✅ Using salts (prevents precomputed attacks)
 *
 * ------------------------------------------------------------
 *
 * 🔐 SECURITY LAYERS PROVIDED:
 *
 *   Layer 1: Salt (randomization)
 *   Layer 2: Hashing (one-way transformation)
 *   Layer 3: Cost factor (time complexity)
 *
 * ------------------------------------------------------------
 *
 * ⚠️ THREAT MODEL:
 *
 *   Threat: Database leak
 *   → Passwords remain protected (hashed)
 *
 *   Threat: Rainbow tables
 *   → Prevented by salt
 *
 *   Threat: Brute-force attack
 *   → Mitigated by slow hashing
 *
 * ------------------------------------------------------------
 *
 * ✅ BEST PRACTICES:
 *
 *   - Never store plaintext passwords
 *   - Always hash before storage
 *   - Use strong cost factor
 *   - Combine with HTTPS + JWT
 *
 */


// ============================================================
// 📦 EXPORT MODULE
// ============================================================

module.exports = {
  hashPassword,
  comparePassword
};


