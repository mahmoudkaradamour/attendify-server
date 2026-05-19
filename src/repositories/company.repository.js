/**
 * =============================================================================
 * Attendify Company Repository (Data Access Layer)
 * =============================================================================
 *
 * FILE:
 * src/repositories/company.repository.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module provides an abstraction layer over the persistence mechanism used
 * to store and retrieve company data.
 *
 * It isolates database access logic from the business logic layer (services),
 * enabling:
 *
 *   - Loose coupling
 *   - Testability
 *   - Replaceable storage engines
 *   - Consistent data contracts
 *
 * -----------------------------------------------------------------------------
 * ARCHITECTURAL POSITION
 * -----------------------------------------------------------------------------
 *
 *               Service Layer (Business Logic)
 *                          │
 *                          ▼
 *          ┌──────────────────────────────────┐
 *          │    Company Repository (THIS)     │
 *          └──────────────────────────────────┘
 *                          │
 *                          ▼
 *                 MongoDB (or any DB)
 *
 * -----------------------------------------------------------------------------
 * CORE PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Repositories abstract persistence, not business decisions."
 *
 * -----------------------------------------------------------------------------
 * RESPONSIBILITIES
 * -----------------------------------------------------------------------------
 *
 * ✅ Execute database queries
 * ✅ Map data to domain structure
 * ✅ Enforce storage constraints (unique fields)
 * ✅ Handle persistence-related errors
 *
 * -----------------------------------------------------------------------------
 * NON-RESPONSIBILITIES
 * -----------------------------------------------------------------------------
 *
 * ❌ No business logic
 * ❌ No authentication logic
 * ❌ No password hashing
 * ❌ No token management
 *
 * -----------------------------------------------------------------------------
 * DATA MODEL (SIMPLIFIED)
 * -----------------------------------------------------------------------------
 *
 * Company Document:
 *
 * {
 *   id: string,
 *   name: string,
 *   email: string,
 *   password: string,      // hashed
 *   loginAttempts: number,
 *   lockUntil: number|null,
 *   createdAt: Date,
 *   status: "active" | "deleted"
 * }
 *
 * -----------------------------------------------------------------------------
 * FLOW DIAGRAM (READ)
 * -----------------------------------------------------------------------------
 *
 *      Service Layer calls findByEmail(email)
 *                      │
 *                      ▼
 *        Build query object { email }
 *                      │
 *                      ▼
 *           MongoDB findOne(query)
 *                      │
 *                      ▼
 *             Return normalized result
 *
 * -----------------------------------------------------------------------------
 * FLOW DIAGRAM (WRITE)
 * -----------------------------------------------------------------------------
 *
 *      Service Layer calls create(data)
 *                      │
 *                      ▼
 *         Normalize + enrich data
 *                      │
 *                      ▼
 *           MongoDB insertOne(document)
 *                      │
 *                      ▼
 *         Return created entity (domain-safe)
 *
 * -----------------------------------------------------------------------------
 * ERROR HANDLING MODEL
 * -----------------------------------------------------------------------------
 *
 * Repository errors are considered infrastructure errors.
 *
 * These should be:
 *
 *   - caught at higher layers if needed
 *   - logged via observability layer
 *   - converted to AppError when necessary
 *
 * -----------------------------------------------------------------------------
 * DESIGN GUARANTEES
 * -----------------------------------------------------------------------------
 *
 * ✅ All queries are deterministic
 * ✅ No business rules embedded
 * ✅ Stable interface for services
 *
 * -----------------------------------------------------------------------------
 * FUTURE FLEXIBILITY
 * -----------------------------------------------------------------------------
 *
 * This interface allows replacing MongoDB with:
 *
 *   - PostgreSQL
 *   - Redis (for sessions)
 *   - DynamoDB
 *
 * Without modifying service logic.
 *
 * =============================================================================
 */

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

const { getDb } = require("../infrastructure/mongo/mongo.connection");

/* =============================================================================
 * COLLECTION ACCESSOR
 * =============================================================================
 */

function getCollection() {
  const db = getDb();
  return db.collection("companies");
}

/* =============================================================================
 * FIND OPERATIONS
 * =============================================================================
 */

/**
 * Finds a company by email.
 *
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function findByEmail(email) {

  const collection =
    getCollection();

  const doc =
    await collection.findOne({ email });

  if (!doc) {
    return null;
  }

  return mapToDomain(doc);
}

/* =============================================================================
 * CREATE OPERATIONS
 * =============================================================================
 */

/**
 * Creates a new company record.
 *
 * @param {object} data
 * @returns {Promise<object>}
 */
async function create(data) {

  const collection =
    getCollection();

  const document = {
    name: data.name,
    email: data.email,
    password: data.password,
    loginAttempts: 0,
    lockUntil: null,
    createdAt: new Date(),
    status: "active"
  };

  const result =
    await collection.insertOne(document);

  return mapToDomain({
    ...document,
    _id: result.insertedId
  });
}

/* =============================================================================
 * SECURITY UPDATES
 * =============================================================================
 */

/**
 * Updates security-related fields.
 *
 * @param {string} id
 * @param {object} update
 * @returns {Promise<void>}
 */
async function updateSecurity(id, update) {

  const collection =
    getCollection();

  await collection.updateOne(
    { _id: id },
    {
      $set: {
        ...update
      }
    }
  );
}

/* =============================================================================
 * MAPPERS
 * =============================================================================
 */

/**
 * Maps database document to domain entity.
 *
 * @param {object} doc
 * @returns {object}
 */
function mapToDomain(doc) {
  return {
    id: doc._id,
    name: doc.name,
    email: doc.email,
    password: doc.password,
    loginAttempts: doc.loginAttempts,
    lockUntil: doc.lockUntil,
    status: doc.status,
    createdAt: doc.createdAt
  };
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  findByEmail,
  create,
  updateSecurity
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */