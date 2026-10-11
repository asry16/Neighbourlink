# Neighbourlink 🌐

> **Real-Time Environmental Hazard Awareness, Risk Estimation, Community Reporting, and Emergency Coordination Platform**

Neighbourlink connects citizens, community observers, and registered disaster responders into a transparent civic-safety command grid.

---

## 🌟 Key Features

1. **2D / 3D Geospatial Command Center:** MapLibre GL JS engine with 2D/3D tilt toggle, pitch/bearing indicators, layer isolation, and theme synchronization that preserves camera position, zoom, and active markers.
2. **Deterministic Flood-Risk Estimator:** Transparent, rule-based heuristic with clear contributing factors and mandatory fallback to `"INSUFFICIENT DATA"` when essential inputs are absent.
3. **Community Reporting & Independent Corroboration:** Multi-observer verification pipeline with anti-abuse voting prevention, photo upload sanitization, and non-destructive dispute logging.
4. **SOS Emergency Dispatch & Privacy Redaction:** Server-side coordinate fuzzing (~1km) for public viewers, reserving unredacted GPS coordinates and phone callbacks strictly for verified responders.
5. **In-App Persistent Notifications:** Real-time dispatch alerts and read state tracking.
6. **Multi-Role Development Context:** Instant local switching between **Resident**, **Responder**, and **Admin** for end-to-end local testing.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js 20+
- npm 10+

### 2. Installation
```bash
git clone <repo-url>
cd Neighbourlink
npm install
```

### 3. Database Setup & Deterministic Seeding
```bash
# Create your local env file (sets DATABASE_URL for SQLite)
cp .env.example .env

# Push Prisma schema to local SQLite database (dev.db)
npx prisma db push

# Seed realistic demo datasets (users, responders, hazards, incidents, SOS requests)
npm run db:seed
```

### 4. Running the Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🧪 Automated Testing

Neighbourlink includes a Vitest test suite covering risk heuristic edge cases, coordinate privacy redaction, and anti-abuse safeguards:

```bash
# Run unit & integration test suite
npm run test
```

### Test Results Summary:
- `tests/risk-engine.test.ts` (8 tests): Validates High, Elevated, Low, Stale, and Insufficient Data handling.
- `tests/privacy-redaction.test.ts` (3 tests): Validates that civilian roles receive fuzzed coordinates and redacted contact details, while responders receive exact data.
- `tests/corroboration-anti-abuse.test.ts` (2 tests): Validates independent observation tracking, duplicate vote rejection, and dispute persistence.

---

## 📂 Project Structure

```
neighbourhood/
├── prisma/
│   ├── schema.prisma       # Relational SQLite schema (User, Incident, SOS, Audit, etc.)
│   └── seed.ts             # Deterministic seed script with Kolkata disaster fixtures
├── src/
│   ├── app/
│   │   ├── api/            # Next.js API Routes (incidents, sos, hazards, risk, notifications, evidence)
│   │   ├── globals.css     # Tailwind CSS v4 design tokens & MapLibre styling
│   │   ├── layout.tsx      # Root layout with ThemeProvider & DemoProvider
│   │   └── page.tsx        # Command Center Shell & dynamic MapLibre loader
│   ├── components/
│   │   ├── layout/         # TopBar, NavRail, MobileNav
│   │   ├── map/            # GeospatialMap (MapLibre GL 2D/3D component)
│   │   ├── incidents/      # IncidentDrawer with corroboration & dispute actions
│   │   ├── modals/         # ReportHazardModal & SosModal
│   │   ├── risk/           # FloodRiskSimulator
│   │   └── views/          # ListView, ResponderView, SettingsView
│   ├── context/
│   │   └── demo-context.tsx# Reactive state & API integration store
│   ├── lib/
│   │   ├── demo-data.ts    # Seed fixtures
│   │   ├── map-styles.ts   # Carto light & dark basemap definitions
│   │   └── prisma.ts       # Singleton Prisma client
│   └── services/
│       ├── incident-service.ts  # Incident & observation business logic
│       ├── sos-service.ts       # SOS dispatch & server-side coordinate fuzzing
│       ├── risk-service.ts      # Deterministic flood engine & IFloodRiskEstimator
│       ├── hazard-service.ts    # Official meteorological alert ingestion
│       └── notification-service.ts # In-app notification management
├── tests/                  # Vitest test suite
├── docs/
│   ├── aws_integration_guide.md             # AWS Amplify, Cognito, DynamoDB, S3 architecture
│   └── architecture_and_demo_walkthrough.md # 3-minute hackathon demo walkthrough
└── .env.example            # Environment variables template
```

---

## 🔒 Security & Privacy Notes

- **Emergency Dispatch Disclaimer:** This application is a community civic-safety tool and is **NOT** a direct replacement for national emergency services. A prominent **Call 112** action is accessible from every screen.
- **Seismic Events:** The platform explicitly does **NOT** predict earthquakes. All earthquake records are citizen observation reports or detected events.
- **Data Redaction:** Coordinate and phone redaction happens on the server before JSON responses leave the API.
