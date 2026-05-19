/**
 * =============================================================================
 * Attendify Nonce Service
 * =============================================================================
 *
 * FILE:
 * src/services/nonce.service.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module implements nonce issuance logic for the Attendify backend platform.
 *
 * A nonce is a cryptographically strong, short-lived, single-use value used to
 * protect sensitive signed requests against replay attacks.
 *
 * The word "nonce" means:
 *
 *   Number used once
 *
 * In security engineering, a nonce is not necessarily numeric. It is commonly a
 * random byte sequence represented as a hexadecimal string.
 *
 * -----------------------------------------------------------------------------
 * WHY NONCES ARE REQUIRED
 * -----------------------------------------------------------------------------
 *
 * A valid HMAC signature proves that a payload was produced by an entity that
 * knows the shared secret.
 *
 * However, without nonce-based freshness, an attacker could capture a valid
 * signed request and resend the exact same request later.
 *
 * That is called:
 *
 *   Replay Attack
 *
 * -----------------------------------------------------------------------------
 * REPLAY ATTACK MODEL
 * -----------------------------------------------------------------------------
 *
 *                      Valid Signed Request
 *                              │
 *                              ▼
 *                         Attacker Copies
 *                              │
 *                              ▼
 *                         Attacker Replays
 *                              │
 *                              ▼
 *                    Server Accepts Again ❌
 *
 * -----------------------------------------------------------------------------
 * NONCE-BASED DEFENSE MODEL
 * -----------------------------------------------------------------------------
 *
 *                      Client Requests Nonce
 *                              │
 *                              ▼
 *                       Server Issues Nonce
 *                              │
 *                              ▼
 *                    Client Signs Payload + Nonce
 *                              │
 *                              ▼
 *                    Server Verifies Freshness
 *                              │
 *                              ▼
 *                    Server Consumes Nonce Once
 *                              │
 *                 ┌────────────┴────────────┐
 *                 ▼                         ▼
 *             First Use                 Second Use
 *                 │                         │
 *                 ▼                         ▼
 *              Accept                   Reject Replay
 *
 * -----------------------------------------------------------------------------
 * NONCE STRUCTURE
 * -----------------------------------------------------------------------------
 *
 * This service issues nonce objects shaped as:
 *
 * {
 *   value: "64-character-hex-string",
 *   issuedAt: 1710000000000,
 *   expiresAt: 1710000300000,
 *   ttlSeconds: 300
 * }
 *
 * Field explanation:
 *
 *   value:
 *     Cryptographically secure random value.
 *
 *   issuedAt:
 *     Unix timestamp in milliseconds at issuance time.
 *
 *   expiresAt:
 *     Unix timestamp in milliseconds after which the nonce is no longer fresh.
 *
 *   ttlSeconds:
 *     Time-to-live in seconds. Used by replay stores such as Redis.
 *
 * -----------------------------------------------------------------------------
 * SECURITY PROPERTIES
 * -----------------------------------------------------------------------------
 *
 * A secure nonce must be:
 *
 *   ✅ Random
 *   ✅ Unpredictable
 *   ✅ Short-lived
 *   ✅ Single-use
 *   ✅ Large enough to resist guessing
 *
 * -----------------------------------------------------------------------------
 * DESIGN PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 * This service is responsible for:
 *
 *   ✅ Issuing nonce metadata
 *   ✅ Defining nonce lifetime
 *   ✅ Basic nonce object validation helpers
 *
 * This service is NOT responsible for:
 *
 *   ❌ Signature verification
 *   ❌ Replay store mutation
 *   ❌ Attendance business decisions
 *
 * Those responsibilities belong to:
 *
 *   src/security/verifier.service.js
 *
 * -----------------------------------------------------------------------------
 * SECURITY DESIGN PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Freshness must be explicit, time-bounded, and replay-aware."
 *
 * =============================================================================
 */

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

const {
  randomHex
} = require("../utils/crypto.util");

const {
  auditLogger
} = require("../observability/audit.logger");

/* =============================================================================
 * NONCE SECURITY CONSTANTS
 * =============================================================================
 */

/**
 * NONCE_RANDOM_BYTES
 * -----------------------------------------------------------------------------
 *
 * 32 bytes = 256 bits of entropy.
 *
 * Hex encoding produces:
 *
 *   64 hexadecimal characters
 *
 * SECURITY RATIONALE:
 * -----------------------------------------------------------------------------
 *
 * 256-bit random values provide extremely strong resistance against guessing.
 */

const NONCE_RANDOM_BYTES =
  32;

/**
 * NONCE_TTL_SECONDS
 * -----------------------------------------------------------------------------
 *
 * Nonce lifetime.
 *
 * Current policy:
 *
 *   5 minutes
 *
 * SECURITY/USABILITY BALANCE:
 * -----------------------------------------------------------------------------
 *
 * Too short:
 *   Users/devices may fail under normal latency.
 *
 * Too long:
 *   Replay window increases.
 */

const NONCE_TTL_SECONDS =
  5 * 60;

/* =============================================================================
 * NONCE ISSUANCE
 * =============================================================================
 */

/**
 * generateNonce()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Generates a cryptographically secure nonce object.
 *
 * -----------------------------------------------------------------------------
 * FLOW:
 * -----------------------------------------------------------------------------
 *
 *                  generateNonce()
 *                        │
 *                        ▼
 *              randomHex(32 bytes)
 *                        │
 *                        ▼
 *                issuedAt = Date.now()
 *                        │
 *                        ▼
 *           expiresAt = issuedAt + TTL
 *                        │
 *                        ▼
 *                 return nonce object
 *
 * -----------------------------------------------------------------------------
 * @returns {{
 *   value: string,
 *   issuedAt: number,
 *   expiresAt: number,
 *   ttlSeconds: number
 * }}
 */

function generateNonce() {

  const issuedAt =
    Date.now();

  const expiresAt =
    issuedAt + (NONCE_TTL_SECONDS * 1000);

  const nonce = {

    value:
      randomHex(NONCE_RANDOM_BYTES),

    issuedAt,

    expiresAt,

    ttlSeconds:
      NONCE_TTL_SECONDS
  };

  auditLogger.nonceIssued({
    action:
      "NONCE_ISSUED",

    metadata: {
      ttlSeconds:
        NONCE_TTL_SECONDS
    }
  });

  return nonce;
}

/* =============================================================================
 * NONCE SHAPE VALIDATION
 * =============================================================================
 */

/**
 * isValidNonceObject()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Performs defensive runtime validation for nonce object shape.
 *
 * IMPORTANT:
 * -----------------------------------------------------------------------------
 *
 * Full HTTP request schema validation belongs to:
 *
 *   src/validation/*
 *
 * This helper exists for service-level defensive validation and verifier safety.
 *
 * -----------------------------------------------------------------------------
 * @param {*} nonce
 *
 * @returns {boolean}
 */

function isValidNonceObject(nonce) {

  if (
    !nonce ||
    typeof nonce !== "object"
  ) {

    return false;
  }

  if (
    typeof nonce.value !== "string" ||
    nonce.value.length !== 64 ||
    !/^[a-f0-9]+$/i.test(nonce.value)
  ) {

    return false;
  }

  if (
    !Number.isInteger(nonce.issuedAt) ||
    nonce.issuedAt <= 0
  ) {

    return false;
  }

  if (
    !Number.isInteger(nonce.expiresAt) ||
    nonce.expiresAt <= nonce.issuedAt
  ) {

    return false;
  }

  return true;
}

/**
 * isNonceExpired()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Determines whether a nonce is expired at current server time.
 *
 * -----------------------------------------------------------------------------
 * @param {object} nonce
 * @param {number} [now]
 *
 * @returns {boolean}
 */

function isNonceExpired(
  nonce,
  now = Date.now()
) {

  if (!isValidNonceObject(nonce)) {

    return true;
  }

  return now > nonce.expiresAt;
}

/**
 * getRemainingNonceTtlSeconds()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Computes remaining TTL in seconds.
 *
 * This value is useful when storing replay keys in Redis.
 *
 * -----------------------------------------------------------------------------
 * @param {object} nonce
 * @param {number} [now]
 *
 * @returns {number}
 */

function getRemainingNonceTtlSeconds(
  nonce,
  now = Date.now()
) {

  if (!isValidNonceObject(nonce)) {

    return 0;
  }

  const remainingMs =
    nonce.expiresAt - now;

  return Math.max(
    1,
    Math.ceil(remainingMs / 1000)
  );
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {

  /**
   * Nonce issuance.
   */
  generateNonce,

  /**
   * Defensive helpers.
   */
  isValidNonceObject,
  isNonceExpired,
  getRemainingNonceTtlSeconds,

  /**
   * Constants.
   */
  NONCE_RANDOM_BYTES,
  NONCE_TTL_SECONDS
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */