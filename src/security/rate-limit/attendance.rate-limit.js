/**
 * =============================================================================
 * Attendify Attendance Submission Rate Limiter
 * =============================================================================
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * Protects the attendance submission endpoint which is:
 *
 *   ✅ High-frequency
 *   ✅ Exposed to external devices (mobile / IoT)
 *   ✅ Security-sensitive (signature verification)
 *
 * -----------------------------------------------------------------------------
 * THREAT MODEL
 * -----------------------------------------------------------------------------
 *
 * 1. Submission Flooding:
 *    - Massive submission attempts (DoS vector)
 *
 * 2. Signature Brute-force:
 *    - Attempting multiple signatures for same payload
 *
 * 3. Replay Amplification:
 *    - Rapid repeated submissions exploiting timing windows
 *
 * -----------------------------------------------------------------------------
 * STRATEGY
 * -----------------------------------------------------------------------------
 *
 * Window: 1 minute
 * Limit: 30 requests per IP
 *
 * -----------------------------------------------------------------------------
 * FLOW
 * -----------------------------------------------------------------------------
 *
 *                 Incoming Attendance Request
 *                           │
 *                           ▼
 *                  Extract Client Identity
 *                           │
 *                           ▼
 *                  Increment Request Count
 *                           │
 *             ┌─────────────┴─────────────┐
 *             ▼                           ▼
 *          Allowed                    Blocked
 *             │                           │
 *             ▼                           ▼
 *         next()                   Reject (429)
 *
 * -----------------------------------------------------------------------------
 * SECURITY DESIGN PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "High-frequency endpoints must be protected against burst-based abuse."
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

const attendanceRateLimiter = rateLimit({

  windowMs: 60 * 1000,

  max: 30,

  standardHeaders: true,

  legacyHeaders: false,

  keyGenerator: (req) => req.ip,

  handler: (req, res, next) => {

    logger.warn("Attendance rate limit exceeded", {

      securityEvent: true,

      ip: req.ip,

      requestId: req.requestId,

      path: req.originalUrl
    });

    return next(

      rateLimitError(
        "Too many attendance submissions",
        ERROR_CODES.AUTH_RATE_LIMIT_EXCEEDED
      )
    );
  }
});

module.exports = attendanceRateLimiter;