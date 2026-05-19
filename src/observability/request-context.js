/**
 * =============================================================================
 * Attendify — Request Context System (Async Context Propagation Engine)
 * =============================================================================
 *
 * PURPOSE
 *
 * This module implements a **request-scoped context propagation system**
 * using AsyncLocalStorage (ALS), enabling deterministic metadata propagation
 * across asynchronous execution boundaries.
 *
 * =============================================================================
 *
 * 🧠 FORMAL MODEL (CONTEXT PROPAGATION)
 *
 * Let:
 *
 *   R = incoming request
 *   C = context (immutable state)
 *   A = async execution chain
 *
 * Then:
 *
 *   bind(R → C)
 *   propagate(C across A)
 *
 *   ∀ async step s ∈ A:
 *       context(s) = C
 *
 * =============================================================================
 *
 * 📊 EXECUTION FLOW
 *
 *         HTTP REQUEST
 *              │
 *              ▼
 *   requestContextMiddleware
 *              │
 *              ▼
 *   AsyncLocalStorage.run(C)
 *              │
 *              ▼
 *      ┌───────┬────────┬────────┐
 *      ▼       ▼        ▼        ▼
 *   Logger   Tracer   Services  DB Calls
 *      │       │        │
 *      └───────┴────────┘
 *              ▼
 *         Same Context
 *
 * =============================================================================
 *
 * 🔐 DESIGN OBJECTIVES
 *
 *   ✅ Deterministic context access
 *   ✅ Isolation between concurrent requests
 *   ✅ Zero parameter threading
 *   ✅ Safe async propagation
 *
 * =============================================================================
 *
 * ⚠️ CRITICAL PROPERTIES
 *
 *   - Context MUST be initialized exactly once per request
 *   - Context MUST NOT leak across requests
 *   - Context MUST be immutable to consumers
 *
 * =============================================================================
 */

const { AsyncLocalStorage } = require("async_hooks");

/* =============================================================================
 * INTERNAL STORAGE
 * =============================================================================
 *
 * Each async execution chain has its own isolated store.
 */

const storage = new AsyncLocalStorage();

/* =============================================================================
 * IMMUTABLE CONTEXT CREATION
 * =============================================================================
 */

function createContext(input = {}) {

  const ctx = {
    requestId: input.requestId || null,
    traceId: input.traceId || input.requestId || null,
    userId: input.userId || null,
    metadata: input.metadata || {},
    currentSpanId: null
  };

  /**
   * Enforce immutability at root level
   */
  return Object.freeze(ctx);
}

/* =============================================================================
 * CONTEXT EXECUTION BINDING
 * =============================================================================
 *
 * Binds a context to the async execution chain.
 */

function runWithContext(context, callback) {

  /**
   * Defensive: ensure context exists
   */
  if (!context || typeof context !== "object") {
    throw new Error("Invalid context initialization");
  }

  return storage.run(context, callback);
}

/* =============================================================================
 * CONTEXT ACCESSOR
 * =============================================================================
 */

function getContext() {
  return storage.getStore() || null;
}

/* =============================================================================
 * SAFE ACCESS HELPERS
 * =============================================================================
 */

function getRequestId() {
  const ctx = getContext();
  return ctx ? ctx.requestId : null;
}

function getTraceId() {
  const ctx = getContext();
  return ctx ? ctx.traceId : null;
}

function getUserId() {
  const ctx = getContext();
  return ctx ? ctx.userId : null;
}

/* =============================================================================
 * CONTROLLED CONTEXT EXTENSION
 * =============================================================================
 *
 * Instead of mutating existing context, we:
 *   → clone → merge → freeze → replace
 */

function extendContext(patch = {}) {

  const current = getContext();

  if (!current) return null;

  const next = Object.freeze({
    ...current,
    ...patch,
    metadata: {
      ...current.metadata,
      ...(patch.metadata || {})
    }
  });

  /**
   * Replace context safely inside same async scope
   */
  storage.enterWith(next);

  return next;
}

/* =============================================================================
 * EXPRESS MIDDLEWARE (ENTRY POINT)
 * =============================================================================
 */

function requestContextMiddleware(req, res, next) {

  /**
   * Build base context
   */
  const context = createContext({
    requestId: req.id,
    traceId: req.headers["x-trace-id"] || null
  });

  /**
   * Bind context to async chain
   *
   * NOTE:
   * Keep next() within same closure to guarantee propagation
   */
  storage.run(context, () => {
    next();
  });
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  createContext,
  runWithContext,
  getContext,
  getRequestId,
  getTraceId,
  getUserId,
  extendContext,
  requestContextMiddleware
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */
