-- Add removalStrikes column to User
ALTER TABLE "User" ADD COLUMN "removalStrikes" integer NOT NULL DEFAULT 0;
