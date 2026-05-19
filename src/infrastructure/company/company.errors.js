/**
 * =============================================================================
 * Attendify — Company Error Normalization & Classification Layer
 * =============================================================================
 *
 * FILE:
 *   src/infrastructure/company/company.errors.js
 *
 * =============================================================================
 * 🎯 PURPOSE (FORMAL — ACADEMIC)
 * =============================================================================
 *
 * This module defines a **controlled error abstraction boundary** that ensures:
 *
 *   ✅ All external errors are normalized into a finite, deterministic space
 *   ✅ Retry logic is derived from formal classification
 *   ✅ Error messages are safe for propagation (trace-safe)
 *   ✅ System observability is preserved
 *
 * -----------------------------------------------------------------------------
 * 🧠 FORMAL MODEL
 * -----------------------------------------------------------------------------
 *
 * Let:
 *
 *   E_ext = infinite and heterogeneous error space
 *   E_int = finite normalized error space
 *
 * Mapping:
 *
 *   N : E_ext → E_int
 *
 * Properties:
 *   - Deterministic
 *   - Side-effect free
 *   - Security preserving
 *
 * -----------------------------------------------------------------------------
 * 📊 FLOW DIAGRAM (ERROR PIPELINE)
 * -----------------------------------------------------------------------------
 *
 *         External Failure Source
 *               │
 *               ▼
 *     Raw Error (Untrusted Input)
 *               │
 *               ▼
 *   ┌──────────────────────────────┐
 *   │  Error Classification Layer  │
 *   │  (THIS MODULE)               │
 *   └──────────────┬───────────────┘
 *                  │
 *                  ▼
 *     Normalized + Structured Error
 *                  │
 *                  ▼
 *    Retry Decision + Logging System
 *
 * -----------------------------------------------------------------------------
 * 🔐 SECURITY MODEL
 * -----------------------------------------------------------------------------
 *
 *   ❌ Do NOT expose:
 *     - stack traces
 *     - internal URLs
 *     - raw server responses
 *
 *   ✅ Provide:
 *     - minimal trace-safe message
 *     - structured metadata
 *
 * =============================================================================
 */

/* =============================================================================
 * ERROR CODE ENUM (FINITE CONTROLLED SPACE)
 * =============================================================================
 */

const ERROR_CODES = Object.freeze({

  NETWORK_FAILURE: "NETWORK_FAILURE",
  TIMEOUT: "TIMEOUT",
  CIRCUIT_OPEN: "CIRCUIT_OPEN",

  AUTH_FAILURE: "AUTH_FAILURE",
  RATE_LIMITED: "RATE_LIMITED",

  COMPANY_REJECTED: "COMPANY_REJECTED",
  COMPANY_SERVER_ERROR: "COMPANY_SERVER_ERROR",

  INVALID_RESPONSE: "INVALID_RESPONSE",

  UNKNOWN: "UNKNOWN"
});

/* =============================================================================
 * RETRY POLICY MATRIX (FORMALIZED DECISION TABLE)
 * =============================================================================
 *
 * retryable = TRUE:
 *   → transient error
 *   → retry is safe
 *
 * retryable = FALSE:
 *   → logical failure
 *   → retry would repeat same outcome
 */

const RETRY_POLICY = Object.freeze({

  [ERROR_CODES.NETWORK_FAILURE]: true,
  [ERROR_CODES.TIMEOUT]: true,
  [ERROR_CODES.CIRCUIT_OPEN]: true,
  [ERROR_CODES.COMPANY_SERVER_ERROR]: true,
  [ERROR_CODES.RATE_LIMITED]: true,

  [ERROR_CODES.AUTH_FAILURE]: false,
  [ERROR_CODES.COMPANY_REJECTED]: false,
  [ERROR_CODES.INVALID_RESPONSE]: false,
  [ERROR_CODES.UNKNOWN]: false

});

/* =============================================================================
 * TRACE-SAFE ERROR BUILDER
 * =============================================================================
 *
 * Ensures no sensitive internal data is leaked.
 *
 * Output Contract:
 *
 * {
 *   code,
 *   message,
 *   retryable,
 *   timestamp,
 *   requestId
 * }
 */

function buildError({ code, message, requestId }) {

  return Object.freeze({
    code,
    message,
    retryable: RETRY_POLICY[code] ?? false,
    timestamp: Date.now(),
    requestId: requestId || null
  });
}

/* =============================================================================
 * MAIN NORMALIZATION FUNCTION
 * =============================================================================
 */

function normalizeCompanyError(error, context = {}) {

  const requestId = context.requestId || null;

  /**
   * ---------------------------------------------------------------------------
   * STEP 1 — NULL / UNDEFINED SAFETY
   * ---------------------------------------------------------------------------
   */
  if (!error) {
    return buildError({
      code: ERROR_CODES.UNKNOWN,
      message: "Unknown failure",
      requestId
    });
  }

  /**
   * ---------------------------------------------------------------------------
   * STEP 2 — NETWORK FAILURES
   * ---------------------------------------------------------------------------
   */
  if (
    error.name === "FetchError" ||
    error.code === "ECONNREFUSED" ||
    error.code === "ENOTFOUND"
  ) {
    return buildError({
      code: ERROR_CODES.NETWORK_FAILURE,
      message: "Network communication failure",
      requestId
    });
  }

  /**
   * ---------------------------------------------------------------------------
   * STEP 3 — TIMEOUT
   * ---------------------------------------------------------------------------
   */
  if (error.name === "AbortError") {
    return buildError({
      code: ERROR_CODES.TIMEOUT,
      message: "Timeout exceeded",
      requestId
    });
  }

  /**
   * ---------------------------------------------------------------------------
   * STEP 4 — CIRCUIT BREAKER
   * ---------------------------------------------------------------------------
   */
  if (
    typeof error.message === "string" &&
    error.message.includes("Circuit breaker open")
  ) {
    return buildError({
      code: ERROR_CODES.CIRCUIT_OPEN,
      message: "Service temporarily unavailable",
      requestId
    });
  }

  /**
   * ---------------------------------------------------------------------------
   * STEP 5 — HTTP STATUS-AWARE MAPPING
   * ---------------------------------------------------------------------------
   *
   * DIRECT mapping from client-level response
   */

  const status = error.status || error.statusCode;

  if (status) {

    /**
     * 401 / 403 → AUTH FAILURE
     */
    if (status === 401 || status === 403) {
      return buildError({
        code: ERROR_CODES.AUTH_FAILURE,
        message: "Authentication rejected by company",
        requestId
      });
    }

    /**
     * 429 → RATE LIMIT
     */
    if (status === 429) {
      return buildError({
        code: ERROR_CODES.RATE_LIMITED,
        message: "Company rate limit exceeded",
        requestId
      });
    }

    /**
     * 4xx → CLIENT REJECTION (NON-RETRYABLE)
     */
    if (status >= 400 && status < 500) {
      return buildError({
        code: ERROR_CODES.COMPANY_REJECTED,
        message: "Request rejected by company",
        requestId
      });
    }

    /**
     * 5xx → SERVER FAILURE (RETRYABLE)
     */
    if (status >= 500) {
      return buildError({
        code: ERROR_CODES.COMPANY_SERVER_ERROR,
        message: "Company internal failure",
        requestId
      });
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * STEP 6 — MALFORMED RESPONSE
   * ---------------------------------------------------------------------------
   */
  if (
    error.message &&
    error.message.includes("Unexpected token")
  ) {
    return buildError({
      code: ERROR_CODES.INVALID_RESPONSE,
      message: "Invalid response format",
      requestId
    });
  }

  /**
   * ---------------------------------------------------------------------------
   * STEP 7 — FALLBACK
   * ---------------------------------------------------------------------------
   */
  return buildError({
    code: ERROR_CODES.UNKNOWN,
    message: "Unhandled internal error",
    requestId
  });
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  normalizeCompanyError,
  ERROR_CODES
};

/**
 * =============================================================================
 * 🏁 END OF FILE
 * =============================================================================
 *
 * =============================================================================
 * 🧠 ACADEMIC NOTES
 * =============================================================================
 *
 * This module reduces:
 *
 *   |E_ext| → ∞
 *   into
 *   |E_int| → finite set
 *
 * This enables:
 *
 *   ✅ deterministic retry decisions
 *   ✅ stable API contracts
 *   ✅ observability (metrics grouping)
 *
 * -----------------------------------------------------------------------------
 * IN SYSTEM THEORY TERMS
 * -----------------------------------------------------------------------------
 *
 * This layer enforces:
 *
 *   Entropy Reduction in Error Space
 *
 * Which improves:
 *
 *   - predictability
 *   - recoverability
 *   - fault isolation
 *
 * -----------------------------------------------------------------------------
 * CRITICAL WARNING
 * -----------------------------------------------------------------------------
 *
 * Any bypass of this layer introduces:
 *
 *   ❗ inconsistent error semantics
 *   ❗ security leakage
 *   ❗ retry misbehavior
 *
 * =============================================================================
 */