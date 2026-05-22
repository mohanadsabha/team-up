-- AlterEnum
ALTER TYPE "ChatType" ADD VALUE IF NOT EXISTS 'JOIN_REQUEST';

-- AlterTable
ALTER TABLE "Chat" ADD COLUMN IF NOT EXISTS "joinRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Chat_joinRequestId_key" ON "Chat"("joinRequestId");

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_joinRequestId_fkey" FOREIGN KEY ("joinRequestId") REFERENCES "JoinRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
