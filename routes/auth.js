/**
 * ============================================================
 * 🔐 AUTHENTICATION ROUTES MODULE (JWT + PASSWORD SECURITY)
 * ============================================================
 *
 * 🎯 PURPOSE:
 * This module implements the Authentication Layer of the system.
 *
 * It provides:
 *   ✅ Company registration (secure account creation)
 *   ✅ Company login (authentication)
 *   ✅ JSON Web Token issuance (stateless session control)
 *
 * ------------------------------------------------------------
 *
 * 🧠 CONCEPTUAL MODEL:
 *
 * Authentication Flow:
 *
 *   Client → Register/Login → Server
 *                         ↓
 *                   Validate Input
 *                         ↓
 *                   Verify Credentials
 *                         ↓
 *                    Generate JWT
 *                         ↓
 *                      Respond
 *
 * ------------------------------------------------------------
 *
 * 🔬 DESIGN PRINCIPLES:
 *
 *   ✅ Stateless Authentication (JWT)
 *   ✅ Secure Password Storage (bcrypt)
 *   ✅ Separation of Concerns (routes vs middleware)
 *   ✅ Multi-tenant Awareness (company-based identity)
 *
 */


// ============================================================
// 📦 MODULE IMPORTS
// ============================================================

const express = require("express");
const router = express.Router();

const jwt = require("jsonwebtoken");

/**
 * Import hashing utilities
 * Responsible for:
 *   - Password hashing
 *   - Password comparison
 */
const { hashPassword, comparePassword } = require("../utils/hash");

/**
 * Node.js crypto module
 * Used to generate unique identifiers
 */
const crypto = require("crypto");


// ============================================================
// 🏢 ROUTE: REGISTER COMPANY
// ============================================================

/**
 * ------------------------------------------------------------
 * ✅ ENDPOINT:
 *   POST /auth/register
 *
 * PURPOSE:
 *   Creates a new company account in the system
 *
 * SECURITY FEATURES:
 *   - Password hashing (bcrypt)
 *   - Unique account validation
 *   - Random API key generation
 *
 * ------------------------------------------------------------
 *
 * 📊 FLOW DIAGRAM:
 *
 *   Client (Register Request)
 *          ↓
 *   Extract Input Fields
 *          ↓
 *   Validate Input Integrity
 *          ↓
 *   Check Existing Company
 *          ↓
 *   Hash Password (bcrypt)
 *          ↓
 *   Generate Identifiers (UUID + API Key)
 *          ↓
 *   Insert into MongoDB
 *          ↓
 *   Respond to Client
 *
 * ------------------------------------------------------------
 */
router.post("/register", async (req, res) => {

  try {

    /**
     * ✅ Step 1: Extract request body
     */
    const { name, email, password } = req.body;


    /**
     * ✅ Step 2: Input validation
     *
     * Ensures that required fields are provided
     */
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Missing required fields"
      });
    }


    /**
     * ✅ Step 3: Retrieve database instance
     */
    const db = req.app.locals.db;


    /**
     * ✅ Step 4: Check for existing company
     *
     * Prevents duplicate accounts (data consistency)
     */
    const existing = await db.collection("companies").findOne({ email });

    if (existing) {
      return res.status(409).json({
        message: "Company already exists"
      });
    }


    /**
     * 🔐 Step 5: Hash password
     *
     * Uses bcrypt algorithm:
     *   - Salt generation
     *   - One-way hashing
     *
     * Ensures password is not stored in plaintext
     */
    const hashedPassword = await hashPassword(password);


    /**
     * ✅ Step 6: Construct company object
     */
    const company = {
      id: crypto.randomUUID(),
      name,
      email,
      password: hashedPassword,
      apiKey: crypto.randomUUID(),
      createdAt: new Date()
    };


    /**
     * ✅ Step 7: Store in database
     */
    await db.collection("companies").insertOne(company);


    /**
     * ✅ Step 8: Respond
     */
    res.json({
      success: true,
      message: "Company registered successfully"
    });

  } catch (err) {

    /**
     * 🛑 Error handling
     */
    res.status(500).json({
      message: err.message
    });
  }

});


// ============================================================
// 🔐 ROUTE: LOGIN
// ============================================================

/**
 * ------------------------------------------------------------
 * ✅ ENDPOINT:
 *   POST /auth/login
 *
 * PURPOSE:
 *   Authenticates company and generates JWT token
 *
 * SECURITY FEATURES:
 *   - Password verification (bcrypt.compare)
 *   - Token signing (HMAC SHA-256)
 *   - Expiration enforcement
 *
 * ------------------------------------------------------------
 *
 * 📊 FLOW DIAGRAM:
 *
 *   Client (Login Request)
 *          ↓
 *   Extract Credentials
 *          ↓
 *   Fetch Company from DB
 *          ↓
 *   Compare Password (bcrypt)
 *          ↓
 *   If valid → Generate JWT
 *          ↓
 *   Return Token
 *
 * ------------------------------------------------------------
 */
router.post("/login", async (req, res) => {

  try {

    /**
     * ✅ Step 1: Extract credentials
     */
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Missing credentials"
      });
    }


    /**
     * ✅ Step 2: Access database
     */
    const db = req.app.locals.db;


    /**
     * ✅ Step 3: Find company
     */
    const company = await db.collection("companies").findOne({ email });

    if (!company) {
      return res.status(404).json({
        message: "Company not found"
      });
    }


    /**
     * 🔐 Step 4: Verify password
     *
     * bcrypt.compare performs:
     *   - re-hashing
     *   - hash comparison
     */
    const isValid = await comparePassword(password, company.password);

    if (!isValid) {
      return res.status(401).json({
        message: "Invalid password"
      });
    }


    /**
     * 🔑 Step 5: Generate JWT Token
     *
     * jwt.sign(payload, secret, options)
     *
     * Payload contains identity claims
     * Secret signs token integrity
     * Options include expiration
     */
    const token = jwt.sign(
      {
        id: company.id,
        name: company.name,
        email: company.email
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES
      }
    );


    /**
     * ✅ Step 6: Respond with token
     */
    res.json({
      success: true,
      token
    });

  } catch (err) {

    res.status(500).json({
      message: err.message
    });

  }

});


// ============================================================
// 📊 AUTHENTICATION FLOW (FULL SYSTEM VIEW)
// ============================================================

/**
 * 🔁 SYSTEM FLOW
 *
 * REGISTER:
 *   Client → /register → Validate → Hash → Store → OK
 *
 * LOGIN:
 *   Client → /login → Validate → Verify Password → JWT → Token
 *
 * AUTHORIZED REQUEST:
 *   Client → Authorization Header (Bearer TOKEN)
 *          ↓
 *   authMiddleware
 *          ↓
 *   Protected Route
 *
 * ------------------------------------------------------------
 */


/**
 * ============================================================
 * 🔐 SECURITY ANALYSIS
 * ============================================================
 *
 * PASSWORD SECURITY:
 *   - bcrypt hashing
 *   - salted hashes
 *
 * TOKEN SECURITY:
 *   - JWT signed with secret key
 *   - expiration-based validity
 *
 * THREAT MODEL:
 *
 *   Threat: Password theft
 *   Mitigation: hashing
 *
 *   Threat: Token replay
 *   Mitigation: expiration
 *
 *   Threat: Unauthorized access
 *   Mitigation: middleware verification
 *
 * ------------------------------------------------------------
 */


/**
 * ============================================================
 * 📦 EXPORT ROUTER
 * ============================================================
 */
module.exports = router;


/**
 * ============================================================
 * 🏁 END OF FILE
 * ============================================================
 */