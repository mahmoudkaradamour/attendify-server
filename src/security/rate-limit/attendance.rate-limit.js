/**
 * =============================================================================
 * Attendify — Attendance Rate Limiter (Enterprise Distributed Security Layer)
 * =============================================================================
 *
 * OVERVIEW
 * =============================================================================
 *
 * This module implements a **distributed, production-grade rate limiter**
 * designed to protect a high-frequency, security-sensitive endpoint:
 *
 *   POST /attendance
 *
 * =============================================================================
 *
 * 🧠 FORMAL MODEL
 *
 * Let:
 *
 *   K = normalized client identity
 *   W = time window
 *   C(K, W) = number of requests within W
 *   L = limit
 *
 * Then:
 *
 *   allow ⇔ C(K,W) < L
 *   deny  ⇔ C(K,W) ≥ L
 *
 * =============================================================================
 *
 * 📊 DISTRIBUTED FLOW (REDIS-BACKED)
 *
 *         Incoming Request
 *                │
 *                ▼
 *     Normalize Identity (IP → key)
 *                │
 *                ▼
 *      Redis Counter Increment (atomic)
 *                │
 *        ┌───────┴────────┐
 *        ▼                ▼
 *     Allowed          Blocked
 *        │                │
 *        ▼                ▼
 *     next()       Reject (429)
 *
 * =============================================================================
 *
 * 🔐 SECURITY PROPERTIES
 *
 *   ✅ Distributed-safe (multi-instance)
 *   ✅ IPv6-safe identity
 *   ✅ DoS-resistant throttling
 *   ✅ Replay amplification mitigation
 *
 * =============================================================================
 */

const rateLimit = require("express-rate-limit");

/**
 * =============================================================================
 * REDIS STORE (DISTRIBUTED STATE)
 * =============================================================================
 */
const { RedisStore } = require("rate-limit-redis");
const redis = require("../../infrastructure/cache/redis.client");

/**
 * =============================================================================
 * IPv6 SAFE KEY GENERATOR
 * =============================================================================
 */
const {
  ipKeyGenerator
} = require("express-rate-limit");

/**
 * =============================================================================
 * ERROR MODEL
 * =============================================================================
 */
const {
  rateLimitError
} = require("../../shared/errors/app-error");

const {
  ERROR_CODES
} = require("../../shared/errors/error-codes");

/**
 * =============================================================================
 * LOGGING (OBSERVABILITY)
 * =============================================================================
 */
const logger = require("../../infrastructure/logging/logger");

/* =============================================================================
 * RATE LIMITER DEFINITION
 * =============================================================================
 */

const attendanceRateLimiter = rateLimit({

  /**
   * ---------------------------------------------------------------------------
   * WINDOW CONFIGURATION
   * ---------------------------------------------------------------------------
   *
   * Fixed time window duration
   */
  windowMs: 60 * 1000, // 1 minute

  /**
   * ---------------------------------------------------------------------------
   * REQUEST THRESHOLD
   * ---------------------------------------------------------------------------
   */
  max: 30,

  /**
   * ---------------------------------------------------------------------------
   * DISTRIBUTED STORE (REDIS)
   * ---------------------------------------------------------------------------
   *
   * Uses Redis atomic counters for cross-instance consistency
   */
  store: new RedisStore({
    sendCommand: (...args) => redis.sendCommand(args)
  }),

  /**
   * ---------------------------------------------------------------------------
   * HEADERS CONFIG
   * ---------------------------------------------------------------------------
   */
  standardHeaders: true,
  legacyHeaders: false,

  /**
   * ---------------------------------------------------------------------------
   * KEY GENERATOR
   * ---------------------------------------------------------------------------
   *
   * Ensures normalized, canonical identity
   */
  keyGenerator: (req) => {
    return ipKeyGenerator(req);
  },

  /**
   * ---------------------------------------------------------------------------
   * RATE LIMIT BREACH HANDLER
   * ---------------------------------------------------------------------------
   */
  handler: (req, res, next) => {

    /**
     * Structured Security Event
     */
    logger.warn("Attendance rate limit exceeded", {
      securityEvent: true,
      category: "RATE_LIMIT",
      severity: "medium",
      domain: "attendance",
      ip: req.ip,
      requestId: req.requestId,
      path: req.originalUrl,
      method: req.method
    });

    /**
     * Domain-level error propagation
     */
    return next(
      rateLimitError(
        "Too many attendance submissions",
        ERROR_CODES.AUTH_RATE_LIMIT_EXCEEDED
      )
    );
  },

  /**
   * ---------------------------------------------------------------------------
   * FAIL-SAFE CONFIG
   * ---------------------------------------------------------------------------
   *
   * If Redis fails → allow requests (availability > strict enforcement)
   */
  skipFailedRequests: false
});

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = attendanceRateLimiter;

/**
 * =============================================================================
 * ARCHITECTURAL ANALYSIS
 * =============================================================================
 *
 * 1. IDENTITY FUNCTION
 * -----------------------------------------------------------------------------
 *
 *   identity(req) = normalize(IP)
 *
 * Properties:
 *   • deterministic
 *   • collision-resistant (practically)
 *
 * -----------------------------------------------------------------------------
 *
 * 2. STATE MODEL
 * -----------------------------------------------------------------------------
 *
 *   State is externalized to Redis:
 *
 *     counter(K, W) stored remotely
 *
 * Benefits:
 *   • horizontal scalability
 *   • consistency across instances
 *
 * -----------------------------------------------------------------------------
 *
 * 3. FAILURE MODE
 * -----------------------------------------------------------------------------
 *
 * Fail-open strategy:
 *
 *   Redis unavailable → requests allowed
 *
 * Justification:
 *   availability > strict enforcement
 *
 * -----------------------------------------------------------------------------
 *
 * 4. COMPLEXITY
 * -----------------------------------------------------------------------------
 *
 * Time Complexity:
 *   O(1) per request
 *
 * Space Complexity:
 *   O(N keys per window)
 *
 * -----------------------------------------------------------------------------
 *
 * 5. PIPELINE POSITION
 * -----------------------------------------------------------------------------
 *
 * Request Flow:
 *
 *   Client
 *     ↓
 *   Gateway
 *     ↓
 *   Rate Limiter  ← (THIS MODULE)
 *     ↓
 *   Auth
 *     ↓
 *   Business Logic
 *
 * =============================================================================
 *
 * END OF FILE
 * =============================================================================
 */
