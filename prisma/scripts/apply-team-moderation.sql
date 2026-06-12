ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "previousStatus" "ProjectStatus";
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "moderationState" TEXT;
