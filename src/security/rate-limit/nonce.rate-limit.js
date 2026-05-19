/**
 * =============================================================================
 * Attendify Nonce Generation Rate Limiter
 * =============================================================================
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * Protects the nonce issuance endpoint from abuse.
 *
 * Nonce endpoints are deceptively dangerous because:
 *
 *   ✅ They are unauthenticated
 *   ✅ They generate security-critical tokens
 *   ✅ They can be abused for resource exhaustion
 *
 * -----------------------------------------------------------------------------
 * THREAT MODEL
 * -----------------------------------------------------------------------------
 *
 * 1. Resource Exhaustion Attack:
 *    - Flood system with nonce requests
 *    - Exhaust Redis / Memory store
 *
 * 2. Precomputation Attack:
 *    - Generate large pools of nonces for later misuse
 *
 * 3. API Abuse:
 *    - Use nonce endpoint as amplification vector
 *
 * -----------------------------------------------------------------------------
 * STRATEGY
 * -----------------------------------------------------------------------------
 *
 * Window: 5 minutes
 * Limit: 60 requests per IP
 *
 * -----------------------------------------------------------------------------
 * FLOW
 * -----------------------------------------------------------------------------
 *
 *         Client Request
 *             │
 *             ▼
 *      Identify IP Address
 *             │
 *             ▼
 *     Increment Request Counter
 *             │
 *     ┌───────┴────────┐
 *     ▼                ▼
 *   Allowed         Blocked
 *     │                │
 *     ▼                ▼
 *  next()          429 Error
 *
 * -----------------------------------------------------------------------------
 * DESIGN PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Public endpoints must remain resilient against volumetric abuse."
 *
 * =============================================================================
 */

const rateLimit = require("express-rate-limit");

const {
  rateLimitError
} = require("../../shared/errors/app-error");

const {
  ERROR_CODES
} = require("../../shared/errors/error-codes");

const logger = require("../../infrastructure/logging/logger");

const nonceRateLimiter = rateLimit({

  windowMs: 5 * 60 * 1000,

  max: 60,

  standardHeaders: true,

  legacyHeaders: false,

  keyGenerator: (req) => req.ip,

  handler: (req, res, next) => {

    logger.warn("Nonce endpoint rate limit exceeded", {

      securityEvent: true,

      ip: req.ip,

      requestId: req.requestId
    });

    return next(

      rateLimitError(
        "Too many nonce generation requests",
        ERROR_CODES.AUTH_RATE_LIMIT_EXCEEDED
      )
    );
  }
});

module.exports = nonceRateLimiter;