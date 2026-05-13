/**
 * ============================================================
 * 🏢 COMPANY ROUTES MODULE (PROTECTED BUSINESS LOGIC LAYER)
 * ============================================================
 *
 * PURPOSE:
 *
 * This module implements the post-authentication business layer
 * for company-related operations.
 *
 * It provides:
 *
 *   ✅ Lightweight company profile retrieval from verified JWT
 *   ✅ Full database-backed company entity retrieval
 *   ✅ Public-safe company lookup for routing workflows
 *   ✅ Controlled company updates using strict field whitelisting
 *   ✅ Soft deletion for auditability and recovery
 *
 * ------------------------------------------------------------
 *
 * ARCHITECTURAL FLOW:
 *
 *   Authenticated Client
 *        ↓
 *   JWT Middleware
 *        ↓
 *   Company Routes
 *        ↓
 *   MongoDB
 *        ↓
 *   JSON Response
 *
 * ------------------------------------------------------------
 *
 * CORE SECURITY PRINCIPLE:
 *
 *   Identity must NEVER be trusted from client input.
 *
 *   The company identity must always be derived from:
 *
 *     req.company
 *
 *   which is populated only after JWT verification by the
 *   authentication middleware.
 *
 * ------------------------------------------------------------
 *
 * TRUST MODEL:
 *
 *   Client          → Untrusted
 *   JWT Middleware  → Identity Establishment Layer
 *   Routes          → Trusted Business Logic
 *   MongoDB         → Source of Truth
 *
 * ------------------------------------------------------------
 *
 * DATA PROTECTION MODEL:
 *
 *   Sensitive fields must never be returned to clients:
 *
 *     ❌ password
 *     ❌ apiKey
 *
 *   Only safe, intentionally selected data may be exposed.
 *
 * ------------------------------------------------------------
 */


/* ============================================================
   MODULE IMPORTS
   ============================================================ */

const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");


/* ============================================================
   VALIDATION HELPERS
   ============================================================ */

/**
 * normalizeString()
 *
 * PURPOSE:
 *   Safely normalize string input before using it in application logic.
 *
 * WHY:
 *   Client input is untrusted and may contain unwanted whitespace,
 *   invalid types, or formatting inconsistencies.
 *
 * @param {any} input
 * @returns {string}
 */
function normalizeString(input) {
  return typeof input === "string" ? input.trim() : "";
}


/**
 * isValidEmail()
 *
 * PURPOSE:
 *   Performs lightweight email format validation.
 *
 * NOTE:
 *   This validation is intentionally simple and practical.
 *   It is not intended to fully implement the complete email RFC.
 *
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


/* ============================================================
   GET COMPANY PROFILE (JWT SOURCE)
   ============================================================ */

/**
 * GET /company/profile
 *
 * PURPOSE:
 *   Returns lightweight company identity extracted directly
 *   from the verified JWT token.
 *
 * CHARACTERISTICS:
 *
 *   ✅ Fast response
 *   ✅ No database access
 *   ✅ Identity comes from verified JWT
 *
 * FLOW:
 *
 *   Request
 *      ↓
 *   auth middleware verifies JWT
 *      ↓
 *   req.company is populated
 *      ↓
 *   response is returned
 */

router.get("/profile", auth, (req, res) => {
  try {
    return res.json({
      success: true,
      company: req.company
    });
  } catch (err) {
    console.error("PROFILE ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});


/* ============================================================
   GET FULL COMPANY DATA (DATABASE AUTHORITATIVE SOURCE)
   ============================================================ */

/**
 * GET /company/me
 *
 * PURPOSE:
 *   Retrieves the full company document from MongoDB.
 *
 * DIFFERENCE BETWEEN /profile AND /me:
 *
 *   /profile → JWT payload only
 *   /me      → Full database document
 *
 * SECURITY:
 *
 *   Sensitive fields are removed before returning the response.
 */

router.get("/me", auth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.company;

    const company = await db.collection("companies").findOne({ id });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found"
      });
    }

    /**
     * Critical output sanitization.
     *
     * These fields must never leave the backend.
     */
    delete company.password;
    delete company.apiKey;

    return res.json({
      success: true,
      company
    });
  } catch (err) {
    console.error("GET COMPANY ME ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});


/* ============================================================
   PUBLIC COMPANY LOOKUP
   ============================================================ */

/**
 * GET /company/lookup/:name
 *
 * PURPOSE:
 *   Allows external clients, such as employee applications,
 *   to verify whether a company exists.
 *
 * SECURITY MODEL:
 *
 *   This endpoint is public, but it returns only minimal safe data.
 *
 * RETURNED DATA:
 *
 *   ✅ company.id
 *   ✅ company.name
 *
 * NOT RETURNED:
 *
 *   ❌ email
 *   ❌ password
 *   ❌ apiKey
 *   ❌ security metadata
 */

router.get("/lookup/:name", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const name = normalizeString(req.params.name).toLowerCase();

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Invalid company name"
      });
    }

    const company = await db.collection("companies").findOne({ name });

    if (!company) {
      return res.json({
        exists: false
      });
    }

    return res.json({
      exists: true,
      company: {
        id: company.id,
        name: company.name
      }
    });
  } catch (err) {
    console.error("COMPANY LOOKUP ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});


/* ============================================================
   UPDATE COMPANY (CONTROLLED MUTATION)
   ============================================================ */

/**
 * PUT /company/update
 *
 * PURPOSE:
 *   Allows an authenticated company to update only approved fields.
 *
 * SECURITY PRINCIPLE:
 *
 *   This endpoint uses strict field whitelisting.
 *
 * ALLOWED FIELDS:
 *
 *   ✅ name
 *   ✅ email
 *
 * PROTECTED FIELDS:
 *
 *   ❌ id
 *   ❌ password
 *   ❌ apiKey
 *   ❌ status
 *   ❌ loginAttempts
 *   ❌ lockUntil
 *
 * FLOW:
 *
 *   Request
 *      ↓
 *   JWT verification
 *      ↓
 *   Extract company id from req.company
 *      ↓
 *   Validate allowed fields
 *      ↓
 *   Update MongoDB
 */

router.put("/update", auth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.company;

    let { name, email } = req.body;

    name = normalizeString(name);
    email = typeof email === "string" ? email.toLowerCase().trim() : undefined;

    const update = {};

    if (name) {
      update.name = name;
    }

    if (email && isValidEmail(email)) {
      update.email = email;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided"
      });
    }

    await db.collection("companies").updateOne(
      { id },
      { $set: update }
    );

    return res.json({
      success: true,
      message: "Company updated"
    });
  } catch (err) {
    console.error("UPDATE COMPANY ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});


/* ============================================================
   SOFT DELETE COMPANY
   ============================================================ */

/**
 * DELETE /company/delete
 *
 * PURPOSE:
 *   Performs logical deletion instead of physical deletion.
 *
 * WHY SOFT DELETE?
 *
 *   ✅ Preserves audit history
 *   ✅ Allows future recovery
 *   ✅ Avoids accidental irreversible data loss
 *
 * IMPLEMENTATION:
 *
 *   The company document is not removed.
 *   Instead, its status is changed to "deleted".
 */

router.delete("/delete", auth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.company;

    await db.collection("companies").updateOne(
      { id },
      {
        $set: {
          status: "deleted",
          deletedAt: new Date()
        }
      }
    );

    return res.json({
      success: true,
      message: "Company deleted soft"
    });
  } catch (err) {
    console.error("DELETE COMPANY ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});


/* ============================================================
   EXPORT ROUTER
   ============================================================ */

module.exports = router;


/* ============================================================
   SYSTEM FLOW SUMMARY
   ============================================================ */

/**
 * AUTHENTICATED FLOW:
 *
 *   Client
 *      ↓
 *   Login
 *      ↓
 *   Receive JWT
 *      ↓
 *   Send request with Authorization header
 *      ↓
 *   auth middleware verifies token
 *      ↓
 *   req.company is populated
 *      ↓
 *   route executes business logic
 *      ↓
 *   response returned
 *
 * ------------------------------------------------------------
 *
 * PUBLIC LOOKUP FLOW:
 *
 *   Client
 *      ↓
 *   GET /company/lookup/:name
 *      ↓
 *   MongoDB lookup
 *      ↓
 *   minimal safe metadata returned
 *
 */


/* ============================================================
   SECURITY ANALYSIS
   ============================================================ */

/**
 * MITIGATED RISKS:
 *
 *   ❌ Unauthorized access
 *      → mitigated by JWT middleware
 *
 *   ❌ Mass assignment
 *      → mitigated by field whitelisting
 *
 *   ❌ Sensitive data exposure
 *      → mitigated by output sanitization
 *
 *   ❌ Cross-tenant access
 *      → mitigated by deriving company id from verified JWT
 *
 * ------------------------------------------------------------
 *
 * DESIGN PHILOSOPHY:
 *
 *   Never trust request body for identity.
 *   Never expose sensitive fields.
 *   Never allow uncontrolled mutation.
 *
 */


/* ============================================================
   END OF FILE
   ============================================================ */