/**
 * =============================================================================
 * Attendify — Retry Engine (Enterprise-Grade Resilience System)
 * =============================================================================
 *
 * FILE:
 *   src/infrastructure/resilience/retry.js
 *
 * =============================================================================
 * 🎯 PURPOSE (FORMAL & SYSTEM THEORY)
 * =============================================================================
 *
 * This module implements a **bounded, policy-driven retry mechanism**
 * for handling transient failures in distributed systems.
 *
 * -----------------------------------------------------------------------------
 * 🧠 FORMAL MODEL
 * -----------------------------------------------------------------------------
 *
 * Let:
 *
 *   fn = operation to execute
 *   A  = attempt index
 *   E  = error
 *
 * Then:
 *
 *   Retry(fn) executes:
 *
 *     fn₀ → fn₁ → fn₂ → ... → fnₙ
 *
 * subject to:
 *
 *   - bounded retry count
 *   - retry policy (retryable flag)
 *
 * -----------------------------------------------------------------------------
 * 📊 FLOW DIAGRAM (DETERMINISTIC EXECUTION)
 * -----------------------------------------------------------------------------
 *
 *         START
 *           │
 *           ▼
 *     Execute fn()
 *           │
 *     ┌─────┴────────────┐
 *     ▼                  ▼
 *  SUCCESS            FAILURE
 *     │                  │
 *     ▼                  ▼
 *   RETURN        error.retryable ?
 *                         │
 *        ┌────────────────┴───────────────┐
 *        ▼                                ▼
 *   NON-RETRYABLE                    RETRYABLE
 *        │                                │
 *        ▼                                ▼
 *      THROW                     attempts exhausted?
 *                                      │
 *               ┌───────────────────────┴──────────────┐
 *               ▼                                      ▼
 *            YES → THROW                         NO → WAIT + RETRY
 *
 * -----------------------------------------------------------------------------
 * 📊 BACKOFF FUNCTION
 * -----------------------------------------------------------------------------
 *
 *   D(A) = min(baseDelay * 2^A + jitter, maxDelay)
 *
 * WHERE:
 *
 *   - exponential component → grows delay
 *   - jitter → randomizes retry timing
 *
 * -----------------------------------------------------------------------------
 * 🔐 RELIABILITY OBJECTIVES
 * -----------------------------------------------------------------------------
 *
 *   ✅ Handle transient failures (network, 5xx, timeout)
 *   ✅ Avoid retry storms via jitter
 *   ✅ Enforce deterministic retry limits
 *
 * -----------------------------------------------------------------------------
 * 🧱 DESIGN PRINCIPLES
 * -----------------------------------------------------------------------------
 *
 *   - Retry ≠ infinite loop
 *   - Delay must increase
 *   - Randomization is required (jitter)
 *   - External policy decides retryability
 *
 * =============================================================================
 */

/* =============================================================================
 * CONFIGURATION CONSTANTS
 * =============================================================================
 */

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_BASE_DELAY = 300;       // ms
const DEFAULT_JITTER_MAX = 500;       // ms
const MAX_DELAY_CAP = 8000;           // ms (upper bound)

/* =============================================================================
 * BACKOFF CALCULATION
 * =============================================================================
 *
 * Exponential + Jitter
 */

function computeDelay(attempt, baseDelay, jitterMax) {

  /**
   * Exponential growth
   */
  const exponential = baseDelay * Math.pow(2, attempt);

  /**
   * Random jitter
   */
  const jitter = Math.floor(Math.random() * jitterMax);

  /**
   * Cap delay
   */
  return Math.min(exponential + jitter, MAX_DELAY_CAP);
}

/* =============================================================================
 * NON-BLOCKING DELAY
 * =============================================================================
 */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* =============================================================================
 * MAIN EXECUTION ENGINE
 * =============================================================================
 *
 * Executes async function with controlled retry.
 *
 * -----------------------------------------------------------------------------
 * OPTIONS:
 *
 *   - maxRetries
 *   - baseDelay
 *   - jitterMax
 *   - onRetry (hook)
 *
 * -----------------------------------------------------------------------------
 * ERROR CONTRACT:
 *
 *   error.retryable === true  → retry allowed
 *   error.retryable === false → fail fast
 *
 * -----------------------------------------------------------------------------
 */

async function executeWithRetry(fn, options = {}) {

  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelay = options.baseDelay ?? DEFAULT_BASE_DELAY;
  const jitterMax = options.jitterMax ?? DEFAULT_JITTER_MAX;
  const onRetry = typeof options.onRetry === "function"
    ? options.onRetry
    : null;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {

    try {

      /**
       * -----------------------------------------------------------
       * EXECUTION ATTEMPT
       * -----------------------------------------------------------
       */
      const result = await fn();

      return result;

    } catch (error) {

      lastError = error;

      /**
       * -----------------------------------------------------------
       * NON-RETRYABLE FAILURE (FAIL FAST)
       * -----------------------------------------------------------
       */
      if (!error || error.retryable === false) {
        throw error;
      }

      /**
       * -----------------------------------------------------------
       * LAST ATTEMPT CHECK
       * -----------------------------------------------------------
       */
      if (attempt === maxRetries) {
        break;
      }

      /**
       * -----------------------------------------------------------
       * COMPUTE BACKOFF DELAY
       * -----------------------------------------------------------
       */
      const delay = computeDelay(
        attempt,
        baseDelay,
        jitterMax
      );

      /**
       * -----------------------------------------------------------
       * HOOK (LOGGING / METRICS)
       * -----------------------------------------------------------
       */
      if (onRetry) {
        try {
          onRetry({
            attempt,
            delay,
            error
          });
        } catch (_) {
          /**
           * Hook isolation:
           * prevent failure propagation
           */
        }
      }

      /**
       * -----------------------------------------------------------
       * WAIT BEFORE RETRY
       * -----------------------------------------------------------
       */
      await sleep(delay);
    }
  }

  /**
   * ---------------------------------------------------------------
   * EXHAUSTED RETRIES
   * ---------------------------------------------------------------
   */
  throw lastError;
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  executeWithRetry,
  computeDelay
};

/**
 * =============================================================================
 * 🏁 END OF FILE
 * =============================================================================
 *
 * =============================================================================
 * 🧠 ACADEMIC INSIGHTS
 * =============================================================================
 *
 * This module is based on:
 *
 *   → Exponential Backoff Algorithm
 *   → Randomized Retry (Jitter Model)
 *   → Fault-Tolerant Distributed Systems
 *
 * -----------------------------------------------------------------------------
 * MATHEMATICAL PROPERTY
 * -----------------------------------------------------------------------------
 *
 * Delay grows exponentially:
 *
 *   D(n) ∈ O(2^n)
 *
 * bounded by:
 *
 *   D(n) ≤ MAX_DELAY_CAP
 *
 * -----------------------------------------------------------------------------
 * SYSTEM BENEFITS
 * -----------------------------------------------------------------------------
 *
 *   ✅ Reduces load on failing systems
 *   ✅ Prevents synchronized retry storms
 *   ✅ Improves eventual success probability
 *
 * -----------------------------------------------------------------------------
 * FAILURE WITHOUT JITTER
 * -----------------------------------------------------------------------------
 *
 *   → Thundering Herd Problem
 *
 * -----------------------------------------------------------------------------
 * INTEGRATION REQUIREMENTS
 * -----------------------------------------------------------------------------
 *
 * Must be used with:
 *
 *   ✅ error normalization (retryable flag)
 *   ✅ circuit breaker (failure isolation)
 *   ✅ metrics (retry tracking)
 *
 * -----------------------------------------------------------------------------
 * FINAL PROPERTY
 * -----------------------------------------------------------------------------
 *
 * The retry engine guarantees:
 *
 *   - bounded execution
 *   - probabilistic load distribution
 *   - safe recovery attempts
 *
 * =============================================================================
 */