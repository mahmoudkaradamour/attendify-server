/**
 * =============================================================================
 * Attendify — Structured Logger (Enterprise Context-Aware Logging Engine)
 * =============================================================================
 *
 * PURPOSE
 *
 * This module implements a **high-fidelity structured logging system**
 * tightly integrated with execution context for distributed observability.
 *
 * =============================================================================
 *
 * 🧠 FORMAL MODEL (LOG CONSTRUCTION)
 *
 * Let:
 *
 *   L = log event
 *   C = execution context
 *   M = metadata
 *
 * Then:
 *
 *   L = f(level, message, M, C)
 *
 * Producing:
 *
 *   JSON(logEntry)
 *
 * =============================================================================
 *
 * 📊 LOG FLOW
 *
 *      Application Code
 *            │
 *            ▼
 *     logger.(info|error|...)
 *            │
 *            ▼
 *     Extract execution context
 *            │
 *            ▼
 *     Normalize metadata
 *            │
 *            ▼
 *     Enrich with correlation
 *            │
 *            ▼
 *     Serialize JSON
 *            │
 *            ▼
 *     Output stream (stdout / collector)
 *
 * =============================================================================
 *
 * 🔐 DESIGN OBJECTIVES
 *
 *   ✅ Deterministic correlation across systems
 *   ✅ Context-aware logging without manual injection
 *   ✅ Structured output (machine-ingestible)
 *   ✅ Safe serialization
 *
 * =============================================================================
 *
 * ⚠️ CRITICAL PROPERTY
 *
 *   correlationId = traceId || requestId
 *
 * =============================================================================
 */

const {
  getContext
} = require("../../observability/request-context");

/* =============================================================================
 * CONFIGURATION
 * =============================================================================
 */

const SERVICE_NAME =
  process.env.SERVICE_NAME || "attendify-server";

const NODE_ENV =
  process.env.NODE_ENV || "development";

/* =============================================================================
 * LOG LEVELS
 * =============================================================================
 */

const LEVELS = Object.freeze({
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error"
});

/* =============================================================================
 * SAFE SERIALIZATION
 * =============================================================================
 *
 * Prevents crashing on circular structures
 */

function safeStringify(obj) {

  try {
    return JSON.stringify(obj);
  } catch (_) {
    return JSON.stringify({
      error: "SerializationError"
    });
  }
}

/* =============================================================================
 * ERROR NORMALIZATION
 * =============================================================================
 */

function formatError(error) {

  if (!error) {
    return { error: "unknown" };
  }

  return {
    errorMessage: error.message,
    errorCode: error.code || null,
    stack:
      NODE_ENV === "production"
        ? undefined
        : error.stack || null
  };
}

/* =============================================================================
 * BASE LOGGER
 * =============================================================================
 */

function log(level, message, meta = {}) {

  const ctx = getContext();

  const logEntry = {

    /**
     * Core fields
     */
    level,
    message: typeof message === "string" ? message : safeStringify(message),

    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,

    /**
     * Correlation Layer (CRITICAL)
     */
    requestId: ctx?.requestId || null,
    traceId: ctx?.traceId || null,
    correlationId:
      ctx?.traceId || ctx?.requestId || null,

    userId: ctx?.userId || null,

    /**
     * Metadata (safe merge)
     */
    ...(meta && typeof meta === "object" ? meta : { meta })
  };

  process.stdout.write(
    safeStringify(logEntry) + "\n"
  );
}

/* =============================================================================
 * PUBLIC API
 * =============================================================================
 */

function debug(message, meta) {
  log(LEVELS.DEBUG, message, meta);
}

function info(message, meta) {
  log(LEVELS.INFO, message, meta);
}

function warn(message, meta) {
  log(LEVELS.WARN, message, meta);
}

function error(message, err, meta = {}) {

  const errorMeta = formatError(err);

  log(LEVELS.ERROR, message, {
    ...errorMeta,
    ...meta
  });
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  debug,
  info,
  warn,
  error
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */
