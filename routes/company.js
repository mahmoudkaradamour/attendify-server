/**
 * ============================================================
 * 🏢 COMPANY ROUTES MODULE (PROTECTED BUSINESS LOGIC LAYER)
 * ============================================================
 *
 * 🎯 PURPOSE:
 * This module defines all routes related to authenticated companies.
 *
 * It represents the "Business Logic Layer" of the SaaS system,
 * where only verified companies (via JWT) can access their data.
 *
 * ------------------------------------------------------------
 *
 * 🧠 ARCHITECTURAL ROLE:
 *
 * This layer sits AFTER authentication and BEFORE the data layer:
 *
 *      Client (Authenticated)
 *             ↓
 *      Auth Middleware
 *             ↓
 *      Company Routes  ← THIS FILE
 *             ↓
 *      MongoDB / External APIs
 *
 * ------------------------------------------------------------
 *
 * 🧬 MULTI-TENANT PRINCIPLE:
 *
 * The system is designed as a Multi-Tenant Architecture:
 *
 *   - Each company is logically isolated
 *   - Each request carries company identity via JWT
 *   - Data is accessed ONLY within that company context
 *
 * ------------------------------------------------------------
 *
 * 🔐 SECURITY PRINCIPLE:
 *
 * "Never trust client input — trust verified identity only"
 *
 * Identity is derived from:
 *   → req.company (decoded JWT payload)
 *
 * ------------------------------------------------------------
 */


// ============================================================
// 📦 MODULE IMPORTS
// ============================================================

const express = require("express");
const router = express.Router();

/**
 * Authentication middleware
 *
 * Ensures:
 *   - Token is valid
 *   - Request is authenticated
 *   - Identity is attached to request
 */
const auth = require("../middleware/auth");


// ============================================================
// 🔐 PROTECTED ROUTE: GET COMPANY PROFILE
// ============================================================

/**
 * ------------------------------------------------------------
 * ✅ ENDPOINT:
 *   GET /company/profile
 *
 * ACCESS:
 *   🔐 Protected (requires valid JWT)
 *
 * PURPOSE:
 *   Returns authenticated company information
 *
 * ------------------------------------------------------------
 *
 * 📊 FLOW DIAGRAM:
 *
 *   Client Request
 *       ↓
 *   Authorization Header
 *       ↓
 *   authMiddleware
 *       ↓
 *   req.company populated
 *       ↓
 *   Route executes
 *       ↓
 *   Response returned
 *
 * ------------------------------------------------------------
 */
router.get("/profile", auth, async (req, res) => {

  try {

    /**
     * ✅ Extract identity from JWT
     *
     * This is the ONLY trusted identity source
     */
    const companyIdentity = req.company;

    res.json({
      success: true,
      company: companyIdentity
    });

  } catch (err) {

    res.status(500).json({
      message: err.message
    });

  }

});


// ============================================================
// 🔐 PROTECTED ROUTE: GET FULL COMPANY DATA FROM DATABASE
// ============================================================

/**
 * ------------------------------------------------------------
 * ✅ ENDPOINT:
 *   GET /company/me
 *
 * ACCESS:
 *   🔐 Protected
 *
 * PURPOSE:
 *   Retrieves full company document from database
 *
 * DIFFERENCE FROM /profile:
 *   - /profile → JWT payload (lightweight)
 *   - /me → full DB record (authoritative)
 *
 * ------------------------------------------------------------
 *
 * 📊 FLOW DIAGRAM:
 *
 *   Client → Token
 *       ↓
 *   authMiddleware
 *       ↓
 *   Extract company.id
 *       ↓
 *   Query MongoDB
 *       ↓
 *   Return full object
 *
 * ------------------------------------------------------------
 */
router.get("/me", auth, async (req, res) => {

  try {

    const db = req.app.locals.db;

    /**
     * ✅ Extract company ID from token
     */
    const { id } = req.company;

    /**
     * ✅ Query database
     */
    const company = await db.collection("companies").findOne({ id });

    if (!company) {
      return res.status(404).json({
        message: "Company not found"
      });
    }

    /**
     * ✅ Remove sensitive fields before returning
     */
    delete company.password;

    res.json({
      success: true,
      company
    });

  } catch (err) {

    res.status(500).json({
      message: err.message
    });

  }

});


// ============================================================
// 🔍 PUBLIC ROUTE: VALIDATE COMPANY (FOR EMPLOYEES)
// ============================================================

/**
 * ------------------------------------------------------------
 * ✅ ENDPOINT:
 *   GET /company/lookup/:name
 *
 * ACCESS:
 *   🌐 Public (no authentication required)
 *
 * PURPOSE:
 *   Allows employees to verify if a company exists
 *
 * USE CASE:
 *   Employee enters company name in mobile app
 *
 * ------------------------------------------------------------
 *
 * 📊 FLOW DIAGRAM:
 *
 *   Employee (App)
 *       ↓
 *   Enter company name
 *       ↓
 *   Request → /lookup/:name
 *       ↓
 *   Server checks DB
 *       ↓
 *   If exists → return success
 *       ↓
 *   Employee proceeds to login in company backend
 *
 * ------------------------------------------------------------
 */
router.get("/lookup/:name", async (req, res) => {

  try {

    const db = req.app.locals.db;
    const { name } = req.params;

    /**
     * ✅ Find company by name
     */
    const company = await db.collection("companies").findOne({ name });

    if (!company) {
      return res.status(404).json({
        exists: false
      });
    }

    /**
     * ✅ Return minimal info (no sensitive data)
     */
    res.json({
      exists: true,
      company: {
        name: company.name,
        id: company.id
      }
    });

  } catch (err) {

    res.status(500).json({
      message: err.message
    });

  }

});


// ============================================================
// 🔐 PROTECTED ROUTE: UPDATE COMPANY DATA
// ============================================================

/**
 * ------------------------------------------------------------
 * ✅ ENDPOINT:
 *   PUT /company/update
 *
 * ACCESS:
 *   🔐 Protected
 *
 * PURPOSE:
 *   Allows authenticated company to update its data
 *
 * ------------------------------------------------------------
 *
 * ⚠️ SECURITY NOTE:
 *   Only allow updates on specific fields
 *   Never allow id or apiKey override
 *
 * ------------------------------------------------------------
 */
router.put("/update", auth, async (req, res) => {

  try {

    const db = req.app.locals.db;
    const { id } = req.company;

    const { name, email } = req.body;

    /**
     * ✅ Controlled update (whitelist fields only)
     */
    const updateData = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email;

    await db.collection("companies").updateOne(
      { id },
      { $set: updateData }
    );

    res.json({
      success: true,
      message: "Company updated"
    });

  } catch (err) {

    res.status(500).json({
      message: err.message
    });

  }

});


// ============================================================
// 📊 SYSTEM FLOW (COMPLETE VIEW)
// ============================================================

/**
 * 🔁 COMPANY INTERACTION FLOW:
 *
 * 1. Company registers
 * 2. Company logs in → gets JWT
 * 3. Company uses JWT to access protected routes
 *
 * ------------------------------------------------------------
 *
 * 🔁 EMPLOYEE FLOW:
 *
 * 1. Employee enters company name
 * 2. /lookup verifies existence
 * 3. App connects employee to company backend
 *
 * ------------------------------------------------------------
 *
 * 🔁 SECURITY FLOW:
 *
 * Request → JWT Verification → Identity Extraction → Access Granted
 *
 */


// ============================================================
// 🔐 SECURITY ANALYSIS (ACADEMIC LEVEL)
// ============================================================

/**
 * ✅ CORE SECURITY MECHANISMS:
 *
 *   - JWT for identity verification
 *   - Middleware isolation
 *   - Data sanitization (remove password)
 *   - Controlled updates
 *
 *
 * ⚠️ THREATS:
 *
 *   - Unauthorized access → prevented by JWT
 *   - Data leakage → prevented by field filtering
 *   - Injection → mitigated by structured queries
 *
 *
 * ✅ BEST PRACTICES:
 *
 *   - Always verify identity via middleware
 *   - Never trust req.body for identity
 *   - Keep business logic separate from auth
 *
 */


// ============================================================
// 📦 EXPORT ROUTER
// ============================================================

module.exports = router;


/**
 * ============================================================
 * 🏁 END OF FILE
 * ============================================================
 */