/**
 * =============================================================================
 * Attendify Attendance Repository (Enterprise-Grade Data Access Layer)
 * =============================================================================
 *
 * FILE:
 * src/repositories/attendance.repository.js
 *
 * -----------------------------------------------------------------------------
 * PURPOSE
 * -----------------------------------------------------------------------------
 * This module encapsulates all database operations related to attendance.
 *
 * It provides:
 *
 *   ✅ Abstracted database access
 *   ✅ Query optimization (index-aware)
 *   ✅ Strong consistency guarantees
 *   ✅ Clean separation from business logic
 *
 * -----------------------------------------------------------------------------
 * ARCHITECTURAL ROLE
 * -----------------------------------------------------------------------------
 *
 * Service Layer → Repository (THIS) → MongoDB
 *
 * Responsibilities:
 *
 *   - Execute database queries
 *   - Handle ObjectId conversion
 *   - Ensure efficient query patterns
 *
 * Forbidden:
 *
 *   ❌ No business logic
 *   ❌ No validation logic
 *
 * -----------------------------------------------------------------------------
 * DATA MODEL ASSUMPTION
 * -----------------------------------------------------------------------------
 *
 * Collection: "attendance"
 *
 * Document shape:
 *
 * {
 *   _id: ObjectId,
 *   companyId: ObjectId,
 *   userId: ObjectId,
 *   timestamp: Number,
 *   window: Number,
 *   createdAt: Date
 * }
 *
 * -----------------------------------------------------------------------------
 * INDEX STRATEGY (CRITICAL)
 * -----------------------------------------------------------------------------
 *
 * Required index:
 *
 *   { companyId: 1, userId: 1, window: 1 }
 *
 * With:
 *
 *   unique: true  (recommended for strong concurrency safety)
 *
 * Ensures:
 *
 *   ✅ O(log N) query performance
 *   ✅ Duplicate prevention at DB level
 *
 * -----------------------------------------------------------------------------
 * DESIGN PRINCIPLES
 * -----------------------------------------------------------------------------
 *
 *   1. Pure Data Layer (no domain logic)
 *   2. Strong typing via ObjectId
 *   3. Deterministic queries
 *   4. Index-aware query structure
 *
 * =============================================================================
 */

/* =============================================================================
 * MODULE IMPORTS
 * =============================================================================
 */

const { ObjectId } = require("mongodb");

const { getDb } =
  require("../infrastructure/mongo/mongo.connection");

const logger =
  require("../observability/logger");

/* =============================================================================
 * CONSTANTS
 * =============================================================================
 */

const COLLECTION_NAME = "attendance";

/**
 * Get collection reference
 */
function getCollection() {
  return getDb().collection(COLLECTION_NAME);
}

/* =============================================================================
 * HELPER FUNCTIONS
 * =============================================================================
 */

/**
 * Converts string to ObjectId safely.
 *
 * @param {string} id
 * @returns {ObjectId}
 */
function toObjectId(id) {

  if (id instanceof ObjectId) {
    return id;
  }

  if (!ObjectId.isValid(id)) {
    throw new Error("Invalid ObjectId");
  }

  return new ObjectId(id);
}

/* =============================================================================
 * CORE QUERIES
 * =============================================================================
 */

/**
 * Finds attendance by user within a specific window.
 *
 * @param {object} params
 * @param {string} params.companyId
 * @param {string} params.userId
 * @param {number} params.window
 *
 * @returns {Promise<object|null>}
 */
async function findOneByWindow(params) {

  const {
    companyId,
    userId,
    window
  } = params;

  const collection = getCollection();

  try {

    const result =
      await collection.findOne({
        companyId: toObjectId(companyId),
        userId: toObjectId(userId),
        window
      });

    return result;

  } catch (error) {

    logger.error("Attendance findOneByWindow failed", {
      error,
      context: { companyId, userId, window }
    });

    throw error;
  }
}

/**
 * Creates a new attendance record.
 *
 * @param {object} entity
 * @returns {Promise<object>}
 */
async function create(entity) {

  const collection = getCollection();

  try {

    const doc = {
      companyId: toObjectId(entity.companyId),
      userId: toObjectId(entity.userId),
      timestamp: entity.timestamp,
      window: entity.window,
      createdAt: entity.createdAt || new Date()
    };

    const result =
      await collection.insertOne(doc);

    return {
      _id: result.insertedId,
      ...doc
    };

  } catch (error) {

    /**
     * Duplicate key error (MongoDB)
     *
     * Code: 11000
     */
    if (error.code === 11000) {

      logger.warn("Duplicate attendance (DB-level)", {
        context: entity
      });

      throw new Error("Duplicate attendance constraint violated");
    }

    logger.error("Attendance create failed", {
      error,
      context: entity
    });

    throw error;
  }
}

/* =============================================================================
 * OPTIONAL QUERIES (FUTURE EXTENSIONS)
 * =============================================================================
 */

/**
 * Finds attendance by ID.
 *
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function findById(id) {

  try {

    const result =
      await getCollection().findOne({
        _id: toObjectId(id)
      });

    return result;

  } catch (error) {

    logger.error("Attendance findById failed", {
      error,
      context: { id }
    });

    throw error;
  }
}

/**
 * Deletes attendance record.
 *
 * @param {string} id
 */
async function deleteById(id) {

  try {

    await getCollection().deleteOne({
      _id: toObjectId(id)
    });

  } catch (error) {

    logger.error("Attendance deleteById failed", {
      error,
      context: { id }
    });

    throw error;
  }
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {
  findOneByWindow,
  create,
  findById,
  deleteById
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */