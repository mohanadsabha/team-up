-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'MENTOR_INVITATION_SENT';
ALTER TYPE "NotificationType" ADD VALUE 'MENTOR_INVITATION_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'MENTOR_INVITATION_REJECTED';

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "mentorApproved" BOOLEAN NOT NULL DEFAULT false;
