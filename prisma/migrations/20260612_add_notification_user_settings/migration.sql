-- CreateTable NotificationUserSetting
CREATE TABLE "NotificationUserSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinRequestStatus" BOOLEAN NOT NULL DEFAULT true,
    "milestoneStatus" BOOLEAN NOT NULL DEFAULT true,
    "mentorInvitationStatus" BOOLEAN NOT NULL DEFAULT true,
    "meetingReminders" BOOLEAN NOT NULL DEFAULT true,
    "projectApprovedRejected" BOOLEAN NOT NULL DEFAULT true,
    "taskDeadlineReminders" BOOLEAN NOT NULL DEFAULT true,
    "taskStatus" BOOLEAN NOT NULL DEFAULT true,
    "teamStatusChanges" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationUserSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationUserSetting_userId_key" ON "NotificationUserSetting"("userId");

-- CreateIndex
CREATE INDEX "NotificationUserSetting_userId_idx" ON "NotificationUserSetting"("userId");

-- AddForeignKey
ALTER TABLE "NotificationUserSetting" ADD CONSTRAINT "NotificationUserSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
