/**===========
 * 🔐 AUTHENTICATION ROUTES MODULE (JWT + SECURE IDENTITY LAYER)
 * ============================================================
 *
 * 🎯 PURPOSE:
 *
 * This module implements the full authentication lifecycle:
 *
 *   ✅ Secure company registration
 *   ✅ Credential verification (login)
 *   ✅ JWT token issuance (stateless authentication)
 *
 * ------------------------------------------------------------
 *
 * 🧠 ARCHITECTURAL POSITION:
 *
 *   Client (Flutter / API Tool)
 *           ↓
 *   Auth Routes (THIS FILE)
 *           ↓
 *   Database (MongoDB)
 *
 * ------------------------------------------------------------
 *
 * 📊 AUTH FLOW DIAGRAM:
 *
 * REGISTER FLOW:
 *
 *   Client → POST /auth/register
 *           ↓
 *   Validate Input
 *           ↓
 *   Check Existing User
 *           ↓
 *   Hash Password (bcrypt)
 *           ↓
 *   Store in DB
 *           ↓
 *   Success Response
 *
 * ------------------------------------------------------------
 *
 * LOGIN FLOW:
 *
 *   Client → POST /auth/login
 *           ↓
 *   Validate Credentials
 *           ↓
 *   Fetch from DB
 *           ↓
 *   Compare Password
 *           ↓
 *   Generate JWT
 *           ↓
 *   Return Token
 *
 * ------------------------------------------------------------
 */


/* ============================================================
   📦 MODULE IMPORTS
   ============================================================ */

const express = require("express");
const router = express.Router();

const jwt = require("jsonwebtoken");

/**
 * Password utilities
 */
const { hashPassword, comparePassword } = require("../utils/hash");

/**
 * Secure ID generator
 */
const crypto = require("crypto");


/* ============================================================
   🏢 REGISTER COMPANY
   ============================================================ */

router.post("/register", async (req, res) => {

  try {

    /* ========================================================
       🧠 STEP 1: INPUT EXTRACTION
       ======================================================== */
    const { name, email, password } = req.body;

    /* ========================================================
       🧠 STEP 2: VALIDATION
       ======================================================== */
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    /**
     * Basic normalization
     */
    const normalizedEmail = email.toLowerCase().trim();


    /* ========================================================
       🧠 STEP 3: DATABASE ACCESS
       ======================================================== */
    const db = req.app.locals.db;


    /* ========================================================
       🧠 STEP 4: DUPLICATION CHECK
       ======================================================== */
    const existing = await db.collection("companies")
      .findOne({ email: normalizedEmail });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Company already exists"
      });
    }


    /* ========================================================
       🔐 STEP 5: PASSWORD HASHING
       ======================================================== */

    /**
     * bcrypt hashing:
     *   - generates salt
     *   - hashes password irreversibly
     */
    const hashedPassword = await hashPassword(password);


    /* ========================================================
       🧠 STEP 6: ENTITY CONSTRUCTION
       ======================================================== */

    const company = {
      id: crypto.randomUUID(),
      name,
      email: normalizedEmail,
      password: hashedPassword,
      apiKey: crypto.randomUUID(),
      createdAt: new Date(),
      status: "active",              // ✅ extensible for admin control
      loginAttempts: 0               // ✅ brute-force protection base
    };


    /* ========================================================
       🗄️ STEP 7: DATABASE INSERTION
       ======================================================== */

    await db.collection("companies").insertOne(company);


    /* ========================================================
       📤 STEP 8: RESPONSE
       ======================================================== */

    res.json({
      success: true,
      message: "Company registered successfully"
    });

  } catch (err) {

    /* ========================================================
       🛑 ERROR HANDLING
       ======================================================== */

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }

});


/* ============================================================
   🔐 LOGIN ROUTE
   ============================================================ */

router.post("/login", async (req, res) => {

  try {

    /* ========================================================
       🧠 STEP 1: EXTRACT CREDENTIALS
       ======================================================== */
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Missing credentials"
      });
    }

    const normalizedEmail = email.toLowerCase().trim();


    /* ========================================================
       🗄️ STEP 2: DATABASE FETCH
       ======================================================== */
    const db = req.app.locals.db;

    const company = await db.collection("companies")
      .findOne({ email: normalizedEmail });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found"
      });
    }


    /* ========================================================
       🔐 STEP 3: PASSWORD VERIFICATION
       ======================================================== */

    const isValid = await comparePassword(password, company.password);

    if (!isValid) {
      /**
       * Optional: increment failed attempts
       */
      await db.collection("companies").updateOne(
        { id: company.id },
        { $inc: { loginAttempts: 1 } }
      );

      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }


    /* ========================================================
       ✅ STEP 4: RESET LOGIN ATTEMPTS
       ======================================================== */
    await db.collection("companies").updateOne(
      { id: company.id },
      { $set: { loginAttempts: 0 } }
    );


    /* ========================================================
       🔑 STEP 5: JWT GENERATION
       ======================================================== */

    /**
     * Payload = identity claims
     */
    const payload = {
      id: company.id,
      email: company.email
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES || "7d"
      }
    );


    /* ========================================================
       📤 STEP 6: RESPONSE
       ======================================================== */

    res.json({
      success: true,
      token
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: "Server error"
    });

  }
});


/* ============================================================
   📊 SYSTEM AUTH FLOW (FULL VIEW)
   ============================================================ */

/**
 * 🔁 COMPLETE AUTHENTICATION PIPELINE:
 *
 *   REGISTER:
 *     Client → Validate → Hash → Store → OK
 *
 *   LOGIN:
 *     Client → Fetch → Compare → JWT → Token
 *
 *   REQUEST:
 *     Client → Authorization Header → Middleware → Protected Route
 *
 */


/* ============================================================
   🔐 SECURITY ANALYSIS
   ============================================================ */

/**
 * 🔬 PASSWORD SECURITY:
 *
 *   - bcrypt hashing
 *   - salted hash
 *   - irreversible transformation
 *
 * 🔬 TOKEN SECURITY:
 *
 *   - JWT signed with HMAC SHA-256
 *   - expiration enforcement
 *
 * ------------------------------------------------------------
 *
 * ⚠️ THREATS & MITIGATIONS:
 *
 *   Brute force attack → loginAttempts tracking
 *   Password leak → hashing
 *   Token forgery → JWT_SECRET
 *   Replay attack → expiration
 *
 */


/* ============================================================
   📦 EXPORT
   ============================================================ */

module.exports = router;


/* ============================================================
   🏁 END OF FILE
   ============================================================ */

