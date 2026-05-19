/**
 * =============================================================================
 * Attendify — Evidence Validation Schema (Enterprise-Grade)
 * =============================================================================
 *
 * FILE:
 *   src/validation/evidence.schemas.js
 *
 * =============================================================================
 * 🎯 PURPOSE (FORMAL ACADEMIC DEFINITION)
 * =============================================================================
 *
 * This module defines a **strict structural validation boundary** for incoming
 * forensic evidence payloads.
 *
 * -----------------------------------------------------------------------------
 * 🧠 FORMAL MODEL
 * -----------------------------------------------------------------------------
 *
 * Let:
 *
 *   E = incoming evidence payload
 *   V = validation function
 *
 * Then:
 *
 *   V(E) → { ACCEPT | REJECT }
 *
 * Where:
 *
 *   ACCEPT → structurally safe for processing
 *   REJECT → malformed or unsafe payload
 *
 * -----------------------------------------------------------------------------
 * ⚠️ VALIDATION ≠ VERIFICATION
 * -----------------------------------------------------------------------------
 *
 * This layer:
 *   ✅ validates structure, size, and temporal coherence
 *
 * This layer DOES NOT:
 *   ❌ validate cryptographic signatures
 *   ❌ verify identity authenticity
 *   ❌ validate certificate chains
 *
 * -----------------------------------------------------------------------------
 * 📊 VALIDATION FLOW
 * -----------------------------------------------------------------------------
 *
 *               RAW INPUT
 *                   │
 *                   ▼
 *       ┌─────────────────────────┐
 *       │ Version Validation      │
 *       └────────────┬────────────┘
 *                    ▼
 *       ┌─────────────────────────┐
 *       │ Timestamp (Drift Check) │
 *       └────────────┬────────────┘
 *                    ▼
 *       ┌─────────────────────────┐
 *       │ Evidence Structure      │
 *       └────────────┬────────────┘
 *                    ▼
 *       ┌─────────────────────────┐
 *       │ Metadata Structure      │
 *       └────────────┬────────────┘
 *                    ▼
 *               ACCEPTED
 *
 * =============================================================================
 */

const Joi = require("joi");

/* =============================================================================
 * GLOBAL CONSTRAINTS
 * =============================================================================
 */

/**
 * Maximum allowed payload size (bytes)
 * Protects against memory abuse & DoS
 */
const MAX_PAYLOAD_SIZE = 200 * 1024; // 200KB

/**
 * Acceptable clock drift window (milliseconds)
 *
 * Allows:
 *   - network latency
 *   - device clock skew
 *
 * Rejects:
 *   - replay attacks (old timestamps)
 *   - future timestamp manipulation
 */
const MAX_DRIFT_MS = 5 * 60 * 1000; // ±5 minutes

/**
 * Supported schema versions
 */
const SUPPORTED_VERSIONS = ["v1"];

/* =============================================================================
 * CUSTOM VALIDATORS
 * =============================================================================
 */

/**
 * -----------------------------------------------------------------------------
 * TIMESTAMP VALIDATION (DRIFT CONTROL)
 * -----------------------------------------------------------------------------
 *
 * Ensures:
 *   - timestamp is not too old
 *   - timestamp is not from the future
 *
 * FORMAL MODEL:
 *
 *   now - drift <= timestamp <= now + drift
 */
function validateTimestamp(value, helpers) {

  if (typeof value !== "number") {
    return helpers.error("any.invalid");
  }

  const now = Date.now();

  if (value < now - MAX_DRIFT_MS) {
    return helpers.error("timestamp.tooOld");
  }

  if (value > now + MAX_DRIFT_MS) {
    return helpers.error("timestamp.inFuture");
  }

  return value;
}

/**
 * -----------------------------------------------------------------------------
 * PAYLOAD SIZE VALIDATION
 * -----------------------------------------------------------------------------
 *
 * Prevents oversized payload injection.
 */
function validatePayloadSize(value, helpers) {

  const size = Buffer.byteLength(
    JSON.stringify(value),
    "utf8"
  );

  if (size > MAX_PAYLOAD_SIZE) {
    return helpers.error("payload.tooLarge");
  }

  return value;
}

/* =============================================================================
 * PRIMITIVE TYPES
 * =============================================================================
 */

const objectId = Joi.string().trim().min(1).max(128);

const hashString = Joi.string().trim().min(32).max(128);

const base64String = Joi.string()
  .pattern(/^[A-Za-z0-9+/=]+$/)
  .min(16)
  .max(8192);

/* =============================================================================
 * CORE EVIDENCE STRUCTURE
 * =============================================================================
 *
 * Represents cryptographic proof container.
 */

const evidenceSchema = Joi.object({

  snapshotHash: hashString.required(),

  signature: base64String.required(),

  certificateChain: Joi.array()
    .items(base64String)
    .min(1)
    .max(10)
    .required()

});

/* =============================================================================
 * METADATA (NON-AUTHORITATIVE)
 * =============================================================================
 */

const metadataSchema = Joi.object({

  deviceId: objectId.optional(),

  platform: Joi.string()
    .valid("android", "ios", "web")
    .optional(),

  appVersion: Joi.string()
    .max(32)
    .optional()

}).optional();

/* =============================================================================
 * MAIN SCHEMA — SUBMIT EVIDENCE
 * =============================================================================
 */

const submitEvidenceSchema = Joi.object({

  /**
   * ---------------------------------------------------------------------------
   * VERSIONING (CONTRACT EVOLUTION)
   * ---------------------------------------------------------------------------
   *
   * Enables forward compatibility.
   */
  version: Joi.string()
    .valid(...SUPPORTED_VERSIONS)
    .required(),

  /**
   * ---------------------------------------------------------------------------
   * TIMESTAMP (FOR FORENSIC TEMPORAL VALIDITY)
   * ---------------------------------------------------------------------------
   */
  timestamp: Joi.number()
    .required()
    .custom(validateTimestamp)
    .messages({
      "timestamp.tooOld": "Timestamp too old",
      "timestamp.inFuture": "Timestamp in the future"
    }),

  /**
   * ---------------------------------------------------------------------------
   * COMPANY IDENTIFIER
   * ---------------------------------------------------------------------------
   */
  companyId: objectId.required(),

  /**
   * ---------------------------------------------------------------------------
   * EVIDENCE CORE
   * ---------------------------------------------------------------------------
   */
  evidence: evidenceSchema.required(),

  /**
   * ---------------------------------------------------------------------------
   * OPTIONAL METADATA
   * ---------------------------------------------------------------------------
   */
  metadata: metadataSchema

})
  /**
   * ---------------------------------------------------------------------------
   * SIZE ENFORCEMENT
   * ---------------------------------------------------------------------------
   */
  .custom(validatePayloadSize)
  /**
   * ---------------------------------------------------------------------------
   * SECURITY HARDENING
   * ---------------------------------------------------------------------------
   */
  .options({
    abortEarly: true,
    allowUnknown: false
  });

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  submitEvidenceSchema
};

/**
 * =============================================================================
 * 🏁 END OF FILE
 * =============================================================================
 *
 * =============================================================================
 * 🧠 ACADEMIC INSIGHT
 * =============================================================================
 *
 * This module enforces:
 *
 *   ✅ Structural Integrity
 *   ✅ Temporal Validity (via drift bounds)
 *   ✅ Size Constraints (anti-DoS)
 *   ✅ Explicit API Versioning
 *
 * -----------------------------------------------------------------------------
 * FORMAL GUARANTEES
 * -----------------------------------------------------------------------------
 *
 * ∀ payloads P:
 *
 *   If V(P) = ACCEPT:
 *     → P is safe for transport layer
 *     → P respects temporal constraints
 *
 * -----------------------------------------------------------------------------
 * SYSTEM IMPACT
 * -----------------------------------------------------------------------------
 *
 * This validation layer:
 *
 *   - prevents malformed data propagation
 *   - protects downstream systems
 *   - enforces forensic admissibility constraints
 *
 * -----------------------------------------------------------------------------
 * CRITICAL WARNING
 * -----------------------------------------------------------------------------
 *
 * Removing or weakening this layer results in:
 *
 *   ❗ replay vulnerabilities
 *   ❗ timestamp manipulation
 *   ❗ payload injection risks
 *
 * =============================================================================
 */
