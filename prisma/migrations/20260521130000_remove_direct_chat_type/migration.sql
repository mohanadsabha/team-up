BEGIN;

UPDATE "Chat"
SET "type" = 'TEAM'
WHERE "type" = 'DIRECT';

ALTER TYPE "ChatType" RENAME TO "ChatType_old";

CREATE TYPE "ChatType" AS ENUM ('TEAM', 'JOIN_REQUEST');

ALTER TABLE "Chat"
  ALTER COLUMN "type" DROP DEFAULT,
  ALTER COLUMN "type" TYPE "ChatType"
    USING "type"::text::"ChatType";

ALTER TABLE "Chat"
  ALTER COLUMN "type" SET DEFAULT 'TEAM';

DROP TYPE "ChatType_old";

COMMIT;
