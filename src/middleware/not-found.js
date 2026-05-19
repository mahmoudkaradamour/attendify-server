/**
 * =============================================================================
 * Attendify Not Found Middleware (Deterministic 404 Handler)
 * =============================================================================
 *
 * FILE:
 * src/middleware/not-found.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This middleware is responsible for handling all unmatched routes in the
 * Attendify backend.
 *
 * It provides a deterministic, standardized response when a requested route
 * does not exist.
 *
 * -----------------------------------------------------------------------------
 * WHY THIS MIDDLEWARE EXISTS
 * -----------------------------------------------------------------------------
 *
 * In an Express-based application, route matching is sequential.
 *
 * If no route matches a request:
 *
 *   → Express does NOT automatically return a structured response
 *
 * Without this middleware:
 *
 *   - The client may receive inconsistent or default responses
 *   - Errors may not follow the API contract
 *   - Debugging becomes inconsistent
 *   - Security policies may be bypassed unintentionally
 *
 * Therefore, this middleware ensures:
 *
 *   ✅ All unknown routes are explicitly handled
 *   ✅ Responses follow the global API contract
 *   ✅ The system behaves deterministically
 *
 * -----------------------------------------------------------------------------
 * REQUEST FLOW DIAGRAM
 * -----------------------------------------------------------------------------
 *
 *                Incoming HTTP Request
 *                          │
 *                          ▼
 *                Registered Routes Layer
 *                          │
 *            ┌─────────────┴─────────────┐
 *            │                           │
 *            ▼                           ▼
 *      Route Matched               No Route Matched
 *            │                           │
 *            ▼                           ▼
 *     Controller Executes        not-found middleware
 *                                        │
 *                                        ▼
 *                         notFoundError(...)
 *                                        │
 *                                        ▼
 *                           next(error)
 *                                        │
 *                                        ▼
 *                          error-handler middleware
 *                                        │
 *                                        ▼
 *                     standardized error response
 *
 * -----------------------------------------------------------------------------
 * ERROR STRATEGY
 * -----------------------------------------------------------------------------
 *
 * This middleware does NOT send the response directly.
 *
 * Instead:
 *
 *   - It constructs a domain-specific error (AppError)
 *   - It forwards the error to the global error handler
 *
 * Why?
 *
 *   → To preserve centralized error handling logic
 *   → To ensure uniform response formatting
 *   → To guarantee observability and logging consistency
 *
 * -----------------------------------------------------------------------------
 * ERROR SEMANTICS
 * -----------------------------------------------------------------------------
 *
 * HTTP Status:
 *   404 Not Found
 *
 * Error Code:
 *   ROUTE_NOT_FOUND
 *
 * Exposure Policy:
 *   Safe to expose (client can know route is missing)
 *
 * -----------------------------------------------------------------------------
 * DESIGN PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "All unmatched routes must be explicitly handled and never fall through."
 *
 * =============================================================================
 */

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

const {
  notFoundError
} = require("../shared/errors/app-error");

/* =============================================================================
 * MIDDLEWARE IMPLEMENTATION
 * =============================================================================
 */

/**
 * Express middleware for handling unmatched routes.
 *
 * IMPORTANT:
 * This middleware must be registered AFTER all route definitions.
 *
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
function notFoundMiddleware(req, res, next) {

  /**
   * Construct a descriptive message for debugging clarity.
   *
   * Example:
   *   "Route GET /api/unknown not found"
   */
  const method =
    req.method || "UNKNOWN";

  const path =
    req.originalUrl || req.url || "unknown-path";

  const message =
    `Route ${method} ${path} not found`;

  /**
   * Create a standardized AppError and forward it
   */
  const error =
    notFoundError(message);

  return next(error);
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = notFoundMiddleware;

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */