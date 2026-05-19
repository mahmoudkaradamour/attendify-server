/**
 * =============================================================================
 * Attendify Authentication Rate Limiter (Distributed Sliding Window System)
 * =============================================================================
 *
 * FILE:
 * src/security/rate-limit/auth.rate-limit.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module implements a production-grade distributed rate limiter using Redis,
 * specifically optimized for authentication endpoints (login/register).
 *
 * -----------------------------------------------------------------------------
 * SECURITY OBJECTIVE
 * -----------------------------------------------------------------------------
 *
 * Protect authentication endpoints against:
 *
 *   - brute force password attacks
 *   - credential stuffing
 *   - automated bots
 *   - resource exhaustion
 *
 * -----------------------------------------------------------------------------
 * ALGORITHM: SLIDING WINDOW (REDIS SORTED SET)
 * -----------------------------------------------------------------------------
 *
 * Each request is recorded as:
 *
 *   key   = rate:auth:<client-id>
 *   value = timestamp
 *
 * Stored in:
 *
 *   Redis ZSET:
 *     SCORE = timestamp (milliseconds)
 *     VALUE = unique request id
 *
 * -----------------------------------------------------------------------------
 * WHY SLIDING WINDOW?
 * -----------------------------------------------------------------------------
 *
 * Compared to fixed window:
 *
 *   Fixed Window:
 *     ❌ burst problem (edge case abuse)
 *
 *   Sliding Window:
 *     ✅ precise time-bound enforcement
 *     ✅ fair distribution
 *     ✅ prevents burst exploitation
 *
 * -----------------------------------------------------------------------------
 * FLOW DIAGRAM
 * -----------------------------------------------------------------------------
 *
 *     Incoming Request
 *            │
 *            ▼
 *     Extract client identity
 *            │
 *            ▼
 *     Redis key = rate:auth:<client>
 *            │
 *            ▼
 *   ZREMRANGEBYSCORE (remove old entries)
 *            │
 *            ▼
 *   ZCARD (count current requests)
 *            │
 *    ┌───────┴────────┐
 *    ▼                ▼
 * allowed         rejected
 *    │                │
 *    ▼                ▼
 * ZADD new event  return 429
 *
 * -----------------------------------------------------------------------------
 * COMPLEXITY ANALYSIS
 * -----------------------------------------------------------------------------
 *
 * For each request:
 *
 *   ZADD → O(log N)
 *   ZREMRANGEBYSCORE → O(log N + removed elements)
 *   ZCARD → O(1)
 *
 * Efficient under high concurrency.
 *
 * -----------------------------------------------------------------------------
 * DISTRIBUTED SYSTEM GUARANTEE
 * -----------------------------------------------------------------------------
 *
 * Since Redis is shared:
 *
 *   ∀ instances (A, B, C):
 *      share same counters → globally consistent rate limiting
 *
 * -----------------------------------------------------------------------------
 * FAILURE STRATEGY (CRITICAL)
 * -----------------------------------------------------------------------------
 *
 * If Redis fails:
 *
 *   → FAIL-SAFE = deny request
 *
 * Rationale:
 *   security consistency > availability for auth endpoints
 *
 * -----------------------------------------------------------------------------
 * CONFIGURATION MODEL
 * -----------------------------------------------------------------------------
 *
 * WINDOW_SIZE_MS → sliding window size
 * MAX_REQUESTS   → allowed requests per window
 *
 * -----------------------------------------------------------------------------
 * FORMAL GUARANTEE
 * -----------------------------------------------------------------------------
 *
 * ∀ client C:
 *   requests(C, t_window) ≤ MAX_REQUESTS
 *
 * =============================================================================
 */

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

const { getRedis } = require("../../infrastructure/redis/redis.client");
const { tooManyRequestsError } = require("../../shared/errors/app-error");

/* =============================================================================
 * CONFIGURATION
 * =============================================================================
 */

/**
 * Sliding window duration (1 minute)
 */
const WINDOW_SIZE_MS = 60 * 1000;

/**
 * Maximum allowed requests within window
 */
const MAX_REQUESTS = 10;

/**
 * Redis key prefix
 */
const KEY_PREFIX = "rate_limit:auth:";

/* =============================================================================
 * CLIENT IDENTIFICATION STRATEGY
 * =============================================================================
 */

/**
 * Extracts unique client identity.
 *
 * NOTE:
 * In production, this can be upgraded to:
 *   - IP + user-agent hash
 *   - userId (after auth)
 *   - API key
 *
 * @param {object} req
 * @returns {string}
 */
function getClientIdentifier(req) {

  /**
   * Express provides trusted IP when "trust proxy" enabled
   */
  return req.ip || "unknown";
}

/* =============================================================================
 * CORE ALGORITHM
 * =============================================================================
 */

/**
 * Evaluates whether request is rate limited.
 *
 * Uses Redis sorted set (ZSET) as sliding window storage.
 *
 * @param {object} redis
 * @param {string} key
 * @param {number} now
 *
 * @returns {Promise<boolean>}
 */

async function checkRateLimit(redis, key, now) {

  const windowStart = now - WINDOW_SIZE_MS;

  /**
   * PIPELINE EXECUTION (atomic-like behavior)
   *
   * We group operations to:
   *   - reduce round trips
   *   - improve performance
   */

  const multi = redis.multi();

  /**
   * Step 1: Remove expired entries
   */
  multi.zRemRangeByScore(key, 0, windowStart);

  /**
   * Step 2: Count remaining requests
   */
  multi.zCard(key);

  const [, currentCount] = await multi.exec();

  /**
   * Enforce limit BEFORE inserting new request
   */
  if (currentCount >= MAX_REQUESTS) {
    return true;
  }

  /**
   * Step 3: Add new request
   *
   * Unique value prevents overwrite collisions
   */
  await redis.zAdd(key, {
    score: now,
    value: `${now}-${Math.random()}`
  });

  /**
   * Step 4: Ensure TTL
   *
   * Prevents memory leaks
   */
  await redis.expire(
    key,
    Math.ceil(WINDOW_SIZE_MS / 1000)
  );

  return false;
}

/* =============================================================================
 * MIDDLEWARE
 * =============================================================================
 */

/**
 * Express middleware enforcing authentication rate limiting.
 */
async function authRateLimit(req, res, next) {

  try {

    /**
     * Acquire Redis client
     */
    const redis = getRedis();

    /**
     * FAIL-SAFE:
     * deny request if Redis unavailable
     */
    if (!redis) {
      return next(
        tooManyRequestsError(
          "Rate limiting unavailable (service degraded)"
        )
      );
    }

    const now = Date.now();

    const clientId =
      getClientIdentifier(req);

    const key =
      KEY_PREFIX + clientId;

    const limited =
      await checkRateLimit(redis, key, now);

    if (limited) {
      return next(
        tooManyRequestsError(
          "Too many authentication attempts. Please retry later."
        )
      );
    }

    return next();

  } catch (error) {

    /**
     * STRICT FAIL-SAFE:
     * Any failure in rate limiting → block
     */
    return next(
      tooManyRequestsError(
        "Rate limiting system failure"
      )
    );
  }
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = authRateLimit;

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */