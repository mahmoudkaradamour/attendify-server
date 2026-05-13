/**
 * ============================================================
 * 🌐 ATTENDIFY BACKEND SERVER (COMPOSITION ROOT)
 * ============================================================
 *
 * 🎯 PURPOSE:
 *
 * This module serves as the **composition root** of the backend system.
 * It initializes infrastructure components and orchestrates the entire runtime.
 *
 * ------------------------------------------------------------
 *
 * 🧠 SYSTEM ARCHITECTURE OVERVIEW:
 *
 *   Client (Flutter / API Consumer)
 *        ↓
 *   Cloudflare Worker (Edge Gateway)
 *        ↓
 *   Express Server (THIS MODULE)
 *        ↓
 *   Middleware Pipeline
 *        ↓
 *   Route Controllers (/auth, /company, /nonce, /attendance)
 *        ↓
 *   Security Layer (JWT + Cryptographic Verification)
 *        ↓
 *   MongoDB (Persistence)
 *
 * ------------------------------------------------------------
 *
 * 🔬 DESIGN PRINCIPLES:
 *
 *   ✅ Composition Root Pattern
 *   ✅ Zero-Trust Security Model
 *   ✅ Stateless API Design
 *   ✅ Layered Architecture
 *   ✅ Defense-in-Depth Strategy
 *
 * ------------------------------------------------------------
 *
 * 🔐 SECURITY MODEL (MULTI-LAYER DEFENSE):
 *
 *   Layer 1 → Edge Gateway (Cloudflare Worker)
 *   Layer 2 → Shared Secret Validation (x-attendify-secret)
 *   Layer 3 → JWT Authentication (Identity Layer)
 *   Layer 4 → Cryptographic Verification (HMAC + Nonce)
 *   Layer 5 → Database Integrity Enforcement
 *
 * ------------------------------------------------------------
 */


// ============================================================
// 📦 MODULE IMPORTS
// ============================================================

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

const { connectDB } = require("./db");

/**
 * Core business routes
 */
const authRoutes = require("./routes/auth");
const companyRoutes = require("./routes/company");

/**
 * Security endpoints
 */
const nonceRoutes = require("./src/api/nonce.controller");
const attendanceRoutes = require("./src/api/attendance.controller");


// ============================================================
// 🧱 APPLICATION INITIALIZATION
// ============================================================

const app = express();


// ============================================================
// 🔐 GLOBAL MIDDLEWARE PIPELINE
// ============================================================

/**
 * 📊 REQUEST PROCESSING PIPELINE:
 *
 *   Incoming Request
 *        ↓
 *   Helmet (Security Headers)
 *        ↓
 *   Disable fingerprinting
 *        ↓
 *   CORS policy enforcement
 *        ↓
 *   JSON parsing
 *        ↓
 *   Zero-Trust Validation
 *        ↓
 *   Route Handling
 *        ↓
 *   Response
 */

/**
 * ✅ Security headers
 */
app.use(helmet());

/**
 * ✅ Hide Express signature (security best practice)
 */
app.disable("x-powered-by");

/**
 * ✅ Cross-Origin Resource Sharing
 */
app.use(cors());

/**
 * ✅ JSON body parser
 */
app.use(express.json());


// ============================================================
// 🔐 ZERO-TRUST GATEWAY VALIDATION
// ============================================================

/**
 * 🎯 PURPOSE:
 *
 * Enforce that ONLY trusted Edge Gateway can access backend.
 *
 * ------------------------------------------------------------
 *
 * 🔬 THEORY:
 *
 * Implements shared-secret authentication:
 *
 *   Worker ↔ Backend
 *
 * ------------------------------------------------------------
 *
 * 📊 FLOW:
 *
 *   Request arrives
 *        ↓
 *   Is it health endpoint?
 *        ↓
 *   Is environment production?
 *        ↓
 *   Validate x-attendify-secret
 *        ↓
 *   Allow or reject
 */

app.use((req, res, next) => {

  /**
   * ✅ Health endpoint bypass
   */
  if (req.path === "/") {
    return next();
  }

  /**
   * ✅ Development mode bypass
   */
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  /**
   * ✅ Extract secret header
   */
  const secret = req.headers["x-attendify-secret"];

  /**
   * ✅ Validate secret
   */
  if (secret !== process.env.EDGE_SECRET) {
    return res.status(403).json({
      success: false,
      message: "Access denied (invalid gateway)"
    });
  }

  next();
});


// ============================================================
// 🌐 HEALTH CHECK ENDPOINT
// ============================================================

/**
 * ✅ GET /
 *
 * PURPOSE:
 *   - System liveness probe
 *   - Load balancer health check
 */

app.get("/", (req, res) => {

  res.json({
    status: "OK",
    system: "Attendify Backend",
    uptime: process.uptime()
  });

});


// ============================================================
// 🌐 ROUTE REGISTRATION
// ============================================================

/**
 * 📊 ROUTE MAPPING:
 *
 *   /auth       → Authentication (JWT)
 *   /company    → Tenant management
 *   /nonce      → Nonce issuance
 *   /attendance → Cryptographic verification endpoint
 */

app.use("/auth", authRoutes);
app.use("/company", companyRoutes);
app.use("/nonce", nonceRoutes);
app.use("/attendance", attendanceRoutes);


// ============================================================
// 🛑 GLOBAL ERROR HANDLER
// ============================================================

/**
 * 🎯 PURPOSE:
 *
 * Centralized error handling layer
 *
 * ------------------------------------------------------------
 *
 * SECURITY:
 *
 *   ✅ Prevents stack trace leakage
 *   ✅ Standardized responses
 *   ✅ Protects internal system details
 */

app.use((err, req, res, next) => {

  console.error("🔥 UNHANDLED ERROR:", err);

  res.status(500).json({
    success: false,
    message: "Internal server error"
  });

});


// ============================================================
// 🚀 SERVER STARTUP SEQUENCE
// ============================================================

/**
 * 📊 INITIALIZATION FLOW:
 *
 *   Process boot
 *        ↓
 *   Connect to database
 *        ↓
 *   Inject DB into app context
 *        ↓
 *   Start HTTP server
 *
 * ------------------------------------------------------------
 *
 * WHY:
 *
 * Avoid serving requests before DB readiness
 */

async function startServer() {

  try {

    console.log("🔄 Initializing Attendify backend...");

    /**
     * ✅ Step 1: Connect MongoDB
     */
    const db = await connectDB();

    /**
     * ✅ Step 2: Inject DB globally
     */
    app.locals.db = db;

    console.log("✅ Database connected");

    /**
     * ✅ Step 3: Define port
     */
    const PORT = process.env.PORT || 3000;

    /**
     * ✅ Bind to all interfaces (cloud requirement)
     */
    app.listen(PORT, "0.0.0.0", () => {

      console.log("✅ Server operational");
      console.log(`🌍 Listening on port ${PORT}`);

    });

  } catch (err) {

    console.error("❌ Startup failed:", err);

    /**
     * Fail fast (critical failure)
     */
    process.exit(1);
  }
}


/**
 * 🟢 ENTRY POINT
 */
startServer();


// ============================================================
// 📊 FULL SYSTEM FLOW (ACADEMIC MODEL)
// ============================================================

/**
 * 🔁 END-TO-END PIPELINE:
 *
 *   Client Request
 *        ↓
 *   Cloudflare Worker
 *        ↓ (inject secret)
 *   Backend Server
 *        ↓
 *   Zero-Trust Middleware
 *        ↓
 *   Route Handler
 *
 *   === AUTH ===
 *   JWT issuance / validation
 *
 *   === NONCE ===
 *   Generate time-bound nonce
 *
 *   === ATTENDANCE ===
 *     → Canonicalize payload
 *     → Verify signature
 *     → Check nonce validity
 *     → Detect replay attacks
 *
 *        ↓
 *   Decision (ACCEPT / REJECT)
 *        ↓
 *   JSON Response
 */


// ============================================================
// 🔐 SECURITY GUARANTEES
// ============================================================

/**
 * ✅ Strict access control (Edge-only access)
 * ✅ Replay attack prevention
 * ✅ Payload integrity enforcement
 * ✅ Cryptographic verification
 * ✅ Identity assurance (JWT)
 */


// ============================================================
// ⚡ SCALABILITY MODEL
// ============================================================

/**
 * ✅ Stateless backend
 * ✅ Horizontal scalability
 * ✅ Load-balancer friendly
 * ✅ Edge-distributed architecture
 *
 * ------------------------------------------------------------
 *
 * FUTURE EXTENSIONS:
 *
 *   → Redis (distributed nonce store)
 *   → Rate limiting
 *   → Observability (metrics/logging)
 */


// ============================================================
// 🏁 END OF FILE
// ============================================================
