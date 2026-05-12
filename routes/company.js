/**
 * =========================================================) can access their data. * ============================================================
 *
 * It provides:
 *
 *   ✅ Secure company profile retrieval
 *   ✅ Full database entity access
 *   ✅ Controlled updates
 *   ✅ Public company lookup (for employee routing)
 *
 * ------------------------------------------------------------
 *
 * 🧠 ARCHITECTURAL FLOW:
 *
 *   Client (Authenticated)
 *          ↓
 *   JWT Middleware (auth.js)
 *          ↓
 *   Company Routes (THIS FILE)
 *          ↓
 *   MongoDB Database
 *
 * ------------------------------------------------------------
 *
 * 🔬 CORE PRINCIPLE:
 *
 * "Identity is derived ONLY from verified JWT, never from client input"
 *
 * ------------------------------------------------------------
 *
 */


/* ============================================================
   📦 MODULE IMPORTS
   ============================================================ */

const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");


/* ============================================================
   🔐 GET COMPANY PROFILE (LIGHTWEIGHT)
   ============================================================ */

/**
 * ✅ Endpoint:
 *   GET /company/profile
 *
 * PURPOSE:
 *   Returns identity extracted directly from JWT
 *
 * CHARACTERISTICS:
 *   - Fast response
 *   - No DB access
 *   - Minimal overhead
 */
router.get("/profile", auth, (req, res) => {

  try {

    /**
     * ✅ Identity from token (trusted)
     */
    const company = req.company;

    res.json({
      success: true,
      company
    });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }

});


/* ============================================================
   🔐 GET FULL COMPANY DATA (AUTHORITATIVE SOURCE)
   ============================================================ */

/**
 * ✅ Endpoint:
 *   GET /company/me
 *
 * PURPOSE:
 *   Retrieves full company document from database
 *
 * DIFFERENCE:
 *   /profile → JWT payload
 *   /me      → DB record (source of truth)
 */
router.get("/me", auth, async (req, res) => {

  try {

    const db = req.app.locals.db;

    /**
     * ✅ Extract identity
     */
    const { id } = req.company;

    /**
     * ✅ Fetch from DB
     */
    const company = await db.collection("companies").findOne({ id });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found"
      });
    }

    /**
     * 🔐 Remove sensitive fields
     */
    delete company.password;

    res.json({
      success: true,
      company
    });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }

});


/* ============================================================
   🌐 PUBLIC LOOKUP (EMPLOYEE ROUTING LAYER)
   ============================================================ */

/**
 * ✅ Endpoint:
 *   GET /company/lookup/:name
 *
 * PURPOSE:
 *   Allows external actors (employees) to verify company existence
 *
 * SECURITY:
 *   - No sensitive data returned
 *   - Public safe endpoint
 *
 * ------------------------------------------------------------
 *
 * 📊 FLOW:
 *
 *   Employee → enter company name
 *       ↓
 *   /lookup/:name
 *       ↓
 *   DB validation
 *       ↓
 *   Minimal response
 */
router.get("/lookup/:name", async (req, res) => {

  try {

    const db = req.app.locals.db;
    const name = req.params.name.trim().toLowerCase();

    /**
     * ✅ Query DB
     */
    const company = await db.collection("companies")
      .findOne({ name });

    if (!company) {
      return res.status(404).json({
        exists: false
      });
    }

    /**
     * ✅ Return safe subset only
     */
    res.json({
      exists: true,
      company: {
        id: company.id,
        name: company.name
      }
    });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }

});


/* ============================================================
   🔐 UPDATE COMPANY (CONTROLLED MUTATION)
   ============================================================ */

/**
 * ✅ Endpoint:
 *   PUT /company/update
 *
 * PURPOSE:
 *   Allows company to update allowed fields
 *
 * SECURITY MODEL:
 *   - Identity from JWT
 *   - Field whitelist
 *   - No override of critical fields
 *
 * PROTECTED FIELDS:
 *   ❌ id
 *   ❌ password
 *   ❌ apiKey
 */
router.put("/update", auth, async (req, res) => {

  try {

    const db = req.app.locals.db;
    const { id } = req.company;

    const { name, email } = req.body;

    /**
     * ✅ Controlled update (whitelist)
     */
    const updateData = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase().trim();

    /**
     * ✅ Prevent empty update
     */
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: "No valid fields provided"
      });
    }

    await db.collection("companies").updateOne(
      { id },
      { $set: updateData }
    );

    res.json({
      success: true,
      message: "Company updated"
    });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }

});


/* ============================================================
   🔐 DELETE COMPANY (SOFT DELETE)
   ============================================================ */

/**
 * ✅ Endpoint:
 *   DELETE /company/delete
 *
 * PURPOSE:
 *   Soft delete company (ability to restore later)
 */
router.delete("/delete", auth, async (req, res) => {

  try {

    const db = req.app.locals.db;
    const { id } = req.company;

    await db.collection("companies").updateOne(
      { id },
      { $set: { status: "deleted" } }
    );

    res.json({
      success: true,
      message: "Company deleted (soft)"
    });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }

});


/* ============================================================
   📊 SYSTEM FLOW SUMMARY
   ============================================================ */

/**
 * 🔁 COMPANY WORKFLOW:
 *
 *   Register → Login → Receive JWT
 *        ↓
 *   Access protected routes:
 *       /profile
 *       /me
 *       /update
 *       /delete
 *
 * ------------------------------------------------------------
 *
 * 🔁 EMPLOYEE WORKFLOW:
 *
 *   Enter company name
 *        ↓
 *   /lookup/:name
 *        ↓
 *   If exists → route to company backend
 *
 */


/* ============================================================
   🔐 SECURITY ANALYSIS (ENTERPRISE LEVEL)
   ============================================================ */

/**
 * ✅ TRUST MODEL:
 *
 *   Client        → Untrusted
 *   JWT Middleware → Identity Authority
 *   Routes        → Trusted logic
 *
 * ------------------------------------------------------------
 *
 * ✅ DEFENSE STRATEGIES:
 *
 *   - JWT verification (authentication)
 *   - Field filtering (data protection)
 *   - Whitelist updates (integrity enforcement)
 *   - No sensitive data leakage
 *
 * ------------------------------------------------------------
 *
 * ⚠️ THREAT MITIGATION:
 *
 *   Unauthorized access        → auth middleware
 *   Data tampering             → controlled updates
 *   Sensitive data exposure    → sanitization
 *
 */


/* ============================================================
   📦 EXPORT
   ============================================================ */

module.exports = router;


/* ============================================================
   🏁 END OF FILE
   ============================================================ */

 /**
 * 🏢 COMPANY ROUTES MODULE (PROTECTED BUSINESS LOGIC LAYER)
 * ============================================================
 *
 * 🎯 PURPOSE:
 *
 * This module represents the "Post-Authentication Business Layer"
*/