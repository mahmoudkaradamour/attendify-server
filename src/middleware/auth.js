/**
 * =============================================================================
 * Attendify — Authentication Middleware (Security Transport Adapter)
 * =============================================================================
 *
 * PURPOSE
 *
 * This middleware acts as a **boundary adapter** between untrusted HTTP input
 * and the trusted authentication domain.
 *
 * =============================================================================
 *
 * 🧠 FORMAL MODEL (AUTHENTICATION PIPELINE)
 *
 * Let:
 *
 *   R = HTTP request
 *   T = token
 *   U = authenticated identity
 *
 * Then:
 *
 *   Auth(R):
 *
 *     extract(T) → verify(T) → resolve(U)
 *
 * =============================================================================
 *
 * 📊 EXECUTION FLOW
 *
 *     Incoming Request
 *            │
 *            ▼
 *    Extract Authorization Header
 *            │
 *            ▼
 *      Normalize & Validate
 *            │
 *            ▼
 *        Extract Token
 *            │
 *            ▼
 *     authGuard.verify(token)
 *            │
 *     ┌──────┴─────────┐
 *     ▼                ▼
 *  Success          Failure
 *     │                │
 *     ▼                ▼
 * Attach user     Throw AppError
 *     │
 *     ▼
 * Extend Context
 *     │
 *     ▼
 *    next()
 *
 * =============================================================================
 *
 * 🔐 SECURITY PRINCIPLES
 *
 *   ✅ Zero trust on input
 *   ✅ No cryptographic logic here
 *   ✅ Centralized verification
 *   ✅ Fail closed (deny by default)
 *
 * =============================================================================
 */

const authGuard =
  require("../security/jwt/auth.guard");

const {
  extendContext
} = require("../observability/request-context");

const AppError =
  require("../shared/errors/app-error");

const logger =
  require("../infrastructure/logging/logger");

/* =============================================================================
 * HEADER NORMALIZATION
 * =============================================================================
 */

function extractBearerToken(req) {

  const raw =
    req.headers.authorization ||
    req.headers.Authorization;

  if (!raw || typeof raw !== "string") {
    return null;
  }

  /**
   * Normalize whitespace
   */
  const parts = raw.trim().split(/\s+/);

  if (parts.length !== 2) {
    return null;
  }

  const [scheme, token] = parts;

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token.trim();
}

/* =============================================================================
 * MIDDLEWARE IMPLEMENTATION
 * =============================================================================
 */

async function authMiddleware(req, res, next) {

  try {

    /**
     * -------------------------------------------------------------------------
     * STEP 1 — EXTRACT TOKEN
     * -------------------------------------------------------------------------
     */
    const token = extractBearerToken(req);

    if (!token) {

      logger.warn("Authentication failed: missing token");

      throw new AppError(
        "Unauthorized",
        401
      );
    }

    /**
     * -------------------------------------------------------------------------
     * STEP 2 — VERIFY TOKEN (SECURITY LAYER)
     * -------------------------------------------------------------------------
     */
    const user =
      await authGuard.verify(token);

    /**
     * -------------------------------------------------------------------------
     * STEP 3 — ATTACH IDENTITY
     * -------------------------------------------------------------------------
     */
    req.user = user;

    /**
     * -------------------------------------------------------------------------
     * STEP 4 — PROPAGATE CONTEXT
     * -------------------------------------------------------------------------
     */
    extendContext({
      userId: user.id
    });

    /**
     * -------------------------------------------------------------------------
     * STEP 5 — CONTINUE PIPELINE
     * -------------------------------------------------------------------------
     */
    next();

  } catch (err) {

    /**
     * -------------------------------------------------------------------------
     * STEP 6 — FAILURE (FAIL CLOSED)
     * -------------------------------------------------------------------------
     */

    logger.warn("Authentication error", {
      message: err.message
    });

    /**
     * Ensure only controlled error exits
     */
    next(
      err instanceof AppError
        ? err
        : new AppError("Unauthorized", 401)
    );
  }
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = authMiddleware;

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */
