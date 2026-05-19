/**
 * =============================================================================
 * Attendify Validation Middleware (Input Contract Enforcement Layer)
 * =============================================================================
 *
 * FILE:
 * src/middleware/validate.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module implements a deterministic, schema-driven validation mechanism
 * for incoming HTTP requests using Zod.
 *
 * It enforces a strict trust boundary between:
 *
 *   - External, untrusted input (HTTP layer)
 *   - Internal, trusted application data
 *
 * This ensures:
 *
 *   ✅ Only valid, normalized data enters the system
 *   ✅ Early rejection of malformed or malicious input
 *   ✅ Deterministic behavior across all endpoints
 *
 * -----------------------------------------------------------------------------
 * CORE CONCEPT: VALIDATION AS A TRUST BOUNDARY
 * -----------------------------------------------------------------------------
 *
 * External input must NEVER be trusted.
 *
 * Formal model:
 *
 *   External_Input (untrusted)
 *         │
 *         ▼
 *   Validation(schema)
 *         │
 *         ▼
 *   Trusted_Internal_Data ∈ Schema
 *
 * This middleware enforces that invariant.
 *
 * -----------------------------------------------------------------------------
 * HIGH-LEVEL FLOW
 * -----------------------------------------------------------------------------
 *
 *                Incoming HTTP Request
 *                           │
 *                           ▼
 *                validation middleware
 *                           │
 *             ┌─────────────┴─────────────┐
 *             ▼                           ▼
 *       Valid Input                Invalid Input
 *             │                           │
 *             ▼                           ▼
 *   Replace request data         Build structured error
 *             │                           │
 *             ▼                           ▼
 *        next()                 next(AppError)
 *
 * -----------------------------------------------------------------------------
 * DETAILED PIPELINE (TRANSFORMATION MODEL)
 * -----------------------------------------------------------------------------
 *
 * For each request component:
 *
 *   req.body / req.query / req.params
 *
 * Pipeline:
 *
 *   RAW INPUT
 *        │
 *        ▼
 *   schema.safeParse(input)
 *        │
 *        ├── success → normalized_data
 *        │        │
 *        │        ▼
 *        │   assign → req.*
 *        │
 *        └── failure → issues[]
 *                 │
 *                 ▼
 *           transform → structured error
 *                 │
 *                 ▼
 *              throw
 *
 * -----------------------------------------------------------------------------
 * GUARANTEES AFTER SUCCESS
 * -----------------------------------------------------------------------------
 *
 * If validation passes:
 *
 *   req.body   → VALIDATED & SANITIZED
 *   req.query  → VALIDATED & SANITIZED
 *   req.params → VALIDATED & SANITIZED
 *
 * That means:
 *
 *   ✅ No unexpected fields
 *   ✅ No type mismatches
 *   ✅ No unsafe data propagation
 *
 * -----------------------------------------------------------------------------
 * WHY ZOD IS USED
 * -----------------------------------------------------------------------------
 *
 * Zod provides:
 *
 *   ✅ Schema-based validation
 *   ✅ Runtime parsing guarantees
 *   ✅ Structured error reporting (issues[])
 *   ✅ Deterministic transformation behavior
 *
 * Unlike simple validation:
 *
 *   → this enforces BOTH validation and normalization
 *
 * -----------------------------------------------------------------------------
 * ERROR MODEL
 * -----------------------------------------------------------------------------
 *
 * Validation errors are transformed into:
 *
 * {
 *   message: "Invalid request data",
 *   details: [
 *     { field: "email", message: "Invalid email" },
 *     { field: "password", message: "Too short" }
 *   ]
 * }
 *
 * This allows:
 *
 *   ✅ consistent API error responses
 *   ✅ frontend-friendly error mapping
 *   ✅ observability integration
 *
 * -----------------------------------------------------------------------------
 * DESIGN PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Reject invalid data immediately and never propagate it downstream."
 *
 * -----------------------------------------------------------------------------
 * FORMAL GUARANTEE
 * -----------------------------------------------------------------------------
 *
 * ∀ request R:
 *   if validationMiddleware passes:
 *      R.data ∈ Schema (strictly guaranteed)
 *
 * -----------------------------------------------------------------------------
 * USAGE EXAMPLE
 * -----------------------------------------------------------------------------
 *
 * router.post(
 *   "/login",
 *   validate({
 *     body: loginSchema
 *   }),
 *   controller.login
 * );
 *
 * -----------------------------------------------------------------------------
 * EXTENSIBILITY
 * -----------------------------------------------------------------------------
 *
 * This middleware can be extended to support:
 *
 *   - headers validation
 *   - file/content validation
 *   - conditional schemas
 *
 * =============================================================================
 */

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

const {
  validationError
} = require("../shared/errors/app-error");

/* =============================================================================
 * VALIDATION FACTORY
 * =============================================================================
 */

/**
 * Creates a validation middleware using a Zod schema.
 *
 * @param {object} schema
 *
 * Expected schema structure:
 *
 * {
 *   body?: z.object(...)
 *   query?: z.object(...)
 *   params?: z.object(...)
 * }
 *
 * @returns {function} Express middleware
 */
function validate(schema = {}) {

  /**
   * Returned middleware
   */
  return function validationMiddleware(req, res, next) {

    try {

      /**
       * -------------------------------------------------------------------------
       * STEP 1: VALIDATE req.body
       * -------------------------------------------------------------------------
       */
      if (schema.body) {

        const result =
          schema.body.safeParse(req.body);

        if (!result.success) {
          throw transformZodError(result.error);
        }

        /**
         * Replace unsafe raw input with validated data
         */
        req.body = result.data;
      }

      /**
       * -------------------------------------------------------------------------
       * STEP 2: VALIDATE req.query
       * -------------------------------------------------------------------------
       */
      if (schema.query) {

        const result =
          schema.query.safeParse(req.query);

        if (!result.success) {
          throw transformZodError(result.error);
        }

        req.query = result.data;
      }

      /**
       * -------------------------------------------------------------------------
       * STEP 3: VALIDATE req.params
       * -------------------------------------------------------------------------
       */
      if (schema.params) {

        const result =
          schema.params.safeParse(req.params);

        if (!result.success) {
          throw transformZodError(result.error);
        }

        req.params = result.data;
      }

      /**
       * -------------------------------------------------------------------------
       * STEP 4: SUCCESS → CONTINUE EXECUTION PIPELINE
       * -------------------------------------------------------------------------
       */
      return next();

    } catch (error) {

      /**
       * Forward structured validation error
       */
      return next(error);
    }
  };
}

/* =============================================================================
 * ZOD ERROR TRANSFORMATION
 * =============================================================================
 */

/**
 * Transforms a Zod error into a standardized AppError.
 *
 * @param {object} zodError
 * @returns {Error}
 */
function transformZodError(zodError) {

  /**
   * Extract meaningful validation issues
   */
  const details =
    zodError.issues.map(issue => ({
      field: issue.path && issue.path.length > 0
        ? issue.path.join(".")
        : "root",
      message: issue.message
    }));

  return validationError(
    "Invalid request data",
    details
  );
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = validate;

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */