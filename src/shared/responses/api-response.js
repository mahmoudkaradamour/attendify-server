/**
 * =============================================================================
 * Attendify API Response Utilities
 * =============================================================================
 *
 * FILE:
 * src/shared/responses/api-response.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module provides the canonical API response helpers for the Attendify
 * backend.
 *
 * It ensures that every successful response and every error response follows a
 * stable JSON structure.
 *
 * SUCCESS RESPONSE SHAPE:
 * -----------------------------------------------------------------------------
 * {
 *   "success": true,
 *   "message": "Human readable message",
 *   "data": {},
 *   "meta": {
 *     "requestId": "req_..."
 *   }
 * }
 *
 * ERROR RESPONSE SHAPE:
 * -----------------------------------------------------------------------------
 * {
 *   "success": false,
 *   "error": {
 *     "code": "ERROR_CODE",
 *     "message": "Safe client-facing message",
 *     "details": null
 *   },
 *   "meta": {
 *     "requestId": "req_..."
 *   }
 * }
 *
 * SECURITY PRINCIPLE:
 * -----------------------------------------------------------------------------
 * Error responses must never expose stack traces, secrets, database internals,
 * token values, cryptographic keys, or implementation details.
 *
 * =============================================================================
 */

const {
  HTTP_STATUS,
  ERROR_CODES
} = require("../errors/error-codes");

/**
 * Safely extracts requestId from an Express request object.
 *
 * @param {object|null} req
 * @returns {string|null}
 */

function getRequestId(req) {
  if (!req || typeof req !== "object") {
    return null;
  }

  if (typeof req.requestId === "string" && req.requestId.length > 0) {
    return req.requestId;
  }

  return null;
}

/**
 * Builds response metadata.
 *
 * @param {object|null} req
 * @param {object} meta
 * @returns {object}
 */

function buildMeta(req = null, meta = {}) {
  return {
    requestId: getRequestId(req),
    ...meta
  };
}

/**
 * Normalizes success response options.
 *
 * Supports:
 *
 * sendSuccess(res, {
 *   message,
 *   data,
 *   req,
 *   meta,
 *   statusCode
 * });
 *
 * Also supports legacy style:
 *
 * sendSuccess(res, data, message, meta);
 *
 * @param {*} optionsOrData
 * @param {string} legacyMessage
 * @param {object} legacyMeta
 * @returns {object}
 */

function normalizeSuccessOptions(
  optionsOrData = {},
  legacyMessage = "OK",
  legacyMeta = {}
) {
  const looksLikeOptionsObject =
    optionsOrData &&
    typeof optionsOrData === "object" &&
    (
      Object.prototype.hasOwnProperty.call(optionsOrData, "message") ||
      Object.prototype.hasOwnProperty.call(optionsOrData, "data") ||
      Object.prototype.hasOwnProperty.call(optionsOrData, "meta") ||
      Object.prototype.hasOwnProperty.call(optionsOrData, "req") ||
      Object.prototype.hasOwnProperty.call(optionsOrData, "statusCode")
    );

  if (looksLikeOptionsObject) {
    return {
      message: optionsOrData.message || "OK",

      data: Object.prototype.hasOwnProperty.call(optionsOrData, "data")
        ? optionsOrData.data
        : null,

      meta: optionsOrData.meta || {},

      req: optionsOrData.req || null,

      statusCode: optionsOrData.statusCode || HTTP_STATUS.OK
    };
  }

  return {
    message: legacyMessage,
    data: optionsOrData,
    meta: legacyMeta,
    req: null,
    statusCode: HTTP_STATUS.OK
  };
}

/**
 * Sends a standardized success response.
 *
 * @param {object} res
 * @param {*} optionsOrData
 * @param {string} legacyMessage
 * @param {object} legacyMeta
 * @returns {object}
 */

function sendSuccess(
  res,
  optionsOrData = {},
  legacyMessage = "OK",
  legacyMeta = {}
) {
  const options =
    normalizeSuccessOptions(
      optionsOrData,
      legacyMessage,
      legacyMeta
    );

  return res.status(options.statusCode).json({
    success: true,
    message: options.message,
    data: options.data,
    meta: buildMeta(options.req, options.meta)
  });
}

/**
 * Sends a standardized HTTP 201 Created response.
 *
 * @param {object} res
 * @param {*} optionsOrData
 * @param {string} legacyMessage
 * @param {object} legacyMeta
 * @returns {object}
 */

function sendCreated(
  res,
  optionsOrData = {},
  legacyMessage = "Created",
  legacyMeta = {}
) {
  const options =
    normalizeSuccessOptions(
      optionsOrData,
      legacyMessage,
      legacyMeta
    );

  return sendSuccess(res, {
    ...options,
    statusCode: HTTP_STATUS.CREATED,
    message: options.message || "Created"
  });
}

/**
 * Returns a client-safe error message.
 *
 * @param {*} error
 * @returns {string}
 */

function getSafeErrorMessage(error) {
  if (
    error &&
    error.expose === true &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Internal Server Error";
}

/**
 * Returns safe error details only when exposure is explicitly allowed.
 *
 * @param {*} error
 * @returns {*}
 */

function getSafeErrorDetails(error) {
  if (error && error.expose === true) {
    return error.details || null;
  }

  return undefined;
}

/**
 * Sends a standardized error response.
 *
 * @param {object} res
 * @param {object} options
 * @returns {object}
 */

function sendError(res, options = {}) {
  const {
    error = null,
    req = null,
    requestId = null,
    meta = {}
  } = options;

  const statusCode =
    error && Number.isInteger(error.statusCode)
      ? error.statusCode
      : HTTP_STATUS.INTERNAL_SERVER_ERROR;

  const code =
    error && typeof error.code === "string"
      ? error.code
      : ERROR_CODES.INTERNAL_ERROR;

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: getSafeErrorMessage(error),
      details: getSafeErrorDetails(error)
    },
    meta: {
      requestId: requestId || getRequestId(req),
      ...meta
    }
  });
}

module.exports = {
  sendSuccess,
  sendCreated,
  sendError,
  getRequestId,
  buildMeta
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */