/**
 * =============================================================================
 * Attendify — Mock Company Simulation Engine (Enterprise-Grade)
 * =============================================================================
 *
 * FILE:
 *   src/test-utils/mock-company.js
 *
 * =============================================================================
 * 🎯 PURPOSE (FORMAL — TEST SYSTEM ARCHITECTURE)
 * =============================================================================
 *
 * This module provides a **fully controllable simulation environment**
 * representing external company APIs.
 *
 * It allows:
 *
 *   ✅ Isolation of system under test (SUT)
 *   ✅ Deterministic failure injection
 *   ✅ Controlled latency simulation
 *   ✅ Reproducible distributed scenarios
 *
 * -----------------------------------------------------------------------------
 * 🧠 FORMAL MODEL
 * -----------------------------------------------------------------------------
 *
 * Let:
 *
 *   SUT = system under test
 *   D_real = real external dependency
 *   D_mock = simulated dependency
 *
 * Then:
 *
 *   test(SUT):
 *
 *     replace D_real → D_mock
 *
 * ensuring:
 *
 *   deterministic(D_mock) ⇒ reproducible(test outcomes)
 *
 * -----------------------------------------------------------------------------
 * 📊 HIGH-LEVEL EXECUTION FLOW
 * -----------------------------------------------------------------------------
 *
 *        Test Suite
 *            │
 *            ▼
 *   ┌────────────────────────────┐
 *   │ Mock Company Server        │
 *   │ (THIS MODULE)              │
 *   └──────────────┬─────────────┘
 *                  ▼
 *        Controlled Response
 *                  │
 *                  ▼
 *        System Under Test (SUT)
 *
 * -----------------------------------------------------------------------------
 * 📊 SCENARIO STATE MACHINE
 * -----------------------------------------------------------------------------
 *
 *             ┌───────────────┐
 *             │    SUCCESS    │
 *             └──────┬────────┘
 *                    │
 *     ┌──────────────┼──────────────┐
 *     ▼              ▼              ▼
 * CLIENT_ERROR   SERVER_ERROR   DELAY
 *     │              │              │
 *     ▼              ▼              ▼
 *    STOP           STOP         RESPONSE AFTER T
 *
 *             ┌───────────────┐
 *             │    TIMEOUT    │
 *             └───────────────┘
 *                     │
 *                     ▼
 *           NO RESPONSE (HANG)
 *
 * -----------------------------------------------------------------------------
 * 🔐 TESTING OBJECTIVES
 * -----------------------------------------------------------------------------
 *
 *   ✅ Determinism (same input → same output)
 *   ✅ Fault injection (simulate failures)
 *   ✅ Temporal distortion (latency, timeout)
 *   ✅ Contract validation (response structure)
 *
 * -----------------------------------------------------------------------------
 * 🧱 DESIGN PRINCIPLES
 * -----------------------------------------------------------------------------
 *
 *   - Explicit control over behavior
 *   - Stateless request processing
 *   - External control interface for tests
 *   - Isolation from real infrastructure
 *
 * =============================================================================
 */

const express = require("express");

/* =============================================================================
 * CONSTANTS
 * =============================================================================
 */

const DEFAULT_PORT = 4010;

/**
 * Simulation modes (finite state space)
 */
const MODES = Object.freeze({

  SUCCESS: "SUCCESS",
  CLIENT_ERROR: "CLIENT_ERROR",
  SERVER_ERROR: "SERVER_ERROR",
  TIMEOUT: "TIMEOUT",
  DELAY: "DELAY"

});

/* =============================================================================
 * INTERNAL STATE (CONTROLLED BY TESTS)
 * =============================================================================
 */

let mode = MODES.SUCCESS;

/**
 * Artificial delay in milliseconds
 */
let delayMs = 0;

/**
 * Optional failure rate (chaos testing)
 *
 * 0 → deterministic
 * >0 → probabilistic failure injection
 */
let failureRate = 0;

/* =============================================================================
 * UTILITY — RANDOM FAILURE
 * =============================================================================
 */

function shouldFailRandomly() {
  if (failureRate <= 0) return false;
  return Math.random() < failureRate;
}

/* =============================================================================
 * UTILITY — DELAY
 * =============================================================================
 */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* =============================================================================
 * SERVER FACTORY
 * =============================================================================
 */

function createServer() {

  const app = express();
  app.use(express.json());

  /**
   * ---------------------------------------------------------------------------
   * ROUTE: POST /evidence
   * ---------------------------------------------------------------------------
   *
   * This is the simulated main endpoint of the company backend.
   */
  app.post("/evidence", async (req, res) => {

    /**
     * -------------------------------------------------------------------------
     * STEP 1 — OPTIONAL DELAY
     * -------------------------------------------------------------------------
     */
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    /**
     * -------------------------------------------------------------------------
     * STEP 2 — CHAOS MODE (RANDOM FAILURE)
     * -------------------------------------------------------------------------
     */
    if (shouldFailRandomly()) {
      return res.status(500).json({
        error: "Injected random failure"
      });
    }

    /**
     * -------------------------------------------------------------------------
     * STEP 3 — MODE SWITCH
     * -------------------------------------------------------------------------
     */
    switch (mode) {

      /**
       * -----------------------------------------------------------
       * SUCCESS MODE
       * -----------------------------------------------------------
       */
      case MODES.SUCCESS:
        return res.status(200).json({
          status: "ok",
          accepted: true
        });

      /**
       * -----------------------------------------------------------
       * CLIENT ERROR
       * -----------------------------------------------------------
       */
      case MODES.CLIENT_ERROR:
        return res.status(400).json({
          error: "Invalid request"
        });

      /**
       * -----------------------------------------------------------
       * SERVER ERROR
       * -----------------------------------------------------------
       */
      case MODES.SERVER_ERROR:
        return res.status(500).json({
          error: "Internal failure"
        });

      /**
       * -----------------------------------------------------------
       * TIMEOUT MODE
       * -----------------------------------------------------------
       *
       * Simulates hanging connection
       */
      case MODES.TIMEOUT:
        return; // no response

      /**
       * -----------------------------------------------------------
       * DELAY MODE
       * -----------------------------------------------------------
       */
      case MODES.DELAY:
        return res.status(200).json({
          status: "ok",
          delayed: true
        });

      default:
        return res.status(500).json({
          error: "Unknown mode"
        });
    }
  });

  return app;
}

/* =============================================================================
 * CONTROL API (USED BY TEST SUITES)
 * =============================================================================
 */

/**
 * Set simulation mode
 */
function setMode(newMode) {

  if (!Object.values(MODES).includes(newMode)) {
    throw new Error("Invalid mode");
  }

  mode = newMode;
}

/**
 * Set artificial delay
 */
function setDelay(ms) {

  if (typeof ms !== "number" || ms < 0) {
    throw new Error("Invalid delay");
  }

  delayMs = ms;
}

/**
 * Enable probabilistic failure injection
 */
function setFailureRate(rate) {

  if (rate < 0 || rate > 1) {
    throw new Error("Failure rate must be between 0 and 1");
  }

  failureRate = rate;
}

/**
 * Reset simulation state
 */
function reset() {
  mode = MODES.SUCCESS;
  delayMs = 0;
  failureRate = 0;
}

/* =============================================================================
 * SERVER LIFECYCLE
 * =============================================================================
 */

let server = null;

async function start(port = DEFAULT_PORT) {

  const app = createServer();

  return new Promise(resolve => {
    server = app.listen(port, () => {
      resolve({ port });
    });
  });
}

async function stop() {

  if (!server) return;

  return new Promise(resolve => {
    server.close(() => {
      server = null;
      resolve();
    });
  });
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {

  /**
   * Server lifecycle
   */
  start,
  stop,

  /**
   * Behavior control
   */
  setMode,
  setDelay,
  setFailureRate,
  reset,

  /**
   * Modes enum
   */
  MODES

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
 * This module implements:
 *
 *   → Mock Pattern (Test Double)
 *   → Fault Injection Simulation
 *   → Deterministic Testing Model
 *
 * -----------------------------------------------------------------------------
 * FORMAL PROPERTY
 * -----------------------------------------------------------------------------
 *
 * Given identical test inputs:
 *
 *   deterministic mode:
 *     output is constant
 *
 *   probabilistic mode:
 *     output is stochastic (for chaos experiments)
 *
 * -----------------------------------------------------------------------------
 * SYSTEM TESTING BENEFITS
 * -----------------------------------------------------------------------------
 *
 *   ✅ Integration testing without real dependencies
 *   ✅ Chaos engineering scenarios
 *   ✅ Latency simulation
 *   ✅ Failure propagation testing
 *
 * -----------------------------------------------------------------------------
 * CRITICAL IMPORTANCE
 * -----------------------------------------------------------------------------
 *
 * Without this module:
 *
 *   ❗ Tests depend on real systems
 *   ❗ Non-deterministic behavior
 *   ❗ Impossible to simulate failures reliably
 *
 * -----------------------------------------------------------------------------
 * FINAL PROPERTY
 * -----------------------------------------------------------------------------
 *
 * This mock enables:
 *
 *   → Full control over external uncertainty
 *
 * which is a fundamental requirement for:
 *
 *   distributed system validation
 *
 * =============================================================================
 */