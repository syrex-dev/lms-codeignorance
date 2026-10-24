-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('RICH_TEXT', 'FILE', 'VIDEO_LINK', 'EXTERNAL_LINK');

-- Bersihkan data konten lama jika ada untuk migrasi kolom NOT NULL
TRUNCATE TABLE "MaterialProgress", "Material", "Topic" CASCADE;

-- DropForeignKey
ALTER TABLE "MaterialProgress" DROP CONSTRAINT IF EXISTS "MaterialProgress_studentUserId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Material_topicId_orderIndex_idx";
DROP INDEX IF EXISTS "MaterialProgress_materialId_studentUserId_key";
DROP INDEX IF EXISTS "Topic_classCourseId_orderIndex_idx";

-- AlterTable Material
ALTER TABLE "Material" ADD COLUMN "institutionId" TEXT NOT NULL,
ADD COLUMN "isRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "status" "PublishStatus" NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN "type" "MaterialType" NOT NULL DEFAULT 'RICH_TEXT',
ADD COLUMN "url" TEXT;

-- AlterTable MaterialProgress
ALTER TABLE "MaterialProgress" ADD COLUMN "institutionId" TEXT NOT NULL,
ADD COLUMN "lastViewedAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable Topic
ALTER TABLE "Topic" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "institutionId" TEXT NOT NULL,
ADD COLUMN "meetingNumber" INTEGER,
ADD COLUMN "publishAt" TIMESTAMP(3),
ADD COLUMN "status" "PublishStatus" NOT NULL DEFAULT 'PUBLISHED';

-- CreateTable MaterialFile
CREATE TABLE "MaterialFile" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX "MaterialFile_institutionId_materialId_idx" ON "MaterialFile"("institutionId", "materialId");
CREATE INDEX "Material_institutionId_topicId_orderIndex_idx" ON "Material"("institutionId", "topicId", "orderIndex");
CREATE INDEX "MaterialProgress_institutionId_studentUserId_idx" ON "MaterialProgress"("institutionId", "studentUserId");
CREATE UNIQUE INDEX "MaterialProgress_studentUserId_materialId_key" ON "MaterialProgress"("studentUserId", "materialId");
CREATE INDEX "Topic_institutionId_classCourseId_orderIndex_idx" ON "Topic"("institutionId", "classCourseId", "orderIndex");

-- AddForeignKeys
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Material" ADD CONSTRAINT "Material_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialFile" ADD CONSTRAINT "MaterialFile_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialFile" ADD CONSTRAINT "MaterialFile_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialFile" ADD CONSTRAINT "MaterialFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaterialProgress" ADD CONSTRAINT "MaterialProgress_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialProgress" ADD CONSTRAINT "MaterialProgress_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) FOR PHASE 3 CLASSROOM TABLES
-- =========================================================================

-- 1. Topic RLS
ALTER TABLE "Topic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Topic" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "Topic";
CREATE POLICY tenant_isolation_policy ON "Topic" FOR ALL TO lms_app
USING ("institutionId" = current_setting('app.current_tenant', true))
WITH CHECK ("institutionId" = current_setting('app.current_tenant', true));

-- 2. Material RLS
ALTER TABLE "Material" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Material" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "Material";
CREATE POLICY tenant_isolation_policy ON "Material" FOR ALL TO lms_app
USING ("institutionId" = current_setting('app.current_tenant', true))
WITH CHECK ("institutionId" = current_setting('app.current_tenant', true));

-- 3. MaterialFile RLS
ALTER TABLE "MaterialFile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MaterialFile" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "MaterialFile";
CREATE POLICY tenant_isolation_policy ON "MaterialFile" FOR ALL TO lms_app
USING ("institutionId" = current_setting('app.current_tenant', true))
WITH CHECK ("institutionId" = current_setting('app.current_tenant', true));

-- 4. MaterialProgress RLS
ALTER TABLE "MaterialProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MaterialProgress" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "MaterialProgress";
CREATE POLICY tenant_isolation_policy ON "MaterialProgress" FOR ALL TO lms_app
USING ("institutionId" = current_setting('app.current_tenant', true))
WITH CHECK ("institutionId" = current_setting('app.current_tenant', true));

-- =========================================================================
-- PERMISSIONS GRANTS
-- =========================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON "Topic" TO lms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Material" TO lms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "MaterialFile" TO lms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "MaterialProgress" TO lms_app;

GRANT ALL ON "Topic" TO lms_platform;
GRANT ALL ON "Material" TO lms_platform;
GRANT ALL ON "MaterialFile" TO lms_platform;
GRANT ALL ON "MaterialProgress" TO lms_platform;
