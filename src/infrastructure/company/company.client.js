/**
 * =============================================================================
 * Attendify — Company Client (Enterprise Integration Engine)
 * =============================================================================
 *
 * FILE:
 *   src/infrastructure/company/company.client.js
 *
 * =============================================================================
 * 🎯 PURPOSE (FORMAL & ACADEMIC)
 * =============================================================================
 *
 * This module represents the **core distributed integration engine** responsible for:
 *
 *   ✅ Reliable, secure forwarding of forensic evidence
 *   ✅ Idempotent delivery guarantees
 *   ✅ Retry with exponential backoff + jitter
 *   ✅ Circuit Breaker (Finite State Machine)
 *   ✅ Full error normalizationrelation ID propagation (observability) *   ✅ Full error normalization
 *   ✅ Queue-based execution (decoupled architecture)
 *
 * -----------------------------------------------------------------------------
 * 🧠 SYSTEM THEORY MODEL
 * -----------------------------------------------------------------------------
 *
 * Let:
 *
 *   E = Evidence payload
 *   C = Company backend
 *   Q = Queue system
 *   R = Response
 *
 * Then:
 *
 *   f(E) = enqueue(E) → Q → worker → execute(E → C)
 *
 * This module participates in the **execution phase only**, not routing.
 *
 * -----------------------------------------------------------------------------
 * 📊 HIGH-LEVEL FLOW
 * -----------------------------------------------------------------------------
 *
 *         API Layer
 *             │
 *             ▼
 *     enqueueEvidence(E)
 *             │
 *             ▼
 *      ┌───────────────┐
 *      │   QUEUE       │
 *      └──────┬────────┘
 *             ▼
 *         WORKER
 *             │
 *             ▼
 *   ┌─────────────────────┐
 *   │ forwardEvidence()   │
 *   └─────────────────────┘
 *             │
 *             ▼
 *      Circuit Breaker
 *             │
 *             ▼
 *      Retry Strategy
 *             │
 *             ▼
 *        HTTP Request
 *             │
 *             ▼
 *      Company Backend
 *
 * -----------------------------------------------------------------------------
 * 🧱 DESIGN PATTERNS USED
 * -----------------------------------------------------------------------------
 *
 *   - Message Queue Pattern
 *   - Circuit Breaker FSM
 *   - Retry with Exponential Backoff + Jitter
 *   - Idempotency Guarantee
 *   - Error Normalization
 *
 * =============================================================================
 */

const fetch = require("node-fetch");
const crypto = require("crypto");

const { getCompanyConfig } = require("./company.registry");
const { buildAuthHeaders } = require("./company.auth");
const { normalizeCompanyError } = require("./company.errors");

/* =============================================================================
 * CONSTANTS
 * =============================================================================
 */

const MAX_RETRIES = 5;
const BASE_DELAY = 300; // ms

const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_RESET_TIMEOUT = 30000;

/* =============================================================================
 * CIRCUIT BREAKER FSM
 * =============================================================================
 *
 * States:
 *   CLOSED → normal operation
 *   OPEN → short-circuit (fail fast)
 *   HALF_OPEN → probe state
 */

const circuitStore = new Map();

function getCircuit(companyId) {
  if (!circuitStore.has(companyId)) {
    circuitStore.set(companyId, {
      state: "CLOSED",
      failures: 0,
      lastFailure: 0
    });
  }
  return circuitStore.get(companyId);
}

function evaluateCircuit(companyId) {
  const c = getCircuit(companyId);

  if (c.state === "OPEN") {
    if (Date.now() - c.lastFailure > CIRCUIT_RESET_TIMEOUT) {
      c.state = "HALF_OPEN";
    } else {
      throw new Error("Circuit breaker open");
    }
  }
}

function recordSuccess(companyId) {
  const c = getCircuit(companyId);
  c.state = "CLOSED";
  c.failures = 0;
}

function recordFailure(companyId) {
  const c = getCircuit(companyId);
  c.failures += 1;
  c.lastFailure = Date.now();

  if (c.failures >= CIRCUIT_THRESHOLD) {
    c.state = "OPEN";
  }
}

/* =============================================================================
 * IDEMPOTENCY (DETERMINISTIC)
 * =============================================================================
 *
 * Properties:
 *   - Same logical event → same key
 *   - No time-based randomness
 */

function generateIdempotencyKey({
  snapshotHash,
  companyId,
  employeeId
}) {
  return crypto
    .createHash("sha256")
    .update(`${snapshotHash}:${companyId}:${employeeId}`)
    .digest("hex");
}

/* =============================================================================
 * RETRY STRATEGY
 * =============================================================================
 *
 * delay = base * 2^attempt + jitter
 */

function getRetryDelay(attempt) {
  const jitter = Math.random() * 500;
  return BASE_DELAY * Math.pow(2, attempt) + jitter;
}

/* =============================================================================
 * CORE HTTP EXECUTOR
 * =============================================================================
 */

async function executeHttp({
  url,
  headers,
  body,
  timeout
}) {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const json = await response.json().catch(() => ({}));

    clearTimeout(timeoutId);

    return {
      status: response.status,
      ok: response.ok,
      body: json
    };

  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/* =============================================================================
 * MAIN EXECUTION FUNCTION
 * =============================================================================
 */

async function forwardEvidence({
  companyId,
  evidence,
  metadata,
  employeeToken,
  employeeId,
  requestId
}) {

  const company = getCompanyConfig(companyId);

  evaluateCircuit(companyId);

  const url =
    company.apiBase + company.endpoints.submitEvidence;

  const idempotencyKey = generateIdempotencyKey({
    snapshotHash: evidence.snapshotHash,
    companyId,
    employeeId
  });

  const headers = {
    "Content-Type": "application/json",
    "x-idempotency-key": idempotencyKey,
    "x-request-id": requestId,
    ...buildAuthHeaders(company, employeeToken)
  };

  const payload = {
    evidence,
    metadata
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {

    try {

      const res = await executeHttp({
        url,
        headers,
        body: payload,
        timeout: company.timeout
      });

      if (res.ok) {
        recordSuccess(companyId);
        return res.body;
      }

      // 4xx → not retryable
      if (res.status >= 400 && res.status < 500) {
        throw normalizeCompanyError({
          status: res.status
        });
      }

      // 5xx → retry
      throw new Error("Transient error");

    } catch (err) {

      recordFailure(companyId);

      const normalized = normalizeCompanyError(err);

      if (!normalized.retryable || attempt === MAX_RETRIES) {
        throw normalized;
      }

      const delay = getRetryDelay(attempt);

      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/* =============================================================================
 * QUEUE INTEGRATION (ENTRY POINT)
 * =============================================================================
 *
 * NOTE:
 * This does NOT execute immediately
 * It pushes work to queue system.
 */

async function enqueueEvidence(queue, payload) {

  /**
   * queue = BullMQ or similar
   *
   * payload contains:
   *   companyId
   *   evidence
   *   metadata
   *   employeeToken
   *   employeeId
   *   requestId
   */

  await queue.add("evidence-delivery", payload, {
    attempts: MAX_RETRIES,
    backoff: {
      type: "exponential",
      delay: BASE_DELAY
    },
    removeOnComplete: true,
    removeOnFail: false
  });
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  forwardEvidence,
  enqueueEvidence
};

/**
 * =============================================================================
 * 🏁 END OF FILE
 * =============================================================================
 */

