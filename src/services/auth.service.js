/**
 * ============================================================================= Business Logic Layer) * =============================================================================
 * =============================================================================
 *
 * FILE:
 * src/services/auth.service.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module implements the core authentication domain logic for Attendify.
 *
 * It is the primary decision-making layer for:
 *
 *   - Company registration
 *   - Authentication (login)
 *   - Credential verification
 *   - Security enforcement (rate controls, lockouts)
 *   - Token issuance (delegation to token service)
 *
 * -----------------------------------------------------------------------------
 * ARCHITECTURAL POSITION
 * -----------------------------------------------------------------------------
 *
 *                     Controller Layer
 *                           │
 *                           ▼
 *        ┌────────────────────────────────────────┐
 *        │   Authentication Service (THIS FILE)   │
 *        └────────────────────────────────────────┘
 *               │            │            │
 *               ▼            ▼            ▼
 *        Hash Utilities   Token Service   Repository Layer
 *               │            │            │
 *               └─────── Domain Decisions ────────┘
 *
 * -----------------------------------------------------------------------------
 * CORE PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "The service layer owns business rules, invariants, and system decisions."
 *
 * -----------------------------------------------------------------------------
 * RESPONSIBILITIES
 * -----------------------------------------------------------------------------
 *
 * ✅ Enforce domain constraints (uniqueness, validity)
 * ✅ Coordinate multiple components (repo, crypto, token)
 * ✅ Apply security policies (lockout, attempt tracking)
 * ✅ Transform raw data into domain objects
 *
 * -----------------------------------------------------------------------------
 * NON-RESPONSIBILITIES
 * -----------------------------------------------------------------------------
 *
 * ❌ No HTTP request handling
 * ❌ No direct response formatting
 * ❌ No middleware responsibilities
 *
 * -----------------------------------------------------------------------------
 * SECURITY ARCHITECTURE OVERVIEW
 * -----------------------------------------------------------------------------
 *
 *                      LOGIN ATTEMPT
 *                            │
 *                            ▼
 *                   Retrieve Company
 *                            │
 *                            ▼
 *                   Check Lock Status
 *                     │         │
 *                     ▼         ▼
 *                Locked     Not Locked
 *                  │             │
 *                  ▼             ▼
 *               Reject     Verify Password
 *                             │
 *                ┌────────────┴────────────┐
 *                ▼                         ▼
 *            Success                  Failure
 *                │                         │
 *                ▼                         ▼
 *         Reset Attempts         Increment Attempts
 *                │                         │
 *                ▼                         ▼
 *         Issue Token          Possibly Lock Account
 *
 * -----------------------------------------------------------------------------
 * PASSWORD SECURITY MODEL
 * -----------------------------------------------------------------------------
 *
 * Passwords are never stored in plaintext.
 *
 * Instead:
 *
 *   password → bcrypt → hash → store
 *
 * Verification:
 *
 *   compare(inputPassword, storedHash)
 *
 * -----------------------------------------------------------------------------
 * ACCOUNT LOCKOUT MODEL
 * -----------------------------------------------------------------------------
 *
 * Let:
 *   A = number of failed attempts
 *   M = MAX_LOGIN_ATTEMPTS
 *   T = LOCK_DURATION (minutes)
 *
 * Rule:
 *
 *   if A >= M:
 *      account is locked for T minutes
 *
 * This mitigates:
 *
 *   - brute force attacks
 *   - credential stuffing
 *
 * -----------------------------------------------------------------------------
 * REGISTER FLOW (DETAILED)
 * -----------------------------------------------------------------------------
 *
 *    Input: { name, email, password }
 *             │
 *             ▼
 *   [1] Check if email exists
 *             │
 *             ▼
 *   [2] Hash password (bcrypt)
 *             │
 *             ▼
 *   [3] Persist company record
 *             │
 *             ▼
 *   [4] Generate JWT token
 *             │
 *             ▼
 *   [5] Return domain object
 *
 * -----------------------------------------------------------------------------
 * LOGIN FLOW (DETAILED)
 * -----------------------------------------------------------------------------
 *
 *    Input: { email, password }
 *             │
 *             ▼
 *   [1] Fetch company by email
 *             │
 *             ▼
 *   [2] Check lock status
 *             │
 *             ▼
 *   [3] Compare password
 *        │             │
 *        ▼             ▼
 *     match         mismatch
 *        │             │
 *        ▼             ▼
 *   reset attempts  increment attempts
 *        │             │
 *        ▼             ▼
 *   issue token    maybe lock account
 *
 * -----------------------------------------------------------------------------
 * RETURN CONTRACT
 * -----------------------------------------------------------------------------
 *
 * SUCCESS RESPONSE:
 *
 * {
 *   company: {
 *     id: string,
 *     name: string,
 *     email: string
 *   },
 *   token: string
 * }
 *
 * -----------------------------------------------------------------------------
 * DESIGN GUARANTEES
 * -----------------------------------------------------------------------------
 *
 * ✅ Idempotent registration (duplicates prevented)
 * ✅ Strong password hashing
 * ✅ Stateless authentication (JWT)
 * ✅ Protection against brute-force attacks
 *
 * =============================================================================
 */

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

const companyRepository = require("../repositories/company.repository");

const {
  hashPassword,
  comparePassword
} = require("../utils/hash");

const tokenService = require("../security/jwt/token.service");

const config = require("../config/env");

const {
  conflictError,
  unauthorizedError
} = require("../shared/errors/app-error");

/* =============================================================================
 * REGISTER
 * =============================================================================
 */

/**
 * Registers a new company.
 *
 * @param {object} payload
 * @returns {Promise<object>}
 */
async function register(payload) {

  const { name, email, password } = payload;

  /**
   * STEP 1: Ensure uniqueness (email must be unique)
   */
  const existing =
    await companyRepository.findByEmail(email);

  if (existing) {
    throw conflictError("Company already exists");
  }

  /**
   * STEP 2: Hash password using bcrypt
   */
  const passwordHash =
    await hashPassword(password);

  /**
   * STEP 3: Persist company record
   */
  const company =
    await companyRepository.create({
      name,
      email,
      password: passwordHash
    });

  /**
   * STEP 4: Generate authentication token
   */
  const token =
    tokenService.generate({
      companyId: company.id
    });

  /**
   * STEP 5: Return domain-safe object
   */
  return {
    company: {
      id: company.id,
      name: company.name,
      email: company.email
    },
    token
  };
}

/* =============================================================================
 * LOGIN
 * =============================================================================
 */

/**
 * Authenticates a company and returns a token.
 *
 * @param {object} payload
 * @returns {Promise<object>}
 */
async function login(payload) {

  const { email, password } = payload;

  /**
   * STEP 1: Retrieve company by email
   */
  const company =
    await companyRepository.findByEmail(email);

  if (!company) {
    throw unauthorizedError("Invalid credentials");
  }

  /**
   * STEP 2: Check account lock status
   */
  if (
    company.lockUntil &&
    company.lockUntil > Date.now()
  ) {
    throw unauthorizedError("Account temporarily locked");
  }

  /**
   * STEP 3: Compare password securely
   */
  const isMatch =
    await comparePassword(password, company.password);

  /**
   * STEP 4: Handle failed authentication
   */
  if (!isMatch) {

    const attempts =
      (company.loginAttempts || 0) + 1;

    const update = {
      loginAttempts: attempts
    };

    /**
     * Lock account if threshold reached
     */
    if (attempts >= config.MAX_LOGIN_ATTEMPTS) {

      update.lockUntil =
        Date.now() +
        config.LOCK_DURATION * 60 * 1000;
    }

    await companyRepository.updateSecurity(
      company.id,
      update
    );

    throw unauthorizedError("Invalid credentials");
  }

  /**
   * STEP 5: Reset security counters
   */
  await companyRepository.updateSecurity(
    company.id,
    {
      loginAttempts: 0,
      lockUntil: null
    }
  );

  /**
   * STEP 6: Generate JWT token
   */
  const token =
    tokenService.generate({
      companyId: company.id
    });

  /**
   * STEP 7: Return result
   */
  return {
    company: {
      id: company.id,
      name: company.name,
      email: company.email
    },
    token
  };
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  register,
  login
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */
