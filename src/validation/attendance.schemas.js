/**
 * =============================================================================
 * Attendify Attendance Validation Schemas
 * =============================================================================
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * Defines strict validation rules for attendance submission payload.
 *
 * This is a SECURITY-CRITICAL STRUCTURE.
 *
 * -----------------------------------------------------------------------------
 * ATTENDANCE FLOW
 * -----------------------------------------------------------------------------
 *
 *      Mobile/Client Device
 *              │
 *              ▼
 *        Construct Payload
 *              │
 *              ▼
 *      Sign Payload (HMAC)
 *              │
 *              ▼
 *        Send to Backend
 *              │
 *              ▼
 *        Validate Schema (HERE)
 *              │
 *              ▼
 *        Verify Signature
 *              │
 *              ▼
 *        Replay Protection
 *              │
 *              ▼
 *        Store Result
 *
 * -----------------------------------------------------------------------------
 * SECURITY GUARANTEES
 * -----------------------------------------------------------------------------
 *
 * Validation ensures:
 *
 *   ✅ Required fields present
 *   ✅ Strong typing
 *   ✅ Geographical sanity checks
 *   ✅ Nonce presence
 *   ✅ Signature existence
 *
 * =============================================================================
 */

const { z } = require("zod");

/* =============================================================================
 * TIMESTAMP
 * =============================================================================
 *
 * Unix timestamp (milliseconds).
 */

const timestampSchema = z
  .number()
  .int("Timestamp must be an integer")
  .positive("Timestamp must be positive");

/* =============================================================================
 * GEO LOCATION
 * =============================================================================
 *
 * Latitude/Longitude constraints.
 */

const locationSchema = z.object({

  lat: z
    .number()
    .min(-90, "Invalid latitude")
    .max(90, "Invalid latitude"),

  lng: z
    .number()
    .min(-180, "Invalid longitude")
    .max(180, "Invalid longitude")

});

/* =============================================================================
 * SIGNATURE
 * =============================================================================
 *
 * HMAC SHA256 hex format.
 */

const signatureSchema = z
  .string()
  .min(64)
  .max(128)
  .regex(/^[a-f0-9]+$/i, "Signature must be hexadecimal");

/* =============================================================================
 * NONCE
 * =============================================================================
 */

const nonceSchema = z
  .string()
  .length(64);

/* =============================================================================
 * MAIN SCHEMA
 * =============================================================================
 *
 * This enforces full structure correctness before verification layer.
 */

const attendancePayloadSchema = z.object({

  nonce: nonceSchema,

  timestamp: timestampSchema,

  location: locationSchema,

  signature: signatureSchema

});

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {

  attendancePayloadSchema

};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */