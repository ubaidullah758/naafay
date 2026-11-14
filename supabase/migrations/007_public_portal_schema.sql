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
