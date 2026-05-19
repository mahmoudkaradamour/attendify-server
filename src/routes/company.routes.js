/**
 * =============================================================================
 * Attendify Company Routes
 * =============================================================================
 *
 * FILE:
 * src/routes/company.routes.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module defines the HTTP routing layer for company-related operations in
 * the Attendify backend platform.
 *
 * The routing layer is responsible for composing the request-processing
 * pipeline for each company endpoint.
 *
 * It does NOT own:
 *
 *   ❌ Business logic
 *   ❌ MongoDB queries
 *   ❌ Tenant authorization decisions
 *   ❌ Sensitive-field sanitization
 *   ❌ Password/security state management
 *
 * Those responsibilities belong to:
 *
 *   ✅ Controllers
 *   ✅ Services
 *   ✅ Repositories
 *   ✅ Security middleware
 *
 * -----------------------------------------------------------------------------
 * COMPANY ROUTES PROVIDED BY THIS MODULE
 * -----------------------------------------------------------------------------
 *
 * This router exposes the following company endpoints:
 *
 *   GET    /company/profile
 *   GET    /company/me
 *   GET    /company/lookup/:name
 *   PUT    /company/update
 *   DELETE /company/delete
 *
 * -----------------------------------------------------------------------------
 * ROUTE RESPONSIBILITY MODEL
 * -----------------------------------------------------------------------------
 *
 * Routes are composition boundaries.
 *
 * They define:
 *
 *   ✅ Which HTTP method is supported
 *   ✅ Which path is exposed
 *   ✅ Which middleware applies
 *   ✅ Which controller handles the request
 *
 * Routes must remain thin and declarative.
 *
 * -----------------------------------------------------------------------------
 * MULTI-TENANT SECURITY MODEL
 * -----------------------------------------------------------------------------
 *
 * Protected company operations must derive tenant identity only from:
 *
 *   req.company
 *
 * This object is created by:
 *
 *   src/middleware/auth.js
 *
 * after successful JWT verification.
 *
 * Protected company routes must NEVER trust tenant identity from:
 *
 *   ❌ req.body.companyId
 *   ❌ req.query.companyId
 *   ❌ req.params.companyId
 *
 * WHY?
 *
 * Because client-provided tenant identifiers may be forged or manipulated.
 *
 * -----------------------------------------------------------------------------
 * ROUTE PIPELINE MODEL
 * -----------------------------------------------------------------------------
 *
 * Protected route pipeline:
 *
 *                    Incoming HTTP Request
 *                              │
 *                              ▼
 *                    Authentication Middleware
 *                              │
 *                              ▼
 *                    Optional Validation Layer
 *                              │
 *                              ▼
 *                    Company Controller
 *                              │
 *                              ▼
 *                    Company Service
 *                              │
 *                              ▼
 *                    Company Repository
 *
 * Public route pipeline:
 *
 *                    Incoming HTTP Request
 *                              │
 *                              ▼
 *                    Company Controller
 *                              │
 *                              ▼
 *                    Public-Safe Service Logic
 *
 * -----------------------------------------------------------------------------
 * ENDPOINT SECURITY CLASSIFICATION
 * -----------------------------------------------------------------------------
 *
 * Protected endpoints:
 *
 *   GET    /profile
 *   GET    /me
 *   PUT    /update
 *   DELETE /delete
 *
 * Public endpoint:
 *
 *   GET /lookup/:name
 *
 * The public lookup endpoint must return only minimal safe metadata.
 *
 * It must never expose:
 *
 *   ❌ email
 *   ❌ passwordHash
 *   ❌ loginAttempts
 *   ❌ lockUntil
 *   ❌ internal security fields
 *
 * -----------------------------------------------------------------------------
 * ROUTE FLOW DIAGRAM
 * -----------------------------------------------------------------------------
 *
 *                  Company Request
 *                         │
 *                         ▼
 *                  Route Declaration
 *                         │
 *          ┌──────────────┼──────────────┐
 *          ▼              ▼              ▼
 *       Public         Protected      Mutating
 *       Lookup          Read          Update/Delete
 *          │              │              │
 *          ▼              ▼              ▼
 *    Controller       authMiddleware   authMiddleware
 *                         │              │
 *                         ▼              ▼
 *                    Controller       Validation
 *                                        │
 *                                        ▼
 *                                    Controller
 *
 * -----------------------------------------------------------------------------
 * ERROR HANDLING MODEL
 * -----------------------------------------------------------------------------
 *
 * Route handlers do not manually format errors.
 *
 * Controllers forward errors using:
 *
 *   next(error)
 *
 * The global error middleware handles:
 *
 *   ✅ Logging
 *   ✅ Status mapping
 *   ✅ Safe response formatting
 *   ✅ Request correlation metadata
 *
 * -----------------------------------------------------------------------------
 * SECURITY DESIGN PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Company routes must compose authentication, validation, and controllers
 *    without embedding business logic."
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
 * Provides Router, the modular routing abstraction used by the HTTP application.
 */
const express = require("express");

/**
 * Company controller:
 * -----------------------------------------------------------------------------
 *
 * Owns the HTTP boundary for company operations.
 */
const companyController = require("../controllers/company.controller");

/**
 * Authentication middleware:
 * -----------------------------------------------------------------------------
 *
 * Verifies JWT Bearer tokens and attaches trusted company identity to:
 *
 *   req.company
 */
const authMiddleware = require("../middleware/auth");

/**
 * Validation middleware:
 * -----------------------------------------------------------------------------
 *
 * Applies Zod schema validation to selected request targets.
 */
const validate = require("../middleware/validate");

/**
 * Company validation schemas:
 * -----------------------------------------------------------------------------
 *
 * Defines request contracts for company operations.
 */
const {
  updateCompanySchema
} = require("../validation/company.schemas");

/* =============================================================================
 * ROUTER INITIALIZATION
 * =============================================================================
 */

/**
 * router
 * -----------------------------------------------------------------------------
 *
 * Dedicated Express router for company domain endpoints.
 */

const router =
  express.Router();

/* =============================================================================
 * ROUTE: GET /company/profile
 * =============================================================================
 */

/**
 * GET /profile
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Returns lightweight company identity extracted directly from the verified JWT.
 *
 * -----------------------------------------------------------------------------
 * PIPELINE:
 * -----------------------------------------------------------------------------
 *
 *   1. authMiddleware
 *      Verifies JWT and populates req.company.
 *
 *   2. companyController.getProfile
 *      Returns trusted identity context.
 *
 * -----------------------------------------------------------------------------
 * DATABASE ACCESS:
 * -----------------------------------------------------------------------------
 *
 * This route does not require a database lookup.
 *
 * It returns identity already verified by JWT middleware.
 */

router.get(
  "/profile",

  authMiddleware,

  companyController.getProfile
);

/* =============================================================================
 * ROUTE: GET /company/me
 * =============================================================================
 */

/**
 * GET /me
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Returns sanitized database-backed company data for the authenticated tenant.
 *
 * -----------------------------------------------------------------------------
 * PIPELINE:
 * -----------------------------------------------------------------------------
 *
 *   1. authMiddleware
 *      Establishes trusted tenant identity.
 *
 *   2. companyController.getMe
 *      Calls service layer to retrieve sanitized company data.
 *
 * -----------------------------------------------------------------------------
 * SECURITY:
 * -----------------------------------------------------------------------------
 *
 * The target company is derived from req.company.id only.
 */

router.get(
  "/me",

  authMiddleware,

  companyController.getMe
);

/* =============================================================================
 * ROUTE: GET /company/lookup/:name
 * =============================================================================
 */

/**
 * GET /lookup/:name
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Performs public-safe company lookup by company name.
 *
 * -----------------------------------------------------------------------------
 * SECURITY CLASSIFICATION:
 * -----------------------------------------------------------------------------
 *
 * Public endpoint.
 *
 * -----------------------------------------------------------------------------
 * IMPORTANT:
 * -----------------------------------------------------------------------------
 *
 * Public lookup must return minimal metadata only.
 *
 * It must never expose:
 *
 *   ❌ email
 *   ❌ passwordHash
 *   ❌ loginAttempts
 *   ❌ lockUntil
 *   ❌ internal fields
 *
 * -----------------------------------------------------------------------------
 * PIPELINE:
 * -----------------------------------------------------------------------------
 *
 *   1. companyController.lookupCompany
 *      Delegates lookup behavior to service layer.
 */

router.get(
  "/lookup/:name",

  companyController.lookupCompany
);

/* =============================================================================
 * ROUTE: PUT /company/update
 * =============================================================================
 */

/**
 * PUT /update
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Updates allowed fields for the authenticated company.
 *
 * -----------------------------------------------------------------------------
 * PIPELINE:
 * -----------------------------------------------------------------------------
 *
 *   1. authMiddleware
 *      Establishes trusted tenant identity.
 *
 *   2. validate(updateCompanySchema)
 *      Ensures request body contains only allowed update fields.
 *
 *   3. companyController.updateCompany
 *      Delegates update operation to service layer.
 *
 * -----------------------------------------------------------------------------
 * ALLOWED FIELDS:
 * -----------------------------------------------------------------------------
 *
 *   ✅ name
 *   ✅ email
 *
 * -----------------------------------------------------------------------------
 * PROTECTED FIELDS:
 * -----------------------------------------------------------------------------
 *
 * These must never be accepted from request body:
 *
 *   ❌ id
 *   ❌ _id
 *   ❌ passwordHash
 *   ❌ loginAttempts
 *   ❌ lockUntil
 *   ❌ role
 *   ❌ status
 */

router.put(
  "/update",

  authMiddleware,

  validate(updateCompanySchema),

  companyController.updateCompany
);

/* =============================================================================
 * ROUTE: DELETE /company/delete
 * =============================================================================
 */

/**
 * DELETE /delete
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Performs logical deletion for the authenticated company.
 *
 * -----------------------------------------------------------------------------
 * PIPELINE:
 * -----------------------------------------------------------------------------
 *
 *   1. authMiddleware
 *      Establishes trusted company identity.
 *
 *   2. companyController.deleteCompany
 *      Delegates soft delete behavior to service layer.
 *
 * -----------------------------------------------------------------------------
 * SOFT DELETE MODEL:
 * -----------------------------------------------------------------------------
 *
 * The company record should not be physically removed.
 *
 * Instead, service/repository logic marks the company as deleted.
 *
 * This supports:
 *
 *   ✅ Auditability
 *   ✅ Recovery options
 *   ✅ Historical consistency
 */

router.delete(
  "/delete",

  authMiddleware,

  companyController.deleteCompany
);

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

/**
 * Export company router.
 *
 * This router is mounted by:
 *
 *   src/app/register-routes.js
 *
 * under:
 *
 *   /company
 */

module.exports =
  router;

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */