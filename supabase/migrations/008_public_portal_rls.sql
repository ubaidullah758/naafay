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
