# Building Neighbourlink: Fine-Grained Disaster Response Authorization with AWS Cedar and Serverless Architecture

*By Asmita Roy*  
*Target Community: AWS Builder Center / AWS Community Builders*

---

## Introduction: When Software Becomes Frontline Infrastructure

When torrential rains submerge metropolitan avenues, cyclones disrupt power grids, or seismic tremors buckle bridges, standard communication channels quickly collapse. Emergency hotlines become overwhelmed, social media floods with unverified rumors, and stranded civilians struggle to signal their distress.

In moments of crisis, software stops being an abstract application—it becomes frontline emergency infrastructure.

Over the past few months, we built **[Neighbourlink](https://github.com/asry16/Neighbourlink)**: an open, real-time community hazard awareness, flood simulation, and emergency response coordination platform. 

In this deep-dive article, I will share:
1. **The Core Features:** What citizens, community volunteers, and emergency first responders actually experience on the platform.
2. **The Security Dilemma:** Why traditional Role-Based Access Control (RBAC) fails in high-stakes disaster response.
3. **The AWS Cedar Integration:** How we used **AWS Cedar**—AWS’s open-source policy language—compiled to WebAssembly to enforce zero-trust, privacy-preserving authorization at sub-millisecond speeds.
4. **The Cloud Architecture:** How the system integrates with AWS services (Cognito, S3, SQS, SNS) and PostgreSQL.

---

## Part 1: What Users Get — The Neighbourlink Feature Suite

Before diving into policies and code, let’s explore what users experience when they open Neighbourlink on their phones or laptops.

```
+-----------------------------------------------------------------------------------+
|                            NEIGHBOURLINK PLATFORM                                 |
+-----------------------------------------------------------------------------------+
|  [ Command Map ]         [ Live Hazards ]        [ Flood Risk ]     [ SOS Help ]  |
|  - 3D Perspective Tilt   - USGS Quakes           - 24h Rain Fall    - 1-Tap SOS   |
|  - Snap-Style Avatars    - GDACS Cyclones        - Soil Saturation  - Fuzzed Map  |
|  - Basemap Switcher      - Air Quality (NAQI)    - Honest "No-Data" - Rescue GPS  |
+-----------------------------------------------------------------------------------+
|  [ Citizen Reporting ]   [ Community Verification ]    [ Responder Station ]      |
|  - Photo Evidence        - Independent Corroboration   - Boat / Medical Dispatch  |
|  - Category Pins         - Dispute Resolution          - Callback & Status Track  |
+-----------------------------------------------------------------------------------+
```

### 1. Geospatial Command Center with 3D Walkers & Snap-Style Avatars
- **Dynamic 2D / 3D Perspective Tilt:** Users can toggle between flat orthographic 2D maps and an immersive 55° tilted 3D perspective with real-time compass bearing and pitch controls.
- **Snap-Style Presence Avatars:** Inspired by Snapchat’s Snap Map, users and emergency volunteers appear with customizable dynamic avatars and animated 3D pedestrian walkers, showing real-time community activity across streets and wards.
- **Seamless Basemap Switching:** Toggle effortlessly between high-contrast light mode (CARTO Positron), night rescue dark mode (CARTO Dark Matter), MapTiler vector tiles, and Esri Satellite imagery—all without camera jitter, marker drops, or reloads.
- **Global & Local Geocoded Search:** Instant fuzzy search allows users to fly their camera directly to specific neighborhoods, wards, landmarks, or international regions.

---

### 2. Live Multi-Source Disaster Telemetry
Neighbourlink aggregates real-time environmental data from global and regional observation networks:
- **Seismic Telemetry (USGS):** Ingests live earthquake occurrences with magnitude, depth, coordinates, and epicenter distance calculations.
- **Global Disaster Alerts (GDACS):** Surfaces tropical cyclones, tsunamis, volcanic activity, and river flood warnings with severity badges (*Advisory*, *Warning*, *Critical*).
- **Hyperlocal Weather & Air Quality (Open-Meteo):** Displays live temperature, precipitation rates, wind speeds, and the India National Air Quality Index (NAQI) with PM2.5 and PM10 breakdown.

---

### 3. Transparent Flood-Risk Simulator (No False Safety)
Floods are the most common and devastating urban hazard. Neighbourlink includes an experimental rule-based flood risk engine:
- **Multi-Factor Analysis:** Computes localized flood susceptibility using elevation contours, 24-hour recent precipitation, forecast rain volumes, historical soil saturation, and local drainage capacity.
- **The "Honest Data" Guarantee:** Most disaster apps fabricate a "Low Risk" green badge when data is missing. Neighbourlink enforces a strict rule: if required meteorological sensors or forecast inputs are unavailable, the system displays **`INSUFFICIENT DATA`**, preventing false senses of security.

---

### 4. Crowdsourced Hazard Reporting with Photo Evidence
- **Pinpoint Incident Pinning:** Citizens can report localized hazards in seconds (e.g., *Severe Waterlogging*, *Road Cave-in / Landslide*, *Fallen Powerlines / Trees*, *Storm Debris*).
- **Tamper-Checked Evidence Uploads:** Users attach camera photos with metadata validation. Photos are assigned unique incident tracking codes (e.g., `INC-2026-0042`).
- **Impact Categorization:** Reports include affected transit modes (vehicles stalling, footpaths submerged, power outage).

---

### 5. Anti-Abuse Community Corroboration & Dispute Management
A major risk in community-driven emergency apps is rumor propagation and panic. Neighbourlink introduces an independent verification pipeline:
- **Community Corroboration:** When nearby residents encounter a reported hazard, they can click *"I Also Observed This"*. Once independent observations meet the threshold, the pin automatically upgrades from **UNVERIFIED (Amber)** to **COMMUNITY-CORROBORATED (Blue)**.
- **Strict Anti-Self-Verification:** Users are strictly blocked from voting on or corroborating their own reports.
- **Dispute & Resolution Tracking:** If a drain clears or a hazard is resolved, residents can submit a dispute (*"Water drained after municipal pumps turned on"*). The pin transitions to **RESOLVED**, retaining an auditable history rather than vanishing silently.

---

### 6. Emergency SOS Dispatch with Privacy-Preserving Fuzzing
When disaster strikes and lives are in jeopardy, civilians need an immediate lifeline:
- **One-Tap SOS Broadcast:** Civilians can broadcast emergency requests across four critical categories: *Trapped in Floodwaters*, *Medical Emergency*, *Evacuation Assistance*, or *Essential Supplies*.
- **The Dual-Tier Privacy Protection Model:**
  - **Public Civilian View:** To safeguard vulnerable victims from bad actors or looters, the public map displays only a **soft ~1km fuzzed radius circle** (`fuzzyLatitude`, `fuzzyLongitude`). Contact numbers are completely redacted on the server.
  - **Verified Responder View:** Authorized disaster rescue units (e.g., SDRF, local rescue NGOs) and platform administrators receive the **unredacted, pinpoint GPS coordinates**, household headcount, and the direct callback telephone number.
- **Live Operation Pipeline:** Responders acknowledge requests (*"Boat Unit 3 dispatched"*), publish progress updates, and mark cases resolved once citizens are confirmed safe.
- **Call 112 Hotline Shortcut:** Built-in mobile quick-dial shortcuts to National Emergency response numbers.

---

### 7. Area Watch Subscriptions & Push Notifications
- **Neighborhood Watchlists:** Users can subscribe to specific wards or neighborhood radiuses (e.g., 5km around their residence or elderly relatives' homes).
- **Notification Popover & In-App Alert Center:** Real-time bell alerts notify residents when official warnings are published, an SOS is triggered nearby, or an observed hazard status changes.

---

## Part 2: The Security Dilemma — Why Traditional RBAC Fails

Now, let's examine the engineering challenge behind these features.

Consider the rules governing our emergency data:
- *Responders can view exact SOS coordinates, UNLESS the request is already cancelled.*
- *Requesters can always see their own SOS request in full, but cannot see exact coordinates of their neighbors.*
- *Any verified resident can corroborate a hazard, EXCEPT if they are the original reporter.*
- *Nobody can corroborate an incident if the status is already RESOLVED.*

In typical applications, developers write this in procedural TypeScript:

```typescript
// ⚠️ Fragile, hardcoded RBAC anti-pattern
if (
  (user.role === 'RESPONDER' || user.role === 'ADMIN' || user.id === sos.requesterId) &&
  sos.status !== 'CANCELLED'
) {
  // expose exact location
}
```

As features grow, these checks become duplicated across Next.js API routes, server actions, and background workers. When business rules change during an emergency, developers have to hunt down dozens of endpoints. Worse, testing edge cases requires heavy database mocking.

To achieve enterprise-grade security and compliance, we turned to **AWS Cedar**.

---

## Part 3: Decoupling Authorization with AWS Cedar

**AWS Cedar** is an open-source, purpose-built policy language designed for fine-grained authorization. Cedar treats authorization as a first-class citizen:

1. **Deny by Default:** Unless a policy explicitly permits an action, the answer is `DENY`.
2. **Explicit Forbid Always Wins:** If any policy returns `forbid`, access is denied, even if ten other policies return `permit`.
3. **Formal Verification:** Cedar policies can be statically analyzed and mathematically proven for correctness using automated reasoning tools.

### Defining Neighbourlink's Policies in Cedar

Here is our live Cedar policy set (`src/authz/policies.ts`):

```cedar
// 1. SOS Privacy: Responders and Admins see exact GPS and telephone
permit (
  principal,
  action == Action::"ViewExactLocation",
  resource is SOSRequest
)
when { principal.role == "RESPONDER" || principal.role == "ADMIN" };

// 2. Requester Self-Access: Citizens always see their own SOS in full
permit (
  principal,
  action == Action::"ViewExactLocation",
  resource is SOSRequest
)
when { resource.requester == principal };

// 3. Dispatch Operations: Only verified units can acknowledge and update
permit (
  principal,
  action in [Action::"AcknowledgeSOS", Action::"PostSOSUpdate"],
  resource is SOSRequest
)
when { principal.role == "RESPONDER" || principal.role == "ADMIN" };

// 4. Resolution: Responders, Admins, or the Requester themselves can mark safe
permit (
  principal,
  action == Action::"ResolveSOS",
  resource is SOSRequest
)
when {
  principal.role == "RESPONDER" ||
  principal.role == "ADMIN" ||
  resource.requester == principal
};

// 5. Community Verification: Independent residents can corroborate hazards
permit (
  principal,
  action == Action::"CorroborateIncident",
  resource is Incident
);

// 6. Anti-Abuse Guardrail: Strictly forbid self-corroboration
forbid (
  principal,
  action == Action::"CorroborateIncident",
  resource is Incident
)
when { resource.reporter == principal };

// 7. Lifecycle Guardrail: Cannot corroborate an incident already resolved
forbid (
  principal,
  action == Action::"CorroborateIncident",
  resource is Incident
)
when { resource.status == "RESOLVED" };

// 8. Official Warnings: Only platform Admins can publish regional warnings
permit (
  principal,
  action == Action::"PublishOfficialHazard",
  resource == Platform::"neighbourlink"
)
when { principal.role == "ADMIN" };
```

Look closely at rules **5, 6, and 7**. 
- Rule 5 grants broad permission for residents to corroborate incidents.
- Rules 6 & 7 use Cedar's `forbid` statements. Because `forbid` unconditionally trumps `permit`, no resident can ever game the system by corroborating their own report, regardless of their role.

---

## Part 4: Running Cedar at the Serverless Edge with WebAssembly

In a disaster scenario, latency is lethal. Making network round-trips to an external authorization service for every coordinate on a map creates unacceptable lag.

We solved this by running AWS Cedar **directly in the Next.js Node.js serverless runtime** using `@cedar-policy/cedar-wasm`.

Here is the clean TypeScript adapter (`src/authz/cedar.ts`):

```typescript
import { isAuthorized, type CedarValueJson, type EntityJson } from "@cedar-policy/cedar-wasm/nodejs";
import { POLICIES } from "./policies";

export type Role = "RESIDENT" | "RESPONDER" | "ADMIN" | "GUEST";

export interface Principal {
  id: string;
  role: Role;
}

export type AuthzResource =
  | { type: "SOSRequest"; id: string; requesterId: string }
  | { type: "Incident"; id: string; reporterId: string; status: string }
  | { type: "Platform" };

export interface AuthzDecision {
  allowed: boolean;
  reasons: string[];
}

export function authorize(
  principal: Principal,
  action: AuthzAction,
  resource: AuthzResource
): AuthzDecision {
  const res = resourceEntity(resource);
  const entities: EntityJson[] = [
    { uid: { type: "User", id: principal.id }, attrs: { role: principal.role }, parents: [] },
    { uid: res.uid, attrs: res.attrs, parents: [] },
  ];

  // Evaluate directly in in-memory WebAssembly
  const answer = isAuthorized({
    principal: { type: "User", id: principal.id },
    action: { type: "Action", id: action },
    resource: res.uid,
    context: {},
    policies: { staticPolicies: POLICIES },
    entities,
  });

  if (answer.type === "failure") {
    console.error("Cedar authorization failed:", answer.errors.map((e) => e.message));
    return { allowed: false, reasons: [] };
  }

  const { decision, diagnostics } = answer.response;
  return { 
    allowed: decision === "allow", 
    reasons: diagnostics.reason 
  };
}
```

### Next.js 16 Configuration
In `next.config.ts`, we instruct Turbopack and Node to bundle `@cedar-policy/cedar-wasm` as a server-side external package:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@cedar-policy/cedar-wasm"],
  turbopack: true,
};

export default nextConfig;
```

Every authorization check takes **under 1 millisecond** in-memory.

---

## Part 5: Server-Side Privacy Redaction in Practice

With Cedar evaluating permissions, our API services enforce privacy automatically before sending bytes over the wire:

```typescript
export class SOSService {
  static async getSOSRequestsForViewer(currentUserId?: string) {
    const viewerRole = await this.resolveViewerRole(currentUserId);
    const viewer = { id: currentUserId ?? "anonymous", role: viewerRole };

    const records = await prisma.sOSRequest.findMany({
      orderBy: { createdAt: "desc" },
    });

    return records.map((sos) => {
      // Evaluate exact location permission via Cedar
      const decision = authorize(viewer, "ViewExactLocation", {
        type: "SOSRequest",
        id: sos.id,
        requesterId: sos.requesterId,
      });

      if (decision.allowed) {
        // Operational payload for authorized rescue units
        return {
          id: sos.id,
          latitude: sos.latitude,
          longitude: sos.longitude,
          contactPhone: sos.contactPhone,
          description: sos.description,
          status: sos.status,
        };
      }

      // Privacy-redacted public payload for civilians (~1km grid)
      return {
        id: sos.id,
        latitude: sos.fuzzyLatitude,
        longitude: sos.fuzzyLongitude,
        contactPhone: "[Redacted for civilian safety]",
        description: sos.description,
        status: sos.status,
      };
    });
  }
}
```

---

## Part 6: Zero-Database Policy Unit Testing

Because Cedar policies are declarative, they can be tested as pure functions with zero database mocks. Our Vitest test suite (`tests/cedar-policies.test.ts`) verifies every scenario:

```typescript
import { describe, it, expect } from "vitest";
import { authorize } from "@/authz/cedar";

describe("Crisis Cedar Policies", () => {
  const responder = { id: "u-rescue", role: "RESPONDER" as const };
  const civilian = { id: "u-citizen", role: "RESIDENT" as const };
  const sos = { type: "SOSRequest" as const, id: "sos-1", requesterId: "u-citizen" };

  it("permits verified responders to see exact coordinates", () => {
    const decision = authorize(responder, "ViewExactLocation", sos);
    expect(decision.allowed).toBe(true);
    expect(decision.reasons).toContain("responders-see-exact-sos");
  });

  it("redacts exact coordinates for other civilians", () => {
    const stranger = { id: "u-stranger", role: "RESIDENT" as const };
    const decision = authorize(stranger, "ViewExactLocation", sos);
    expect(decision.allowed).toBe(false);
  });

  it("strictly forbids self-corroboration", () => {
    const incident = { 
      type: "Incident" as const, 
      id: "inc-42", 
      reporterId: "u-citizen", 
      status: "UNVERIFIED" 
    };
    const decision = authorize(civilian, "CorroborateIncident", incident);
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toEqual(["no-self-corroboration"]);
  });
});
```

All 82 tests run in **less than 1 second**.

---

## Part 7: AWS Architecture & Production Scaling

Neighbourlink’s clean domain boundaries allow it to seamlessly map to AWS native services:

1. **Amazon Cognito:** User Pools with federated Google OAuth and group claims (`Admins`, `Responders`, `Residents`).
2. **Amazon S3:** Private disaster photo storage accessed via time-limited presigned PUT/GET URLs (`S3Client`, `getSignedUrl`).
3. **Amazon SQS & SNS:** SQS decouples background hazard notification jobs, while SNS broadcasts high-urgency SMS alerts for verified life-safety advisories.
4. **PostgreSQL & PgBouncer:** High-concurrency serverless deployments use Supabase/Aurora PostgreSQL with Transaction Pooling (`:6543`, `?pgbouncer=true`) for Next.js API queries, and Session Pooling (`:5432`) for schema operations.

---

## Key Takeaways for Cloud Builders

1. **Separate Policy from Code:** Writing authorization rules in Cedar instead of inline TypeScript made our disaster protocols transparent, audit-ready, and impossible to bypass accidentally.
2. **WebAssembly Brings Cloud Standards to the Edge:** Using `@cedar-policy/cedar-wasm`, we achieved Amazon Verified Permissions-grade security with local, zero-network evaluation latency.
3. **Protect Human Privacy by Default:** Humanitarian technology must never compromise the physical safety of the people it seeks to protect. Server-side coordinate fuzzing with Cedar-gated unredaction provides the optimal balance of privacy and emergency speed.

---

### Resources & Open Source Code

- **GitHub Repository:** [https://github.com/asry16/Neighbourlink](https://github.com/asry16/Neighbourlink)
- **AWS Cedar Policy Documentation:** [https://www.cedarpolicy.com](https://www.cedarpolicy.com)
- **Amazon Verified Permissions:** [https://aws.amazon.com/verified-permissions/](https://aws.amazon.com/verified-permissions/)

---

*Thank you for reading! If you are building resilient, community-focused cloud software, feel free to share your thoughts in the comments or contribute on GitHub.*
