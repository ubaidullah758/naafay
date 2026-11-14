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
