-- Creates PlatformSettings first (this migration runs before add_platform_settings alphabetically).
CREATE TABLE IF NOT EXISTS "PlatformSettings" (
    "id" TEXT NOT NULL,
    "platformName" TEXT NOT NULL DEFAULT 'TeamUp',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en-US',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "dateFormat" TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
    "logoUrl" TEXT,
    "isLive" BOOLEAN NOT NULL DEFAULT true,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT,
    "requireUserApproval" BOOLEAN NOT NULL DEFAULT false,
    "autoActivateUsers" BOOLEAN NOT NULL DEFAULT false,
    "allowPaidIdeas" BOOLEAN NOT NULL DEFAULT true,
    "requireIdeaApproval" BOOLEAN NOT NULL DEFAULT true,
    "requireTeamApproval" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- Safe if the table already existed from a partial deploy.
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "requireUserApproval" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "autoActivateUsers" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "allowPaidIdeas" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "requireIdeaApproval" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "requireTeamApproval" BOOLEAN NOT NULL DEFAULT true;
