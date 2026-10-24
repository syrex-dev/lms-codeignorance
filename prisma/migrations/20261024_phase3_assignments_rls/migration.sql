-- Truncate existing data if any
TRUNCATE TABLE "Submission", "Assignment" CASCADE;

-- AlterTable Assignment
ALTER TABLE "Assignment" ADD COLUMN "institutionId" TEXT NOT NULL,
ADD COLUMN "status" "PublishStatus" NOT NULL DEFAULT 'PUBLISHED';

-- AlterTable Submission
ALTER TABLE "Submission" ADD COLUMN "institutionId" TEXT NOT NULL;

-- CreateIndexes
CREATE INDEX "Assignment_institutionId_classCourseId_idx" ON "Assignment"("institutionId", "classCourseId");
CREATE INDEX "Submission_institutionId_studentUserId_idx" ON "Submission"("institutionId", "studentUserId");
CREATE INDEX "Submission_institutionId_assignmentId_idx" ON "Submission"("institutionId", "assignmentId");

-- AddForeignKeys
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) FOR ASSIGNMENTS & SUBMISSIONS
-- =========================================================================

-- 1. Assignment RLS
ALTER TABLE "Assignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Assignment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "Assignment";
CREATE POLICY tenant_isolation_policy ON "Assignment" FOR ALL TO lms_app
USING ("institutionId" = current_setting('app.current_tenant', true))
WITH CHECK ("institutionId" = current_setting('app.current_tenant', true));

-- 2. Submission RLS
ALTER TABLE "Submission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Submission" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "Submission";
CREATE POLICY tenant_isolation_policy ON "Submission" FOR ALL TO lms_app
USING ("institutionId" = current_setting('app.current_tenant', true))
WITH CHECK ("institutionId" = current_setting('app.current_tenant', true));

-- =========================================================================
-- PERMISSIONS GRANTS
-- =========================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON "Assignment" TO lms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Submission" TO lms_app;

GRANT ALL ON "Assignment" TO lms_platform;
GRANT ALL ON "Submission" TO lms_platform;

-- =========================================================================
-- 3. AuditLog RLS Fail-Closed
-- =========================================================================
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON "AuditLog";
DROP POLICY IF EXISTS tenant_isolation_select_policy ON "AuditLog";
DROP POLICY IF EXISTS tenant_isolation_insert_policy ON "AuditLog";

CREATE POLICY tenant_isolation_insert_policy ON "AuditLog" FOR INSERT TO lms_app
WITH CHECK (true);

CREATE POLICY tenant_isolation_select_policy ON "AuditLog" FOR SELECT TO lms_app
USING (
  (
    current_setting('app.current_tenant', true) IS NOT NULL AND
    current_setting('app.current_tenant', true) <> '' AND
    "institutionId" = current_setting('app.current_tenant', true)
  )
  OR
  (
    current_query() ~* '^\s*INSERT\s+INTO\s+.*"AuditLog"'
  )
);
