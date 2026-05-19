/**
 * =============================================================================
 * Attendify — Attendance Submission Rate Limiter (Enterprise-Grade)
 * =============================================================================
 *
 * OVERVIEW
 * =============================================================================
 *
 * This module implements a **high-security rate limiting middleware**
 * for the attendance submission endpoint.
 *
 * The endpoint is considered:
 *
 *   - High-frequency (frequent client devices)
 *   - Security-sensitive (signature validation layer)
 *   - Attack-prone (DoS, brute-force, replay attacks)
 *
 * =============================================================================
 *
 * 🧠 FORMAL MODEL (RATE LIMIT FUNCTION)
 *
 * Let:
 *
 *   R = request stream from client
 *   K = identity key (derived from request)
 *   W = time window
 *   L = max allowed requests
 *
 * Then:
 *
 *   allow(R) ⇔ count(K, W) ≤ L
 *
 * Otherwise:
 *
 *   reject(R)
 *
 * =============================================================================
 *
 * 📊 EXECUTION FLOW (TOKEN BUCKET SIMPLIFIED MODEL)
 *
 *            Incoming Request
 *                   │
 *                   ▼
 *         Extract Client Identity (K)
 *                   │
 *                   ▼
 *         Compute Key via ipKeyGenerator()
 *                   │
 *                   ▼
 *         Increment Counter(K, Window)
 *                   │
 *          ┌────────┴────────┐
 *          ▼                 ▼
 *      ≤ Limit           > Limit
 *          │                 │
 *          ▼                 ▼
 *       next()        Reject (HTTP 429)
 *
 * =============================================================================
 *
 * ⚠️ CRITICAL SECURITY NOTE (IPv6)
 *
 * Direct usage of:
 *
 *   req.ip ❌
 *
 * is unsafe under IPv6 representations and may allow bypass.
 *
 * Therefore:
 *
 *   ✅ ipKeyGenerator(req)
 *
 * MUST be used to normalize address space.
 *
 * =============================================================================
 *
 * 🧪 CONFIGURATION
 *
 * Window: 1 minute
 * Limit: 30 requests / IP
 *
 * =============================================================================
 *
 * 🔐 SECURITY GUARANTEES
 *
 *   ✅ Prevents request flooding
 *   ✅ Mitigates brute-force attempts
 *   ✅ Reduces replay amplification surface
 *   ✅ IPv6-safe identification
 *
 * =============================================================================
 */

const rateLimit = require("express-rate-limit");

/**
 * ✅ Official helper — prevents IPv6 bypass attacks
 */
const {
  ipKeyGenerator
} = require("express-rate-limit");

/* =============================================================================
 * ERROR HANDLING
 * =============================================================================
 */

const {
  rateLimitError
} = require("../../shared/errors/app-error");

const {
  ERROR_CODES
} = require("../../shared/errors/error-codes");

/* =============================================================================
 * OBSERVABILITY
 * =============================================================================
 */

const logger =
  require("../../infrastructure/logging/logger");

/* =============================================================================
 * RATE LIMIT CONFIGURATION
 * =============================================================================
 */

const attendanceRateLimiter = rateLimit({

  /**
   * ---------------------------------------------------------------------------
   * TIME WINDOW
   * ---------------------------------------------------------------------------
   *
   * Defines fixed window duration
   */
  windowMs: 60 * 1000, // 1 minute

  /**
   * ---------------------------------------------------------------------------
   * MAX REQUESTS
   * ---------------------------------------------------------------------------
   */
  max: 30,

  /**
   * ---------------------------------------------------------------------------
   * HEADERS CONFIG
   * ---------------------------------------------------------------------------
   */
  standardHeaders: true,
  legacyHeaders: false,

  /**
   * ---------------------------------------------------------------------------
   * KEY GENERATOR (CRITICAL SECURITY COMPONENT)
   * ---------------------------------------------------------------------------
   *
   * Uses library-provided normalization to ensure:
   *
   *   ✅ IPv4 compatibility
   *   ✅ IPv6 normalization
   *   ✅ Proxy-safe extraction (when configured)
   */
  keyGenerator: (req /*, res */) => {

    return ipKeyGenerator(req);
  },

  /**
   * ---------------------------------------------------------------------------
   * HANDLER (RATE LIMIT BREACH)
   * ---------------------------------------------------------------------------
   *
   * Triggered when limit is exceeded
   */
  handler: (req, res, next /*, options */) => {

    /**
     * Observability event (Security classification)
     */
    logger.warn("Attendance rate limit exceeded", {

      securityEvent: true,

      category: "RATE_LIMIT",

      severity: "medium",

      ip: req.ip,

      requestId: req.requestId,

      path: req.originalUrl,

      method: req.method
    });

    /**
     * Application-level error propagation
     */
    return next(
      rateLimitError(
        "Too many attendance submissions",
        ERROR_CODES.AUTH_RATE_LIMIT_EXCEEDED
      )
    );
  }
});

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = attendanceRateLimiter;

/**
 * =============================================================================
 * ARCHITECTURAL INSIGHTS
 * =============================================================================
 *
 * 1. IDENTITY MODEL
 * -----------------------------------------------------------------------------
 * Identity is derived from IP abstraction (normalized via library),
 * not raw transport value.
 *
 * 2. STATE MODEL
 * -----------------------------------------------------------------------------
 * Rate limiting uses in-memory counters (default),
 * which can be replaced with Redis-backed stores for scalability.
 *
 * 3. EXTENSIBILITY
 * -----------------------------------------------------------------------------
 * This middleware can be upgraded to:
 *
 *   - distributed rate limiting (Redis)
 *   - token bucket algorithms
 *   - per-user limits
 *
 * 4. FAILURE CHARACTERISTIC
 * -----------------------------------------------------------------------------
 * Rejection is deterministic and idempotent:
 *
 *   same request → same outcome after limit breach
 *
 * 5. POSITION IN PIPELINE
 * -----------------------------------------------------------------------------
 *
 *   Request
 *     ↓
 *   Edge Gateway
 *     ↓
 *   Rate Limiter  ← (THIS MODULE)
 *     ↓
 *   Authentication
 *     ↓
 *   Business Logic
 *
 * =============================================================================
 *
 * END OF FILE
 * =============================================================================
 */
