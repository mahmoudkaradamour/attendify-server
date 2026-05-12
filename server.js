/**
 * ============================================================
 * 🌐 ATTENDIFY BACKEND SERVER (ENTRY POINT - PRODUCTION GRADE)
 * ============================================================
 *
 * 🎯 PURPOSE:
 *
 * This file represents the **composition root** of the backend system.
 * It integrates all infrastructure components into a cohesive runtime.
 *
 * Responsibilities:
 *
 *   ✅ Initialize HTTP server (Express)
 *   ✅ Load environment configuration
 *   ✅ Register global middleware
 *   ✅ Connect to MongoDB
 *   ✅ Register route modules
 *   ✅ Start application lifecycle
 *
 * ------------------------------------------------------------
 *
 * 🧠 ARCHITECTURAL MODEL:
 *
 *        Client (Flutter / API Tool)
 *                   ↓
 *        Cloudflare Worker (Edge Gateway)
 *                   ↓
 *        Express Server (THIS FILE)
 *                   ↓
 *        Route Layer (auth / company)
 *                   ↓
 *        Middleware Layer (JWT, security)
 *                   ↓
 *        Database (MongoDB Atlas)
 *
 * ------------------------------------------------------------
 *
 * 🔬 DESIGN PRINCIPLES:
 *
 *   ✅ Separation of Concerns
 *   ✅ Dependency Injection (via app.locals)
 *   ✅ Stateless API Architecture
 *   ✅ Middleware Pipeline Model
 *
 * ------------------------------------------------------------
 */


/* ============================================================
   📦 MODULE IMPORTS
   ============================================================ */

const express = require("express");
const cors = require("cors");

/**
 * Load environment variables (.env → process.env)
 */
require("dotenv").config();

/**
 * Database connection module
 */
const { connectDB } = require("./db");

/**
 * Route modules (modular architecture)
 */
const authRoutes = require("./routes/auth");
const companyRoutes = require("./routes/company");


/* ============================================================
   🧱 APPLICATION INITIALIZATION
   ============================================================ */

const app = express();


/* ============================================================
   🔐 GLOBAL MIDDLEWARE LAYER
   ============================================================ */

/**
 * 🧠 Middleware acts as a pipeline:
 *
 * Request → Middleware → Routing → Response
 */

/**
 * ✅ CORS ENABLEMENT
 *
 * Allows cross-origin requests from frontend applications
 */
app.use(cors());

/**
 * ✅ JSON BODY PARSER
 *
 * Automatically parses JSON request payload into req.body
 */
app.use(express.json());


/**
 * ============================================================
 * 🔐 SECURITY GATEWAY (OPTIONAL HARDENING)
 * ============================================================
 *
 * Blocks direct access (forces traffic through Worker)
 *
 * Trust Model:
 *   Only requests coming from Worker are trusted
 *
 */
app.use((req, res, next) => {

  if (process.env.NODE_ENV === "production") {

    /**
     * Check for Worker forwarding header
     */
    const forwarded = req.headers["x-gateway"];

    if (!forwarded) {
      return res.status(403).json({
        success: false,
        message: "Direct access forbidden"
      });
    }
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
 *   System monitoring & liveness check
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
 * Modular routing system:
 *
 *   /auth     → authentication logic
 *   /company  → business logic
 */
app.use("/auth", authRoutes);
app.use("/company", companyRoutes);


/* ============================================================
   🗄️ DATABASE INITIALIZATION
   ============================================================ */

/**
 * 🧠 Startup sequence:
 *
 *   1. Connect to database
 *   2. Inject DB into app context
 *   3. Start server
 *
 * This prevents race conditions
 */

let db;

async function startServer() {

  try {

    /**
     * ✅ Step 1: Connect to MongoDB
     */
    db = await connectDB();

    /**
     * ✅ Step 2: Inject DB into global app context
     *
     * Accessible from:
     *   req.app.locals.db
     */
    app.locals.db = db;


    /**
     * ✅ Step 3: Start HTTP server
     */
    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });


  } catch (err) {

    /**
     * 🛑 Critical failure handling
     */
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }

}

startServer();


/* ============================================================
   📊 REQUEST LIFECYCLE DIAGRAM (DETAILED)
   ============================================================ */

/**
 * 🔁 FULL REQUEST FLOW:
 *
 *   Client (Flutter / Postman)
 *        ↓
 *   Cloudflare Worker
 *        ↓
 *   Express Server
 *        ↓
 *   Global Middleware
 *        ↓
 *   Security Check
 *        ↓
 *   Route Matching (/auth, /company)
 *        ↓
 *   Auth Middleware (JWT)
 *        ↓
 *   Route Handler
 *        ↓
 *   Database Query
 *        ↓
 *   JSON Response
 *
 */


/* ============================================================
   🔐 SECURITY ANALYSIS (ENTERPRISE LEVEL)
   ============================================================ */

/**
 * ✅ DEFENSE LAYERS:
 *
 *   Layer 1: Cloudflare Worker (Edge protection)
 *   Layer 2: Header validation (x-gateway)
 *   Layer 3: JWT authentication
 *   Layer 4: DB access control
 *
 * ------------------------------------------------------------
 *
 * ⚠️ THREATS MITIGATED:
 *
 *   - Direct backend access → blocked
 *   - Unauthorized requests → JWT validation
 *   - Replay tokens → expiration control
 *
 * ------------------------------------------------------------
 *
 * ✅ BEST PRACTICES:
 *
 *   - Never expose raw DB to internet
 *   - Always use API gateway
 *   - Keep server stateless
 *
 */


/* ============================================================
   ⚡ SCALABILITY MODEL
   ============================================================ */

/**
 * This architecture supports:
 *
 *   ✅ Horizontal scaling (multiple instances)
 *   ✅ CDN + Edge routing (Worker)
 *   ✅ Stateless load balancing
 *
 */


/* ============================================================
   🏁 END OF FILE
   ============================================================ */