/**
 * =========================================================ify Backend Server (Production-Grade Entry Point) * ============================================================
 * ============================================================
 *
 * 🎯 PURPOSE:
 * This file represents the core entry point of a distributed SaaS backend system.
 * It is responsible for:
 *
 *   - Initializing the HTTP server (Express)
 *   - Establishing database connection (MongoDB Atlas)
 *   - Registering middleware (CORS, JSON parsing)
 *   - Defining API endpoints
 *   - Acting as the integration layer between client and persistence layer
 *
 * ------------------------------------------------------------
 *
 * 🧠 ARCHITECTURAL CONTEXT:
 *
 *     Client (Flutter / API Tool)
 *                ↓
 *       (HTTP Request Layer)
 *                ↓
 *         Express Server  ← This File
 *                ↓
 *          MongoDB Atlas
 *
 * ------------------------------------------------------------
 *
 * 🔬 DESIGN PHILOSOPHY:
 *
 * This server adheres to:
 *   ✅ Stateless API Design
 *   ✅ Separation of Concerns
 *   ✅ RESTful Principles
 *   ✅ Cloud-Native Compatibility
 *
 * ------------------------------------------------------------
 */


/* ============================================================
   📦 MODULE IMPORTS
   ============================================================ */

/**
 * express:
 * Lightweight web framework for building HTTP APIs
 */
const express = require("express");

/**
 * cors:
 * Enables Cross-Origin Resource Sharing
 * Required for frontend (Flutter/Web) communication
 */
const cors = require("cors");

/**
 * dotenv:
 * Loads environment variables securely from .env file
 */
require("dotenv").config();

/**
 * connectDB:
 * Custom module responsible for establishing connection to MongoDB
 */
const { connectDB } = require("./db");

/**
 * Node.js built-in crypto module
 * Used to generate secure unique identifiers (UUID)
 */
const crypto = require("crypto");


/* ============================================================
   🧱 APPLICATION INITIALIZATION
   ============================================================ */

const app = express();

/**
 * 🧠 Middleware Layer
 *
 * Middleware executes BEFORE reaching route handlers.
 *
 * Request Flow:
 *   Client → Middleware → Route → Response
 */

/**
 * Enable CORS:
 * Allows external clients (Flutter / Browser) to call the API
 */
app.use(cors());

/**
 * Enable JSON parsing:
 * Automatically parses incoming JSON request bodies
 */
app.use(express.json());


/* ============================================================
   🗄️ DATABASE CONNECTION LAYER
   ============================================================ */

/**
 * Database instance placeholder
 *
 * 🧠 Why external variable?
 * Because connection is asynchronous,
 * and routes need to access it globally
 */
let db;

/**
 * ✅ Establish database connection BEFORE starting server
 *
 * Flow:
 *   Startup → Connect to MongoDB → Start listening
 */
connectDB()
  .then(database => {

    db = database;

    /**
     * ✅ Start HTTP server ONLY after DB is ready
     *
     * This prevents race conditions where requests arrive
     * before DB connection is established
     */
    app.listen(3000, () => {
      console.log("🚀 Server running on port 3000");
    });

  })
  .catch(err => {
    console.error("❌ Database connection failed:", err);
    process.exit(1);
  });


/* ============================================================
   🌐 ROUTES (API ENDPOINTS)
   ============================================================ */


/**
 * ------------------------------------------------------------
 * ✅ HEALTH CHECK ENDPOINT
 * ------------------------------------------------------------
 *
 * PURPOSE:
 * Ensures that server is alive and responsive
 *
 * FLOW:
 *   Client → GET "/" → Server → JSON Response
 *
 * USE CASES:
 *   - Monitoring
 *   - Dev testing
 *   - Load balancer checks
 */
app.get("/", (req, res) => {
  res.json({
    message: "Attendify Backend Running 🚀"
  });
});


/**
 * ------------------------------------------------------------
 * ✅ REGISTER COMPANY ENDPOINT
 * ------------------------------------------------------------
 *
 * METHOD: POST
 * ENDPOINT: /register-company
 *
 * PURPOSE:
 * Registers a new company in the platform
 *
 * SCIENTIFIC/ARCHITECTURAL ROLE:
 * Serves as an ENTRY POINT to the multi-tenant system
 *
 * ------------------------------------------------------------
 *
 * 📊 DATA FLOW DIAGRAM:
 *
 *   Client (POST Request)
 *           ↓
 *   Express Route Handler
 *           ↓
 *   Input Validation
 *           ↓
 *   MongoDB Query (Check existence)
 *           ↓
 *   Data Creation (UUID + API Key)
 *           ↓
 *   Insert into Database
 *           ↓
 *   Response to Client
 *
 * ------------------------------------------------------------
 */
app.post("/register-company", async (req, res) => {

  try {

    /**
     * ✅ Step 1: Extract request data
     */
    const { name, email } = req.body;


    /**
     * ✅ Step 2: Input validation
     *
     * Ensures system integrity and prevents invalid records
     */
    if (!name || !email) {
      return res.status(400).json({
        message: "Missing required fields"
      });
    }


    /**
     * ✅ Step 3: Check for existing company
     *
     * Prevents duplication
     * Enforces uniqueness constraint
     */
    const existing = await db.collection("companies").findOne({ name });

    if (existing) {
      return res.status(409).json({
        message: "Company already exists"
      });
    }


    /**
     * ✅ Step 4: Generate secure identifiers
     *
     * id:
     *   - Global unique identifier for system
     *
     * apiKey:
     *   - Used later for integration/authentication
     */
    const company = {
      id: crypto.randomUUID(),
      name,
      email,
      apiKey: crypto.randomUUID(),
      createdAt: new Date()
    };


    /**
     * ✅ Step 5: Insert into MongoDB
     *
     * MongoDB characteristics:
     *   - NoSQL
     *   - schema-less
     */
    await db.collection("companies").insertOne(company);


    /**
     * ✅ Step 6: Respond to client
     *
     * Returns the created entity
     */
    res.json({
      success: true,
      company
    });

  } catch (err) {

    /**
     * ✅ Global error handling (local scope)
     *
     * Prevents server crash
     */
    res.status(500).json({
      message: err.message
    });

  }

});


/* ============================================================
   ⚙️ EXTENSIBILITY NOTES
   ============================================================ */

/**
 * 🔮 Future Enhancements:
 *
 *   - Add Authentication (JWT)
 *   - Add login endpoint
 *   - Add protected routes (middleware)
 *   - Add company backend URL
 *   - Add API gateway forwarding (Cloudflare Worker)
 *
 * ------------------------------------------------------------
 *
 * 🧠 SCALABILITY NOTES:
 *
 * This design is scalable because:
 *
 *   ✅ Stateless requests
 *   ✅ No session dependency
 *   ✅ Can be deployed horizontally
 *
 * ------------------------------------------------------------
 *
 * 🔐 SECURITY NOTES:
 *
 * Current level:
 *   - Basic input validation
 *
 * Required improvements:
 *   - JWT Authentication
 *   - Rate limiting
 *   - API key validation
 *   - HTTPS enforcement
 *
 * ------------------------------------------------------------
 */


/* ============================================================
   🏁 END OF FILE
   ============================================================ */
