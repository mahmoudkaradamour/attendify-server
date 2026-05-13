#  Attendify Architecture Diagrams

## Enterprise Architecture Documentation for a Cloud-Native Secure SaaS Platform

This document describes the technical architecture of **Attendify**, a secure, distributed, cloud-native SaaS backend system designed for company identity management, secure authentication, edge-based routing, cryptographic request verification, replay protection, and multi-tenant isolation.

---

# 1. Architecture Goals

Attendify is designed around the following architectural goals:

- Provide a secure identity and routing layer for companies.
- Keep employee data ownership outside the central Attendify backend.
- Protect the core backend behind an edge gateway.
- Apply Zero-Trust principles to all external requests.
- Support cryptographic request verification using HMAC, Nonce, and replay prevention.
- Enable horizontal scalability using stateless backend services.
- Provide production-grade observability through logs, metrics, traces, and audit events.

---

# 2. High-Level System Architecture

The following diagram shows the primary runtime flow from a mobile client to the database layer.

```mermaid
flowchart TD
    Client[Flutter Mobile Client]
    Worker[Cloudflare Worker - Edge Gateway]
    Backend[Node.js Backend - Attendify Core API]
    Database[(MongoDB Atlas - Company Registry)]

    Client -->|HTTPS Request| Worker
    Worker -->|Forwarded Request with Edge Secret| Backend
    Backend -->|Database Query| Database
    Database -->|Query Result| Backend
    Backend -->|JSON Response| Worker
    Worker -->|Response| Client
```

## Explanation

The system is structured as an edge-mediated backend architecture.  
The client never communicates directly with the core backend for operational API calls. Instead, all traffic is routed through the Cloudflare Worker, which acts as an edge security gateway.

The backend is responsible for authentication, authorization, company routing, nonce issuance, cryptographic verification, and interaction with MongoDB Atlas.

---

# 3. C4 Model - Level 1: System Context Diagram

The C4 Context Diagram shows Attendify as a system within its external environment.

```mermaid
flowchart TD
    User[Mobile User]
    CompanyAdmin[Company Admin]
    CompanyBackend[External Company Backend]
    Attendify[Attendify Platform]
    MongoDB[(MongoDB Atlas)]
    Cloudflare[Cloudflare Edge Network]

    User -->|Uses mobile app| Attendify
    CompanyAdmin -->|Registers and manages company| Attendify
    Attendify -->|Routes employee context| CompanyBackend
    Attendify -->|Stores company identity data| MongoDB
    Cloudflare -->|Protects and routes traffic| Attendify
```

## Explanation

At the highest level, Attendify acts as a secure platform for:

- Company registration.
- Company authentication.
- Secure routing between employees and company systems.
- Cryptographic request verification.
- Company identity storage.

Attendify does not act as the owner of employee business data. Instead, company-specific employee data remains under the control of each external company backend.

---

# 4. C4 Model - Level 2: Container Diagram

The Container Diagram breaks the system into deployable runtime units.

```mermaid
flowchart TD
    subgraph ClientContainer[Client Container]
        Flutter[Flutter Mobile App]
    end

    subgraph EdgeContainer[Edge Container]
        Worker[Cloudflare Worker]
    end

    subgraph BackendContainer[Backend Container]
        Express[Express API Server]
        Auth[Authentication Routes]
        Company[Company Routes]
        Nonce[Nonce Controller]
        Attendance[Attendance Controller]
        Verifier[Verifier Service]
        Crypto[Crypto Utilities]
        Replay[Replay Store]
    end

    subgraph DataContainer[Data Container]
        Mongo[(MongoDB Atlas)]
    end

    Flutter --> Worker
    Worker --> Express

    Express --> Auth
    Express --> Company
    Express --> Nonce
    Express --> Attendance

    Attendance --> Verifier
    Verifier --> Crypto
    Verifier --> Replay

    Auth --> Mongo
    Company --> Mongo
    Attendance --> Mongo
```

## Explanation

The system is divided into four primary containers:

1. **Flutter Mobile App**  
   Responsible for user interaction, request preparation, nonce usage, and signed attendance submission.

2. **Cloudflare Worker**  
   Responsible for edge routing, gateway protection, secret injection, and resilience handling.

3. **Express Backend**  
   Responsible for authentication, company operations, nonce issuance, and secure attendance validation.

4. **MongoDB Atlas**  
   Responsible for persistent company identity storage and future audit/event records.

---

# 5. C4 Model - Level 3: Backend Component Diagram

This diagram focuses on the internal structure of the Node.js backend.

```mermaid
flowchart TD
    Server[server.js - Composition Root]

    AuthRoutes[routes/auth.js]
    CompanyRoutes[routes/company.js]
    AuthMiddleware[middleware/auth.js]

    NonceController[src/api/nonce.controller.js]
    AttendanceController[src/api/attendance.controller.js]

    NonceService[src/security/nonce.service.js]
    ReplayStore[src/security/replay.store.js]
    VerifierService[src/security/verifier.service.js]
    CryptoUtil[src/utils/crypto.util.js]

    DB[db.js - MongoDB Connector]
    Mongo[(MongoDB Atlas)]

    Server --> AuthRoutes
    Server --> CompanyRoutes
    Server --> NonceController
    Server --> AttendanceController

    CompanyRoutes --> AuthMiddleware

    NonceController --> NonceService
    AttendanceController --> VerifierService

    VerifierService --> NonceService
    VerifierService --> ReplayStore
    VerifierService --> CryptoUtil

    Server --> DB
    DB --> Mongo
    AuthRoutes --> Mongo
    CompanyRoutes --> Mongo
```

## Explanation

The backend follows a modular architecture:

- `server.js` acts as the composition root.
- `routes/auth.js` handles registration and login.
- `routes/company.js` handles protected company operations.
- `middleware/auth.js` validates JWT tokens.
- `nonce.controller.js` issues nonce values.
- `attendance.controller.js` receives signed attendance requests.
- `verifier.service.js` orchestrates signature, nonce, and replay checks.
- `crypto.util.js` provides hashing, signing, verification, randomness, and canonicalization.
- `replay.store.js` prevents reuse of nonce values.

---

# 6. Zero-Trust Security Architecture

The following diagram describes the Zero-Trust validation pipeline.

```mermaid
flowchart TD
    Request[Incoming Request]
    Edge[Cloudflare Worker]
    Secret[Inject x-attendify-secret]
    Backend[Backend Middleware]
    ValidateSecret{Valid EDGE_SECRET?}
    VerifyJWT{Valid JWT?}
    VerifySignature{Valid HMAC Signature?}
    ValidateNonce{Valid Nonce and Timestamp?}
    ReplayCheck{Nonce Used Before?}
    Accept[Accept Request]
    Reject[Reject Request]

    Request --> Edge
    Edge --> Secret
    Secret --> Backend
    Backend --> ValidateSecret

    ValidateSecret -->|No| Reject
    ValidateSecret -->|Yes| VerifyJWT

    VerifyJWT -->|No| Reject
    VerifyJWT -->|Yes| VerifySignature

    VerifySignature -->|No| Reject
    VerifySignature -->|Yes| ValidateNonce

    ValidateNonce -->|No| Reject
    ValidateNonce -->|Yes| ReplayCheck

    ReplayCheck -->|Yes| Reject
    ReplayCheck -->|No| Accept
```

## Explanation

The backend uses a deny-by-default model.  
A request is accepted only after passing multiple independent checks:

1. Edge secret validation.
2. JWT validation.
3. HMAC signature validation.
4. Nonce freshness validation.
5. Replay protection.

This layered security model reduces the probability that a single failure compromises the entire system.

---

# 7. Authentication Flow

This diagram describes how a company authenticates and receives a JWT.

```mermaid
sequenceDiagram
    participant Client as Client
    participant Worker as Cloudflare Worker
    participant Backend as Express Backend
    participant DB as MongoDB

    Client->>Worker: POST /auth/login
    Worker->>Backend: Forward request with edge secret
    Backend->>DB: Find company by email
    DB-->>Backend: Company document
    Backend->>Backend: Compare bcrypt password hash
    Backend->>Backend: Generate signed JWT
    Backend-->>Worker: JWT response
    Worker-->>Client: JWT response
```

## Explanation

Authentication is stateless.  
After successful login, the backend returns a signed JWT.  
The client uses this token in the `Authorization` header for protected routes.

---

# 8. Company Registration Flow

```mermaid
sequenceDiagram
    participant Client as Client
    participant Worker as Cloudflare Worker
    participant Backend as Express Backend
    participant DB as MongoDB

    Client->>Worker: POST /auth/register
    Worker->>Backend: Forward request
    Backend->>Backend: Validate input
    Backend->>Backend: Normalize email
    Backend->>DB: Check existing company
    DB-->>Backend: Result
    Backend->>Backend: Hash password using bcrypt
    Backend->>DB: Insert company document
    DB-->>Backend: Insert success
    Backend-->>Worker: Registration response
    Worker-->>Client: Registration response
```

## Explanation

The registration flow protects passwords through one-way hashing.  
The database stores hashed passwords, not plaintext passwords.

---

# 9. Secure Attendance Flow

The attendance flow uses nonce-based freshness and HMAC-based payload integrity.

```mermaid
sequenceDiagram
    participant Client as Flutter Client
    participant Worker as Cloudflare Worker
    participant Backend as Express Backend
    participant Verifier as Verifier Service

    Client->>Worker: GET /nonce
    Worker->>Backend: Forward nonce request
    Backend-->>Worker: Nonce object
    Worker-->>Client: Nonce object

    Client->>Client: Build attendance payload
    Client->>Client: Canonicalize payload
    Client->>Client: Sign payload using HMAC

    Client->>Worker: POST /attendance
    Worker->>Backend: Forward signed request
    Backend->>Verifier: verifyRequest(payload, signature)

    Verifier->>Verifier: Validate nonce expiration
    Verifier->>Verifier: Check replay store
    Verifier->>Verifier: Canonicalize payload
    Verifier->>Verifier: Verify HMAC signature

    Verifier-->>Backend: Verification result
    Backend-->>Worker: Accepted or rejected response
    Worker-->>Client: Final response
```

## Explanation

This flow prevents:

- Payload tampering.
- Replay attacks.
- Delayed request injection.
- Unauthorized attendance submission.

---

# 10. Cryptographic Verification Pipeline

```mermaid
flowchart TD
    A[Incoming Signed Request]
    B[Extract Payload and Signature]
    C[Validate Payload Structure]
    D[Validate Nonce Expiration]
    E[Check Replay Store]
    F[Canonicalize Payload]
    G[Recompute HMAC Signature]
    H[Timing-Safe Signature Compare]
    I[Accept]
    X[Reject]

    A --> B --> C --> D
    D -->|Expired| X
    D -->|Valid| E

    E -->|Reused| X
    E -->|First Use| F

    F --> G --> H
    H -->|Match| I
    H -->|Mismatch| X
```

## Explanation

The backend canonicalizes the received payload before signature verification.  
This ensures that both client and server compute the signature over the same deterministic representation.

The signature comparison uses timing-safe comparison to reduce timing attack risk.

---

# 11. Multi-Tenant Isolation Model

```mermaid
flowchart TD
    CompanyA[Company A Request]
    CompanyB[Company B Request]
    JWT[JWT Identity Context]
    Backend[Backend Tenant-Aware Logic]
    DB[(Shared MongoDB Collections)]

    CompanyA --> JWT
    CompanyB --> JWT

    JWT --> Backend

    Backend -->|Query with company id A| DB
    Backend -->|Query with company id B| DB
```

## Explanation

Multi-tenancy is enforced by deriving the tenant identity from a verified JWT, not from client-provided request fields.

Every protected route must use `req.company.id` as the trusted tenant context.

---

# 12. Deployment Architecture

The deployment architecture separates edge execution, backend execution, and database persistence.

```mermaid
flowchart TD
    Dev[Developer Workstation]
    GitHub[GitHub Repository]
    CFDeploy[Cloudflare Worker Deployment]
    RailwayDeploy[Railway Backend Deployment]

    Worker[Cloudflare Worker]
    Backend[Railway Node.js Service]
    Mongo[(MongoDB Atlas)]

    Dev -->|git push| GitHub

    GitHub -->|auto deploy worker| CFDeploy
    GitHub -->|auto deploy backend| RailwayDeploy

    CFDeploy --> Worker
    RailwayDeploy --> Backend

    Worker --> Backend
    Backend --> Mongo
```

## Explanation

The system follows a Git-driven deployment model.

- Worker updates are deployed through Cloudflare integration.
- Backend updates are deployed through Railway.
- MongoDB Atlas remains managed and independent.

This improves reproducibility, auditability, and rollback capability.

---

# 13. Production Runtime Deployment

```mermaid
flowchart LR
    Users[Global Users]
    Edge[Cloudflare Edge Network]
    Backend1[Backend Instance 1]
    Backend2[Backend Instance 2]
    BackendN[Backend Instance N]
    MongoPrimary[(MongoDB Primary)]
    MongoSecondary1[(MongoDB Secondary)]
    MongoSecondary2[(MongoDB Secondary)]

    Users --> Edge
    Edge --> Backend1
    Edge --> Backend2
    Edge --> BackendN

    Backend1 --> MongoPrimary
    Backend2 --> MongoPrimary
    BackendN --> MongoPrimary

    MongoPrimary -. Replication .-> MongoSecondary1
    MongoPrimary -. Replication .-> MongoSecondary2
```

## Explanation

The backend is stateless and can be scaled horizontally.  
MongoDB Atlas provides persistence, replication, and managed availability.

---

# 14. Observability Architecture

Observability is divided into logs, metrics, traces, and audit events.

```mermaid
flowchart TD
    Client[Client]
    Worker[Cloudflare Worker]
    Backend[Express Backend]
    DB[(MongoDB)]

    Logs[Centralized Logs]
    Metrics[Metrics System]
    Traces[Distributed Tracing]
    Audit[Audit Event Store]
    Alerts[Alerting System]
    Dashboard[Monitoring Dashboard]

    Client --> Worker --> Backend --> DB

    Worker --> Logs
    Backend --> Logs
    Backend --> Metrics
    Backend --> Traces
    Backend --> Audit

    Logs --> Dashboard
    Metrics --> Dashboard
    Traces --> Dashboard
    Audit --> Dashboard

    Metrics --> Alerts
    Logs --> Alerts
```

## Explanation

Observability allows operators to answer:

- What happened?
- Where did it happen?
- How long did it take?
- Was the request legitimate?
- Was the failure caused by client, edge, backend, or database?

Audit events are especially important for attendance and security-sensitive operations.

---

# 15. Logging Flow

```mermaid
sequenceDiagram
    participant Worker as Cloudflare Worker
    participant Backend as Express Backend
    participant Logger as Log System
    participant Monitor as Monitoring Dashboard

    Worker->>Logger: Edge request log
    Backend->>Logger: API request log
    Backend->>Logger: Security validation log
    Backend->>Logger: Error log

    Logger-->>Monitor: Searchable structured logs
```

## Explanation

Logs should be structured and avoid leaking secrets.  
Sensitive values such as JWTs, passwords, HMAC keys, and EDGE_SECRET must never be logged.

---

# 16. Metrics Flow

```mermaid
flowchart TD
    Backend[Backend]
    Metrics[Metrics Collector]
    Dashboard[Dashboard]
    Alerts[Alert Rules]

    Backend -->|Request Count| Metrics
    Backend -->|Latency| Metrics
    Backend -->|Error Rate| Metrics
    Backend -->|Auth Failures| Metrics
    Backend -->|Replay Rejections| Metrics

    Metrics --> Dashboard
    Metrics --> Alerts
```

## Explanation

Important production metrics include:

- Request rate.
- Error rate.
- Authentication failure rate.
- Signature verification failure rate.
- Replay rejection count.
- Database latency.
- Worker-to-backend latency.

---

# 17. Audit Logging Architecture

```mermaid
flowchart TD
    Attendance[Attendance Submission]
    Verifier[Verifier Service]
    AuditLogger[Audit Logger]
    AuditStore[(Immutable Audit Store)]
    SecurityReview[Security Review]

    Attendance --> Verifier
    Verifier -->|Accepted| AuditLogger
    Verifier -->|Rejected| AuditLogger

    AuditLogger --> AuditStore
    AuditStore --> SecurityReview
```

## Explanation

Audit logs should record security-relevant events such as:

- Nonce issuance.
- Attendance acceptance.
- Attendance rejection.
- Replay detection.
- Invalid signature detection.
- Gateway validation failures.

Audit logs should be append-only where possible.

---

# 18. Failure and Resilience Architecture

```mermaid
flowchart TD
    Client[Client]
    Worker[Cloudflare Worker]
    Backend[Backend]
    DB[(MongoDB)]
    Fallback[Controlled Error Response]
    Retry[Retry Strategy]
    Alert[Alert Operations]

    Client --> Worker
    Worker --> Backend
    Backend --> DB

    Worker -->|Backend Timeout| Fallback
    Backend -->|Database Failure| Retry
    Retry -->|Repeated Failure| Alert
    Fallback --> Client
```

## Explanation

The Worker should fail fast when the backend is unavailable.  
The backend should return controlled errors instead of exposing stack traces.  
Repeated failures should trigger alerting.

---

# 19. Threat Model Overview

| Threat | Description | Mitigation |
|---|---|---|
| Direct backend access | Attacker bypasses Worker and calls Railway URL directly | EDGE_SECRET validation rejects requests without trusted edge header |
| Replay attack | Attacker reuses a previously valid signed request | Nonce expiration and replay store prevent reuse |
| Payload tampering | Attacker modifies location, timestamp, or identity data | HMAC signature verification detects mutation |
| Token forgery | Attacker attempts to create fake JWT | JWT secret and signature validation prevent forged tokens |
| Credential stuffing | Automated login attempts using leaked credentials | Login attempt tracking, lockout policy, and future rate limiting |
| Cross-tenant access | One tenant attempts to access another tenant's data | Tenant identity is derived from verified JWT |
| Secret leakage | Operational secret is accidentally exposed | Secret rotation and environment variable isolation |
| Database outage | Backend cannot access MongoDB | Controlled failure handling and alerting |
| Worker outage | Edge gateway cannot route traffic | Cloudflare managed availability and operational alerts |

---

# 20. Security Control Matrix

| Control | Purpose | System Location |
|---|---|---|
| HTTPS | Transport encryption | Client to Worker to Backend |
| EDGE_SECRET | Origin protection | Worker and Backend |
| JWT | Identity verification | Auth middleware |
| bcrypt | Password protection | Auth routes |
| HMAC | Payload integrity | Crypto utility and verifier |
| Nonce | Request freshness | Nonce service |
| Replay store | Replay prevention | Replay store |
| Helmet | Security headers | Express middleware |
| CORS | Controlled cross-origin access | Express middleware |
| Audit logs | Security accountability | Observability layer |

---

# 21. Final System Summary

Attendify is designed as a secure, distributed, cloud-native SaaS architecture with:

- Edge-protected backend access.
- Stateless JWT authentication.
- Cryptographic request verification.
- Nonce-based replay prevention.
- Multi-tenant isolation.
- Git-driven deployment.
- Production observability foundations.
- Horizontal scalability readiness.

---

# 22. Final Architecture Identity

```text
Attendify = Edge Gateway + Secure Identity Layer + Cryptographic Verification Engine + Multi-Tenant SaaS Backend
```

---

# 🏁 END OF DOCUMENT