/**
 * =============================================================================
 * Attendify — Distributed Tracing Engine (Advanced Context-Aware Span System)
 * =============================================================================
 *
 * PURPOSE
 *
 * This module implements a **hierarchical span-based tracing system**
 * integrated with request context, enabling full execution visibility.
 *
 * =============================================================================
 *
 * 🧠 FORMAL MODEL (TRACE GRAPH)
 *
 * Let:
 *
 *   T = trace (directed acyclic graph)
 *   S = span (node)
 *
 * Then:
 *
 *   T = (S, E)
 *
 * where:
 *
 *   S = execution units
 *   E = parent-child relationships
 *
 * =============================================================================
 *
 * 📊 EXECUTION MODEL
 *
 *   trace(name, fn):
 *
 *     push span → execute fn → pop span
 *
 * =============================================================================
 *
 * 🔐 DESIGN OBJECTIVES
 *
 *   ✅ Parent-child integrity
 *   ✅ Context-based propagation
 *   ✅ Deterministic lifecycle
 *   ✅ Safe nesting
 *
 * =============================================================================
 */

const crypto = require("crypto");

const {
  getContext,
  extendContext
} = require("../../observability/request-context");

const logger = require("../logging/logger");

/* =============================================================================
 * CONFIGURATION
 * =============================================================================
 */

const MAX_SPANS = 10000;

/* =============================================================================
 * INTERNAL STORAGE
 * =============================================================================
 */

const spanStore = [];

/* =============================================================================
 * UTIL — ID GENERATION
 * =============================================================================
 */

function generateId() {
  return crypto.randomUUID();
}

/* =============================================================================
 * START SPAN (STACK-AWARE)
 * =============================================================================
 */

function startSpan(name) {

  const ctx = getContext();

  const previousSpanId = ctx?.currentSpanId || null;

  const span = {

    id: generateId(),

    traceId: ctx?.traceId || generateId(),

    parentId: previousSpanId,

    name,

    startTime: Date.now(),

    endTime: null,

    duration: null,

    status: "IN_PROGRESS",

    metadata: Object.create(null)
  };

  spanStore.push(span);
  enforceLimit();

  /**
   * Push new span into context (stack behavior)
   */
  extendContext({
    currentSpanId: span.id
  });

  return span;
}

/* =============================================================================
 * END SPAN (SAFE + RESTORE CONTEXT)
 * =============================================================================
 */

function endSpan(span, status = "SUCCESS") {

  if (!span || span.endTime) {
    return;
  }

  span.endTime = Date.now();
  span.duration = span.endTime - span.startTime;
  span.status = status;

  /**
   * Restore parent span (CRITICAL)
   */
  extendContext({
    currentSpanId: span.parentId
  });

  /**
   * Emit structured trace log
   */
  logger.debug("Span completed", {
    spanId: span.id,
    traceId: span.traceId,
    parentId: span.parentId,
    name: span.name,
    duration: span.duration,
    status: span.status
  });

  /**
   * Freeze span to prevent mutation
   */
  Object.freeze(span);
}

/* =============================================================================
 * ADD METADATA
 * =============================================================================
 */

function addSpanMetadata(span, metadata = {}) {

  if (!span || span.endTime) return;

  Object.assign(span.metadata, metadata);
}

/* =============================================================================
 * TRACE WRAPPER (SAFE EXECUTION)
 * =============================================================================
 */

async function trace(name, fn) {

  const span = startSpan(name);

  try {

    const result = await fn(span);

    endSpan(span, "SUCCESS");

    return result;

  } catch (err) {

    addSpanMetadata(span, {
      errorMessage: err.message,
      errorCode: err.code || null
    });

    endSpan(span, "ERROR");

    throw err;
  }
}

/* =============================================================================
 * CHILD CONTEXT CREATION
 * =============================================================================
 */

function createChildContext() {

  const ctx = getContext();

  return {
    traceId: ctx?.traceId || generateId(),
    currentSpanId: ctx?.currentSpanId || null
  };
}

/* =============================================================================
 * STORAGE MANAGEMENT
 * =============================================================================
 */

function enforceLimit() {

  if (spanStore.length <= MAX_SPANS) return;

  spanStore.splice(0, spanStore.length - MAX_SPANS);
}

/* =============================================================================
 * DEBUG UTILITIES
 * =============================================================================
 */

function getSpans() {
  return [...spanStore];
}

function clearSpans() {
  spanStore.length = 0;
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  trace,
  startSpan,
  endSpan,
  addSpanMetadata,
  createChildContext,

  /**
   * Debug utilities
   */
  getSpans,
  clearSpans
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */
