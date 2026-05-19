/**
 * =============================================================================
 * Attendify Nonce Routes
 * =============================================================================
 *
 * FILE:
 * src/routes/nonce.routes.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module defines the HTTP routing layer for nonce issuance in the Attendify
 * backend platform.
 *
 * A nonce is a cryptographically secure, short-lived value used to establish
 * request freshness and support replay-attack prevention.
 *
 * In the Attendify security model, nonce issuance is part of the cryptographic
 * request lifecycle used by signed attendance submissions.
 *
 * -----------------------------------------------------------------------------
 * WHAT THIS ROUTER PROVIDES
 * -----------------------------------------------------------------------------
 *
 * This router exposes:
 *
 *   GET /nonce
 *
 * When mounted by the application under:
 *
 *   /nonce
 *
 * the final endpoint becomes:
 *
 *   GET /nonce
 *
 * -----------------------------------------------------------------------------
 * ROUTING RESPONSIBILITY MODEL
 * -----------------------------------------------------------------------------
 *
 * Routes are composition boundaries.
 *
 * A route is responsible for declaring:
 *
 *   ✅ HTTP method
 *   ✅ URL path
 *   ✅ Middleware chain
 *   ✅ Controller handler
 *
 * A route must NOT contain:
 *
 *   ❌ Business logic
 *   ❌ Randomness generation logic
 *   ❌ Cryptographic verification logic
 *   ❌ Redis replay-store logic
 *   ❌ Database logic
 *   ❌ Manual response formatting
 *
 * Those responsibilities belong to:
 *
 *   ✅ Controllers
 *   ✅ Services
 *   ✅ Security modules
 *   ✅ Repositories
 *   ✅ Shared response builders
 *
 * -----------------------------------------------------------------------------
 * WHY NONCE ROUTES REQUIRE RATE LIMITING
 * -----------------------------------------------------------------------------
 *
 * Nonce endpoints are commonly public or lightly protected.
 *
 * Without rate limiting, attackers could:
 *
 *   ❌ Flood nonce generation
 *   ❌ Exhaust memory or Redis resources
 *   ❌ Create excessive security metadata
 *   ❌ Use nonce issuance as an abuse amplifier
 *
 * Therefore this route applies:
 *
 *   nonceRateLimiter
 *
 * before reaching the controller.
 *
 * -----------------------------------------------------------------------------
 * NONCE ROUTE FLOW
 * -----------------------------------------------------------------------------
 *
 *                         Incoming Request
 *                                │
 *                                ▼
 *                         GET /nonce
 *                                │
 *                                ▼
 *                       nonceRateLimiter
 *                                │
 *                 ┌──────────────┴──────────────┐
 *                 ▼                             ▼
 *              Allowed                       Blocked
 *                 │                             │
 *                 ▼                             ▼
 *        nonceController.generateNonce    429 Too Many Requests
 *                 │
 *                 ▼
 *           nonceService.generateNonce()
 *                 │
 *                 ▼
 *        Standardized API Response
 *
 * -----------------------------------------------------------------------------
 * RESPONSE CONTRACT
 * -----------------------------------------------------------------------------
 *
 * Successful response:
 *
 * {
 *   "success": true,
 *   "message": "Nonce generated successfully",
 *   "data": {
 *     "nonce": {
 *       "value": "64-character-hex-string",
 *       "issuedAt": 1710000000000,
 *       "expiresAt": 1710000300000,
 *       "ttlSeconds": 300
 *     }
 *   },
 *   "meta": {
 *     "requestId": "req_..."
 *   }
 * }
 *
 * -----------------------------------------------------------------------------
 * SECURITY DESIGN PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Freshness-token issuance must be rate-limited, deterministic, and
 *    delegated to a centralized service."
 *
 * =============================================================================
 */

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

/**
 * Express:
 * -----------------------------------------------------------------------------
 *
 * Provides the Router abstraction used to create modular HTTP route groups.
 */
const express = require("express");

/**
 * Nonce controller:
 * -----------------------------------------------------------------------------
 *
 * Owns the HTTP boundary for nonce issuance.
 */
const nonceController = require("../controllers/nonce.controller");

/**
 * Nonce rate limiter:
 * -----------------------------------------------------------------------------
 *
 * Protects nonce generation from excessive request volume.
 */
const nonceRateLimiter = require("../security/rate-limit/nonce.rate-limit");

/* =============================================================================
 * ROUTER INITIALIZATION
 * =============================================================================
 */

/**
 * router
 * -----------------------------------------------------------------------------
 *
 * Dedicated Express router for nonce endpoints.
 */

const router =
  express.Router();

/* =============================================================================
 * ROUTE: GET /nonce
 * =============================================================================
 */

/**
 * GET /
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Issues a fresh cryptographic nonce.
 *
 * When this router is mounted under:
 *
 *   /nonce
 *
 * the final endpoint becomes:
 *
 *   GET /nonce
 *
 * -----------------------------------------------------------------------------
 * PIPELINE:
 * -----------------------------------------------------------------------------
 *
 *   1. nonceRateLimiter
 *      Protects the nonce issuance endpoint from abuse.
 *
 *   2. nonceController.generateNonce
 *      Delegates nonce generation to the nonce service and returns a
 *      standardized API response.
 *
 * -----------------------------------------------------------------------------
 * IMPORTANT:
 * -----------------------------------------------------------------------------
 *
 * This route does not validate a request body because nonce issuance via GET
 * does not require a JSON payload.
 */

router.get(
  "/",

  nonceRateLimiter,

  nonceController.generateNonce
);

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

/**
 * Export nonce router.
 *
 * This router is mounted by:
 *
 *   src/app/register-routes.js
 *
 * under:
 *
 *   /nonce
 */

module.exports =
  router;

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */