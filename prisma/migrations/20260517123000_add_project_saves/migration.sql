-- CreateTable
CREATE TABLE "ProjectSave" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectSave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSave_userId_projectId_key" ON "ProjectSave"("userId", "projectId");

-- CreateIndex
CREATE INDEX "ProjectSave_userId_idx" ON "ProjectSave"("userId");

-- CreateIndex
CREATE INDEX "ProjectSave_projectId_idx" ON "ProjectSave"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectSave" ADD CONSTRAINT "ProjectSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSave" ADD CONSTRAINT "ProjectSave_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GraduationProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
