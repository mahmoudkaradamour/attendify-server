/**
 * =============================================================================
 * Attendify — Evidence Routes (Queue-Based Transport Layer)
 * =============================================================================
 *
 * FILE:
 *   src/routes/evidence.routes.js
 *
 * =============================================================================
 * 🎯 PURPOSE (FORMAL)
 * =============================================================================
 *
 * This module defines the **Evidence Ingestion Gateway Endpoint** responsible for:
 *
 *   ✅ Validating incoming forensic payloads
 *   ✅ Enforcing security constraints
 *   ✅ Decoupling request execution using a message queue
 *   ✅ Ensuring reliable and scalable delivery via asynchronous processing
 *
 * -----------------------------------------------------------------------------
 * 🧠 ARCHITECTURAL MODEL
 * -----------------------------------------------------------------------------
 *
 * This layer represents a **NON-BLOCKING EDGE PROCESSOR**:
 *
 *   - It does NOT execute business logic
 *   - It does NOT contact company APIs directly
 *
 * Instead:
 *
 *   It transforms synchronous HTTP into asynchronous job processing
 *
 * -----------------------------------------------------------------------------
 * 📊 HIGH-LEVEL FLOW (QUEUE-BASED)
 * -----------------------------------------------------------------------------
 *
 *        CLIENT REQUEST
 *              │
 *              ▼
 *   ┌────────────────────────────┐
 *   │   Security Middleware      │
 *   │ (RateLimit + Auth + Replay)│
 *   └─────────────┬──────────────┘
 *                 ▼
 *   ┌────────────────────────────┐
 *   │     Validation Layer       │
 *   └─────────────┬──────────────┘
 *                 ▼
 *   ┌────────────────────────────┐
 *   │ Queue Enqueue Operation    │
 *   └─────────────┬──────────────┘
 *                 ▼
 *         RESPONSE (FAST)
 *                 │
 *                 ▼
 *          Background Worker
 *                 │
 *                 ▼
 *        Company Integration
 *
 * -----------------------------------------------------------------------------
 * ✅ CRITICAL DESIGN IMPROVEMENT
 * -----------------------------------------------------------------------------
 *
 * BEFORE:
 *   Direct forwarding (synchronous) ❌
 *
 * AFTER:
 *   Queue-based execution ✅
 *
 * BENEFITS:
 *   - Fault tolerance
 *   - Latency reduction
 *   - System resilience
 *
 * -----------------------------------------------------------------------------
 * 🔐 SECURITY MODEL
 * -----------------------------------------------------------------------------
 *
 *   Layered defense:
 *
 *     1. Rate Limiting
 *     2. Authentication
 *     3. Replay Protection
 *     4. Idempotency
 *     5. Validation
 *
 * =============================================================================
 */

const express = require("express");

const router = express.Router();

/* =============================================================================
 * MIDDLEWARE IMPORTS
 * =============================================================================
 */

const rateLimit =
  require("../security/rate-limit/attendance.rate-limit");

const auth =
  require("../middleware/auth");

const replayProtection =
  require("../middleware/replay-protection");

const validate =
  require("../middleware/validate");

const idempotency =
  require("../middleware/idempotency");

const requestIdMiddleware =
  require("../middleware/request-id");

/* =============================================================================
 * VALIDATION SCHEMA
 * =============================================================================
 */

const {
  submitEvidenceSchema
} = require("../validation/evidence.schemas");

/* =============================================================================
 * QUEUE INTEGRATION
 * =============================================================================
 */

const {
  enqueueEvidence
} = require("../infrastructure/company/company.client");

/**
 * Queue instance (BullMQ or equivalent)
 */
const evidenceQueue =
  require("../jobs/evidence.queue");

/* =============================================================================
 * ERROR UTILITIES
 * =============================================================================
 */

const {
  badRequestError
} = require("../shared/errors/app-error");

/* =============================================================================
 * ROUTE: POST /evidence/submit
 * =============================================================================
 *
 * 🧠 Execution Model:
 *
 *   f(request) =
 *     validate → enqueue → respond
 *
 * -----------------------------------------------------------------------------
 * ✅ RESPONSE MODEL:
 *
 *   - Immediate acknowledgement
 *   - No waiting for company API response
 *
 * -----------------------------------------------------------------------------
 * 📊 REQUEST FLOW (DETAILED)
 *
 *   Request
 *     │
 *     ▼
 *   request-id injection
 *     │
 *     ▼
 *   rate-limit
 *     │
 *     ▼
 *   auth validation
 *     │
 *     ▼
 *   replay protection
 *     │
 *     ▼
 *   idempotency check
 *     │
 *     ▼
 *   schema validation
 *     │
 *     ▼
 *   enqueue job
 *     │
 *     ▼
 *   success response
 *
 * =============================================================================
 */

router.post(

  "/submit",

  /**
   * ---------------------------------------------------------------------------
   * LAYER 0 — REQUEST ID
   * ---------------------------------------------------------------------------
   *
   * Injects correlation ID for observability
   */
  requestIdMiddleware,

  /**
   * ---------------------------------------------------------------------------
   * LAYER 1 — RATE LIMIT
   * ---------------------------------------------------------------------------
   */
  rateLimit,

  /**
   * ---------------------------------------------------------------------------
   * LAYER 2 — AUTHENTICATION
   * ---------------------------------------------------------------------------
   */
  auth,

  /**
   * ---------------------------------------------------------------------------
   * LAYER 3 — REPLAY PROTECTION
   * ---------------------------------------------------------------------------
   */
  replayProtection,

  /**
   * ---------------------------------------------------------------------------
   * LAYER 4 — IDEMPOTENCY
   * ---------------------------------------------------------------------------
   */
  idempotency,

  /**
   * ---------------------------------------------------------------------------
   * LAYER 5 — VALIDATION
   * ---------------------------------------------------------------------------
   */
  validate(submitEvidenceSchema),

  /**
   * ---------------------------------------------------------------------------
   * CONTROLLER LOGIC
   * ---------------------------------------------------------------------------
   */
  async (req, res, next) => {

    try {

      const {
        companyId,
        evidence,
        metadata,
        timestamp,
        version
      } = req.body;

      const employeeToken =
        req.headers.authorization;

      const requestId =
        req.id;

      const employeeId =
        req.user && req.user.id
          ? req.user.id
          : null;

      /**
       * -----------------------------------------------------------------------
       * SANITY CHECKS
       * -----------------------------------------------------------------------
       */

      if (!companyId) {
        throw badRequestError("Missing companyId");
      }

      if (!employeeToken) {
        throw badRequestError("Missing Authorization token");
      }

      /**
       * -----------------------------------------------------------------------
       * ENQUEUE OPERATION (CRITICAL)
       * -----------------------------------------------------------------------
       *
       * This replaces direct execution with asynchronous job processing.
       */

      await enqueueEvidence(evidenceQueue, {
        companyId,
        evidence,
        metadata,
        employeeToken,
        employeeId,
        requestId,
        timestamp,
        version
      });

      /**
       * -----------------------------------------------------------------------
       * RESPONSE (NON-BLOCKING)
       * -----------------------------------------------------------------------
       *
       * The request is ACCEPTED, not COMPLETED.
       */

      return res.status(202).json({
        success: true,
        message: "Evidence accepted for processing",
        requestId
      });

    } catch (error) {
      return next(error);
    }
  }
);

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = router;

/**
 * =============================================================================
 * 🏁 END OF FILE
 * =============================================================================
 */
