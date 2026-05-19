/**
 * =============================================================================
 * Attendify Session Repository (MongoDB Implementation)
 * =============================================================================
 *
 * FILE:
 * src/repositories/session.repository.js
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * This module implements session persistence for authenticated identities.
 *
 * Although JWT is stateless, this repository introduces a controlled layer of
 * session awareness, enabling:
 *
 *   ✅ Session tracking
 *   ✅ Token traceability (via jti)
 *   ✅ Session revocation
 *   ✅ Security auditability
 *
 * -----------------------------------------------------------------------------
 * WHY SESSION PERSISTENCE EXISTS
 * -----------------------------------------------------------------------------
 *
 * Stateless JWT alone cannot provide:
 *
 *   ❌ Immediate logout
 *   ❌ Token invalidation
 *   ❌ Device/session visibility
 *
 * Therefore:
 *
 *   This repository bridges stateless authentication with stateful control.
 *
 * -----------------------------------------------------------------------------
 * SESSION FLOW
 * -----------------------------------------------------------------------------
 *
 *           Successful Authentication
 *                     │
 *                     ▼
 *           generateAccessToken()
 *                     │
 *                     ▼
 *          SessionRepository.createSession()
 *                     │
 *                     ▼
 *                 MongoDB
 *
 * -----------------------------------------------------------------------------
 * SESSION LIFECYCLE
 * -----------------------------------------------------------------------------
 *
 * create → active → revoked → expired
 *
 * -----------------------------------------------------------------------------
 * DATA MODEL
 * -----------------------------------------------------------------------------
 *
 * {
 *   _id,
 *   companyId,
 *   tokenId (jti),
 *   sessionId (sid),
 *   createdAt,
 *   lastActivityAt,
 *   revoked,
 *   revokedAt
 * }
 *
 * -----------------------------------------------------------------------------
 * SECURITY PRINCIPLE
 * -----------------------------------------------------------------------------
 *
 *   "Authentication should remain observable, traceable, and revocable."
 *
 * =============================================================================
 */

const { getDB } = require("../infrastructure/mongo/mongo.connection");

/* =============================================================================
 * COLLECTION CONFIGURATION
 * =============================================================================
 */

const COLLECTION_NAME = "sessions";

function getCollection() {
  return getDB().collection(COLLECTION_NAME);
}

/* =============================================================================
 * CREATE SESSION
 * =============================================================================
 */

/**
 * createSession()
 * -----------------------------------------------------------------------------
 *
 * PURPOSE:
 * -----------------------------------------------------------------------------
 * Persists a new session entry for an authenticated identity.
 *
 * -----------------------------------------------------------------------------
 * @param {object} session
 * @param {string} session.companyId
 * @param {string} session.tokenId
 * @param {string} session.sessionId
 *
 * @returns {Promise<object>}
 */

async function createSession(session) {

  const now = new Date();

  const document = {

    companyId: session.companyId,

    tokenId: session.tokenId,

    sessionId: session.sessionId,

    createdAt: now,

    lastActivityAt: now,

    revoked: false,

    revokedAt: null
  };

  const result = await getCollection().insertOne(document);

  return {
    _id: result.insertedId,
    ...document
  };
}

/* =============================================================================
 * FIND BY TOKEN ID (JTI)
 * =============================================================================
 */

/**
 * findByTokenId()
 */

async function findByTokenId(tokenId) {

  return getCollection().findOne({ tokenId });
}

/* =============================================================================
 * REVOKE SESSION
 * =============================================================================
 */

/**
 * revokeSession()
 *
 * Marks a session as revoked.
 */

async function revokeSession(sessionId) {

  await getCollection().updateOne(
    { sessionId },
    {
      $set: {
        revoked: true,
        revokedAt: new Date()
      }
    }
  );
}

/* =============================================================================
 * CHECK REVOCATION STATE
 * =============================================================================
 */

/**
 * isRevoked()
 *
 * Determines whether a session is revoked.
 */

async function isRevoked(sessionId) {

  const session = await getCollection().findOne({ sessionId });

  /**
   * If session is missing → treat as invalid/revoked.
   */
  if (!session) {
    return true;
  }

  return session.revoked === true;
}

/* =============================================================================
 * UPDATE LAST ACTIVITY
 * =============================================================================
 */

/**
 * updateActivity()
 *
 * Updates session activity timestamp.
 */

async function updateActivity(sessionId) {

  await getCollection().updateOne(
    { sessionId },
    {
      $set: {
        lastActivityAt: new Date()
      }
    }
  );
}

/* =============================================================================
 * EXPORTS
 * =============================================================================
 */

module.exports = {

  createSession,

  findByTokenId,

  revokeSession,

  isRevoked,

  updateActivity
};

/**
 * =============================================================================
 * END OF FILE
 * =============================================================================
 */