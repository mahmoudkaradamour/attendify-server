/**
 * =============================================================================
 * Attendify — Health & Readiness Endpoints (System Health Interface Layer)
 * =============================================================================
 *
 * PURPOSE
 *
 * This module exposes **system health signals** for external controllers:
 *
 *   ✅ Liveness (process health)
 *   ✅ Readiness (dependency health)
 *
 * =============================================================================
 *
 * 🧠 FORMAL MODEL (SYSTEM HEALTH FUNCTION)
 *
 * Let:
 *
 *   S = system
 *   D = dependencies = { redis, mongo, queue, metrics }
 *
 * Then:
 *
 *   liveness(S) = process is alive
 *   readiness(S) = ∀ d ∈ D → healthy(d)
 *
 * =============================================================================
 *
 * 📊 EXECUTION FLOW (READINESS)
 *
 *   Request /ready
 *         │
 *         ▼
 *   Execute checks in parallel
 *         │
 *         ▼
 *   Collect results
 *         │
 *         ▼
 *   Determine global status
 *         │
 *         ▼
 *   Return structured health response
 *
 * =============================================================================
 *
 * 🔐 DESIGN OBJECTIVES
 *
 *   ✅ Never crash (safe checks)
 *   ✅ Deterministic responses
 *   ✅ Fast evaluation
 *   ✅ Clear observability output
 *
 * =============================================================================
 */

const express = require("express");
const router = express.Router();

/* =============================================================================
 * DEPENDENCIES
 * =============================================================================
 */

const redisClient =
  require("../infrastructure/redis/redis.client");

const mongo =
  require("../infrastructure/mongo/mongo.connection");

const metrics =
  require("../infrastructure/metrics/metrics");

/**
 * Optional queue dependency
 */
let queue = null;
try {
  queue = require("../jobs/evidence.queue");
} catch (_) {}

/* =============================================================================
 * SAFE EXECUTION WRAPPER (FAIL-SAFE)
 * =============================================================================
 *
 * Guarantees:
 *   - No thrown errors
 *   - Always returns structured output
 *   - Latency measurement
 */

async function safeCheck(name, fn) {

  const start = Date.now();

  try {

    await fn();

    return {
      name,
      status: "UP",
      latencyMs: Date.now() - start
    };

  } catch (err) {

    return {
      name,
      status: "DOWN",
      latencyMs: Date.now() - start,
      error: {
        message: err.message,
        code: err.code || null
      }
    };
  }
}

/* =============================================================================
 * DEPENDENCY CHECKS
 * =============================================================================
 */

async function checkRedis() {
  await redisClient.ping();
}

async function checkMongo() {
  await mongo.ping();
}

function checkMetrics() {
  const snapshot = metrics.getMetricsSnapshot();
  if (!snapshot) {
    throw new Error("metrics unavailable");
  }
}

async function checkQueue() {
  if (!queue) return;
  await queue.getJobCounts();
}

/* =============================================================================
 * ROUTE: /health (LIVENESS)
 * =============================================================================
 *
 * MUST:
 *   - never depend on external services
 *   - always return 200
 */

router.get("/health", (req, res) => {

  return res.status(200).json({
    status: "UP",
    type: "liveness",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });

});

/* =============================================================================
 * ROUTE: /ready (READINESS)
 * =============================================================================
 *
 * Evaluates critical dependencies
 */

router.get("/ready", async (req, res) => {

  /**
   * Execute checks in parallel
   */
  const checks = await Promise.all([

    safeCheck("redis", checkRedis),
    safeCheck("mongo", checkMongo),
    safeCheck("metrics", checkMetrics),
    safeCheck("queue", checkQueue)

  ]);

  /**
   * Normalize component map
   */
  const components = {};

  for (const c of checks) {
    components[c.name] = c;
  }

  /**
   * Global health decision
   */
  const healthy =
    checks.every(c => c.status === "UP");

  const response = {
    status: healthy ? "UP" : "DOWN",
    type: "readiness",
    timestamp: new Date().toISOString(),
    components
  };

  return res
    .status(healthy ? 200 : 503)
    .json(response);
});

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = router;

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */
