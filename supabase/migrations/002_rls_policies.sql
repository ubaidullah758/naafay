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
