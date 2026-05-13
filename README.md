# 📘 Attendify Backend System
## Distributed Multi-Tenant SaaS Authentication & Routing Platform

---

# 🧭 1. System Overview

Attendify is a **distributed, cloud-native backend system** designed as a:

- ✅ Company Identity Registry  
- ✅ Authentication Authority  
- ✅ Routing Gateway for employee → company backend communication  

---

## 🧠 Core Design Philosophy

Attendify follows a **strict separation of responsibilities**:

- Identity management is centralized
- Business data is decentralized
- Routing is abstracted

---

## 🎯 Architectural Goal

> Decouple identity, routing, and data ownership into independent, scalable layers.

---

# 🧱 2. High-Level Architecture

```

\[ Flutter Client ]
↓
\[ Cloudflare Worker (Edge Gateway) ]
↓
\[ Node.js Backend (Attendify Core) ]
↓
\[ MongoDB Atlas (Company Registry) ]

```

---

## 🔬 Architectural Characteristics

- Stateless authentication (JWT-based)
- Multi-tenant isolation
- Horizontally scalable
- Edge-accelerated routing (Cloudflare)
- Zero-trust model

---

# 🏢 3. Business Model

## ✅ Company (Tenant)

- Registers in Attendify
- Receives identity credentials (JWT + API Key)
- Owns and manages employees independently

---

## ✅ Employee (External Actor)

- Uses mobile application (Flutter)
- Inputs company identifier
- Gets routed to company-specific backend

---

## 🔄 Interaction Flow

```

Employee → Attendify → Company Backend
↓
(Optional Analytics Layer)

```

---

## 🔐 Data Ownership Model

Attendify enforces **strict data minimization**:

- ❌ No employee storage
- ✅ Company-only identity registry
- ✅ External backend ownership

**Benefits:**

- ✅ GDPR-friendly
- ✅ Reduced legal liability
- ✅ High scalability

---

# 🗄️ 4. Database Design

## ✅ Database

```

attendify

```

---

## ✅ Collection

```

companies

````

---

## ✅ Data Model

```json
{
  "id": "uuid",
  "name": "company_name",
  "email": "email",
  "password": "hashed_password",
  "apiKey": "secure_random_key",
  "createdAt": "timestamp",
  "status": "active|deleted",
  "loginAttempts": 0,
  "lockUntil": null
}
````

***

## 🔑 API Key Design

### 🎯 Purpose

*   Server-to-server authentication
*   Integration with external company systems

***

## 🔁 API Key Flow

    Company Backend → Attendify API
            ↓
    Include API Key in request
            ↓
    Backend validates key
            ↓
    Trusted execution

***

## 🔒 Scope

API keys are:

*   ✅ NOT used for user authentication
*   ✅ Used only for backend integration

***

# 🔐 5. Authentication Architecture

## ✅ Stack

*   JWT (JSON Web Tokens)
*   bcrypt (password hashing)

***

## 🔑 Authentication Flow

    Register → Hash Password → Store
            ↓
    Login → Verify Password
            ↓
    Generate JWT
            ↓
    Return token

***

## 📊 Token Structure

    HEADER.PAYLOAD.SIGNATURE

***

## 🔐 Usage

    Authorization: Bearer <JWT>

***

# 🔐 6. Advanced Security Layer (Evidence System)

## ✅ Components

*   Cryptographic Signing (HMAC-SHA256)
*   Nonce System (freshness)
*   Replay Protection Store
*   Deterministic Canonicalization

***

## 📊 Secure Request Flow

    Client:
      → generate nonce
      → build payload
      → canonicalize
      → sign payload

    Worker:
      → inject secret header

    Backend:
      → validate secret
      → verify signature
      → validate nonce
      → prevent replay

***

## 🔐 Security Guarantees

*   ✅ Non-replayable requests
*   ✅ Tamper detection
*   ✅ Authentic client verification
*   ✅ Deterministic validation

***

# 📊 7. Core System Flows

## 🧬 Registration

    POST /auth/register
     → validate input
     → hash password
     → store company

***

## 🧬 Login

    POST /auth/login
     → verify credentials
     → generate JWT
     → return token

***

## 🧬 Protected Access

    Request → JWT Middleware → Authorized

***

## 🧬 Employee Routing

    GET /company/lookup/:name
     → check existence
     → return minimal metadata
     → client redirects to company backend

***

# 🔄 8. End-to-End Flow

## Employee Journey

1.  Open app
2.  Enter company name
3.  Request → Attendify
4.  Validate company
5.  Return routing info
6.  Connect to company backend

***

## Company Journey

1.  Register
2.  Login
3.  Receive JWT
4.  Access system

***

## Integration Layer

    Company Backend → API Key → Attendify

***

# 🔄 9. Request Lifecycle

    Client
      ↓
    Cloudflare Worker
      ↓
    Express Backend
      ↓
    Zero-Trust Middleware
      ↓
    Route Handler
      ↓
    Database
      ↓
    Response

***

# 🧩 10. Responsibility Matrix

| Component         | Responsibility                  |
| ----------------- | ------------------------------- |
| Flutter Client    | UI + request signing            |
| Cloudflare Worker | Edge routing + gateway security |
| Backend           | Auth + verification + logic     |
| MongoDB           | Company storage                 |
| Company Backend   | Employee data management        |

***

# 🔐 11. Trust Boundaries

| Layer    | Trust Level     |
| -------- | --------------- |
| Client   | Untrusted       |
| Worker   | Controlled Edge |
| Backend  | Trusted         |
| Database | Highly Trusted  |

***

## 🔒 Security Principle

> All input is untrusted until cryptographically verified.

***

# 🔐 12. Threat Model

| Threat              | Mitigation               |
| ------------------- | ------------------------ |
| Password leaks      | bcrypt hashing           |
| Token tampering     | JWT signature            |
| Replay attacks      | nonce + replay store     |
| MITM tampering      | HMAC signature           |
| Unauthorized access | middleware + Edge Secret |

***

# ⚠️ 13. Failure Strategy

| Code | Meaning        |
| ---- | -------------- |
| 400  | Bad request    |
| 401  | Unauthorized   |
| 403  | Forbidden      |
| 404  | Not found      |
| 409  | Conflict       |
| 500  | Internal error |

***

# ⚡ 14. Performance Model

*   Stateless architecture
*   O(1) nonce checks
*   Lightweight payloads
*   Indexed queries (email, name)

***

# 🧠 15. Multi-Tenant Isolation

Each tenant is identified by:

    company.id

***

## ✅ Result

*   ✅ No cross-tenant access
*   ✅ Strong isolation
*   ✅ Scalable architecture

***

# 🌐 16. Deployment Model

| Component | Platform           |
| --------- | ------------------ |
| Backend   | Railway            |
| Gateway   | Cloudflare Workers |
| Database  | MongoDB Atlas      |

***

# 📡 17. API Contract

    POST /auth/register
    POST /auth/login
    GET  /company/profile
    GET  /company/me
    GET  /company/lookup/:name
    PUT  /company/update
    DELETE /company/delete
    POST /attendance
    GET  /nonce

***

# 🔐 18. Data Privacy Model

*   No employee storage
*   Only company identity
*   Externalized data ownership

***

# 🧠 19. System Classification

Attendify is:

*   ✅ SaaS Platform
*   ✅ Distributed System
*   ✅ Identity Service
*   ✅ Secure API Gateway Layer

***

# 🔮 20. Future Enhancements

*   ✅ Refresh tokens
*   ✅ Rate limiting (edge + backend)
*   ✅ RBAC system
*   ✅ Observability (logs + metrics)
*   ✅ Distributed cache (Redis)

***

# 🏁 Conclusion

Attendify represents a **modern, production-grade SaaS architecture** optimized for:

*   Security-first operation
*   Global scalability
*   Clear separation of responsibilities

***

# 🏆 Final Identity

    Distributed Identity + Routing Platform

***

# 📄 License

Private / Internal Use

***

# 🏁 END OF DOCUMENT
