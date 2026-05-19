/**
 * =============================================================================
 * Attendify — Configuration Validator (Deterministic Runtime Integrity Engine)
 * =============================================================================
 *
 * PURPOSE
 *
 * This module validates and normalizes environment configuration BEFORE system
 * bootstrap, ensuring that the application never starts in an invalid state.
 *
 * =============================================================================
 *
 * 🧠 FORMAL MODEL (CONFIGURATION VALIDATION)
 *
 * Let:
 *
 *   E = raw environment
 *   C = validated configuration
 *
 * Then:
 *
 *   validate(E) = C  OR  THROW
 *
 * =============================================================================
 *
 * 📊 EXECUTION FLOW
 *
 *      Raw Environment
 *            │
 *            ▼
 *     Schema Validation (Zod)
 *            │
 *      ┌─────┴────────┐
 *      ▼              ▼
 *   Invalid         Valid
 *      │              │
 *      ▼              ▼
 *   Throw          Normalize
 *                     │
 *                     ▼
 *               Freeze Output
 *                     │
 *                     ▼
 *                Trusted Config
 *
 * =============================================================================
 *
 * 🔐 CORE GUARANTEES
 *
 *   ✅ No invalid configuration enters runtime
 *   ✅ All values normalized
 *   ✅ Immutable configuration
 *   ✅ Deterministic behavior
 *
 * =============================================================================
 */

const { z } = require("zod");

/* =============================================================================
 * CONSTANTS
 * =============================================================================
 */

const ALLOWED_NODE_ENVS =
  Object.freeze(["development", "production", "test"]);

const MIN_SECRET_LENGTH = 32;
const MAX_JWT_EXPIRATION_DAYS = 30;

/* =============================================================================
 * UTILITIES
 * =============================================================================
 */

function deepFreeze(obj) {
  Object.freeze(obj);

  Object.getOwnPropertyNames(obj).forEach(prop => {
    if (
      obj[prop] !== null &&
      (typeof obj[prop] === "object" || typeof obj[prop] === "function") &&
      !Object.isFrozen(obj[prop])
    ) {
      deepFreeze(obj[prop]);
    }
  });

  return obj;
}

function parseJwtExpirationToDays(value) {

  const match = /^(\d+)([mhd])$/.exec(value);

  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  switch (unit) {
    case "m": return amount / (60 * 24);
    case "h": return amount / 24;
    case "d": return amount;
    default: return null;
  }
}

function isValidMongoUrl(v) {
  return typeof v === "string" &&
    (v.startsWith("mongodb://") || v.startsWith("mongodb+srv://"));
}

function isValidRedisUrl(v) {
  return typeof v === "string" &&
    (v.startsWith("redis://") || v.startsWith("rediss://"));
}

function normalizeCorsOrigins(value) {
  if (!value) return [];
  return value.split(",").map(v => v.trim()).filter(Boolean);
}

function parseBoolean(value, def = true) {

  if (value === undefined || value === null || value === "") {
    return def;
  }

  const v = String(value).toLowerCase().trim();

  if (["true", "1", "yes", "on"].includes(v)) return true;
  if (["false", "0", "no", "off"].includes(v)) return false;

  return def;
}

/* =============================================================================
 * SCHEMA DEFINITION
 * =============================================================================
 */

const configurationSchema = z
  .object({

    NODE_ENV: z.string()
      .default("development")
      .refine(v => ALLOWED_NODE_ENVS.includes(v)),

    PORT: z.string()
      .default("3000")
      .transform(Number)
      .refine(v => Number.isInteger(v) && v > 0 && v <= 65535),

    MONGO_URL: z.string()
      .min(1)
      .refine(isValidMongoUrl),

    JWT_SECRET: z.string()
      .min(MIN_SECRET_LENGTH),

    JWT_EXPIRES: z.string()
      .default("7d")
      .refine(v => parseJwtExpirationToDays(v) !== null),

    EDGE_SECRET: z.string()
      .min(MIN_SECRET_LENGTH),

    APP_SECRET: z.string()
      .min(MIN_SECRET_LENGTH),

    SALT_ROUNDS: z.string()
      .default("10")
      .transform(Number)
      .refine(v => v >= 8 && v <= 15),

    MAX_LOGIN_ATTEMPTS: z.string()
      .default("5")
      .transform(Number)
      .refine(v => v >= 1 && v <= 20),

    LOCK_DURATION: z.string()
      .default("15")
      .transform(Number)
      .refine(v => v >= 1 && v <= 1440),

    REDIS_URL: z.string()
      .optional()
      .refine(v => !v || isValidRedisUrl(v)),

    CORS_ORIGINS: z.string().optional(),

    ENABLE_LOGGING: z.string().optional()

  })
  .superRefine((config, ctx) => {

    const days = parseJwtExpirationToDays(config.JWT_EXPIRES);

    if (days !== null && days > MAX_JWT_EXPIRATION_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_EXPIRES"],
        message: `JWT_EXPIRES exceeds ${MAX_JWT_EXPIRATION_DAYS} days`
      });
    }

    if (config.NODE_ENV === "production" && !config.REDIS_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["REDIS_URL"],
        message: "REDIS_URL is required in production"
      });
    }
  });

/* =============================================================================
 * ERROR FORMATTER
 * =============================================================================
 */

function formatConfigurationErrors(error) {
  return error.issues.map(i => ({
    field: i.path.join(".") || "root",
    message: i.message
  }));
}

/* =============================================================================
 * VALIDATION ENGINE
 * =============================================================================
 */

function validateConfiguration(rawEnv = process.env) {

  const result =
    configurationSchema.safeParse(rawEnv);

  if (!result.success) {

    const errors =
      formatConfigurationErrors(result.error);

    const err = new Error("Invalid configuration");

    err.name = "ConfigurationError";
    err.details = errors;

    throw err;
  }

  const cfg = result.data;

  const normalized = {
    NODE_ENV: cfg.NODE_ENV,
    PORT: cfg.PORT,

    MONGO_URL: cfg.MONGO_URL,

    JWT_SECRET: cfg.JWT_SECRET,
    JWT_EXPIRES: cfg.JWT_EXPIRES,

    EDGE_SECRET: cfg.EDGE_SECRET,
    APP_SECRET: cfg.APP_SECRET,

    SALT_ROUNDS: cfg.SALT_ROUNDS,
    MAX_LOGIN_ATTEMPTS: cfg.MAX_LOGIN_ATTEMPTS,
    LOCK_DURATION: cfg.LOCK_DURATION,

    REDIS_URL: cfg.REDIS_URL || null,
    REDIS_ENABLED: Boolean(cfg.REDIS_URL),

    CORS_ORIGINS: normalizeCorsOrigins(cfg.CORS_ORIGINS),

    ENABLE_LOGGING: parseBoolean(cfg.ENABLE_LOGGING, true),

    IS_PRODUCTION: cfg.NODE_ENV === "production",
    IS_DEVELOPMENT: cfg.NODE_ENV === "development",
    IS_TEST: cfg.NODE_ENV === "test"
  };

  return deepFreeze(normalized);
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  validateConfiguration,

  /**
   * Alias for bootstrap layer
   */
  validateConfig: validateConfiguration,

  configurationSchema,
  formatConfigurationErrors,

  parseJwtExpirationToDays,
  normalizeCorsOrigins,
  parseBoolean,

  ALLOWED_NODE_ENVS,
  MIN_SECRET_LENGTH,
  MAX_JWT_EXPIRATION_DAYS
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */

