/**
 * =============================================================================
 * Attendify — Enterprise Structured Logger (Context-Aware Observability Core)
 * =============================================================================
 *
 * OVERVIEW
 * =============================================================================
 *
 * This module implements a **high-fidelity structured logging system** designed
 * for distributed backend systems operating under observability-first principles.
 *
 * The logger enforces:
 *
 *   ✅ Deterministic correlation across microservices
 *   ✅ Context-aware logging (implicit propagation)
 *   ✅ Structured JSON output (log aggregation ready)
 *   ✅ Safe serialization under any runtime condition
 *
 * =============================================================================
 *
 * 🧠 FORMAL MODEL (LOG GENERATION FUNCTION)
 *
 * Let:
 *
 *   level ∈ {debug, info, warn, error}
 *   message ∈ String | Object
 *   M = metadata
 *   C = execution context
 *
 * Then:
 *
 *   LogEntry = f(level, message, M, C)
 *
 * Producing:
 *
 *   JSON(LogEntry)
 *
 * =============================================================================
 *
 * 📊 EXECUTION FLOW (PIPELINE MODEL)
 *
 *       Application Layer
 *             │
 *             ▼
 *     logger.(info|warn|error)
 *             │
 *             ▼
 *     Acquire Execution Context (AsyncLocalStorage)
 *             │
 *             ▼
 *     Normalize Inputs (message + metadata)
 *             │
 *             ▼
 *     Enrich Log Entry
 *     ├─ requestId
 *     ├─ traceId
 *     ├─ correlationId
 *     ├─ userId
 *             │
 *             ▼
 *     Serialize (safe JSON)
 *             │
 *             ▼
 *     Output → stdout (collector / log pipeline)
 *
 * =============================================================================
 *
 * 🔐 CRITICAL CORRELATION RULE
 *
 *   correlationId = traceId || requestId
 *
 * This guarantees continuity even if one identifier is missing.
 *
 * =============================================================================
 *
 * 🧪 LOG ENTRY SCHEMA
 *
 * {
 *   level: string
 *   message: string
 *   timestamp: ISO8601
 *   service: string
 *
 *   requestId: string | null
 *   traceId: string | null
 *   correlationId: string | null
 *   userId: string | null
 *
 *   ...metadata
 * }
 *
 * =============================================================================
 */

const {
  getContext
} = require("../../observability/request-context");

/* =============================================================================
 * ENVIRONMENT CONFIGURATION
 * =============================================================================
 */

const SERVICE_NAME =
  process.env.SERVICE_NAME || "attendify-server";

const NODE_ENV =
  process.env.NODE_ENV || "development";

/* =============================================================================
 * LOG LEVEL DEFINITIONS
 * =============================================================================
 */

const LEVELS = Object.freeze({
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error"
});

/* =============================================================================
 * SAFE SERIALIZATION (CRITICAL)
 * =============================================================================
 *
 * Prevents runtime crashes due to:
 *   - circular references
 *   - unserializable values
 */

function safeStringify(value) {

  try {
    return JSON.stringify(value);
  } catch (err) {
    return JSON.stringify({
      serializationError: true,
      message: "Failed to serialize log payload"
    });
  }
}

/* =============================================================================
 * ERROR NORMALIZATION
 * =============================================================================
 *
 * Converts Error objects into structured metadata.
 */

function normalizeError(error) {

  if (!error) {
    return {
      errorMessage: "Unknown error"
    };
  }

  return {
    errorMessage: error.message || "Unknown",
    errorCode: error.code || null,
    stack:
      NODE_ENV === "production"
        ? undefined
        : error.stack || null
  };
}

/* =============================================================================
 * CORE LOG FUNCTION
 * =============================================================================
 *
 * This is the single source of truth for log creation.
 */

function writeLog(level, message, meta = {}) {

  const context = getContext?.() || {};

  const logEntry = {

    /* ------------------------------------------------------------- */
    /* Core */
    /* ------------------------------------------------------------- */
    level,
    message:
      typeof message === "string"
        ? message
        : safeStringify(message),

    timestamp:
      new Date().toISOString(),

    service: SERVICE_NAME,

    environment: NODE_ENV,

    /* ------------------------------------------------------------- */
    /* Context (Correlation Layer) */
    /* ------------------------------------------------------------- */
    requestId:
      context.requestId || null,

    traceId:
      context.traceId || null,

    correlationId:
      context.traceId ||
      context.requestId ||
      null,

    userId:
      context.userId || null,

    /* ------------------------------------------------------------- */
    /* Metadata */
    /* ------------------------------------------------------------- */
    ...(meta && typeof meta === "object"
      ? meta
      : { meta })

  };

  process.stdout.write(
    safeStringify(logEntry) + "\n"
  );
}

/* =============================================================================
 * PUBLIC LOGGER API
 * =============================================================================
 */

function debug(message, meta = {}) {
  writeLog(LEVELS.DEBUG, message, meta);
}

function info(message, meta = {}) {
  writeLog(LEVELS.INFO, message, meta);
}

function warn(message, meta = {}) {
  writeLog(LEVELS.WARN, message, meta);
}

function error(message, err, meta = {}) {

  const errorMeta =
    normalizeError(err);

  writeLog(
    LEVELS.ERROR,
    message,
    {
      ...errorMeta,
      ...meta
    }
  );
}

/* =============================================================================
 * ADAPTER (COMPATIBILITY LAYER)
 * =============================================================================
 *
 * Ensures compatibility with:
 *   - code expecting logger object
 *   - direct function imports
 */

const logger = {
  debug,
  info,
  warn,
  error
};

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = logger;

/**
 * =============================================================================
 * ARCHITECTURAL NOTES
 * =============================================================================
 *
 * 1. LOGGING MODEL
 * ---------------------------------------------------------------------------
 * Logging is treated as a **pure side-effect system** with no business logic
 * entanglement.
 *
 * 2. CONTEXT PROPAGATION
 * ---------------------------------------------------------------------------
 * Context is retrieved from AsyncLocalStorage (external system),
 * eliminating the need to pass identifiers explicitly.
 *
 * 3. OBSERVABILITY INTEGRATION
 * ---------------------------------------------------------------------------
 * Output is JSON → designed for ingestion by:
 *
 *   - ELK stack (Elasticsearch)
 *   - Datadog / New Relic
 *   - Cloud log collectors
 *
 * 4. FAILURE RESILIENCE
 * ---------------------------------------------------------------------------
 * Logger must never throw → system must remain operational even if logging fails.
 *
 * 5. PERFORMANCE CONSIDERATION
 * ---------------------------------------------------------------------------
 * Uses stdout (non-blocking) and avoids heavy transformation.
 *
 * =============================================================================
 *
 * END OF FILE
 * =============================================================================
 */

