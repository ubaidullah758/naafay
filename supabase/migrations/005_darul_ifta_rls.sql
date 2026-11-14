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
