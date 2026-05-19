/**
 * =============================================================================
 * Attendify — Request ID Middleware (Correlation Identity Layer)
 * =============================================================================
 *
 * PURPOSE
 *
 * This middleware establishes a **globally unique and request-scoped identity**
 * used across the entire system lifecycle.
 *
 * It ensures the existence and propagation of a stable identifier:
 *
 *   ✅ requestId  → primary identity
 *   ✅ correlationId → cross-system correlation
 *
 * =============================================================================
 *
 * 🧠 FORMAL MODEL (IDENTITY FUNCTION)
 *
 * Let:
 *
 *   R = incoming request
 *   H = request headers
 *   ID = unique identifier
 *
 * Then:
 *
 *   ID = f(R) =
 *
 *     if valid(H[x-request-id]) → use it
 *     else → generate(UUIDv4)
 *
 * =============================================================================
 *
 * 📊 FLOW DIAGRAM (IDENTITY RESOLUTION PIPELINE)
 *
 *         HTTP REQUEST
 *              │
 *              ▼
 *     Extract x-request-id
 *              │
 *         ┌────┴────────┐
 *         ▼             ▼
 *   Valid ID       Invalid / Missing
 *         │             │
 *         ▼             ▼
 *       Use ID     Generate UUID
 *         │             │
 *         └──────┬──────┘
 *                ▼
 *      Normalize + sanitize
 *                │
 *                ▼
 *      Attach → req.id
 *                │
 *                ▼
 *      Propagate → response headers
 *                │
 *                ▼
 *            Continue
 *
 * =============================================================================
 *
 * 🔐 DESIGN OBJECTIVES
 *
 *   ✅ Strong uniqueness (UUIDv4)
 *   ✅ Trust-but-verify external input
 *   ✅ Safe propagation across system boundaries
 *   ✅ Zero side-effects outside request scope
 *
 * =============================================================================
 *
 * ⚠️ SECURITY CONSIDERATIONS
 *
 *   - Never trust incoming header blindly
 *   - Prevent header injection
 *   - Enforce max length and format constraints
 *
 * =============================================================================
 *
 * 🧱 DESIGN PRINCIPLES
 *
 *   - Idempotent identity assignment
 *   - Stateless middleware
 *   - Deterministic output
 *
 * =============================================================================
 */

const crypto = require("crypto");

/* =============================================================================
 * CONFIGURATION
 * =============================================================================
 */

const MAX_ID_LENGTH = 128;

/**
 * Allowed characters (defensive filtering)
 * Prevents header injection / malformed values
 */
const SAFE_ID_REGEX = /^[a-zA-Z0-9\-_.:]+$/;

/* =============================================================================
 * VALIDATION & NORMALIZATION
 * =============================================================================
 */

function normalizeRequestId(id) {

  if (!id || typeof id !== "string") {
    return null;
  }

  const trimmed = id.trim();

  if (trimmed.length === 0 || trimmed.length > MAX_ID_LENGTH) {
    return null;
  }

  if (!SAFE_ID_REGEX.test(trimmed)) {
    return null;
  }

  return trimmed;
}

/* =============================================================================
 * GENERATION
 * =============================================================================
 */

function generateRequestId() {
  return crypto.randomUUID();
}

/* =============================================================================
 * MIDDLEWARE IMPLEMENTATION
 * =============================================================================
 */

function requestIdMiddleware(req, res, next) {

  /**
   * ---------------------------------------------------------------------------
   * STEP 1 — EXTRACT INPUTS
   * ---------------------------------------------------------------------------
   *
   * Priority order:
   *   1. Existing req.id (in case of upstream usage)
   *   2. Header x-request-id
   */

  const headerId = req.headers["x-request-id"];

  let requestId =
    normalizeRequestId(req.id) ||
    normalizeRequestId(headerId);

  /**
   * ---------------------------------------------------------------------------
   * STEP 2 — GENERATE IF NECESSARY
   * ---------------------------------------------------------------------------
   */

  if (!requestId) {
    requestId = generateRequestId();
  }

  /**
   * ---------------------------------------------------------------------------
   * STEP 3 — ATTACH TO REQUEST
   * ---------------------------------------------------------------------------
   */

  req.id = requestId;

  /**
   * ---------------------------------------------------------------------------
   * STEP 4 — PROPAGATION
   * ---------------------------------------------------------------------------
   *
   * Expose identifiers to downstream systems & clients
   */

  res.setHeader("x-request-id", requestId);

  /**
   * Correlation ID:
   * Used by logging systems (can match traceId later)
   */
  res.setHeader("x-correlation-id", requestId);

  /**
   * ---------------------------------------------------------------------------
   * STEP 5 — CONTINUE EXECUTION
   * ---------------------------------------------------------------------------
   */

  next();
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = requestIdMiddleware;

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */
