/**
 * =============================================================================
 * Attendify Authentication Routes (HTTP Contract Layer)
 * =============================================================================
 *
 * FILE:
 * src/routes/auth.routes.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module defines all HTTP endpoints related to authentication within the
 * Attendify backend.
 *
 * It acts strictly as a routing and HTTP contract definition layer, delegating
 * all business logic to controllers.
 *
 * -----------------------------------------------------------------------------
 * ARCHITECTURAL POSITION
 * -----------------------------------------------------------------------------
 *
 *                         HTTP Request
 *                              │
 *                              ▼
 *                   Express Router Layer
 *                              │
 *                              ▼
 *                  Authentication Routes
 *                              │
 *                              ▼
 *                  Authentication Controller
 *                              │
 *                              ▼
 *                    Authentication Service
 *                              │
 *                              ▼
 *                       Data Repositories
 *
 * -----------------------------------------------------------------------------
 * RESPONSIBILITIES OF THIS MODULE
 * -----------------------------------------------------------------------------
 *
 * ✅ Define HTTP endpoints (paths + methods)
 * ✅ Attach middleware (validation, rate-limiting, etc.)
 * ✅ Delegate request handling to controllers
 *
 * -----------------------------------------------------------------------------
 * NON-RESPONSIBILITIES
 * -----------------------------------------------------------------------------
 *
 * ❌ No business logic
 * ❌ No database access
 * ❌ No cryptographic operations
 * ❌ No direct response formatting logic
 *
 * -----------------------------------------------------------------------------
 * ROUTE DESIGN PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Routes are declarative contracts, not execution layers."
 *
 * -----------------------------------------------------------------------------
 * ENDPOINT SPECIFICATION
 * -----------------------------------------------------------------------------
 *
 * POST /auth/register
 *   → Registers a new company account
 *
 * POST /auth/login
 *   → Authenticates a company and returns JWT
 *
 * -----------------------------------------------------------------------------
 * REQUEST FLOW DIAGRAM (REGISTER)
 * -----------------------------------------------------------------------------
 *
 *        Client Request
 *            │
 *            ▼
 *       POST /auth/register
 *            │
 *            ▼
 *     validation middleware
 *            │
 *            ▼
 *   authController.register
 *            │
 *            ▼
 *   authService.register(...)
 *            │
 *            ▼
 *   company.repository
 *
 * -----------------------------------------------------------------------------
 * REQUEST FLOW DIAGRAM (LOGIN)
 * -----------------------------------------------------------------------------
 *
 *        Client Request
 *            │
 *            ▼
 *       POST /auth/login
 *            │
 *            ▼
 *     validation middleware
 *            │
 *            ▼
 *    authController.login
 *            │
 *            ▼
 *    authService.authenticate(...)
 *            │
 *            ▼
 *    token.service.generate(...)
 *
 * -----------------------------------------------------------------------------
 * MIDDLEWARE STRATEGY
 * -----------------------------------------------------------------------------
 *
 * Middleware is attached per route and follows:
 *
 *   Request → Validation → Rate Limit → Controller
 *
 * -----------------------------------------------------------------------------
 * SECURITY PRINCIPLES
 * -----------------------------------------------------------------------------
 *
 * ✅ Input validation is mandatory
 * ✅ Rate limiting protects against brute force attacks
 * ✅ Controllers must never trust raw input
 *
 * -----------------------------------------------------------------------------
 * EXTENSIBILITY
 * -----------------------------------------------------------------------------
 *
 * New endpoints can be added here without modifying other system layers:
 *
 *   - POST /auth/refresh-token
 *   - POST /auth/logout
 *
 * -----------------------------------------------------------------------------
 * FORMAL PROPERTY
 * -----------------------------------------------------------------------------
 *
 * ∀ route R:
 *   R maps HTTP request → controller method
 *   R contains no business logic
 *
 * =============================================================================
 */

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

const express = require("express");

/**
 * Controllers
 */
const authController = require("../controllers/auth.controller");

/**
 * Validation Schemas
 */
const {
  registerSchema,
  loginSchema
} = require("../validation/auth.schemas");

/**
 * Middleware
 */
const validate = require("../middleware/validate");

/**
 * Rate Limiting
 */
const authRateLimit = require("../security/rate-limit/auth.rate-limit");

/* =============================================================================
 * ROUTER INITIALIZATION
 * =============================================================================
 */

const router = express.Router();

/* =============================================================================
 * ROUTE DEFINITIONS
 * =============================================================================
 */

/**
 * -----------------------------------------------------------------------------
 * POST /auth/register
 * -----------------------------------------------------------------------------
 *
 * Description:
 *   Registers a new company account.
 *
 * Middleware chain:
 *   1. Rate limit protection
 *   2. Request validation
 *   3. Controller execution
 */
router.post(
  "/register",
  authRateLimit,
  validate(registerSchema),
  authController.register
);

/**
 * -----------------------------------------------------------------------------
 * POST /auth/login
 * -----------------------------------------------------------------------------
 *
 * Description:
 *   Authenticates a company and returns a JWT token.
 *
 * Middleware chain:
 *   1. Rate limit protection
 *   2. Request validation
 *   3. Controller execution
 */
router.post(
  "/login",
  authRateLimit,
  validate(loginSchema),
  authController.login
);

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