/**
 * =============================================================================
 * Attendify Company Controller
 * =============================================================================
 *
 * FILE:
 * src/controllers/company.controller.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module implements the HTTP controller boundary for company-related
 * operations in the Attendify backend platform.
 *
 * Company controllers expose tenant-facing operations such as:
 *
 *   ✅ Reading lightweight authenticated profile data
 *   ✅ Reading full database-backed company data
 *   ✅ Public company lookup
 *   ✅ Controlled company updates
 *   ✅ Soft deletion
 *
 * -----------------------------------------------------------------------------
 * CONTROLLER ARCHITECTURE ROLE
 * -----------------------------------------------------------------------------
 *
 * Controllers are HTTP coordinators.
 *
 * They should:
 *
 *   ✅ Extract trusted request context
 *   ✅ Call service functions
 *   ✅ Return standardized responses
 *   ✅ Delegate errors to global middleware
 *
 * They should NOT:
 *
 *   ❌ Query MongoDB directly
 *   ❌ Implement business rules
 *   ❌ Sanitize sensitive database fields manually when service owns that logic
 *   ❌ Trust tenant identity from request body
 *
 * -----------------------------------------------------------------------------
 * MULTI-TENANT SECURITY PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 * For protected company operations, tenant identity must come from:
 *
 *   req.company
 *
 * This object is created only after successful JWT verification by:
 *
 *   src/middleware/auth.js
 *
 * The controller must never trust:
 *
 *   ❌ req.body.companyId
 *   ❌ req.query.companyId
 *   ❌ req.params.companyId
 *
 * for protected tenant identity.
 *
 * -----------------------------------------------------------------------------
 * COMPANY CONTROLLER FLOW
 * -----------------------------------------------------------------------------
 *
 *                    Incoming HTTP Request
 *                              │
 *                              ▼
 *                       Route Middleware
 *                 ┌────────────┼────────────┐
 *                 ▼            ▼            ▼
 *             Auth JWT     Validation    Controller
 *                                           │
 *                                           ▼
 *                                  Company Service
 *                                           │
 *                                           ▼
 *                              Standardized API Response
 *
 * -----------------------------------------------------------------------------
 * PROTECTED PROFILE FLOW
 * -----------------------------------------------------------------------------
 *
 *                  GET /company/profile
 *                          │
 *                          ▼
 *                    authMiddleware
 *                          │
 *                          ▼
 *                  req.company populated
 *                          │
 *                          ▼
 *                 companyController.profile
 *                          │
 *                          ▼
 *              Return trusted JWT identity data
 *
 * -----------------------------------------------------------------------------
 * DATABASE-BACKED COMPANY FLOW
 * -----------------------------------------------------------------------------
 *
 *                     GET /company/me
 *                          │
 *                          ▼
 *                    authMiddleware
 *                          │
 *                          ▼
 *                  req.company.id trusted
 *                          │
 *                          ▼
 *               companyService.getCompanyById()
 *                          │
 *                          ▼
 *                Return sanitized company data
 *
 * -----------------------------------------------------------------------------
 * ERROR HANDLING MODEL
 * -----------------------------------------------------------------------------
 *
 * All errors are forwarded using:
 *
 *   next(error)
 *
 * and are handled by:
 *
 *   src/middleware/error-handler.js
 *
 * -----------------------------------------------------------------------------
 * SECURITY DESIGN PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Tenant identity must be derived from verified authentication context, not
 *    client-provided input."
 *
 * =============================================================================
 */

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

const companyService = require("../services/company.service");

const {
  sendSuccess
} = require("../shared/responses/api-response");

const {
  unauthorizedError
} = require("../shared/errors/app-error");

const {
  ERROR_CODES
} = require("../shared/errors/error-codes");

/* =============================================================================
 * TRUSTED IDENTITY EXTRACTION
 * =============================================================================
 */

/**
 * getTrustedCompanyId()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Extracts the trusted company identifier from req.company.
 *
 * WHY THIS HELPER EXISTS:
 * -----------------------------------------------------------------------------
 *
 * It centralizes the trust-boundary rule:
 *
 *   Protected company identity must come from verified JWT context.
 *
 * -----------------------------------------------------------------------------
 * @param {import("express").Request} req
 *
 * @returns {string}
 */

function getTrustedCompanyId(req) {

  const companyId =
    req.company?.id;

  if (
    typeof companyId !== "string" ||
    companyId.length === 0
  ) {

    throw unauthorizedError(
      "Authenticated company context is required",
      ERROR_CODES.AUTH_INVALID_TOKEN
    );
  }

  return companyId;
}

/* =============================================================================
 * PROFILE CONTROLLER
 * =============================================================================
 */

/**
 * getProfile()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Returns lightweight company identity derived from the verified JWT.
 *
 * IMPORTANT:
 * -----------------------------------------------------------------------------
 *
 * This endpoint does not require a database lookup.
 *
 * It returns the authentication identity already established by JWT middleware.
 *
 * -----------------------------------------------------------------------------
 * RESPONSE CONTRACT:
 * -----------------------------------------------------------------------------
 *
 * {
 *   "success": true,
 *   "message": "Company profile retrieved successfully",
 *   "data": {
 *     "company": {
 *       "id": "...",
 *       "email": "...",
 *       "role": "company",
 *       "sessionId": "...",
 *       "tokenId": "..."
 *     }
 *   }
 * }
 *
 * -----------------------------------------------------------------------------
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 *
 * @returns {Promise<void>}
 */

async function getProfile(
  req,
  res,
  next
) {

  try {

    getTrustedCompanyId(req);

    return sendSuccess(
      res,
      {
        message:
          "Company profile retrieved successfully",

        data: {
          company:
            req.company
        },

        req
      }
    );

  } catch (error) {

    return next(error);
  }
}

/* =============================================================================
 * FULL COMPANY DATA CONTROLLER
 * =============================================================================
 */

/**
 * getMe()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Returns database-backed sanitized company data for the authenticated company.
 *
 * -----------------------------------------------------------------------------
 * FLOW:
 * -----------------------------------------------------------------------------
 *
 *                 authMiddleware
 *                       │
 *                       ▼
 *              req.company.id trusted
 *                       │
 *                       ▼
 *          companyService.getCompanyById(id)
 *                       │
 *                       ▼
 *             sanitized company response
 *
 * -----------------------------------------------------------------------------
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 *
 * @returns {Promise<void>}
 */

async function getMe(
  req,
  res,
  next
) {

  try {

    const companyId =
      getTrustedCompanyId(req);

    const company =
      await companyService.getCompanyById(
        companyId
      );

    return sendSuccess(
      res,
      {
        message:
          "Company data retrieved successfully",

        data: {
          company
        },

        req
      }
    );

  } catch (error) {

    return next(error);
  }
}

/* =============================================================================
 * PUBLIC COMPANY LOOKUP CONTROLLER
 * =============================================================================
 */

/**
 * lookupCompany()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Performs public-safe company lookup by name.
 *
 * SECURITY MODEL:
 * -----------------------------------------------------------------------------
 *
 * This endpoint is public but must return only minimal safe metadata.
 *
 * It must never expose:
 *
 *   ❌ email
 *   ❌ passwordHash
 *   ❌ loginAttempts
 *   ❌ lockUntil
 *   ❌ internal security fields
 *
 * The service layer is responsible for returning a safe structure.
 *
 * -----------------------------------------------------------------------------
 * EXPECTED PARAMS:
 * -----------------------------------------------------------------------------
 *
 *   req.params.name
 *
 * -----------------------------------------------------------------------------
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 *
 * @returns {Promise<void>}
 */

async function lookupCompany(
  req,
  res,
  next
) {

  try {

    const name =
      req.params.name;

    const result =
      await companyService.lookupCompanyByName(
        name
      );

    return sendSuccess(
      res,
      {
        message:
          "Company lookup completed successfully",

        data:
          result,

        req
      }
    );

  } catch (error) {

    return next(error);
  }
}

/* =============================================================================
 * UPDATE COMPANY CONTROLLER
 * =============================================================================
 */

/**
 * updateCompany()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Updates allowed company fields for the authenticated company.
 *
 * SECURITY MODEL:
 * -----------------------------------------------------------------------------
 *
 * The company id is always taken from:
 *
 *   req.company.id
 *
 * not from request body.
 *
 * Updatable fields are controlled by validation schema and service logic.
 *
 * -----------------------------------------------------------------------------
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 *
 * @returns {Promise<void>}
 */

async function updateCompany(
  req,
  res,
  next
) {

  try {

    const companyId =
      getTrustedCompanyId(req);

    const company =
      await companyService.updateCompany(
        companyId,
        req.body
      );

    return sendSuccess(
      res,
      {
        message:
          "Company updated successfully",

        data: {
          company
        },

        req
      }
    );

  } catch (error) {

    return next(error);
  }
}

/* =============================================================================
 * SOFT DELETE COMPANY CONTROLLER
 * =============================================================================
 */

/**
 * deleteCompany()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 *
 * Performs logical deletion for the authenticated company.
 *
 * SECURITY MODEL:
 * -----------------------------------------------------------------------------
 *
 * The delete target is always the authenticated tenant:
 *
 *   req.company.id
 *
 * The controller never accepts company id from the request body.
 *
 * -----------------------------------------------------------------------------
 * SOFT DELETE MODEL:
 * -----------------------------------------------------------------------------
 *
 * The company document is not physically removed.
 *
 * Instead, service/repository logic marks it as deleted.
 *
 * This supports:
 *
 *   ✅ Auditability
 *   ✅ Future recovery
 *   ✅ Historical consistency
 *
 * -----------------------------------------------------------------------------
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 *
 * @returns {Promise<void>}
 */

async function deleteCompany(
  req,
  res,
  next
) {

  try {

    const companyId =
      getTrustedCompanyId(req);

    const result =
      await companyService.deleteCompany(
        companyId
      );

    return sendSuccess(
      res,
      {
        message:
          "Company deleted successfully",

        data:
          result,

        req
      }
    );

  } catch (error) {

    return next(error);
  }
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {

  /**
   * Trusted identity helper.
   */
  getTrustedCompanyId,

  /**
   * GET /company/profile
   */
  getProfile,

  /**
   * GET /company/me
   */
  getMe,

  /**
   * GET /company/lookup/:name
   */
  lookupCompany,

  /**
   * PUT /company/update
   */
  updateCompany,

  /**
   * DELETE /company/delete
   */
  deleteCompany
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */