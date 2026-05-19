/**
 * =============================================================================
 * Attendify — Route Registrar (Domain Routing Composition Engine)
 * =============================================================================
 *
 * PURPOSE
 *
 * This module defines and mounts all application routes in a centralized,
 * deterministic, and domain-segregated manner.
 *
 * =============================================================================
 *
 * 🧠 FORMAL MODEL (ROUTING COMPOSITION FUNCTION)
 *
 * Let:
 *
 *   A = Express application
 *   D = {auth, company, attendance, nonce, health}
 *
 * Then:
 *
 *   registerRoutes(A):
 *
 *     ∀ d ∈ D:
 *       A.use(basePath(d), router(d))
 *
 * =============================================================================
 *
 * 📊 EXECUTION FLOW
 *
 *        HTTP REQUEST
 *              │
 *              ▼
 *         Express App
 *              │
 *              ▼
 *      Route Matching Layer
 *              │
 *              ▼
 *        Domain Router
 *              │
 *              ▼
 *         Controller
 *
 * =============================================================================
 *
 * 🔐 DESIGN OBJECTIVES
 *
 *   ✅ Centralized route registration
 *   ✅ Domain isolation
 *   ✅ Predictable routing behavior
 *   ✅ Zero orphan routes
 *
 * =============================================================================
 *
 * 🧱 DESIGN PRINCIPLES
 *
 *   - Each domain owns its router
 *   - Each router is mounted exactly once
 *   - No inline route definitions
 *
 * =============================================================================
 */

const assert = require("assert");

/* =============================================================================
 * ROUTE IMPORTS
 * =============================================================================
 */

const authRoutes =
  require("../routes/auth.routes");

const companyRoutes =
  require("../routes/company.routes");

const attendanceRoutes =
  require("../routes/attendance.routes");

const nonceRoutes =
  require("../routes/nonce.routes");

const healthRoutes =
  require("../routes/health.routes");

/* =============================================================================
 * OPTIONAL API PREFIX (VERSIONING READY)
 * =============================================================================
 */

const API_PREFIX =
  process.env.API_PREFIX || ""; // e.g. "/api/v1"

/* =============================================================================
 * SAFETY VALIDATION
 * =============================================================================
 */

function ensureRouter(name, router) {
  assert(
    typeof router === "function" || typeof router === "object",
    `Invalid router for ${name}`
  );
}

/* =============================================================================
 * ROUTE REGISTRATION
 * =============================================================================
 */

function registerRoutes(app) {

  /**
   * ---------------------------------------------------------------------------
   * VALIDATE ALL ROUTERS (FAIL FAST)
   * ---------------------------------------------------------------------------
   */

  ensureRouter("auth", authRoutes);
  ensureRouter("company", companyRoutes);
  ensureRouter("attendance", attendanceRoutes);
  ensureRouter("nonce", nonceRoutes);
  ensureRouter("health", healthRoutes);

  /**
   * ---------------------------------------------------------------------------
   * HEALTH (PLATFORM ENDPOINTS — NO PREFIX)
   * ---------------------------------------------------------------------------
   *
   * MUST be accessible independently for:
   *   - Kubernetes probes
   *   - Load balancers
   */

  app.use("/", healthRoutes);

  /**
   * ---------------------------------------------------------------------------
   * DOMAIN ROUTES (VERSIONABLE)
   * ---------------------------------------------------------------------------
   */

  app.use(`${API_PREFIX}/auth`, authRoutes);

  app.use(`${API_PREFIX}/company`, companyRoutes);

  app.use(`${API_PREFIX}/attendance`, attendanceRoutes);

  app.use(`${API_PREFIX}/nonce`, nonceRoutes);

  /**
   * ---------------------------------------------------------------------------
   * GUARANTEE: NO ORPHAN ROUTES
   * ---------------------------------------------------------------------------
   *
   * All routes must be mounted here.
   */
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = registerRoutes;

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */
