/*
  Warnings:

  - You are about to drop the column `reminder10mSentAt` on the `Meeting` table. All the data in the column will be lost.
  - You are about to drop the column `reminder1hSentAt` on the `Meeting` table. All the data in the column will be lost.
  - You are about to drop the column `reminder24hSentAt` on the `Meeting` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Meeting" DROP COLUMN "reminder10mSentAt",
DROP COLUMN "reminder1hSentAt",
DROP COLUMN "reminder24hSentAt";
