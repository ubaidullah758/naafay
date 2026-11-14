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
