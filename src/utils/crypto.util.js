/**
 * =============================================================================
 * Attendify Enterprise Cryptographic Utility Module
 * =============================================================================
 *
 * FILE:
 * src/utils/crypto.util.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module implements centralized cryptographic utility functions for the
 * Attendify backend platform.
 *
 * It provides low-level deterministic primitives used by security-sensitive
 * subsystems such as:
 *
 *   ✅ HMAC request signing
 *   ✅ HMAC request verification
 *   ✅ Attendance payload integrity verification
 *   ✅ Nonce generation support
 *   ✅ Replay-protection identifiers
 *   ✅ Deterministic canonicalization
 *   ✅ Timing-safe comparisons
 *
 * -----------------------------------------------------------------------------
 * WHY CENTRALIZED CRYPTO UTILITIES MATTER
 * -----------------------------------------------------------------------------
 *
 * Cryptographic logic must not be duplicated across controllers, services, or
 * middleware.
 *
 * Duplicated cryptographic logic creates:
 *
 *   ❌ Inconsistent canonicalization
 *   ❌ Signature mismatch bugs
 *   ❌ Timing attack risks
 *   ❌ Weak randomness mistakes
 *   ❌ Maintenance complexity
 *   ❌ Security drift
 *
 * Therefore:
 *
 *   All low-level cryptographic operations are centralized here.
 *
 * -----------------------------------------------------------------------------
 * IMPORTANT CRYPTOGRAPHIC RULE
 * -----------------------------------------------------------------------------
 *
 * This module provides primitives.
 *
 * It does NOT decide business policy.
 *
 * For example:
 *
 *   ✅ This module can verify an HMAC signature.
 *   ❌ This module does not decide whether attendance should be accepted.
 *
 * That decision belongs to:
 *
 *   src/security/verifier.service.js
 *
 * -----------------------------------------------------------------------------
 * CANONICALIZATION MODEL
 * -----------------------------------------------------------------------------
 *
 * HMAC signatures require both client and server to sign exactly the same byte
 * representation.
 *
 * JSON object key order is not guaranteed semantically.
 *
 * Therefore Attendify uses deterministic canonicalization:
 *
 *   ✅ Object keys sorted lexicographically
 *   ✅ Array order preserved
 *   ✅ Primitive values serialized using JSON.stringify
 *   ✅ Nested structures canonicalized recursively
 *
 * -----------------------------------------------------------------------------
 * CANONICALIZATION FLOW
 * -----------------------------------------------------------------------------
 *
 *                       JavaScript Object
 *                              │
 *                              ▼
 *                      canonicalize(value)
 *                              │
 *                              ▼
 *                 Deterministic String Output
 *                              │
 *                              ▼
 *                       HMAC-SHA256 Input
 *
 * -----------------------------------------------------------------------------
 * HMAC VERIFICATION FLOW
 * -----------------------------------------------------------------------------
 *
 *                    Incoming Payload + Signature
 *                                │
 *                                ▼
 *                         Canonicalize Payload
 *                                │
 *                                ▼
 *                       Recompute HMAC-SHA256
 *                                │
 *                                ▼
 *                      Timing-Safe Comparison
 *                                │
 *                 ┌──────────────┴──────────────┐
 *                 ▼                             ▼
 *              Match                         Mismatch
 *                 │                             │
 *                 ▼                             ▼
 *             Valid                         Invalid
 *
 * -----------------------------------------------------------------------------
 * SECURITY DESIGN PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Cryptographic verification must be deterministic, centralized, and
 *    timing-safe."
 *
 * =============================================================================
 */

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

const crypto = require("crypto");

/* =============================================================================
 * GLOBAL CRYPTOGRAPHIC CONSTANTS
 * =============================================================================
 */

const HMAC_ALGORITHM =
  "sha256";

const DEFAULT_RANDOM_BYTES =
  32;

/* =============================================================================
 * INPUT VALIDATION HELPERS
 * =============================================================================
 */

/**
 * assertSecret()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Validates cryptographic secret input.
 *
 * -----------------------------------------------------------------------------
 * @param {string} secret
 */

function assertSecret(secret) {

  if (
    typeof secret !== "string" ||
    secret.length === 0
  ) {

    throw new Error(
      "Cryptographic secret must be a non-empty string"
    );
  }
}

/**
 * assertSignature()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Validates incoming signature input.
 *
 * -----------------------------------------------------------------------------
 * @param {string} signature
 */

function assertSignature(signature) {

  if (
    typeof signature !== "string" ||
    signature.length === 0
  ) {

    throw new Error(
      "Signature must be a non-empty string"
    );
  }
}

/* =============================================================================
 * DETERMINISTIC JSON CANONICALIZATION
 * =============================================================================
 */

/**
 * canonicalize()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Converts any JSON-compatible value into a deterministic string representation.
 *
 * -----------------------------------------------------------------------------
 * RULES:
 * -----------------------------------------------------------------------------
 *
 *   ✅ null is serialized as "null"
 *   ✅ primitive values use JSON.stringify
 *   ✅ arrays preserve order
 *   ✅ object keys are sorted lexicographically
 *   ✅ nested values are canonicalized recursively
 *
 * -----------------------------------------------------------------------------
 * @param {*} value
 *
 * @returns {string}
 */

function canonicalize(value) {

  if (
    value === null ||
    typeof value !== "object"
  ) {

    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {

    return `[${value
      .map(item => canonicalize(item))
      .join(",")}]`;
  }

  const keys =
    Object.keys(value).sort();

  return `{${keys
    .map(key => {

      const canonicalKey =
        JSON.stringify(key);

      const canonicalValue =
        canonicalize(value[key]);

      return `${canonicalKey}:${canonicalValue}`;
    })
    .join(",")}}`;
}

/* =============================================================================
 * HASHING UTILITIES
 * =============================================================================
 */

/**
 * sha256Hex()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Produces a SHA-256 hash in hexadecimal encoding.
 *
 * -----------------------------------------------------------------------------
 * @param {string|Buffer} input
 *
 * @returns {string}
 */

function sha256Hex(input) {

  return crypto
    .createHash("sha256")
    .update(input)
    .digest("hex");
}

/* =============================================================================
 * RANDOMNESS UTILITIES
 * =============================================================================
 */

/**
 * randomHex()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Generates cryptographically secure random hexadecimal strings.
 *
 * Default:
 *
 *   32 bytes = 64 hex characters
 *
 * -----------------------------------------------------------------------------
 * @param {number} bytes
 *
 * @returns {string}
 */

function randomHex(bytes = DEFAULT_RANDOM_BYTES) {

  if (
    !Number.isInteger(bytes) ||
    bytes <= 0
  ) {

    throw new Error(
      "Random byte length must be a positive integer"
    );
  }

  return crypto
    .randomBytes(bytes)
    .toString("hex");
}

/* =============================================================================
 * HMAC SIGNING
 * =============================================================================
 */

/**
 * signHmacSha256()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Signs a string using HMAC-SHA256.
 *
 * -----------------------------------------------------------------------------
 * @param {string} data
 * @param {string} secret
 *
 * @returns {string}
 */

function signHmacSha256(
  data,
  secret
) {

  assertSecret(secret);

  if (typeof data !== "string") {

    throw new Error(
      "HMAC input data must be a string"
    );
  }

  return crypto
    .createHmac(
      HMAC_ALGORITHM,
      secret
    )
    .update(data)
    .digest("hex");
}

/**
 * signPayload()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Canonicalizes and signs a JSON-compatible payload using HMAC-SHA256.
 *
 * -----------------------------------------------------------------------------
 * @param {*} payload
 * @param {string} secret
 *
 * @returns {string}
 */

function signPayload(
  payload,
  secret
) {

  const canonicalPayload =
    canonicalize(payload);

  return signHmacSha256(
    canonicalPayload,
    secret
  );
}

/* =============================================================================
 * TIMING-SAFE COMPARISON
 * =============================================================================
 */

/**
 * timingSafeEqualHex()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Compares hexadecimal strings using timing-safe comparison.
 *
 * -----------------------------------------------------------------------------
 * IMPORTANT:
 * -----------------------------------------------------------------------------
 *
 * crypto.timingSafeEqual requires equal buffer lengths.
 *
 * This function safely returns false when lengths differ.
 *
 * -----------------------------------------------------------------------------
 * @param {string} left
 * @param {string} right
 *
 * @returns {boolean}
 */

function timingSafeEqualHex(
  left,
  right
) {

  if (
    typeof left !== "string" ||
    typeof right !== "string"
  ) {

    return false;
  }

  const leftBuffer =
    Buffer.from(left, "hex");

  const rightBuffer =
    Buffer.from(right, "hex");

  if (
    leftBuffer.length !== rightBuffer.length
  ) {

    return false;
  }

  return crypto.timingSafeEqual(
    leftBuffer,
    rightBuffer
  );
}

/* =============================================================================
 * HMAC VERIFICATION
 * =============================================================================
 */

/**
 * verifyHmacSha256()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Verifies whether a provided HMAC signature matches a string input.
 *
 * -----------------------------------------------------------------------------
 * @param {string} data
 * @param {string} providedSignature
 * @param {string} secret
 *
 * @returns {boolean}
 */

function verifyHmacSha256(
  data,
  providedSignature,
  secret
) {

  assertSignature(providedSignature);

  const expectedSignature =
    signHmacSha256(
      data,
      secret
    );

  return timingSafeEqualHex(
    expectedSignature,
    providedSignature
  );
}

/**
 * verifyPayloadSignature()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Canonicalizes a payload and verifies the provided HMAC-SHA256 signature.
 *
 * -----------------------------------------------------------------------------
 * @param {*} payload
 * @param {string} providedSignature
 * @param {string} secret
 *
 * @returns {boolean}
 */

function verifyPayloadSignature(
  payload,
  providedSignature,
  secret
) {

  assertSignature(providedSignature);

  const canonicalPayload =
    canonicalize(payload);

  return verifyHmacSha256(
    canonicalPayload,
    providedSignature,
    secret
  );
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {

  /**
   * Constants.
   */
  HMAC_ALGORITHM,
  DEFAULT_RANDOM_BYTES,

  /**
   * Canonicalization.
   */
  canonicalize,

  /**
   * Hashing.
   */
  sha256Hex,

  /**
   * Secure randomness.
   */
  randomHex,

  /**
   * HMAC signing.
   */
  signHmacSha256,
  signPayload,

  /**
   * Timing-safe comparison.
   */
  timingSafeEqualHex,

  /**
   * HMAC verification.
   */
  verifyHmacSha256,
  verifyPayloadSignature
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 *
 * FINAL ENGINEERING SUMMARY
 * -----------------------------------------------------------------------------
 *
 * This module establishes:
 *
 *   ✅ Deterministic JSON canonicalization
 *   ✅ HMAC-SHA256 signing
 *   ✅ HMAC-SHA256 verification
 *   ✅ Timing-safe hexadecimal comparison
 *   ✅ Cryptographically secure random generation
 *   ✅ SHA-256 hashing utilities
 *   ✅ Centralized cryptographic primitives
 *
 * -----------------------------------------------------------------------------
 * CORE PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Cryptographic operations must be deterministic, centralized, and
 *    timing-safe."
 *
 * =============================================================================
 */