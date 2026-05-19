/**
 * =============================================================================
 * Attendify Enterprise Verification Orchestration Service
 * =============================================================================
 *
 * FILE:
 * src/security/verifier.service.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module implements the centralized cryptographic verification authority
 * for the Attendify backend security infrastructure.
 *
 * In enterprise-grade zero-trust systems, verification is NOT considered a
 * helper utility.
 *
 * Verification represents:
 *
 *   ✅ Trust establishment
 *   ✅ Cryptographic authenticity enforcement
 *   ✅ Replay resistance
 *   ✅ Integrity validation
 *   ✅ Tamper detection
 *   ✅ Freshness enforcement
 *   ✅ Distributed consistency
 *   ✅ Security policy orchestration
 *   ✅ Evidence admissibility control
 *
 * -----------------------------------------------------------------------------
 * WHAT THIS MODULE PROTECTS
 * -----------------------------------------------------------------------------
 *
 * This service protects the Attendify platform against:
 *
 *   ✅ Replay attacks
 *   ✅ Payload tampering
 *   ✅ Forged attendance submissions
 *   ✅ Delayed request abuse
 *   ✅ Signature manipulation
 *   ✅ Distributed replay bypass attempts
 *   ✅ Nonce reuse attacks
 *   ✅ Canonicalization inconsistencies
 *
 * -----------------------------------------------------------------------------
 * WHY CENTRALIZED VERIFICATION MATTERS
 * -----------------------------------------------------------------------------
 *
 * Cryptographic verification logic should NEVER be fragmented across:
 *
 *   ❌ Controllers
 *   ❌ Middleware duplication
 *   ❌ Utility scattering
 *   ❌ Route-level ad-hoc validation
 *
 * WHY?
 *
 * Fragmented verification causes:
 *
 *   ❌ Inconsistent security behavior
 *   ❌ Replay vulnerabilities
 *   ❌ Verification drift
 *   ❌ Operational instability
 *   ❌ Audit inconsistency
 *   ❌ Security regression risk
 *
 * Therefore:
 *
 *   Verification must remain centralized.
 *
 * -----------------------------------------------------------------------------
 * ATTENDIFY ZERO-TRUST MODEL
 * -----------------------------------------------------------------------------
 *
 * Every incoming request is initially treated as:
 *
 *   ❌ Untrusted
 *   ❌ Potentially replayed
 *   ❌ Potentially forged
 *   ❌ Potentially modified
 *   ❌ Potentially delayed
 *   ❌ Potentially malicious
 *
 * Trust is established ONLY after:
 *
 *   ✅ Structural validation
 *   ✅ Freshness validation
 *   ✅ Canonicalization
 *   ✅ Signature verification
 *   ✅ Atomic replay enforcement
 *
 * -----------------------------------------------------------------------------
 * HIGH-LEVEL VERIFICATION ARCHITECTURE
 * -----------------------------------------------------------------------------
 *
 *                    Client Device
 *                           │
 *                           ▼
 *                  Generate Attendance
 *                           │
 *                           ▼
 *                     Attach Nonce
 *                           │
 *                           ▼
 *                  Canonicalize Payload
 *                           │
 *                           ▼
 *                    Generate Signature
 *                           │
 *                           ▼
 *                      Submit Request
 *                           │
 *                           ▼
 *                Verification Service
 *                    (THIS FILE)
 *                           │
 *      ┌────────────────────┴────────────────────┐
 *      ▼                                         ▼
 * Verification Failed                   Verification Passed
 *      │                                         │
 *      ▼                                         ▼
 * Reject Request                         Accept Evidence
 *
 * -----------------------------------------------------------------------------
 * ENTERPRISE SECURITY GUARANTEES
 * -----------------------------------------------------------------------------
 *
 * This module establishes:
 *
 * -----------------------------------------------------------------------------
 * 1. AUTHENTICITY
 * -----------------------------------------------------------------------------
 *
 * Proof that:
 *
 *   Request originated from trusted cryptographic entity.
 *
 * -----------------------------------------------------------------------------
 * 2. INTEGRITY
 * -----------------------------------------------------------------------------
 *
 * Proof that:
 *
 *   Payload was not modified after signing.
 *
 * -----------------------------------------------------------------------------
 * 3. FRESHNESS
 * -----------------------------------------------------------------------------
 *
 * Proof that:
 *
 *   Request remains within allowed temporal validity window.
 *
 * -----------------------------------------------------------------------------
 * 4. REPLAY RESISTANCE
 * -----------------------------------------------------------------------------
 *
 * Proof that:
 *
 *   Request cannot be accepted more than once.
 *
 * -----------------------------------------------------------------------------
 * 5. DETERMINISTIC VERIFICATION
 * -----------------------------------------------------------------------------
 *
 * Proof that:
 *
 *   Verification produces identical outcomes for identical inputs.
 *
 * -----------------------------------------------------------------------------
 * WHY CANONICALIZATION IS CRITICAL
 * -----------------------------------------------------------------------------
 *
 * Cryptographic signatures depend entirely on deterministic payload
 * representation.
 *
 * Example:
 *
 *   {
 *     "lat": 25.2
 *   }
 *
 * versus:
 *
 *   {
 *     "lat": "25.2"
 *   }
 *
 * Human interpretation:
 *
 *   Similar
 *
 * Cryptographic interpretation:
 *
 *   Completely different payloads
 *
 * Therefore canonicalization guarantees:
 *
 *   ✅ Stable field ordering
 *   ✅ Stable serialization
 *   ✅ Stable hashing
 *   ✅ Stable signatures
 *   ✅ Cross-platform consistency
 *
 * -----------------------------------------------------------------------------
 * REPLAY ATTACK MODEL
 * -----------------------------------------------------------------------------
 *
 * Example attack scenario:
 *
 *   1. Legitimate attendance request submitted
 *   2. Attacker captures request
 *   3. Attacker replays identical payload later
 *
 * Without replay protection:
 *
 *   ❌ Duplicate attendance accepted
 *   ❌ Fraud becomes possible
 *   ❌ Evidence integrity collapses
 *
 * Attendify prevents this using:
 *
 *   ✅ Nonces
 *   ✅ TTL enforcement
 *   ✅ Redis atomic replay storage
 *   ✅ Distributed replay coordination
 *
 * -----------------------------------------------------------------------------
 * IMPORTANT SECURITY ORDERING
 * -----------------------------------------------------------------------------
 *
 * VERIFICATION ORDER IS CRITICAL.
 *
 * Specifically:
 *
 *   Signature verification MUST occur BEFORE replay insertion.
 *
 * WHY?
 *
 * Otherwise attackers could:
 *
 *   ✅ Poison replay infrastructure
 *   ✅ Saturate Redis memory
 *   ✅ Trigger denial-of-service amplification
 *   ✅ Store invalid attacker-controlled requests
 *
 * Therefore:
 *
 *   Verify authenticity FIRST
 *   →
 *   Persist replay state SECOND
 *
 * -----------------------------------------------------------------------------
 * DISTRIBUTED REPLAY MODEL
 * -----------------------------------------------------------------------------
 *
 * Attendify uses Redis-based replay enforcement.
 *
 * WHY REDIS?
 *
 * Because replay protection must remain:
 *
 *   ✅ Distributed
 *   ✅ Atomic
 *   ✅ Horizontally scalable
 *   ✅ Multi-instance consistent
 *
 * -----------------------------------------------------------------------------
 * RACE CONDITION PROBLEM
 * -----------------------------------------------------------------------------
 *
 * Non-atomic replay systems may fail like this:
 *
 *   Request A checks nonce
 *   Request B checks nonce
 *
 *   Both see:
 *     "unused"
 *
 * RESULT:
 *
 *   Replay accepted twice
 *
 * Redis atomic SET NX prevents this.
 *
 * -----------------------------------------------------------------------------
 * FAIL-SAFE SECURITY PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 * IMPORTANT:
 *
 * Verification systems must default to:
 *
 *   REJECT
 *
 * NEVER:
 *
 *   ACCEPT
 *
 * Therefore:
 *
 *   Any uncertainty
 *   =
 *   Verification failure
 *
 * -----------------------------------------------------------------------------
 * SECURITY DESIGN PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Trust must be cryptographically proven, never operationally assumed."
 *
 * =============================================================================
 */

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

/**
 * Cryptographic utilities.
 *
 * Provides:
 *
 *   ✅ Canonical deterministic serialization
 *   ✅ Cryptographic signature verification
 */
const {
  verifySignature,
  canonicalize
} = require("../utils/crypto.util");

/**
 * Nonce validation infrastructure.
 *
 * Provides:
 *
 *   ✅ Freshness validation
 *   ✅ Timestamp enforcement
 *   ✅ Expiration protection
 */
const {
  isNonceValid,
  NONCE_TTL
} = require("./nonce.service");

/**
 * Distributed Redis replay infrastructure.
 *
 * SECURITY IMPORTANCE:
 * -----------------------------------------------------------------------------
 *
 * Guarantees:
 *
 *   ✅ Atomic replay enforcement
 *   ✅ Cross-instance consistency
 *   ✅ Distributed replay resistance
 *   ✅ Race-condition mitigation
 */
const replayStore = require(
  "./replay/redis-replay.store"
);

/**
 * Structured operational logging.
 */
const logger = require(
  "../infrastructure/logging/logger"
);

/**
 * Security audit infrastructure.
 */
const {
  auditLogger,
  AUDIT_EVENTS
} = require(
  "../observability/audit.logger"
);

/**
 * Request correlation infrastructure.
 */
const {
  getRequestId
} = require(
  "../observability/request-context"
);

/* =============================================================================
 * VERIFICATION ERROR TAXONOMY
 * =============================================================================
 *
 * Enterprise systems should expose:
 *
 *   ✅ Deterministic
 *   ✅ Machine-readable
 *   ✅ Stable
 *   ✅ Observable
 *
 * error semantics.
 */

const ERROR_CODES = Object.freeze({

  INVALID_PAYLOAD:
    "INVALID_PAYLOAD",

  MISSING_SIGNATURE:
    "MISSING_SIGNATURE",

  INVALID_SECRET:
    "INVALID_SECRET",

  INVALID_NONCE:
    "INVALID_NONCE",

  EXPIRED_NONCE:
    "EXPIRED_NONCE",

  INVALID_SIGNATURE:
    "INVALID_SIGNATURE",

  REPLAY_DETECTED:
    "REPLAY_DETECTED",

  CANONICALIZATION_FAILED:
    "CANONICALIZATION_FAILED",

  REPLAY_STORE_FAILURE:
    "REPLAY_STORE_FAILURE",

  INTERNAL_ERROR:
    "INTERNAL_ERROR"
});

/* =============================================================================
 * MAIN VERIFICATION ENGINE
 * =============================================================================
 */

/**
 * verifyRequest()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Performs complete cryptographic verification orchestration for incoming
 * attendance evidence requests.
 *
 * -----------------------------------------------------------------------------
 * COMPLETE VERIFICATION PIPELINE
 * -----------------------------------------------------------------------------
 *
 *   STEP 1:
 *     Structural validation
 *
 *   STEP 2:
 *     Nonce extraction
 *
 *   STEP 3:
 *     Freshness verification
 *
 *   STEP 4:
 *     Payload canonicalization
 *
 *   STEP 5:
 *     Signature verification
 *
 *   STEP 6:
 *     Atomic replay enforcement
 *
 *   STEP 7:
 *     Trust establishment
 *
 * -----------------------------------------------------------------------------
 * FULL EXECUTION FLOW
 * -----------------------------------------------------------------------------
 *
 *                     Incoming Request
 *                              │
 *                              ▼
 *                    Structural Validation
 *                              │
 *                              ▼
 *                      Nonce Validation
 *                              │
 *                              ▼
 *                     Freshness Validation
 *                              │
 *                              ▼
 *                      Canonicalization
 *                              │
 *                              ▼
 *                    Signature Verification
 *                              │
 *                 ┌────────────┴────────────┐
 *                 ▼                         ▼
 *          Invalid Signature        Valid Signature
 *                 │                         │
 *                 ▼                         ▼
 *           Reject Request         Atomic Replay Check
 *                                            │
 *                               ┌────────────┴────────────┐
 *                               ▼                         ▼
 *                        Replay Detected          Fresh Request
 *                               │                         │
 *                               ▼                         ▼
 *                        Reject Request          Accept Evidence
 *
 * -----------------------------------------------------------------------------
 * @param {object} payload
 *
 * Attendance evidence payload.
 *
 * -----------------------------------------------------------------------------
 * @param {string} signature
 *
 * Client-supplied HMAC signature.
 *
 * -----------------------------------------------------------------------------
 * @param {string} secret
 *
 * Shared cryptographic verification secret.
 *
 * -----------------------------------------------------------------------------
 * @returns {Promise<object>}
 *
 * SUCCESS:
 *
 * {
 *   ok: true
 * }
 *
 * FAILURE:
 *
 * {
 *   ok: false,
 *   code,
 *   error
 * }
 */
async function verifyRequest(
  payload,
  signature,
  secret
) {

  /**
   * Distributed request correlation identifier.
   */
  const requestId =
    getRequestId();

  try {

    /* =========================================================================
     * STEP 1 — STRUCTURAL PAYLOAD VALIDATION
     * =========================================================================
     *
     * SECURITY GOAL:
     * ----------------------------------------------------------------------------
     *
     * Reject malformed requests BEFORE expensive cryptographic operations.
     *
     * BENEFITS:
     *
     *   ✅ CPU preservation
     *   ✅ Infrastructure protection
     *   ✅ Attack-surface reduction
     *   ✅ Fail-fast security behavior
     */

    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {

      return fail(
        ERROR_CODES.INVALID_PAYLOAD,
        "Payload must be a valid object"
      );
    }

    if (
      !signature ||
      typeof signature !== "string"
    ) {

      return fail(
        ERROR_CODES.MISSING_SIGNATURE,
        "Missing cryptographic signature"
      );
    }

    if (
      !secret ||
      typeof secret !== "string"
    ) {

      /**
       * SECURITY NOTE:
       * ----------------------------------------------------------------------------
       *
       * Missing secrets indicate:
       *
       *   Critical infrastructure misconfiguration
       */

      logger.error(
        "VERIFICATION_SECRET_MISSING",

        {
          requestId
        }
      );

      return fail(
        ERROR_CODES.INVALID_SECRET,
        "Verification infrastructure unavailable"
      );
    }

    /* =========================================================================
     * STEP 2 — NONCE EXTRACTION
     * =========================================================================
     *
     * NONCE ROLE:
     * ----------------------------------------------------------------------------
     *
     * Nonces establish:
     *
     *   ✅ Freshness
     *   ✅ Single-use semantics
     *   ✅ Replay resistance
     */

    const {
      nonce
    } = payload;

    if (
      !nonce ||
      typeof nonce !== "object"
    ) {

      return fail(
        ERROR_CODES.INVALID_NONCE,
        "Missing nonce object"
      );
    }

    if (
      !nonce.value ||
      typeof nonce.value !== "string"
    ) {

      return fail(
        ERROR_CODES.INVALID_NONCE,
        "Invalid nonce value"
      );
    }

    /**
     * Defensive nonce normalization.
     */
    nonce.value =
      nonce.value.trim();

    if (!nonce.value) {

      return fail(
        ERROR_CODES.INVALID_NONCE,
        "Nonce value cannot be empty"
      );
    }

    /* =========================================================================
     * STEP 3 — NONCE FRESHNESS VALIDATION
     * =========================================================================
     *
     * SECURITY GOAL:
     * ----------------------------------------------------------------------------
     *
     * Reject expired or stale requests.
     *
     * WHY?
     *
     * Delayed requests may indicate:
     *
     *   ✅ Replay attempts
     *   ✅ Captured traffic reuse
     *   ✅ Clock anomalies
     *   ✅ Delayed attack execution
     */

    const nonceIsValid =
      isNonceValid(nonce);

    if (!nonceIsValid) {

      auditLogger.log({

        event:
          AUDIT_EVENTS.REPLAY_ATTACK_DETECTED,

        requestId,

        action:
          "NONCE_FRESHNESS_VALIDATION",

        outcome:
          "failure",

        metadata: {

          reason:
            "expired_or_invalid_nonce"
        }
      });

      return fail(
        ERROR_CODES.EXPIRED_NONCE,
        "Nonce expired or invalid"
      );
    }

    /* =========================================================================
     * STEP 4 — PAYLOAD CANONICALIZATION
     * =========================================================================
     *
     * SECURITY GOAL:
     * ----------------------------------------------------------------------------
     *
     * Generate deterministic cryptographic representation.
     *
     * IMPORTANT:
     * ----------------------------------------------------------------------------
     *
     * Signature fields themselves must NEVER participate in signed payloads.
     *
     * Otherwise:
     *
     *   Circular signature dependency occurs.
     */

    const cleanPayload = {

      ...payload
    };

    /**
     * Defensive cleanup.
     */
    delete cleanPayload.signature;

    let canonicalPayload;

    try {

      canonicalPayload =
        canonicalize(cleanPayload);

    } catch (error) {

      logger.error(
        "PAYLOAD_CANONICALIZATION_FAILED",

        {
          requestId,
          error:
            error.message
        }
      );

      return fail(
        ERROR_CODES.CANONICALIZATION_FAILED,
        "Payload canonicalization failed"
      );
    }

    /* =========================================================================
     * STEP 5 — CRYPTOGRAPHIC SIGNATURE VERIFICATION
     * =========================================================================
     *
     * SECURITY GUARANTEES:
     * ----------------------------------------------------------------------------
     *
     * Successful verification proves:
     *
     *   ✅ Payload integrity
     *   ✅ Trusted signer authenticity
     *   ✅ Shared-secret correctness
     *   ✅ Tamper resistance
     */

    const signatureIsValid =
      verifySignature(
        canonicalPayload,
        signature,
        secret
      );

    if (!signatureIsValid) {

      auditLogger.log({

        event:
          AUDIT_EVENTS.SIGNATURE_VERIFICATION_FAILED,

        requestId,

        action:
          "CRYPTOGRAPHIC_SIGNATURE_VERIFICATION",

        outcome:
          "failure",

        metadata: {

          nonce:
            nonce.value
        }
      });

      logger.warn(
        "SIGNATURE_VERIFICATION_FAILED",

        {
          requestId
        }
      );

      return fail(
        ERROR_CODES.INVALID_SIGNATURE,
        "Cryptographic signature verification failed"
      );
    }

    /* =========================================================================
     * STEP 6 — ATOMIC DISTRIBUTED REPLAY ENFORCEMENT
     * =========================================================================
     *
     * SECURITY-CRITICAL OPERATION
     * ----------------------------------------------------------------------------
     *
     * Replay enforcement MUST remain:
     *
     *   ✅ Atomic
     *   ✅ Distributed
     *   ✅ Race-condition resistant
     *
     * ----------------------------------------------------------------------------
     * REDIS GUARANTEE
     * ----------------------------------------------------------------------------
     *
     * SET NX EX:
     *
     *   ✅ Insert only if absent
     *   ✅ Apply expiration atomically
     *   ✅ Prevent concurrent replay acceptance
     */

    let replayAccepted;

    try {

      replayAccepted =
        await replayStore
          .setIfNotExists(

            nonce.value,
            NONCE_TTL
          );

    } catch (error) {

      logger.error(
        "REPLAY_STORE_FAILURE",

        {
          requestId,
          error:
            error.message
        }
      );

      /**
       * FAIL-SAFE SECURITY MODEL:
       *
       * Replay infrastructure uncertainty
       * =
       * request rejection
       */

      return fail(
        ERROR_CODES.REPLAY_STORE_FAILURE,
        "Replay infrastructure unavailable"
      );
    }

    if (!replayAccepted) {

      auditLogger.replayAttack({

        requestId,

        action:
          "ATOMIC_REPLAY_ENFORCEMENT",

        metadata: {

          nonce:
            nonce.value
        }
      });

      logger.warn(
        "REPLAY_ATTACK_DETECTED",

        {
          requestId,
          nonce:
            nonce.value
        }
      );

      return fail(
        ERROR_CODES.REPLAY_DETECTED,
        "Replay attack detected"
      );
    }

    /* =========================================================================
     * STEP 7 — TRUST ESTABLISHMENT SUCCESS
     * =========================================================================
     *
     * SUCCESS GUARANTEES:
     * ----------------------------------------------------------------------------
     *
     * At this stage:
     *
     *   ✅ Payload structure is valid
     *   ✅ Nonce freshness is valid
     *   ✅ Canonicalization succeeded
     *   ✅ Signature authenticity verified
     *   ✅ Integrity preserved
     *   ✅ Replay protection succeeded
     *
     * Therefore:
     *
     *   Request may now be trusted.
     */

    logger.info(
      "REQUEST_VERIFICATION_SUCCEEDED",

      {
        requestId
      }
    );

    return {

      ok: true
    };

  } catch (error) {

    /* =========================================================================
     * FAIL-SAFE SECURITY HANDLING
     * =========================================================================
     *
     * SECURITY PRINCIPLE:
     * ----------------------------------------------------------------------------
     *
     * Any unexpected verification uncertainty must result in:
     *
     *   REJECTION
     *
     * NEVER:
     *
     *   Silent acceptance
     */

    logger.error(
      "UNEXPECTED_VERIFICATION_FAILURE",

      {
        requestId,
        error:
          error.message
      }
    );

    return fail(
      ERROR_CODES.INTERNAL_ERROR,
      "Verification process failed"
    );
  }
}

/* =============================================================================
 * FAILURE RESPONSE FACTORY
 * =============================================================================
 */

/**
 * fail()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Produces deterministic structured verification failures.
 *
 * ENTERPRISE BENEFITS:
 *
 *   ✅ Stable API contracts
 *   ✅ Better observability
 *   ✅ Easier incident analysis
 *   ✅ Deterministic SDK behavior
 *   ✅ Machine-readable integrations
 *
 * -----------------------------------------------------------------------------
 * FAILURE MODEL
 * -----------------------------------------------------------------------------
 *
 * {
 *   ok: false,
 *   code,
 *   error
 * }
 *
 * -----------------------------------------------------------------------------
 * @param {string} code
 *
 * Machine-readable error identifier.
 *
 * -----------------------------------------------------------------------------
 * @param {string} message
 *
 * Human-readable explanation.
 *
 * -----------------------------------------------------------------------------
 * @returns {object}
 */
function fail(
  code,
  message
) {

  return {

    /**
     * High-level verification outcome.
     */
    ok: false,

    /**
     * Stable machine-readable error code.
     */
    code,

    /**
     * Human-readable explanation.
     */
    error: message
  };
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {

  /**
   * Main verification orchestration engine.
   */
  verifyRequest,

  /**
   * Exported deterministic error taxonomy.
   */
  ERROR_CODES
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
 *   ✅ Centralized enterprise cryptographic verification
 *   ✅ Deterministic trust establishment
 *   ✅ Distributed atomic replay resistance
 *   ✅ Canonical signature verification
 *   ✅ Tamper-resistant payload validation
 *   ✅ Fail-safe rejection semantics
 *   ✅ Zero-trust verification orchestration
 *   ✅ Replay-safe distributed infrastructure
 *   ✅ Structured observability integration
 *   ✅ Audit-aware security enforcement
 *
 * -----------------------------------------------------------------------------
 * CORE SECURITY PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Evidence becomes trusted only after deterministic cryptographic proof and
 *    distributed replay-safe validation."
 *
 * =============================================================================
 */