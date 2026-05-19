/**
 * =============================================================================
 * Attendify — Attendance Routes Layer (Enterprise Routing Module)
 * =============================================================================
 *
 * OVERVIEW
 * =============================================================================
 *
 * This module defines the **HTTP routing interface** for attendance-related
 * operations in the system. It represents the **transport layer boundary**
 * between external clients and internal business logic.
 *
 * The routing layer is responsible for:
 *
 *   • Endpoint definition
 *   • Middleware composition
 *   • Security enforcement integration
 *   • Request lifecycle orchestration
 *
 * =============================================================================
 *
 * 🧠 ARCHITECTURAL POSITION
 * =============================================================================
 *
 *              ┌────────────────────────────┐
 *              │        HTTP Client         │
 *              └────────────┬───────────────┘
 *                           │
 *                           ▼
 *              ┌────────────────────────────┐
 *              │     Routing Layer (THIS)   │
 *              └────────────┬───────────────┘
 *                           │
 *             ┌─────────────┼─────────────┐
 *             ▼             ▼             ▼
 *      Rate Limiter     Auth Guard     Validation
 *             │             │             │
 *             └─────────────┴─────────────┘
 *                           │
 *                           ▼
 *              ┌────────────────────────────┐
 *              │     Controller Layer      │
 *              └────────────┬───────────────┘
 *                           ▼
 *              ┌────────────────────────────┐
 *              │      Service Layer        │
 *              └────────────┬───────────────┘
 *                           ▼
 *              ┌────────────────────────────┐
 *              │      Database Layer       │
 *              └────────────────────────────┘
 *
 * =============================================================================
 *
 * 📊 REQUEST PROCESSING FLOW (PER ENDPOINT)
 * =============================================================================
 *
 *     Incoming Request
 *            │
 *            ▼
 *   Rate Limiting Middleware
 *            │
 *            ▼
 *   Authentication Guard (JWT)
 *            │
 *            ▼
 *   Request Validation (optional)
 *            │
 *            ▼
 *   Controller Execution
 *            │
 *            ▼
 *       Response Sent
 *
 * =============================================================================
 *
 * 🔐 SECURITY MODEL
 * =============================================================================
 *
 * Each endpoint enforces:
 *
 *   ✔ Rate limiting (anti-abuse)
 *   ✔ Authentication (JWT-based identity)
 *   ✔ Structured logging (via upstream middleware)
 *
 * =============================================================================
 *
 * ⚙️ DESIGN PRINCIPLES
 * =============================================================================
 *
 * • Thin routing layer (no business logic)
 * • Explicit middleware pipeline
 * • Composability
 * • Deterministic execution order
 *
 * =============================================================================
 */

const express = require("express");

const router = express.Router();

/**
 * =============================================================================
 * IMPORT MIDDLEWARES
 * =============================================================================
 */

/**
 * Authentication Guard
 * ---------------------------------------------------------------------------
 * Enforces JWT verification and attaches user identity to request.
 */
const authGuard =
  require("../security/jwt/auth.guard");

/**
 * Rate Limiter
 * ---------------------------------------------------------------------------
 * Protects attendance endpoint from abuse (e.g., rapid check-ins).
 */
const attendanceRateLimiter =
  require("../security/rate-limit/attendance.rate-limit");

/**
 * =============================================================================
 * IMPORT CONTROLLERS
 * =============================================================================
 */

/**
 * Controller functions encapsulate business logic delegation.
 *
 * NOTE:
 * Controllers must remain stateless and delegate logic to services.
 */
const {

  /**
   * Check-in operation
   */
  checkIn,

  /**
   * Check-out operation
   */
  checkOut,

  /**
   * Retrieve attendance logs
   */
  getAttendance

} = require("../controllers/attendance.controller");

/* =============================================================================
 * ROUTE DEFINITIONS
 * =============================================================================
 */

/**
 * -----------------------------------------------------------------------------
 * POST /attendance/check-in
 * -----------------------------------------------------------------------------
 *
 * DESCRIPTION:
 * ---------------------------------------------------------------------------
 * Registers a check-in event for the authenticated user.
 *
 * SECURITY LAYERS:
 *
 *   1. Rate Limiting → Protects from rapid/flood submissions
 *   2. Authentication → Ensures user identity
 *
 * FLOW:
 *
 *   Request → RateLimit → AuthGuard → Controller → Service
 *
 */
router.post(
  "/check-in",

  attendanceRateLimiter,

  authGuard,

  checkIn
);

/**
 * -----------------------------------------------------------------------------
 * POST /attendance/check-out
 * -----------------------------------------------------------------------------
 *
 * DESCRIPTION:
 * ---------------------------------------------------------------------------
 * Registers a check-out event for the authenticated user.
 *
 * FLOW:
 *
 *   Request → RateLimit → AuthGuard → Controller → Service
 *
 */
router.post(
  "/check-out",

  attendanceRateLimiter,

  authGuard,

  checkOut
);

/**
 * -----------------------------------------------------------------------------
 * GET /attendance
 * -----------------------------------------------------------------------------
 *
 * DESCRIPTION:
 * ---------------------------------------------------------------------------
 * Retrieves attendance records for the authenticated user.
 *
 * SECURITY:
 *   • Authentication required
 *
 * FLOW:
 *
 *   Request → AuthGuard → Controller → Service
 *
 */
router.get(
  "/",

  authGuard,

  getAttendance
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
 * 1. ROUTING AS A BOUNDARY
 * ---------------------------------------------------------------------------
 *
 * The routing layer must:
 *
 *   • Never contain business logic
 *   • Only orchestrate middleware
 *
 * This ensures:
 *
 *   → Testability
 *   → Maintainability
 *   → Separation of concerns
 *
 * -----------------------------------------------------------------------------
 *
 * 2. IDEMPOTENCY CONSIDERATIONS
 * ---------------------------------------------------------------------------
 *
 * Check-in/check-out endpoints are:
 *
 *   • Stateful operations
 *   • Should be guarded at service layer for duplicates
 *
 * -----------------------------------------------------------------------------
 *
 * 3. RATE LIMIT STRATEGY
 * ---------------------------------------------------------------------------
 *
 * Applied selectively to:
 *
 *   • Mutation endpoints (POST)
 *
 * Not applied to:
 *
 *   • Read endpoints (GET) for usability
 *
 * -----------------------------------------------------------------------------
 *
 * 4. EXTENSIBILITY
 * ---------------------------------------------------------------------------
 *
 * Future enhancements:
 *
 *   • Role-based restrictions (RBAC middleware)
 *   • Input validation schemas (Joi/Zod)
 *   • Auditing hooks
 *
 * -----------------------------------------------------------------------------
 *
 * 5. FAILURE MODES
 * ---------------------------------------------------------------------------
 *
 * Possible failures:
 *
 *   • 401 → Unauthorized (missing/invalid token)
 *   • 429 → Rate limit exceeded
 *   • 500 → Internal errors (controller/service level)
 *
 * =============================================================================
 *
 * END OF FILE
 * =============================================================================
 */
