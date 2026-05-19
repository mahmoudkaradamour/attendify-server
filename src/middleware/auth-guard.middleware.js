/**
 * =============================================================================
 * Attendify — Authentication Guard Middleware (Enterprise Security Layer)
 * =============================================================================
 *
 * OVERVIEW
 * =============================================================================
 *
 * This middleware enforces **authentication and identity verification** for
 * protected routes in the system. It acts as a **security gatekeeper** that
 * ensures only validated and trusted clients can access sensitive resources.
 *
 * =============================================================================
 *
 * 🧠 FORMAL SECURITY MODEL
 * =============================================================================
 *
 * Let:
 *
 *   R  = Incoming request
 *   T  = Bearer token extracted from Authorization header
 *   V(T) = Verification function for token validity
 *   U = Authenticated user identity
 *
 * Then:
 *
 *   ACCESS GRANTED  ⇔  T exists ∧ V(T) = valid
 *   ACCESS DENIED   ⇔  T = null ∨ V(T) = invalid
 *
 * =============================================================================
 *
 * 📊 AUTHENTICATION FLOW PIPELINE
 * =============================================================================
 *
 *                   Incoming HTTP Request
 *                           │
 *                           ▼
 *             Extract Authorization Header
 *                           │
 *                           ▼
 *                Validate Bearer Token Format
 *                           │
 *             ┌─────────────┴─────────────┐
 *             ▼                           ▼
 *         Invalid                    Valid Format
 *             │                           │
 *             ▼                           ▼
 *        Reject (401)          Verify Token Signature
 *                                         │
 *                            ┌────────────┴────────────┐
 *                            ▼                         ▼
 *                        Invalid                   Verified
 *                            │                         │
 *                            ▼                         ▼
 *                      Reject (401)           Attach User to Request
 *                                                    │
 *                                                    ▼
 *                                                  next()
 *
 * =============================================================================
 *
 * 🔐 SECURITY OBJECTIVES
 * =============================================================================
 *
 * 1. Authentication Integrity
 * ---------------------------------------------------------------------------
 * Ensures that the request originates from a known and trusted identity.
 *
 * 2. Token Validation
 * ---------------------------------------------------------------------------
 * Prevents:
 *   • Token forgery
 *   • Expired token reuse
 *   • Tampered payloads
 *
 * 3. Zero Trust Principle
 * ---------------------------------------------------------------------------
 * Every request must prove its identity — no implicit trust.
 *
 * =============================================================================
 *
 * ⚙️ DESIGN PRINCIPLES
 * =============================================================================
 *
 * • Fail-fast (deny immediately on invalid input)
 * • Stateless verification (no session dependency)
 * • Explicit error signaling
 * • Strong observability (security logs)
 *
 * =============================================================================
 */

const jwt = require("jsonwebtoken");

const {
  unauthorizedError
} = require("../shared/errors/app-error");

const {
  ERROR_CODES
} = require("../shared/errors/error-codes");

const logger =
  require("../infrastructure/logging/logger");

/* =============================================================================
 * CONFIGURATION
 * =============================================================================
 */

const JWT_SECRET = process.env.JWT_SECRET;

/* =============================================================================
 * TOKEN EXTRACTION FUNCTION
 * =============================================================================
 *
 * Extracts Bearer token from Authorization header.
 *
 * Header format:
 *   Authorization: Bearer <token>
 */

function extractToken(req) {
  const authHeader = req.headers["authorization"];

  if (!authHeader) return null;

  const parts = authHeader.split(" ");

  if (parts.length !== 2) return null;

  const [scheme, token] = parts;

  if (scheme !== "Bearer") return null;

  return token;
}

/* =============================================================================
 * AUTH GUARD MIDDLEWARE
 * =============================================================================
 */

function authGuard(req, res, next) {

  /**
   * STEP 1 — Extract Token
   */
  const token = extractToken(req);

  if (!token) {

    logger.warn("Missing authentication token", {
      securityEvent: true,
      category: "AUTH",
      reason: "NO_TOKEN",
      ip: req.ip,
      path: req.originalUrl,
      requestId: req.requestId
    });

    return next(
      unauthorizedError(
        "Authentication token is required",
        ERROR_CODES.AUTH_UNAUTHORIZED
      )
    );
  }

  /**
   * STEP 2 — Verify Token
   */
  jwt.verify(token, JWT_SECRET, (err, decoded) => {

    if (err) {

      logger.warn("Invalid or expired token", {
        securityEvent: true,
        category: "AUTH",
        reason: err.name,
        ip: req.ip,
        path: req.originalUrl,
        requestId: req.requestId
      });

      return next(
        unauthorizedError(
          "Invalid or expired authentication token",
          ERROR_CODES.AUTH_INVALID_TOKEN
        )
      );
    }

    /**
     * STEP 3 — Attach User Context
     */
    req.user = decoded;

    /**
     * Optional contextual metadata for tracing
     */
    req.auth = {
      userId: decoded.id,
      roles: decoded.roles || [],
      issuedAt: decoded.iat,
      expiresAt: decoded.exp
    };

    /**
     * STEP 4 — Continue Pipeline
     */
    return next();
  });
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = authGuard;

/**
 * =============================================================================
 * ADVANCED ARCHITECTURAL NOTES
 * =============================================================================
 *
 * 1. TOKEN STRUCTURE
 * ---------------------------------------------------------------------------
 * Expected JWT payload:
 *
 * {
 *   id: string,
 *   roles: string[],
 *   iat: number,
 *   exp: number
 * }
 *
 * 2. EXTENSIBILITY
 * ---------------------------------------------------------------------------
 * Future enhancements may include:
 *
 *   • Role-based access control (RBAC)
 *   • Attribute-based access control (ABAC)
 *   • Multi-tenant scoping
 *
 * 3. SECURITY HARDENING
 * ---------------------------------------------------------------------------
 *
 * Recommended improvements for high-security environments:
 *
 *   • Token revocation list (Redis)
 *   • Device binding
 *   • IP binding validation
 *
 * 4. PERFORMANCE CHARACTERISTICS
 * ---------------------------------------------------------------------------
 *
 * JWT verification is:
 *
 *   O(1) per request
 *   CPU-bound (signature verification)
 *
 * 5. FAILURE MODES
 * ---------------------------------------------------------------------------
 *
 * This middleware guarantees:
 *
 *   • No silent failures
 *   • Explicit rejection
 *   • Structured logging
 *
 * =============================================================================
 *
 * END OF FILE
 * =============================================================================
 */