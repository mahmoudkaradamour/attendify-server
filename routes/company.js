/**
 * ============================================================
 * 🏢 COMPANY ROUTES MODULE (PROTECTED   ✅ Company identity access * 🏢 COMPANY ROUTES MODULE (PROTECTED BUSINESS LOGIC LAYER)
 *   ✅ Database-backed entity retrieval
 *   ✅ Controlled updates (data integrity)
 *   ✅ Public-safe lookup endpoints
 *
 * ------------------------------------------------------------
 *
 * 🧠 ARCHITECTURAL FLOW:
 *
 *   Client (Authenticated)
 *         ↓
 *   JWT Middleware (auth.js)
 *         ↓
 *   Company Routes (THIS FILE)
 *         ↓
 *   MongoDB (Source of Truth)
 *
 * ------------------------------------------------------------
 *
 * 🔬 CORE PRINCIPLE:
 *
 *   Identity must NEVER come from client input.
 *   Identity is derived exclusively from verified JWT.
 *
 * ------------------------------------------------------------
 *
 * 🔐 SECURITY MODEL:
 *
 *   Client → Untrusted
 *   JWT Middleware → Identity Authority
 *   Routes → Trusted Business Logic
 *   Database → Persistent Truth
 *
 * ------------------------------------------------------------
 */

const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");


/* ============================================================
   🧱 VALIDATION HELPERS
   ============================================================ */

/**
 * Basic normalization
 */
function normalizeString(input) {
  return typeof input === "string" ? input.trim() : "";
}

/**
 * Email validation
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


/* ============================================================
   🔐 GET COMPANY PROFILE (JWT SOURCE)
   ============================================================ */

/**
 * ✅ GET /company/profile
 *
 * PURPOSE:
 *   Lightweight identity extraction
 *
 * CHARACTERISTICS:
 *   ✅ Zero DB access
 *   ✅ Fast response
 *   ✅ Trusted identity (JWT-based)
 *
 * ------------------------------------------------------------
 *
 * 📊 FLOW:
 *
 *   JWT → decoded → req.company → response
 */

router.get("/profile", auth, (req, res) => {

  try {

    const company = req.company;

    return res.json({
      success: true,
      company
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }

});


/* ============================================================
   🔐 GET FULL COMPANY DATA (DATABASE AUTHORITATIVE)
   ============================================================ */

/**
 * ✅ GET /company/me
 *
 * PURPOSE:
 *   Fetch full company entity from database
 *
 * ------------------------------------------------------------
 *
 * DIFFERENCE:
 *
 *   /profile → JWT (fast, minimal)
 *   /me      → DB (complete, authoritative)
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
     * 🔐 Data sanitization (critical)
     */
    delete company.password;
    delete company.apiKey;

    return res.json({
      success: true,
      company
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }

});


/* ============================================================
   🌐 PUBLIC COMPANY LOOKUP
   ============================================================ */

/**
 * ✅ GET /company/lookup/:name
 *
 * PURPOSE:
 *   Allow external actors (e.g., employees) to verify
 *   company existence without authentication.
 *
 * ------------------------------------------------------------
 *
 * SECURITY:
 *
 *   ✅ No sensitive fields
 *   ✅ No authentication required
 *   ✅ Minimal disclosure
 */

router.get("/lookup/:name", async (req, res) => {

  try {

    const db = req.app.locals.db;

    const name = normalizeString(req.params.name).toLowerCase();

    if (!name) {
      return res.status(400).json({
        exists: false
      });
    }

    const company = await db.collection("companies").findOne({ name });

    if (!company) {
      return res.json({
        exists: false
      });
    }

    /**
     * Return minimal safe data only
     */
    return res.json({
      exists: true,
      company: {
        id: company.id,
        name: company.name
      }
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }

});


/* ============================================================
   🔐 UPDATE COMPANY (CONTROLLED MUTATION)
   ============================================================ */

/**
 * ✅ PUT /company/update
 *
 * PURPOSE:
 *   Allow controlled updates to company fields
 *
 * ------------------------------------------------------------
 *
 * SECURITY MODEL:
 *
 *   ✅ Identity from JWT (not client)
 *   ✅ Field whitelist
 *   ✅ Prevent critical field override
 */

router.put("/update", auth, async (req, res) => {

  try {

    const db = req.app.locals.db;
    const { id } = req.company;

    let { name, email } = req.body;

    name = normalizeString(name);
    email = email ? email.toLowerCase().trim() : undefined;

    const update = {};

    if (name) update.name = name;
    if (email && isValidEmail(email)) update.email = email;

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

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }

});


/* ============================================================
   🔐 SOFT DELETE COMPANY
   ============================================================ */

/**
 * ✅ DELETE /company/delete
 *
 * PURPOSE:
 *   Perform logical deletion (soft delete)
 *
 * ------------------------------------------------------------
 *
 * DESIGN:
 *
 *   Instead of removing record:
 *     → mark as "deleted"
 *
 * BENEFITS:
 *   ✅ Auditability
 *   ✅ Recovery possible
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
      message: "Company deleted (soft)"
    });

  } catch (err) {

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
   📊 SYSTEM FLOW (ACADEMIC VIEW)
   ============================================================ */

/**
 * 🔁 AUTHENTICATED FLOW:
 *
 *   Client → Login → Receive JWT
 *        ↓
 *   Send request with Authorization header
 *        ↓
 *   JWT Middleware verifies token
 *        ↓
 *   req.company populated
 *        ↓
 *   Controller executes logic
 *        ↓
 *   Response
 *
 *
 * ------------------------------------------------------------
 *
 * 🔁 PUBLIC FLOW:
 *
 *   User → /lookup/:name → DB → Minimal response
 *
 */


/* ============================================================
   🔐 SECURITY ANALYSIS (ENTERPRISE LEVEL)
   ============================================================ */

/**
 * ✅ TRUST BOUNDARIES:
 *
 *   Client          → Untrusted
 *   JWT Middleware  → Trust Establishment
 *   Controllers     → Trusted Execution
 *
 *
 * ------------------------------------------------------------
 *
 * ✅ DEFENSE STRATEGIES:
 *
 *   - JWT verification for identity
 *   - Sanitization of DB outputs
 *   - Whitelist-based updates
 *   - No direct sensitive data exposure
 *
 *
 * ------------------------------------------------------------
 *
 * ⚡ ATTACKS MITIGATED:
 *
 *   ❌ Unauthorized access
 *   ❌ Data exfiltration
 *   ❌ Mass assignment
 *   ❌ Privilege escalation
 *
 *
 * ------------------------------------------------------------
 *
 * 🧠 DESIGN PHILOSOPHY:
 *
 *   Data ownership is strictly enforced:
 *
 *     → You can only access YOUR own data
 *
 *
 * ============================================================
 *
 * 🏁 END OF FILE
 * ============================================================
 */
 /* ============================================================
 *
 * 🎯 PURPOSE:
 *
 * This module implements the **post-authentication business layer**
 * responsible for:
 *
 *   ✅ Company identity access
 *   ✅ Database-backed entity retrieval
 *   ✅ Controlled updates with strict field validation
 *   ✅ Public-safe lookup functionality for external actors
 *
 * ------------------------------------------------------------
 *
 * 🧠 ARCHITECTURAL FLOW:
 *
 *   Client (Authenticated)
 *         ↓
 *   JWT Middleware (auth.js)
 *         ↓
 *   Company Routes (THIS FILE)
 *         ↓
 *   MongoDB Database (Source of Truth)
 *
 * ------------------------------------------------------------
 *
 * 🔬 CORE PRINCIPLE:
 *
 *   Identity MUST NEVER be trusted from client input.
 *   Identity is derived exclusively from verified JWT token.
 *
 * ------------------------------------------------------------
 */


const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");


/* ============================================================
   🧱 VALIDATION HELPERS
   ============================================================ */

function normalizeString(input) {
  return typeof input === "string" ? input.trim() : "";
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


/* ============================================================
   🔐 GET COMPANY PROFILE (JWT SOURCE)
   ============================================================ */

router.get("/profile", auth, (req, res) => {

  try {

    const company = req.company;

    return res.json({
      success: true,
      company
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }

});


/* ============================================================
   🔐 GET FULL COMPANY DATA
   ============================================================ */

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

    delete company.password;
    delete company.apiKey;

    return res.json({
      success: true,
      company
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }

});


/* ============================================================
   🌐 PUBLIC LOOKUP ENDPOINT
   ============================================================ */

router.get("/lookup/:name", async (req, res) => {

  try {

    const db = req.app.locals.db;

    const name = normalizeString(req.params.name).toLowerCase();

    if (!name) {
      return res.status(400).json({
        exists: false
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

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }

});


/* ============================================================
   🔐 UPDATE COMPANY
   ============================================================ */

router.put("/update", auth, async (req, res) => {

  try {

    const db = req.app.locals.db;
    const { id } = req.company;

    let { name, email } = req.body;

    name = normalizeString(name);
    email = email ? email.toLowerCase().trim() : undefined;

    const update = {};

    if (name) update.name = name;
    if (email && isValidEmail(email)) update.email = email;

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

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }

});


/* ============================================================
   🔐 SOFT DELETE COMPANY
   ============================================================ */

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
      message: "Company deleted (soft)"
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }

});


/* ============================================================
   📤 EXPORT
   ============================================================ */

module.exports = router;


/* ============================================================
   🏁 END OF FILE
   ============================================================ */
