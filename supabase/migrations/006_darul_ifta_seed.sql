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
