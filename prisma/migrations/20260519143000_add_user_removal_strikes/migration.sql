-- Covered by 20260518143000_add_removal_strikes; safe no-op if already applied
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "removalStrikes" INTEGER NOT NULL DEFAULT 0;
