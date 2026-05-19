/**
 * =============================================================================
 * Attendify Authentication Validation Schemas
 * =============================================================================
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module defines the formal request validation contracts for authentication
 * endpoints.
 *
 * It enforces strong input validation at the system boundary, ensuring that:
 *
 *   ✅ Only well-formed inputs reach authentication logic
 *   ✅ Invalid or malicious inputs are rejected early
 *   ✅ API behavior is deterministic and contract-driven
 *
 * -----------------------------------------------------------------------------
 * ZERO-TRUST INPUT MODEL
 * -----------------------------------------------------------------------------
 *
 * All incoming requests are considered:
 *
 *   ❌ Untrusted
 *   ❌ Potentially malformed
 *   ❌ Potentially malicious
 *
 * Therefore:
 *
 *   Validation is mandatory before business logic execution.
 *
 * -----------------------------------------------------------------------------
 * VALIDATION FLOW
 * -----------------------------------------------------------------------------
 *
 *             Client Request (JSON Payload)
 *                        │
 *                        ▼
 *                Zod Schema Parsing
 *                        │
 *        ┌───────────────┴───────────────┐
 *        ▼                               ▼
 *     Valid                         Invalid
 *        │                               │
 *        ▼                               ▼
 *  Normalized Data             Structured Error Output
 *        │
 *        ▼
 *  Controller / Service
 *
 * -----------------------------------------------------------------------------
 * SECURITY PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Input validation is the first line of defense in secure systems."
 *
 * =============================================================================
 */

const { z } = require("zod");

/* =============================================================================
 * BASE PRIMITIVES
 * =============================================================================
 */

/**
 * Email Schema
 * -----------------------------------------------------------------------------
 *
 * Transforms and validates email input.
 *
 * Guarantees:
 *   ✅ Lowercase normalization
 *   ✅ Whitespace trimming
 *   ✅ RFC-compatible email structure
 */

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email format");

/**
 * Password Schema
 * -----------------------------------------------------------------------------
 *
 * Enforces password constraints.
 *
 * SECURITY RATIONALE:
 * -----------------------------------------------------------------------------
 *
 * Minimum length:
 *   Prevent trivial brute-force
 *
 * Maximum length:
 *   Prevent DoS via extremely large payloads
 */

const passwordSchema = z
  .string()
  .min(8, "Password must contain at least 8 characters")
  .max(128, "Password must not exceed 128 characters");

/**
 * Name Schema
 * -----------------------------------------------------------------------------
 *
 * Human-readable identifier.
 */

const nameSchema = z
  .string()
  .trim()
  .min(2, "Name is too short")
  .max(100, "Name is too long");

/* =============================================================================
 * REGISTER SCHEMA
 * =============================================================================
 *
 * Used for:
 *   POST /auth/register
 */

const registerSchema = z.object({

  email: emailSchema,

  password: passwordSchema,

  name: nameSchema

});

/* =============================================================================
 * LOGIN SCHEMA
 * =============================================================================
 *
 * Used for:
 *   POST /auth/login
 */

const loginSchema = z.object({

  email: emailSchema,

  password: passwordSchema

});

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {

  registerSchema,

  loginSchema

};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */