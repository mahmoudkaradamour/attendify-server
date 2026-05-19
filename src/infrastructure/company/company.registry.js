/**
 * =============================================================================
 * Attendify — Company Registry (Enterprise-Grade Configuration Authority)
 * =============================================================================
 *
 * FILE:
 *   src/infrastructure/company/company.registry.js
 *
 * =============================================================================
 * 🎯 PURPOSE (FORMAL DEFINITION)
 * =============================================================================
 *
 * This module implements a **deterministic configuration authority layer**
 * responsible for managing and resolving company integration definitions.
 *
 * -----------------------------------------------------------------------------
 * MATHEMATICAL MODEL
 * -----------------------------------------------------------------------------
 *
 * Let:
 *
 *   C = {c1, c2, c3, ..., cn}   → set of companies
 *   ID(ci)                      → unique identifier
 *   CFG(ci)                     → configuration object
 *
 * Then:
 *
 *   REGISTRY: ID → CFG
 *
 * Properties:
 *   - Total mapping over valid IDs
 *   - Deterministic retrieval
 *   - Immutable configuration integrity
 *
 * -----------------------------------------------------------------------------
 * ⚠️ ARCHITECTURAL CONSTRAINTS
 * -----------------------------------------------------------------------------
 *
 * This module MUST:
 *
 *   ✅ Provide O(1) configuration lookup
 *   ✅ Enforce strict validation at insertion time
 *   ✅ Prevent runtime mutation of configuration
 *
 * This module MUST NOT:
 *
 *   ❌ Perform network calls
 *   ❌ Contain business logic
 *   ❌ Hold request-scoped state
 *
 * -----------------------------------------------------------------------------
 * 📊 SYSTEM POSITION
 * -----------------------------------------------------------------------------
 *
 *              ┌────────────────────────────┐
 *              │  Evidence Route Layer      │
 *              └────────────┬───────────────┘
 *                           │
 *                           ▼
 *              ┌────────────────────────────┐
 *              │  Company Registry Layer    │
 *              │  (THIS MODULE)             │
 *              └────────────┬───────────────┘
 *                           │
 *                           ▼
 *              ┌────────────────────────────┐
 *              │  Company Client Layer      │
 *              └────────────────────────────┘
 *
 * -----------------------------------------------------------------------------
 * 🔐 SECURITY MODEL
 * -----------------------------------------------------------------------------
 *
 * Defense Strategies:
 *
 *   1. Strict schema validation
 *   2. Immutable objects (Object.freeze)
 *   3. No implicit fallback behavior
 *   4. Explicit error signaling
 *
 * -----------------------------------------------------------------------------
 * 📊 FLOW DIAGRAM — REGISTRATION
 * -----------------------------------------------------------------------------
 *
 *     INPUT CONFIG
 *          │
 *          ▼
 *   [ VALIDATION PHASE ]
 *          │
 *          ▼
 *   [ NORMALIZATION PHASE ]
 *          │
 *          ▼
 *   [ IMMUTABILITY ENFORCEMENT ]
 *          │
 *          ▼
 *   [ STORE IN MAP ]
 *
 * -----------------------------------------------------------------------------
 * 📊 FLOW DIAGRAM — LOOKUP
 * -----------------------------------------------------------------------------
 *
 *    companyId
 *        │
 *        ▼
 *   registry.get(companyId)
 *        │
 *   ┌────┴────┐
 *   ▼         ▼
 * FOUND    NOT FOUND
 *   │         │
 *   ▼         ▼
 * config    throw Error
 *
 * =============================================================================
 */

/* =============================================================================
 * INTERNAL REGISTRY STORE
 * =============================================================================
 *
 * Implementation:
 *
 *   Map<Key=string, Value=Object>
 *
 * Characteristics:
 *   - O(1) lookup
 *   - insertion order preserved (optional usage)
 *   - deterministic behavior
 */

const REGISTRY = new Map();

/* =============================================================================
 * CONFIGURATION VALIDATOR
 * =============================================================================
 *
 * Enforces strong structural correctness BEFORE insertion.
 *
 * Fail-fast behavior: throws immediately on any inconsistency.
 */

function validateCompanyConfig(config) {

  if (!config || typeof config !== "object") {
    throw new Error("Configuration must be a valid object");
  }

  if (!config.id || typeof config.id !== "string" || !config.id.trim()) {
    throw new Error("Company 'id' must be a non-empty string");
  }

  if (!config.apiBase || typeof config.apiBase !== "string") {
    throw new Error("Company 'apiBase' must be a valid URL string");
  }

  if (!config.authType || typeof config.authType !== "string") {
    throw new Error("Company 'authType' is required");
  }

  if (!config.endpoints || typeof config.endpoints !== "object") {
    throw new Error("Company 'endpoints' must be an object");
  }

  if (!config.endpoints.submitEvidence) {
    throw new Error("Missing endpoint: submitEvidence");
  }

  if (config.timeout !== undefined) {
    if (
      typeof config.timeout !== "number" ||
      config.timeout <= 0 ||
      config.timeout > 60000
    ) {
      throw new Error("Timeout must be between 1 and 60000 ms");
    }
  }

  if (config.authType === "custom" && !config.authHeader) {
    throw new Error("Custom auth requires 'authHeader'");
  }

  return true;
}

/* =============================================================================
 * NORMALIZATION FUNCTION
 * =============================================================================
 *
 * Ensures consistent shape across configurations.
 *
 * Properties:
 *   - trimmed strings
 *   - default values applied
 *   - defensive copying
 */

function normalizeCompanyConfig(config) {

  return Object.freeze({

    id: config.id.trim(),

    apiBase: config.apiBase.trim().replace(/\/$/, ""),

    authType: config.authType,

    authHeader: config.authHeader || null,

    endpoints: Object.freeze({
      submitEvidence: config.endpoints.submitEvidence.trim()
    }),

    timeout: config.timeout || 5000

  });
}

/* =============================================================================
 * REGISTER COMPANY
 * =============================================================================
 *
 * Inserts or updates a company configuration.
 *
 * Characteristics:
 *   - deterministic overwrite
 *   - idempotent behavior for same input
 *   - strict validation before insertion
 */

function registerCompany(config) {

  validateCompanyConfig(config);

  const normalized = normalizeCompanyConfig(config);

  REGISTRY.set(normalized.id, normalized);

  return normalized;
}

/* =============================================================================
 * RETRIEVE COMPANY CONFIGURATION
 * =============================================================================
 *
 * Guarantees:
 *   ✅ Always returns a fully validated config
 *   ✅ Never returns partial data
 *   ✅ Throws on unknown company
 */

function getCompanyConfig(companyId) {

  if (!companyId || typeof companyId !== "string") {
    throw new Error("Invalid companyId type");
  }

  const id = companyId.trim();

  const config = REGISTRY.get(id);

  if (!config) {
    throw new Error(`Company configuration not found: ${id}`);
  }

  return config;
}

/* =============================================================================
 * BULK LOAD
 * =============================================================================
 *
 * Typically used during system bootstrap.
 */

function loadCompanies(configArray = []) {

  if (!Array.isArray(configArray)) {
    throw new Error("Expected array for loadCompanies");
  }

  for (const config of configArray) {
    registerCompany(config);
  }
}

/* =============================================================================
 * LIST REGISTERED COMPANIES
 * =============================================================================
 */

function listCompanies() {
  return Array.from(REGISTRY.keys());
}

/* =============================================================================
 * CLEAR REGISTRY (Testing / Reset)
 * =============================================================================
 */

function clearRegistry() {
  REGISTRY.clear();
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  registerCompany,
  getCompanyConfig,
  loadCompanies,
  listCompanies,
  clearRegistry
};

/**
 * =============================================================================
 * 🏁 END OF FILE
 * =============================================================================
 *
 * =============================================================================
 * 🧠 ACADEMIC AND ENGINEERING NOTES
 * =============================================================================
 *
 * This module is an implementation of:
 *
 *   - Configuration Registry Pattern
 *   - Immutable Object Pattern
 *   - Deterministic Lookup System
 *
 * -----------------------------------------------------------------------------
 * FORMAL PROPERTIES
 * -----------------------------------------------------------------------------
 *
 * Let:
 *   R = REGISTRY
 *
 * Then:
 *
 *   ∀ id ∈ R → R(id) returns the same object reference (immutability)
 *   Lookup complexity: O(1)
 *
 * -----------------------------------------------------------------------------
 * DESIGN AXIOMS
 * -----------------------------------------------------------------------------
 *
 * 1. CONFIGURATION ≠ STATE
 * 2. LOOKUP ≠ EVALUATION
 * 3. REGISTRY ≠ DATABASE
 *
 * -----------------------------------------------------------------------------
 * SECURITY INSIGHTS
 * -----------------------------------------------------------------------------
 *
 * Attack Surface Reduced By:
 *
 *   - Rejecting malformed configs
 *   - Freezing objects (immutability)
 *   - Explicit error handling
 *
 * -----------------------------------------------------------------------------
 * EXTENSIBILITY MODEL
 * -----------------------------------------------------------------------------
 *
 * Future directions:
 *
 *   - Replace in-memory storage with distributed config service
 *   - Add caching layer (Redis)
 *   - Introduce versioned configs
 *   - Support multi-region replication
 *
 * WITHOUT changing:
 *   → Public interface (API stability)
 *
 * -----------------------------------------------------------------------------
 * SYSTEM IMPACT
 * -----------------------------------------------------------------------------
 *
 * This module directly influences:
 *
 *   ✅ Routing correctness
 *   ✅ Security boundaries
 *   ✅ Integration stability
 *
 * Any flaw here propagates system-wide.
 *
 * =============================================================================
 */