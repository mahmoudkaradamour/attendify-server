/**
 * =============================================================================
 * Attendify Company Service
 * =============================================================================
 *
 * FILE:
 * src/services/company.service.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * Implements business logic related to company management.
 *
 * This includes:
 *
 *   ✅ Fetching company profile
 *   ✅ Updating company data
 *   ✅ Safe data exposure (excluding sensitive fields)
 *
 * -----------------------------------------------------------------------------
 * ARCHITECTURE POSITION
 * -----------------------------------------------------------------------------
 *
 *        Controller
 *            │
 *            ▼
 *     Company Service (THIS)
 *            │
 *            ▼
 *     Company Repository
 *
 * -----------------------------------------------------------------------------
 * PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   Service layer is responsible for:
 *
 *     ✅ Business rules
 *     ✅ Data transformation
 *     ✅ Security filtering
 *
 *   NOT:
 *     ❌ Raw DB queries
 *     ❌ HTTP concerns
 *
 * -----------------------------------------------------------------------------
 * DATA FLOW
 * -----------------------------------------------------------------------------
 *
 *     Request Input (Validated)
 *            │
 *            ▼
 *     Fetch or Update Data
 *            │
 *            ▼
 *     Sanitize Output
 *            │
 *            ▼
 *     Return to Controller
 *
 * -----------------------------------------------------------------------------
 * SECURITY DESIGN PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Sensitive fields must never cross service boundaries."
 *
 * =============================================================================
 */

const companyRepository = require("../repositories/company.repository");

const {
  notFoundError
} = require("../shared/errors/app-error");

const {
  ERROR_CODES
} = require("../shared/errors/error-codes");

/* =============================================================================
 * SANITIZATION
 * =============================================================================
 */

/**
 * sanitizeCompany()
 *
 * Removes sensitive fields.
 */

function sanitizeCompany(company) {

  if (!company) return null;

  return {

    _id: company._id,
    email: company.email,
    name: company.name,
    createdAt: company.createdAt

  };
}

/* =============================================================================
 * GET COMPANY BY ID
 * =============================================================================
 */

async function getCompanyById(id) {

  const company = await companyRepository.findById(id);

  if (!company) {

    throw notFoundError(
      "Company not found",
      ERROR_CODES.COMPANY_NOT_FOUND
    );
  }

  return sanitizeCompany(company);
}

/* =============================================================================
 * UPDATE COMPANY
 * =============================================================================
 */

async function updateCompany(id, updates) {

  const company = await companyRepository.findById(id);

  if (!company) {

    throw notFoundError(
      "Company not found",
      ERROR_CODES.COMPANY_NOT_FOUND
    );
  }

  const updated = await companyRepository.updateCompany(id, updates);

  return sanitizeCompany(updated);
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {

  getCompanyById,
  updateCompany

};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */