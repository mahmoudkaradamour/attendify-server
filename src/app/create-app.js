/**
 * =============================================================================
 * Attendify — Application Factory (Deterministic HTTP Composition Engine)
 * =============================================================================
 *
 * PURPOSE
 *
 * Constructs and composes the Express application with a strictly ordered
 * middleware pipeline and clearly defined execution boundaries.
 *
 * =============================================================================
 *
 * 🧠 FORMAL MODEL (ORDERED PIPELINE)
 *
 * Let:
 *
 *   M = middleware set
 *   R = routes
 *   E = error handler
 *
 * Then:
 *
 *   App = M₁ ∘ M₂ ∘ ... ∘ R ∘ E
 *
 * where order is NON-COMMUTATIVE.
 *
 * =============================================================================
 *
 * 📊 PIPELINE FLOW (STRICT ORDER)
 *
 *   Request
 *     │
 *     ▼
 *   request-id
 *     ▼
 *   request-context
 *     ▼
 *   edge normalization
 *     ▼
 *   rate limiting (segmented)
 *     ▼
 *   authentication
 *     ▼
 *   validation
 *     ▼
 *   replay protection
 *     ▼
 *   idempotency
 *     ▼
 *   routes
 *     ▼
 *   not-found
 *     ▼
 *   error handler
 *
 * =============================================================================
 *
 * 🔐 GUARANTEES
 *
 *   ✅ Deterministic execution
 *   ✅ Context integrity
 *   ✅ Security layering
 *   ✅ Centralized error handling
 *
 * =============================================================================
 */

const express = require("express");

/* =============================================================================
 * OBSERVABILITY
 * =============================================================================
 */

const requestIdMiddleware =
  require("../middleware/request-id");

const {
  requestContextMiddleware
} = require("../observability/request-context");

/* =============================================================================
 * CORE MIDDLEWARE
 * =============================================================================
 */

const edgeGateway =
  require("../middleware/edge-gateway");

const authMiddleware =
  require("../middleware/auth");

const validateMiddleware =
  require("../middleware/validate");

const replayProtection =
  require("../middleware/replay-protection");

const idempotencyMiddleware =
  require("../middleware/idempotency");

/* =============================================================================
 * RATE LIMITING (SEGMENTED SECURITY LAYER)
 * =============================================================================
 */

const authRateLimit =
  require("../security/rate-limit/auth.rate-limit");

const attendanceRateLimit =
  require("../security/rate-limit/attendance.rate-limit");

const nonceRateLimit =
  require("../security/rate-limit/nonce.rate-limit");

/* =============================================================================
 * ERROR HANDLING
 * =============================================================================
 */

const notFoundHandler =
  require("../middleware/not-found");

const errorHandler =
  require("../middleware/error-handler");

/* =============================================================================
 * ROUTES
 * =============================================================================
 */

const registerRoutes =
  require("./register-routes");

/* =============================================================================
 * APPLICATION FACTORY
 * =============================================================================
 */

function createApp() {

  const app = express();

  /**
   * ---------------------------------------------------------------------------
   * STEP 1 — BASE HARDENING
   * ---------------------------------------------------------------------------
   */

  app.disable("x-powered-by");

  app.use(express.json({
    limit: "1mb"
  }));

  /**
   * ---------------------------------------------------------------------------
   * STEP 2 — OBSERVABILITY (STRICT ORDER)
   * ---------------------------------------------------------------------------
   */

  app.use(requestIdMiddleware);

  /**
   * 🚨 DO NOT INSERT BETWEEN THESE TWO
   */

  app.use(requestContextMiddleware);

  /**
   * ---------------------------------------------------------------------------
   * STEP 3 — EDGE NORMALIZATION
   * ---------------------------------------------------------------------------
   */

  app.use(edgeGateway);

  /**
   * ---------------------------------------------------------------------------
   * STEP 4 — RATE LIMITING (SEGMENTED)
   * ---------------------------------------------------------------------------
   *
   * Applied BEFORE authentication to protect system resources
   */

  app.use("/auth", authRateLimit);

  app.use("/attendance", attendanceRateLimit);

  app.use("/nonce", nonceRateLimit);

  /**
   * ---------------------------------------------------------------------------
   * STEP 5 — SECURITY (AUTHENTICATION)
   * ---------------------------------------------------------------------------
   */

  app.use(authMiddleware);

  /**
   * ---------------------------------------------------------------------------
   * STEP 6 — VALIDATION
   * ---------------------------------------------------------------------------
   */

  app.use(validateMiddleware);

  /**
   * ---------------------------------------------------------------------------
   * STEP 7 — RELIABILITY CONTROLS
   * ---------------------------------------------------------------------------
   */

  app.use(replayProtection);

  app.use(idempotencyMiddleware);

  /**
   * ---------------------------------------------------------------------------
   * STEP 8 — ROUTES
   * ---------------------------------------------------------------------------
   */

  registerRoutes(app);

  /**
   * ---------------------------------------------------------------------------
   * STEP 9 — NOT FOUND
   * ---------------------------------------------------------------------------
   */

  app.use(notFoundHandler);

  /**
   * ---------------------------------------------------------------------------
   * STEP 10 — ERROR HANDLER
   * ---------------------------------------------------------------------------
   */

  app.use(errorHandler);

  return app;
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = createApp;

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */
