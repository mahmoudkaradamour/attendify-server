/**
 * ============================================================
 * 🌐 ATTENDIFY BACKEND SERVER (SECURE COMPOSITION ROOT)
 * ============================================================
 *
 * 🎯 PURPOSE:
 *
 * This module represents the **Composition Root** of the system,
 * where all infrastructure components are initialized and wired together.
 *
 * ------------------------------------------------------------
 *
 * 🧠 ARCHITECTURAL OVERVIEW:
 *
 *   Client (Flutter App / API Tool)
 *                ↓
 *   Cloudflare Worker (Edge Gateway)
 *                ↓
 *   Express Backend (THIS FILE)
 *                ↓
 *   Route Layer (/auth, /company)
 *                ↓
 *   Middleware (JWT, Validation)
 *                ↓
 *   MongoDB (Persistence Layer)
 *
 * ------------------------------------------------------------
 *
 * 🔬 DESIGN PRINCIPLES:
 *
 *   ✅ Separation of Concerns
 *   ✅ Zero-Trust Architecture
 *   ✅ Stateless API Design
 *   ✅ Middleware Pipeline Pattern
 *
 * ------------------------------------------------------------
 *
 * 🔐 SECURITY MODEL:
 *
 *   Layer 1 → Cloudflare Worker (Edge Filtering)
 *   Layer 2 → Secret Header Validation (Gateway Lock)
 *   Layer 3 → JWT Authentication (User Identity)
 *   Layer 4 → Database Access Control
 *
 * ------------------------------------------------------------
 */


/* ============================================================
   📦 MODULE IMPORTS
   ============================================================ */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

/**
 * Load environment variables from .env into process.env
 */
require("dotenv").config();

/**
 * Database connector (MongoDB)
 */
const { connectDB } = require("./db");

/**
 * Modular route handlers
 */
const authRoutes = require("./routes/auth");
const companyRoutes = require("./routes/company");


/* ============================================================
   🧱 APPLICATION INITIALIZATION
   ============================================================ */

const app = express();


/* ============================================================
   🔐 GLOBAL MIDDLEWARE PIPELINE
   ============================================================ */

/**
 * 🧠 Middleware is executed sequentially:
 *
 *   Incoming Request →
 *      ↓
 *   Security Middleware
 *      ↓
 *   JSON Parser
 *      ↓
 *   Route Matching
 *      ↓
 *   Response
 */

/**
 * ✅ Security headers (Helmet)
 *
 * Prevents:
 *   - Clickjacking
 *   - XSS attacks
 *   - MIME sniffing
 */
app.use(helmet());

/**
 * ✅ Disable Server Fingerprinting
 *
 * Removes:
 *   X-Powered-By: Express
 */
app.disable("x-powered-by");

/**
 * ✅ Enable CORS
 */
app.use(cors());

/**
 * ✅ Parse JSON request bodies
 */
app.use(express.json());


/* ============================================================
   🔐 ZERO-TRUST SECURITY GATEWAY
   ============================================================ */

/**
 * 🎯 PURPOSE:
 *   Enforce that ONLY trusted Edge Gateway (Cloudflare Worker)
 *   can communicate with this backend service.
 *
 * 🔬 THEORY:
 *
 * This implements a "Shared Secret Authentication" between:
 *
 *   Worker ↔ Backend
 *
 * The backend **rejects any direct request** that does not
 * contain a valid secret.
 *
 * ------------------------------------------------------------
 *
 * 📊 FLOW:
 *
 *   Request Arrives
 *        ↓
 *   Is it / (health)? → allow
 *        ↓
 *   Is environment production?
 *        ↓
 *   Validate secret header
 *        ↓
 *   Allow / Reject
 *
 */
app.use((req, res, next) => {

  /**
   * ✅ Always allow health endpoint
   */
  if (req.path === "/") {
    return next();
  }

  /**
   * ✅ Allow all traffic in development
   */
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  /**
   * ✅ Extract secret from request header
   */
  const secret = req.headers["x-attendify-secret"];

  /**
   * ✅ Validate against server-side secret
   *
   * If mismatch → reject immediately
   */
  if (secret !== process.env.EDGE_SECRET) {

    return res.status(403).json({
      success: false,
      message: "Access denied (invalid gateway)"
    });
  }

  next();
});


/* ============================================================
   🌐 HEALTH CHECK ENDPOINT
   ============================================================ */

/**
 * ✅ GET /
 *
 * PURPOSE:
 *   - Check server liveness
 *   - Used by load balancers / monitoring tools
 */
app.get("/", (req, res) => {

  res.json({
    status: "OK",
    message: "Attendify Backend Running 🚀"
  });

});


/* ============================================================
   🌐 ROUTE REGISTRATION
   ============================================================ */

/**
 * 📌 Modular structure:
 *
 *   /auth     → authentication logic
 *   /company  → protected business logic
 */
app.use("/auth", authRoutes);
app.use("/company", companyRoutes);


/* ============================================================
   🛑 GLOBAL ERROR HANDLER
   ============================================================ */

/**
 * 🎯 Captures all unhandled exceptions
 *
 * Prevents:
 *   - Server crash
 *   - Information leakage
 */
app.use((err, req, res, next) => {

  console.error("🔥 UNHANDLED ERROR:", err);

  res.status(500).json({
    success: false,
    message: "Internal server error"
  });

});


/* ============================================================
   🚀 STARTUP ORCHESTRATION
   ============================================================ */

/**
 * 🧠 STARTUP FLOW:
 *
 *   Application Boot
 *        ↓
 *   Connect to MongoDB
 *        ↓
 *   Inject database into Express context
 *        ↓
 *   Bind network listener
 *
 * WHY?
 *   Avoid accepting requests before DB readiness
 */

async function startServer() {

  try {

    console.log("🔄 Bootstrapping system...");

    /**
     * ✅ Step 1: Connect to database
     */
    const db = await connectDB();

    /**
     * ✅ Step 2: Inject DB layer globally
     *
     * Accessible via:
     *   req.app.locals.db
     */
    app.locals.db = db;

    console.log("✅ Database connected");

    /**
     * ✅ Step 3: Resolve port
     */
    const PORT = process.env.PORT || 3000;

    /**
     * 🔥 CRITICAL:
     *
     * Must bind to 0.0.0.0 for cloud environments
     *
     * Otherwise:
     *   → External traffic cannot reach server
     */
    app.listen(PORT, "0.0.0.0", () => {

      console.log("✅ Server started successfully");
      console.log(`🌍 Listening on port ${PORT}`);

    });

  } catch (err) {

    console.error("❌ Startup failed:", err);
    process.exit(1);
  }

}

/**
 * ✅ Entry point execution
 */
startServer();


/* ============================================================
   📊 DETAILED REQUEST LIFECYCLE (ACADEMIC)
   ============================================================ */

/**
 * 🔁 COMPLETE FLOW:
 *
 *   Client Request (Flutter / Postman)
 *        ↓
 *   Cloudflare Worker
 *        ↓ (inject secret header)
 *   Express Server
 *        ↓
 *   Security Middleware (validate secret)
 *        ↓
 *   Route Dispatcher (/auth, /company)
 *        ↓
 *   JWT Middleware (if protected route)
 *        ↓
 *   Business Logic Handler
 *        ↓
 *   Database Query (MongoDB)
 *        ↓
 *   JSON Response
 *
 */


/* ============================================================
   ⚡ SCALABILITY MODEL
   ============================================================ */

/**
 * ✅ Stateless API → horizontal scaling ready
 * ✅ Load balancer friendly
 * ✅ Edge-distributed via Cloudflare
 *
 * RESULT:
 *   Highly scalable cloud-native backend
 */


/* ============================================================
   🏁 END OF FILE
   ============================================================ */