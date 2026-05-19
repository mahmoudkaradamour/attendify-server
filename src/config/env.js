/**
 * =============================================================================
 * Attendify Environment Authority
 * =============================================================================
 *
 * FILE:
 * src/config/env.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module is the canonical runtime configuration authority for the
 * Attendify backend.
 *
 * Runtime configuration is a security-sensitive infrastructure boundary.
 * Environment variables are external inputs, and external inputs must never be
 * trusted until they are explicitly loaded, validated, normalized, and exposed
 * through a stable internal contract.
 *
 * This file performs the following responsibilities:
 *
 *   1. Loads environment variables from the local .env file during development.
 *   2. Delegates validation and normalization to config.validator.js.
 *   3. Exports one immutable trusted configuration object.
 *
 * -----------------------------------------------------------------------------
 * ARCHITECTURAL ROLE
 * -----------------------------------------------------------------------------
 *
 * This module acts as the public configuration entry point for the backend.
 *
 * All other modules must import configuration from this file only:
 *
 *   const config = require("../config/env");
 *
 * Modules must not read process.env directly because direct access bypasses:
 *
 *   - validation
 *   - normalization
 *   - default handling
 *   - type conversion
 *   - production safety rules
 *   - fail-fast startup guarantees
 *
 * -----------------------------------------------------------------------------
 * CONFIGURATION FLOW
 * -----------------------------------------------------------------------------
 *
 *                  Operating System Environment
 *                               │
 *                               │
 *                               ▼
 *                         Local .env File
 *                      loaded by dotenv.config()
 *                               │
 *                               │
 *                               ▼
 *                           process.env
 *                        raw string values
 *                               │
 *                               │
 *                               ▼
 *             validateConfiguration(process.env)
 *                  from config.validator.js
 *                               │
 *                               │
 *                               ▼
 *              Immutable Trusted Config Object
 *                         Object.freeze(...)
 *                               │
 *                               │
 *                               ▼
 *                  Application Runtime Modules
 *
 * -----------------------------------------------------------------------------
 * WHY dotenv IS USED HERE
 * -----------------------------------------------------------------------------
 *
 * In local development, environment variables are commonly stored in a .env file.
 * Node.js does not automatically load .env files.
 *
 * dotenv.config() loads those key-value pairs into process.env before
 * validation occurs.
 *
 * In production environments, platforms such as Railway, Docker, Kubernetes,
 * GitHub Actions, or cloud secret managers commonly inject environment
 * variables directly into the process environment.
 *
 * Calling dotenv.config() remains safe in those environments because dotenv does
 * not override already-defined environment variables unless explicitly
 * configured to do so.
 *
 * -----------------------------------------------------------------------------
 * FAIL-FAST CONFIGURATION MODEL
 * -----------------------------------------------------------------------------
 *
 * Invalid runtime configuration is treated as an infrastructure failure.
 *
 * If validation fails:
 *
 *   - the error is printed during bootstrap
 *   - the process exits with code 1
 *   - the HTTP server does not start
 *
 * This prevents unsafe partial startup states such as:
 *
 *   - server running without MongoDB configuration
 *   - server running with weak JWT secrets
 *   - server running with invalid Redis configuration
 *   - server running with malformed port values
 *   - server running with ambiguous runtime mode
 *
 * -----------------------------------------------------------------------------
 * WHY LOGGER IS NOT IMPORTED HERE
 * -----------------------------------------------------------------------------
 *
 * This file intentionally does not import the application logger.
 *
 * Reason:
 *
 *   logger.js depends on validated configuration
 *   env.js is responsible for producing validated configuration
 *
 * Importing logger here would create a circular dependency:
 *
 *   env.js
 *     └── logger.js
 *           └── env.js
 *
 * Therefore, early configuration failures are reported using console.error.
 * This is acceptable because configuration validation happens before the full
 * observability layer exists.
 *
 * -----------------------------------------------------------------------------
 * SECRET SAFETY RULE
 * -----------------------------------------------------------------------------
 *
 * This module must never print sensitive raw values.
 *
 * Sensitive values include:
 *
 *   - JWT_SECRET
 *   - EDGE_SECRET
 *   - APP_SECRET
 *   - MONGO_URL
 *   - REDIS_URL
 *   - API keys
 *   - Authorization headers
 *
 * If validation fails, only field names and validation messages are printed.
 *
 * -----------------------------------------------------------------------------
 * SECURITY DESIGN PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Configuration must be validated before trusted execution begins."
 *
 * =============================================================================
 */

/* =============================================================================
 * ENVIRONMENT LOADING
 * =============================================================================
 */

/**
 * dotenv:
 * -----------------------------------------------------------------------------
 *
 * Loads variables from .env into process.env.
 *
 * The quiet option suppresses informational dotenv output in dotenv versions
 * that support it.
 *
 * Existing process-level environment variables are not overwritten by default.
 */

require("dotenv").config({
  quiet: true
});

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

/**
 * validateConfiguration:
 * -----------------------------------------------------------------------------
 *
 * Validates raw environment variables and returns a normalized immutable
 * configuration object.
 */

const {
  validateConfiguration
} = require("./config.validator");

/* =============================================================================
 * CONFIGURATION VALIDATION
 * =============================================================================
 */

/**
 * config:
 * -----------------------------------------------------------------------------
 *
 * The trusted runtime configuration object.
 *
 * Once exported, this object becomes the single source of configuration truth
 * for the backend.
 */

let config;

try {

  config =
    validateConfiguration(process.env);

} catch (error) {

  console.error("");
  console.error("❌ Attendify runtime configuration validation failed");
  console.error("");

  if (Array.isArray(error.details)) {

    console.error("Validation errors:");

    for (const issue of error.details) {

      console.error(
        `- ${issue.field}: ${issue.message}`
      );
    }

  } else {

    console.error(
      error && error.message
        ? error.message
        : "Invalid runtime configuration"
    );
  }

  console.error("");
  console.error("The backend will not start with invalid configuration.");
  console.error("");

  process.exit(1);
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

/**
 * Export immutable trusted runtime configuration.
 */

module.exports =
  config;

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */