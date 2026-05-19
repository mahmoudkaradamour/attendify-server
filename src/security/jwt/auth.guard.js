/**
 * =============================================================================
 * Attendify — Auth Guard (Pure Authentication Domain Logic)
 * =============================================================================
 *
 * PURPOSE
 *
 * This module implements the **core authentication verification logic**
 * responsible for transforming a raw token into a trusted user identity.
 *
 * =============================================================================
 *
 * 🧠 FORMAL MODEL (AUTHENTICATION FUNCTION)
 *
 * Let:
 *
 *   T = token
 *   P = payload
 *   U = user identity
 *
 * Then:
 *
 *   verify(T):
 *
 *     decode(T) → validate(P) → normalize(U)
 *
 * =============================================================================
 *
 * 📊 EXECUTION FLOW
 *
 *          Input Token (T)
 *                │
 *                ▼
 *     tokenService.verify(T)
 *                │
 *        ┌───────┴────────┐
 *        ▼                ▼
 *     Invalid           Valid
 *        │                │
 *        ▼                ▼
 *     Throw         Raw Payload (P)
 *                         │
 *                         ▼
 *             normalizeUserPayload(P)
 *                         │
 *                         ▼
 *               Validated User (U)
 *                         │
 *                         ▼
 *                      RETURN
 *
 * =============================================================================
 *
 * 🔐 SECURITY PROPERTIES
 *
 *   ✅ Fail closed (deny by default)
 *   ✅ No sensitive data leakage
 *   ✅ No transport coupling
 *   ✅ Stateless & deterministic
 *
 * =============================================================================
 *
 * ⚠️ CRITICAL CONSTRAINTS
 *
 *   - No Express dependency
 *   - No HTTP logic
 *   - No direct crypto usage here
 *
 * =============================================================================
 */

const tokenService =
  require("./token.service");

const AppError =
  require("../../shared/errors/app-error");

/* =============================================================================
 * TYPE UTILITIES
 * =============================================================================
 */

function ensureArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

/* =============================================================================
 * NORMALIZE USER PAYLOAD
 * =============================================================================
 *
 * Converts arbitrary JWT payload into strict internal identity model.
 */

function normalizeUserPayload(payload) {

  /**
   * STEP 1 — STRUCTURE VALIDATION
   */
  if (!payload || typeof payload !== "object") {
    throw new AppError("Invalid token payload", 401);
  }

  /**
   * STEP 2 — EXTRACT CORE FIELDS
   */
  const id =
    payload.sub ||
    payload.userId ||
    null;

  if (!id || typeof id !== "string") {
    throw new AppError("Invalid token subject", 401);
  }

  /**
   * STEP 3 — NORMALIZE ARRAYS
   */
  const roles =
    ensureArray(payload.roles)
      .filter(Boolean);

  const permissions =
    ensureArray(payload.permissions)
      .filter(Boolean);

  /**
   * STEP 4 — BUILD IMMUTABLE USER MODEL
   */
  const user = {
    id,
    roles,
    permissions
  };

  return Object.freeze(user);
}

/* =============================================================================
 * VERIFY TOKEN (CORE ENTRY POINT)
 * =============================================================================
 */

async function verify(token) {

  /**
   * STEP 0 — INPUT VALIDATION
   */
  if (!token || typeof token !== "string") {
    throw new AppError("Missing token", 401);
  }

  try {

    /**
     * -------------------------------------------------------------------------
     * STEP 1 — VERIFY TOKEN (SIGNATURE + EXPIRATION)
     * -------------------------------------------------------------------------
     */
    const payload =
      await tokenService.verify(token);

    /**
     * -------------------------------------------------------------------------
     * STEP 2 — NORMALIZE USER MODEL
     * -------------------------------------------------------------------------
     */
    const user =
      normalizeUserPayload(payload);

    /**
     * -------------------------------------------------------------------------
     * STEP 3 — RETURN TRUSTED IDENTITY
     * -------------------------------------------------------------------------
     */
    return user;

  } catch (err) {

    /**
     * -------------------------------------------------------------------------
     * STEP 4 — UNIFIED FAILURE RESPONSE
     * -------------------------------------------------------------------------
     *
     * DO NOT leak internal failure details:
     *   - signature failure
     *   - expiration
     *   - invalid structure
     */

    throw new AppError(
      "Authentication failed",
      401
    );
  }
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  verify
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */
