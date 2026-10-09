# Neighbourlink: Architecture & 3-Minute Demo Walkthrough

A real-time environmental hazard awareness, risk-estimation, community-reporting, and emergency-coordination platform.

---

## 1. System Architecture Summary

Neighbourlink is architected as a **modular monolith** with clear domain service boundaries:

- **Client Presentation:**
  - Next.js 16 App Router with React 19.
  - MapLibre GL JS loaded dynamically on the client to avoid SSR canvas errors.
  - Theme synchronization (`next-themes`) maintaining camera center, zoom, pitch, bearing, and active pins across light and dark styles.
  - Accessible list-view alternative with no-data standards (*"No recent observations available"*, avoiding false "safe" assumptions).
- **Backend Domain Services:**
  - `IncidentService`: Manages incident lifecycle (Unverified $\rightarrow$ Corroborated $\rightarrow$ Disputed $\rightarrow$ Resolved) and enforces strict anti-abuse rules preventing duplicate corroborations.
  - `SOSService`: Server-side privacy protection filter that fuzzes public coordinates to ~1km and redacts contact phone numbers, reserving exact coordinates solely for verified responders. Matches verified emergency organisations using geographic distance and capabilities.
  - `RiskService`: Transparent rule-based heuristic engine (`IFloodRiskEstimator`) outputting contributing factors and falling back to `"INSUFFICIENT_DATA"` when essential inputs are absent.
  - `HazardService`: Segregates official government advisories (IMD, GSI) from crowdsourced claims with stale-data checks.
  - `NotificationService`: Manages user alerts with unread counts and delivery states.
- **Data Persistence:**
  - Local SQLite via Prisma ORM (`dev.db`) with deterministic seed fixtures for zero-cloud offline demos.
  - Ready-to-swap adapter boundaries for AWS (Cognito, DynamoDB, S3, SQS, SNS).

---

## 2. Three-Minute Hackathon Demo Walkthrough

### minute 0:00 - 0:45: The Geospatial Command Center
1. **Open the App:** Navigate to `http://localhost:3000`.
2. **Explore 2D/3D & Themes:**
   - Click the **3D / 2D toggle** on the map controls (top-right). Observe the camera tilt to a 55° perspective view with real-time bearing readout.
   - Click the **Theme Toggle** (sun/moon icon). Notice the map basemap smoothly switches between CARTO Positron and CARTO Dark Matter without moving the camera, resetting zoom, or losing markers.
3. **Locality Selection:**
   - In the top bar, change the sector from *Central Kolkata* to *Sector V (Salt Lake)*. The map executes a smooth cinematic fly-to transition.
4. **Emergency Shortcut:**
   - Point out the red **"Call 112"** button with clear national emergency disclaimer.

### Minute 0:45 - 1:30: Experimental Flood-Risk & Citizen Reporting
1. **Inspect Flood-Risk Indicator:**
   - Click the **"List"** view tab.
   - Point out the **Flood-Risk Simulator**: show that missing forecast data outputs `"INSUFFICIENT DATA"` with an explanation, proving the platform never fabricates safety.
   - Switch back to **"Command Map"**.
2. **Citizen Reports a Hazard:**
   - Click the blue **"Report Hazard"** button in the navigation rail.
   - Category: *"Flood / Waterlogging"*.
   - Description: *"Knee-deep water on main road near Webel More"*.
   - Impact: *"Vehicles stalling, sidewalk submerged"*.
   - Click **"Broadcast Report"**.
   - An amber pin appears on the map labelled **UNVERIFIED** with tracking code `INC-2026-XXXX`.

### Minute 1:30 - 2:15: Independent Corroboration & Disputes
1. **Role Switch to Corroborator:**
   - In the top bar role switcher, switch role to **Resident: Debashis Roy**.
2. **Corroborate Report:**
   - Click on the newly reported waterlogging pin or open the incident drawer.
   - Click **"I Also Observed This (Corroborate)"**.
   - The status immediately promotes to **COMMUNITY-CORROBORATED** and the marker turns blue.
   - *Test Anti-Abuse:* Attempt to click the button again — notice the UI prevents duplicate voting.
3. **Dispute Integrity:**
   - Click **"Dispute Details"** and enter: *"Water drained after lock gates opened"*.
   - The status changes to **DISPUTED** for review, but the record is never silently deleted.

### Minute 2:15 - 3:00: SOS Dispatch & Responder Resolution
1. **Citizen Stranded in Water:**
   - Switch role back to **Priya Banerjee**.
   - Click the prominent red **"Request Help (SOS)"** button.
   - Category: *"Stranded / Trapped in Waterlogging"*, headcount: *2 people*, description: *"Water entering ground floor living room"*.
   - Click **"Broadcast SOS Request"**.
2. **Civilian Privacy Inspection:**
   - Notice the public map marker: it displays a soft, blurred 1km privacy circle. The contact phone number is redacted on the server.
3. **Responder Command Station:**
   - Switch role to **Responder: Sub-Inspector A. Sen (KDRRT)**.
   - Click **"Responder Station"** in the sidebar.
   - As an authorized officer, view the **unredacted exact GPS pin** and requester direct phone number.
   - Click **"Acknowledge & Dispatch Boat Unit"**.
4. **Requester Real-Time Confirmation:**
   - Switch role back to **Priya Banerjee**.
   - Check the **Notification Bell** in the top bar: unread badge flashes.
   - Open notification popover: *"Kolkata Disaster Rapid Response Team has acknowledged your request"*.
   - Responder confirms resolution $\rightarrow$ status updates to **RESOLVED**.

---

## 3. Honest List of Limitations & Boundaries

To ensure absolute engineering transparency:

| Component | Current State | Production Cloud Upgrade Path |
|---|---|---|
| **Basemap Elevation** | 3D pitched perspective view with vector tilt. | Requires raster-dem elevation tiles for true 3D terrain mesh. |
| **Flood Prediction** | Transparent, deterministic heuristic rule engine (`v1.0`). Not a validated ML model. | Pluggable `IFloodRiskEstimator` interface ready to connect to hydraulic or hydrological ML services. |
| **Earthquake Observations** | Detected tremor observation records only. | Platform explicitly does NOT predict seismic events. |
| **Authentication** | Development-only role context (Resident, Responder, Admin). | AWS Cognito User Pool with JWT token validation and group membership. |
| **Evidence Storage** | Sanitized local filesystem storage (`/public/uploads/`). | Private Amazon S3 bucket with expiring presigned upload/download URLs. |
| **Notifications** | Local SQLite polling and in-app bell notification popover. | Amazon SQS worker pipeline + Amazon SNS for cellular SMS/email broadcast. |
| **Emergency Dispatch** | Connected to simulated participating responder units (KDRRT). | Not integrated into official government 112 CAD systems; manual phone shortcut provided. |
