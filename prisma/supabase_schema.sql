-- ========================================================================
-- Neighbourlink - Supabase PostgreSQL Schema Setup Script
-- Paste this script into your Supabase Dashboard: SQL Editor -> Run
-- ========================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Responder Organizations
CREATE TABLE IF NOT EXISTS "ResponderOrganisation" (
    "id" TEXT PRIMARY KEY DEFAULT ('org_' || substr(md5(random()::text), 1, 16)),
    "name" TEXT NOT NULL,
    "code" TEXT UNIQUE NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "contactPhone" TEXT NOT NULL,
    "serviceAreaName" TEXT NOT NULL,
    "centerLat" DOUBLE PRECISION NOT NULL,
    "centerLng" DOUBLE PRECISION NOT NULL,
    "radiusKm" DOUBLE PRECISION NOT NULL DEFAULT 15.0,
    "capabilities" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users (Synced with Supabase Auth & Civic Roles)
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY DEFAULT ('usr_' || substr(md5(random()::text), 1, 16)),
    "email" TEXT UNIQUE NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'RESIDENT',
    "phone" TEXT,
    "avatarUrl" TEXT,
    "googleId" TEXT UNIQUE,
    "responderOrgId" TEXT REFERENCES "ResponderOrganisation"("id") ON DELETE SET NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Area Subscriptions
CREATE TABLE IF NOT EXISTS "AreaSubscription" (
    "id" TEXT PRIMARY KEY DEFAULT ('sub_' || substr(md5(random()::text), 1, 16)),
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radiusKm" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Official Hazard Updates
CREATE TABLE IF NOT EXISTS "HazardUpdate" (
    "id" TEXT PRIMARY KEY DEFAULT ('haz_' || substr(md5(random()::text), 1, 16)),
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "hazardType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "affectedArea" TEXT NOT NULL,
    "centerLat" DOUBLE PRECISION NOT NULL,
    "centerLng" DOUBLE PRECISION NOT NULL,
    "radiusKm" DOUBLE PRECISION NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Deterministic Risk Estimates
CREATE TABLE IF NOT EXISTS "RiskEstimate" (
    "id" TEXT PRIMARY KEY DEFAULT ('risk_' || substr(md5(random()::text), 1, 16)),
    "modelName" TEXT NOT NULL DEFAULT 'Experimental Rule-Based Flood Engine v1.0',
    "localityName" TEXT NOT NULL,
    "centerLat" DOUBLE PRECISION NOT NULL,
    "centerLng" DOUBLE PRECISION NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "rainfallRecentMm" DOUBLE PRECISION,
    "rainfallForecastMm" DOUBLE PRECISION,
    "waterLevelMeters" DOUBLE PRECISION,
    "historicalSusceptibility" BOOLEAN NOT NULL DEFAULT false,
    "horizonHours" INTEGER NOT NULL DEFAULT 24,
    "explanation" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDemo" BOOLEAN NOT NULL DEFAULT true
);

-- 6. Incidents (Community Reports)
CREATE TABLE IF NOT EXISTS "Incident" (
    "id" TEXT PRIMARY KEY DEFAULT ('inc_' || substr(md5(random()::text), 1, 16)),
    "trackingCode" TEXT UNIQUE NOT NULL,
    "category" TEXT NOT NULL,
    "categoryLabel" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "localityName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reportedImpact" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reporterId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT
);

-- 7. Observations (Corroborations)
CREATE TABLE IF NOT EXISTS "Observation" (
    "id" TEXT PRIMARY KEY DEFAULT ('obs_' || substr(md5(random()::text), 1, 16)),
    "incidentId" TEXT NOT NULL REFERENCES "Incident"("id") ON DELETE CASCADE,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
    "type" TEXT NOT NULL DEFAULT 'CORROBORATION',
    "comment" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Disputes
CREATE TABLE IF NOT EXISTS "Dispute" (
    "id" TEXT PRIMARY KEY DEFAULT ('dsp_' || substr(md5(random()::text), 1, 16)),
    "incidentId" TEXT NOT NULL REFERENCES "Incident"("id") ON DELETE CASCADE,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
    "reason" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. Evidence (Photos)
CREATE TABLE IF NOT EXISTS "Evidence" (
    "id" TEXT PRIMARY KEY DEFAULT ('evid_' || substr(md5(random()::text), 1, 16)),
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "incidentId" TEXT REFERENCES "Incident"("id") ON DELETE CASCADE,
    "observationId" TEXT REFERENCES "Observation"("id") ON DELETE CASCADE,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. SOS Emergency Requests
CREATE TABLE IF NOT EXISTS "SOSRequest" (
    "id" TEXT PRIMARY KEY DEFAULT ('sos_' || substr(md5(random()::text), 1, 16)),
    "trackingCode" TEXT UNIQUE NOT NULL,
    "requesterId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "fuzzyLatitude" DOUBLE PRECISION NOT NULL,
    "fuzzyLongitude" DOUBLE PRECISION NOT NULL,
    "localityName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "peopleCount" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "assignedOrgId" TEXT REFERENCES "ResponderOrganisation"("id") ON DELETE SET NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. SOS Updates
CREATE TABLE IF NOT EXISTS "SOSUpdate" (
    "id" TEXT PRIMARY KEY DEFAULT ('upd_' || substr(md5(random()::text), 1, 16)),
    "sosId" TEXT NOT NULL REFERENCES "SOSRequest"("id") ON DELETE CASCADE,
    "authorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. In-App Notifications
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT PRIMARY KEY DEFAULT ('notif_' || substr(md5(random()::text), 1, 16)),
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "link" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 13. Audit Events
CREATE TABLE IF NOT EXISTS "AuditEvent" (
    "id" TEXT PRIMARY KEY DEFAULT ('aud_' || substr(md5(random()::text), 1, 16)),
    "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Optional: Supabase Auth Sync Trigger (Automatically mirrors Supabase Auth sign-ups into the public.User table)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public."User" ("id", "email", "name", "avatarUrl", "googleId", "role")
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    new.id,
    'RESIDENT'
  )
  ON CONFLICT ("email") DO UPDATE
  SET 
    "name" = EXCLUDED."name",
    "avatarUrl" = EXCLUDED."avatarUrl",
    "googleId" = EXCLUDED."googleId";
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
