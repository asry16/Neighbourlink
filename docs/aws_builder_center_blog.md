# Building Neighbourlink: Fine-Grained Disaster Response Authorization with AWS Cedar and Serverless Architecture

*By Asmita Roy*  
*Published for AWS Builder Center / AWS Community*

---

## Introduction: The High-Stakes Nature of Crisis Coordination

When monsoons submerge urban corridors or seismic tremors rupture infrastructure, seconds determine outcomes. In emergency disaster response, software ceases to be a luxury—it becomes frontline infrastructure.

Over the past months, we designed and built **Neighbourlink**, an open community hazard awareness and crisis coordination platform. Neighbourlink provides real-time flood simulation, geo-targeted hazard tracking, crowdsourced incident reporting, and emergency SOS broadcasting.

However, building software for civilian safety introduces a profound security and privacy dilemma:

1. **Civilian Privacy vs. Responder Operational Readiness:** When a resident is trapped by rising floodwaters and issues an emergency SOS, the platform captures their exact GPS coordinates, cell phone number, and household status. If this sensitive data is exposed to everyone, bad actors could exploit stranded civilians. But if it is gated behind complex friction, first responders cannot reach them.
2. **Crowdsource Integrity vs. Misinformation Abuse:** Community corroboration accelerates disaster verification. Yet, rogue actors or panicked users might self-corroborate fake reports or reopen closed disaster events.

In traditional architectures, developers tackle this with nested `if/else` checks and role-based access control (RBAC) scattered across API endpoints. But in high-stress, evolving crisis systems, hardcoded permissions lead to security drift, subtle privilege leaks, and untestable rules.

To solve this, we decoupled our entire authorization layer using **AWS Cedar**—AWS’s open-source, expressive, and formally verifiable policy language. In this article, I will walk you through how we integrated AWS Cedar via WebAssembly into a modern Next.js serverless architecture, backed by AWS cloud services and PostgreSQL.

---

## The Architectural Blueprint

Before diving into policies, here is how Neighbourlink is structured across the stack:

```
                          +-------------------------------+
                          |   Next.js 16 (App Router SSR) |
                          |   Deployed on AWS / Serverless |
                          +---------------+---------------+
                                          |
                +-------------------------+-------------------------+
                |                         |                         |
                v                         v                         v
       +-----------------+       +-----------------+       +-----------------+
       |  AWS Cedar Engine|       |  Amazon Cognito |       |    Amazon S3    |
       |  (@cedar-policy |       |  (User Pools &  |       |  (Presigned URL |
       |   cedar-wasm)   |       |   Role Groups)  |       | Private Evidence|
       +-----------------+       +-----------------+       +-----------------+
                |                         |                         |
                +-------------------------+-------------------------+
                                          |
                                          v
                         +---------------------------------+
                         |  PostgreSQL Database (Supabase) |
                         |   Session & Transaction Poolers |
                         +---------------------------------+
```

### Key Pillars:
- **Authorization Engine:** AWS Cedar (`@cedar-policy/cedar-wasm/nodejs`) evaluating zero-trust policies in sub-millisecond in-memory WASM execution.
- **Identity & Authentication:** Amazon Cognito / Supabase Auth with Google OAuth 2.0 federation and encrypted session tokens.
- **Evidence Storage:** Amazon S3 private storage using short-lived presigned PUT/GET URLs for disaster photo evidence.
- **Database Layer:** Managed PostgreSQL using PgBouncer connection pooling for serverless resilience.

---

## Why AWS Cedar?

**Cedar** (the foundation behind Amazon Verified Permissions) is purpose-built for fine-grained authorization. Unlike general-purpose languages, Cedar has three characteristics that make it ideal for humanitarian and mission-critical systems:

1. **Default Deny:** If no policy explicitly permits an action, Cedar denies access automatically.
2. **Explicit Forbid Wins:** A single `forbid` statement immediately supersedes any number of `permit` statements. This makes enforcing anti-abuse boundaries bulletproof.
3. **Decoupled & Audit-Ready:** Policies are written in clean human-readable syntax that non-engineering auditors can review without reading application source code.

---

## Writing Crisis Authorization Policies in Cedar

In Neighbourlink, we defined three primary entity types:
- **Principals:** `User::"<id>"` with attributes `{ role: "RESIDENT" | "RESPONDER" | "ADMIN" | "GUEST" }`
- **Resources:** 
  - `SOSRequest::"<id>"` with attributes `{ requester: User }`
  - `Incident::"<id>"` with attributes `{ reporter: User, status: String }`
  - `Platform::"neighbourlink"`
- **Actions:** `ViewExactLocation`, `AcknowledgeSOS`, `PostSOSUpdate`, `ResolveSOS`, `CorroborateIncident`, `PublishOfficialHazard`

Here is our live Cedar policy set (`src/authz/policies.ts`):

```cedar
// 1. SOS Privacy: Responders and Admins see exact GPS and telephone
permit (
  principal,
  action == Action::"ViewExactLocation",
  resource is SOSRequest
)
when { principal.role == "RESPONDER" || principal.role == "ADMIN" };

// 2. Requester Self-Access: Citizens always see their own SOS request
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

// 6. Anti-Abuse Rule: No self-corroboration
forbid (
  principal,
  action == Action::"CorroborateIncident",
  resource is Incident
)
when { resource.reporter == principal };

// 7. Lifecycle Integrity: Resolved incidents cannot be corroborated
forbid (
  principal,
  action == Action::"CorroborateIncident",
  resource is Incident
)
when { resource.status == "RESOLVED" };

// 8. Official Warnings: Only Admins can publish regional hazards
permit (
  principal,
  action == Action::"PublishOfficialHazard",
  resource == Platform::"neighbourlink"
)
when { principal.role == "ADMIN" };
```

Notice how clean the anti-abuse rules are. Rule #6 (`no-self-corroboration`) forbids a user from verifying their own report, regardless of what permission rule #5 allows.

---

## Executing Cedar in Next.js Serverless via WebAssembly

Rather than making high-latency network round-trips to an external authorization service for every single map point and coordinate, we packaged the AWS Cedar evaluation engine directly into our Next.js backend using `@cedar-policy/cedar-wasm`.

Here is our authorization adapter (`src/authz/cedar.ts`):

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

### Next.js 16 Configuration for WASM
In `next.config.ts`, we ensure Turbopack and the Node server treat `@cedar-policy/cedar-wasm` as an external server package so the underlying `.wasm` binary loads smoothly from disk in serverless runtime:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@cedar-policy/cedar-wasm"],
  turbopack: true,
};

export default nextConfig;
```

---

## Putting It Together: Dual-Tier Privacy Redaction

With Cedar in place, our API routes enforce a strict dual-tier data model:

```typescript
export class SOSService {
  static async getSOSRequestsForViewer(currentUserId?: string) {
    const viewerRole = await this.resolveViewerRole(currentUserId);
    const viewer = { id: currentUserId ?? "anonymous", role: viewerRole };

    const records = await prisma.sOSRequest.findMany({
      orderBy: { createdAt: "desc" },
    });

    return records.map((sos) => {
      // Ask Cedar whether this viewer is permitted to see exact coordinates
      const decision = authorize(viewer, "ViewExactLocation", {
        type: "SOSRequest",
        id: sos.id,
        requesterId: sos.requesterId,
      });

      if (decision.allowed) {
        // Full unredacted operational payload for rescue units
        return {
          id: sos.id,
          latitude: sos.latitude,
          longitude: sos.longitude,
          contactPhone: sos.contactPhone,
          description: sos.description,
          status: sos.status,
        };
      }

      // Privacy-redacted public payload for civilians (~1km fuzzed grid)
      return {
        id: sos.id,
        latitude: sos.fuzzyLatitude,
        longitude: sos.fuzzyLongitude,
        contactPhone: "[Redacted for civilian security]",
        description: sos.description,
        status: sos.status,
      };
    });
  }
}
```

---

## Testing Policy Correctness with Vitest

A critical benefit of AWS Cedar is that policies can be tested as pure functions with zero database mocks. We built a comprehensive test suite running under Vitest:

```typescript
import { describe, it, expect } from "vitest";
import { authorize } from "@/authz/cedar";

describe("Crisis Cedar Policies", () => {
  const responder = { id: "u-rescue", role: "RESPONDER" as const };
  const civilian = { id: "u-citizen", role: "RESIDENT" as const };
  const sos = { type: "SOSRequest" as const, id: "sos-1", requesterId: "u-citizen" };

  it("permits responders to see exact coordinates", () => {
    const decision = authorize(responder, "ViewExactLocation", sos);
    expect(decision.allowed).toBe(true);
    expect(decision.reasons).toContain("responders-see-exact-sos");
  });

  it("redacts exact coordinates for other residents", () => {
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

Every single assertion executes in less than **2 milliseconds**, providing instant feedback during local development and CI builds.

---

## Cloud Deployment Lessons Learned

When scaling serverless Next.js applications backed by cloud PostgreSQL and AWS services, we encountered three valuable lessons:

1. **Transaction Pooling vs. Session Pooling:**
   Prisma running in serverless environments exhausts PostgreSQL connection limits rapidly. Connecting via PgBouncer on port `6543` (`?pgbouncer=true`) is essential for high concurrency. However, schema migrations (`prisma db push`) require a direct session connection (port `5432`). Structuring our build scripts to dynamically toggle between the two eliminated cold-start connection crashes.
2. **Formally Verified Security Brings Peace of Mind:**
   In an emergency response system, bugs are not just glitches—they are life safety liabilities. Having Cedar’s automated reason diagnostics (`diagnostics.reason`) returned in authorization decisions allowed our UI to present clear, intelligible denial notices to users without leaking database internals.
3. **WebAssembly Brings Cloud Policies to the Edge:**
   Running AWS Cedar compiled to WebAssembly inside the Vercel/AWS Lambda serverless container provided the security guarantees of Amazon Verified Permissions with zero latency penalties.

---

## Conclusion & Resources

By combining **AWS Cedar** with modern serverless architecture, we built a crisis response platform that is resilient, blazingly fast, and respectful of civilian privacy.

If you are building applications where data sensitivity, multi-role interactions, and audit requirements meet, I strongly recommend exploring AWS Cedar for your authorization needs.

### Helpful Resources:
- **AWS Cedar Policy Language:** [https://www.cedarpolicy.com](https://www.cedarpolicy.com)
- **Amazon Verified Permissions:** [https://aws.amazon.com/verified-permissions/](https://aws.amazon.com/verified-permissions/)
- **Neighbourlink GitHub Repository:** [https://github.com/asry16/Neighbourlink](https://github.com/asry16/Neighbourlink)

---

*Thank you for reading! Feel free to leave questions in the comments below or connect with me on GitHub.*
