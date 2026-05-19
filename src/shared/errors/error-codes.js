/**
 * =============================================================================
 * Attendify Error Codes Registry
 * =============================================================================
 *
 * FILE:
 * src/shared/errors/error-codes.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * Defines stable, machine-readable error codes, HTTP statuses, and error
 * categories used across the Attendify backend.
 *
 * DESIGN PRINCIPLE:
 * -----------------------------------------------------------------------------
 * Error codes are part of the public API contract. They must remain stable,
 * explicit, and independent from internal implementation details.
 *
 * =============================================================================
 */

const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
});

const ERROR_CATEGORIES = Object.freeze({
  CONFIGURATION: "configuration",
  VALIDATION: "validation",
  AUTHENTICATION: "authentication",
  AUTHORIZATION: "authorization",
  SECURITY: "security",
  COMPANY: "company",
  ATTENDANCE: "attendance",
  INFRASTRUCTURE: "infrastructure",
  SYSTEM: "system"
});

const ERROR_CODES = Object.freeze({
  CONFIG_INVALID: "CONFIG_INVALID",

  VALIDATION_ERROR: "VALIDATION_ERROR",
  ROUTE_NOT_FOUND: "ROUTE_NOT_FOUND",

  AUTH_MISSING_TOKEN: "AUTH_MISSING_TOKEN",
  AUTH_INVALID_TOKEN: "AUTH_INVALID_TOKEN",
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_DUPLICATE_ACCOUNT: "AUTH_DUPLICATE_ACCOUNT",
  AUTH_ACCOUNT_LOCKED: "AUTH_ACCOUNT_LOCKED",

  AUTHZ_TENANT_ACCESS_DENIED: "AUTHZ_TENANT_ACCESS_DENIED",

  COMPANY_NOT_FOUND: "COMPANY_NOT_FOUND",
  COMPANY_ALREADY_EXISTS: "COMPANY_ALREADY_EXISTS",
  COMPANY_INVALID_UPDATE: "COMPANY_INVALID_UPDATE",

  SECURITY_EDGE_SECRET_MISSING: "SECURITY_EDGE_SECRET_MISSING",
  SECURITY_EDGE_SECRET_INVALID: "SECURITY_EDGE_SECRET_INVALID",
  SECURITY_SIGNATURE_MISSING: "SECURITY_SIGNATURE_MISSING",
  SECURITY_SIGNATURE_INVALID: "SECURITY_SIGNATURE_INVALID",
  SECURITY_NONCE_MISSING: "SECURITY_NONCE_MISSING",
  SECURITY_NONCE_INVALID: "SECURITY_NONCE_INVALID",
  SECURITY_NONCE_EXPIRED: "SECURITY_NONCE_EXPIRED",
  SECURITY_REPLAY_DETECTED: "SECURITY_REPLAY_DETECTED",
  SECURITY_REQUEST_REJECTED: "SECURITY_REQUEST_REJECTED",

  ATTENDANCE_INVALID_PAYLOAD: "ATTENDANCE_INVALID_PAYLOAD",
  ATTENDANCE_REJECTED: "ATTENDANCE_REJECTED",

  INFRASTRUCTURE_MONGO_UNAVAILABLE: "INFRASTRUCTURE_MONGO_UNAVAILABLE",
  INFRASTRUCTURE_REDIS_UNAVAILABLE: "INFRASTRUCTURE_REDIS_UNAVAILABLE",

  INTERNAL_ERROR: "INTERNAL_ERROR"
});

module.exports = {
  HTTP_STATUS,
  ERROR_CATEGORIES,
  ERROR_CODES
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */