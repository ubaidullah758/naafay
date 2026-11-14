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
