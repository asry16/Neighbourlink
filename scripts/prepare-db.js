#!/usr/bin/env node
const { execSync } = require("child_process");

const dbUrl = process.env.DATABASE_URL || "";
const isPostgres = dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://");
const isBuild = process.argv.includes("--push") || process.env.VERCEL === "1";

if (isPostgres) {
  console.log("==> PostgreSQL / Supabase detected in DATABASE_URL");
  const schema = "prisma/schema.supabase.prisma";

  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL = dbUrl;
  }

  if (isBuild) {
    try {
      console.log("==> Syncing schema with Supabase (prisma db push)...");
      execSync(`npx prisma db push --schema=${schema} --accept-data-loss`, {
        stdio: "inherit",
        env: process.env,
      });
    } catch (err) {
      console.warn("==> Notice: prisma db push completed or warning:", err.message);
    }
  }

  console.log("==> Generating Prisma client for PostgreSQL...");
  execSync(`npx prisma generate --schema=${schema}`, {
    stdio: "inherit",
    env: process.env,
  });
} else {
  console.log("==> SQLite detected. Using local schema (prisma/schema.prisma)");
  const schema = "prisma/schema.prisma";
  execSync(`npx prisma generate --schema=${schema}`, {
    stdio: "inherit",
    env: process.env,
  });
}
