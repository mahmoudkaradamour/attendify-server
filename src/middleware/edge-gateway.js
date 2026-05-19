/**
 * =============================================================================
 * Attendify Edge Gateway Verification Middleware
 * =============================================================================
 *
 * FILE:
 * src/middleware/edge-gateway.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This middleware verifies that incoming backend requests originate from the
 * trusted edge gateway layer.
 *
 * Attendify production traffic is designed to flow through:
 *
 *   Client
 *     ↓
 *   Cloudflare Worker
 *     ↓
 *   Attendify Backend
 *
 * The Cloudflare Worker injects an internal secret header:
 *
 *   x-attendify-secret
 *
 * The backend verifies this header before processing protected traffic.
 *
 * -----------------------------------------------------------------------------
 * WHY EDGE GATEWAY VERIFICATION EXISTS
 * -----------------------------------------------------------------------------
 *
 * Without origin protection, attackers could attempt to bypass the Worker and
 * call the backend origin directly.
 *
 * This middleware helps mitigate:
 *
 *   ✅ Direct backend access
 *   ✅ Gateway bypass attempts
 *   ✅ Unauthorized origin traffic
 *   ✅ Public Railway/backend URL abuse
 *
 * -----------------------------------------------------------------------------
 * SECURITY FLOW
 * -----------------------------------------------------------------------------
 *
 *                    Incoming Request
 *                           │
 *                           ▼
 *                    Is Public Route?
 *                           │
 *             ┌─────────────┴─────────────┐
 *             ▼                           ▼
 *           Yes                           No
 *             │                           │
 *             ▼                           ▼
 *         Allow                  Validate x-attendify-secret
 *                                         │
 *                          ┌──────────────┴──────────────┐
 *                          ▼                             ▼
 *                       Valid                         Invalid
 *                          │                             │
 *                          ▼                             ▼
 *                        next()                    Reject 403
 *
 * -----------------------------------------------------------------------------
 * DEVELOPMENT POLICY
 * -----------------------------------------------------------------------------
 *
 * In non-production environments, gateway verification is bypassed to simplify
 * local development unless explicitly enforced later.
 *
 * In production:
 *
 *   EDGE_SECRET verification is mandatory.
 *
 * -----------------------------------------------------------------------------
 * SECURITY DESIGN PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "The backend origin should not trust traffic that bypasses the edge gateway."
 *
 * =============================================================================
 */

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

const crypto = require("crypto");

const config = require("../config/env");

const {
  forbiddenError
} = require("../shared/errors/app-error");

const {
  ERROR_CODES
} = require("../shared/errors/error-codes");

const {
  setSecurityContext
} = require("../observability/request-context");

const {
  auditLogger
} = require("../observability/audit.logger");

const logger = require("../observability/logger");

/* =============================================================================
 * CONSTANTS
 * =============================================================================
 */

const EDGE_SECRET_HEADER =
  "x-attendify-secret";

/**
 * Public routes that must remain accessible without edge-secret enforcement.
 *
 * The health endpoint is intentionally public for monitoring and platform
 * health checks.
 */

const DEFAULT_PUBLIC_PATHS =
  Object.freeze([
    "/"
  ]);

/* =============================================================================
 * TIMING SAFE COMPARISON
 * =============================================================================
 */

/**
 * timingSafeEqualStrings()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Compares two secret values using timing-safe comparison when possible.
 *
 * @param {string} a
 * @param {string} b
 *
 * @returns {boolean}
 */

function timingSafeEqualStrings(
  a,
  b
) {

  if (
    typeof a !== "string" ||
    typeof b !== "string"
  ) {

    return false;
  }

  const aBuffer =
    Buffer.from(a);

  const bBuffer =
    Buffer.from(b);

  if (
    aBuffer.length !== bBuffer.length
  ) {

    return false;
  }

  return crypto.timingSafeEqual(
    aBuffer,
    bBuffer
  );
}

/* =============================================================================
 * PUBLIC PATH CHECK
 * =============================================================================
 */

function isPublicPath(
  req,
  publicPaths
) {

  return publicPaths.includes(
    req.path
  );
}

/* =============================================================================
 * MIDDLEWARE FACTORY
 * =============================================================================
 */

/**
 * edgeGatewayMiddleware()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Creates Express middleware that enforces trusted edge gateway verification.
 *
 * @param {object} options
 * @param {string[]} [options.publicPaths]
 * @param {boolean} [options.enforceInDevelopment]
 *
 * @returns {import("express").RequestHandler}
 */

function edgeGatewayMiddleware({

  publicPaths = DEFAULT_PUBLIC_PATHS,

  enforceInDevelopment = false
} = {}) {

  return function verifyEdgeGateway(
    req,
    res,
    next
  ) {

    if (
      isPublicPath(req, publicPaths)
    ) {

      return next();
    }

    if (
      !config.IS_PRODUCTION &&
      !enforceInDevelopment
    ) {

      setSecurityContext({
        edgeVerified:
          false,

        edgeBypassed:
          true
      });

      return next();
    }

    const providedSecret =
      req.headers[EDGE_SECRET_HEADER];

    const valid =
      timingSafeEqualStrings(
        providedSecret,
        config.EDGE_SECRET
      );

    if (!valid) {

      logger.warn(
        "Edge gateway verification failed",
        {
          securityEvent:
            true,

          requestId:
            req.requestId,

          method:
            req.method,

          path:
            req.originalUrl,

          ip:
            req.ip
        }
      );

      auditLogger.edgeRejected({
        requestId:
          req.requestId,

        ip:
          req.ip,

        action:
          "EDGE_SECRET_VERIFICATION",

        metadata: {
          path:
            req.originalUrl,

          method:
            req.method
        }
      });

      return next(
        forbiddenError(
          "Access denied",
          providedSecret
            ? ERROR_CODES.EDGE_SECRET_INVALID
            : ERROR_CODES.EDGE_SECRET_MISSING
        )
      );
    }

    setSecurityContext({
      edgeVerified:
        true
    });

    return next();
  };
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {

  edgeGatewayMiddleware,

  EDGE_SECRET_HEADER,

  timingSafeEqualStrings
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
 *   ✅ Trusted edge-gateway enforcement
 *   ✅ Direct-origin access protection
 *   ✅ Timing-safe secret comparison
 *   ✅ Public health-route allowance
 *   ✅ Security audit generation
 *   ✅ Production-only mandatory enforcement
 *
 * -----------------------------------------------------------------------------
 * CORE PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Origin APIs must only trust traffic that passes through controlled gateway
 *    boundaries."
 *
 * =============================================================================
 */