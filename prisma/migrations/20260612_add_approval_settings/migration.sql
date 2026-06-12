-- AlterTable PlatformSettings
ALTER TABLE "PlatformSettings" ADD COLUMN "requireUserApproval" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PlatformSettings" ADD COLUMN "autoActivateUsers" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PlatformSettings" ADD COLUMN "allowPaidIdeas" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PlatformSettings" ADD COLUMN "requireIdeaApproval" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PlatformSettings" ADD COLUMN "requireTeamApproval" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PlatformSettings" ADD COLUMN "defaultMaxTeamMembers" INTEGER NOT NULL DEFAULT 5;
