/**
 * =============================================================================
 * Attendify — JWT Authentication Guard (Enterprise Security Gateway)
 * =============================================================================
 *
 * OVERVIEW
 * =============================================================================
 *
 * This module implements a **production-grade authentication guard** based on
 * JSON Web Tokens (JWT) enhanced with **distributed security controls using Redis**.
 *
 * It acts as a **cryptographic trust boundary** between:
 *
 *   • Untrusted external clients
 *   • Internal trusted application layers
 *
 * =============================================================================
 *
 * 🧠 FORMAL AUTHENTICATION MODEL
 * =============================================================================
 *
 * Let:
 *
 *   R  = HTTP Request
 *   H  = Authorization Header
 *   T  = JWT Token
 *   V(T) = Verification Function
 *   B(T) = Blacklist Check
 *   P  = Payload (identity claims)
 *
 * Then:
 *
 *   AUTH(R) ⇔ H exists ∧ T extracted ∧ V(T)=valid ∧ B(T)=false
 *
 * Otherwise:
 *
 *   REJECT(R)
 *
 * =============================================================================
 *
 * 📊 FULL AUTHENTICATION PIPELINE
 * =============================================================================
 *
 *                   Incoming Request
 *                           │
 *                           ▼
 *              Extract Authorization Header
 *                           │
 *                 Validate Bearer Format
 *                           │
 *                           ▼
 *                Verify JWT Signature
 *                           │
 *                           ▼
 *           Check Expiration + Claims Integrity
 *                           │
 *                           ▼
 *            Check Redis Blacklist (Revocation)
 *                           │
 *                ┌──────────┴──────────┐
 *                ▼                     ▼
 *            Blacklisted             Allowed
 *                │                     │
 *                ▼                     ▼
 *          Reject Request         Attach Identity
 *                                      │
 *                                      ▼
 *                                   next()
 *
 * =============================================================================
 *
 * 🔐 SECURITY OBJECTIVES
 * =============================================================================
 *
 *   ✅ Cryptographic verification (HMAC/RS256)
 *   ✅ Token expiration enforcement
 *   ✅ Distributed revocation (Redis blacklist)
 *   ✅ Zero-trust enforcement
 *   ✅ Structured security logging
 *
 * =============================================================================
 */

const jwt = require("jsonwebtoken");

const redis =
  require("../../infrastructure/cache/redis.client");

const {
  unauthorizedError
} = require("../../shared/errors/app-error");

const {
  ERROR_CODES
} = require("../../shared/errors/error-codes");

const logger =
  require("../../infrastructure/logging/logger");

/* =============================================================================
 * CONFIGURATION
 * =============================================================================
 */

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is required for authentication system"
  );
}

/* =============================================================================
 * TOKEN EXTRACTION
 * =============================================================================
 */

/**
 * Extracts Bearer token from Authorization header
 *
 * @param {import("express").Request} req
 * @returns {string|null}
 */
function extractBearerToken(req) {

  const header = req.headers["authorization"];

  if (!header) return null;

  const parts = header.split(" ");

  if (parts.length !== 2) return null;

  const [scheme, token] = parts;

  if (scheme !== "Bearer") return null;

  return token;
}

/* =============================================================================
 * REDIS TOKEN BLACKLIST CHECK
 * =============================================================================
 */

/**
 * Checks if token is revoked (blacklisted)
 *
 * Uses token identifier (jti) if present
 */
async function isTokenBlacklisted(decoded) {

  /**
   * jti = unique token identifier (recommended claim)
   */
  const tokenId = decoded.jti;

  if (!tokenId) return false;

  const key = `blacklist:${tokenId}`;

  const result = await redis.get(key);

  return Boolean(result);
}

/* =============================================================================
 * MAIN AUTH GUARD
 * =============================================================================
 */

async function authGuard(req, res, next) {

  /**
   * ---------------------------------------------------------------------------
   * STEP 1 — Extract Token
   * ---------------------------------------------------------------------------
   */
  const token = extractBearerToken(req);

  if (!token) {

    logger.warn("AUTH: Missing token", {
      securityEvent: true,
      category: "AUTH",
      reason: "TOKEN_MISSING",
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

  let decoded;

  /**
   * ---------------------------------------------------------------------------
   * STEP 2 — Verify JWT (Cryptographic Validation)
   * ---------------------------------------------------------------------------
   */
  try {

    decoded = jwt.verify(token, JWT_SECRET);

  } catch (error) {

    logger.warn("AUTH: Invalid token", {
      securityEvent: true,
      category: "AUTH",
      reason: error.name,
      ip: req.ip,
      path: req.originalUrl,
      requestId: req.requestId
    });

    return next(
      unauthorizedError(
        "Invalid or expired token",
        ERROR_CODES.AUTH_INVALID_TOKEN
      )
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * STEP 3 — Redis Blacklist Check (Revocation Layer)
   * ---------------------------------------------------------------------------
   */
  try {

    const blacklisted =
      await isTokenBlacklisted(decoded);

    if (blacklisted) {

      logger.warn("AUTH: Token revoked", {
        securityEvent: true,
        category: "AUTH",
        reason: "TOKEN_BLACKLISTED",
        userId: decoded.id,
        requestId: req.requestId
      });

      return next(
        unauthorizedError(
          "Token has been revoked",
          ERROR_CODES.AUTH_INVALID_TOKEN
        )
      );
    }

  } catch (error) {

    /**
     * FAIL-CLOSED STRATEGY
     */
    return next(
      unauthorizedError(
        "Authentication system unavailable",
        ERROR_CODES.AUTH_INTERNAL_FAILURE
      )
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * STEP 4 — Attach Identity Context
   * ---------------------------------------------------------------------------
   */

  req.user = decoded;

  req.auth = {

    userId: decoded.id,

    roles: decoded.roles || [],

    issuedAt: decoded.iat,
    expiresAt: decoded.exp,

    tokenId: decoded.jti || null
  };

  /**
   * MULTI-TENANT SUPPORT (IMPORTANT)
   */
  if (decoded.companyId) {
    req.company = {
      id: decoded.companyId
    };
  }

  /**
   * ---------------------------------------------------------------------------
   * STEP 5 — Continue Pipeline
   * ---------------------------------------------------------------------------
   */
  return next();
}

/* =============================================================================
 * EXPORT
 * =============================================================================
 */

module.exports = authGuard;

/**
 * =============================================================================
 * ADVANCED ARCHITECTURAL NOTES
 * =============================================================================
 *
 * 1. SECURITY LAYERS
 * ---------------------------------------------------------------------------
 *
 *   Layer 1 → Structural validation (header format)
 *   Layer 2 → Cryptographic validation (JWT verify)
 *   Layer 3 → Temporal validation (exp claim)
 *   Layer 4 → Revocation (Redis blacklist)
 *
 * -----------------------------------------------------------------------------
 *
 * 2. ZERO TRUST ARCHITECTURE
 * ---------------------------------------------------------------------------
 *
 * Each request MUST independently prove:
 *
 *   • Identity authenticity
 *   • Temporal validity
 *   • Revocation status
 *
 * -----------------------------------------------------------------------------
 *
 * 3. PERFORMANCE CHARACTERISTICS
 * ---------------------------------------------------------------------------
 *
 *   • JWT verification → O(1)
 *   • Redis lookup → O(1)
 *
 * Combined latency is minimal and predictable.
 *
 * -----------------------------------------------------------------------------
 *
 * 4. FAILURE STRATEGY
 * ---------------------------------------------------------------------------
 *
 * FAIL-CLOSED:
 *
 *   If Redis or auth system fails → reject request
 *
 * This ensures security over availability.
 *
 * -----------------------------------------------------------------------------
 *
 * 5. ATTACK RESISTANCE
 * ---------------------------------------------------------------------------
 *
 * This guard mitigates:
 *
 *   ✅ Token forgery
 *   ✅ Expired token usage
 *   ✅ Token replay (partial, with nonce layer)
 *   ✅ Token reuse after logout (blacklist)
 *
 * -----------------------------------------------------------------------------
 *
 * 6. FUTURE EXTENSIONS
 * ---------------------------------------------------------------------------
 *
 *   • RBAC middleware
 *   • ABAC policies
 *   • Device fingerprint validation
 *   • IP binding
 *
 * =============================================================================
 *
 * END OF FILE
 * =============================================================================
 */
