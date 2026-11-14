const ACTION_LABELS: Record<string, { en: string; ur: string }> = {
  ATTENDANCE_MARKED: { en: 'Attendance Marked', ur: 'حاضری کا اندراج' },
  ATTENDANCE_BULK_SAVED: { en: 'Session Attendance Saved', ur: 'نشست کی حاضری محفوظ کی گئی' },
  ATTENDANCE_CORRECTED: { en: 'Attendance Corrected', ur: 'حاضری کی تصحیح' },
  MUTALA_SUBMITTED: { en: 'Daily Mutala Submitted', ur: 'روزانہ مطالعہ جمع کروایا گیا' },
  MUTALA_UPDATED: { en: 'Daily Mutala Updated', ur: 'روزانہ مطالعہ اپ ڈیٹ کیا گیا' },
  MUTALA_APPROVED: { en: 'Daily Mutala Approved', ur: 'روزانہ مطالعہ منظور ہوا' },
  MUTALA_RETURNED: { en: 'Mutala Returned for Revision', ur: 'مطالعہ اصلاح کے لیے واپس' },
  LESSON_RECORDED: { en: 'Daily Lesson Recorded', ur: 'یومیہ سبق درج کیا گیا' },
  LESSON_UPDATED: { en: 'Daily Lesson Updated', ur: 'یومیہ سبق اپ ڈیٹ کیا گیا' },
  LESSON_DELETED: { en: 'Lesson Record Removed', ur: 'سبق کا ریکارڈ حذف کیا گیا' },
  STUDENT_CREATED: { en: 'New Student Enrolled', ur: 'نئے طالب علم کا داخلہ' },
  STUDENT_UPDATED: { en: 'Student Profile Updated', ur: 'طالب علم کے ریکارڈ میں ترمیم' },
  STUDENT_DELETED: { en: 'Student Removed', ur: 'طالب علم کا ریکارڈ حذف' },
  TEACHER_CREATED: { en: 'New Teacher Added', ur: 'نئے استاذ کا اندراج' },
  TEACHER_UPDATED: { en: 'Teacher Record Updated', ur: 'استاذ کے ریکارڈ میں ترمیم' },
  SCHEDULE_ADDED: { en: 'Class Schedule Added', ur: 'کلاس شیڈول شامل کیا گیا' },
  SCHEDULE_DELETED: { en: 'Class Schedule Removed', ur: 'کلاس شیڈول حذف کیا گیا' },
  EXAM_CREATED: { en: 'Examination Scheduled', ur: 'امتحان کا شیڈول درج ہوا' },
  EXAM_PUBLISHED: { en: 'Exam Result Published', ur: 'امتحانی نتیجہ شائع ہوا' },
  EXAM_MARKS_SAVED: { en: 'Exam Marks Saved', ur: 'امتحانی نمبر محفوظ کیے گئے' },
  RESEARCH_ASSIGNED: { en: 'Research Topic Assigned', ur: 'تحقیقی مقالہ تفویض ہوا' },
  RESEARCH_SUBMITTED: { en: 'Research Draft Submitted', ur: 'مقالہ تحقیق جمع کروایا گیا' },
  RESEARCH_APPROVED: { en: 'Research Maqala Approved', ur: 'تحقیقی مقالہ منظور ہوا' },
  RESEARCH_RETURNED: { en: 'Research Returned for Revision', ur: 'مقالہ اصلاح کے لیے واپس' },
  DOCUMENT_UPLOADED: { en: 'Document Uploaded', ur: 'دستاویز اپ لوڈ کی گئی' },
  DOCUMENT_DELETED: { en: 'Document Deleted', ur: 'دستاویز حذف کی گئی' },
  FATWA_REGISTERED: { en: 'Fatwa Question Registered', ur: 'استفتاء کا اندراج' },
  FATWA_ASSIGNED: { en: 'Fatwa Question Assigned', ur: 'استفتاء کی تفویض' },
  FATWA_DRAFT_SAVED: { en: 'Fatwa Draft Saved', ur: 'فتویٰ کا مسودہ محفوظ ہوا' },
  FATWA_REVIEWED: { en: 'Senior Mufti Review Completed', ur: 'سینئر مفتی کا جائزہ مکمل ہوا' },
  FATWA_ISSUED: { en: 'Fatwa Officially Issued', ur: 'فتویٰ باقاعدہ جاری ہوا' },
  FATWA_PUBLISHED: { en: 'Fatwa Published to Portal', ur: 'فتویٰ پبلک پورٹل پر شائع ہوا' },
};

export function formatActivityAction(action: string, lang: 'en' | 'ur'): string {
  const entry = ACTION_LABELS[action];
  if (entry) return lang === 'ur' ? entry.ur : entry.en;
  return action.replace(/_/g, ' ').toLowerCase();
}
