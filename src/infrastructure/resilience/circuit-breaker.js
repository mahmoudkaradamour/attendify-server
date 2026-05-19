/**
 * =============================================================================
 * Attendify — Circuit Breaker (Enterprise-Grade Resilience FSM)
 * =============================================================================
 *
 * FILE:
 *   src/infrastructure/resilience/circuit-breaker.js
 *
 * =============================================================================
 * 🎯 PURPOSE (FORMAL — DISTRIBUTED SYSTEMS)
 * =============================================================================
 *
 * This module implements a **Finite State Machine (FSM)-based Circuit Breaker**
 * for protecting the system against unstable external services.
 *
 * It provides:
 *
 *   ✅ Failure containment
 *   ✅ Controlled recovery probing
 *   ✅ System stability under degraded dependencies
 *
 * -----------------------------------------------------------------------------
 * 🧠 FORMAL MODEL
 * -----------------------------------------------------------------------------
 *
 * Let:
 *
 *   S ∈ {CLOSED, OPEN, HALF_OPEN}
 *   F = failure count
 *   T = time
 *
 * Then:
 *
 *   state transitions are governed by:
 *
 *     (F, T, success/failure events)
 *
 * -----------------------------------------------------------------------------
 * 📊 STATE MACHINE DIAGRAM
 * -----------------------------------------------------------------------------
 *
 *                 SUCCESS
 *           ┌───────────────────┐
 *           ▼                   │
 *     ┌──────────────┐          │
 *     │   CLOSED     │──────────┘
 *     └──────┬───────┘
 *            │
 *            │ failures >= threshold
 *            ▼
 *     ┌──────────────┐
 *     │    OPEN      │
 *     └──────┬───────┘
 *            │
 *            │ timeout elapsed
 *            ▼
 *     ┌──────────────┐
 *     │  HALF_OPEN   │
 *     └──────┬───────┘
 *            │
 *     ┌──────┴────────────┐
 *     ▼                   ▼
 *  SUCCESS             FAILURE
 *     │                   │
 *     ▼                   ▼
 *   CLOSED               OPEN
 *
 * -----------------------------------------------------------------------------
 * 📊 EXECUTION FLOW
 * -----------------------------------------------------------------------------
 *
 *   request →
 *     evaluate(state)
 *       │
 *       ├── OPEN      → reject immediately
 *       ├── HALF_OPEN → allow limited probe
 *       └── CLOSED    → allow execution
 *
 * -----------------------------------------------------------------------------
 * 🔐 SYSTEM OBJECTIVES
 * -----------------------------------------------------------------------------
 *
 *   ✅ Prevent cascading failures
 *   ✅ Avoid overwhelming failing services
 *   ✅ Enable automatic recovery
 *
 * -----------------------------------------------------------------------------
 * 🧱 DESIGN PRINCIPLES
 * -----------------------------------------------------------------------------
 *
 *   - Deterministic state transitions
 *   - Time-based recovery
 *   - Isolation per service key
 *   - Stateless API (state stored internally)
 *
 * =============================================================================
 */

/* =============================================================================
 * CONFIGURATION
 * =============================================================================
 */

/**
 * Maximum failures before OPEN state
 */
const FAILURE_THRESHOLD = 5;

/**
 * Time to stay OPEN before retry (ms)
 */
const RESET_TIMEOUT_MS = 30000;

/**
 * Maximum allowed calls in HALF_OPEN state
 */
const HALF_OPEN_MAX_REQUESTS = 2;

/* =============================================================================
 * INTERNAL STATE STORE
 * =============================================================================
 *
 * Map<key, circuitState>
 *
 * key:
 *   typically companyId or service identifier
 */

const stateStore = new Map();

/* =============================================================================
 * INITIALIZATION
 * =============================================================================
 */

function getState(key) {

  if (!stateStore.has(key)) {

    stateStore.set(key, {
      state: "CLOSED",
      failures: 0,
      lastFailureTime: 0,
      halfOpenRequests: 0
    });
  }

  return stateStore.get(key);
}

/* =============================================================================
 * STATE EVALUATION (PRE-EXECUTION)
 * =============================================================================
 */

function evaluate(key) {

  const circuit = getState(key);

  /**
   * ---------------------------------------------------------------------------
   * STATE: OPEN
   * ---------------------------------------------------------------------------
   */
  if (circuit.state === "OPEN") {

    const now = Date.now();

    /**
     * Check if recovery window elapsed
     */
    if (now - circuit.lastFailureTime > RESET_TIMEOUT_MS) {

      /**
       * Transition → HALF_OPEN
       */
      circuit.state = "HALF_OPEN";
      circuit.halfOpenRequests = 0;

    } else {

      throw new Error("CircuitBreaker: OPEN");
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * STATE: HALF_OPEN
   * ---------------------------------------------------------------------------
   */
  if (circuit.state === "HALF_OPEN") {

    if (circuit.halfOpenRequests >= HALF_OPEN_MAX_REQUESTS) {
      throw new Error("CircuitBreaker: HALF_OPEN_LIMIT");
    }

    circuit.halfOpenRequests += 1;
  }

  /**
   * CLOSED → no restrictions
   */
}

/* =============================================================================
 * SUCCESS HANDLER
 * =============================================================================
 */

function recordSuccess(key) {

  const circuit = getState(key);

  /**
   * Any success resets circuit fully
   */
  circuit.state = "CLOSED";
  circuit.failures = 0;
  circuit.halfOpenRequests = 0;
}

/* =============================================================================
 * FAILURE HANDLER
 * =============================================================================
 */

function recordFailure(key) {

  const circuit = getState(key);

  circuit.failures += 1;
  circuit.lastFailureTime = Date.now();

  /**
   * Transition to OPEN when threshold exceeded
   */
  if (circuit.failures >= FAILURE_THRESHOLD) {
    circuit.state = "OPEN";
  }
}

/* =============================================================================
 * EXECUTION WRAPPER
 * =============================================================================
 *
 * Wraps external calls with circuit breaker logic.
 *
 * -----------------------------------------------------------------------------
 * USAGE:
 *
 *   await execute("companyA", async () => {
 *     return await callExternalAPI();
 *   });
 *
 * -----------------------------------------------------------------------------
 */

async function execute(key, fn) {

  evaluate(key);

  try {

    const result = await fn();

    recordSuccess(key);

    return result;

  } catch (error) {

    recordFailure(key);

    throw error;
  }
}

/* =============================================================================
 * OPTIONAL UTILITIES
 * =============================================================================
 */

function currentState(key) {
  return getState(key).state;
}

function reset(key) {
  stateStore.delete(key);
}

function getStats(key) {
  const c = getState(key);

  return {
    state: c.state,
    failures: c.failures,
    lastFailureTime: c.lastFailureTime,
    halfOpenRequests: c.halfOpenRequests
  };
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  execute,
  recordSuccess,
  recordFailure,
  currentState,
  reset,
  getStats
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
 * This implementation is based on:
 *
 *   → Circuit Breaker Pattern (Michael T. Nygard)
 *   → Finite State Machine Theory
 *   → Fault Isolation in Distributed Systems
 *
 * -----------------------------------------------------------------------------
 * MATHEMATICAL CHARACTERIZATION
 * -----------------------------------------------------------------------------
 *
 * State Transition Function:
 *
 *   δ(S, event) → S'
 *
 * where:
 *
 *   event ∈ {failure, success, timeout}
 *
 * -----------------------------------------------------------------------------
 * SYSTEM PROPERTIES
 * -----------------------------------------------------------------------------
 *
 *   ✅ Failure isolation
 *   ✅ Controlled retry mechanism
 *   ✅ Self-healing behavior
 *
 * -----------------------------------------------------------------------------
 * CRITICAL REQUIREMENT
 * -----------------------------------------------------------------------------
 *
 * All external service calls MUST be wrapped:
 *
 *   execute(key, fn)
 *
 * -----------------------------------------------------------------------------
 * FAILURE MODE (IF NOT USED)
 * -----------------------------------------------------------------------------
 *
 *   ❗ repeated calls to failing service
 *   ❗ cascading system failures
 *   ❗ latency amplification
 *
 * =============================================================================
 */
