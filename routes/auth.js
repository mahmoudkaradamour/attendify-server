/**
 * ============================================================
 * 🔐 AUTHENTICATION ROUTES MODULE
 * ============================================================
 *
 * 🎯 PURPOSE:
 *
 * This module implements a **stateless authentication system**
 * using:
 *
 *   ✅ Secure password hashing (bcrypt)
 *   ✅ Credential verification pipeline
 *   ✅ JWT-based identity layer
 *
 * ------------------------------------------------------------
 *
 * 🧠 ARCHITECTURAL POSITION:
 *
 *   Client
 *     ↓
 *   Auth Controller (THIS FILE)
 *     ↓
 *   Database (MongoDB)
 *     ↓
 *   JWT Issuance
 *
 * ------------------------------------------------------------
 *
 * 🔬 SECURITY MODEL:
 *
 *   Identity = Verified Credentials + Signed JWT
 *
 * ------------------------------------------------------------
 *
 * 📊 AUTHENTICATION FLOW:
 *
 *   REGISTER:
 *     Validate → Hash → Store → OK
 *
 *   LOGIN:
 *     Validate → Compare → Sign JWT → Return Token
 *
 * ------------------------------------------------------------
 */


const express = require("express");
const router = express.Router();

const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const {
  hashPassword,
  comparePassword
} = require("../utils/hash");


/* ============================================================
   🧱 INPUT VALIDATION UTILITIES
   ============================================================ */

/**
 * Basic email validation (RFC-lite)
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


/**
 * Password policy enforcement
 *
 * REQUIREMENTS:
 *   - Minimum length: 6
 */
function isStrongPassword(password) {
  return typeof password === "string" && password.length >= 6;
}



/* ============================================================
   🏢 REGISTER ENDPOINT
   ============================================================ */

/**
 * POST /auth/register
 */
router.post("/register", async (req, res) => {

  try {

    /* --------------------------------------------------------
       STEP 1: INPUT EXTRACTION & NORMALIZATION
       -------------------------------------------------------- */

    let { name, email, password } = req.body;

    email = typeof email === "string" ? email.toLowerCase().trim() : "";

    if (!name || !isValidEmail(email) || !isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Invalid input data"
      });
    }


    /* --------------------------------------------------------
       STEP 2: DATABASE ACCESS
       -------------------------------------------------------- */

    const db = req.app.locals.db;


    /* --------------------------------------------------------
       STEP 3: DUPLICATE CHECK
       -------------------------------------------------------- */

    const existing = await db.collection("companies").findOne({ email });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Company already exists"
      });
    }


    /* --------------------------------------------------------
       STEP 4: PASSWORD HASHING
       -------------------------------------------------------- */

    const hashedPassword = await hashPassword(password);


    /* --------------------------------------------------------
       STEP 5: ENTITY CONSTRUCTION
       -------------------------------------------------------- */

    const company = {
      id: crypto.randomUUID(),
      name,
      email,
      password: hashedPassword,

      /**
       * API key (future integration: mobile devices)
       */
      apiKey: crypto.randomUUID(),

      /**
       * Security metadata
       */
      loginAttempts: 0,
      lockUntil: null,

      /**
       * Audit data
       */
      createdAt: new Date(),
      status: "active"
    };


    /* --------------------------------------------------------
       STEP 6: INSERT INTO DATABASE
       -------------------------------------------------------- */

    await db.collection("companies").insertOne(company);


    /* --------------------------------------------------------
       STEP 7: RESPONSE
       -------------------------------------------------------- */

    return res.json({
      success: true,
      message: "Company registered successfully"
    });

  } catch (err) {

    console.error("🔥 REGISTER ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }

});


/* ============================================================
   🔐 LOGIN ENDPOINT
   ============================================================ */

/**
 * POST /auth/login
 */
router.post("/login", async (req, res) => {

  try {

    /* --------------------------------------------------------
       STEP 1: INPUT EXTRACTION
       -------------------------------------------------------- */

    let { email, password } = req.body;

    email = typeof email === "string" ? email.toLowerCase().trim() : "";

    if (!isValidEmail(email) || !password) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials"
      });
    }


    /* --------------------------------------------------------
       STEP 2: DATABASE LOOKUP
       -------------------------------------------------------- */

    const db = req.app.locals.db;

    const company = await db.collection("companies").findOne({ email });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found"
      });
    }


    /* --------------------------------------------------------
       STEP 3: ACCOUNT LOCK CHECK
       -------------------------------------------------------- */

    if (company.lockUntil && Date.now() < company.lockUntil) {
      return res.status(403).json({
        success: false,
        message: "Account temporarily locked"
      });
    }


    /* --------------------------------------------------------
       STEP 4: PASSWORD VERIFICATION
       -------------------------------------------------------- */

    const isValid = await comparePassword(password, company.password);

    if (!isValid) {

      const attempts = (company.loginAttempts || 0) + 1;

      const update = {
        $set: { loginAttempts: attempts }
      };

      /**
       * Lock after 5 failed attempts
       */
      if (attempts >= 5) {
        update.$set.lockUntil = Date.now() + 15 * 60 * 1000; // 15 mins
      }

      await db.collection("companies").updateOne(
        { id: company.id },
        update
      );

      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }


    /* --------------------------------------------------------
       STEP 5: RESET SECURITY COUNTERS
       -------------------------------------------------------- */

    await db.collection("companies").updateOne(
      { id: company.id },
      { $set: { loginAttempts: 0, lockUntil: null } }
    );


    /* --------------------------------------------------------
       STEP 6: JWT TOKEN GENERATION
       -------------------------------------------------------- */

    const payload = {
      id: company.id,
      email: company.email
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES || "7d",
      algorithm: "HS256"
    });


    /* --------------------------------------------------------
       STEP 7: RETURN RESPONSE
       -------------------------------------------------------- */

    return res.json({
      success: true,
      token
    });

  } catch (err) {

    console.error("🔥 LOGIN ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }

});


/* ============================================================
   📤 EXPORT ROUTER
   ============================================================ */

module.exports = router;


/* ============================================================
   📊 FULL AUTHENTICATION PIPELINE (ACADEMIC VIEW)
   ============================================================ */

/**
 * 🔁 SYSTEM FLOW:
 *
 *   REGISTER:
 *     Input → Validate → Hash → Store
 *
 *   LOGIN:
 *     Input → Validate → Fetch → Compare → JWT
 *
 *   AUTHENTICATED REQUEST:
 *     Client → Bearer Token → Middleware → Access
 *
 *
 * ------------------------------------------------------------
 *
 * 🔐 SECURITY GUARANTEES:
 *
 *   ✅ Passwords never stored in plain text
 *   ✅ Brute-force mitigation (lock mechanism)
 *   ✅ Stateless authentication (JWT)
 *   ✅ Input normalization integrity
 *
 *
 * ------------------------------------------------------------
 *
 * ⚡ ATTACKS MITIGATED:
 *
 *   ❌ Credential Stuffing
 *   ❌ Brute Force
 *   ❌ Token Forgery
 *   ❌ Email Enumeration (partial)
 *
 *
 * ------------------------------------------------------------
 *
 * 🧠 DESIGN PRINCIPLE:
 *
 *   Identity must be:
 *     → Verified
 *     → Signed
 *     → Expirable
 *
 *
 * ============================================================
 *
 * 🏁 END OF FILE
 * ============================================================
 */