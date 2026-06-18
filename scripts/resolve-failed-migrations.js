/**
 * Clears a known failed migration so `prisma migrate deploy` can continue.
 * Safe to run on every build — does nothing if the failure is already resolved.
 */
const { execSync } = require("child_process");

const FAILED_MIGRATIONS_TO_ROLL_BACK = ["20260612_add_approval_settings"];

for (const migrationName of FAILED_MIGRATIONS_TO_ROLL_BACK) {
  try {
    execSync(`npx prisma migrate resolve --rolled-back "${migrationName}"`, {
      stdio: "pipe",
      env: process.env,
    });
    console.log(`[migrate] Cleared failed migration: ${migrationName}`);
  } catch {
    // Not in a failed state (already resolved or never ran) — ignore.
  }
}
