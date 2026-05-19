/**
 * =============================================================================
 * Attendify — JWT Token Service (Cryptographic Authentication Kernel)
 * =============================================================================
 *
 * PURPOSE
 *
 * This module implements a **secure, deterministic JWT abstraction layer**
 * responsible for token issuance and verification.
 *
 * =============================================================================
 *
 * 🧠 FORMAL MODEL (TOKEN TRUST FUNCTION)
 *
 * Let:
 *
 *   P = payload
 *   T = token
 *
 * Then:
 *
 *   generate(P) → T
 *   verify(T) → P'
 *
 * where:
 *
 *   P' = trusted payload
 *
 * =============================================================================
 *
 * 📊 SIGNING FLOW
 *
 *   Input Payload
 *        │
 *        ▼
 *   Normalize Payload
 *        │
 *        ▼
 *   jwt.sign(...)
 *        │
 *        ▼
 *     Token Output
 *
 * =============================================================================
 *
 * 📊 VERIFICATION FLOW
 *
 *        Token Input
 *             │
 *             ▼
 *      jwt.verify(...)
 *             │
 *      ┌──────┴────────┐
 *      ▼               ▼
 *   Invalid         Valid
 *      │               │
 *      ▼               ▼
 *   Reject       Normalize Payload
 *                     │
 *                     ▼
 *                  Return
 *
 * =============================================================================
 *
 * 🔐 SECURITY OBJECTIVES
 *
 *   ✅ Strong signature verification
 *   ✅ Strict claim validation
 *   ✅ Minimal payload surface
 *   ✅ Controlled token lifetime
 *
 * =============================================================================
 *
 * ⚠️ CRITICAL RULES
 *
 *   - NEVER trust raw decoded payload
 *   - ALWAYS normalize before returning
 *   - NEVER expose sensitive claims
 *
 * =============================================================================
 */

const jwt = require("jsonwebtoken");

const config = require("../../config/env");

const AppError =
  require("../../shared/errors/app-error");

/* =============================================================================
 * CONFIGURATION
 * =============================================================================
 */

const JWT_ALGORITHM = "HS256";

const JWT_ISSUER =
  process.env.JWT_ISSUER || "attendify";

const JWT_AUDIENCE =
  process.env.JWT_AUDIENCE || "attendify-clients";

/* =============================================================================
 * SAFE PAYLOAD NORMALIZATION (SIGNING)
 * =============================================================================
 */

function normalizePayload(input) {

  if (!input || typeof input !== "object") {
    throw new AppError("Invalid payload", 500);
  }

  if (!input.userId && !input.sub) {
    throw new AppError("Missing subject", 500);
  }

  return {
    /**
     * Standard JWT subject
     */
    sub: input.sub || input.userId,

    /**
     * Optional structured fields
     */
    roles: Array.isArray(input.roles)
      ? input.roles
      : [],

    permissions: Array.isArray(input.permissions)
      ? input.permissions
      : []
  };
}

/* =============================================================================
 * TOKEN GENERATION
 * =============================================================================
 */

function generate(payload) {

  const normalized = normalizePayload(payload);

  const token = jwt.sign(
    normalized,
    config.JWT_SECRET,
    {
      algorithm: JWT_ALGORITHM,
      expiresIn: config.JWT_EXPIRES,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    }
  );

  return token;
}

/* =============================================================================
 * TOKEN VERIFICATION
 * =============================================================================
 */

function verify(token) {

  if (!token || typeof token !== "string") {
    throw new AppError("Invalid token", 401);
  }

  try {

    const decoded =
      jwt.verify(
        token,
        config.JWT_SECRET,
        {
          algorithms: [JWT_ALGORITHM],
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE
        }
      );

    /**
     * Normalize and return trusted payload
     */
    return {
      sub: decoded.sub,
      roles: Array.isArray(decoded.roles)
        ? decoded.roles
        : [],
      permissions: Array.isArray(decoded.permissions)
        ? decoded.permissions
        : [],
      iat: decoded.iat,
      exp: decoded.exp
    };

  } catch (_) {

    /**
     * Unified security error
     */
    throw new AppError(
      "Invalid or expired token",
      401
    );
  }
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  generate,
  verify
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */
