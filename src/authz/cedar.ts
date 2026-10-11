import { isAuthorized, type CedarValueJson, type EntityJson } from "@cedar-policy/cedar-wasm/nodejs";
import { POLICIES } from "./policies";

export type Role = "RESIDENT" | "RESPONDER" | "ADMIN" | "GUEST";

export type AuthzAction =
  | "ViewExactLocation"
  | "AcknowledgeSOS"
  | "PostSOSUpdate"
  | "ResolveSOS"
  | "CorroborateIncident"
  | "PublishOfficialHazard";

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
  /** Ids of the policies that decided it (permits on allow, forbids on deny). */
  reasons: string[];
}

const user = (id: string) => ({ type: "User", id });

function resourceEntity(r: AuthzResource): { uid: { type: string; id: string }; attrs: Record<string, CedarValueJson> } {
  switch (r.type) {
    case "SOSRequest":
      return { uid: { type: "SOSRequest", id: r.id }, attrs: { requester: { __entity: user(r.requesterId) } } };
    case "Incident":
      return {
        uid: { type: "Incident", id: r.id },
        attrs: { reporter: { __entity: user(r.reporterId) }, status: r.status },
      };
    case "Platform":
      return { uid: { type: "Platform", id: "neighbourlink" }, attrs: {} };
  }
}

/**
 * Ask the Cedar policies whether `principal` may perform `action` on
 * `resource`. Fails closed: any evaluation error is a deny.
 */
export function authorize(principal: Principal, action: AuthzAction, resource: AuthzResource): AuthzDecision {
  const res = resourceEntity(resource);
  const entities: EntityJson[] = [
    { uid: user(principal.id), attrs: { role: principal.role }, parents: [] },
    { uid: res.uid, attrs: res.attrs, parents: [] },
  ];

  const answer = isAuthorized({
    principal: user(principal.id),
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
  if (diagnostics.errors.length) {
    console.error("Cedar policy errors:", diagnostics.errors.map((e) => `${e.policyId}: ${e.error.message}`));
  }
  return { allowed: decision === "allow", reasons: diagnostics.reason };
}

/** Thrown when a policy denies an action; `reasons` are Cedar policy ids. */
export class AuthorizationDenied extends Error {
  constructor(
    message: string,
    public readonly reasons: string[]
  ) {
    super(message);
    this.name = "AuthorizationDenied";
  }
}
