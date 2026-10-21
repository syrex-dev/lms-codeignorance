-- ====================================================================
-- MIGRATION: Row-Level Security (RLS) & Non-Superuser Role Setup
-- ====================================================================

-- 1. Pastikan role non-superuser lms_app ada
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'lms_app') THEN
    CREATE ROLE lms_app WITH LOGIN PASSWORD 'app_secure_password_123' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE lms_db TO lms_app;
GRANT USAGE ON SCHEMA public TO lms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lms_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO lms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO lms_app;

-- 2. Terapkan RLS dan Force RLS pada tabel bertenant ketat (institutionId NOT NULL)
DO $$
DECLARE
    t text;
    strict_tenant_tables text[] := ARRAY[
        'User',
        'UserIdentifier',
        'Membership',
        'StudentProfile',
        'StaffProfile',
        'AcademicTerm',
        'ProgramDepartment',
        'ClassCourse',
        'Room',
        'TimeSlot',
        'ScheduleEntry',
        'ExamSchedule',
        'Announcement',
        'AdmissionPeriod',
        'Applicant',
        'QuestionBank',
        'Notification',
        'FeeComponent',
        'Invoice',
        'ScholarshipSponsor',
        'ScholarshipScheme',
        'SponsorInvoice',
        'Subscription',
        'UsageRecord',
        'TenantFeatureOverride',
        'TenantDomain',
        'IdCounter'
    ];
    nullable_tenant_tables text[] := ARRAY[
        'OtpChallenge',
        'AuditLog',
        'LoginAttempt'
    ];
BEGIN
    -- Strict tenant tables
    FOREACH t IN ARRAY strict_tenant_tables
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
        
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', t);
        EXECUTE format(
            'CREATE POLICY tenant_isolation_policy ON %I FOR ALL TO lms_app ' ||
            'USING ("institutionId" = current_setting(''app.current_tenant'', true)) ' ||
            'WITH CHECK ("institutionId" = current_setting(''app.current_tenant'', true));',
            t
        );
    END LOOP;

    -- Nullable tenant tables (mendukung auth pra-registrasi, signup tenant, platform login)
    FOREACH t IN ARRAY nullable_tenant_tables
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
        
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', t);
        EXECUTE format(
            'CREATE POLICY tenant_isolation_policy ON %I FOR ALL TO lms_app ' ||
            'USING (' ||
            '  "institutionId" IS NULL OR ' ||
            '  "institutionId" = current_setting(''app.current_tenant'', true) OR ' ||
            '  current_setting(''app.current_tenant'', true) IS NULL OR ' ||
            '  current_setting(''app.current_tenant'', true) = ''''' ||
            ') ' ||
            'WITH CHECK (' ||
            '  "institutionId" IS NULL OR ' ||
            '  "institutionId" = current_setting(''app.current_tenant'', true) OR ' ||
            '  current_setting(''app.current_tenant'', true) IS NULL OR ' ||
            '  current_setting(''app.current_tenant'', true) = ''''' ||
            ');',
            t
        );
    END LOOP;
END
$$;
