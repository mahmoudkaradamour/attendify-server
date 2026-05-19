/**
 * =============================================================================
 * Attendify Attendance Routes (Enterprise-Grade Secure Routing Layer)
 * =============================================================================
 *
 * FILE:
 * src/routes/attendance.routes.js
 *
 * -----------------------------------------------------------------------------
 * PURPOSE
 * -----------------------------------------------------------------------------
 * This module defines HTTP routes for attendance-related operations while
 * enforcing a fully layered, security-first execution pipeline.
 *
 * -----------------------------------------------------------------------------
 * CORE RESPONSIBILITIES
 * -----------------------------------------------------------------------------
 *
 *   ✅ Route definition (HTTP layer)
 *   ✅ Security orchestration (middleware ordering)
 *   ✅ Contract enforcement (validation)
 *   ✅ Delegation to business logic (controller)
 *
 * -----------------------------------------------------------------------------
 * ARCHITECTURAL POSITION
 * -----------------------------------------------------------------------------
 *
 *              Incoming HTTP Request
 *                        │
 *                        ▼
 *                  Express Router (THIS)
 *                        │
 *                        ▼
 *              Middleware Pipeline (Security Layers)
 *                        │
 *                        ▼
 *                  Controller Layer
 *                        │
 *                        ▼
 *                  Service Layer
 *                        │
 *                        ▼
 *                 Repository Layer
 *
 * -----------------------------------------------------------------------------
 * SECURITY PIPELINE (CRITICAL ORDER)
 * -----------------------------------------------------------------------------
 *
 * The order of middleware execution is STRICT and must NOT be altered:
 *
 *     1. Rate Limiting          → Prevent abuse & brute force
 *     2. Authentication         → Verify identity (JWT)
 *     3. Authorization          → Verify access rights
 *     4. Replay Protection      → Enforce idempotency (nonce)
 *     5. Validation             → Enforce input contract
 *     6. Controller             → Execute business logic
 *
 * -----------------------------------------------------------------------------
 * FLOW DIAGRAM
 * -----------------------------------------------------------------------------
 *
 *       Incoming Request
 *             │
 *             ▼
 *      [Rate Limit]
 *             │
 *             ▼
 *      [Authentication]
 *             │
 *             ▼
 *      [Authorization]
 *             │
 *             ▼
 *      [Replay Protection]
 *             │
 *             ▼
 *      [Validation]
 *             │
 *             ▼
 *      [Controller Logic]
 *
 * -----------------------------------------------------------------------------
 * DESIGN PRINCIPLES
 * -----------------------------------------------------------------------------
 *
 *   1. DEFENSE IN DEPTH
 *   2. FAIL-FAST VALIDATION
 *   3. MINIMUM TRUST POLICY
 *   4. STRICT MIDDLEWARE ORDERING
 *
 * -----------------------------------------------------------------------------
 * FORMAL GUARANTEE
 * -----------------------------------------------------------------------------
 *
 * ∀ request R:
 *
 *   process(R) ⇔
 *     rateLimit(R) passes
 *     ∧ validJWT(R)
 *     ∧ authorized(R)
 *     ∧ nonceUnused(R)
 *     ∧ schemaValid(R)
 *
 * =============================================================================
 */

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

const express = require("express");

const router = express.Router();

/**
 * Controllers (Business Logic Entry Points)
 */
const attendanceController =
  require("../controllers/attendance.controller");

/**
 * Middleware: Security Layers
 */
const auth =
  require("../middleware/auth");

const authGuard =
  require("../security/jwt/auth.guard");

const validate =
  require("../middleware/validate");

const replayProtection =
  require("../middleware/replay-protection");

/**
 * More advanced rate-limit (distributed via Redis)
 */
const rateLimit =
  require("../security/rate-limit/attendance.rate-limit");

/**
 * Validation Schemas
 */
const {
  markAttendanceSchema
} = require("../validation/attendance.schemas");

/* =============================================================================
 * ROUTES DEFINITIONS
 * =============================================================================
 */

/**
 * -----------------------------------------------------------------------------
 * POST /attendance
 * -----------------------------------------------------------------------------
 *
 * Primary endpoint to record attendance.
 *
 * Security Guarantees:
 *
 *   ✅ Protected from brute-force (rate limit)
 *   ✅ Authenticated (JWT required)
 *   ✅ Authorized (guard rules)
 *   ✅ Replay-safe (nonce enforcement)
 *   ✅ Input validated (schema)
 *
 * -----------------------------------------------------------------------------
 */
router.post(
  "/",

  /* -------------------------------------------------------------------------
   * LAYER 1: RATE LIMITING (GLOBAL THROTTLING)
   *
   * Prevents:
   *   - brute-force abuse
   *   - automated attacks
   * ------------------------------------------------------------------------- */
  rateLimit,

  /* -------------------------------------------------------------------------
   * LAYER 2: AUTHENTICATION (IDENTITY VERIFICATION)
   * ------------------------------------------------------------------------- */
  auth,

  /* -------------------------------------------------------------------------
   * LAYER 3: AUTHORIZATION (ACCESS CONTROL)
   * ------------------------------------------------------------------------- */
  authGuard(),

  /* -------------------------------------------------------------------------
   * LAYER 4: REPLAY PROTECTION (CRITICAL SECURITY)
   *
   * Prevents duplicate or replayed requests using nonce.
   * ------------------------------------------------------------------------- */
  replayProtection,

  /* -------------------------------------------------------------------------
   * LAYER 5: INPUT VALIDATION (CONTRACT ENFORCEMENT)
   * ------------------------------------------------------------------------- */
  validate(markAttendanceSchema),

  /* -------------------------------------------------------------------------
   * LAYER 6: CONTROLLER (BUSINESS EXECUTION)
   * ------------------------------------------------------------------------- */
  attendanceController.markAttendance
);

/* =============================================================================
 * FUTURE EXTENSIONS (ENTERPRISE SCALABILITY)
 * =============================================================================
 *
 * Additional routes can include:
 *
 *   GET /attendance
 *   GET /attendance/history
 *   DELETE /attendance/:id
 *
 * With the same pipeline pattern applied.
 *
 * =============================================================================
 */

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
