-- Keep join-request chats even if the JoinRequest row is removed
ALTER TABLE "Chat" DROP CONSTRAINT IF EXISTS "Chat_joinRequestId_fkey";

ALTER TABLE "Chat"
ADD CONSTRAINT "Chat_joinRequestId_fkey"
FOREIGN KEY ("joinRequestId") REFERENCES "JoinRequest"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
