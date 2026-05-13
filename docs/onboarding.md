# 🚀 Attendify Developer Onboarding Guide

## Complete Developer Guide for Setup, Architecture, Security, Testing, and Contribution

---

# 1. Introduction

Welcome to the Attendify backend system.

Attendify is a secure, distributed, cloud-native SaaS backend designed to provide:

- Company identity management
- Secure company authentication
- JWT-based stateless authorization
- Edge-based request routing through Cloudflare Worker
- Cryptographic request verification using HMAC-SHA256
- Nonce-based replay attack protection
- Secure attendance evidence submission
- Multi-tenant isolation principles

This guide is intended for developers, backend engineers, security engineers, DevOps engineers, and technical reviewers who need to understand, run, test, maintain, or extend the Attendify backend system.

---

# 2. System Mental Model

Attendify should be understood as a secure middleware platform between client applications and company-owned systems.

The system acts as:

```text
Company Identity Registry
+
Authentication Authority
+
Secure Edge-Protected API Backend
+
Cryptographic Verification Engine
```

The backend does not directly own employee business data as a primary design goal. Instead, Attendify manages company identity, secure access, routing, and security verification.

---

# 3. High-Level Architecture

```mermaid
flowchart TD
    A[Flutter Client]
    B[Cloudflare Worker - Edge Gateway]
    C[Attendify Backend - Node.js Express]
    D[(MongoDB Atlas)]

    A --> B
    B --> C
    C --> D
```

## Explanation

The client communicates with the Cloudflare Worker, not directly with the backend.

The Cloudflare Worker forwards trusted requests to the backend and injects an internal security header.

The backend validates the trusted gateway header, then applies authentication, authorization, and cryptographic validation where needed.

MongoDB Atlas stores company registry data.

---

# 4. Core Runtime Components

```text
attendify-server/
│
├── server.js
├── db.js
├── package.json
│
├── routes/
│   ├── auth.js
│   └── company.js
│
├── middleware/
│   └── auth.js
│
├── utils/
│   └── hash.js
│
├── src/
│   ├── api/
│   │   ├── nonce.controller.js
│   │   └── attendance.controller.js
│   │
│   ├── security/
│   │   ├── nonce.service.js
│   │   ├── replay.store.js
│   │   └── verifier.service.js
│   │
│   └── utils/
│       └── crypto.util.js
│
└── docs/
    ├── architecture.md
    ├── api.yaml
    └── onboarding.md
```

## Component Responsibilities

| Component | Responsibility |
|---|---|
| `server.js` | Composition root, middleware setup, route registration, startup lifecycle |
| `db.js` | MongoDB connection management |
| `routes/auth.js` | Company registration, login, JWT issuance |
| `routes/company.js` | Protected company profile, lookup, update, soft delete |
| `middleware/auth.js` | JWT validation middleware |
| `utils/hash.js` | Password hashing and comparison |
| `src/api/nonce.controller.js` | Issues secure nonce values |
| `src/api/attendance.controller.js` | Accepts signed attendance payloads |
| `src/security/nonce.service.js` | Generates and validates nonce lifecycle metadata |
| `src/security/replay.store.js` | Prevents nonce reuse and replay attacks |
| `src/security/verifier.service.js` | Orchestrates payload verification |
| `src/utils/crypto.util.js` | HMAC signing, hashing, secure randomness, canonicalization |
| `docs/architecture.md` | System architecture diagrams |
| `docs/api.yaml` | OpenAPI / Swagger documentation |
| `docs/onboarding.md` | Developer onboarding documentation |

---

# 5. Local Development Requirements

Before running the backend locally, install the following:

- Node.js
- npm
- Git
- MongoDB Atlas account or local MongoDB-compatible database
- API testing tool such as Postman, Thunder Client, or curl

---

# 6. Clone the Repository

```bash
git clone <repository-url>
cd attendify-server
```

Replace `<repository-url>` with the actual GitHub repository URL.

---

# 7. Install Dependencies

```bash
npm install
```

This installs the runtime dependencies required by the backend.

Typical dependencies include:

- express
- cors
- helmet
- dotenv
- mongodb
- jsonwebtoken
- bcryptjs

---

# 8. Environment Configuration

Create a `.env` file in the root of the backend project:

```env
NODE_ENV=development
PORT=3000

MONGO_URL=your_mongodb_connection_string

JWT_SECRET=your_strong_jwt_secret
JWT_EXPIRES=7d

EDGE_SECRET=your_strong_edge_secret

APP_SECRET=your_hmac_application_secret
```

## Environment Variables Explained

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Controls development or production behavior |
| `PORT` | Local server port |
| `MONGO_URL` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign JWT tokens |
| `JWT_EXPIRES` | JWT expiration duration |
| `EDGE_SECRET` | Secret shared between Cloudflare Worker and backend |
| `APP_SECRET` | Secret used for HMAC attendance payload verification |

---

# 9. Important Security Notes About Environment Variables

Never commit `.env` to Git.

The following values must always remain secret:

```text
MONGO_URL
JWT_SECRET
EDGE_SECRET
APP_SECRET
```

Recommended `.gitignore` entries:

```gitignore
node_modules
.env
.wrangler
```

---

# 10. Start the Backend Locally

```bash
node server.js
```

Expected terminal output:

```text
Initializing Attendify backend...
MongoDB connected
Server operational
Listening on port 3000
```

Then open:

```text
http://localhost:3000/
```

Expected response:

```json
{
  "status": "OK",
  "system": "Attendify Backend",
  "uptime": 123.45
}
```

---

# 11. Production Runtime Model

In production, clients should not call the Railway backend URL directly.

The correct public entry point is the Cloudflare Worker URL.

```text
Client → Cloudflare Worker → Attendify Backend
```

The backend validates:

```text
x-attendify-secret
```

This header is injected by the Cloudflare Worker.

Clients should never know or send this secret manually.

---

# 12. Request Flow

```mermaid
flowchart TD
    A[Client Request]
    B[Cloudflare Worker]
    C[Inject EDGE_SECRET]
    D[Backend Middleware]
    E[Validate Gateway]
    F[Route Handler]
    G[Database or Security Engine]
    H[Response]

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
```

---

# 13. Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant Worker
    participant Backend
    participant DB

    Client->>Worker: POST /auth/login
    Worker->>Backend: Forward login request
    Backend->>DB: Find company by email
    DB-->>Backend: Company record
    Backend->>Backend: Compare bcrypt password hash
    Backend->>Backend: Generate JWT
    Backend-->>Worker: JWT response
    Worker-->>Client: JWT response
```

---

# 14. JWT Usage

After login, the backend returns a JWT token.

Use the token in protected requests:

```http
Authorization: Bearer <JWT_TOKEN>
```

Example protected request:

```http
GET /company/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

---

# 15. Registration Flow

```text
POST /auth/register
```

Example request body:

```json
{
  "name": "acme",
  "email": "admin@acme.com",
  "password": "strongpassword"
}
```

Expected success response:

```json
{
  "success": true,
  "message": "Company registered successfully"
}
```

---

# 16. Login Flow

```text
POST /auth/login
```

Example request body:

```json
{
  "email": "admin@acme.com",
  "password": "strongpassword"
}
```

Expected success response:

```json
{
  "success": true,
  "token": "JWT_TOKEN"
}
```

---

# 17. Company Profile Flow

```text
GET /company/profile
```

Required header:

```http
Authorization: Bearer <JWT_TOKEN>
```

Expected response:

```json
{
  "success": true,
  "company": {
    "id": "company-uuid",
    "email": "admin@acme.com"
  }
}
```

---

# 18. Full Company Data Flow

```text
GET /company/me
```

Required header:

```http
Authorization: Bearer <JWT_TOKEN>
```

This endpoint returns database-backed company data.

Sensitive fields such as `password` and `apiKey` must not be returned.

---

# 19. Company Lookup Flow

```text
GET /company/lookup/{name}
```

Example:

```text
GET /company/lookup/acme
```

Expected response if found:

```json
{
  "exists": true,
  "company": {
    "id": "company-uuid",
    "name": "acme"
  }
}
```

Expected response if not found:

```json
{
  "exists": false
}
```

---

# 20. Secure Attendance Flow

Attendance submission is cryptographically protected.

The client must:

1. Request a nonce
2. Build an attendance payload
3. Canonicalize the payload
4. Sign the canonicalized payload using HMAC-SHA256
5. Send the payload and signature to the backend

---

# 21. Attendance Security Sequence

```mermaid
sequenceDiagram
    participant Client
    participant Worker
    participant Backend
    participant Verifier

    Client->>Worker: GET /nonce
    Worker->>Backend: Forward nonce request
    Backend-->>Worker: Nonce object
    Worker-->>Client: Nonce object

    Client->>Client: Build payload
    Client->>Client: Canonicalize payload
    Client->>Client: Sign payload

    Client->>Worker: POST /attendance
    Worker->>Backend: Forward signed request
    Backend->>Verifier: verifyRequest(payload, signature)

    Verifier->>Verifier: Validate nonce
    Verifier->>Verifier: Check replay store
    Verifier->>Verifier: Verify HMAC signature

    Verifier-->>Backend: OK or FAIL
    Backend-->>Worker: Response
    Worker-->>Client: Response
```

---

# 22. Get Nonce

```text
GET /nonce
```

Expected response:

```json
{
  "success": true,
  "nonce": {
    "value": "8f2d88d30b67b9e51c7a6f4d1b2c3e9a0",
    "issuedAt": 1710000000000,
    "expiresAt": 1710000300000
  }
}
```

---

# 23. Build Attendance Payload

Example payload:

```json
{
  "userId": "employee-123",
  "timestamp": 1710000000000,
  "location": {
    "lat": 25.2048,
    "lng": 55.2708
  },
  "nonce": {
    "value": "8f2d88d30b67b9e51c7a6f4d1b2c3e9a0",
    "issuedAt": 1710000000000,
    "expiresAt": 1710000300000
  }
}
```

---

# 24. Sign Attendance Payload

The payload must be canonicalized before signing.

Conceptual formula:

```text
signature = HMAC_SHA256(canonicalize(payload), APP_SECRET)
```

The backend uses the same deterministic canonicalization logic before verification.

---

# 25. Submit Attendance

```text
POST /attendance
```

Example request body:

```json
{
  "payload": {
    "userId": "employee-123",
    "timestamp": 1710000000000,
    "location": {
      "lat": 25.2048,
      "lng": 55.2708
    },
    "nonce": {
      "value": "8f2d88d30b67b9e51c7a6f4d1b2c3e9a0",
      "issuedAt": 1710000000000,
      "expiresAt": 1710000300000
    }
  },
  "signature": "1f2a9c4e8b88adcc71b7e40f6f0d8d0d8f1e4e9c5a3b2c1d0e9f8a7b6c5d4e3f"
}
```

Expected success response:

```json
{
  "success": true,
  "message": "Attendance recorded successfully",
  "data": {
    "userId": "employee-123",
    "timestamp": 1710000000000,
    "location": {
      "lat": 25.2048,
      "lng": 55.2708
    }
  }
}
```

---

# 26. Cryptographic Verification Pipeline

```mermaid
flowchart TD
    A[Incoming Attendance Request]
    B[Extract Payload and Signature]
    C[Validate Payload Structure]
    D[Validate Nonce Expiration]
    E[Check Replay Store]
    F[Canonicalize Payload]
    G[Recompute HMAC Signature]
    H[Timing Safe Compare]
    I[Accept]
    X[Reject]

    A --> B
    B --> C
    C --> D
    D -->|Expired| X
    D -->|Valid| E
    E -->|Replay| X
    E -->|First Use| F
    F --> G
    G --> H
    H -->|Match| I
    H -->|Mismatch| X
```

---

# 27. Security Model

Attendify applies layered security.

| Layer | Security Control |
|---|---|
| Transport | HTTPS |
| Edge | Cloudflare Worker |
| Gateway | EDGE_SECRET validation |
| Identity | JWT |
| Passwords | bcrypt |
| Integrity | HMAC-SHA256 |
| Freshness | Nonce |
| Replay Defense | Replay store |
| Headers | Helmet |
| Data Access | Tenant-scoped logic |

---

# 28. Zero-Trust Principle

Attendify follows this rule:

```text
Never trust input.
Always verify identity.
Always verify integrity.
Always verify freshness.
Reject by default.
```

---

# 29. Common Errors and Fixes

| Error | Meaning | Fix |
|---|---|---|
| `403 Access denied` | Missing or invalid EDGE_SECRET | Use Worker URL, not direct backend URL |
| `401 Unauthorized` | Missing or invalid JWT | Login again and send Bearer token |
| `Invalid signature` | Payload signature mismatch | Use canonicalize before signing |
| `Replay attack detected` | Nonce reused | Request a new nonce |
| `Nonce expired` | Nonce TTL exceeded | Request a new nonce |

---

# 30. Testing Checklist

## Health Check

```text
GET /
```

Expected:

```json
{
  "status": "OK"
}
```

## Register

```text
POST /auth/register
```

## Login

```text
POST /auth/login
```

## Profile

```text
GET /company/profile
Authorization: Bearer <JWT>
```

## Nonce

```text
GET /nonce
```

## Attendance

```text
POST /attendance
```

---

# 31. Recommended Testing Order

```text
1. GET /
2. POST /auth/register
3. POST /auth/login
4. GET /company/profile
5. GET /nonce
6. POST /attendance
```

---

# 32. Git Workflow

Before committing changes:

```bash
git status
```

Stage changes:

```bash
git add .
```

Commit changes:

```bash
git commit -m "docs: finalize onboarding guide"
```

Push changes:

```bash
git push
```

---

# 33. Deployment Workflow

Backend deployment is Git-driven.

Typical flow:

```text
Developer changes code
        ↓
git push
        ↓
Railway deploys backend
        ↓
Cloudflare Worker routes traffic
        ↓
MongoDB stores data
```

---

# 34. Production Access Rules

In production:

- Use the Cloudflare Worker URL as the public API endpoint.
- Do not use the Railway backend URL directly from clients.
- Store secrets only in environment variables.
- Never commit `.env`.
- Never log JWT tokens.
- Never log passwords.
- Never log HMAC secrets.
- Never log EDGE_SECRET.

---

# 35. Observability Guidelines

Production systems should track:

- Request count
- Request latency
- Error rate
- Login failures
- JWT validation failures
- Signature validation failures
- Replay attack detections
- Nonce issuance count
- Database latency

---

# 36. Logging Guidelines

Logs must be structured, useful, and safe.

Recommended log fields:

```json
{
  "timestamp": "2026-05-13T09:00:00.000Z",
  "level": "info",
  "event": "attendance_verification",
  "success": true,
  "companyId": "company-uuid",
  "requestId": "request-id"
}
```

Do not log:

```text
password
JWT_SECRET
EDGE_SECRET
APP_SECRET
raw JWT tokens
raw passwords
```

---

# 37. Developer Security Rules

Every developer must follow these rules:

1. Validate every input.
2. Trust identity only from verified JWT.
3. Never trust company ID from request body.
4. Never store plaintext passwords.
5. Never bypass nonce verification.
6. Never disable signature verification in production.
7. Never expose internal secrets in responses.
8. Never return stack traces to clients.

---

# 38. Performance Considerations

Attendify is designed for efficient request handling.

Key performance properties:

- Stateless backend enables horizontal scaling.
- JWT avoids server-side session lookup.
- Nonce lookup is O(1) in memory.
- MongoDB queries should be indexed by email and company ID.
- Cloudflare Worker reduces direct backend exposure.

Recommended indexes:

```text
companies.email
companies.id
companies.name
```

---

# 39. Future Improvements

Recommended future enhancements:

- Redis-backed replay store for distributed scaling
- Rate limiting at Worker and backend levels
- Refresh token rotation
- RBAC roles and permissions
- Immutable audit logging
- OpenTelemetry tracing
- Centralized metrics dashboard
- Postman collection generation
- SDK generation from OpenAPI

---

# 40. Final Developer Summary

Attendify backend is built around the following principles:

```text
Security first
Stateless by default
Edge protected
Cryptographically verified
Tenant isolated
Observable in production
```

A developer joining this project should understand:

- How requests enter the system
- How authentication works
- How the Worker protects the backend
- How nonce and HMAC protect attendance evidence
- How company identity is isolated
- How to test and deploy safely

---

# 🏁 END OF DOCUMENT