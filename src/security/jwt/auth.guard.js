/**
 * =============================================================================
 * Attendify — JWT Authentication Guard (Enterprise-Grade Security Middleware)
 * =============================================================================
 *
 * OVERVIEW
 * =============================================================================
 *
 * This module implements a **high-assurance authentication guard** based on
 * JSON Web Tokens (JWT). It is responsible for enforcing **identity validation**
 * at the application boundary, ensuring that only authenticated entities are
 * allowed to access protected resources.
 *
 * This file is considered part of the **core security perimeter**.
 *
 * =============================================================================
 *
 * 🧠 FORMAL AUTHENTICATION MODEL
 * =============================================================================
 *
 * Let:
 *
 *   R  = Incoming HTTP request
 *   H  = Authorization header
 *   T  = Extracted JWT token
 *   V(T) = Token verification function
 *   P  = Decoded payload (user identity)
 *
 * Then:
 *
 *   AUTHENTICATED(R) ⇔ H exists ∧ T extracted ∧ V(T) = valid
 *
 *   Otherwise:
 *
 *   REJECT(R) with 401 Unauthorized
 *
 * =============================================================================
 *
 * 📊 AUTHENTICATION FLOW (DETAILED PIPELINE)
 * =============================================================================
 *
 *                      ┌─────────────────────────┐
 *                      │   Incoming HTTP Request │
 *                      └────────────┬────────────┘
 *                                   │
 *                                   ▼
 *                  Extract Authorization Header
 *                                   │
 *                   ┌───────────────┴───────────────┐
 *                   ▼                               ▼
 *              Missing Header                  Header Exists
 *                   │                               │
 *                   ▼                               ▼
 *             Reject Request            Validate Bearer Format
 *                                                │
 *                               ┌────────────────┴──────────────┐
 *                               ▼                               ▼
 *                         Invalid Format                  Valid Format
 *                               │                               │
 *                               ▼                               ▼
 *                         Reject Request              Verify JWT Signature
 *                                                      │
 *                                     ┌────────────────┴─────────────┐
 *                                     ▼                              ▼
 *                               Invalid | Expired              Valid Token
 *                                     │                              │
 *                                     ▼                              ▼
 *                             Reject Request               Attach Identity
 *                                                               │
 *                                                               ▼
 *                                                            next()
 *
 * =============================================================================
 *
 * 🔐 SECURITY GOALS
 * =============================================================================
 *
 * 1. Strong Identity Assurance
 * ---------------------------------------------------------------------------
 * Guarantees that every request is cryptographically bound to a verified entity.
 *
 * 2. Tamper Resistance
 * ---------------------------------------------------------------------------
 * Ensures token integrity via signature validation.
 *
 * 3. Replay Protection (partial)
 * ---------------------------------------------------------------------------
 * Relies on expiration (exp claim) + optional future revocation strategies.
 *
 * 4. Zero Trust Model
 * ---------------------------------------------------------------------------
 * No request is trusted by default.
 *
 * =============================================================================
 *
 * ⚙️ DESIGN PRINCIPLES
 * =============================================================================
 *
 * • Fail-fast rejection on any invalid condition
 * • Stateless authentication (JWT-based)
 * • Observability via structured logging
 * • Explicit error propagation
 *
 * =============================================================================
 */

const jwt = require("jsonwebtoken");

const {
  unauthorizedError
} = require("../../shared/errors/app-error");

const {
  ERROR_CODES
} = require("../../shared/errors/error-codes");

const logger = require("../../infrastructure/logging/logger");

/* =============================================================================
 * CONFIGURATION
 * =============================================================================
 */

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in environment variables");
}

/* =============================================================================
 * TOKEN EXTRACTION
 * =============================================================================
 *
 * Extracts a token from Authorization header.
 *
 * Expected format:
 *   Authorization: Bearer <token>
 */

function extractBearerToken(req) {

  const header = req.headers["authorization"];

  if (!header) return null;

  const parts = header.split(" ");

  /**
   * Defensive validation against malformed headers
   */
  if (parts.length !== 2) return null;

  const [scheme, token] = parts;

  if (scheme !== "Bearer") return null;

  return token;
}

/* =============================================================================
 * AUTH GUARD
 * =============================================================================
 */

function authGuard(req, res, next) {

  /**
   * ---------------------------------------------------------------------------
   * STEP 1 — Token Extraction
   * ---------------------------------------------------------------------------
   */
  const token = extractBearerToken(req);

  if (!token) {

    logger.warn("Authentication failed: Missing token", {

      securityEvent: true,
      category: "AUTH",

      reason: "TOKEN_MISSING",

      ip: req.ip,
      path: req.originalUrl,
      method: req.method,
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
   * ---------------------------------------------------------------------------
   * STEP 2 — Token Verification
   * ---------------------------------------------------------------------------
   *
   * JWT verification performs:
   *
   *   • Signature validation
   *   • Expiration check
   *   • Payload integrity validation
   */

  try {

    const decoded = jwt.verify(token, JWT_SECRET);

    /**
     * -------------------------------------------------------------------------
     * STEP 3 — Context Injection
     * -------------------------------------------------------------------------
     *
     * Attach authenticated user context to request object.
     */

    req.user = decoded;

    req.auth = {

      /**
       * Identity
       */
      userId: decoded.id,

      /**
       * Authorization attributes
       */
      roles: decoded.roles || [],

      /**
       * Temporal metadata
       */
      issuedAt: decoded.iat,
      expiresAt: decoded.exp
    };

    /**
     * -------------------------------------------------------------------------
     * STEP 4 — Continue Execution
     * -------------------------------------------------------------------------
     */
    return next();

  } catch (error) {

    /**
     * -------------------------------------------------------------------------
     * ERROR HANDLING (SECURITY-CRITICAL)
     * -------------------------------------------------------------------------
     */

    logger.warn("Authentication failed: Invalid token", {

      securityEvent: true,
      category: "AUTH",

      reason: error.name,

      ip: req.ip,
      path: req.originalUrl,
      method: req.method,
      requestId: req.requestId
    });

    return next(
      unauthorizedError(
        "Invalid or expired authentication token",
        ERROR_CODES.AUTH_INVALID_TOKEN
      )
    );
  }
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = authGuard;

/**
 * =============================================================================
 * ADVANCED SECURITY NOTES
 * =============================================================================
 *
 * 1. JWT CLAIMS MODEL
 * ---------------------------------------------------------------------------
 *
 * Standard payload expected:
 *
 * {
 *   id: string,
 *   roles: string[],
 *   iat: number,
 *   exp: number
 * }
 *
 * 2. EXTENSION POINTS
 * ---------------------------------------------------------------------------
 *
 * This guard can be extended with:
 *
 *   • RBAC enforcement layer
 *   • Permission resolvers
 *   • Multi-tenant scoping
 *   • Device validation
 *
 * 3. RECOMMENDED HARDENING (ENTERPRISE)
 * ---------------------------------------------------------------------------
 *
 *   ✔ Token revocation list (Redis)
 *   ✔ Short-lived access tokens
 *   ✔ Refresh token rotation
 *   ✔ IP / Device binding
 *
 * 4. PERFORMANCE CHARACTERISTICS
 * ---------------------------------------------------------------------------
 *
 *   • O(1) verification time
 *   • CPU-bound cryptographic validation
 *   • No DB dependency (stateless)
 *
 * 5. FAILURE MODES
 * ---------------------------------------------------------------------------
 *
 *   • Missing token → 401
 *   • Malformed token → 401
 *   • Expired token → 401
 *   • Invalid signature → 401
 *
 * =============================================================================
 *
 * END OF FILE
 * =============================================================================
 */
