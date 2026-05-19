/**
 * =============================================================================
 * Attendify Audit Logger (Security & Compliance Layer)
 * =============================================================================
 *
 * FILE:
 * src/observability/audit.logger.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module provides a specialized logging mechanism for security-critical
 * and compliance-relevant events.
 *
 * Unlike the general-purpose logger (logger.js), this audit logger is designed
 * for:
 *
 *   - Security monitoring
 *   - Forensic investigation
 *   - Regulatory compliance
 *   - Tamper-evident logging
 *
 * -----------------------------------------------------------------------------
 * DIFFERENCE BETWEEN LOGGER AND AUDIT LOGGER
 * -----------------------------------------------------------------------------
 *
 * logger.js:
 *   - Used for debugging and operational visibility
 *   - High-volume, ephemeral
 *   - Focused on observability
 *
 * audit.logger.js:
 *   - Used for security and traceability
 *   - Low-volume, high-value events
 *   - Must be tamper-resistant
 *   - Must be deterministic and traceable
 *
 * -----------------------------------------------------------------------------
 * WHAT IS AN AUDIT EVENT?
 * -----------------------------------------------------------------------------
 *
 * An audit event represents a critical action that must be traceable:
 *
 *   - Authentication attempts (success/failure)
 *   - Token issuance / revocation
 *   - Company account changes
 *   - Attendance submissions
 *   - Replay attack detection
 *   - Rate limit violations
 *
 * -----------------------------------------------------------------------------
 * AUDIT EVENT FLOW
 * -----------------------------------------------------------------------------
 *
 *           Application Event Occurs
 *                     │
 *                     ▼
 *            audit.logEvent(...)
 *                     │
 *                     ▼
 *          constructAuditEntry(...)
 *                     │
 *                     ▼
 *             hashEvent(previousHash)
 *                     │
 *                     ▼
 *           append cryptographic chain
 *                     │
 *                     ▼
 *              write to output (JSON)
 *
 * -----------------------------------------------------------------------------
 * TAMPER RESISTANCE MODEL
 * -----------------------------------------------------------------------------
 *
 * Each audit entry contains:
 *
 *   - current hash
 *   - previous hash
 *
 * This creates a chain:
 *
 *   H(n) = SHA256( event(n) + H(n-1) )
 *
 * Properties:
 *
 *   - Any modification breaks the chain
 *   - Detectable tampering
 *   - Forward integrity
 *
 * -----------------------------------------------------------------------------
 * STRUCTURE OF AUDIT EVENT
 * -----------------------------------------------------------------------------
 *
 * {
 *   type: "AUTH_LOGIN_SUCCESS",
 *   timestamp: ISO8601,
 *   requestId: "...",
 *   actor: "...",
 *   metadata: { ... },
 *   previousHash: "...",
 *   hash: "..."
 * }
 *
 * -----------------------------------------------------------------------------
 * SECURITY RULES
 * -----------------------------------------------------------------------------
 *
 * Audit logs must:
 *
 *   - NEVER include secrets
 *   - NEVER include passwords
 *   - NEVER include raw tokens
 *   - NEVER include sensitive payloads
 *
 * Audit logs:
 *
 *   - MUST be append-only
 *   - MUST be structured
 *   - MUST be tamper-evident
 *
 * -----------------------------------------------------------------------------
 * DESIGN PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Audit logs must be trustworthy even if the system is compromised."
 *
 * =============================================================================
 */

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

const crypto = require("crypto");

const { getRequestId } = require("./request-context");
const config = require("../config/env");

/* =============================================================================
 * INTERNAL STATE
 * =============================================================================
 */

/**
 * Stores the hash of the last audit entry.
 *
 * NOTE:
 * In production, this should be persisted externally (e.g., Redis, DB, or log store)
 */
let lastHash = null;

/* =============================================================================
 * HELPERS: HASHING
 * =============================================================================
 */

/**
 * Generates SHA-256 hash
 *
 * @param {string} input
 * @returns {string}
 */
function sha256(input) {
  return crypto
    .createHash("sha256")
    .update(input)
    .digest("hex");
}

/* =============================================================================
 * HELPERS: EVENT SANITIZATION
 * =============================================================================
 */

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }

  const sanitized = {};

  for (const key of Object.keys(metadata)) {
    const lower = key.toLowerCase();

    const isSensitive =
      lower.includes("password") ||
      lower.includes("secret") ||
      lower.includes("token") ||
      lower.includes("key");

    sanitized[key] =
      isSensitive
        ? "***redacted***"
        : metadata[key];
  }

  return sanitized;
}

/* =============================================================================
 * CORE: BUILD AUDIT ENTRY
 * =============================================================================
 */

function buildAuditEntry(type, options = {}) {
  const timestamp = new Date().toISOString();

  const requestId =
    options.requestId ||
    getRequestId();

  const actor =
    options.actor || "system";

  const metadata =
    sanitizeMetadata(options.metadata);

  const base = {
    type,
    timestamp,
    requestId,
    actor,
    metadata,
    previousHash: lastHash
  };

  const serialized =
    JSON.stringify(base);

  const hash =
    sha256(serialized + (lastHash || ""));

  const entry = {
    ...base,
    hash
  };

  lastHash = hash;

  return entry;
}

/* =============================================================================
 * OUTPUT
 * =============================================================================
 */

function writeAudit(entry) {
  const output =
    JSON.stringify(entry);

  process.stdout.write(output + "\n");
}

/* =============================================================================
 * PUBLIC API
 * =============================================================================
 */

/**
 * Logs an audit event.
 *
 * @param {string} type
 * @param {object} options
 */
function logEvent(type, options = {}) {
  if (typeof type !== "string" || !type) {
    return;
  }

  const entry =
    buildAuditEntry(type, options);

  writeAudit(entry);
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  logEvent
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */
