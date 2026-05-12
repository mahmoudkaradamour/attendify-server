/**
 * ============================================================
 * 🌐 ATTENDIFY BACKEND SERVER (ENTRY POINT - PRODUCTION GRADE)
 * ============================================================
 *
 * 🎯 PURPOSE:
 *
 * This file represents the main runtime entry point for the backend system.
 * It wires together all infrastructure components into a unified application.
 *
 * Responsibilities:
 *
 *   ✅ Initialize Express server
 *   ✅ Load environment configuration
 *   ✅ Register middleware (CORS, JSON parsing)
 *   ✅ Connect to MongoDB
 *   ✅ Register modular routes
 *   ✅ Start HTTP listener (network binding)
 *
 * ------------------------------------------------------------
 *
 * 🧠 ARCHITECTURAL FLOW:
 *
 *   Client (Flutter / Postman)
 *        ↓
 *   Cloudflare Worker (Edge Gateway)
 *        ↓
 *   Express Server (THIS FILE)
 *        ↓
 *   Routes (auth / company)
 *        ↓
 *   Middleware (JWT validation)
 *        ↓
 *   MongoDB
 *
 * ------------------------------------------------------------
 *
 * 🔬 DESIGN MODEL:
 *
 *   This file acts as the "Composition Root"
 *   where all dependencies are initialized.
 *
 * ------------------------------------------------------------
 */


/* ============================================================
   📦 MODULE IMPORTS
   ============================================================ */

const express = require("express");
const cors = require("cors");

require("dotenv").config();

/**
 * Database module
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
   🔐 GLOBAL MIDDLEWARE
   ============================================================ */

/**
 * ✅ Enable CORS
 */
app.use(cors());

/**
 * ✅ Parse JSON bodies
 */
app.use(express.json());


/**
 * ============================================================
 * 🔐 SECURITY LAYER (OPTIONAL)
 * ============================================================
 *
 * Allows local access, blocks unsafe direct production access
 */
app.use((req, res, next) => {

  /**
   * Allow health check always
   */
  if (req.path === "/") {
    return next();
  }

  /**
   * Allow in development
   */
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  /**
   * Require Cloudflare Worker header in production
   */
  const forwarded = req.headers["x-gateway"];

  if (!forwarded) {
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
 */
app.get("/", (req, res) => {

  res.json({
    message: "Attendify Backend Running 🚀"
  });

});


/* ============================================================
   🌐 ROUTE REGISTRATION
   ============================================================ */

/**
 * Modular routing
 */
app.use("/auth", authRoutes);
app.use("/company", companyRoutes);


/* ============================================================
   🛑 GLOBAL ERROR HANDLER
   ============================================================ */

/**
 * Catches unhandled errors in request lifecycle
 */
app.use((err, req, res, next) => {
  console.error("🔥 ERROR:", err);

  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
});


/* ============================================================
   🗄️ STARTUP SEQUENCE
   ============================================================ */

/**
 * Ensures:
 *   ✅ DB is connected
 *   ✅ Server starts properly
 */
async function startServer() {

  try {

    /**
     * ✅ Connect to database
     */
    const db = await connectDB();

    /**
     * ✅ Inject DB globally
     */
    app.locals.db = db;


    /**
     * ✅ Resolve port (Railway provides it)
     */
    const PORT = process.env.PORT || 3000;

    /**
     * 🔥 CRITICAL FIX:
     *
     * Server MUST bind to 0.0.0.0
     * otherwise Railway cannot connect → connection refused
     */
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (err) {

    console.error("❌ Startup failed:", err);
    process.exit(1);
  }

}

startServer();


/* ============================================================
   📊 REQUEST FLOW (DETAILED)
   ============================================================ */

/**
 *   Incoming HTTP Request
 *            ↓
 *   Express Server
 *            ↓
 *   Global Middleware
 *            ↓
 *   Security Layer
 *            ↓
 *   Route Matching
 *            ↓
 *   Auth Middleware (JWT)
 *            ↓
 *   Route Handler
 *            ↓
 *   Database Interaction
 *            ↓
 *   JSON Response
 *
 */


/* ============================================================
   🔐 SECURITY MODEL
   ============================================================ */

/**
 * ✅ DEFENSE LAYERS:
 *
 *   Edge Layer → Cloudflare Worker
 *   Transport → HTTPS
 *   App Layer → JWT
 *   Data Layer → MongoDB
 *
 * ------------------------------------------------------------
 *
 * ✅ THREAT MITIGATION:
 *
 *   Unauthorized access → JWT validation
 *   Direct backend exposure → header check
 *   Token abuse → expiration control
 *
 */


/* ============================================================
   ⚡ SCALABILITY MODEL
   ============================================================ */

/**
 * ✅ Stateless design
 * ✅ Horizontal scaling
 * ✅ Edge distribution via Workers
 *
 */


/* ============================================================
   🏁 END OF FILE
   ============================================================ */
