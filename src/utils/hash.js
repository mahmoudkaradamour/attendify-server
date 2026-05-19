/**
 * =============================================================================
 * Attendify Cryptographic Hash Utilities (Password Security Layer)
 * =============================================================================
 *
 * FILE:
 * src/utils/hash.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module provides cryptographic utilities for securely hashing and
 * verifying sensitive data, specifically user passwords.
 *
 * It encapsulates bcrypt operations and enforces a consistent, secure
 * password-handling strategy across the entire backend.
 *
 * -----------------------------------------------------------------------------
 * WHY PASSWORD HASHING IS NECESSARY
 * -----------------------------------------------------------------------------
 *
 * Storing plaintext passwords is a critical security vulnerability.
 *
 * If a database is compromised:
 *
 *   ❌ Plaintext passwords expose all user accounts
 *   ❌ Attackers gain immediate access to credentials
 *
 * Therefore:
 *
 *   password → hash(password) → store hash
 *
 * Only the hash is stored.
 *
 * -----------------------------------------------------------------------------
 * CRYPTOGRAPHIC MODEL
 * -----------------------------------------------------------------------------
 *
 * This module uses bcrypt, a slow, adaptive hashing algorithm.
 *
 * bcrypt provides:
 *
 *   ✅ Salted hashing
 *   ✅ Resistance against rainbow table attacks
 *   ✅ Configurable computational cost
 *
 * -----------------------------------------------------------------------------
 * HASHING FLOW
 * -----------------------------------------------------------------------------
 *
 *        Plain Password
 *               │
 *               ▼
 *       bcrypt.hash(password, saltRounds)
 *               │
 *               ▼
 *          Hashed Output
 *
 * -----------------------------------------------------------------------------
 * VERIFICATION FLOW
 * -----------------------------------------------------------------------------
 *
 *     Input Password       Stored Hash
 *            │                  │
 *            ▼                  ▼
 *      bcrypt.compare(password, hash)
 *               │
 *        ┌──────┴──────┐
 *        ▼             ▼
 *      match        mismatch
 *        │             │
 *        ▼             ▼
 *      true          false
 *
 * -----------------------------------------------------------------------------
 * IMPORTANT SECURITY PROPERTIES
 * -----------------------------------------------------------------------------
 *
 * 1. SALTING
 * -----------------------------------------------------------------------------
 * Each password hash includes a random salt:
 *
 *   hash = bcrypt(password + salt)
 *
 * Even identical passwords produce different hashes.
 *
 * -----------------------------------------------------------------------------
 * 2. SLOW HASHING (COST FACTOR)
 * -----------------------------------------------------------------------------
 *
 * bcrypt uses a work factor ("salt rounds") that controls computation cost.
 *
 * Higher cost:
 *
 *   ✅ Better security
 *   ❌ More CPU usage
 *
 * -----------------------------------------------------------------------------
 * 3. CONSTANT-TIME COMPARISON
 * -----------------------------------------------------------------------------
 *
 * bcrypt.compare prevents timing attacks.
 *
 * -----------------------------------------------------------------------------
 * CONFIGURATION INTEGRATION
 * -----------------------------------------------------------------------------
 *
 * SALT_ROUNDS is controlled via environment configuration:
 *
 *   config.SALT_ROUNDS
 *
 * -----------------------------------------------------------------------------
 * DESIGN PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Passwords must never be stored or compared in plaintext."
 *
 * -----------------------------------------------------------------------------
 * FORMAL GUARANTEE
 * -----------------------------------------------------------------------------
 *
 * ∀ password P:
 *   store(hash(P)) AND NOT store(P)
 *
 * ∀ login attempt L:
 *   success ⇔ compare(P_input, stored_hash) == true
 *
 * -----------------------------------------------------------------------------
 * USAGE PATTERN
 * -----------------------------------------------------------------------------
 *
 * const { hashPassword, comparePassword } = require("../utils/hash");
 *
 * const hash = await hashPassword("plainPassword");
 *
 * const isValid = await comparePassword("input", hash);
 *
 * =============================================================================
 */

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

const bcrypt = require("bcryptj");

const config = require("../config/env");

/* =============================================================================
 * HASH PASSWORD
 * =============================================================================
 */

/**
 * Hashes a plaintext password using bcrypt.
 *
 * @param {string} password
 * @returns {Promise<string>}
 */
async function hashPassword(password) {

  /**
   * Validate input type (defensive programming)
   */
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Invalid password input");
  }

  /**
   * Salt rounds determine computational cost
   */
  const saltRounds = config.SALT_ROUNDS;

  /**
   * Generate hash
   */
  const hash =
    await bcrypt.hash(password, saltRounds);

  return hash;
}

/* =============================================================================
 * COMPARE PASSWORD
 * =============================================================================
 */

/**
 * Compares a plaintext password with a hashed password.
 *
 * @param {string} plainPassword
 * @param {string} hashedPassword
 * @returns {Promise<boolean>}
 */
async function comparePassword(plainPassword, hashedPassword) {

  /**
   * Defensive validation
   */
  if (
    typeof plainPassword !== "string" ||
    typeof hashedPassword !== "string"
  ) {
    return false;
  }

  /**
   * Secure comparison (constant-time internally)
   */
  const isMatch =
    await bcrypt.compare(plainPassword, hashedPassword);

  return isMatch;
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  hashPassword,
  comparePassword
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */