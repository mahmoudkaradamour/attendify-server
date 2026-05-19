/**
 * =============================================================================
 * Attendify Authentication Controller (Application Orchestration Layer)
 * =============================================================================
 *
 * FILE:
 * src/controllers/auth.controller.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This controller orchestrates authentication-related HTTP requests by
 * delegating business logic to services and formatting responses using the
 * standardized API response utilities.
 *
 * -----------------------------------------------------------------------------
 * ARCHITECTURAL ROLE
 * -----------------------------------------------------------------------------
 *
 * This layer sits between:
 *
 *   HTTP Layer (Routes)
 *   AND
 *   Business Logic Layer (Services)
 *
 * It is responsible for:
 *
 *   - Receiving validated input from routes
 *   - Calling appropriate service methods
 *   - Handling async control flow
 *   - Returning standardized API responses
 *
 * -----------------------------------------------------------------------------
 * LAYERED EXECUTION FLOW
 * -----------------------------------------------------------------------------
 *
 *                 Client Request
 *                        │
 *                        ▼
 *                 Express Route
 *                        │
 *                        ▼
 *              auth.controller.<method>
 *                        │
 *                        ▼
 *              auth.service.<method>
 *                        │
 *                        ▼
 *              database / crypto layer
 *                        │
 *                        ▼
 *            structured response returned
 *
 * -----------------------------------------------------------------------------
 * CONTROLLER RESPONSIBILITIES
 * -----------------------------------------------------------------------------
 *
 * ✅ Extract validated input from req.body
 * ✅ Call service methods
 * ✅ Handle async/await flow
 * ✅ Return standardized API responses
 * ✅ Forward errors to central error handler
 *
 * -----------------------------------------------------------------------------
 * NON-RESPONSIBILITIES
 * -----------------------------------------------------------------------------
 *
 * ❌ No direct database access
 * ❌ No cryptographic logic
 * ❌ No business rule implementation
 * ❌ No manual error formatting
 *
 * -----------------------------------------------------------------------------
 * ERROR FLOW MODEL
 * -----------------------------------------------------------------------------
 *
 *   Service throws → Controller catches → next(error)
 *         → error-handler middleware → standardized response
 *
 * -----------------------------------------------------------------------------
 * DESIGN PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Controllers coordinate, services decide."
 *
 * -----------------------------------------------------------------------------
 * ENDPOINTS IMPLEMENTED
 * -----------------------------------------------------------------------------
 *
 * register(req, res, next)
 *   → Handles company registration
 *
 * login(req, res, next)
 *   → Handles authentication and token issuance
 *
 * =============================================================================
 */

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

/**
 * Services
 */
const authService = require("../services/auth.service");

/**
 * Response utilities
 */
const {
  sendSuccess,
  sendCreated
} = require("../shared/responses/api-response");

/* =============================================================================
 * CONTROLLER METHODS
 * =============================================================================
 */

/**
 * -----------------------------------------------------------------------------
 * register()
 * -----------------------------------------------------------------------------
 *
 * Handles company registration requests.
 *
 * FLOW:
 *
 *   1. Extract validated input
 *   2. Call authService.register
 *   3. Return created response
 *
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */

async function register(req, res, next) {

  try {

    /**
     * STEP 1: Extract validated request body
     *
     * Input structure ensured by validation middleware
     */
    const payload = req.body;

    /**
     * STEP 2: Delegate to service layer
     *
     * Expected result:
     * {
     *   company: {...},
     *   token: "jwt..."
     * }
     */
    const result =
      await authService.register(payload);

    /**
     * STEP 3: Send standardized response
     */
    return sendCreated(res, {
      message: "Company registered successfully",
      data: result,
      req
    });

  } catch (error) {

    /**
     * STEP 4: Forward error to global handler
     */
    return next(error);
  }
}

/**
 * -----------------------------------------------------------------------------
 * login()
 * -----------------------------------------------------------------------------
 *
 * Handles authentication requests.
 *
 * FLOW:
 *
 *   1. Extract validated input
 *   2. Call authService.login
 *   3. Return success response with token
 *
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */

async function login(req, res, next) {

  try {

    /**
     * STEP 1: Extract validated request body
     */
    const payload = req.body;

    /**
     * STEP 2: Delegate to service layer
     *
     * Expected result:
     * {
     *   token: "jwt...",
     *   company: {...}
     * }
     */
    const result =
      await authService.login(payload);

    /**
     * STEP 3: Return success response
     */
    return sendSuccess(res, {
      message: "Login successful",
      data: result,
      req
    });

  } catch (error) {

    /**
     * STEP 4: Forward error to global handler
     */
    return next(error);
  }
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