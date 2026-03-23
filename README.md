# TrustCheck 🛡️

> **QR-Based Supply Chain Provenance & Authenticity Platform**

TrustCheck is a web application that lets consumers instantly verify a product's authenticity and trace its full supply chain journey by scanning a QR code. It gives manufacturers, distributors, retailers, and suppliers dedicated dashboards to manage and record every step of a product's lifecycle — from raw materials to the end consumer.

---

## 🚨 The Problem

Consumers have no reliable way to verify a product's origin, handling, or authenticity. Counterfeiters copy packaging easily, and companies can make unverifiable claims about raw materials (e.g., "organic," "fair trade") without any transparent record. TrustCheck solves this with a mathematically verifiable, append-only supply chain ledger.

---

## ✨ Key Features

### For Consumers (No Login Required)
- **QR Code Scanner** — Scan any product QR code directly in the browser. No app download needed.
- **Digital Product Passport (DPP)** — View a product's permanent digital identity: manufacturing details, raw material origins, certifications, and full journey timeline.
- **Trust Score (0–100)** — A color-coded authenticity score calculated from scan frequency, geo-location deltas, and timestamp anomalies.
  - 🟢 **90–100** — Verified & authentic
  - 🟠 **50–89** — Suspicious activity detected
  - 🔴 **0–49** — Likely counterfeit, do not purchase

### For Supply Chain Partners
- **Manufacturer Dashboard** — Create production batches, link them to certified raw material supply lots, and generate item/carton QR codes for printing.
- **Supplier Dashboard** — Manage raw material supply lots and certifications.
- **Distributor Dashboard** — Scan carton QR codes to bulk-update the journey status of all items inside in a single scan.
- **Retailer Dashboard** — Confirm receipt of shipments and log the final handoff point before consumer sale.
- **Raw Material Mass Balance Ledger** — Prevents fraudulent quantity claims. The system automatically deducts raw material usage from supplier lots; a batch cannot be created if insufficient certified stock exists.
- **Geo-Location Logging** — GPS coordinates are captured on each scan and logged with immutable server-side timestamps. Location anomalies (same product scanned in two distant places) automatically degrade the Trust Score.
- **Carton / Box QR Aggregation** — One carton QR scan updates the status of all items inside it simultaneously, enabling efficient bulk custody transfers.

---

## 🏗️ Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build Tool | Vite 6 |
| Routing | React Router 7 |
| Styling | Tailwind CSS 4 |
| UI Components | Radix UI + shadcn/ui + MUI |
| QR Scanning | `@zxing/browser` + `react-qr-scanner` |
| Forms | React Hook Form |
| Charts | Recharts |
| Animation | Motion |
| Package Manager | pnpm |

### Backend
| Layer | Technology |
|---|---|
| Framework | FastAPI (Python) |
| ORM | SQLAlchemy |
| Database | PostgreSQL (via SQLAlchemy + connection pool) |
| Authentication | Google OAuth2 (ID token verification) + JWT (access & refresh tokens) |
| QR Generation | `qrcode` library (base64 PNG output) |
| UUID Hashing | `passlib` with bcrypt |
| Geo-coding | Geoapify Reverse Geocoding API |
| Environment Config | `python-dotenv` |

---

## 🐍 Backend — `app.py`

The backend is a single-file **FastAPI** application that powers all supply chain logic, QR code generation, scanning, and the Trust Score engine.

### Database Models (SQLAlchemy)

| Model | Purpose |
|---|---|
| `User` | All partners and consumers. `type_user` field holds `company`, `supplier`, `distributor`, `retailer`, or `customer` |
| `Items` | A product definition created by a manufacturer |
| `Batch` | A production run of an item, linked to a raw material lot |
| `RawMaterialLot` | A certified supply lot registered by a supplier (tracks `total_qty` / `remaining_qty`) |
| `BatchRMUsage` | Immutable ledger entry recording exactly how much of a lot was consumed per batch |
| `DistributionCode` | A QR token assigned to a specific distributor for a batch |
| `Carton` | A box grouping multiple products; scanned for bulk custody transfer |
| `CartonCode` | Join table linking a carton to its distribution code |
| `Product` | An individual serialised item with a hashed UUID; tracks `is_sold`, `sold_to`, `sold_at` |
| `HashedUUID` | Stores bcrypt-hashed UUIDs for all QR types (`batch`, `distribution`, `carton`, `product`) |
| `ScanLog` | Immutable append-only log of every scan event with GPS coordinates and server-side timestamp |

### API Endpoints

#### Auth
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/token` | Verify Google OAuth2 ID token, register/login user, return JWT access + refresh tokens |
| `POST` | `/token/refresh` | Rotate refresh token and issue a new access token |
| `POST` | `/logout` | Invalidate the current refresh token (JTI rotation) |
| `GET` | `/users/me` | Return the authenticated user's profile and role |

#### QR Generation (Manufacturer / Company)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/token/company/batch` | Create a batch + item, run mass balance check, deduct raw material, return base64 QR |
| `POST` | `/token/company/distribution` | Generate distribution QR codes assigned to specific distributors |
| `POST` | `/token/company/carton` | Generate carton-level QR codes linked to a distribution code |
| `POST` | `/token/company/product` | Generate individual serialised product QR codes for a carton |

#### Scanning (Role-Gated)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/token/distributor` | Distributor scans a QR; logs GPS location and timestamp to `ScanLog` |
| `POST` | `/token/retailer` | Retailer scans carton or product QR; marks product as sold on product scan |
| `POST` | `/token/consumer` | Consumer scans any QR; returns full item details + journey log |
| `POST` | `/token/supplier` | Supplier scans a batch QR to log raw material handoff with weight |

#### Raw Material Lots (Supplier & Manufacturer)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/supplier/lots` | Supplier registers a new certified raw material lot |
| `GET` | `/supplier/lots` | Supplier lists their own lots with remaining quantities |
| `GET` | `/manufacturer/lots` | Manufacturer views all available lots to select for batch creation |

#### Dashboards & Passport
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/passport/{product_id}` | **Public** — returns full Digital Product Passport: item info, raw material origin, journey, and Trust Score |
| `GET` | `/manufacturer/batches` | Manufacturer lists their batches with units sold and lot usage |
| `GET` | `/distributor/scans` | Distributor views their recent scan history |
| `GET` | `/retailer/scans` | Retailer views their recent scan history |

### Trust Score Algorithm

The `compute_trust_score()` function calculates a 0–100 score using rule-based deductions — no ML required:

| Rule | Deduction |
|---|---|
| Missing distributor scan in journey | −15 pts |
| Missing retailer scan in journey | −10 pts |
| Geo-impossible scan: same QR scanned >100 km apart in <5 min (Haversine distance) | −40 pts |
| High consumer scan frequency: >10 scans detected | −20 pts |

The final score maps to a colour tier: 🟢 **Green** (90–100), 🟠 **Orange** (50–89), 🔴 **Red** (0–49).

### Security Model

- **Google OAuth2** verifies the ID token server-side (issuer + audience checked).
- **JWT access tokens** expire after 15 minutes; **refresh tokens** expire after 30 days.
- **JTI (JWT ID) rotation** — each refresh invalidates the previous token, preventing replay attacks.
- **UUID hashing with bcrypt** — QR code UUIDs are never stored in plaintext; scanning verifies against the hash.
- **Role enforcement** — every endpoint checks `user.type_user` and raises `HTTP 403` if the role doesn't match.
- **Append-only ScanLog** — past journey events cannot be edited or deleted.

### Environment Variables

Create a `.env` file in the project root:

```env
SECRET_KEY=your_jwt_secret_key
DATABASE_URL=postgresql://user:password@host:port/dbname
CLIENT_ID=your_google_oauth_client_id
ALGORITHM=HS256
```

### Running the Backend

```bash
# Install dependencies
pip install fastapi uvicorn sqlalchemy psycopg2-binary passlib[bcrypt] pyjwt python-dotenv qrcode requests google-auth

# Start the server
uvicorn app:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

---

## 📁 Project Structure

```
TrustCheck/
├── app.py                            # FastAPI backend (all API logic)
├── .env                              # Environment variables (not committed)
└── src/
├── app/
│   ├── pages/
│   │   ├── ScanPage.tsx              # Consumer QR scanner (landing page)
│   │   ├── PassportPage.tsx          # Digital Product Passport view
│   │   ├── LoginPage.tsx             # Partner authentication
│   │   ├── ManufacturerDashboard.tsx # Manufacturer portal
│   │   ├── BatchCreationForm.tsx     # Create batches & generate QR codes
│   │   ├── SupplierDashboard.tsx     # Supplier portal
│   │   ├── DistributorDashboard.tsx  # Distributor portal
│   │   ├── RetailerDashboard.tsx     # Retailer portal
│   │   └── NotFoundProduct.tsx       # Unrecognised QR fallback
│   ├── components/
│   │   ├── JourneyTimeline.tsx       # Supply chain journey visualisation
│   │   ├── QRScannerViewfinder.tsx   # Camera-based QR scanner UI
│   │   ├── TrustScoreBadge.tsx       # Colour-coded authenticity badge
│   │   ├── ActivityFeed.tsx          # Real-time scan activity log
│   │   ├── DashboardLayout.tsx       # Shared dashboard shell
│   │   └── ui/                       # Reusable UI primitives
│   ├── routes.ts                     # Application route definitions
│   └── App.tsx
└── styles/
    ├── theme.css
    └── index.css
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- pnpm (`npm install -g pnpm`)
- PostgreSQL database

### Frontend Setup

```bash
# Clone the repository
git clone https://github.com/harsahib2907/TrustCheck.git
cd TrustCheck

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The frontend will be available at `http://localhost:5173`.

### Backend Setup

```bash
# Install Python dependencies
pip install fastapi uvicorn sqlalchemy psycopg2-binary passlib[bcrypt] pyjwt python-dotenv qrcode requests google-auth

# Create .env file with required variables (see Environment Variables section above)

# Run the API server
uvicorn app:app --reload --port 8000
```

The API will be available at `http://localhost:8000` and interactive Swagger docs at `http://localhost:8000/docs`.

### Production Build (Frontend)

```bash
pnpm build
```

---

## 🗺️ App Routes

| Route | Description | Auth |
|---|---|---|
| `/` | Consumer QR Scanner | Public |
| `/passport/:id` | Digital Product Passport | Public |
| `/login` | Partner Login | Public |
| `/dashboard/manufacturer` | Manufacturer Dashboard | Partner |
| `/dashboard/manufacturer/batch/new` | Batch Creation Form | Manufacturer |
| `/dashboard/supplier` | Supplier Dashboard | Partner |
| `/dashboard/distributor` | Distributor Dashboard | Partner |
| `/dashboard/retailer` | Retailer Dashboard | Partner |

---

## 🔄 User Flows

**Consumer** — Opens the site → camera viewfinder activates → scans product QR → instantly lands on the Digital Product Passport with Trust Score, journey timeline, and raw material origins.

**Manufacturer** — Logs in → creates a production batch → system checks mass balance ledger → QR codes generated → exported as PDF labels for printing.

**Distributor** — Logs in → scans a carton QR → all items inside are bulk-updated in a single action, transferring custody.

**Retailer** — Logs in → confirms receipt of shipment → final journey checkpoint recorded before consumer sale.

---

## 🔐 Authentication

- Consumer access is fully **public** — no login required for QR scanning or passport viewing.
- Supply chain partners sign in with **Google OAuth2**. The frontend sends the Google ID token to the backend, which verifies it server-side and issues its own **JWT access token** (15-min) and **refresh token** (30-day).
- **JTI rotation** ensures each refresh token can only be used once, preventing replay attacks.
- **Role-based access** is enforced on every backend endpoint via the `type_user` field (`company`, `supplier`, `distributor`, `retailer`, `customer`). Wrong role → `HTTP 403`.

---

## 🚫 Out of Scope (MVP)

- Machine learning-based Trust Score (rule-based logic only)
- Manual editing of past journey records (ledger is append-only)
- Unregistered/unverified suppliers
- Search engine indexing of product passports

---

## 📄 License

This project was built as a Hackathon MVP. See [LICENSE](LICENSE) for details.
