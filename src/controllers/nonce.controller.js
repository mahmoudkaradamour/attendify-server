/**
 * =============================================================================
 * Attendify Nonce Controller
 * =============================================================================
 *
 * FILE:
 * src/controllers/nonce.controller.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module implements the HTTP controller boundary for nonce issuance in the
 * Attendify backend platform.
 *
 * A nonce is a cryptographically strong, short-lived value used to establish
 * freshness for signed requests.
 *
 * In security-sensitive request flows, especially HMAC-based attendance
 * submissions, a valid signature alone proves payload integrity but does not
 * prove that the request is fresh.
 *
 * Therefore, nonce issuance is required to reduce replay risk.
 *
 * -----------------------------------------------------------------------------
 * CONTROLLER RESPONSIBILITY MODEL
 * -----------------------------------------------------------------------------
 *
 * Controllers are not business-logic containers.
 *
 * This controller is responsible for:
 *
 *   ✅ Receiving an HTTP request
 *   ✅ Calling the nonce service
 *   ✅ Returning a standardized API response
 *   ✅ Delegating errors to centralized error middleware
 *
 * This controller is NOT responsible for:
 *
 *   ❌ Randomness generation details
 *   ❌ Replay-store persistence
 *   ❌ Signature verification
 *   ❌ Attendance acceptance decisions
 *   ❌ Redis operations
 *
 * Those responsibilities belong to:
 *
 *   ✅ src/services/nonce.service.js
 *   ✅ src/security/verifier.service.js
 *   ✅ src/security/replay/*
 *
 * -----------------------------------------------------------------------------
 * WHY NONCE CONTROLLERS MUST BE THIN
 * -----------------------------------------------------------------------------
 *
 * Keeping the controller thin ensures:
 *
 *   ✅ Consistent HTTP behavior
 *   ✅ Testable service logic
 *   ✅ Clear separation of responsibilities
 *   ✅ Reduced security drift
 *   ✅ Easier maintainability
 *
 * -----------------------------------------------------------------------------
 * NONCE ISSUANCE FLOW
 * -----------------------------------------------------------------------------
 *
 *                       Client
 *                         │
 *                         ▼
 *                    GET /nonce
 *                         │
 *                         ▼
 *             nonceController.generateNonce
 *                         │
 *                         ▼
 *              nonceService.generateNonce()
 *                         │
 *                         ▼
 *          Cryptographically Secure Nonce Object
 *                         │
 *                         ▼
 *              Standardized JSON API Response
 *
 * -----------------------------------------------------------------------------
 * RESPONSE MODEL
 * -----------------------------------------------------------------------------
 *
 * A successful response has the following structure:
 *
 * {
 *   "success": true,
 *   "message": "Nonce generated successfully",
 *   "data": {
 *     "nonce": {
 *       "value": "64-character-hex-string",
 *       "issuedAt": 1710000000000,
 *       "expiresAt": 1710000300000,
 *       "ttlSeconds": 300
 *     }
 *   },
 *   "meta": {
 *     "requestId": "req_..."
 *   }
 * }
 *
 * -----------------------------------------------------------------------------
 * SECURITY CONSIDERATIONS
 * -----------------------------------------------------------------------------
 *
 * The nonce endpoint is often public or lightly protected.
 *
 * Therefore, routes using this controller should apply:
 *
 *   ✅ Request correlation
 *   ✅ Request context propagation
 *   ✅ Rate limiting
 *   ✅ Edge gateway verification when applicable
 *
 * This controller assumes those middleware layers are configured at the route
 * or application level.
 *
 * -----------------------------------------------------------------------------
 * SECURITY DESIGN PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Freshness tokens must be generated centrally and returned through a
 *    deterministic response contract."
 *
 * =============================================================================
 */

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

/**
 * Nonce service.
 *
 * Owns:
 *
 *   ✅ Cryptographically secure nonce generation
 *   ✅ Nonce TTL policy
 *   ✅ Nonce metadata construction
 */
const nonceService = require("../services/nonce.service");

/**
 * Centralized API response helpers.
 *
 * Ensures:
 *
 *   ✅ Stable response shape
 *   ✅ requestId correlation metadata
 *   ✅ consistent success semantics
 */
const {
  sendSuccess
} = require("../shared/responses/api-response");

/* =============================================================================
 * GENERATE NONCE CONTROLLER
 * =============================================================================
 */

/**
 * generateNonce()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Handles HTTP requests for nonce issuance.
 *
 * -----------------------------------------------------------------------------
 * EXPECTED ROUTE:
 * -----------------------------------------------------------------------------
 *
 *   GET /nonce
 *
 * -----------------------------------------------------------------------------
 * EXPECTED PRECONDITIONS:
 * -----------------------------------------------------------------------------
 *
 * The route should apply:
 *
 *   ✅ nonce rate limiter
 *   ✅ request-id middleware
 *   ✅ request-context middleware
 *   ✅ edge gateway middleware where required
 *
 * -----------------------------------------------------------------------------
 * EXECUTION FLOW:
 * -----------------------------------------------------------------------------
 *
 *                  HTTP Request
 *                       │
 *                       ▼
 *                generateNonce()
 *                       │
 *                       ▼
 *          nonceService.generateNonce()
 *                       │
 *                       ▼
 *             sendSuccess(response)
 *
 * -----------------------------------------------------------------------------
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 *
 * @returns {void}
 */

function generateNonce(
  req,
  res,
  next
) {

  try {

    const nonce =
      nonceService.generateNonce();

    return sendSuccess(
      res,
      {
        message:
          "Nonce generated successfully",

        data: {
          nonce
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
   * GET /nonce
   */
  generateNonce
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */