/**
 * =============================================================================
 * Attendify Attendance Service (Enterprise-Grade Domain Layer)
 * =============================================================================
 *
 * FILE:
 * src/services/attendance.service.js
 *
 * -----------------------------------------------------------------------------
 * PURPOSE
 * -----------------------------------------------------------------------------
 * This module encapsulates the complete business logic for attendance operations.
 *
 * It is responsible for:
 *
 *   ✅ Domain rule enforcement
 *   ✅ Data integrity guarantees
 *   ✅ Security fallback protections
 *   ✅ Observability and audit logging
 *
 * -----------------------------------------------------------------------------
 * ARCHITECTURAL ROLE
 * -----------------------------------------------------------------------------
 *
 * Controller  →  Service (THIS)  →  Repository  →  Database
 *
 * This layer:
 *
 *   - DOES NOT trust external inputs blindly
 *   - MUST enforce business invariants
 *   - MUST remain pure (no HTTP concerns)
 *
 * -----------------------------------------------------------------------------
 * DEFENSE-IN-DEPTH MODEL
 * -----------------------------------------------------------------------------
 *
 * Even though protections exist upstream:
 *
 *   - JWT middleware ✅
 *   - Rate limiting ✅
 *   - Replay protection ✅
 *
 * This layer STILL enforces:
 *
 *   → duplication prevention
 *   → domain correctness
 *
 * Reason:
 *   Middleware can fail or be bypassed in edge/internal scenarios.
 *
 * -----------------------------------------------------------------------------
 * DOMAIN INVARIANTS
 * -----------------------------------------------------------------------------
 *
 * BUSINESS RULES:
 *
 *   1. A user can have only ONE attendance entry per time window
 *   2. Timestamp must be valid and normalized
 *   3. Attendance must belong to a valid company scope
 *
 * -----------------------------------------------------------------------------
 * FLOW DIAGRAM
 * -----------------------------------------------------------------------------
 *
 *     Controller Input
 *           │
 *           ▼
 *   Domain Validation
 *           │
 *           ▼
 *   Normalization
 *           │
 *           ▼
 *   Duplication Check
 *           │
 *     ┌─────┴────────┐
 *     ▼              ▼
 *  exists        not exists
 *     │              │
 *     ▼              ▼
 * reject       create record
 *     │              │
 *     ▼              ▼
 *  return        success result
 *
 * -----------------------------------------------------------------------------
 * CONSISTENCY GUARANTEE
 * -----------------------------------------------------------------------------
 *
 * ∀ attendance A:
 *
 *   A is valid ⇔
 *     unique(A, timeWindow) ∧ validInput(A)
 *
 * -----------------------------------------------------------------------------
 * DESIGN PRINCIPLES
 * -----------------------------------------------------------------------------
 *
 *   1. Defense in Depth
 *   2. Deterministic Execution
 *   3. Observability-first
 *   4. Fail-fast for invalid states
 *
 * =============================================================================
 */

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

const attendanceRepository =
  require("../repositories/attendance.repository");

const logger =
  require("../observability/logger");

const requestContext =
  require("../observability/request-context");

const {
  badRequestError,
  conflictError
} = require("../shared/errors/app-error");

/* =============================================================================
 * CONFIGURATION
 * =============================================================================
 */

/**
 * Time window in milliseconds for attendance uniqueness.
 *
 * Example:
 *   24 hours window → no duplicate attendance per day
 *
 * This can be tuned depending on product requirements.
 */
const ATTENDANCE_WINDOW_MS = 24 * 60 * 60 * 1000;

/* =============================================================================
 * HELPER: NORMALIZE TIMESTAMP
 * =============================================================================
 */

/**
 * Ensures timestamp consistency.
 *
 * @param {number} ts
 * @returns {number}
 */
function normalizeTimestamp(ts) {

  if (!Number.isInteger(ts)) {
    throw badRequestError("Invalid timestamp");
  }

  return Math.floor(ts);
}

/* =============================================================================
 * HELPER: COMPUTE TIME WINDOW
 * =============================================================================
 */

/**
 * Maps timestamp to logical window bucket.
 *
 * @param {number} timestamp
 * @returns {number}
 */
function getTimeWindow(timestamp) {

  return Math.floor(timestamp / ATTENDANCE_WINDOW_MS);
}

/* =============================================================================
 * CORE FUNCTION: MARK ATTENDANCE
 * =============================================================================
 */

/**
 * Marks attendance in a safe, deterministic, and idempotent manner.
 *
 * @param {object} params
 * @param {string} params.companyId
 * @param {string} params.userId
 * @param {number} params.timestamp
 *
 * @returns {Promise<object>}
 */
async function markAttendance(params) {

  /* -------------------------------------------------------------------------
   * STEP 1: EXTRACT INPUT
   * ------------------------------------------------------------------------- */
  const {
    companyId,
    userId,
    timestamp
  } = params;

  /* -------------------------------------------------------------------------
   * STEP 2: DOMAIN VALIDATION
   * ------------------------------------------------------------------------- */
  if (!companyId || typeof companyId !== "string") {
    throw badRequestError("Invalid companyId");
  }

  if (!userId || typeof userId !== "string") {
    throw badRequestError("Invalid userId");
  }

  /* -------------------------------------------------------------------------
   * STEP 3: NORMALIZE & DERIVE STATE
   * ------------------------------------------------------------------------- */
  const normalizedTimestamp =
    normalizeTimestamp(timestamp);

  const windowBucket =
    getTimeWindow(normalizedTimestamp);

  const now = Date.now();

  /* -------------------------------------------------------------------------
   * STEP 4: DUPLICATION CHECK (CRITICAL)
   * -------------------------------------------------------------------------
   *
   * Prevent:
   *   - double submissions
   *   - replay bypass edge cases
   *   - race condition duplicates (logical layer)
   */
  const existing =
    await attendanceRepository.findOneByWindow({
      companyId,
      userId,
      window: windowBucket
    });

  if (existing) {

    logger.warn("Duplicate attendance attempt", {
      context: {
        userId,
        companyId,
        window: windowBucket
      }
    });

    throw conflictError("Attendance already recorded for this period");
  }

  /* -------------------------------------------------------------------------
   * STEP 5: BUILD DOMAIN ENTITY
   * ------------------------------------------------------------------------- */
  const entity = {
    companyId,
    userId,
    timestamp: normalizedTimestamp,
    window: windowBucket,
    createdAt: new Date(now)
  };

  /* -------------------------------------------------------------------------
   * STEP 6: PERSIST (REPOSITORY LAYER)
   * ------------------------------------------------------------------------- */
  const created =
    await attendanceRepository.create(entity);

  /* -------------------------------------------------------------------------
   * STEP 7: OBSERVABILITY (LOGGING WITH CONTEXT)
   * -------------------------------------------------------------------------
   */
  logger.info("Attendance recorded", {
    context: {
      requestId: requestContext.get("requestId"),
      userId,
      companyId,
      window: windowBucket,
      recordId: created._id
    }
  });

  /* -------------------------------------------------------------------------
   * STEP 8: RETURN CLEAN DOMAIN RESPONSE
   * ------------------------------------------------------------------------- */
  return {
    id: created._id,
    companyId: created.companyId,
    userId: created.userId,
    timestamp: created.timestamp,
    createdAt: created.createdAt
  };
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  markAttendance
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */