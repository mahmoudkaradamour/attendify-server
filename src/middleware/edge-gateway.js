/**
 * =============================================================================
 * Attendify — Edge Gateway Verification Middleware (Zero-Trust Entry Filter)
 * =============================================================================
 *
 * PURPOSE
 *
 * Enforces that all incoming traffic originates from a trusted edge gateway
 * (e.g., Cloudflare Worker), establishing a **controlled ingress boundary**.
 *
 * =============================================================================
 *
 * 🧠 FORMAL MODEL (TRUST BOUNDARY VALIDATION)
 *
 * Let:
 *
 *   R = incoming request
 *   G = trusted gateway
 *
 * Then:
 *
 *   accept(R) ⇔ R originates from G
 *
 * Otherwise:
 *
 *   reject(R)
 *
 * =============================================================================
 *
 * 📊 EXECUTION FLOW
 *
 *           Incoming HTTP Request
 *                    │
 *                    ▼
 *           Is Public Route?
 *            /              \
 *         Yes                No
 *         │                  │
 *         ▼                  ▼
 *      Allow       Validate x-attendify-secret
 *                              │
 *                     ┌────────┴────────┐
 *                     ▼                 ▼
 *                  Valid             Invalid
 *                     │                 │
 *                     ▼                 ▼
 *                   next()          Reject 403
 *
 * =============================================================================
 *
 * 🔐 SECURITY PRINCIPLES
 *
 *   ✅ Zero trust on direct origin access
 *   ✅ Constant-time secret comparison
 *   ✅ Explicit public route allowlist
 *   ✅ Full audit + logging visibility
 *
 * =============================================================================
 */

const crypto = require("crypto");

/* =============================================================================
 * CONFIGURATION
 * =============================================================================
 */

const {
  validateConfig
} = require("../config/config.validator");

/**
 * ⚠️ NOTE:
 * config should already be validated at bootstrap,
 * we assume process.env normalized.
 */
const config = validateConfig();

/* =============================================================================
 * ERROR + OBSERVABILITY
 * =============================================================================
 */

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

const logger =
  require("../infrastructure/logging/logger");

/* =============================================================================
 * CONSTANTS
 * =============================================================================
 */

const EDGE_SECRET_HEADER = "x-attendify-secret";

/**
 * Public endpoints (must stay unprotected)
 */
const DEFAULT_PUBLIC_PATHS = Object.freeze([
  "/",
  "/health",
  "/ready",
  "/auth/login",
  "/auth/register"
]);

/* =============================================================================
 * TIMING-SAFE COMPARISON
 * =============================================================================
 */

function timingSafeEqualStrings(a, b) {

  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);

  if (aBuf.length !== bBuf.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

/* =============================================================================
 * PUBLIC ROUTE CHECK
 * =============================================================================
 */

function isPublicPath(req, publicPaths) {
  return publicPaths.includes(req.path);
}

/* =============================================================================
 * MAIN MIDDLEWARE FACTORY
 * =============================================================================
 */

function edgeGatewayMiddleware({

  publicPaths = DEFAULT_PUBLIC_PATHS,

  enforceInDevelopment = false

} = {}) {

  return function verifyEdgeGateway(req, res, next) {

    /**
     * -------------------------------------------------------------------------
     * STEP 1 — PUBLIC ROUTES BYPASS
     * -------------------------------------------------------------------------
     */
    if (isPublicPath(req, publicPaths)) {
      return next();
    }

    /**
     * -------------------------------------------------------------------------
     * STEP 2 — DEVELOPMENT BYPASS
     * -------------------------------------------------------------------------
     */
    if (!config.IS_PRODUCTION && !enforceInDevelopment) {

      setSecurityContext({
        edgeVerified: false,
        edgeBypassed: true
      });

      return next();
    }

    /**
     * -------------------------------------------------------------------------
     * STEP 3 — SECRET VALIDATION
     * -------------------------------------------------------------------------
     */

    const providedSecret =
      req.headers[EDGE_SECRET_HEADER];

    const valid =
      timingSafeEqualStrings(
        providedSecret,
        config.EDGE_SECRET
      );

    /**
     * -------------------------------------------------------------------------
     * STEP 4 — REJECTION
     * -------------------------------------------------------------------------
     */
    if (!valid) {

      logger.warn("Edge gateway verification failed", {
        securityEvent: true,
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip
      });

      auditLogger.edgeRejected({
        requestId: req.requestId,
        ip: req.ip,
        action: "EDGE_SECRET_VERIFICATION",
        metadata: {
          path: req.originalUrl,
          method: req.method
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

    /**
     * -------------------------------------------------------------------------
     * STEP 5 — SUCCESS
     * -------------------------------------------------------------------------
     */

    setSecurityContext({
      edgeVerified: true
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
 */

