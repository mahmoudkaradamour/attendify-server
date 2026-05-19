/**
 * =============================================================================
 * Attendify Application Error Abstraction
 * =============================================================================
 *
 * FILE:
 * src/shared/errors/app-error.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module defines the canonical operational error abstraction used across
 * the Attendify backend.
 *
 * The goal is to ensure that every application layer can throw predictable,
 * structured, machine-readable errors that are later normalized and formatted
 * safely by the global error handler.
 *
 * DESIGN PRINCIPLE:
 * -----------------------------------------------------------------------------
 * "Errors should be explicit internally, safe externally, and consistent across
 * all API boundaries."
 *
 * =============================================================================
 */

const {
  HTTP_STATUS,
  ERROR_CODES,
  ERROR_CATEGORIES
} = require("./error-codes");

/**
 * AppError
 * -----------------------------------------------------------------------------
 *
 * Represents an operational application error.
 *
 * Operational errors are expected runtime failures such as:
 *
 *   - Invalid credentials
 *   - Missing authorization token
 *   - Validation failure
 *   - Resource not found
 *   - Duplicate account
 *   - Replay detection
 *
 * These errors are different from programmer errors such as syntax errors,
 * broken imports, undefined variables, or invalid module contracts.
 */

class AppError extends Error {
  constructor({
    message,
    code = ERROR_CODES.INTERNAL_ERROR,
    statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    category = ERROR_CATEGORIES.SYSTEM,
    details = null,
    expose = false,
    isOperational = true
  }) {
    super(message);

    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.category = category;
    this.details = details;
    this.expose = expose;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * toLogObject()
   * ---------------------------------------------------------------------------
   *
   * Produces a structured internal representation suitable for logs.
   *
   * This method is intentionally separate from the public API response shape.
   * Logs may contain diagnostic metadata, while public responses must obey the
   * exposure policy enforced by the error handler.
   */

  toLogObject() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      category: this.category,
      details: this.details,
      expose: this.expose,
      isOperational: this.isOperational,
      stack: this.stack
    };
  }
}

/**
 * normalizeError()
 * -----------------------------------------------------------------------------
 *
 * Converts any thrown value into an AppError.
 *
 * This protects the global error handler from receiving unknown error shapes.
 */

function normalizeError(error) {
  if (error instanceof AppError) {
    return error;
  }

  return new AppError({
    message: error && error.message
      ? error.message
      : "Internal Server Error",
    code: ERROR_CODES.INTERNAL_ERROR,
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    category: ERROR_CATEGORIES.SYSTEM,
    details: null,
    expose: false,
    isOperational: false
  });
}

/**
 * validationError()
 * -----------------------------------------------------------------------------
 *
 * Used when request input fails schema validation.
 */

function validationError(message, details = null) {
  return new AppError({
    message,
    code: ERROR_CODES.VALIDATION_ERROR,
    statusCode: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORIES.VALIDATION,
    details,
    expose: true,
    isOperational: true
  });
}

/**
 * unauthorizedError()
 * -----------------------------------------------------------------------------
 *
 * Used when authentication fails.
 */

function unauthorizedError(
  message,
  code = ERROR_CODES.AUTH_INVALID_TOKEN,
  details = null
) {
  return new AppError({
    message,
    code,
    statusCode: HTTP_STATUS.UNAUTHORIZED,
    category: ERROR_CATEGORIES.AUTHENTICATION,
    details,
    expose: true,
    isOperational: true
  });
}

/**
 * forbiddenError()
 * -----------------------------------------------------------------------------
 *
 * Used when the requester is authenticated but not allowed to perform an action.
 */

function forbiddenError(
  message,
  code = ERROR_CODES.AUTHZ_TENANT_ACCESS_DENIED,
  details = null
) {
  return new AppError({
    message,
    code,
    statusCode: HTTP_STATUS.FORBIDDEN,
    category: ERROR_CATEGORIES.AUTHORIZATION,
    details,
    expose: true,
    isOperational: true
  });
}

/**
 * notFoundError()
 * -----------------------------------------------------------------------------
 *
 * Used when a requested resource or route does not exist.
 */

function notFoundError(
  message,
  code = ERROR_CODES.ROUTE_NOT_FOUND,
  details = null
) {
  return new AppError({
    message,
    code,
    statusCode: HTTP_STATUS.NOT_FOUND,
    category: ERROR_CATEGORIES.SYSTEM,
    details,
    expose: true,
    isOperational: true
  });
}

/**
 * conflictError()
 * -----------------------------------------------------------------------------
 *
 * Used when a request conflicts with existing system state.
 */

function conflictError(
  message,
  code = ERROR_CODES.COMPANY_ALREADY_EXISTS,
  details = null
) {
  return new AppError({
    message,
    code,
    statusCode: HTTP_STATUS.CONFLICT,
    category: ERROR_CATEGORIES.SYSTEM,
    details,
    expose: true,
    isOperational: true
  });
}

/**
 * tooManyRequestsError()
 * -----------------------------------------------------------------------------
 *
 * Used by rate limiters or abuse-prevention controls.
 */

function tooManyRequestsError(message, details = null) {
  return new AppError({
    message,
    code: "RATE_LIMIT_EXCEEDED",
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
    category: ERROR_CATEGORIES.SECURITY,
    details,
    expose: true,
    isOperational: true
  });
}

/**
 * internalError()
 * -----------------------------------------------------------------------------
 *
 * Used when the application intentionally wraps an internal failure.
 */

function internalError(message = "Internal Server Error", details = null) {
  return new AppError({
    message,
    code: ERROR_CODES.INTERNAL_ERROR,
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    category: ERROR_CATEGORIES.SYSTEM,
    details,
    expose: false,
    isOperational: true
  });
}

module.exports = {
  AppError,
  normalizeError,

  validationError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  conflictError,
  tooManyRequestsError,
  internalError
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */