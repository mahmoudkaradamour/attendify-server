/**
 * =============================================================================
 * Attendify Attendance Controller
 * =============================================================================
 *
 * FILE:
 * src/controllers/attendance.controller.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module implements the HTTP controller boundary for secure attendance
 * submission and attendance retrieval operations.
 *
 * Attendance submission is security-sensitive because it represents an event
 * that may later be used for operational, compliance, payroll, or attendance
 * evidence purposes.
 *
 * Therefore, the controller must coordinate HTTP input/output without directly
 * owning verification or persistence logic.
 *
 * -----------------------------------------------------------------------------
 * CONTROLLER RESPONSIBILITY MODEL
 * -----------------------------------------------------------------------------
 *
 * This controller is responsible for:
 *
 *   ✅ Receiving HTTP requests
 *   ✅ Extracting trusted authentication context
 *   ✅ Passing validated request bodies to the service layer
 *   ✅ Returning standardized API responses
 *   ✅ Delegating all errors to global error handling middleware
 *
 * This controller is NOT responsible for:
 *
 *   ❌ HMAC verification
 *   ❌ Nonce validation
 *   ❌ Replay protection
 *   ❌ Redis access
 *   ❌ MongoDB queries
 *   ❌ Cryptographic canonicalization
 *
 * Those responsibilities belong to:
 *
 *   ✅ src/services/attendance.service.js
 *   ✅ src/security/verifier.service.js
 *   ✅ src/repositories/attendance.repository.js
 *
 * -----------------------------------------------------------------------------
 * SECURE ATTENDANCE SUBMISSION FLOW
 * -----------------------------------------------------------------------------
 *
 *                    Client / Device
 *                          │
 *                          ▼
 *              Signed Attendance Request
 *                          │
 *                          ▼
 *                   Route Middleware
 *          ┌───────────────┼───────────────┐
 *          ▼               ▼               ▼
 *     Rate Limiter     Validation     Authentication
 *                          │
 *                          ▼
 *              attendanceController.submitAttendance
 *                          │
 *                          ▼
 *              attendanceService.submitAttendance
 *                          │
 *          ┌───────────────┼───────────────┐
 *          ▼               ▼               ▼
 *      HMAC Verify     Replay Check     Persistence
 *                          │
 *                          ▼
 *             Standardized API Response
 *
 * -----------------------------------------------------------------------------
 * TRUSTED TENANT MODEL
 * -----------------------------------------------------------------------------
 *
 * Attendance records must be associated with a trusted company identity.
 *
 * The trusted company identity is derived from:
 *
 *   req.company.id
 *
 * which is populated by:
 *
 *   src/middleware/auth.js
 *
 * after JWT verification.
 *
 * The controller must never trust tenant identity from:
 *
 *   ❌ req.body.companyId
 *   ❌ req.query.companyId
 *   ❌ req.params.companyId
 *
 * for protected attendance operations.
 *
 * -----------------------------------------------------------------------------
 * SUBMISSION RESPONSE MODEL
 * -----------------------------------------------------------------------------
 *
 * A successful submission response has the following shape:
 *
 * {
 *   "success": true,
 *   "message": "Attendance submitted successfully",
 *   "data": {
 *     "attendance": {...}
 *   },
 *   "meta": {
 *     "requestId": "req_..."
 *   }
 * }
 *
 * -----------------------------------------------------------------------------
 * QUERY RESPONSE MODEL
 * -----------------------------------------------------------------------------
 *
 * A successful query response has the following shape:
 *
 * {
 *   "success": true,
 *   "message": "Attendance records retrieved successfully",
 *   "data": {
 *     "attendance": [...]
 *   },
 *   "meta": {
 *     "requestId": "req_..."
 *   }
 * }
 *
 * -----------------------------------------------------------------------------
 * ERROR HANDLING MODEL
 * -----------------------------------------------------------------------------
 *
 * This controller never manually formats errors.
 *
 * It uses:
 *
 *   next(error)
 *
 * so the error is handled by:
 *
 *   src/middleware/error-handler.js
 *
 * This guarantees:
 *
 *   ✅ Consistent error format
 *   ✅ Safe exposure policy
 *   ✅ Centralized logging
 *   ✅ No stack trace leakage
 *
 * -----------------------------------------------------------------------------
 * SECURITY DESIGN PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Attendance evidence must cross the HTTP boundary only through verified,
 *    tenant-bound, and deterministic processing."
 *
 * =============================================================================
 */

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

/**
 * Attendance service.
 *
 * Owns:
 *
 *   ✅ signed attendance verification orchestration
 *   ✅ replay protection orchestration
 *   ✅ persistence orchestration
 *   ✅ attendance query logic
 */
const attendanceService = require("../services/attendance.service");

/**
 * Centralized standardized response helpers.
 */
const {
  sendSuccess,
  sendCreated
} = require("../shared/responses/api-response");

/**
 * Application error helpers.
 *
 * Used only for trusted context extraction failure.
 */
const {
  unauthorizedError
} = require("../shared/errors/app-error");

/**
 * Stable error-code registry.
 */
const {
  ERROR_CODES
} = require("../shared/errors/error-codes");

/* =============================================================================
 * TRUSTED COMPANY CONTEXT EXTRACTION
 * =============================================================================
 */

/**
 * getTrustedCompanyId()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Extracts trusted company id from authenticated request context.
 *
 * WHY THIS EXISTS:
 * -----------------------------------------------------------------------------
 *
 * This helper centralizes the tenant-trust rule:
 *
 *   Company identity must come from verified JWT context.
 *
 * -----------------------------------------------------------------------------
 * @param {import("express").Request} req
 *
 * @returns {string}
 */

function getTrustedCompanyId(req) {

  const companyId =
    req.company?.id;

  if (
    typeof companyId !== "string" ||
    companyId.trim().length === 0
  ) {

    throw unauthorizedError(
      "Authenticated company context is required",
      ERROR_CODES.AUTH_INVALID_TOKEN
    );
  }

  return companyId;
}

/* =============================================================================
 * ATTENDANCE SUBMISSION CONTROLLER
 * =============================================================================
 */

/**
 * submitAttendance()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Handles secure attendance submission.
 *
 * -----------------------------------------------------------------------------
 * EXPECTED ROUTE:
 * -----------------------------------------------------------------------------
 *
 *   POST /attendance
 *
 * -----------------------------------------------------------------------------
 * EXPECTED PRECONDITIONS:
 * -----------------------------------------------------------------------------
 *
 * Route should apply:
 *
 *   ✅ attendance rate limiter
 *   ✅ attendance request validation
 *   ✅ authentication middleware when tenant-bound submission is required
 *
 * -----------------------------------------------------------------------------
 * REQUEST BODY SHAPES SUPPORTED BY SERVICE/VERIFIER:
 * -----------------------------------------------------------------------------
 *
 * Preferred canonical shape:
 *
 * {
 *   "payload": {
 *     "userId": "employee-123",
 *     "timestamp": 1710000000000,
 *     "location": {
 *       "lat": 25.2048,
 *       "lng": 55.2708
 *     },
 *     "nonce": {
 *       "value": "...",
 *       "issuedAt": 1710000000000,
 *       "expiresAt": 1710000300000,
 *       "ttlSeconds": 300
 *     }
 *   },
 *   "signature": "hex"
 * }
 *
 * Compatibility shape:
 *
 * {
 *   "userId": "employee-123",
 *   "timestamp": 1710000000000,
 *   "location": {...},
 *   "nonce": "...",
 *   "signature": "hex"
 * }
 *
 * -----------------------------------------------------------------------------
 * EXECUTION FLOW:
 * -----------------------------------------------------------------------------
 *
 *                submitAttendance()
 *                        │
 *                        ▼
 *              getTrustedCompanyId(req)
 *                        │
 *                        ▼
 *       attendanceService.submitAttendance(...)
 *                        │
 *                        ▼
 *                 sendCreated(response)
 *
 * -----------------------------------------------------------------------------
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 *
 * @returns {Promise<void>}
 */

async function submitAttendance(
  req,
  res,
  next
) {

  try {

    const companyId =
      getTrustedCompanyId(req);

    const result =
      await attendanceService.submitAttendance({
        companyId,
        signedRequest:
          req.body
      });

    return sendCreated(
      res,
      {
        message:
          "Attendance submitted successfully",

        data: {
          attendance:
            result.attendance
        },

        req
      }
    );

  } catch (error) {

    return next(error);
  }
}

/* =============================================================================
 * ATTENDANCE QUERY CONTROLLER
 * =============================================================================
 */

/**
 * getMyAttendance()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Retrieves recent attendance records for the authenticated company.
 *
 * -----------------------------------------------------------------------------
 * EXPECTED ROUTE:
 * -----------------------------------------------------------------------------
 *
 *   GET /attendance
 *
 * -----------------------------------------------------------------------------
 * TRUST MODEL:
 * -----------------------------------------------------------------------------
 *
 * The company id is derived from:
 *
 *   req.company.id
 *
 * not from client-controlled input.
 *
 * -----------------------------------------------------------------------------
 * OPTIONAL QUERY:
 * -----------------------------------------------------------------------------
 *
 *   ?limit=50
 *
 * If route-level query validation is used later, req.query.limit should already
 * be normalized. This controller still defensively normalizes the value to keep
 * HTTP behavior deterministic.
 *
 * -----------------------------------------------------------------------------
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 *
 * @returns {Promise<void>}
 */

async function getMyAttendance(
  req,
  res,
  next
) {

  try {

    const companyId =
      getTrustedCompanyId(req);

    const rawLimit =
      req.query?.limit;

    const parsedLimit =
      Number(rawLimit || 50);

    const limit =
      Number.isInteger(parsedLimit) &&
      parsedLimit > 0 &&
      parsedLimit <= 200
        ? parsedLimit
        : 50;

    const attendance =
      await attendanceService.getCompanyAttendance(
        companyId,
        limit
      );

    return sendSuccess(
      res,
      {
        message:
          "Attendance records retrieved successfully",

        data: {
          attendance
        },

        req
      }
    );

  } catch (error) {

    return next(error);
  }
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {

  /**
   * Trusted identity helper.
   */
  getTrustedCompanyId,

  /**
   * POST /attendance
   */
  submitAttendance,

  /**
   * GET /attendance
   */
  getMyAttendance
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */