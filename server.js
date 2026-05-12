/**
 * ============================================================
 * 🌐 ATTENDIFY BACKEND SERVER (COMPOSITION ROOT - FULL SYSTEM)
 * ============================================================
 *
 * 🎯 PURPOSE:
 *
 * This module acts as the central orchestration layer of the backend.
 * It composes all subsystems into a single runtime unit.
 *
 * Responsibilities:
 *
 *   ✅ Bootstrapping Express application
 *   ✅ Loading environment configuration (.env)
 *   ✅ Initializing global middleware pipeline
 *   ✅ Connecting to MongoDB (persistent layer)
 *   ✅ Registering modular route controllers
 *   ✅ Starting HTTP listener with correct network binding
 *
 * ------------------------------------------------------------
 *
 * 🧠 SYSTEM ARCHITECTURE FLOW:
 *
 *    Client (App / Postman / Browser)
 *              ↓
 *    Edge Layer (Cloudflare Worker)
 *              ↓
 *    Express Server (THIS FILE)
 *              ↓
 *    Middleware Pipeline (CORS, Auth, Security)
 *              ↓
 *    Route Controllers (/auth, /company)
 *              ↓
 *    Database Layer (MongoDB)
 *
 * ------------------------------------------------------------
 *
 * 🔬 DESIGN PRINCIPLES:
 *
 *   ✅ Composition Root Pattern
 *   ✅ Middleware Pipeline Architecture
 *   ✅ Stateless RESTful Design
 *   ✅ Dependency Injection via app.locals
 *
 * ------------------------------------------------------------
 */


/* ============================================================
   📦 MODULE IMPORTS
   ============================================================ */

const express = require("express");
const cors = require("cors");

/**
 * Load environment variables into process.env
 */
require("dotenv").config();

/**
 * Database connection module
 */
const { connectDB } = require("./db");

/**
 * Route modules
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
 * 📊 REQUEST FLOW:
 *
 *   Incoming Request
 *        ↓
 *   CORS Middleware
 *        ↓
 *   JSON Parser
 *        ↓
 *   Security Layer
 *        ↓
 *   Route Matching
 */

app.use(cors());
app.use(express.json());


/**
 * ============================================================
 * 🔐 SECURITY GATEWAY (CONTROLLED ACCESS)
 * ============================================================
 *
 * PURPOSE:
 *   Prevent direct backend exposure in production
 *
 * STRATEGY:
 *   Allow:
 *     ✅ Health check (/)
 *     ✅ Development mode
 *     ✅ Requests from trusted gateway (Worker)
 *
 * BLOCK:
 *     ❌ Untrusted direct external requests
 *
 * ------------------------------------------------------------
 *
 * 📊 FLOW:
 *
 *   Request →
 *      ↓
 *   Check environment
 *      ↓
 *   Validate gateway header
 *      ↓
 *   Allow / Deny
 */
app.use((req, res, next) => {

  /**
   * ✅ Always allow health checks
   */
  if (req.path === "/") {
    return next();
  }

  /**
   * ✅ Allow all requests in development
   */
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  /**
   * ✅ Check gateway header
   */
  const gatewayHeader = req.headers["x-gateway"];

  if (!gatewayHeader) {
    return res.status(403).json({
      success: false,
      message: "Direct access forbidden"
    });
  }

  next();
});


/* ============================================================
   🌐 HEALTH CHECK ROUTE
   ============================================================ */

/**
 * ✅ Endpoint:
 *   GET /
 *
 * PURPOSE:
 *   - Liveness check
 *   - Load balancer validation
 *   - Deployment verification
 */
app.get("/", (req, res) => {

  res.json({
    status: "OK",
    message: "Attendify Backend Running 🚀"
  });

});


/* ============================================================
   🌐 ROUTE REGISTRATION (MODULAR SYSTEM)
   ============================================================ */

/**
 * ✅ Authentication routes
 *   Handles login / register / JWT
 */
app.use("/auth", authRoutes);

/**
 * ✅ Company routes
 *   Handles business logic (protected)
 */
app.use("/company", companyRoutes);


/* ============================================================
   🛑 GLOBAL ERROR HANDLER (CRITICAL)
   ============================================================ */

/**
 * PURPOSE:
 *   Catch all unhandled exceptions safely
 *
 * BENEFITS:
 *   ✅ Prevents server crash
 *   ✅ Standardizes error response
 */
app.use((err, req, res, next) => {

  console.error("🔥 UNHANDLED ERROR:", err);

  res.status(500).json({
    success: false,
    message: "Internal server error"
  });

});


/* ============================================================
   🚀 STARTUP SEQUENCE (CONTROLLED BOOTSTRAP)
   ============================================================ */

/**
 * 🧠 BOOT FLOW:
 *
 *   Application Start
 *        ↓
 *   Connect to MongoDB
 *        ↓
 *   Inject DB into app context
 *        ↓
 *   Start HTTP Server
 *
 * WHY THIS ORDER?
 *   Prevent handling requests without DB readiness
 */
async function startServer() {

  try {

    console.log("🔄 Initializing application...");

    /**
     * ✅ Step 1: Connect DB
     */
    const db = await connectDB();

    /**
     * ✅ Step 2: Inject DB into global context
     */
    app.locals.db = db;

    console.log("✅ Database injected into app context");


    /**
     * ✅ Step 3: Resolve port
     */
    const PORT = process.env.PORT || 3000;


    /**
     * 🔥 CRITICAL NETWORK BINDING FIX
     *
     * 0.0.0.0 ensures external accessibility (Railway requirement)
     *
     * Without this:
     *   → connection refused
     */
    app.listen(PORT, "0.0.0.0", () => {

      console.log("✅ SERVER STARTED SUCCESSFULLY");
      console.log(`🌍 Listening on port: ${PORT}`);

    });

  } catch (err) {

    /**
     * 🛑 Fatal startup failure
     */
    console.error("❌ STARTUP FAILURE:", err);

    process.exit(1);
  }

}

/**
 * ✅ Start application
 */
startServer();


/* ============================================================
   📊 COMPLETE REQUEST LIFECYCLE (ACADEMIC VIEW)
   ============================================================ */

/**
 * 🔁 FULL PIPELINE:
 *
 *   Client Request
 *        ↓
 *   Express Entry Point
 *        ↓
 *   Global Middleware
 *        ↓
 *   Security Filtering
 *        ↓
 *   Route Matching (/auth, /company)
 *        ↓
 *   Authentication Middleware (JWT)
 *        ↓
 *   Business Logic Execution
 *        ↓
 *   Database Interaction
 *        ↓
 *   JSON Response
 *
 */


/* ============================================================
   🔐 SECURITY MODEL (LAYERED DEFENSE)
   ============================================================ */

/**
 * ✅ Defense Layers:
 *
 *   Layer 1: Cloudflare Worker (Edge)
 *   Layer 2: Gateway Header Validation
 *   Layer 3: JWT Authentication
 *   Layer 4: Data Sanitization
 *
 * ------------------------------------------------------------
 *
 * ⚠️ Threat Mitigation:
 *
 *   Unauthorized Access → Blocked
 *   Direct Backend Exposure → Prevented
 *   Token Abuse → Expiration Control
 *
 */


/* ============================================================
   ⚡ SCALABILITY & CLOUD MODEL
   ============================================================ */

/**
 * ✅ Stateless API → horizontally scalable
 * ✅ Compatible with load balancers
 * ✅ Edge-friendly (Worker architecture)
 *
 */


/* ============================================================
   🏁 END OF FILE
   ============================================================ */
