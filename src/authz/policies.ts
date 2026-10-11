/**
 * Neighbourlink's authorization rules, written in Cedar (AWS's open-source
 * policy language, https://www.cedarpolicy.com). Every permission check in
 * the services goes through these policies via `src/authz/cedar.ts`.
 *
 * Model
 *   Principals: User::"<id>"           { role: "RESIDENT" | "RESPONDER" | "ADMIN" | "GUEST" }
 *   Resources:  SOSRequest::"<id>"     { requester: User }
 *               Incident::"<id>"       { reporter: User, status: String }
 *               Platform::"neighbourlink"
 *
 * Cedar denies by default; a matching `forbid` always beats a `permit`.
 * Policy ids double as the reasons reported back to the app.
 */
export const POLICIES: Record<string, string> = {
  // --- SOS privacy -----------------------------------------------------------
  // Exact coordinates and the callback number are for verified responders.
  "responders-see-exact-sos": `
    permit (principal, action == Action::"ViewExactLocation", resource is SOSRequest)
    when { principal.role == "RESPONDER" || principal.role == "ADMIN" };`,

  // A requester always sees their own request in full.
  "requester-sees-own-sos": `
    permit (principal, action == Action::"ViewExactLocation", resource is SOSRequest)
    when { resource.requester == principal };`,

  // --- SOS response ------------------------------------------------------------
  "responders-handle-sos": `
    permit (
      principal,
      action in [Action::"AcknowledgeSOS", Action::"PostSOSUpdate"],
      resource is SOSRequest
    )
    when { principal.role == "RESPONDER" || principal.role == "ADMIN" };`,

  // Responders close cases; the requester may also confirm they are safe.
  "close-sos": `
    permit (principal, action == Action::"ResolveSOS", resource is SOSRequest)
    when {
      principal.role == "RESPONDER" ||
      principal.role == "ADMIN" ||
      resource.requester == principal
    };`,

  // --- Community verification -------------------------------------------------
  "residents-corroborate": `
    permit (principal, action == Action::"CorroborateIncident", resource is Incident);`,

  // Corroboration must be independent: never your own report.
  "no-self-corroboration": `
    forbid (principal, action == Action::"CorroborateIncident", resource is Incident)
    when { resource.reporter == principal };`,

  // A resolved report can't be pushed back to active.
  "no-corroborating-resolved": `
    forbid (principal, action == Action::"CorroborateIncident", resource is Incident)
    when { resource.status == "RESOLVED" };`,

  // --- Official warnings -----------------------------------------------------
  // Official warnings outrank everything else in the app.
  "admins-publish-official-hazards": `
    permit (principal, action == Action::"PublishOfficialHazard", resource == Platform::"neighbourlink")
    when { principal.role == "ADMIN" };`,
};
