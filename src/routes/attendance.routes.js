/**
 * =============================================================================
 * Attendify — Attendance Routing Layer (Enterprise-Grade)
 * =============================================================================
 *
 * OVERVIEW
 * =============================================================================
 *
 * This module defines the **transport-layer entry points** for all attendance
 * operations. It serves as a **deterministic orchestration layer** responsible
 * for:
 *
 *   • Binding HTTP endpoints to controller functions
 *   • Enforcing middleware execution order
 *   • Ensuring all handlers are valid executable functions
 *   • Creating a secure and observable request pipeline
 *
 * =============================================================================
 *
 * 🧠 FORMAL ROUTING MODEL
 * =============================================================================
 *
 * Let:
 *
 *   R = HTTP Request
 *   M = Middleware chain
 *   C = Controller handler
 *
 * Then:
 *
 *   EXECUTE(R) =
 *     M₁(R) → M₂(R) → ... → Mₙ(R) → C(R)
 *
 * If any Mi fails → pipeline terminates → error propagated
 *
 * =============================================================================
 *
 * 📊 PIPELINE EXECUTION FLOW
 * =============================================================================
 *
 *                      ┌──────────────────────────┐
 *                      │   Incoming HTTP Request  │
 *                      └────────────┬─────────────┘
 *                                   │
 *                                   ▼
 *                      Attendance Rate Limiter
 *                                   │
 *                                   ▼
 *                         JWT Authentication Guard
 *                                   │
 *                                   ▼
 *                         Controller (Business Entry)
 *                                   │
 *                                   ▼
 *                              Service Layer
 *                                   │
 *                                   ▼
 *                                Database
 *
 * =============================================================================
 *
 * 🔐 SECURITY ENFORCEMENT ORDER
 * =============================================================================
 *
 *   1. Rate limiting → protects infrastructure
 *   2. Authentication → establishes identity
 *   3. Controller → trusted execution
 *
 * =============================================================================
 *
 * ⚠️ CRITICAL DESIGN RULE
 * =============================================================================
 *
 * Every route handler MUST be a function.
 *
 * Violating this rule results in:
 *
 *   TypeError: argument handler must be a function
 *
 * This module enforces runtime validation to guarantee this invariant.
 *
 * =============================================================================
 */

const express = require("express");

const router = express.Router();

/* =============================================================================
 * IMPORT MIDDLEWARES
 * =============================================================================
 */

const authGuard =
  require("../security/jwt/auth.guard");

const attendanceRateLimiter =
  require("../security/rate-limit/attendance.rate-limit");

/* =============================================================================
 * IMPORT CONTROLLER (SAFE IMPORT PATTERN)
 * =============================================================================
 */

const attendanceController =
  require("../controllers/attendance.controller");

/**
 * Explicit extraction prevents destructuring pitfalls
 */
const submitAttendance =
  attendanceController.submitAttendance;

const getMyAttendance =
  attendanceController.getMyAttendance;

/* =============================================================================
 * RUNTIME TYPE VALIDATION (ENTERPRISE SAFETY LAYER)
 * =============================================================================
 *
 * This eliminates an entire class of runtime crashes.
 */

function assertIsFunction(fn, name) {

  if (typeof fn !== "function") {

    throw new Error(
      `[Routing Error] ${name} must be a function but received ${typeof fn}`
    );
  }
}

/**
 * Validate middleware
 */
assertIsFunction(authGuard, "authGuard");
assertIsFunction(attendanceRateLimiter, "attendanceRateLimiter");

/**
 * Validate controllers
 */
assertIsFunction(submitAttendance, "submitAttendance");
assertIsFunction(getMyAttendance, "getMyAttendance");

/* =============================================================================
 * ROUTES DEFINITION
 * =============================================================================
 */

/**
 * -----------------------------------------------------------------------------
 * POST /attendance
 * -----------------------------------------------------------------------------
 *
 * DESCRIPTION:
 * ---------------------------------------------------------------------------
 * Secure attendance submission endpoint.
 *
 * This endpoint accepts a **cryptographically signed attendance payload**
 * and forwards it through a secure verification pipeline.
 *
 * ---------------------------------------------------------------------------
 * EXECUTION FLOW:
 * ---------------------------------------------------------------------------
 *
 * Request
 *   │
 *   ▼
 * RateLimiter
 *   │
 *   ▼
 * AuthGuard
 *   │
 *   ▼
 * submitAttendance (Controller)
 *   │
 *   ▼
 * attendanceService.submitAttendance()
 *   │
 *   ▼
 * HMAC verification + Replay protection + DB write
 *
 * ---------------------------------------------------------------------------
 *
 * SECURITY PROPERTIES:
 *
 *   ✅ Flood protection
 *   ✅ Verified identity
 *   ✅ Trusted tenant binding
 */

router.post(
  "/",
  attendanceRateLimiter,
  authGuard,
  submitAttendance
);

/**
 * -----------------------------------------------------------------------------
 * GET /attendance
 * -----------------------------------------------------------------------------
 *
 * DESCRIPTION:
 * ---------------------------------------------------------------------------
 * Retrieves attendance records for the authenticated tenant.
 *
 * ---------------------------------------------------------------------------
 * EXECUTION FLOW:
 * ---------------------------------------------------------------------------
 *
 * Request
 *   │
 *   ▼
 * AuthGuard
 *   │
 *   ▼
 * getMyAttendance (Controller)
 *   │
 *   ▼
 * attendanceService.getCompanyAttendance()
 *
 * ---------------------------------------------------------------------------
 *
 * SECURITY PROPERTIES:
 *
 *   ✅ Authenticated access only
 *   ✅ No client-controlled tenant identity
 */

router.get(
  "/",
  authGuard,
  getMyAttendance
);

/* =============================================================================
 * EXPORT ROUTER
 * =============================================================================
 */

module.exports = router;

/**
 * =============================================================================
 * ADVANCED ARCHITECTURAL NOTES
 * =============================================================================
 *
 * 1. FUNCTIONAL SAFETY GUARANTEE
 * ---------------------------------------------------------------------------
 *
 * This module guarantees:
 *
 *   • All handlers are verified functions before route registration
 *   • No lazy runtime failure inside Express internals
 *
 * This is achieved via:
 *
 *   assertIsFunction()
 *
 * ---------------------------------------------------------------------------
 *
 * 2. PIPELINE DETERMINISM
 * ---------------------------------------------------------------------------
 *
 * The middleware execution order is strictly enforced:
 *
 *   RateLimit → Auth → Controller
 *
 * This ensures:
 *
 *   • Early rejection (cheap → expensive)
 *   • Predictable execution behavior
 *
 * ---------------------------------------------------------------------------
 *
 * 3. SIDE-EFFECT ISOLATION
 * ---------------------------------------------------------------------------
 *
 * This layer contains:
 *
 *   ❌ No business logic
 *   ❌ No database calls
 *   ❌ No cryptographic operations
 *
 * Only orchestration.
 *
 * ---------------------------------------------------------------------------
 *
 * 4. FAILURE MODES
 * ---------------------------------------------------------------------------
 *
 * Possible outcomes:
 *
 *   • 401 → Authentication failure
 *   • 429 → Rate limit exceeded
 *   • 400 → Validation (future layer)
 *   • 500 → Internal service failure
 *
 * ---------------------------------------------------------------------------
 *
 * 5. EXTENSIBILITY MODEL
 * ---------------------------------------------------------------------------
 *
 * Future enhancements:
 *
 *   • Validation middleware (Joi/Zod)
 *   • RBAC layer
 *   • Audit logging middleware
 *   • Multi-tenant scoping middleware
 *
 * =============================================================================
 *
 * END OF FILE
 * =============================================================================
 */
