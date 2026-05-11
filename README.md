
# 📘 Attendify Backend System
## Distributed Multi-Tenant SaaS Authentication & Routing Platform

---

# 🧭 1. System Overview

Attendify is a distributed, cloud-native backend system designed to act as:

✅ A Company Identity Registry  
✅ An Authentication Authority  
✅ A Routing Layer between employees and company systems  

---

## 🧠 Core Design Philosophy

The system intentionally avoids managing employee data directly.

Instead:

- It manages company identities
- It authenticates companies securely
- It routes employees to their respective company backends

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
- Multi-tenant safe
- Horizontally scalable
- Cloud-native

---

# 🏢 3. Business Model

## ✅ Company (Tenant)

- Registers in the system
- Receives secure identity credentials
- Owns its employee infrastructure externally

---

## ✅ Employee (External Actor)

- Uses mobile application
- Provides company identifier
- Gets routed to company-specific backend

---

## 🔄 Interaction Flow

```

Employee → Attendify → Company Backend
↓
Analytics (optional)

```

---

## ⚠️ Data Ownership Principle

❗ Employee data is NOT stored in Attendify  
✅ Only company metadata is stored  

---

# 🔐 4. Authentication Architecture

## ✅ Technologies

- JSON Web Tokens (JWT)
- bcrypt (Password hashing)

---

## 🔑 Authentication Flow

```

1.  Company registers
2.  Password is hashed (bcrypt)
3.  Company logs in
4.  Server creates JWT token
5.  Client stores token
6.  Token sent with each request

```

---

## 📊 Token Structure

```

HEADER.PAYLOAD.SIGNATURE

```

---

## 🧠 Security Role

- Ensures identity integrity
- Enables stateless sessions
- Supports distributed deployments

---

# 🗄️ 5. Database Design

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
## 🔐 Data Ownership Model

Attendify enforces strict data isolation principles:

- Employee data is NEVER stored within Attendify
- All employee-related operations are executed within company systems
- Attendify acts only as a routing and authentication layer

This design ensures:

✅ Privacy compliance  
✅ Reduced legal exposure  
✅ Scalable architecture  
🔑 API Key Usage
Each company is assigned a secure API key.
🎯 Purpose

Backend-to-backend communication
Secure integration with external company systems


🧠 Architectural Role
The API key acts as a secondary identity mechanism used for:

Server-to-server authentication
Integration layer between Attendify and company backends
Future secure API validation


🔐 Security Notes

API keys must remain confidential
They should never be exposed to client-side applications
Recommended to rotate periodically in production systems
***

## 🔬 Design Justification

*   No employee data (privacy-first)
*   Minimal dataset (optimized performance)
*   Non-relational schema (flexible scaling)

***
## 🔁 Integration Flow

Company Backend → Attendify API
            ↓
Include API Key
            ↓
Server validates API key
            ↓
Trusted request accepted


# 🔐 6. Security Architecture

## 📦 Multi-Layer Security Model

### Layer 1 — Transport Security

    HTTPS (Cloudflare + Railway)

***

### Layer 2 — Authentication

    JWT verification via middleware

***

### Layer 3 — Credential Protection

    bcrypt hashing (salted + adaptive)

***

### Layer 4 — Application Validation

    Input validation + controlled updates

***

## ⚠️ Threat Model

| Threat              | Mitigation             |
| ------------------- | ---------------------- |
| Password leakage    | bcrypt hashing         |
| Token tampering     | signature verification |
| Replay attack       | expiration             |
| Unauthorized access | auth middleware        |

***

# 📊 7. System Flow Diagrams

## 🧬 Registration

    Client
      ↓
    POST /auth/register
      ↓
    Validate input
      ↓
    Hash password
      ↓
    Store in DB
      ↓
    Response

***

## 🧬 Login

    Client
      ↓
    POST /auth/login
      ↓
    Fetch company
      ↓
    Verify password
      ↓
    Generate JWT
      ↓
    Return token

***

## 🧬 Protected Access

    Client
      ↓
    Authorization: Bearer TOKEN
      ↓
    authMiddleware
      ↓
    Token verified
      ↓
    Access granted

***

## 🧬 Employee Routing

    Employee enters company name
              ↓
    GET /company/lookup/:name
              ↓
    Company exists?
              ↓
    Return metadata
              ↓
    Connect to company backend

***

# 🧩 8. Project Structure

    attendify-server/
    │
    ├── server.js                # Entry point
    ├── db.js                    # Database connection
    │
    ├── routes/
    │   ├── auth.js              # Authentication logic
    │   └── company.js           # Company operations
    │
    ├── middleware/
    │   └── auth.js              # JWT validation
    │
    ├── utils/
    │   └── hash.js              # Password hashing
    │
    └── .env                     # Environment configuration

***

# ⚙️ 9. Environment Configuration

## ✅ Required Variables

```env
MONGO_URL=your_connection_string
JWT_SECRET=your_secure_key
JWT_EXPIRES=7d
PORT=3000
NODE_ENV=production
```

***

## 🧠 Explanation

| Variable     | Purpose             |
| ------------ | ------------------- |
| MONGO\_URL   | Database connection |
| JWT\_SECRET  | Token signing       |
| JWT\_EXPIRES | Session lifetime    |
| PORT         | Server interface    |
| NODE\_ENV    | Runtime mode        |

***

# 🚀 10. API Endpoints

## 🔐 Authentication

### Register

    POST /auth/register

***

### Login

    POST /auth/login

***

## 🏢 Company

### Profile

    GET /company/profile

***

### Full Data

    GET /company/me

***

### Update

    PUT /company/update

***

### Lookup

    GET /company/lookup/:name

***

# 🧠 11. Multi-Tenant Design

## ✅ Principle

Each company is identified by:

    JWT → company.id

***

## ✅ Result

*   Secure tenant isolation
*   No cross-company data access
*   Fully scalable architecture

***

# 🌐 12. Deployment Model

## ✅ Backend

    Railway (Node.js runtime)

***

## ✅ API Gateway

    Cloudflare Workers

***

## ✅ Database

    MongoDB Atlas

***

# 🔐 13. Security Best Practices

*   Never store plaintext passwords
*   Never expose JWT secrets
*   Always enforce HTTPS
*   Use token expiration
*   Validate all input

***

# 🧬 14. System Properties

✅ Stateless  
✅ Scalable  
✅ Secure  
✅ Multi-tenant  
✅ Cloud-ready

***

# 🔮 15. Future Enhancements

*   Refresh token system
*   Role-based access control (RBAC)
*   Rate limiting
*   Company backend integration
*   Flutter & Web dashboards

***
# 🔄 16. End-to-End System Flow

## Employee Interaction

1. Employee opens application
2. Enters company name
3. Request sent to Attendify (/company/lookup)
4. Attendify validates company existence
5. Client receives company metadata
6. Client connects to company backend
7. Authentication handled externally

---

## Company Interaction

1. Company registers on Attendify
2. Credentials stored securely (hashed)
3. Company logs in
4. JWT token issued
5. Token used for protected routes

---

## Integration Layer

Company Backend → Attendify
                ↓
Authenticated via API Key

# 🧩 17. Responsibility Matrix

| Component | Responsibility |
|----------|--------------|
| Flutter App | User interface & input |
| Attendify Backend | Authentication & company registry |
| Cloudflare Worker | API gateway & routing |
| Company Backend | Employee data & business logic |
| MongoDB | Company metadata storage |

# 📡 18. API Contract (Formal Specification)

All APIs follow RESTful principles.

## 📌 Example: Register Company

Request:
POST /auth/register

Body:
{
  "name": "company",
  "email": "email",
  "password": "password"
}

Response:
{
  "success": true
}



# 🔁 19. Authentication Sequence Diagram

Client → Backend: POST /auth/login
Backend → DB: find company
DB → Backend: company data
Backend → Backend: verify password
Backend → Client: JWT token

Client → Backend: GET /company/profile
Backend → Middleware: verify JWT
Middleware → Backend: decoded identity
Backend → Client: company data

# 🔐 20. Data Privacy Model

Attendify follows a strict data-minimization strategy:

- No employee data is stored
- Only company identity is maintained
- All employee interactions are handled externally

This ensures:

✅ Privacy compliance
✅ Reduced liability
✅ Scalable SaaS model

# 🚀 21. Scalability Strategy

The system is designed for horizontal scalability:

- Stateless architecture (JWT-based)
- No session storage
- Cloud-native database (MongoDB Atlas)

Horizontal scaling model:

Multiple backend instances ← Load Balancer ← Clients

This allows:

✅ High availability
✅ Performance scaling
✅ Fault tolerance

# 🔐 22. Security Hardening (Future Improvements)

Planned enhancements:

- Rate limiting (DDoS protection)
- Refresh token mechanism
- API key validation layer
- Request logging & monitoring
- Intrusion detection

# 🧠 23. Architectural Classification

This system can be classified Backend  This system can be classified as:
✅ API Gateway + Authentication Service  

✅ Distributed System  
✅ Identity & Routing Platform  

# 🏁 Conclusion

The Attendify backend system establishes a modern SaaS architecture designed to:

*   Decouple identity from data
*   Enforce strong security guarantees
*   Enable distributed enterprise integrations

***

# 🏆 Final System Characterization

    Distributed Identity + Routing Platform

***

# 📄 License

Private / Internal Use

***

# 🏁 END OF DOCUMENT
