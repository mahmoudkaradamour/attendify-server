/**
 * =============================================================================
 * Attendify Global Error Handler Middleware
 * =============================================================================
 *
 * FILE:
 * src/middleware/error-handler.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module provides a centralized error handling middleware for the
 * Attendify backend.
 *
 * It guarantees consistent error normalization, logging, classification, and
 * safe API response formatting.
 *
 * -----------------------------------------------------------------------------
 * THE PROBLEM THIS SOLVES
 * -----------------------------------------------------------------------------
 *
 * In a non-structured system:
 *
 *   - Errors may be thrown in different formats
 *   - Some errors expose sensitive data
 *   - Some errors are not logged
 *   - Responses become inconsistent
 *
 * Example of bad practice:
 *
 *   throw new Error("Database failed")
 *   res.send(error.message)
 *
 * This causes:
 *
 *   - information leakage
 *   - inconsistent client experience
 *   - poor debugging capability
 *
 * -----------------------------------------------------------------------------
 * CENTRALIZED ERROR FLOW
 * -----------------------------------------------------------------------------
 *
 *               Any Layer Throws Error
 *                         │
 *                         ▼
 *                Express error flow
 *                         │
 *                         ▼
 *              error-handler middleware
 *                         │
 *                         ▼
 *            normalizeError(error)
 *                         │
 *                         ▼
 *         log structured error (logger)
 *                         │
 *                         ▼
 *         send safe API response (api-response)
 *
 * -----------------------------------------------------------------------------
 * ERROR LIFECYCLE MODEL
 * -----------------------------------------------------------------------------
 *
 *   THROW ERROR  →  NORMALIZE  →  CLASSIFY  →  LOG  →  RESPOND
 *
 * -----------------------------------------------------------------------------
 * ERROR CLASSIFICATION
 * -----------------------------------------------------------------------------
 *
 * Errors are divided into:
 *
 *   1. Operational Errors (Expected Failures)
 *      - validation errors
 *      - authentication failure
 *      - resource not found
 *      - business rule violations
 *
 *   2. Programmer Errors (Unexpected Failures)
 *      - undefined variables
 *      - broken imports
 *      - runtime exceptions
 *
 * Operational errors:
 *   → Safe to expose message
 *
 * Programmer errors:
 *   → Must not expose internal message
 *
 * -----------------------------------------------------------------------------
 * SECURITY POLICY
 * -----------------------------------------------------------------------------
 *
 * This module enforces:
 *
 *   ✅ No stack trace exposure in production
 *   ✅ No internal error leakage
 *   ✅ No sensitive data exposure
 *   ✅ Deterministic API error format
 *
 * -----------------------------------------------------------------------------
 * RESPONSE CONTRACT
 * -----------------------------------------------------------------------------
 *
 * Error responses always follow:
 *
 * {
 *   success: false,
 *   error: {
 *     code: "ERROR_CODE",
 *     message: "Safe message",
 *     details: null
 *   },
 *   meta: {
 *     requestId: "..."
 *   }
 * }
 *
 * -----------------------------------------------------------------------------
 * DESIGN PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "All errors must be explicit internally and safe externally."
 *
 * =============================================================================
 */

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

const {
  normalizeError
} = require("../shared/errors/app-error");

const {
  sendError
} = require("../shared/responses/api-response");

const logger = require("../infrastructure/logging/logger");

const {
  getRequestId
} = require("../observability/request-context");

/* =============================================================================
 * ERROR HANDLER MIDDLEWARE
 * =============================================================================
 */

/**
 * Express error-handling middleware.
 *
 * Signature required by Express:
 * (err, req, res, next)
 *
 * @param {*} err
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
function errorHandler(err, req, res, next) {

  /**
   * STEP 1: Normalize any error into AppError
   */
  const error =
    normalizeError(err);

  /**
   * STEP 2: Extract requestId for trace correlation
   */
  const requestId =
    getRequestId() ||
    req.requestId ||
    null;

  /**
   * STEP 3: Log error with full internal details
   */
  logger.error("Unhandled application error", {
    requestId,
    error: error.toLogObject
      ? error.toLogObject()
      : error
  });

  /**
   * STEP 4: Send safe API response
   */
  return sendError(res, {
    error,
    req,
    requestId
  });
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = errorHandler;

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */