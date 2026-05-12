
# 📘 Attendify Backend System
## Distributed Multi-Tenant SaaS Authentication & Routing Platform

---

# 🧭 1. System Overview

Attendify is a distributed, cloud-native backend system designed to act as:

✅ A Company Identity Registry  
✅ An Authentication Authority  
✅ A Routing Layer between employees and company backends  

---

## 🧠 Core Design Philosophy

The system intentionally avoids managing employee data directly.

Instead:

- It manages company identities
- It authenticates companies securely
- It routes employees to company-specific backends

---

## 🎯 Architectural Goal

> Decouple identity, routing, and data ownership

---

# 🧱 2. High-Level Architecture

```

\[ Flutter Client ]
↓
\[ Cloudflare Worker (API Gateway) ]
↓
\[ Node.js Backend (Attendify Server) ]
↓
\[ MongoDB Atlas (Company Registry) ]

```

---

## 🔬 Architectural Characteristics

- Stateless (JWT-based authentication)
- Multi-tenant isolation
- Horizontally scalable
- Cloud-native

---

# 🏢 3. Business Model

## ✅ Company (Tenant)

- Registers in Attendify
- Receives secure identity (JWT + API Key)
- Owns employee system externally

---

## ✅ Employee (External Actor)

- Uses mobile application
- Provides company name
- Gets routed to company backend

---

## 🔄 Interaction Flow

```

Employee → Attendify → Company Backend
↓
Analytics (optional)

```

---

## 🔐 Data Ownership Model

Attendify enforces a strict data-minimization strategy:

- Employee data is NEVER stored
- All employee operations occur in company backend
- Attendify acts only as identity + routing layer

✅ Privacy compliant  
✅ Reduced legal liability  
✅ Scalable SaaS design  

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
  "createdAt": "timestamp"
}
````

***

## 🔑 API Key Usage

Each company is assigned a secure API key.

### 🎯 Purpose

*   Backend-to-backend communication
*   Secure integration with external company systems

***

## 🔁 Integration Flow

    Company Backend → Attendify API
                ↓
    Include API Key
                ↓
    Server validates API key
                ↓
    Trusted request accepted

***

## 🔒 API Key Scope

API keys are NOT used for user authentication.

They are strictly used for:

*   Internal system integration
*   Server-to-server communication

***

# 🔐 5. Authentication Architecture

## ✅ Technologies

*   JWT (JSON Web Token)
*   bcrypt (password hashing)

***

## 🔑 Authentication Flow

    Company registers
       ↓
    Password hashed (bcrypt)
       ↓
    Login request
       ↓
    Password verification
       ↓
    JWT generated
       ↓
    Token returned to client

***

## 📊 Token Structure

    HEADER.PAYLOAD.SIGNATURE

***

## 🔐 Token Usage

    Authorization: Bearer TOKEN

***

# 📊 6. System Flow Diagrams

## 🧬 Registration

    Client → /auth/register
           → Validate input
           → Hash password
           → Store in DB

***

## 🧬 Login

    Client → /auth/login
           → Verify credentials
           → Generate JWT
           → Return token

***

## 🧬 Protected Request

    Client → Authorization Header
           → Middleware verifies JWT
           → Access granted

***

## 🧬 Employee Routing

    Employee → enters company name
            ↓
    GET /company/lookup
            ↓
    Company exists?
            ↓
    Return metadata
            ↓
    Connect to company backend

***

# 🔄 7. End-to-End System Flow

## Employee Interaction

1.  Employee opens app
2.  Enters company name
3.  Request sent to Attendify
4.  Company existence validated
5.  Client receives backend info
6.  Connects to company backend

***

## Company Interaction

1.  Register
2.  Login
3.  Receive JWT
4.  Access protected API

***

## Integration Layer

    Company Backend → Attendify → API Key Validation

***

# 🔄 8. Request Lifecycle

    Client Request
        ↓
    Cloudflare Worker (Gateway)
        ↓
    Backend (Express)
        ↓
    Middleware (JWT/Auth)
        ↓
    Route Handler
        ↓
    Database (MongoDB)
        ↓
    Response

***

# 🧩 9. Responsibility Matrix

| Component         | Responsibility           |
| ----------------- | ------------------------ |
| Flutter Client    | UI & user input          |
| Cloudflare Worker | Routing & edge security  |
| Backend (Node.js) | Authentication & logic   |
| MongoDB           | Data storage             |
| Company Backend   | Employee data management |

***

# 🔐 10. Trust Boundaries

| Layer    | Trust Level   |
| -------- | ------------- |
| Client   | Untrusted     |
| Worker   | Edge-trusted  |
| Backend  | Trusted       |
| Database | Fully trusted |

***

## 🔐 Security Principle

All external input is considered untrusted until validated by backend.

***

# 🔐 11. Security Architecture

## Layers

1.  HTTPS (transport security)
2.  JWT authentication
3.  bcrypt hashing
4.  Input validation

***

## ⚠️ Threat Model

| Threat              | Mitigation    |
| ------------------- | ------------- |
| Password leak       | bcrypt        |
| Token tampering     | JWT signature |
| Replay attack       | expiration    |
| Unauthorized access | middleware    |

***

# ⚠️ 12. Failure Handling Strategy

*   400 → Bad Request
*   401 → Unauthorized
*   404 → Not Found
*   409 → Conflict
*   500 → Internal Error

***

## System Behavior

✅ Non-crashing  
✅ Controlled responses  
✅ Errors isolated

***

# ⚡ 13. Performance Considerations

*   Stateless architecture
*   Lightweight responses
*   Index recommended on:
    *   name
    *   email

***

# 🧠 14. Multi-Tenant Design

Each company is uniquely identified by:

    company.id (JWT payload)

***

## Result

✅ Secure isolation  
✅ No cross-tenant access

***

# 🌐 15. Deployment Model

## Backend

    Railway

## API Gateway

    Cloudflare Workers

## Database

    MongoDB Atlas

***

# 📡 16. API Contract

## Register

    POST /auth/register

## Login

    POST /auth/login

## Profile

    GET /company/profile

***

# 🔄 17. Authentication Sequence

    Client → /login
    Backend → DB
    DB → Backend
    Backend → JWT
    JWT → Client

    Client → Protected Route
    Middleware → Verify JWT
    Route → Response

***

# 🔐 18. Data Privacy Model

*   No employee storage
*   Only company identity
*   External data ownership

***

# 🧠 19. Architectural Classification

This system is:

✅ Distributed System  
✅ SaaS Platform  
✅ Multi-Tenant Backend  
✅ Identity & Routing Service

***

# 🔮 20. Future Enhancements

*   Refresh tokens
*   Rate limiting
*   RBAC
*   Monitoring
*   Analytics ingestion

***

# 🏁 Conclusion

Attendify is a modern SaaS backend designed for:

*   Security-first operation
*   Distributed scalability
*   Multi-tenant isolation

***

# 🏆 Final Identity

    Distributed Identity + Routing Platform

***

# 📄 License

Private / Internal Use

***

# 🏁 END OF DOCUMENT
