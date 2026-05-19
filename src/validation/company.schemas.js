/**
 * =============================================================================
 * Attendify Company Validation Schemas
 * =============================================================================
 *
 * FILE:
 * src/validation/company.schemas.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module defines formal validation contracts for all company-related
 * operations within the Attendify backend platform.
 *
 * These schemas represent the **authoritative API contract layer** for
 * company domain interactions.
 *
 * -----------------------------------------------------------------------------
 * WHY VALIDATION IS CRITICAL IN THIS LAYER
 * -----------------------------------------------------------------------------
 *
 * In a secure, multi-tenant backend system, company data represents:
 *
 *   ✅ Identity of the tenant (organization)
 *   ✅ Authorization boundary
 *   ✅ Root of all subordinate data (attendance, sessions, etc.)
 *
 * Therefore:
 *
 *   Any corruption, inconsistency, or invalidity at this layer can propagate
 *   system-wide integrity issues.
 *
 * -----------------------------------------------------------------------------
 * ARCHITECTURAL ROLE
 * -----------------------------------------------------------------------------
 *
 * This module sits directly at the **input trust boundary**:
 *
 *                HTTP Request (Untrusted Input)
 *                           │
 *                           ▼
 *               Validation Schemas (THIS MODULE)
 *                           │
 *               ┌───────────┴───────────┐
 *               ▼                       ▼
 *            Valid                   Invalid
 *               │                       │
 *               ▼                       ▼
 *         Business Logic        Rejected Request
 *
 * -----------------------------------------------------------------------------
 * DESIGN PRINCIPLES
 * -----------------------------------------------------------------------------
 *
 * 1. Deterministic contracts
 *    → Same input always produces same validation outcome
 *
 * 2. Explicit constraints
 *    → No implicit assumptions
 *
 * 3. Defensive validation
 *    → Reject malformed / partial / ambiguous input
 *
 * 4. Declarative schema definition
 *    → Improves maintainability and reasoning
 *
 * -----------------------------------------------------------------------------
 * SECURITY DESIGN PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Every incoming object must conform to an explicit structural contract
 *    before entering the domain logic."
 *
 * =============================================================================
 */

const { z } = require("zod");

/* =============================================================================
 * COMPANY IDENTIFIER SCHEMA
 * =============================================================================
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * Represents a company identifier used in:
 *
 *   ✅ route parameters (e.g., /companies/:id)
 *   ✅ internal referencing
 *   ✅ multi-tenant isolation logic
 *
 * -----------------------------------------------------------------------------
 * VALIDATION RULES:
 *
 *   ✅ Must be a string
 *   ✅ Must have a reasonable minimum length (avoid trivial values)
 *   ✅ Must not be excessively large (prevent abuse)
 *
 * -----------------------------------------------------------------------------
 * DESIGN CONSIDERATIONS:
 *
 *   This schema does NOT enforce Mongo ObjectId format explicitly because:
 *
 *   → The system may evolve to support different identifier strategies
 *   → Keeps validation layer decoupled from persistence layer
 *
 * =============================================================================
 */

const companyIdSchema = z
  .string({
    required_error: "Company id is required",
    invalid_type_error: "Company id must be a string"
  })
  .trim()
  .min(10, "Company id is too short")
  .max(100, "Company id is too long");

/* =============================================================================
 * COMPANY NAME SCHEMA
 * =============================================================================
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * Human-readable identifier for the company.
 *
 * -----------------------------------------------------------------------------
 * VALIDATION RULES:
 *
 *   ✅ Trim whitespace
 *   ✅ Enforce minimum semantic length
 *   ✅ Prevent excessively large input
 *
 * -----------------------------------------------------------------------------
 */

const companyNameSchema = z
  .string()
  .trim()
  .min(2, "Company name is too short")
  .max(100, "Company name is too long");

/* =============================================================================
 * COMPANY EMAIL SCHEMA
 * =============================================================================
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * Contact identity of the company.
 *
 * -----------------------------------------------------------------------------
 * NORMALIZATION:
 *
 *   ✅ Trim whitespace
 *   ✅ Convert to lowercase
 *
 * -----------------------------------------------------------------------------
 * VALIDATION:
 *
 *   ✅ Must be a valid email format
 *
 * =============================================================================
 */

const companyEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email format");

/* =============================================================================
 * UPDATE COMPANY SCHEMA
 * =============================================================================
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * Used for partial updates:
 *
 *   PATCH /company
 *
 * -----------------------------------------------------------------------------
 * FIELD OPTIONALITY:
 *
 *   All fields are optional, but:
 *
 *   ✅ At least ONE field must be present
 *
 * -----------------------------------------------------------------------------
 * VALIDATION FLOW
 * -----------------------------------------------------------------------------
 *
 *          Request Payload
 *                │
 *                ▼
 *         Base Field Parsing
 *                │
 *                ▼
 *         Refinement Constraint
 *                │
 *     ┌──────────┴──────────┐
 *     ▼                     ▼
 *  Valid                 Invalid
 *     │                     │
 *     ▼                     ▼
 * Continue            Reject Request
 *
 * -----------------------------------------------------------------------------
 * WHY REFINEMENT?
 * -----------------------------------------------------------------------------
 *
 * Without refinement, an empty object:
 *
 *   {}
 *
 * would pass schema validation but is semantically invalid.
 *
 * =============================================================================
 */

const updateCompanySchema = z
  .object({

    name: companyNameSchema.optional(),

    email: companyEmailSchema.optional()

  })
  .strict() // disallow unknown fields

  /**
   * Refinement:
   * At least one field must be present.
   */
  .refine(

    (data) => Object.keys(data).length > 0,

    {
      message: "At least one field must be provided for update",
      path: []
    }
  );

/* =============================================================================
 * READ PARAMS SCHEMA
 * =============================================================================
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Validates route parameters such as:
 *
 *   GET /companies/:id
 *
 * -----------------------------------------------------------------------------
 */

const companyParamsSchema = z.object({

  id: companyIdSchema

});

/* =============================================================================
 * DELETE PARAMS SCHEMA
 * =============================================================================
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Validates delete operations:
 *
 *   DELETE /companies/:id
 *
 * -----------------------------------------------------------------------------
 */

const deleteCompanyParamsSchema = companyParamsSchema;

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {

  /**
   * Primitive schemas
   */
  companyIdSchema,
  companyNameSchema,
  companyEmailSchema,

  /**
   * Composite schemas
   */
  updateCompanySchema,
  companyParamsSchema,
  deleteCompanyParamsSchema

};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */