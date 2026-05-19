/**
 * =============================================================================
 * Attendify — Metrics Collection Layer (Deterministic Observability Engine)
 * =============================================================================
 *
 * PURPOSE
 *
 * This module implements a **high-fidelity in-memory metrics system**
 * for real-time observability and operational insight.
 *
 * =============================================================================
 *
 * 🧠 FORMAL MODEL (EVENT → METRIC TRANSFORMATION)
 *
 * Let:
 *
 *   E = system event
 *   M = metric space
 *
 * Then:
 *
 *   f(E) → ΔM
 *
 * where each event maps deterministically to a metric update.
 *
 * =============================================================================
 *
 * 📊 METRICS FLOW
 *
 *        System Event (Request / Error / Job)
 *                      │
 *                      ▼
 *           Metrics Recording API
 *                      │
 *                      ▼
 *           In-Memory Counter State
 *                      │
 *                      ▼
 *        Snapshot / Export Layer (/ready)
 *
 * =============================================================================
 *
 * 📊 COVERED DOMAIN EVENTS
 *
 *   - HTTP traffic
 *       → requests
 *
 *   - Successful execution
 *       → success
 *
 *   - Failures (any layer)
 *       → failure
 *
 *   - Retry mechanisms
 *       → retries
 *
 * =============================================================================
 *
 * 🔐 DESIGN OBJECTIVES
 *
 *   ✅ Deterministic accounting
 *   ✅ Minimal overhead (non-blocking increments)
 *   ✅ Immutable read snapshots
 *   ✅ Zero coupling with business logic
 *
 * =============================================================================
 *
 * 🧱 DESIGN PRINCIPLES
 *
 *   - Push-based updates (event-driven)
 *   - Pull-based observation (snapshot)
 *   - No side effects outside this module
 *
 * =============================================================================
 */

/* =============================================================================
 * INTERNAL STATE (SINGLETON COUNTER STORAGE)
 * =============================================================================
 */

const counters = {
  requests: 0,
  success: 0,
  failure: 0,
  retries: 0
};

/* =============================================================================
 * INTERNAL UTIL — SAFE INCREMENT
 * =============================================================================
 */

function safeIncrement(key, value = 1) {

  if (!Object.prototype.hasOwnProperty.call(counters, key)) {
    return;
  }

  const next = counters[key] + value;

  /**
   * Guard against overflow / invalid state
   */
  if (!Number.isSafeInteger(next)) {
    counters[key] = Number.MAX_SAFE_INTEGER;
    return;
  }

  counters[key] = next;
}

/* =============================================================================
 * SEMANTIC INCREMENT FUNCTIONS
 * =============================================================================
 *
 * These represent meaningful domain events.
 */

/**
 * HTTP request received
 */
function incrementRequests() {
  safeIncrement("requests");
}

/**
 * Successful execution (controller/service/worker)
 */
function incrementSuccess() {
  safeIncrement("success");
}

/**
 * Failed execution (errors, exceptions)
 */
function incrementFailure() {
  safeIncrement("failure");
}

/**
 * Retry triggered (queue / resilience layer)
 */
function incrementRetries() {
  safeIncrement("retries");
}

/* =============================================================================
 * GENERIC INCREMENT (EXTENSIBLE)
 * =============================================================================
 */

function increment(metricName, value = 1) {
  safeIncrement(metricName, value);
}

/* =============================================================================
 * SNAPSHOT (IMMUTABLE VIEW)
 * =============================================================================
 *
 * Guarantees:
 *   - No mutation from outside
 *   - Consistent view at call time
 */

function getMetricsSnapshot() {

  const snapshot = {
    requests: counters.requests,
    success: counters.success,
    failure: counters.failure,
    retries: counters.retries,
    timestamp: Date.now()
  };

  return Object.freeze(snapshot);
}

/* =============================================================================
 * RESET (TEST MODE ONLY)
 * =============================================================================
 */

function resetMetrics() {

  counters.requests = 0;
  counters.success = 0;
  counters.failure = 0;
  counters.retries = 0;
}

/* =============================================================================
 * OPTIONAL PROMETHEUS EXPORT (EXTENSION POINT)
 * =============================================================================
 *
 * Convert metrics to Prometheus exposition format.
 */

function toPrometheusFormat() {

  return [
    `# HELP requests_total Total HTTP requests`,
    `# TYPE requests_total counter`,
    `requests_total ${counters.requests}`,

    `# HELP success_total Successful operations`,
    `# TYPE success_total counter`,
    `success_total ${counters.success}`,

    `# HELP failure_total Failed operations`,
    `# TYPE failure_total counter`,
    `failure_total ${counters.failure}`,

    `# HELP retries_total Retry attempts`,
    `# TYPE retries_total counter`,
    `retries_total ${counters.retries}`
  ].join("\n");
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {

  /**
   * Domain increments
   */
  incrementRequests,
  incrementSuccess,
  incrementFailure,
  incrementRetries,

  /**
   * Generic
   */
  increment,

  /**
   * Snapshot
   */
  getMetricsSnapshot,

  /**
   * Reset (test only)
   */
  resetMetrics,

  /**
   * Observability extension
   */
  toPrometheusFormat
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */
