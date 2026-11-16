-- ============================================================================
-- Naafay Dar-ul-Ifta & Takhassus fil Fiqh Management System
-- Unified Database Schema & Complete Seed Data
-- ============================================================================
-- Note: This script resets and rebuilds the clean public schema.
-- Copy and paste this ENTIRE file into Supabase SQL Editor and click "Run".
-- ============================================================================

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";



-- ============================================================================
-- MIGRATION: 001_academic_schema.sql
-- ============================================================================

-- ============================================================================
-- Naafay Dar-ul-Ifta & Takhassus fil Fiqh Management System
-- Migration 001: Shared Core & Academic Management Schema (31 Tables)
-- Compatible with Supabase PostgreSQL (Auth + Storage + RLS)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. SHARED AUTH, PROFILES & RBAC
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT NOT NULL,
  full_name_ur TEXT,
  phone TEXT,
  avatar_url TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'ur' CHECK (preferred_language IN ('ur', 'en')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK (name IN ('admin', 'office_staff', 'teacher', 'student', 'mufti', 'senior_mufti')),
  title_en TEXT NOT NULL,
  title_ur TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  module TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- ----------------------------------------------------------------------------
-- 2. ACADEMIC STRUCTURE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title_en TEXT NOT NULL,
  title_ur TEXT NOT NULL,
  hijri_year TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ur TEXT NOT NULL,
  level_order INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_ur TEXT NOT NULL,
  capacity INTEGER DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ur TEXT NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  title_en TEXT NOT NULL,
  title_ur TEXT NOT NULL,
  author TEXT,
  total_pages INTEGER NOT NULL DEFAULT 0,
  total_chapters INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. STUDENTS, GUARDIANS, TEACHERS & ENROLLMENTS
-- ----------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.student_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.teacher_code_seq START 1;

CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  student_code TEXT NOT NULL UNIQUE, -- Auto-generated ST-0001
  full_name TEXT NOT NULL,
  full_name_ur TEXT,
  father_name TEXT NOT NULL,
  father_name_ur TEXT,
  date_of_birth DATE,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  address_ur TEXT,
  previous_education TEXT,
  previous_education_ur TEXT,
  admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  academic_year_id UUID REFERENCES public.academic_years(id),
  class_id UUID REFERENCES public.classes(id),
  batch_id UUID REFERENCES public.batches(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'graduated', 'suspended', 'withdrawn')),
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.generate_student_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.student_code IS NULL OR NEW.student_code = '' THEN
    NEW.student_code := 'ST-' || LPAD(NEXTVAL('public.student_code_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_student_code ON public.students;
CREATE TRIGGER trg_student_code
  BEFORE INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.generate_student_code();

CREATE TABLE IF NOT EXISTS public.guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  full_name_ur TEXT,
  phone TEXT NOT NULL,
  whatsapp TEXT,
  cnic TEXT,
  occupation TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES public.guardians(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'father',
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(student_id, guardian_id)
);

CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  roll_number TEXT,
  status TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'promoted', 'completed', 'dropped')),
  enrolled_at DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(student_id, academic_year_id, class_id)
);

CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  teacher_code TEXT NOT NULL UNIQUE, -- TCH-0001
  full_name TEXT NOT NULL,
  full_name_ur TEXT,
  qualification TEXT NOT NULL,
  qualification_ur TEXT,
  specialization TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
  responsibilities TEXT,
  responsibilities_ur TEXT,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.generate_teacher_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.teacher_code IS NULL OR NEW.teacher_code = '' THEN
    NEW.teacher_code := 'TCH-' || LPAD(NEXTVAL('public.teacher_code_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_teacher_code ON public.teachers;
CREATE TRIGGER trg_teacher_code
  BEFORE INSERT ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.generate_teacher_code();

CREATE TABLE IF NOT EXISTS public.teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  book_id UUID REFERENCES public.books(id) ON DELETE SET NULL,
  is_class_supervisor BOOLEAN NOT NULL DEFAULT FALSE,
  can_mark_attendance BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. THREE-SESSION ATTENDANCE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (code IN ('morning_zuhr', 'zuhr_asr', 'maghrib_isha')),
  name_en TEXT NOT NULL,
  name_ur TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE RESTRICT,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'leave', 'late')),
  remarks TEXT,
  marked_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Prevent duplicate attendance for same student, date, and session
  UNIQUE(student_id, attendance_date, session_id)
);

CREATE TABLE IF NOT EXISTS public.attendance_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id UUID NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  previous_status TEXT NOT NULL CHECK (previous_status IN ('present', 'absent', 'leave', 'late')),
  new_status TEXT NOT NULL CHECK (new_status IN ('present', 'absent', 'leave', 'late')),
  reason TEXT NOT NULL,
  corrected_by UUID REFERENCES public.profiles(id),
  corrected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. DAILY MUTALA (STUDENT) & LESSON RECORDS (TEACHER)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.study_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  study_date DATE NOT NULL DEFAULT CURRENT_DATE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
  chapter TEXT NOT NULL,
  start_position TEXT NOT NULL,
  end_position TEXT NOT NULL,
  study_details TEXT NOT NULL,
  student_comments TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'needs_correction')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.study_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_log_id UUID NOT NULL REFERENCES public.study_logs(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  reviewer_profile_id UUID REFERENCES public.profiles(id),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'needs_correction')),
  comments TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lesson_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  lesson_date DATE NOT NULL DEFAULT CURRENT_DATE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
  start_position TEXT NOT NULL,
  end_position TEXT NOT NULL,
  homework TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. EXAMINATIONS & RESULTS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title_en TEXT NOT NULL,
  title_ur TEXT NOT NULL,
  exam_type TEXT NOT NULL DEFAULT 'term' CHECK (exam_type IN ('monthly', 'term', 'annual', 'special')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exam_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  book_id UUID REFERENCES public.books(id) ON DELETE SET NULL,
  exam_date DATE,
  written_max_marks NUMERIC(6,2) NOT NULL DEFAULT 80,
  oral_max_marks NUMERIC(6,2) NOT NULL DEFAULT 20,
  passing_marks NUMERIC(6,2) NOT NULL DEFAULT 40,
  UNIQUE(exam_id, subject_id)
);

CREATE TABLE IF NOT EXISTS public.exam_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  exam_subject_id UUID NOT NULL REFERENCES public.exam_subjects(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  written_marks NUMERIC(6,2) NOT NULL DEFAULT 0,
  oral_marks NUMERIC(6,2) NOT NULL DEFAULT 0,
  total_marks NUMERIC(6,2) GENERATED ALWAYS AS (written_marks + oral_marks) STORED,
  grade TEXT,
  remarks TEXT,
  entered_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(exam_subject_id, student_id)
);

-- ----------------------------------------------------------------------------
-- 7. RESEARCH (MAQALA / TAHQEEQ) MANAGEMENT
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.research_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
  title_en TEXT NOT NULL,
  title_ur TEXT NOT NULL,
  field_of_fiqh TEXT,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.research_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.research_topics(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  supervisor_teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  deadline DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'submitted', 'needs_correction', 'resubmitted', 'approved', 'archived')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.research_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.research_assignments(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  notes TEXT,
  submitted_by UUID REFERENCES public.profiles(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.research_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.research_assignments(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES public.research_submissions(id) ON DELETE SET NULL,
  supervisor_teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  decision TEXT NOT NULL CHECK (decision IN ('needs_correction', 'approved')),
  comments TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 8. DOCUMENTS, NOTIFICATIONS & AUDIT LOGS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('student', 'teacher', 'research', 'exam', 'general')),
  entity_id UUID NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'certificate',
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title_en TEXT NOT NULL,
  title_ur TEXT NOT NULL,
  body_en TEXT NOT NULL,
  body_ur TEXT NOT NULL,
  module TEXT NOT NULL,
  reference_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id UUID REFERENCES public.profiles(id),
  actor_name TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_date_session ON public.attendance_records(attendance_date, session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_study_logs_student ON public.study_logs(student_id, study_date);
CREATE INDEX IF NOT EXISTS idx_lesson_records_teacher ON public.lesson_records(teacher_id, lesson_date);
CREATE INDEX IF NOT EXISTS idx_exam_results_student ON public.exam_results(student_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);


-- ============================================================================
-- MIGRATION: 002_rls_policies.sql
-- ============================================================================

-- ============================================================================
-- Naafay Dar-ul-Ifta & Takhassus fil Fiqh Management System
-- Migration 002: Row Level Security (RLS) & Storage Policies
-- ============================================================================

-- Helper functions for RBAC
CREATE OR REPLACE FUNCTION public.has_role(target_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.name = target_role
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin_or_staff()
RETURNS BOOLEAN AS $$
  SELECT public.has_role('admin') OR public.has_role('office_staff');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.current_student_id()
RETURNS UUID AS $$
  SELECT id FROM public.students WHERE profile_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.current_teacher_id()
RETURNS UUID AS $$
  SELECT id FROM public.teachers WHERE profile_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.teacher_teaches_class(target_class_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_assignments
    WHERE teacher_id = public.current_teacher_id()
      AND class_id = target_class_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles & Roles
CREATE POLICY "profiles_read_self_or_staff" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_admin_or_staff() OR public.has_role('teacher'));
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles
  FOR UPDATE USING (id = auth.uid() OR public.has_role('admin'));

CREATE POLICY "lookups_authenticated_read" ON public.roles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "academic_years_read" ON public.academic_years FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "classes_read" ON public.classes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "batches_read" ON public.batches FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "subjects_read" ON public.subjects FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "books_read" ON public.books FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "sessions_read" ON public.attendance_sessions FOR SELECT USING (auth.role() = 'authenticated');

-- Admin full write on academic structure
CREATE POLICY "admin_manage_roles" ON public.user_roles FOR ALL USING (public.has_role('admin'));
CREATE POLICY "admin_manage_years" ON public.academic_years FOR ALL USING (public.has_role('admin'));
CREATE POLICY "admin_manage_classes" ON public.classes FOR ALL USING (public.has_role('admin'));
CREATE POLICY "admin_manage_batches" ON public.batches FOR ALL USING (public.has_role('admin'));
CREATE POLICY "admin_manage_subjects" ON public.subjects FOR ALL USING (public.has_role('admin'));
CREATE POLICY "admin_manage_books" ON public.books FOR ALL USING (public.has_role('admin'));

-- Students: private data protection! Never publicly accessible.
CREATE POLICY "students_select_scoped" ON public.students
  FOR SELECT USING (
    public.is_admin_or_staff()
    OR id = public.current_student_id()
    OR (public.has_role('teacher') AND public.teacher_teaches_class(class_id))
  );
CREATE POLICY "students_write_admin_staff" ON public.students
  FOR ALL USING (public.is_admin_or_staff());

CREATE POLICY "guardians_scoped_select" ON public.guardians
  FOR SELECT USING (
    public.is_admin_or_staff()
    OR EXISTS (
      SELECT 1 FROM public.student_guardians sg
      WHERE sg.guardian_id = guardians.id AND sg.student_id = public.current_student_id()
    )
  );
CREATE POLICY "guardians_write_admin_staff" ON public.guardians
  FOR ALL USING (public.is_admin_or_staff());

-- Teachers
CREATE POLICY "teachers_read_authenticated" ON public.teachers
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "teachers_manage_admin" ON public.teachers
  FOR ALL USING (public.has_role('admin') OR public.has_role('office_staff'));

CREATE POLICY "teacher_assignments_read" ON public.teacher_assignments
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "teacher_assignments_admin" ON public.teacher_assignments
  FOR ALL USING (public.has_role('admin'));

-- Attendance: Students CANNOT modify attendance. Teachers only assigned classes.
CREATE POLICY "attendance_select_scoped" ON public.attendance_records
  FOR SELECT USING (
    public.is_admin_or_staff()
    OR student_id = public.current_student_id()
    OR (public.has_role('teacher') AND public.teacher_teaches_class(class_id))
  );

CREATE POLICY "attendance_insert_authorized" ON public.attendance_records
  FOR INSERT WITH CHECK (
    public.is_admin_or_staff()
    OR (public.has_role('teacher') AND public.teacher_teaches_class(class_id))
  );

CREATE POLICY "attendance_update_authorized" ON public.attendance_records
  FOR UPDATE USING (
    public.is_admin_or_staff()
    OR (public.has_role('teacher') AND public.teacher_teaches_class(class_id))
  );

CREATE POLICY "attendance_corrections_select" ON public.attendance_corrections
  FOR SELECT USING (
    public.is_admin_or_staff() OR public.has_role('teacher')
  );
CREATE POLICY "attendance_corrections_insert" ON public.attendance_corrections
  FOR INSERT WITH CHECK (
    public.is_admin_or_staff() OR public.has_role('teacher')
  );

-- Daily Mutala: Students submit own; Teachers review assigned classes
CREATE POLICY "study_logs_select_scoped" ON public.study_logs
  FOR SELECT USING (
    public.is_admin_or_staff()
    OR student_id = public.current_student_id()
    OR (
      public.has_role('teacher') AND EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = study_logs.student_id AND public.teacher_teaches_class(s.class_id)
      )
    )
  );

CREATE POLICY "study_logs_student_insert" ON public.study_logs
  FOR INSERT WITH CHECK (
    student_id = public.current_student_id() OR public.is_admin_or_staff()
  );

CREATE POLICY "study_logs_update_scoped" ON public.study_logs
  FOR UPDATE USING (
    public.is_admin_or_staff()
    OR (student_id = public.current_student_id() AND status != 'approved')
    OR (
      public.has_role('teacher') AND EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = study_logs.student_id AND public.teacher_teaches_class(s.class_id)
      )
    )
  );

CREATE POLICY "study_reviews_select" ON public.study_reviews
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "study_reviews_teacher_insert" ON public.study_reviews
  FOR INSERT WITH CHECK (public.has_role('teacher') OR public.has_role('admin'));

-- Lesson Records: Teachers & Admin
CREATE POLICY "lesson_records_select" ON public.lesson_records
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "lesson_records_teacher_write" ON public.lesson_records
  FOR ALL USING (
    public.has_role('admin')
    OR (public.has_role('teacher') AND teacher_id = public.current_teacher_id())
  );

-- Exams & Results
CREATE POLICY "exams_read" ON public.exams FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "exams_admin_write" ON public.exams FOR ALL USING (public.is_admin_or_staff());
CREATE POLICY "exam_subjects_read" ON public.exam_subjects FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "exam_subjects_admin_write" ON public.exam_subjects FOR ALL USING (public.is_admin_or_staff());

CREATE POLICY "exam_results_select_scoped" ON public.exam_results
  FOR SELECT USING (
    public.is_admin_or_staff()
    OR public.has_role('teacher')
    OR student_id = public.current_student_id()
  );
CREATE POLICY "exam_results_write_teacher_admin" ON public.exam_results
  FOR ALL USING (public.is_admin_or_staff() OR public.has_role('teacher'));

-- Research
CREATE POLICY "research_topics_read" ON public.research_topics FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "research_topics_write" ON public.research_topics FOR ALL USING (public.has_role('admin') OR public.has_role('teacher'));

CREATE POLICY "research_assignments_select" ON public.research_assignments
  FOR SELECT USING (
    public.is_admin_or_staff()
    OR student_id = public.current_student_id()
    OR supervisor_teacher_id = public.current_teacher_id()
    OR status = 'approved'
  );
CREATE POLICY "research_assignments_write" ON public.research_assignments
  FOR ALL USING (public.has_role('admin') OR public.has_role('teacher'));

CREATE POLICY "research_submissions_select" ON public.research_submissions
  FOR SELECT USING (
    public.is_admin_or_staff()
    OR EXISTS (
      SELECT 1 FROM public.research_assignments ra
      WHERE ra.id = assignment_id
        AND (ra.student_id = public.current_student_id() OR ra.supervisor_teacher_id = public.current_teacher_id() OR ra.status = 'approved')
    )
  );
CREATE POLICY "research_submissions_insert" ON public.research_submissions
  FOR INSERT WITH CHECK (
    public.is_admin_or_staff()
    OR EXISTS (
      SELECT 1 FROM public.research_assignments ra
      WHERE ra.id = assignment_id AND ra.student_id = public.current_student_id()
    )
  );

-- Documents, Notifications & Audit Logs
CREATE POLICY "documents_select_scoped" ON public.documents
  FOR SELECT USING (
    public.is_admin_or_staff()
    OR public.has_role('teacher')
    OR (entity_type = 'student' AND entity_id = public.current_student_id())
  );
CREATE POLICY "documents_write_staff" ON public.documents
  FOR ALL USING (public.is_admin_or_staff() OR public.has_role('teacher'));

CREATE POLICY "notifications_self" ON public.notifications
  FOR ALL USING (recipient_profile_id = auth.uid() OR public.has_role('admin'));

CREATE POLICY "audit_logs_admin_staff" ON public.audit_logs
  FOR SELECT USING (public.is_admin_or_staff());
CREATE POLICY "audit_logs_insert_auth" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Storage Bucket for Academic Documents & Research Files (Private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('academic-documents', 'academic-documents', FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "academic_docs_authenticated_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'academic-documents' AND auth.role() = 'authenticated');
CREATE POLICY "academic_docs_authenticated_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'academic-documents' AND auth.role() = 'authenticated');


-- ============================================================================
-- MIGRATION: 003_seed_data.sql
-- ============================================================================

-- ============================================================================
-- Naafay Dar-ul-Ifta & Takhassus fil Fiqh Management System
-- Migration 003: Seed Core Lookups (Roles, 3 Sessions, Academic Years, Classes, Books)
-- ============================================================================

INSERT INTO public.roles (name, title_en, title_ur, description) VALUES
  ('admin', 'Administrator (Nazim)', 'ناظمِ تعلیمات (ایڈمن)', 'Full management over the academic module'),
  ('office_staff', 'Office Staff', 'دفتری عملہ', 'Manage student admissions, documents, attendance & reports'),
  ('teacher', 'Teacher / Mufti', 'استاذ / مفتی', 'Record lessons, mark attendance, review Mutala & research'),
  ('student', 'Student (Talib-e-Ilm)', 'طالبِ علم', 'View personal records, submit daily Mutala & research')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.attendance_sessions (code, name_en, name_ur, start_time, end_time, sort_order) VALUES
  ('morning_zuhr', 'Morning to Zuhr', 'صبح تا ظہر', '07:30:00', '13:00:00', 1),
  ('zuhr_asr', 'Zuhr to Asr', 'ظہر تا عصر', '14:00:00', '16:30:00', 2),
  ('maghrib_isha', 'Maghrib to Isha', 'مغرب تا عشاء', '18:00:00', '21:00:00', 3)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.academic_years (code, title_en, title_ur, hijri_year, start_date, end_date, is_current) VALUES
  ('1447-1448', 'Academic Year 2026-2027', 'تعلیمی سال ۱۴۴۷-۱۴۴۸ھ', '1447-1448 AH', '2026-04-01', '2027-03-15', TRUE),
  ('1446-1447', 'Academic Year 2025-2026', 'تعلیمی سال ۱۴۴۶-۱۴۴۷ھ', '1446-1447 AH', '2025-04-01', '2026-03-15', FALSE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.classes (code, name_en, name_ur, level_order) VALUES
  ('TAK-1', 'Takhassus fil Fiqh — Year 1', 'تخصص فی الفقہ — سالِ اول', 1),
  ('TAK-2', 'Takhassus fil Fiqh — Year 2', 'تخصص فی الفقہ — سالِ دوم', 2),
  ('TAK-IFTA', 'Tamreen-e-Ifta Fellowship', 'تمرینِ افتاء و تحقیق', 3)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.subjects (code, name_en, name_ur) VALUES
  ('FIQH-HAN', 'Hanafi Jurisprudence (Fiqh)', 'فقہِ حنفی'),
  ('USOOL-IFTA', 'Principles of Issuing Fatwa', 'اصولِ افتاء و رسم المفتی'),
  ('QAWAID', 'Legal Maxims (Al-Qawaid al-Fiqhiyyah)', 'القواعد الفقہیہ'),
  ('MUAMALAT', 'Islamic Financial Transactions', 'اسلامی معاشیات و معاملات'),
  ('AHWAL', 'Personal Status & Family Law', 'احوالِ شخصیہ و کتاب النکاح'),
  ('TAHQEEQ', 'Methodology of Fiqh Research', 'اصولِ تحقیق و مقالہ نگاری')
ON CONFLICT (code) DO NOTHING;


-- ============================================================================
-- MIGRATION: 004_darul_ifta_schema.sql
-- ============================================================================

-- ============================================================================
-- Naafay Dar-ul-Ifta & Takhassus fil Fiqh Management System
-- Migration 004: Dar-ul-Ifta Management Schema (Part 2)
-- Reuses shared profiles, roles, documents, notifications, audit_logs
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.fatwa_question_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.fatwa_issued_seq START 1;

CREATE TABLE IF NOT EXISTS public.fatwa_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ur TEXT NOT NULL,
  name_ar TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fatwa_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fatwa_code TEXT NOT NULL UNIQUE, -- FAT-2026-0001
  issued_fatwa_number TEXT UNIQUE, -- NA-FATWA-2026-0001 (generated on issuance)
  question_date DATE NOT NULL DEFAULT CURRENT_DATE,
  questioner_name TEXT NOT NULL,
  questioner_phone TEXT,
  questioner_email TEXT,
  city TEXT,
  country TEXT DEFAULT 'Pakistan',
  category_id UUID NOT NULL REFERENCES public.fatwa_categories(id) ON DELETE RESTRICT,
  subject_title TEXT NOT NULL,
  subject_title_ur TEXT,
  question_text TEXT NOT NULL,
  is_identity_private BOOLEAN NOT NULL DEFAULT TRUE,
  allow_public_identity BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'office' CHECK (source IN ('office', 'public_portal', 'whatsapp', 'email', 'letter')),
  workflow_status TEXT NOT NULL DEFAULT 'registered' CHECK (
    workflow_status IN (
      'received', 'registered', 'assigned', 'research',
      'draft', 'senior_review', 'final_approval', 'issued'
    )
  ),
  publication_status TEXT NOT NULL DEFAULT 'internal_only' CHECK (
    publication_status IN ('internal_only', 'pending_publication', 'published')
  ),
  registered_by UUID REFERENCES public.profiles(id),
  issued_at TIMESTAMPTZ,
  issued_pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.generate_fatwa_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fatwa_code IS NULL OR NEW.fatwa_code = '' THEN
    NEW.fatwa_code := 'FAT-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(NEXTVAL('public.fatwa_question_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fatwa_code ON public.fatwa_questions;
CREATE TRIGGER trg_fatwa_code
  BEFORE INSERT ON public.fatwa_questions
  FOR EACH ROW EXECUTE FUNCTION public.generate_fatwa_code();

CREATE TABLE IF NOT EXISTS public.fatwa_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.fatwa_questions(id) ON DELETE CASCADE,
  assignee_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignee_role TEXT NOT NULL CHECK (assignee_role IN ('student', 'researcher', 'mufti', 'senior_mufti')),
  assigned_by UUID REFERENCES public.profiles(id),
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  deadline DATE,
  instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fatwa_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.fatwa_questions(id) ON DELETE CASCADE,
  author_profile_id UUID REFERENCES public.profiles(id),
  research_notes TEXT NOT NULL,
  related_books TEXT,
  arabic_quotations TEXT,
  urdu_explanation TEXT,
  fiqhi_opinions TEXT,
  supporting_evidence TEXT,
  researcher_comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fatwa_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.fatwa_questions(id) ON DELETE CASCADE,
  book_name TEXT NOT NULL,
  author TEXT,
  volume TEXT,
  page_number TEXT,
  chapter TEXT,
  arabic_quotation TEXT NOT NULL,
  explanation TEXT,
  reference_notes TEXT,
  is_reusable BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fatwa_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL UNIQUE REFERENCES public.fatwa_questions(id) ON DELETE CASCADE,
  draft_title TEXT,
  draft_body_ur TEXT NOT NULL DEFAULT '',
  draft_body_ar TEXT DEFAULT '',
  current_version INTEGER NOT NULL DEFAULT 1,
  last_edited_by UUID REFERENCES public.profiles(id),
  autosaved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fatwa_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.fatwa_questions(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  draft_body_ur TEXT NOT NULL,
  draft_body_ar TEXT,
  references_snapshot JSONB DEFAULT '[]'::jsonb,
  saved_by UUID REFERENCES public.profiles(id),
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(question_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.fatwa_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.fatwa_questions(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  reviewer_profile_id UUID NOT NULL REFERENCES public.profiles(id),
  decision TEXT NOT NULL CHECK (decision IN ('approved_for_final', 'corrections_requested', 'returned')),
  comments TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fatwa_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.fatwa_questions(id) ON DELETE CASCADE,
  approver_profile_id UUID NOT NULL REFERENCES public.profiles(id),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'issued', 'returned_to_review')),
  comments TEXT,
  approved_version INTEGER NOT NULL,
  issued_fatwa_number TEXT,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fatwa_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL UNIQUE REFERENCES public.fatwa_questions(id) ON DELETE CASCADE,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  public_title_ur TEXT,
  public_title_en TEXT,
  public_question_text TEXT,
  public_answer_text TEXT,
  approved_by UUID REFERENCES public.profiles(id),
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fatwa_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.fatwa_questions(id) ON DELETE CASCADE,
  research_id UUID REFERENCES public.fatwa_research(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fatwa_questions_status ON public.fatwa_questions(workflow_status, publication_status);
CREATE INDEX IF NOT EXISTS idx_fatwa_questions_cat ON public.fatwa_questions(category_id);
CREATE INDEX IF NOT EXISTS idx_fatwa_assignments_user ON public.fatwa_assignments(assignee_profile_id, is_active);
CREATE INDEX IF NOT EXISTS idx_fatwa_references_book ON public.fatwa_references(book_name);


-- ============================================================================
-- MIGRATION: 005_darul_ifta_rls.sql
-- ============================================================================

-- ============================================================================
-- Naafay Dar-ul-Ifta & Takhassus fil Fiqh Management System
-- Migration 005: Dar-ul-Ifta Row Level Security (RLS) Policies
-- ============================================================================

ALTER TABLE public.fatwa_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fatwa_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fatwa_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fatwa_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fatwa_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fatwa_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fatwa_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fatwa_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fatwa_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fatwa_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fatwa_attachments ENABLE ROW LEVEL SECURITY;

-- Helper: check if user is assigned to the question
CREATE OR REPLACE FUNCTION public.is_assigned_to_fatwa(target_question_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.fatwa_assignments
    WHERE question_id = target_question_id
      AND assignee_profile_id = auth.uid()
      AND is_active = TRUE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Categories: readable by all authenticated users, manageable by admin
CREATE POLICY "fatwa_categories_read" ON public.fatwa_categories
  FOR SELECT USING (auth.role() = 'authenticated' OR TRUE);
CREATE POLICY "fatwa_categories_admin" ON public.fatwa_categories
  FOR ALL USING (public.has_role('admin'));

-- Questions: Researchers/Students see ONLY assigned questions. Admin, Office Staff, Senior Mufti see all.
-- Public users NEVER directly read fatwa_questions (must read anonymized fatwa_publications).
CREATE POLICY "fatwa_questions_select_scoped" ON public.fatwa_questions
  FOR SELECT USING (
    public.has_role('admin')
    OR public.has_role('office_staff')
    OR public.has_role('senior_mufti')
    OR public.is_assigned_to_fatwa(id)
  );

CREATE POLICY "fatwa_questions_insert_staff" ON public.fatwa_questions
  FOR INSERT WITH CHECK (
    public.has_role('admin') OR public.has_role('office_staff') OR public.has_role('mufti') OR public.has_role('senior_mufti')
  );

CREATE POLICY "fatwa_questions_update_authorized" ON public.fatwa_questions
  FOR UPDATE USING (
    public.has_role('admin') OR public.has_role('senior_mufti') OR public.has_role('office_staff')
  );

-- Assignments
CREATE POLICY "fatwa_assignments_select" ON public.fatwa_assignments
  FOR SELECT USING (
    public.has_role('admin') OR public.has_role('senior_mufti') OR assignee_profile_id = auth.uid()
  );
CREATE POLICY "fatwa_assignments_write" ON public.fatwa_assignments
  FOR ALL USING (public.has_role('admin') OR public.has_role('senior_mufti'));

-- Research & References: assigned researchers + senior mufti + admin
CREATE POLICY "fatwa_research_select" ON public.fatwa_research
  FOR SELECT USING (
    public.has_role('admin') OR public.has_role('senior_mufti') OR public.is_assigned_to_fatwa(question_id)
  );
CREATE POLICY "fatwa_research_write" ON public.fatwa_research
  FOR ALL USING (
    public.has_role('admin') OR public.has_role('senior_mufti') OR public.is_assigned_to_fatwa(question_id)
  );

CREATE POLICY "fatwa_references_select" ON public.fatwa_references
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      is_reusable = TRUE OR public.has_role('admin') OR public.has_role('senior_mufti') OR public.is_assigned_to_fatwa(question_id)
    )
  );
CREATE POLICY "fatwa_references_write" ON public.fatwa_references
  FOR ALL USING (
    public.has_role('admin') OR public.has_role('senior_mufti') OR public.is_assigned_to_fatwa(question_id)
  );

-- Drafts & Versions: Private until authorized publication; students cannot finalize/issue
CREATE POLICY "fatwa_drafts_select" ON public.fatwa_drafts
  FOR SELECT USING (
    public.has_role('admin') OR public.has_role('senior_mufti') OR public.is_assigned_to_fatwa(question_id)
  );
CREATE POLICY "fatwa_drafts_write" ON public.fatwa_drafts
  FOR ALL USING (
    public.has_role('admin') OR public.has_role('senior_mufti') OR public.is_assigned_to_fatwa(question_id)
  );

CREATE POLICY "fatwa_versions_select" ON public.fatwa_versions
  FOR SELECT USING (
    public.has_role('admin') OR public.has_role('senior_mufti') OR public.is_assigned_to_fatwa(question_id)
  );
CREATE POLICY "fatwa_versions_insert" ON public.fatwa_versions
  FOR INSERT WITH CHECK (
    public.has_role('admin') OR public.has_role('senior_mufti') OR public.is_assigned_to_fatwa(question_id)
  );

-- Senior Reviews: Senior Mufti & Admin ONLY (immutable insert-only)
CREATE POLICY "fatwa_reviews_select" ON public.fatwa_reviews
  FOR SELECT USING (
    public.has_role('admin') OR public.has_role('senior_mufti') OR public.is_assigned_to_fatwa(question_id)
  );
CREATE POLICY "fatwa_reviews_insert" ON public.fatwa_reviews
  FOR INSERT WITH CHECK (
    public.has_role('admin') OR public.has_role('senior_mufti')
  );

-- Final Approvals: Nazim (admin) ONLY (immutable insert-only)
CREATE POLICY "fatwa_approvals_select" ON public.fatwa_approvals
  FOR SELECT USING (
    public.has_role('admin') OR public.has_role('senior_mufti') OR public.has_role('office_staff') OR public.is_assigned_to_fatwa(question_id)
  );
CREATE POLICY "fatwa_approvals_insert_nazim" ON public.fatwa_approvals
  FOR INSERT WITH CHECK (public.has_role('admin'));

-- Publications: Public Portal reads ONLY explicitly published anonymized rows
CREATE POLICY "fatwa_publications_public_read" ON public.fatwa_publications
  FOR SELECT USING (is_published = TRUE OR public.has_role('admin') OR public.has_role('senior_mufti'));
CREATE POLICY "fatwa_publications_nazim_write" ON public.fatwa_publications
  FOR ALL USING (public.has_role('admin'));

CREATE POLICY "fatwa_attachments_select" ON public.fatwa_attachments
  FOR SELECT USING (
    public.has_role('admin') OR public.has_role('office_staff') OR public.has_role('senior_mufti') OR public.is_assigned_to_fatwa(question_id)
  );
CREATE POLICY "fatwa_attachments_insert" ON public.fatwa_attachments
  FOR INSERT WITH CHECK (
    public.has_role('admin') OR public.has_role('office_staff') OR public.has_role('senior_mufti') OR public.is_assigned_to_fatwa(question_id)
  );


-- ============================================================================
-- MIGRATION: 006_darul_ifta_seed.sql
-- ============================================================================

-- ============================================================================
-- Naafay Dar-ul-Ifta & Takhassus fil Fiqh Management System
-- Migration 006: Seed 13 Configurable Fatwa Categories & Senior Mufti Role
-- ============================================================================

INSERT INTO public.roles (name, title_en, title_ur, description) VALUES
  ('senior_mufti', 'Senior Mufti', 'مفتیِ اعظم / سینئر مفتی', 'Reviews research, verifies references, and approves fatwa drafts for Nazim final approval')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.fatwa_categories (code, name_en, name_ur, name_ar, sort_order) VALUES
  ('TAHARAH', 'Taharah (Purification)', 'طہارت و پاکیزگی', 'کتاب الطهارة', 1),
  ('SALAH', 'Salah (Prayer)', 'نماز کے مسائل', 'کتاب الصلاة', 2),
  ('FASTING', 'Fasting (Sawm)', 'روزہ و اعتکاف', 'کتاب الصوم', 3),
  ('ZAKAT', 'Zakat & Charity', 'زکوٰۃ و صدقات', 'کتاب الزكاة', 4),
  ('HAJJ', 'Hajj and Umrah', 'حج و عمرہ', 'کتاب الحج', 5),
  ('NIKAH', 'Nikah (Marriage)', 'نکاح و عائلی مسائل', 'کتاب النکاح', 6),
  ('TALAQ', 'Talaq (Divorce)', 'طلاق و خلع و عدت', 'کتاب الطلاق', 7),
  ('INHERITANCE', 'Inheritance (Mirath)', 'وراثت و تقسیمِ ترکہ', 'کتاب الفرائض', 8),
  ('BUSINESS', 'Business Transactions', 'خرید و فروخت و تجارت', 'کتاب البيوع', 9),
  ('FINANCE', 'Islamic Finance', 'اسلامی بینکاری و مالیات', 'المعاملات المالية المعاصرة', 10),
  ('MEDICAL', 'Medical Issues', 'طبی و جدید شرعی مسائل', 'المسائل الطبية المعاصرة', 11),
  ('CONTEMPORARY', 'Contemporary Issues', 'معاصر و جدید مسائل', 'النوازل المعاصرة', 12),
  ('OTHER', 'Other Fiqh Matters', 'متفرق فقہی مسائل', 'مسائل فقهية متفرقة', 13)
ON CONFLICT (code) DO NOTHING;


-- ============================================================================
-- MIGRATION: 007_public_portal_schema.sql
-- ============================================================================

-- ============================================================================
-- Naafay Dar-ul-Ifta & Takhassus fil Fiqh Management System
-- Migration 007: Public Online Fatwa Portal Schema (Part 3)
-- Reuses shared fatwa_questions, fatwa_categories, fatwa_publications,
-- fatwa_attachments, and profiles tables.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SEQUENCE IF NOT EXISTS public.public_tracking_seq START 1;

CREATE TABLE IF NOT EXISTS public.portal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_name_en TEXT NOT NULL DEFAULT 'Naafay Dar-ul-Ifta',
  institution_name_ur TEXT NOT NULL DEFAULT 'نافع دارالافتاء',
  nazim_name_en TEXT NOT NULL DEFAULT 'Mufti Waris Naseeb',
  nazim_name_ur TEXT NOT NULL DEFAULT 'مفتی وارث نصیب',
  welcome_title_en TEXT NOT NULL,
  welcome_title_ur TEXT NOT NULL,
  welcome_body_en TEXT NOT NULL,
  welcome_body_ur TEXT NOT NULL,
  announcements JSONB NOT NULL DEFAULT '[]'::jsonb,
  contact_phone TEXT,
  contact_whatsapp TEXT,
  contact_email TEXT,
  contact_address_en TEXT,
  contact_address_ur TEXT,
  allow_optional_email BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.public_tracking_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL UNIQUE REFERENCES public.fatwa_questions(id) ON DELETE CASCADE,
  tracking_number TEXT NOT NULL UNIQUE, -- TRK-2026-0001
  verification_code_hash TEXT NOT NULL,
  mobile_hash TEXT NOT NULL,
  mobile_last4 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.public_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.fatwa_questions(id) ON DELETE CASCADE,
  tracking_token_id UUID NOT NULL REFERENCES public.public_tracking_tokens(id) ON DELETE CASCADE,
  ip_hash TEXT,
  user_agent TEXT,
  consent_accepted BOOLEAN NOT NULL DEFAULT TRUE,
  spam_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted', 'flagged', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_tracking_number ON public.public_tracking_tokens(tracking_number);
CREATE INDEX IF NOT EXISTS idx_public_submissions_created ON public.public_submissions(created_at DESC);

-- Helper for mapping internal workflow_status to public-safe tracking steps
CREATE OR REPLACE FUNCTION public.map_public_tracking_stage(wf_status TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE wf_status
    WHEN 'received' THEN 'received'
    WHEN 'registered' THEN 'received'
    WHEN 'assigned' THEN 'under_review'
    WHEN 'research' THEN 'research_in_progress'
    WHEN 'draft' THEN 'answer_preparation'
    WHEN 'senior_review' THEN 'answer_preparation'
    WHEN 'final_approval' THEN 'answer_preparation'
    WHEN 'issued' THEN 'completed'
    ELSE 'received'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Secure Tracking RPC (requires tracking_number + 2nd verification factor: mobile or verification code)
CREATE OR REPLACE FUNCTION public.track_public_fatwa_question(
  p_tracking_number TEXT,
  p_verification_factor TEXT
)
RETURNS TABLE (
  tracking_number TEXT,
  public_stage TEXT,
  submitted_date DATE,
  category_name_en TEXT,
  category_name_ur TEXT,
  is_published BOOLEAN,
  issued_fatwa_number TEXT
) AS $$
DECLARE
  v_hash TEXT;
  v_clean_mobile TEXT;
  v_mobile_hash TEXT;
BEGIN
  v_hash := encode(digest(upper(trim(p_verification_factor)), 'sha256'), 'hex');
  v_clean_mobile := regexp_replace(trim(p_verification_factor), '[^0-9]', '', 'g');
  v_mobile_hash := CASE WHEN length(v_clean_mobile) >= 6 THEN encode(digest(v_clean_mobile, 'sha256'), 'hex') ELSE '' END;

  RETURN QUERY
  SELECT
    ptt.tracking_number,
    public.map_public_tracking_stage(fq.workflow_status) AS public_stage,
    fq.question_date AS submitted_date,
    fc.name_en AS category_name_en,
    fc.name_ur AS category_name_ur,
    (fq.workflow_status = 'issued' AND fq.publication_status = 'published' AND COALESCE(fp.is_published, FALSE)) AS is_published,
    CASE
      WHEN fq.workflow_status = 'issued' AND fq.publication_status = 'published' AND COALESCE(fp.is_published, FALSE)
      THEN fq.issued_fatwa_number
      ELSE NULL
    END AS issued_fatwa_number
  FROM public.public_tracking_tokens ptt
  JOIN public.fatwa_questions fq ON fq.id = ptt.question_id
  JOIN public.fatwa_categories fc ON fc.id = fq.category_id
  LEFT JOIN public.fatwa_publications fp ON fp.question_id = fq.id
  WHERE upper(ptt.tracking_number) = upper(trim(p_tracking_number))
    AND (
      ptt.verification_code_hash = v_hash
      OR (v_mobile_hash <> '' AND ptt.mobile_hash = v_mobile_hash)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- MIGRATION: 008_public_portal_rls.sql
-- ============================================================================

-- ============================================================================
-- Naafay Dar-ul-Ifta & Takhassus fil Fiqh Management System
-- Migration 008: Public Portal Row Level Security (RLS) & Storage Policies
-- ============================================================================

ALTER TABLE public.portal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_tracking_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_submissions ENABLE ROW LEVEL SECURITY;

-- Portal settings: public read-only, admin write
CREATE POLICY "portal_settings_public_read" ON public.portal_settings
  FOR SELECT USING (TRUE);
CREATE POLICY "portal_settings_admin_write" ON public.portal_settings
  FOR ALL USING (public.has_role('admin'));

-- Tracking tokens & public submissions: NEVER directly readable by anon or unauthorized users
CREATE POLICY "public_tracking_tokens_admin_only" ON public.public_tracking_tokens
  FOR SELECT USING (public.has_role('admin') OR public.has_role('office_staff'));

CREATE POLICY "public_submissions_admin_only" ON public.public_submissions
  FOR SELECT USING (public.has_role('admin') OR public.has_role('office_staff'));

-- Public visitors can read active categories for browsing & filtering
DROP POLICY IF EXISTS "fatwa_categories_read" ON public.fatwa_categories;
CREATE POLICY "fatwa_categories_read_public" ON public.fatwa_categories
  FOR SELECT USING (is_active = TRUE OR public.has_role('admin'));

-- Only explicitly published fatwa_publications are readable publicly;
-- fatwa_questions remains strictly locked to internal staff & assigned researchers.
DROP POLICY IF EXISTS "fatwa_publications_public_read" ON public.fatwa_publications;
CREATE POLICY "fatwa_publications_public_read" ON public.fatwa_publications
  FOR SELECT USING (
    (
      is_published = TRUE
      AND EXISTS (
        SELECT 1 FROM public.fatwa_questions fq
        WHERE fq.id = fatwa_publications.question_id
          AND fq.workflow_status = 'issued'
          AND fq.publication_status = 'published'
      )
    )
    OR public.has_role('admin')
    OR public.has_role('senior_mufti')
  );

-- Allow public readers to view verified references ONLY for published fatwas (excluding internal notes)
CREATE POLICY "fatwa_references_public_published" ON public.fatwa_references
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.fatwa_publications fp
      JOIN public.fatwa_questions fq ON fq.id = fp.question_id
      WHERE fq.id = fatwa_references.question_id
        AND fp.is_published = TRUE
        AND fq.workflow_status = 'issued'
        AND fq.publication_status = 'published'
    )
  );

-- Grant execution on secure tracking RPC to anon & authenticated visitors
GRANT EXECUTE ON FUNCTION public.track_public_fatwa_question(TEXT, TEXT) TO anon, authenticated;

-- Dedicated private bucket for public question supporting uploads (validated server-side)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public-question-uploads',
  'public-question-uploads',
  FALSE,
  5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public_uploads_staff_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'public-question-uploads'
    AND (public.has_role('admin') OR public.has_role('office_staff') OR public.has_role('senior_mufti') OR public.has_role('mufti'))
  );


-- ============================================================================
-- MIGRATION: 009_public_portal_seed.sql
-- ============================================================================

-- ============================================================================
-- Naafay Dar-ul-Ifta & Takhassus fil Fiqh Management System
-- Migration 009: Seed Public Portal Settings & Nazim Profile
-- ============================================================================

INSERT INTO public.portal_settings (
  institution_name_en,
  institution_name_ur,
  nazim_name_en,
  nazim_name_ur,
  welcome_title_en,
  welcome_title_ur,
  welcome_body_en,
  welcome_body_ur,
  announcements,
  contact_phone,
  contact_whatsapp,
  contact_email,
  contact_address_en,
  contact_address_ur,
  allow_optional_email
)
SELECT
  'Naafay Dar-ul-Ifta',
  'نافع دارالافتاء',
  'Mufti Waris Naseeb',
  'مفتی وارث نصیب',
  'Authentic Shariah Guidance & Verified Fatawa',
  'نافع دارالافتاء — مستند شرعی رہنمائی و فتاویٰ پورٹل',
  'Submit your religious, family, business, or contemporary Islamic jurisprudence inquiries directly to our panel of qualified Muftis and researchers.',
  'اپنے دینی، عائلی، تجارتی، وراثتی اور جدید شرعی مسائل مستند مفتیانِ کرام سے دریافت کریں، اپنے سوال کی کیفیت ٹریک کریں اور مصدقہ فتاویٰ کا مطالعہ کریں۔',
  '[
    {
      "id": "ann-1",
      "date": "2026-11-10",
      "title_ur": "آن لائن استفتاء سروس و ٹریکنگ نظام فعال ہے",
      "title_en": "Online Fatwa Submission & Tracking Portal Active",
      "body_ur": "سائلین بغیر اکاؤنٹ بنائے اپنا استفتاء جمع کروا سکتے ہیں اور ٹریکنگ نمبر کے ذریعے پیش رفت دیکھ سکتے ہیں۔",
      "body_en": "Visitors can submit questions without registration and track progress securely using their tracking number and mobile/verification code."
    },
    {
      "id": "ann-2",
      "date": "2026-11-01",
      "title_ur": "اسلامی بینکاری اور ڈیجیٹل تجارت کے خصوصی فتاویٰ",
      "title_en": "Updated Fatawa on Islamic Banking & Digital Commerce",
      "body_ur": "جدید مالیاتی معاملات اور ای کامرس زکوٰۃ سے متعلق نئے مصدقہ فتاویٰ پبلک لائبریری میں شامل کر دیے گئے ہیں۔",
      "body_en": "Newly verified Fatawa covering Islamic finance and e-commerce Zakat calculations are now available in the public library."
    }
  ]'::jsonb,
  '+92-21-34589012',
  '+92-300-2145890',
  'ifta@naafay.edu.pk',
  'Naafay Dar-ul-Ifta & Takhassus fil Fiqh, Main Campus, Karachi',
  'نافع دارالافتاء و تخصص فی الفقہ، مرکزی کیمپس، کراچی',
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.portal_settings);
