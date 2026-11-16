import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.resolve(process.cwd(), 'naafay_academic.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function uid(): string {
  return crypto.randomUUID();
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function normalizePhoneDigits(phone: string): string {
  return (phone || '').replace(/[^0-9]/g, '');
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      full_name TEXT NOT NULL,
      full_name_ur TEXT,
      phone TEXT,
      avatar_url TEXT,
      preferred_language TEXT NOT NULL DEFAULT 'ur',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      title_en TEXT NOT NULL,
      title_ur TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      module TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      assigned_by TEXT REFERENCES profiles(id),
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, role_id)
    );

    CREATE TABLE IF NOT EXISTS academic_years (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      title_en TEXT NOT NULL,
      title_ur TEXT NOT NULL,
      hijri_year TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_current INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_ur TEXT NOT NULL,
      level_order INTEGER NOT NULL DEFAULT 1,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      name_en TEXT NOT NULL,
      name_ur TEXT NOT NULL,
      capacity INTEGER DEFAULT 30,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_ur TEXT NOT NULL,
      class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      title_en TEXT NOT NULL,
      title_ur TEXT NOT NULL,
      author TEXT,
      total_pages INTEGER NOT NULL DEFAULT 0,
      total_chapters INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      profile_id TEXT UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
      student_code TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      full_name_ur TEXT,
      father_name TEXT NOT NULL,
      father_name_ur TEXT,
      date_of_birth TEXT,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      address_ur TEXT,
      previous_education TEXT,
      previous_education_ur TEXT,
      admission_date TEXT NOT NULL,
      academic_year_id TEXT REFERENCES academic_years(id),
      class_id TEXT REFERENCES classes(id),
      batch_id TEXT REFERENCES batches(id),
      status TEXT NOT NULL DEFAULT 'active',
      photo_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS guardians (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      full_name_ur TEXT,
      phone TEXT NOT NULL,
      whatsapp TEXT,
      cnic TEXT,
      occupation TEXT,
      address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS student_guardians (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      guardian_id TEXT NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
      relationship TEXT NOT NULL DEFAULT 'father',
      is_primary INTEGER NOT NULL DEFAULT 1,
      UNIQUE(student_id, guardian_id)
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
      roll_number TEXT,
      status TEXT NOT NULL DEFAULT 'enrolled',
      enrolled_at TEXT NOT NULL,
      UNIQUE(student_id, academic_year_id, class_id)
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      profile_id TEXT UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
      teacher_code TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      full_name_ur TEXT,
      qualification TEXT NOT NULL,
      qualification_ur TEXT,
      specialization TEXT,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      joining_date TEXT NOT NULL,
      responsibilities TEXT,
      responsibilities_ur TEXT,
      photo_url TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS teacher_assignments (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      academic_year_id TEXT REFERENCES academic_years(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
      subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
      book_id TEXT REFERENCES books(id) ON DELETE SET NULL,
      session_id TEXT REFERENCES attendance_sessions(id) ON DELETE SET NULL,
      start_time TEXT,
      end_time TEXT,
      days_of_week TEXT,
      room_name TEXT,
      is_class_supervisor INTEGER NOT NULL DEFAULT 0,
      can_mark_attendance INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_ur TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
      session_id TEXT NOT NULL REFERENCES attendance_sessions(id) ON DELETE RESTRICT,
      attendance_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'leave', 'late')),
      remarks TEXT,
      marked_by TEXT REFERENCES profiles(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(student_id, attendance_date, session_id)
    );

    CREATE TABLE IF NOT EXISTS attendance_corrections (
      id TEXT PRIMARY KEY,
      attendance_record_id TEXT NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
      previous_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      reason TEXT NOT NULL,
      corrected_by TEXT REFERENCES profiles(id),
      corrected_by_name TEXT,
      corrected_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS study_logs (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      study_date TEXT NOT NULL,
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
      chapter TEXT NOT NULL,
      start_position TEXT NOT NULL,
      end_position TEXT NOT NULL,
      study_details TEXT NOT NULL,
      student_comments TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'needs_correction')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS study_reviews (
      id TEXT PRIMARY KEY,
      study_log_id TEXT NOT NULL REFERENCES study_logs(id) ON DELETE CASCADE,
      teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
      reviewer_profile_id TEXT REFERENCES profiles(id),
      reviewer_name TEXT,
      decision TEXT NOT NULL CHECK (decision IN ('approved', 'needs_correction')),
      comments TEXT,
      reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lesson_records (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      lesson_date TEXT NOT NULL,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
      subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
      start_position TEXT NOT NULL,
      end_position TEXT NOT NULL,
      homework TEXT,
      remarks TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      title_en TEXT NOT NULL,
      title_ur TEXT NOT NULL,
      exam_type TEXT NOT NULL DEFAULT 'term',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exam_subjects (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
      book_id TEXT REFERENCES books(id) ON DELETE SET NULL,
      exam_date TEXT,
      written_max_marks REAL NOT NULL DEFAULT 80,
      oral_max_marks REAL NOT NULL DEFAULT 20,
      passing_marks REAL NOT NULL DEFAULT 40,
      UNIQUE(exam_id, subject_id)
    );

    CREATE TABLE IF NOT EXISTS exam_results (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      exam_subject_id TEXT NOT NULL REFERENCES exam_subjects(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      written_marks REAL NOT NULL DEFAULT 0,
      oral_marks REAL NOT NULL DEFAULT 0,
      total_marks REAL NOT NULL DEFAULT 0,
      grade TEXT,
      remarks TEXT,
      entered_by TEXT REFERENCES profiles(id),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(exam_subject_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS research_topics (
      id TEXT PRIMARY KEY,
      academic_year_id TEXT REFERENCES academic_years(id) ON DELETE SET NULL,
      title_en TEXT NOT NULL,
      title_ur TEXT NOT NULL,
      field_of_fiqh TEXT,
      description TEXT,
      created_by TEXT REFERENCES profiles(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS research_assignments (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL REFERENCES research_topics(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      supervisor_teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
      deadline TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'assigned',
      assigned_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS research_submissions (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES research_assignments(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL DEFAULT 1,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      notes TEXT,
      submitted_by TEXT REFERENCES profiles(id),
      submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS research_reviews (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES research_assignments(id) ON DELETE CASCADE,
      submission_id TEXT REFERENCES research_submissions(id) ON DELETE SET NULL,
      supervisor_teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
      decision TEXT NOT NULL CHECK (decision IN ('needs_correction', 'approved')),
      comments TEXT NOT NULL,
      reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'certificate',
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      mime_type TEXT,
      file_size_bytes INTEGER,
      uploaded_by TEXT REFERENCES profiles(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient_profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      title_en TEXT NOT NULL,
      title_ur TEXT NOT NULL,
      body_en TEXT NOT NULL,
      body_ur TEXT NOT NULL,
      module TEXT NOT NULL,
      reference_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_profile_id TEXT,
      actor_name TEXT,
      actor_role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- DAR-UL-IFTA MANAGEMENT TABLES (PART 2)
    CREATE TABLE IF NOT EXISTS fatwa_categories (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL,
      name_ur TEXT NOT NULL,
      name_ar TEXT,
      sort_order INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fatwa_questions (
      id TEXT PRIMARY KEY,
      fatwa_code TEXT NOT NULL UNIQUE,
      issued_fatwa_number TEXT UNIQUE,
      question_date TEXT NOT NULL,
      questioner_name TEXT NOT NULL,
      questioner_phone TEXT,
      questioner_email TEXT,
      city TEXT,
      country TEXT DEFAULT 'Pakistan',
      category_id TEXT NOT NULL REFERENCES fatwa_categories(id) ON DELETE RESTRICT,
      subject_title TEXT NOT NULL,
      subject_title_ur TEXT,
      question_text TEXT NOT NULL,
      is_identity_private INTEGER NOT NULL DEFAULT 1,
      allow_public_identity INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'office',
      workflow_status TEXT NOT NULL DEFAULT 'registered',
      publication_status TEXT NOT NULL DEFAULT 'internal_only',
      registered_by TEXT REFERENCES profiles(id),
      issued_at TEXT,
      issued_pdf_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fatwa_assignments (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES fatwa_questions(id) ON DELETE CASCADE,
      assignee_profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      assignee_role TEXT NOT NULL,
      assigned_by TEXT REFERENCES profiles(id),
      assigned_date TEXT NOT NULL,
      deadline TEXT,
      instructions TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fatwa_research (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES fatwa_questions(id) ON DELETE CASCADE,
      author_profile_id TEXT REFERENCES profiles(id),
      author_name TEXT,
      research_notes TEXT NOT NULL,
      related_books TEXT,
      arabic_quotations TEXT,
      urdu_explanation TEXT,
      fiqhi_opinions TEXT,
      supporting_evidence TEXT,
      researcher_comments TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fatwa_references (
      id TEXT PRIMARY KEY,
      question_id TEXT REFERENCES fatwa_questions(id) ON DELETE CASCADE,
      book_name TEXT NOT NULL,
      author TEXT,
      volume TEXT,
      page_number TEXT,
      chapter TEXT,
      arabic_quotation TEXT NOT NULL,
      explanation TEXT,
      reference_notes TEXT,
      is_reusable INTEGER NOT NULL DEFAULT 1,
      created_by TEXT REFERENCES profiles(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fatwa_drafts (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL UNIQUE REFERENCES fatwa_questions(id) ON DELETE CASCADE,
      draft_title TEXT,
      draft_body_ur TEXT NOT NULL DEFAULT '',
      draft_body_ar TEXT DEFAULT '',
      current_version INTEGER NOT NULL DEFAULT 1,
      last_edited_by TEXT REFERENCES profiles(id),
      autosaved_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fatwa_versions (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES fatwa_questions(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      draft_body_ur TEXT NOT NULL,
      draft_body_ar TEXT,
      references_snapshot TEXT DEFAULT '[]',
      saved_by TEXT REFERENCES profiles(id),
      saved_by_name TEXT,
      change_summary TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(question_id, version_number)
    );

    CREATE TABLE IF NOT EXISTS fatwa_reviews (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES fatwa_questions(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL DEFAULT 1,
      reviewer_profile_id TEXT NOT NULL REFERENCES profiles(id),
      reviewer_name TEXT,
      decision TEXT NOT NULL CHECK (decision IN ('approved_for_final', 'corrections_requested', 'returned')),
      comments TEXT NOT NULL,
      reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fatwa_approvals (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES fatwa_questions(id) ON DELETE CASCADE,
      approver_profile_id TEXT NOT NULL REFERENCES profiles(id),
      approver_name TEXT,
      decision TEXT NOT NULL CHECK (decision IN ('approved', 'issued', 'returned_to_review')),
      comments TEXT,
      approved_version INTEGER NOT NULL,
      issued_fatwa_number TEXT,
      approved_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fatwa_publications (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL UNIQUE REFERENCES fatwa_questions(id) ON DELETE CASCADE,
      is_published INTEGER NOT NULL DEFAULT 0,
      public_title_ur TEXT,
      public_title_en TEXT,
      public_question_text TEXT,
      public_answer_text TEXT,
      approved_by TEXT REFERENCES profiles(id),
      published_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fatwa_attachments (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES fatwa_questions(id) ON DELETE CASCADE,
      research_id TEXT REFERENCES fatwa_research(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      mime_type TEXT,
      file_size_bytes INTEGER,
      uploaded_by TEXT REFERENCES profiles(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- PUBLIC ONLINE FATWA PORTAL TABLES (PART 3)
    CREATE TABLE IF NOT EXISTS portal_settings (
      id TEXT PRIMARY KEY,
      institution_name_en TEXT NOT NULL DEFAULT 'Naafay Dar-ul-Ifta',
      institution_name_ur TEXT NOT NULL DEFAULT 'نافع دارالافتاء',
      nazim_name_en TEXT NOT NULL DEFAULT 'Mufti Waris Naseeb',
      nazim_name_ur TEXT NOT NULL DEFAULT 'مفتی وارث نصیب',
      welcome_title_en TEXT NOT NULL,
      welcome_title_ur TEXT NOT NULL,
      welcome_body_en TEXT NOT NULL,
      welcome_body_ur TEXT NOT NULL,
      announcements TEXT NOT NULL DEFAULT '[]',
      contact_phone TEXT,
      contact_whatsapp TEXT,
      contact_email TEXT,
      contact_address_en TEXT,
      contact_address_ur TEXT,
      allow_optional_email INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS public_tracking_tokens (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL UNIQUE REFERENCES fatwa_questions(id) ON DELETE CASCADE,
      tracking_number TEXT NOT NULL UNIQUE,
      verification_code_hash TEXT NOT NULL,
      mobile_hash TEXT NOT NULL,
      mobile_last4 TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS public_submissions (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES fatwa_questions(id) ON DELETE CASCADE,
      tracking_token_id TEXT NOT NULL REFERENCES public_tracking_tokens(id) ON DELETE CASCADE,
      ip_hash TEXT,
      user_agent TEXT,
      consent_accepted INTEGER NOT NULL DEFAULT 1,
      spam_score INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'accepted',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const countRoles = db.prepare('SELECT COUNT(*) as c FROM roles').get() as { c: number };
  if (countRoles.c === 0) {
    seedInitialData();
  }

  const countFatwaCats = db.prepare('SELECT COUNT(*) as c FROM fatwa_categories').get() as { c: number };
  if (countFatwaCats.c === 0) {
    seedDarulIftaData();
  }

  // Ensure Admin Nazim name is Mufti Waris Naseeb even on pre-existing SQLite DBs
  db.prepare("UPDATE profiles SET full_name = 'Mufti Waris Naseeb', full_name_ur = 'مفتی وارث نصیب' WHERE id = 'prof-admin'").run();
  db.prepare("UPDATE fatwa_approvals SET approver_name = 'مفتی وارث نصیب' WHERE approver_profile_id = 'prof-admin'").run();

  // Ensure senior_mufti and mufti roles exist for unified RBAC user management
  db.prepare("INSERT OR IGNORE INTO roles (id, name, title_en, title_ur, description) VALUES (?, ?, ?, ?, ?)").run(
    'role-senior-mufti', 'senior_mufti', 'Senior Mufti', 'مفتیِ اعظم / سینئر مفتی', 'Senior Fatwa review and assignment authority'
  );
  db.prepare("INSERT OR IGNORE INTO roles (id, name, title_en, title_ur, description) VALUES (?, ?, ?, ?, ?)").run(
    'role-mufti', 'mufti', 'Mufti / Researcher', 'مفتی / محقق', 'Fatwa research, drafting, and lesson instruction'
  );

  const countPortal = db.prepare('SELECT COUNT(*) as c FROM portal_settings').get() as { c: number };
  if (countPortal.c === 0) {
    seedPublicPortalData();
  }

  // Safely ensure schedule columns exist on teacher_assignments for pre-existing DBs
  const taCols = (db.prepare("PRAGMA table_info(teacher_assignments)").all() as Array<{ name: string }>).map((c) => c.name);
  if (!taCols.includes('session_id')) db.exec("ALTER TABLE teacher_assignments ADD COLUMN session_id TEXT");
  if (!taCols.includes('start_time')) db.exec("ALTER TABLE teacher_assignments ADD COLUMN start_time TEXT");
  if (!taCols.includes('end_time')) db.exec("ALTER TABLE teacher_assignments ADD COLUMN end_time TEXT");
  if (!taCols.includes('days_of_week')) db.exec("ALTER TABLE teacher_assignments ADD COLUMN days_of_week TEXT");
  if (!taCols.includes('room_name')) db.exec("ALTER TABLE teacher_assignments ADD COLUMN room_name TEXT");

  // Backfill default schedule slots for any unscheduled teacher_assignments
  const unscheduled = db.prepare("SELECT id, subject_id, class_id FROM teacher_assignments WHERE start_time IS NULL OR start_time = ''").all() as any[];
  const schedDefaults: Record<string, { ses: string; start: string; end: string; days: string; room: string }> = {
    'sub-usool': { ses: 'ses-morning', start: '08:00', end: '09:15', days: 'ہفتہ تا جمعرات', room: 'درسگاہ ۱' },
    'sub-fiqh': { ses: 'ses-morning', start: '09:30', end: '11:00', days: 'ہفتہ تا جمعرات', room: 'درسگاہ ۱' },
    'sub-qawaid': { ses: 'ses-morning', start: '11:15', end: '12:30', days: 'ہفتہ تا بدھ', room: 'درسگاہ ۱' },
    'sub-muamalat': { ses: 'ses-zuhr', start: '14:15', end: '15:30', days: 'ہفتہ تا جمعرات', room: 'درسگاہ ۲' },
    'sub-ahwal': { ses: 'ses-zuhr', start: '15:30', end: '16:30', days: 'ہفتہ تا جمعرات', room: 'درسگاہ ۲' },
    'sub-tahqeeq': { ses: 'ses-maghrib', start: '18:30', end: '19:45', days: 'ہفتہ، پیر، بدھ', room: 'دارالافتاء لائبریری' },
  };
  const updSched = db.prepare("UPDATE teacher_assignments SET session_id = ?, start_time = ?, end_time = ?, days_of_week = ?, room_name = ? WHERE id = ?");
  for (const row of unscheduled) {
    const def = schedDefaults[row.subject_id] || { ses: 'ses-morning', start: '09:00', end: '10:00', days: 'ہفتہ تا جمعرات', room: 'درسگاہ ۱' };
    updSched.run(def.ses, def.start, def.end, def.days, def.room, row.id);
  }

  // Ensure every seeded book/teacher assignment has at least one lesson record (so "taught from -> to" always displays cleanly)
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const missingLessons = [
    {
      teacherId: 'tch-2',
      date: yesterdayStr,
      classId: 'cls-ifta',
      batchId: 'bat-3a',
      subjectId: 'sub-tahqeeq',
      bookId: 'bk-hidayah',
      start: 'کتاب البیوع، ص ۱۲',
      end: 'باب بیع الفاسد، ص ۲۸',
      homework: 'بیعِ فاسد و باطل کے بنیادی فروق کی تخریج',
      remarks: 'تمرینِ افتاء کے طلبہ نے شامی سے مراجعت کی',
    },
    {
      teacherId: 'tch-4',
      date: todayStr,
      classId: 'cls-tak2',
      batchId: 'bat-2a',
      subjectId: 'sub-ahwal',
      bookId: 'bk-siraji',
      start: 'باب ذوی الفروض، ص ۱۵',
      end: 'باب العصبات، ص ۲۶',
      homework: 'عول اور رد کی پانچ عملی مثالیں حل کریں',
      remarks: 'مشق مکمل ہوئی',
    },
  ];
  const chkBookLesson = db.prepare('SELECT COUNT(*) as c FROM lesson_records WHERE book_id = ?');
  const insMissingLesson = db.prepare('INSERT INTO lesson_records (id, teacher_id, lesson_date, class_id, batch_id, subject_id, book_id, start_position, end_position, homework, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const ml of missingLessons) {
    const existsTch = db.prepare('SELECT 1 FROM teachers WHERE id = ?').get(ml.teacherId);
    const existsBk = db.prepare('SELECT 1 FROM books WHERE id = ?').get(ml.bookId);
    if (existsTch && existsBk && (chkBookLesson.get(ml.bookId) as { c: number }).c === 0) {
      insMissingLesson.run(uid(), ml.teacherId, ml.date, ml.classId, ml.batchId, ml.subjectId, ml.bookId, ml.start, ml.end, ml.homework, ml.remarks);
    }
  }

  // Ensure study_logs columns exist for Takhasus manual register fields
  const slCols = (db.prepare("PRAGMA table_info(study_logs)").all() as Array<{ name: string }>).map((c) => c.name);
  if (!slCols.includes('maktaba')) db.exec("ALTER TABLE study_logs ADD COLUMN maktaba TEXT");
  if (!slCols.includes('start_title')) db.exec("ALTER TABLE study_logs ADD COLUMN start_title TEXT");
  if (!slCols.includes('end_title')) db.exec("ALTER TABLE study_logs ADD COLUMN end_title TEXT");
  if (!slCols.includes('daily_pages')) db.exec("ALTER TABLE study_logs ADD COLUMN daily_pages INTEGER DEFAULT 0");
  if (!slCols.includes('cumulative_pages')) db.exec("ALTER TABLE study_logs ADD COLUMN cumulative_pages INTEGER DEFAULT 0");
  if (!slCols.includes('juziyat_notes')) db.exec("ALTER TABLE study_logs ADD COLUMN juziyat_notes TEXT");

  // Ensure attendance_records columns exist for Takhasus manual register fields
  const attCols = (db.prepare("PRAGMA table_info(attendance_records)").all() as Array<{ name: string }>).map((c) => c.name);
  if (!attCols.includes('late_minutes')) db.exec("ALTER TABLE attendance_records ADD COLUMN late_minutes INTEGER DEFAULT 0");

  // Ensure lesson_records columns exist for Takhasus daily karzari register (Image 1)
  const lrCols = (db.prepare("PRAGMA table_info(lesson_records)").all() as Array<{ name: string }>).map((c) => c.name);
  if (!lrCols.includes('start_title')) db.exec("ALTER TABLE lesson_records ADD COLUMN start_title TEXT");
  if (!lrCols.includes('end_title')) db.exec("ALTER TABLE lesson_records ADD COLUMN end_title TEXT");
  if (!lrCols.includes('lesson_timing')) db.exec("ALTER TABLE lesson_records ADD COLUMN lesson_timing TEXT");
  if (!lrCols.includes('attendance_status')) db.exec("ALTER TABLE lesson_records ADD COLUMN attendance_status TEXT DEFAULT 'present'");
  if (!lrCols.includes('daily_pages')) db.exec("ALTER TABLE lesson_records ADD COLUMN daily_pages INTEGER DEFAULT 1");
  if (!lrCols.includes('cumulative_pages')) db.exec("ALTER TABLE lesson_records ADD COLUMN cumulative_pages INTEGER DEFAULT 0");

  // Ensure student pin column & profile links exist for individual student logins
  const stuCols = (db.prepare("PRAGMA table_info(students)").all() as Array<{ name: string }>).map((c) => c.name);
  if (!stuCols.includes('pin')) db.exec("ALTER TABLE students ADD COLUMN pin TEXT DEFAULT '123456'");

  const allDbStudents = db.prepare('SELECT * FROM students').all() as any[];
  const insStuProf = db.prepare('INSERT OR IGNORE INTO profiles (id, email, full_name, full_name_ur, phone, preferred_language) VALUES (?, ?, ?, ?, ?, ?)');
  const updStuProf = db.prepare('UPDATE students SET profile_id = ? WHERE id = ?');
  const insStuRole = db.prepare('INSERT OR IGNORE INTO user_roles (id, user_id, role_id) VALUES (?, ?, ?)');

  for (const s of allDbStudents) {
    const profId = s.profile_id || `prof-student-${s.id}`;
    const email = s.email || `${s.student_code.toLowerCase().replace(/[^a-z0-9]/g, '')}@naafay.edu.pk`;
    insStuProf.run(profId, email, s.full_name, s.full_name_ur || s.full_name, s.phone, 'ur');
    if (!s.profile_id) {
      updStuProf.run(profId, s.id);
    }
    insStuRole.run(uid(), profId, 'role-student');
  }

  // Ensure all teachers have profiles and roles
  const allDbTeachers = db.prepare('SELECT * FROM teachers').all() as any[];
  for (const t of allDbTeachers) {
    const profId = t.profile_id || `prof-teacher-${t.id}`;
    const email = `${t.teacher_code.toLowerCase().replace(/[^a-z0-9]/g, '')}@naafay.edu.pk`;
    insStuProf.run(profId, email, t.full_name, t.full_name_ur || t.full_name, t.phone || '+92-300-0000000', 'ur');
    if (!t.profile_id) {
      db.prepare('UPDATE teachers SET profile_id = ? WHERE id = ?').run(profId, t.id);
    }
    const roleId = t.id === 'tch-2' ? 'role-senior-mufti' : 'role-teacher';
    insStuRole.run(uid(), profId, roleId);
  }
}

export function nextStudentCode(): string {
  const rows = db.prepare('SELECT student_code FROM students').all() as { student_code: string }[];
  let maxNum = 0;
  for (const r of rows) {
    const m = /^ST-(\d+)$/.exec(r.student_code);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `ST-${String(maxNum + 1).padStart(3, '0')}`;
}

export function nextTeacherCode(): string {
  const rows = db.prepare('SELECT teacher_code FROM teachers').all() as { teacher_code: string }[];
  let maxNum = 0;
  for (const r of rows) {
    const m = /^TCH-(\d+)$/.exec(r.teacher_code);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `TCH-${String(maxNum + 1).padStart(3, '0')}`;
}

export function computeGrade(obtained: number, maxMarks: number): string {
  if (maxMarks <= 0) return 'N/A';
  const pct = (obtained / maxMarks) * 100;
  if (pct >= 85) return 'ممتاز (A+)';
  if (pct >= 75) return 'جید جداً (A)';
  if (pct >= 65) return 'جید (B)';
  if (pct >= 50) return 'مقبول (C)';
  if (pct >= 40) return 'کمزور (D)';
  return 'راسب (F)';
}

function seedInitialData() {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const nextMonth = new Date(Date.now() + 24 * 86400000).toISOString().slice(0, 10);

  const tx = db.transaction(() => {
    // Roles
    const roleAdmin = 'role-admin';
    const roleStaff = 'role-staff';
    const roleTeacher = 'role-teacher';
    const roleStudent = 'role-student';

    const insertRole = db.prepare('INSERT INTO roles (id, name, title_en, title_ur, description) VALUES (?, ?, ?, ?, ?)');
    insertRole.run(roleAdmin, 'admin', 'Administrator (Nazim)', 'ناظمِ تعلیمات (ایڈمن)', 'Full academic module administration');
    insertRole.run(roleStaff, 'office_staff', 'Office Staff', 'دفتری عملہ', 'Admissions, attendance reports, documents');
    insertRole.run(roleTeacher, 'teacher', 'Teacher / Mufti', 'استاذ / مفتی', 'Lessons, attendance, Mutala & research reviews');
    insertRole.run(roleStudent, 'student', 'Student (Talib-e-Ilm)', 'طالبِ علم', 'Own records, Daily Mutala & research submissions');

    // Profiles (corresponding to demo personas)
    const pAdmin = 'prof-admin';
    const pStaff = 'prof-staff';
    const pTeacher1 = 'prof-teacher-1';
    const pTeacher2 = 'prof-teacher-2';
    const pStudent1 = 'prof-student-1';

    const insertProf = db.prepare('INSERT INTO profiles (id, email, full_name, full_name_ur, phone, preferred_language) VALUES (?, ?, ?, ?, ?, ?)');
    insertProf.run(pAdmin, 'nazim@naafay.edu.pk', 'Mufti Waris Naseeb', 'مفتی وارث نصیب', '+92-300-2145890', 'ur');
    insertProf.run(pStaff, 'office@naafay.edu.pk', 'Maulana Zubair Ahmad', 'مولانا زبیر احمد', '+92-321-4451209', 'ur');
    insertProf.run(pTeacher1, 'mufti.salman@naafay.edu.pk', 'Mufti Salman Mansoorpuri', 'مفتی سلمان منصورپوری', '+92-333-8129451', 'ur');
    insertProf.run(pTeacher2, 'mufti.khalid@naafay.edu.pk', 'Mufti Khalid Saifullah', 'مفتی خالد سیف اللہ', '+92-345-6190231', 'ur');
    insertProf.run(pStudent1, 'abdurrahman@naafay.edu.pk', 'Maulana Abdur Rahman Madani', 'مولانا عبدالرحمٰن مدنی', '+92-301-7782310', 'ur');

    const insertUR = db.prepare('INSERT INTO user_roles (id, user_id, role_id) VALUES (?, ?, ?)');
    insertUR.run(uid(), pAdmin, roleAdmin);
    insertUR.run(uid(), pStaff, roleStaff);
    insertUR.run(uid(), pTeacher1, roleTeacher);
    insertUR.run(uid(), pTeacher2, roleTeacher);
    insertUR.run(uid(), pStudent1, roleStudent);

    // Academic Years
    const ayCurr = 'ay-1447';
    const ayPrev = 'ay-1446';
    db.prepare('INSERT INTO academic_years (id, code, title_en, title_ur, hijri_year, start_date, end_date, is_current) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      ayCurr, '1447-1448', 'Academic Year 2026-2027', 'تعلیمی سال ۱۴۴۷-۱۴۴۸ھ', '1447-1448 AH', '2026-04-01', '2027-03-15', 1
    );
    db.prepare('INSERT INTO academic_years (id, code, title_en, title_ur, hijri_year, start_date, end_date, is_current) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      ayPrev, '1446-1447', 'Academic Year 2025-2026', 'تعلیمی سال ۱۴۴۶-۱۴۴۷ھ', '1446-1447 AH', '2025-04-01', '2026-03-15', 0
    );

    // Classes
    const cls1 = 'cls-tak1';
    const cls2 = 'cls-tak2';
    const cls3 = 'cls-ifta';
    const insCls = db.prepare('INSERT INTO classes (id, code, name_en, name_ur, level_order, description) VALUES (?, ?, ?, ?, ?, ?)');
    insCls.run(cls1, 'TAK-1', 'Takhassus fil Fiqh — Year 1', 'تخصص فی الفقہ — سالِ اول', 1, 'Foundational Hanafi jurisprudence, Qawaid, and Rasm al-Mufti');
    insCls.run(cls2, 'TAK-2', 'Takhassus fil Fiqh — Year 2', 'تخصص فی الفقہ — سالِ دوم', 2, 'Advanced contemporary Fiqh, Muamalat, and Fatwa drafting');
    insCls.run(cls3, 'TAK-IFTA', 'Tamreen-e-Ifta Fellowship', 'تمرینِ افتاء و تحقیق', 3, 'Supervised Ifta practice and academic Maqala research');

    // Batches
    const bat1 = 'bat-1a';
    const bat2 = 'bat-2a';
    const bat3 = 'bat-3a';
    const insBat = db.prepare('INSERT INTO batches (id, class_id, academic_year_id, name_en, name_ur, capacity) VALUES (?, ?, ?, ?, ?, ?)');
    insBat.run(bat1, cls1, ayCurr, 'Morning Cohort A', 'بیچ الف (سالِ اول)', 25);
    insBat.run(bat2, cls2, ayCurr, 'Senior Cohort A', 'بیچ ب (سالِ دوم)', 20);
    insBat.run(bat3, cls3, ayCurr, 'Ifta Research Cohort', 'بیچ ج (تمرینِ افتاء)', 15);

    // Subjects
    const subFiqh = 'sub-fiqh';
    const subUsool = 'sub-usool';
    const subQawaid = 'sub-qawaid';
    const subMuamalat = 'sub-muamalat';
    const subAhwal = 'sub-ahwal';
    const subTahqeeq = 'sub-tahqeeq';

    const insSub = db.prepare('INSERT INTO subjects (id, code, name_en, name_ur, class_id) VALUES (?, ?, ?, ?, ?)');
    insSub.run(subFiqh, 'FIQH-HAN', 'Hanafi Jurisprudence (Fiqh)', 'فقہِ حنفی', cls1);
    insSub.run(subUsool, 'USOOL-IFTA', 'Principles of Issuing Fatwa', 'اصولِ افتاء و رسم المفتی', cls1);
    insSub.run(subQawaid, 'QAWAID', 'Legal Maxims (Al-Qawaid)', 'القواعد الفقہیہ', cls1);
    insSub.run(subMuamalat, 'MUAMALAT', 'Islamic Financial Transactions', 'اسلامی معاشیات و معاملات', cls2);
    insSub.run(subAhwal, 'AHWAL', 'Personal Status & Family Law', 'احوالِ شخصیہ و کتاب النکاح', cls2);
    insSub.run(subTahqeeq, 'TAHQEEQ', 'Methodology of Fiqh Research', 'اصولِ تحقیق و مقالہ نگاری', cls3);

    // Books
    const bkRadd = 'bk-radd';
    const bkRasm = 'bk-rasm';
    const bkAshbah = 'bk-ashbah';
    const bkHidayah = 'bk-hidayah';
    const bkBuhuth = 'bk-buhuth';
    const bkSiraji = 'bk-siraji';
    const bkMaeeshat = 'bk-maeeshat';
    const bkMuwafaqat = 'bk-muwafaqat';
    const bkMusallam = 'bk-musallam';

    const insBook = db.prepare('INSERT INTO books (id, subject_id, title_en, title_ur, author, total_pages, total_chapters) VALUES (?, ?, ?, ?, ?, ?, ?)');
    insBook.run(bkRadd, subFiqh, 'Radd al-Muhtar (Shami)', 'رد المحتار (فتاویٰ شامی)', 'Allama Ibn Abidin (رحمہ اللہ)', 620, 18);
    insBook.run(bkRasm, subUsool, 'Sharh Uqud Rasm al-Mufti', 'شرح عقود رسم المفتی', 'Allama Ibn Abidin (رحمہ اللہ)', 140, 8);
    insBook.run(bkAshbah, subQawaid, 'Al-Ashbah wan-Nazair', 'الاشباہ والنظائر', 'Allama Ibn Nujaym (رحمہ اللہ)', 380, 12);
    insBook.run(bkHidayah, subMuamalat, 'Al-Hidayah (Kitab al-Buyu)', 'الہدایہ (کتاب البیوع)', 'Imam al-Marghinani (رحمہ اللہ)', 410, 14);
    insBook.run(bkBuhuth, subMuamalat, 'Fiqh al-Buyu & Contemporary Finance', 'فقہ البیوع و جدید مالیات', 'Mufti Taqi Usmani', 540, 16);
    insBook.run(bkSiraji, subAhwal, 'Al-Sirajiyyah (Inheritance)', 'السراجی فی المیراث', 'Imam Sajawandi (رحمہ اللہ)', 180, 10);
    insBook.run(bkMaeeshat, subMuamalat, 'Islam aur Jadeed Maeeshat', 'اسلام اور جدید معیشت', 'مفتی تقی عثمانی', 450, 15);
    insBook.run(bkMuwafaqat, subQawaid, 'Al-Muwafaqat', 'الموافقات', 'امام شاطبی', 600, 20);
    insBook.run(bkMusallam, subUsool, 'Musallam al-Thubut', 'مسلم الثبوت', 'محب اللہ بہاری', 420, 14);

    // 3 Mandatory Attendance Sessions
    const ses1 = 'ses-morning';
    const ses2 = 'ses-zuhr';
    const ses3 = 'ses-maghrib';
    const insSes = db.prepare('INSERT INTO attendance_sessions (id, code, name_en, name_ur, start_time, end_time, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
    insSes.run(ses1, 'morning_zuhr', 'Morning to Zuhr', 'صبح تا ظہر', '07:30', '13:00', 1);
    insSes.run(ses2, 'zuhr_asr', 'Zuhr to Asr', 'ظہر تا عصر', '14:00', '16:30', 2);
    insSes.run(ses3, 'maghrib_isha', 'Maghrib to Isha', 'مغرب تا عشاء', '18:00', '21:00', 3);

    // Teachers
    const t1 = 'tch-1';
    const t2 = 'tch-2';
    const t3 = 'tch-3';
    const t4 = 'tch-4';
    const insTch = db.prepare(`
      INSERT INTO teachers (id, profile_id, teacher_code, full_name, full_name_ur, qualification, qualification_ur, specialization, phone, email, address, joining_date, responsibilities, responsibilities_ur, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insTch.run(t1, pTeacher1, 'TCH-001', 'Mufti Salman Mansoorpuri', 'مفتی سلمان منصورپوری', 'Dars-e-Nizami, Takhassus fil Fiqh', 'درسِ نظامی، تخصص فی الفقہ والافتاء', 'Hanafi Fiqh & Usool al-Ifta', '+92-333-8129451', 'mufti.salman@naafay.edu.pk', 'Block B, Jamia Colony', '2021-05-10', 'Senior Mufti, Class Supervisor Year 1, Morning Attendance', 'سپروائزر سالِ اول، تدریسِ رسم المفتی و ردالمحتار، نگرانی حاضری صبح', 'active');
    insTch.run(t2, pTeacher2, 'TCH-002', 'Mufti Khalid Saifullah', 'مفتی خالد سیف اللہ', 'PhD Islamic Jurisprudence, Takhassus', 'ڈاکٹریٹ فقہِ اسلامی، تخصص فی الفقہ', 'Islamic Finance & Muamalat', '+92-345-6190231', 'mufti.khalid@naafay.edu.pk', 'Gulshan-e-Iqbal, Block 4', '2022-03-14', 'Lead Supervisor Year 2, Maqala Supervision, Zuhr Session', 'سپروائزر سالِ دوم، تدریسِ فقہ البیوع و ہدایہ، نگرانیِ مقالات', 'active');
    insTch.run(t3, null, 'TCH-003', 'Mufti Anas Nadvi', 'مفتی انس ندوی', 'Al-Alimiyyah, Takhassus fil Hadith wal Fiqh', 'العالمیہ، تخصص فی الفقہ والحدیث', 'Al-Qawaid al-Fiqhiyyah', '+92-302-9910422', 'anas.nadvi@naafay.edu.pk', 'Model Town, Lahore', '2023-08-01', 'Teaching Al-Ashbah wan-Nazair & Maghrib Mutala Supervision', 'تدریسِ الاشباہ والنظائر، نگرانیِ مطالعہ مغرب تا عشاء', 'active');
    insTch.run(t4, null, 'TCH-004', 'Mufti Saeed Ahmad Palanpuri', 'مفتی سعید احمد پالنپوری', 'Takhassus fil Ifta, M.Phil Arabic', 'تخصص فی الافتاء، ایم فل عربی', 'Ahwal-e-Shakhsiyyah & Mirath', '+92-315-8832104', 'saeed.ahmad@naafay.edu.pk', 'Johar Town, Lahore', '2024-01-12', 'Teaching Kitab al-Nikah, Sirajiyyah & Oral Examinations', 'تدریسِ کتاب النکاح و السراجی، زبانی امتحانات', 'active');

    // Teacher Assignments & Schedule
    const insTA = db.prepare('INSERT INTO teacher_assignments (id, teacher_id, academic_year_id, class_id, batch_id, subject_id, book_id, session_id, start_time, end_time, days_of_week, room_name, is_class_supervisor, can_mark_attendance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    insTA.run(uid(), t1, ayCurr, cls1, bat1, subUsool, bkRasm, ses1, '08:00', '09:15', 'ہفتہ تا جمعرات', 'درسگاہ ۱', 1, 1);
    insTA.run(uid(), t1, ayCurr, cls1, bat1, subFiqh, bkRadd, ses1, '09:30', '11:00', 'ہفتہ تا جمعرات', 'درسگاہ ۱', 1, 1);
    insTA.run(uid(), t2, ayCurr, cls2, bat2, subMuamalat, bkBuhuth, ses2, '14:15', '15:30', 'ہفتہ تا جمعرات', 'درسگاہ ۲', 1, 1);
    insTA.run(uid(), t2, ayCurr, cls3, bat3, subTahqeeq, bkHidayah, ses3, '18:30', '19:45', 'ہفتہ، پیر، بدھ', 'دارالافتاء لائبریری', 1, 1);
    insTA.run(uid(), t3, ayCurr, cls1, bat1, subQawaid, bkAshbah, ses1, '11:15', '12:30', 'ہفتہ تا بدھ', 'درسگاہ ۱', 0, 1);
    insTA.run(uid(), t4, ayCurr, cls2, bat2, subAhwal, bkSiraji, ses2, '15:30', '16:30', 'ہفتہ تا جمعرات', 'درسگاہ ۲', 0, 1);

    // Students (8 realistic Takhassus students)
    const studentSeeds = [
      { id: 'stu-1', prof: pStudent1, code: 'ST-001', en: 'Abdur Rahman Madani', ur: 'مولانا عبدالرحمٰن مدنی', fEn: 'Hafiz Muhammad Ibrahim', fUr: 'حافظ محمد ابراہیم', dob: '2000-04-12', phone: '+92-301-7782310', email: 'abdurrahman@naafay.edu.pk', addr: 'Bahadurabad, Karachi', addrUr: 'بہادرآباد، کراچی', edu: 'Shahadat-ul-Alamiyyah (Wifaq ul Madaris)', eduUr: 'شہادۃ العالمیہ (وفاق المدارس العربیہ)', cls: cls1, bat: bat1, status: 'active' },
      { id: 'stu-2', prof: null, code: 'ST-002', en: 'Muhammad Umar Farooq', ur: 'مولانا محمد عمر فاروق', fEn: 'Maulana Abdul Razzaq', fUr: 'مولانا عبدالرزاق', dob: '1999-08-21', phone: '+92-312-4490812', email: 'umar.farooq@naafay.edu.pk', addr: 'Samanabad, Lahore', addrUr: 'سمن آباد، لاہور', edu: 'Shahadat-ul-Alamiyyah (Mumtaz)', eduUr: 'شہادۃ العالمیہ (ممتاز)', cls: cls1, bat: bat1, status: 'active' },
      { id: 'stu-3', prof: null, code: 'ST-003', en: 'Huzaifa bin Yousuf', ur: 'مولانا حذیفہ بن یوسف', fEn: 'Haji Yousuf Ismail', fUr: 'حاجی یوسف اسماعیل', dob: '2001-01-19', phone: '+92-334-9102341', email: 'huzaifa@naafay.edu.pk', addr: 'Gulistan-e-Johar, Karachi', addrUr: 'گلستانِ جوہر، کراچی', edu: 'Shahadat-ul-Alamiyyah, BA', eduUr: 'شہادۃ العالمیہ، بی اے', cls: cls1, bat: bat1, status: 'active' },
      { id: 'stu-4', prof: null, code: 'ST-004', en: 'Zaidullah Khan', ur: 'مولانا زید اللہ خان', fEn: 'Hidayatullah Khan', fUr: 'ہدایت اللہ خان', dob: '2000-11-05', phone: '+92-345-8823190', email: 'zaidullah@naafay.edu.pk', addr: 'University Town, Peshawar', addrUr: 'یونیورسٹی ٹاؤن، پشاور', edu: 'Shahadat-ul-Alamiyyah', eduUr: 'شہادۃ العالمیہ', cls: cls1, bat: bat1, status: 'active' },
      { id: 'stu-5', prof: null, code: 'ST-005', en: 'Talha bin Zubair', ur: 'مولانا طلحہ بن زبیر', fEn: 'Zubair Ahmad Siddiqui', fUr: 'زبیر احمد صدیقی', dob: '1998-06-30', phone: '+92-300-6671290', email: 'talha@naafay.edu.pk', addr: 'Satellite Town, Rawalpindi', addrUr: 'سیٹلائٹ ٹاؤن، راولپنڈی', edu: 'Shahadat-ul-Alamiyyah, MA Islamiat', eduUr: 'شہادۃ العالمیہ، ایم اے اسلامیات', cls: cls2, bat: bat2, status: 'active' },
      { id: 'stu-6', prof: null, code: 'ST-006', en: 'Saad bin Abi Waqqas', ur: 'مولانا سعد بن ابی وقاص', fEn: 'Maulana Manzoor Ahmad', fUr: 'مولانا منظور احمد', dob: '1999-03-14', phone: '+92-322-5519034', email: 'saad@naafay.edu.pk', addr: 'Peoples Colony, Faisalabad', addrUr: 'پیپلز کالونی، فیصل آباد', edu: 'Shahadat-ul-Alamiyyah', eduUr: 'شہادۃ العالمیہ', cls: cls2, bat: bat2, status: 'active' },
      { id: 'stu-7', prof: null, code: 'ST-007', en: 'Usama bin Zaid', ur: 'مولانا اسامہ بن زید', fEn: 'Dr. Zaid Mahmood', fUr: 'ڈاکٹر زید محمود', dob: '1997-12-09', phone: '+92-331-2239011', email: 'usama@naafay.edu.pk', addr: 'Model Town, Multan', addrUr: 'ماڈل ٹاؤن، ملتان', edu: 'Takhassus Year 1 Completed', eduUr: 'تخصص سالِ اول مکمل', cls: cls3, bat: bat3, status: 'active' },
      { id: 'stu-8', prof: null, code: 'ST-008', en: 'Bilal Ahmad Usmani', ur: 'مولانا بلال احمد عثمانی', fEn: 'Shafiq Ahmad Usmani', fUr: 'شفیق احمد عثمانی', dob: '2000-02-27', phone: '+92-305-4410923', email: 'bilal@naafay.edu.pk', addr: 'DHA Phase 2, Islamabad', addrUr: 'ڈی ایچ اے فیز ۲، اسلام آباد', edu: 'Shahadat-ul-Alamiyyah', eduUr: 'شہادۃ العالمیہ', cls: cls2, bat: bat2, status: 'on_leave' },
    ];

    const insStu = db.prepare(`
      INSERT INTO students (id, profile_id, student_code, full_name, full_name_ur, father_name, father_name_ur, date_of_birth, phone, email, address, address_ur, previous_education, previous_education_ur, admission_date, academic_year_id, class_id, batch_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insGuard = db.prepare('INSERT INTO guardians (id, full_name, full_name_ur, phone, whatsapp, occupation, address) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insSG = db.prepare('INSERT INTO student_guardians (id, student_id, guardian_id, relationship, is_primary) VALUES (?, ?, ?, ?, 1)');
    const insEnr = db.prepare('INSERT INTO enrollments (id, student_id, academic_year_id, class_id, batch_id, roll_number, status, enrolled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

    studentSeeds.forEach((s, idx) => {
      insStu.run(s.id, s.prof, s.code, s.en, s.ur, s.fEn, s.fUr, s.dob, s.phone, s.email, s.addr, s.addrUr, s.edu, s.eduUr, '2026-04-05', ayCurr, s.cls, s.bat, s.status);
      const gid = `grd-${idx + 1}`;
      insGuard.run(gid, s.fEn, s.fUr, s.phone, s.phone, 'Scholar / Business', s.addrUr);
      insSG.run(uid(), s.id, gid, 'father');
      insEnr.run(uid(), s.id, ayCurr, s.cls, s.bat, String(101 + idx), 'enrolled', '2026-04-05');
    });

    // Attendance records for today & past 2 days across 3 sessions
    const insAtt = db.prepare('INSERT INTO attendance_records (id, student_id, class_id, batch_id, session_id, attendance_date, status, remarks, marked_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const dates = [twoDaysAgo, yesterday, today];
    const sessions = [ses1, ses2, ses3];

    let sampleCorrectionRecordId = '';
    dates.forEach((dt, dIdx) => {
      sessions.forEach((sid, sIdx) => {
        studentSeeds.forEach((st, stIdx) => {
          // For today, leave Maghrib session unmarked for class 2 so user can mark live
          if (dt === today && sid === ses3 && st.cls !== cls1) return;
          let status = 'present';
          if (st.status === 'on_leave') status = 'leave';
          else if (dt === today && stIdx === 3 && sIdx === 0) status = 'absent';
          else if (dt === today && stIdx === 2 && sIdx === 1) status = 'late';
          else if (dt === yesterday && stIdx === 5 && sIdx === 2) status = 'absent';
          const recId = uid();
          if (dIdx === 1 && sIdx === 0 && stIdx === 1) sampleCorrectionRecordId = recId;
          insAtt.run(recId, st.id, st.cls, st.bat, sid, dt, status, status === 'late' ? 'Arrived 10 mins after Azan' : null, pTeacher1);
        });
      });
    });

    if (sampleCorrectionRecordId) {
      db.prepare('INSERT INTO attendance_corrections (id, attendance_record_id, previous_status, new_status, reason, corrected_by, corrected_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        uid(), sampleCorrectionRecordId, 'absent', 'present', 'Student was in the Darul Ifta library verifying reference for Mufti Sahib', pTeacher1, 'مفتی سلمان منصورپوری'
      );
    }

    // Daily Mutala (Student study logs + reviews)
    const insMutala = db.prepare('INSERT INTO study_logs (id, student_id, study_date, book_id, chapter, start_position, end_position, study_details, student_comments, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insRev = db.prepare('INSERT INTO study_reviews (id, study_log_id, teacher_id, reviewer_profile_id, reviewer_name, decision, comments) VALUES (?, ?, ?, ?, ?, ?, ?)');

    const m1 = uid();
    const m2 = uid();
    const m3 = uid();
    const m4 = uid();

    insMutala.run(m1, 'stu-1', yesterday, bkRasm, 'فصل فی الترجیح بین الروایات', 'صفحہ ۲۴', 'صفحہ ۳۹', 'علامہ شامی کی شرح عقود رسم المفتی سے ظاہر الروایہ اور نوادر کے درجات کا تقابلی مطالعہ اور فتاویٰ قاضی خان کی مثالوں کی تخریج۔', 'ایک جزئی میں اشکال ہے کہ قولِ صاحبین پر فتویٰ کب دیا جائے گا؟', 'approved');
    insRev.run(uid(), m1, t1, pTeacher1, 'مفتی سلمان منصورپوری', 'approved', 'ماشاءاللہ، عمدہ مطالعہ۔ ضرورتِ زمانہ اور تعاملِ ناس کے تحت قولِ صاحبین کی ترجیح کل کے سبق میں واضح کی جائے گی۔');

    insMutala.run(m2, 'stu-1', today, bkRadd, 'کتاب الطہارۃ — باب المیاہ', 'جلد ۱، صفحہ ۱۸۲', 'جلد ۱، صفحہ ۱۹۶', 'ماءِ مستعمل کی طہارت و نجاست کے اقوال اور امام محمد رحمہ اللہ کی روایت کا تجزیہ۔', 'حوالہ جات نوٹ کر لیے گئے ہیں۔', 'pending');
    insMutala.run(m3, 'stu-2', today, bkAshbah, 'القاعدۃ الاولیٰ: الامور بمقاصدہا', 'صفحہ ۴۵', 'صفحہ ۵۸', 'نیت کے فقہی احکام اور معاملاتِ بیع میں مقاصد کے اثر کا مطالعہ۔', 'شبہات کی فہرست تیار کر لی ہے۔', 'pending');
    insMutala.run(m4, 'stu-3', yesterday, bkRasm, 'مراتبِ فقہاء و کتبِ مذہب', 'صفحہ ۱۲', 'صفحہ ۲۲', 'طبقاتِ فقہاء کی تقسیم اور متونِ اربعہ کا تعارف۔', 'خلاصہ تحریر کرنا باقی ہے۔', 'needs_correction');
    insRev.run(uid(), m4, t1, pTeacher1, 'مفتی سلمان منصورپوری', 'needs_correction', 'متونِ اربعہ (قدوری، مختار، وقایہ، کنز) کے مصنفین اور سنینِ وفات بھی تحریر میں شامل کریں۔');

    // Additional Mutala seeds for stu-4, stu-5, stu-6, stu-7, stu-8
    const m5 = uid();
    const m6 = uid();
    const m7 = uid();
    const m8 = uid();
    const m9 = uid();
    const m10 = uid();
    insMutala.run(m5, 'stu-4', today, bkRadd, 'کتاب الصلوۃ — باب شروط الصلوۃ', 'جلد ۱، ص ۳۲۰', 'جلد ۱، ص ۳۳۵', 'استقبالِ قبلہ اور شرائطِ تحریمہ کے فقہی جزئیات کا مطالعہ۔', 'شرائط کے سقوط کی صورتیں نوٹ کی ہیں۔', 'approved');
    insRev.run(uid(), m5, t1, pTeacher1, 'مفتی سلمان منصورپوری', 'approved', 'ماشاءاللہ، جزئیات کی تطبیق درست ہے۔');

    insMutala.run(m6, 'stu-5', today, bkBuhuth, 'فصل فی التورق والبیع بالتقسیط', 'ص ۱۱۰', 'ص ۱۲۸', 'معاصر مالیاتی اداروں میں تورقِ منظّم کے شرعی احکام اور مجمع الفقہ الاسلامی کی قراردادوں کا جائزہ۔', 'عقدِ معلق اور شرطِ فاسد پر بحث کی ہے۔', 'approved');
    insRev.run(uid(), m6, t2, pTeacher2, 'مفتی خالد سیف اللہ', 'approved', 'عمدہ تحقیق۔ تفصیلی خلاصہ مقالہ میں شامل کریں۔');

    insMutala.run(m7, 'stu-5', yesterday, bkHidayah, 'کتاب البیوع — باب الخیارات', 'جلد ۳، ص ۴۵', 'جلد ۳، ص ۶۰', 'خیارِ شرط اور خیارِ عیب کے احکام مع ادلہ فقہیہ۔', 'خیارِ رویت کے مسائل کا مطالعہ جاری ہے۔', 'approved');
    insRev.run(uid(), m7, t2, pTeacher2, 'مفتی خالد سیف اللہ', 'approved', 'درست ہے۔');

    insMutala.run(m8, 'stu-6', today, bkSiraji, 'باب احوال الاخوات لاب وام ولاب', 'ص ۳۵', 'ص ۴۸', 'سگی اور علاتی بہنوں کے استحقاقِ میراث کی شرائط اور حجبِ حرمان کا تقابلی جائزہ۔', 'عملی جدول تیار کیا ہے۔', 'approved');
    insRev.run(uid(), m8, t4, null, 'مفتی سعید احمد پالنپوری', 'approved', 'بہت خوب، جدول درست ہے۔');

    insMutala.run(m9, 'stu-7', today, bkRasm, 'تحقیق حکم الافتاء فی النوازل', 'ص ۸۵', 'ص ۹۹', 'جدید مسائل میں علماءِ معاصرین کے مناہجِ افتاء کا تقابلی مطالعہ اور تمرین۔', 'فتاویٰ عثمانی سے مراجعت کی۔', 'approved');
    insRev.run(uid(), m9, t1, pTeacher1, 'مفتی سلمان منصورپوری', 'approved', 'طریقہ کار مستحسن ہے۔');

    insMutala.run(m10, 'stu-8', yesterday, bkBuhuth, 'احکام الصکوک والاوراق المالیہ', 'ص ۲۴۰', 'ص ۲۵۸', 'اسلامی تمسکات (صکوک) کی اقسام اور ان میں ملکیتِ شائعہ کے اصول۔', 'صکوکِ اجارہ کے شرائط کا جائزہ۔', 'approved');
    insRev.run(uid(), m10, t2, pTeacher2, 'مفتی خالد سیف اللہ', 'approved', 'اچھی کوشش ہے۔');

    // Lesson Records (Teacher-entered lessons — strictly separate from student Mutala)
    const insLesson = db.prepare('INSERT INTO lesson_records (id, teacher_id, lesson_date, class_id, batch_id, subject_id, book_id, start_position, end_position, homework, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    insLesson.run(uid(), t1, today, cls1, bat1, subUsool, bkRasm, 'شعر ۱۵، صفحہ ۳۵', 'شعر ۲۴، صفحہ ۴۶', 'قولِ ضعیف پر عمل کی شرائط پر مختصر نوٹ لکھ کر لائیں', 'طلبہ کی شرکت تسلی بخش رہی');
    insLesson.run(uid(), t1, yesterday, cls1, bat1, subFiqh, bkRadd, 'باب المیاہ، ص ۱۷۰', 'باب المیاہ، ص ۱۸۲', 'ردالمحتار اور فتح القدیر کا تقابلی مطالعہ', 'نئے طلبہ کو حاشیہ دیکھنے کا طریقہ سمجھایا گیا');
    insLesson.run(uid(), t2, today, cls2, bat2, subMuamalat, bkBuhuth, 'باب المرابحہ، ص ۲۱۰', 'باب المرابحہ، ص ۲۲۸', 'اسلامی بینکاری میں وعدہ بیع کے دو فتاویٰ کی تخریج', 'عملی تمرین کروائی گئی');
    insLesson.run(uid(), t2, yesterday, cls3, bat3, subTahqeeq, bkHidayah, 'کتاب البیوع، ص ۱۲', 'باب بیع الفاسد، ص ۲۸', 'بیعِ فاسد و باطل کے بنیادی فروق کی تخریج', 'تمرینِ افتاء کے طلبہ نے شامی سے مراجعت کی');
    insLesson.run(uid(), t3, yesterday, cls1, bat1, subQawaid, bkAshbah, 'القاعدۃ الثانیۃ، ص ۶۸', 'القاعدۃ الثانیۃ، ص ۸۰', 'الیقین لا یزول بالشک کی ۵ فروعات یاد کریں', 'مکمل حاضری');
    insLesson.run(uid(), t4, today, cls2, bat2, subAhwal, bkSiraji, 'باب ذوی الفروض، ص ۱۵', 'باب العصبات، ص ۲۶', 'عول اور رد کی پانچ عملی مثالیں حل کریں', 'مشق مکمل ہوئی');

    // Exams, Exam Subjects & Results
    const exPast = 'exm-term1';
    const exUpcoming = 'exm-annual';
    db.prepare('INSERT INTO exams (id, academic_year_id, class_id, title_en, title_ur, exam_type, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      exPast, ayCurr, cls1, 'First Term Examination 1447', 'ششماہی امتحان ۱۴۴۷ھ — سالِ اول', 'term', twoDaysAgo, yesterday, 'published'
    );
    db.prepare('INSERT INTO exams (id, academic_year_id, class_id, title_en, title_ur, exam_type, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      exUpcoming, ayCurr, cls1, 'Annual Takhassus Assessment', 'سالانہ امتحانِ تخصص و افتاء', 'annual', nextWeek, nextMonth, 'scheduled'
    );

    const es1 = 'es-1';
    const es2 = 'es-2';
    const es3 = 'es-3';
    const insES = db.prepare('INSERT INTO exam_subjects (id, exam_id, subject_id, book_id, exam_date, written_max_marks, oral_max_marks, passing_marks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    insES.run(es1, exPast, subUsool, bkRasm, twoDaysAgo, 80, 20, 40);
    insES.run(es2, exPast, subFiqh, bkRadd, yesterday, 80, 20, 40);
    insES.run(es3, exPast, subQawaid, bkAshbah, yesterday, 80, 20, 40);
    insES.run(uid(), exUpcoming, subUsool, bkRasm, nextWeek, 80, 20, 40);
    insES.run(uid(), exUpcoming, subFiqh, bkRadd, nextMonth, 80, 20, 40);

    const insER = db.prepare('INSERT INTO exam_results (id, exam_id, exam_subject_id, student_id, written_marks, oral_marks, total_marks, grade, remarks, entered_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const cls1Students = studentSeeds.filter((s) => s.cls === cls1);
    const sampleScores = [
      [74, 18], [69, 17], [61, 15], [55, 14]
    ];
    cls1Students.forEach((st, i) => {
      [es1, es2, es3].forEach((esId, j) => {
        const w = Math.max(35, sampleScores[i][0] - j * 3);
        const o = Math.max(10, sampleScores[i][1] - (j % 2));
        const tot = w + o;
        insER.run(uid(), exPast, esId, st.id, w, o, tot, computeGrade(tot, 100), tot >= 85 ? 'ممتاز کارکردگی' : 'تسلی بخش', pTeacher1);
      });
    });

    // Exams & results for Class 2 & 3
    const exTak2 = 'exm-tak2-term';
    const exIfta = 'exm-ifta-term';
    db.prepare('INSERT INTO exams (id, academic_year_id, class_id, title_en, title_ur, exam_type, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      exTak2, ayCurr, cls2, 'First Term Examination — Year 2', 'ششماہی امتحانِ تخصص سالِ دوم ۱۴۴۷ھ', 'term', twoDaysAgo, yesterday, 'published'
    );
    db.prepare('INSERT INTO exams (id, academic_year_id, class_id, title_en, title_ur, exam_type, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      exIfta, ayCurr, cls3, 'First Term Fellowship Evaluation', 'ششماہی جائزہ تمرینِ افتاء ۱۴۴۷ھ', 'term', twoDaysAgo, yesterday, 'published'
    );

    const esTak2_1 = 'es-tak2-1';
    const esTak2_2 = 'es-tak2-2';
    const esIfta_1 = 'es-ifta-1';
    insES.run(esTak2_1, exTak2, subMuamalat, bkBuhuth, twoDaysAgo, 80, 20, 40);
    insES.run(esTak2_2, exTak2, subAhwal, bkSiraji, yesterday, 80, 20, 40);
    insES.run(esIfta_1, exIfta, subTahqeeq, bkHidayah, yesterday, 80, 20, 40);

    insER.run(uid(), exTak2, esTak2_1, 'stu-5', 73, 18, 91, 'A+', 'ممتاز کارکردگی', pTeacher2);
    insER.run(uid(), exTak2, esTak2_2, 'stu-5', 70, 17, 87, 'A+', 'بہترین جوابات', pTeacher2);
    insER.run(uid(), exTak2, esTak2_1, 'stu-6', 65, 16, 81, 'A', 'جید جداً', pTeacher2);
    insER.run(uid(), exTak2, esTak2_2, 'stu-6', 68, 17, 85, 'A+', 'میراث کے مسائل میں کمال مہارت', pTeacher2);
    insER.run(uid(), exTak2, esTak2_1, 'stu-8', 60, 15, 75, 'B+', 'جید کارکردگی', pTeacher2);
    insER.run(uid(), exTak2, esTak2_2, 'stu-8', 62, 16, 78, 'B+', 'تسلی بخش', pTeacher2);
    insER.run(uid(), exIfta, esIfta_1, 'stu-7', 76, 19, 95, 'A+', 'ممتاز ترین تمرین و مقالہ نگاری', pTeacher1);

    // Research Topics, Assignments, Submissions & Reviews
    const top1 = 'res-top-1';
    const top2 = 'res-top-2';
    const top3 = 'res-top-3';
    const insTopic = db.prepare('INSERT INTO research_topics (id, academic_year_id, title_en, title_ur, field_of_fiqh, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)');
    insTopic.run(top1, ayCurr, 'Jurisprudential Ruling on Digital Murabaha & E-Commerce Escrow', 'ڈیجیٹل مرابحہ اور ای کامرس ایسکرو کا فقہی حکم', 'معاملاتِ مالیہ (Islamic Finance)', 'Comparative analysis of Qabd Hukmi in online marketplaces according to Hanafi Usul.', pAdmin);
    insTopic.run(top2, ayCurr, 'Role of Custom (Urf) in Contemporary Fatwa Methodology', 'معاصر افتاء میں عرف و تعامل کا کردار و حدود', 'اصولِ افتاء', 'Detailed investigation into Ibn Abidin’s treatise Nashr al-Urf.', pAdmin);
    insTopic.run(top3, ayCurr, 'Medical Life Support Withdrawal from a Hanafi Perspective', 'طبی آلاتِ تنفس (وینٹی لیٹر) ہٹانے کی شرعی حیثیت', 'فقہِ جدید و طب', 'Analysis of Hayat Mustaqirrah vs Hayat Ghair Mustaqirrah.', pAdmin);

    const ra1 = 'ra-1';
    const ra2 = 'ra-2';
    const ra3 = 'ra-3';
    const insRA = db.prepare('INSERT INTO research_assignments (id, topic_id, student_id, supervisor_teacher_id, deadline, status) VALUES (?, ?, ?, ?, ?, ?)');
    insRA.run(ra1, top1, 'stu-5', t2, nextMonth, 'submitted');
    insRA.run(ra2, top2, 'stu-1', t1, nextWeek, 'needs_correction');
    insRA.run(ra3, top3, 'stu-7', t2, yesterday, 'approved');
    insRA.run(uid(), top2, 'stu-2', t1, '2026-12-15', 'in_progress');
    insRA.run(uid(), top1, 'stu-3', t2, '2026-12-20', 'in_progress');
    insRA.run(uid(), top2, 'stu-4', t1, '2026-12-30', 'in_progress');
    insRA.run(uid(), top3, 'stu-6', t2, '2026-12-10', 'submitted');
    insRA.run(uid(), top1, 'stu-8', t2, '2027-01-15', 'in_progress');

    const rs1 = 'rs-1';
    const rs2 = 'rs-2';
    const rs3 = 'rs-3';
    const insRS = db.prepare('INSERT INTO research_submissions (id, assignment_id, version_number, file_name, file_url, notes, submitted_by) VALUES (?, ?, ?, ?, ?, ?, ?)');
    insRS.run(rs1, ra1, 1, 'digital_murabaha_v1.pdf', '/api/uploads/sample-research-1.txt', 'Initial draft with 42 Arabic Fiqh citations', pStudent1);
    insRS.run(rs2, ra2, 1, 'urf_in_fatwa_draft.pdf', '/api/uploads/sample-research-2.txt', 'First chapter submitted for Mufti Sahib review', pStudent1);
    insRS.run(rs3, ra3, 2, 'medical_life_support_final.pdf', '/api/uploads/sample-research-3.txt', 'Revised final manuscript after incorporating supervisor edits', pAdmin);

    const insRR = db.prepare('INSERT INTO research_reviews (id, assignment_id, submission_id, supervisor_teacher_id, decision, comments) VALUES (?, ?, ?, ?, ?, ?)');
    insRR.run(uid(), ra2, rs2, t1, 'needs_correction', 'نشر العرف فی بناء بعض الاحکام علی العرف کی عبارتوں کی مکمل تخریج مع جلد و صفحہ شامل کریں۔');
    insRR.run(uid(), ra3, rs3, t2, 'approved', 'مقالہ تحقیق کے معیار پر پورا اترتا ہے، دارالافتاء کے علمی ذخیرے میں محفوظ کرنے کی منظوری دی جاتی ہے۔');

    // Documents
    const insDoc = db.prepare('INSERT INTO documents (id, entity_type, entity_id, title, category, file_name, file_url, mime_type, file_size_bytes, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    insDoc.run(uid(), 'student', 'stu-1', 'شہادۃ العالمیہ سند (Wifaq ul Madaris)', 'certificate', 'sanad_alamiyyah_st0001.pdf', '/api/uploads/sample-doc.txt', 'application/pdf', 245760, pStaff);
    insDoc.run(uid(), 'student', 'stu-1', 'قومی شناختی کارڈ و داخلہ فارم', 'identity', 'cnic_admission_st0001.pdf', '/api/uploads/sample-doc.txt', 'application/pdf', 184320, pStaff);
    insDoc.run(uid(), 'student', 'stu-2', 'شہادۃ العالمیہ کشف الدرجات', 'transcript', 'transcript_st0002.pdf', '/api/uploads/sample-doc.txt', 'application/pdf', 198400, pStaff);

    // Notifications & Audit logs
    const insNotif = db.prepare('INSERT INTO notifications (id, recipient_profile_id, title_en, title_ur, body_en, body_ur, module, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    insNotif.run(uid(), pTeacher1, '2 Pending Daily Mutala Reviews', 'روزانہ مطالعہ کی ۲ درخواستیں زیرِ التوا', 'Students submitted new study logs awaiting verification.', 'طلبہ نے آج کے مطالعہ کا ریکارڈ تصدیق کے لیے جمع کروایا ہے۔', 'mutala', m2);
    insNotif.run(uid(), pStudent1, 'Research Revision Requested', 'مقالہ تحقیق میں ترمیم مطلوب ہے', 'Mufti Salman added review comments on your Urf research draft.', 'مفتی سلمان منصورپوری نے آپ کے مقالہ پر اصلاحی نوٹ تحریر فرمایا ہے۔', 'research', ra2);

    const insAudit = db.prepare('INSERT INTO audit_logs (id, actor_profile_id, actor_name, actor_role, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    insAudit.run(uid(), pTeacher1, 'مفتی سلمان منصورپوری', 'teacher', 'ATTENDANCE_MARKED', 'attendance', today, JSON.stringify({ session: 'صبح تا ظہر', count: 8 }));
    insAudit.run(uid(), pTeacher1, 'مفتی سلمان منصورپوری', 'teacher', 'ATTENDANCE_CORRECTED', 'attendance', sampleCorrectionRecordId, JSON.stringify({ from: 'absent', to: 'present', student: 'ST-0002' }));
    insAudit.run(uid(), pTeacher1, 'مفتی سلمان منصورپوری', 'teacher', 'MUTALA_APPROVED', 'study_log', m1, JSON.stringify({ student: 'ST-0001', book: 'شرح عقود رسم المفتی' }));
    insAudit.run(uid(), pTeacher2, 'مفتی خالد سیف اللہ', 'teacher', 'RESEARCH_APPROVED', 'research', ra3, JSON.stringify({ student: 'ST-0007', title: 'وینٹی لیٹر کی شرعی حیثیت' }));
    insAudit.run(uid(), pStaff, 'مولانا زبیر احمد', 'office_staff', 'EXAM_PUBLISHED', 'exam', exPast, JSON.stringify({ exam: 'ششماہی امتحان ۱۴۴۷ھ' }));
  });

  tx();
}

export function nextFatwaCode(): string {
  const yr = new Date().getFullYear();
  const rows = db.prepare('SELECT fatwa_code FROM fatwa_questions').all() as { fatwa_code: string }[];
  let maxNum = 0;
  for (const r of rows) {
    const m = /^FAT-\d{4}-(\d+)$/.exec(r.fatwa_code);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `FAT-${yr}-${String(maxNum + 1).padStart(4, '0')}`;
}

export function nextIssuedFatwaNumber(): string {
  const yr = new Date().getFullYear();
  const rows = db.prepare('SELECT issued_fatwa_number FROM fatwa_questions WHERE issued_fatwa_number IS NOT NULL').all() as { issued_fatwa_number: string }[];
  let maxNum = 0;
  for (const r of rows) {
    const m = /^NA-FATWA-\d{4}-(\d+)$/.exec(r.issued_fatwa_number);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `NA-FATWA-${yr}-${String(maxNum + 1).padStart(4, '0')}`;
}

function seedDarulIftaData() {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const tx = db.transaction(() => {
    // Ensure senior_mufti role exists
    db.prepare('INSERT OR IGNORE INTO roles (id, name, title_en, title_ur, description) VALUES (?, ?, ?, ?, ?)').run(
      'role-senior-mufti', 'senior_mufti', 'Senior Mufti', 'مفتیِ اعظم / سینئر مفتی', 'Senior Fatwa Review'
    );

    const cats = [
      ['cat-taharah', 'TAHARAH', 'Taharah (Purification)', 'طہارت و پاکیزگی', 'کتاب الطهارة', 1],
      ['cat-salah', 'SALAH', 'Salah (Prayer)', 'نماز کے مسائل', 'کتاب الصلاة', 2],
      ['cat-fasting', 'FASTING', 'Fasting (Sawm)', 'روزہ و اعتکاف', 'کتاب الصوم', 3],
      ['cat-zakat', 'ZAKAT', 'Zakat & Charity', 'زکوٰۃ و صدقات', 'کتاب الزكاة', 4],
      ['cat-hajj', 'HAJJ', 'Hajj and Umrah', 'حج و عمرہ', 'کتاب الحج', 5],
      ['cat-nikah', 'NIKAH', 'Nikah (Marriage)', 'نکاح و عائلی مسائل', 'کتاب النکاح', 6],
      ['cat-talaq', 'TALAQ', 'Talaq (Divorce)', 'طلاق و خلع و عدت', 'کتاب الطلاق', 7],
      ['cat-inheritance', 'INHERITANCE', 'Inheritance (Mirath)', 'وراثت و تقسیمِ ترکہ', 'کتاب الفرائض', 8],
      ['cat-business', 'BUSINESS', 'Business Transactions', 'خرید و فروخت و تجارت', 'کتاب البيوع', 9],
      ['cat-finance', 'FINANCE', 'Islamic Finance', 'اسلامی بینکاری و مالیات', 'المعاملات المالية', 10],
      ['cat-medical', 'MEDICAL', 'Medical Issues', 'طبی و جدید شرعی مسائل', 'المسائل الطبية', 11],
      ['cat-contemporary', 'CONTEMPORARY', 'Contemporary Issues', 'معاصر و جدید مسائل', 'النوازل المعاصرة', 12],
      ['cat-other', 'OTHER', 'Other Fiqh Matters', 'متفرق فقہی مسائل', 'مسائل متفرقة', 13],
    ];
    const insCat = db.prepare('INSERT INTO fatwa_categories (id, code, name_en, name_ur, name_ar, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
    for (const c of cats) insCat.run(...c);

    const q1 = 'fq-1';
    const q2 = 'fq-2';
    const q3 = 'fq-3';
    const q4 = 'fq-4';
    const q5 = 'fq-5';

    const insQ = db.prepare(`
      INSERT INTO fatwa_questions (
        id, fatwa_code, issued_fatwa_number, question_date, questioner_name, questioner_phone, questioner_email,
        city, country, category_id, subject_title, subject_title_ur, question_text,
        is_identity_private, allow_public_identity, source, workflow_status, publication_status, registered_by, issued_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 1. Issued & Published Fatwa
    insQ.run(
      q1, 'FAT-2026-0001', 'NA-FATWA-2026-0001', threeDaysAgo,
      'Muhammad Farhan Siddiqui', '+92-300-5128834', 'farhan@example.com',
      'Karachi', 'Pakistan', 'cat-finance',
      'Zakat on Business Inventory & Digital Receivables',
      'تجارتی مال اور ڈیجیٹل واجب الوصول رقوم پر زکوٰۃ کا حکم',
      'السلام علیکم ورحمۃ اللہ وبرکاتہ، مفتیانِ کرام سے معلوم یہ کرنا ہے کہ ہماری آن لائن تجارت میں سال پورا ہونے پر گودام میں موجود مالِ تجارت کے ساتھ ساتھ ای کامرس پلیٹ فارم پر رکی ہوئی قابلِ وصول رقوم (Receivables) پر زکوٰۃ کا حساب کس طرح کیا جائے گا؟',
      1, 0, 'public_portal', 'issued', 'published', 'prof-staff', yesterday
    );

    // 2. Pending Final Approval (Senior Mufti already reviewed)
    insQ.run(
      q2, 'FAT-2026-0002', null, yesterday,
      'Dr. Salman Haider', '+92-321-8891204', 'dr.salman@example.com',
      'Lahore', 'Pakistan', 'cat-medical',
      'Use of Alcohol-Based Medical Sanitizers Before Salah',
      'طبی الکوحل پر مشتمل سینیٹائزر لگا کر نماز پڑھنے کا شرعی حکم',
      'ہسپتال میں ڈیوٹی کے دوران ڈاکٹروں کو بار بار الکوحل والا ہینڈ سینیٹائزر استعمال کرنا پڑتا ہے۔ کیا اس کے بعد ہاتھ دھوئے بغیر نماز ادا کی جا سکتی ہے؟',
      1, 0, 'office', 'final_approval', 'internal_only', 'prof-staff', null
    );

    // 3. Pending Senior Review (Assigned to Student ST-0001 & Mufti)
    insQ.run(
      q3, 'FAT-2026-0003', null, yesterday,
      'Tariq Mehmood', '+92-333-4429100', 'tariq.m@example.com',
      'Rawalpindi', 'Pakistan', 'cat-business',
      'Advance Payment in Online Dropshipping Agreement',
      'آن لائن ڈراپ شپنگ میں بیعِ سلم اور پیشگی ادائیگی کی شرعی حیثیت',
      'اگر کوئی شخص آن لائن اسٹور چلاتا ہو اور گاہک سے مکمل قیمت پیشگی لے کر کسی تیسرے سپلائر سے براہِ راست سامان بھجوائے، جبکہ بائع کے قبضے میں سامان نہ آیا ہو، تو شرعاً اس معاملے کا کیا حکم ہے؟',
      1, 0, 'public_portal', 'senior_review', 'internal_only', 'prof-staff', null
    );

    // 4. Under Research (Assigned to Student ST-0001)
    insQ.run(
      q4, 'FAT-2026-0004', null, today,
      'Hafiz Bilal Qureshi', '+92-345-9901122', null,
      'Multan', 'Pakistan', 'cat-inheritance',
      'Distribution of Inheritance Among Widow, Sons & Married Daughters',
      'بیوہ، دو بیٹوں اور شادی شدہ بیٹیوں کے درمیان تقسیمِ ترکہ',
      'ایک مرحوم کے ورثاء میں ایک بیوہ، دو بیٹے اور تین بیٹیاں شامل ہیں۔ مرحوم کی کل جائیداد میں ایک رہائشی مکان اور بینک بیلنس ہے۔ شریعت کے مطابق ہر وارث کا حصہ متعین فرمائیں۔',
      1, 0, 'office', 'research', 'internal_only', 'prof-staff', null
    );

    // 5. Newly Registered (Unassigned)
    insQ.run(
      q5, 'FAT-2026-0005', null, today,
      'Saima Bibi', '+92-312-7765401', null,
      'Islamabad', 'Pakistan', 'cat-talaq',
      'Conditional Divorce Pronunciation During Anger',
      'غصے کی حالت میں مشروط طلاق کا شرعی حکم',
      'شوہر نے شدید غصے میں بیوی سے کہا کہ اگر تم اپنے میکے گئیں تو تمہیں طلاق ہے۔ اب دونوں صلح چاہتے ہیں، رہنمائی فرمائیں۔',
      1, 0, 'office', 'registered', 'internal_only', 'prof-staff', null
    );

    // Assignments
    const insAss = db.prepare('INSERT INTO fatwa_assignments (id, question_id, assignee_profile_id, assignee_role, assigned_by, assigned_date, deadline, instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    insAss.run(uid(), q1, 'prof-teacher-1', 'mufti', 'prof-admin', threeDaysAgo, yesterday, 'Prepare full financial Zakat ruling with Shami references');
    insAss.run(uid(), q2, 'prof-teacher-1', 'mufti', 'prof-admin', yesterday, today, 'Verify Hanafi Usul on non-khamr synthetic alcohol');
    insAss.run(uid(), q3, 'prof-student-1', 'student', 'prof-teacher-2', yesterday, nextWeek, 'Research Qabd before sale and Salam conditions in Hidayah & Buhuth');
    insAss.run(uid(), q3, 'prof-teacher-1', 'mufti', 'prof-admin', yesterday, nextWeek, 'Supervise student research and draft final Arabic citations');
    insAss.run(uid(), q4, 'prof-student-1', 'student', 'prof-admin', today, nextWeek, 'Calculate Faraid shares using Al-Sirajiyyah');

    // Reusable Classical Fiqh References
    const insRef = db.prepare('INSERT INTO fatwa_references (id, question_id, book_name, author, volume, page_number, chapter, arabic_quotation, explanation, reference_notes, is_reusable, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)');
    insRef.run(
      uid(), q1,
      'رد المحتار (فتاویٰ شامی)', 'علامہ ابن عابدین شامی رحمہ اللہ', 'ج ۲', 'ص ۲۷۳', 'کتاب الزکوٰۃ',
      'وشرط افتراضہا حولان الحول علی النصاب، وتضم قیمۃ العروض إلی الثمنین والدیون القویۃ التی علی مقر ملیء۔',
      'اموالِ تجارت کی قیمت کو نقدی اور قوی قرضوں (قابلِ وصول تجارتی واجبات) کے ساتھ ملا کر ڈھائی فیصد زکوٰۃ ادا کرنا لازم ہے۔',
      'تجارتی مال اور قابلِ وصول رقوم پر زکوٰۃ کی بنیادی دلیل', 'prof-teacher-1'
    );
    insRef.run(
      uid(), q2,
      'تکملۃ فتح الملہم', 'مفتی محمد تقی عثمانی', 'ج ۱', 'ص ۳۴۸', 'کتاب الاشربۃ',
      'إن الکحول المتخذۃ من غیر العنب والتمر والزبیب لیست بنجسۃ عند الإمام أبی حنیفۃ وأبی یوسف رحمہما اللہ تعالیٰ، ویجوز استعمالہا للتداوی والتطہیر الخارجی۔',
      'انگور اور کھجور کے علاوہ دیگر اشیاء سے حاصل شدہ صنعتی الکوحل امام اعظم اور امام ابو یوسف کے نزدیک ناپاک نہیں، لہٰذا خارجی طبی استعمال اور نماز میں کوئی حرج نہیں۔',
      'جدید طبی مسائل میں اہم فقہی حوالہ', 'prof-teacher-1'
    );
    insRef.run(
      uid(), q3,
      'الہدایہ فی شرح بدایۃ المبتدی', 'امام برہان الدین مرغینانی رحمہ اللہ', 'ج ۳', 'ص ۶۳', 'کتاب البیوع — باب المرابحۃ والتولیۃ',
      'ومن اشتری شیئاً مما ینقل ویحول لم یجز لہ بیعہ حتی یقبضہ، لقولہ علیہ السلام: لا تبع ما لیس عندک۔',
      'منقولہ اشیاء کو قبضہ کرنے سے پہلے آگے بیچنا شرعاً جائز نہیں؛ ڈراپ شپنگ میں بائع یا اس کے وکیل کا قبضہ ضروری ہے۔',
      'بیع قبل القبض کی ممانعت', 'prof-student-1'
    );

    // Research Workspace Entries
    const insRes = db.prepare('INSERT INTO fatwa_research (id, question_id, author_profile_id, author_name, research_notes, related_books, arabic_quotations, urdu_explanation, fiqhi_opinions, supporting_evidence, researcher_comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    insRes.run(
      uid(), q3, 'prof-student-1', 'مولانا عبدالرحمٰن مدنی',
      'آن لائن ڈراپ شپنگ میں اگر بیچنے والا پہلے سے متعین چیز بیچے جبکہ وہ اس کی ملکیت و قبضہ میں نہ ہو تو بیع قبل القبض اور بیع ما لیس عندہ لازم آتی ہے۔ تاہم اگر بیعِ سلم یا استصناع یا وکالت بالعمولہ کی صورت اختیار کی جائے تو جواز کی صورت نکل سکتی ہے۔',
      'الہدایہ ج ۳، فقہ البیوع ج ۱ ص ۴۳۰، معاییرِ شرعیہ (ایوفی)',
      'نہی النبی ﷺ عن بیع ما لیس عند الإنسان، ورخص فی السلم۔',
      'شرعی جواز کے لیے ضروری ہے کہ یا تو بائع پہلے سامان اپنے یا اپنے وکیل کے قبضے میں لے، یا پھر گاہک کے ساتھ باقاعدہ بیعِ سلم یا وکالت کا عقد کرے۔',
      'جمہور فقہاء و حنفیہ کے نزدیک غیر مقبوض مبیع منقول کی بیع فاسد ہے',
      'احادیثِ بیع ما لیس عندک و عباراتِ بدائع الصنائع',
      'مزید تفصیل معاییرِ شرعیہ سے منسلک کر دی گئی ہے۔'
    );
    insRes.run(
      uid(), q4, 'prof-student-1', 'مولانا عبدالرحمٰن مدنی',
      'میت کی اولاد موجود ہونے کی وجہ سے بیوہ کا حصہ آٹھواں (1/8) ہوگا، اور باقی 7/8 ترکہ للذکر مثل حظ الانثیین کے تحت دو بیٹوں اور تین بیٹیوں میں 7 حصوں پر تقسیم ہوگا (ہر بیٹے کو 2 حصے اور ہر بیٹی کو 1 حصہ، کل 7 سر)۔',
      'السراجی فی المیراث، رد المحتار کتاب الفرائض',
      'فَإِن کَانَ لَکُمْ وَلَدٌ فَلَہُنَّ الثُّمُنُ مِمَّا تَرَکْتُمْ۔',
      'کل 56 حصے بنیں گے: بیوہ کو 7 حصے (12.5%)، ہر بیٹے کو 14 حصے (25%)، اور ہر بیٹی کو 7 حصے (12.5%) ملیں گے۔',
      'اجماعی قرآنی تقسیم',
      'سورۃ النساء آیت ۱۱ و ۱۲',
      'حسابات کی جانچ مکمل ہو چکی ہے۔'
    );

    // Drafts & Versions
    const d1Ur = `بسم اللہ الرحمٰن الرحیم\n\nالجواب وباللہ التوفیق:\nصورتِ مسئولہ میں سالِ زکوٰۃ مکمل ہونے پر گودام میں موجود تمام مالِ تجارت کی موجودہ قیمتِ فروخت لگائی جائے گی۔ اسی طرح ای کامرس پلیٹ فارم یا گاہکوں کے ذمہ جو رقوم واجب الادا ہیں اور ان کی وصولی کی امید ہے (دیونِ قویہ)، انہیں بھی کل نصاب میں شامل کر کے مجموعی مالیت پر ڈھائی فیصد (2.5%) زکوٰۃ ادا کرنا شرعاً لازم ہے۔\n\nواللہ تعالیٰ اعلم بالصواب`;
    const d2Ur = `بسم اللہ الرحمٰن الرحیم\n\nالجواب حامداً ومصلیاً:\nصورتِ مسئولہ میں ہسپتالوں میں مستعمل صنعتی الکوحل (جو انگور یا کھجور سے تیار نہ کیا گیا ہو) شیخین رحمہما اللہ کے نزدیک ناپاک نہیں ہے۔ لہٰذا طبی ضرورت کے تحت سینیٹائزر لگانے کے بعد ہاتھ دھوئے بغیر نماز ادا کرنا شرعاً جائز اور درست ہے، خصوصاً جب کہ الکوحل جلد سے فوراً بخارات بن کر اڑ جاتا ہے۔\n\nواللہ اعلم بالصواب`;
    const d3Ur = `بسم اللہ الرحمٰن الرحیم\n\nالجواب وباللہ التوفیق:\nشرعی اصول کے مطابق کسی منقولہ چیز کو قبضہ کرنے سے پہلے آگے فروخت کرنا جائز نہیں ہے۔ لہٰذا روایتی ڈراپ شپنگ جس میں بائع نہ خود مالک ہوتا ہے اور نہ قبضہ رکھتا ہے، شرعاً درست نہیں۔ اس کا متبادل یہ ہے کہ یا تو بائع سپلائر کا وکیل بن کر کمیشن پر معاملہ کرے، یا گاہک سے محض وعدۂ بیع (Promise) لے اور قبضے کے بعد باقاعدہ عقدِ بیع انجام دے۔`;

    const insDraft = db.prepare('INSERT INTO fatwa_drafts (id, question_id, draft_title, draft_body_ur, draft_body_ar, current_version, last_edited_by) VALUES (?, ?, ?, ?, ?, ?, ?)');
    insDraft.run(uid(), q1, 'زکوٰۃ بر مالِ تجارت و واجبات', d1Ur, 'والله أعلم بالصواب، كتبه دار الإفتاء نافع', 2, 'prof-teacher-1');
    insDraft.run(uid(), q2, 'طبی سینیٹائزر کا حکم', d2Ur, 'والله تعالى أعلم وعلمه أتم وأحكم', 1, 'prof-teacher-1');
    insDraft.run(uid(), q3, 'آن لائن ڈراپ شپنگ کا مسودہ', d3Ur, '', 1, 'prof-student-1');

    const insVer = db.prepare('INSERT INTO fatwa_versions (id, question_id, version_number, draft_body_ur, draft_body_ar, saved_by, saved_by_name, change_summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    insVer.run(uid(), q1, 1, d1Ur, '', 'prof-teacher-1', 'مفتی سلمان منصورپوری', 'Initial draft prepared');
    insVer.run(uid(), q1, 2, d1Ur, 'والله أعلم بالصواب، كتبه دار الإفتاء نافع', 'prof-teacher-1', 'مفتی سلمان منصورپوری', 'Final wording verified by Senior Mufti');
    insVer.run(uid(), q2, 1, d2Ur, 'والله تعالى أعلم وعلمه أتم وأحكم', 'prof-teacher-1', 'مفتی سلمان منصورپوری', 'Submitted for Senior Review');
    insVer.run(uid(), q3, 1, d3Ur, '', 'prof-student-1', 'مولانا عبدالرحمٰن مدنی', 'Submitted for Senior Mufti review');

    // Senior Reviews
    const insRev = db.prepare('INSERT INTO fatwa_reviews (id, question_id, version_number, reviewer_profile_id, reviewer_name, decision, comments, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    insRev.run(uid(), q1, 2, 'prof-teacher-2', 'مفتی خالد سیف اللہ (مفتیِ اعظم)', 'approved_for_final', 'حوالہ جات ردالمحتار سے مطابق ہیں، حتمی منظوری کے لیے پیش کیا جاتا ہے۔', yesterday);
    insRev.run(uid(), q2, 1, 'prof-teacher-2', 'مفتی خالد سیف اللہ (مفتیِ اعظم)', 'approved_for_final', 'تکملۃ فتح الملہم کا حوالہ درست ہے، ناظمِ دارالافتاء کی حتمی توثیق کے لیے منظور ہے۔', today);

    // Final Approval for q1
    db.prepare('INSERT INTO fatwa_approvals (id, question_id, approver_profile_id, approver_name, decision, comments, approved_version, issued_fatwa_number, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      uid(), q1, 'prof-admin', 'مفتی وارث نصیب', 'issued', 'دارالافتاء نافع کی جانب سے فتویٰ نمبر NA-FATWA-2026-0001 کے تحت جاری کیا جاتا ہے۔', 2, 'NA-FATWA-2026-0001', yesterday
    );

    // Public Publication for q1 (explicitly anonymized!)
    db.prepare('INSERT INTO fatwa_publications (id, question_id, is_published, public_title_ur, public_title_en, public_question_text, public_answer_text, approved_by, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      uid(), q1, 1,
      'آن لائن تجارت کے مال اور قابلِ وصول رقوم پر زکوٰۃ کا حکم',
      'Zakat on E-Commerce Inventory and Receivables',
      'آن لائن تجارت میں گودام کے مال اور پلیٹ فارم پر موجود قابلِ وصول رقوم پر زکوٰۃ کا حساب کیسے کیا جائے گا؟',
      d1Ur,
      'prof-admin', yesterday
    );
  });

  tx();
}

export function nextTrackingNumber(): string {
  const yr = new Date().getFullYear();
  const rows = db.prepare('SELECT tracking_number FROM public_tracking_tokens').all() as { tracking_number: string }[];
  let maxNum = 0;
  for (const r of rows) {
    const m = /^TRK-\d{4}-(\d+)$/.exec(r.tracking_number);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `TRK-${yr}-${String(maxNum + 1).padStart(4, '0')}`;
}

function seedPublicPortalData() {
  const today = new Date().toISOString().slice(0, 10);
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

  const tx = db.transaction(() => {
    const announcements = [
      {
        id: 'ann-1',
        date: today,
        title_ur: 'آن لائن استفتاء اور محفوظ ٹریکنگ سروس فعال ہے',
        title_en: 'Online Question Submission & Tracking Active',
        body_ur: 'عوام الناس بغیر لاگ ان اپنا شرعی سوال ارسال کر سکتے ہیں اور ٹریکنگ نمبر کے ذریعے جواب کی پیش رفت دیکھ سکتے ہیں۔',
        body_en: 'Submit your Shariah inquiry without an account and track progress securely via tracking number and mobile/verification code.',
      },
      {
        id: 'ann-2',
        date: twoDaysAgo,
        title_ur: 'اسلامی بینکاری اور ڈیجیٹل تجارت کے جدید فتاویٰ',
        title_en: 'New Fatawa on Islamic Finance & E-Commerce',
        body_ur: 'زکوٰۃ بر مالِ تجارت، ڈیجیٹل ادائیگیوں اور نمازِ جمعہ و سفر کے مصدقہ فتاویٰ پبلک لائبریری میں شامل ہیں۔',
        body_en: 'Verified rulings on e-commerce Zakat, digital transactions, and contemporary Fiqh are published in the public library.',
      },
    ];

    db.prepare(`
      INSERT INTO portal_settings (
        id, institution_name_en, institution_name_ur, nazim_name_en, nazim_name_ur,
        welcome_title_en, welcome_title_ur, welcome_body_en, welcome_body_ur,
        announcements, contact_phone, contact_whatsapp, contact_email, contact_address_en, contact_address_ur, allow_optional_email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      'portal-default',
      'Naafay Dar-ul-Ifta',
      'نافع دارالافتاء',
      'Mufti Waris Naseeb',
      'مفتی وارث نصیب',
      'Authentic Islamic Guidance & Published Fatawa',
      'نافع دارالافتاء — مستند شرعی رہنمائی و آن لائن فتاویٰ پورٹل',
      'Ask your Islamic jurisprudence questions directly to our Muftis, track your inquiry privately, and search verified published Fatawa.',
      'اپنے شرعی، عائلی، تجارتی اور معاصر مسائل مستند مفتیانِ کرام سے دریافت کریں، سوال کی کیفیت ٹریک کریں اور شائع شدہ فتاویٰ تلاش کریں۔',
      JSON.stringify(announcements),
      '+92-21-34589012',
      '+92-300-2145890',
      'ifta@naafay.edu.pk',
      'Naafay Dar-ul-Ifta & Takhassus fil Fiqh, Markazi Campus, Gulberg, Lahore',
      'نافع دارالافتاء و تخصص فی الفقہ، مرکزی کیمپس، گلبرگ، لاہور'
    );

    // Ensure fq-1 has a tracking token (TRK-2026-0001) so tracking works immediately for demo/testing
    const q1 = db.prepare("SELECT id, questioner_phone FROM fatwa_questions WHERE id = 'fq-1'").get() as
      | { id: string; questioner_phone: string | null }
      | undefined;
    if (q1) {
      const tokExists = db.prepare('SELECT 1 FROM public_tracking_tokens WHERE question_id = ?').get(q1.id);
      if (!tokExists) {
        const mobDigits = normalizePhoneDigits(q1.questioner_phone || '+92-300-5128834');
        db.prepare(`
          INSERT INTO public_tracking_tokens (id, question_id, tracking_number, verification_code_hash, mobile_hash, mobile_last4)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(uid(), q1.id, 'TRK-2026-0001', sha256('NF2026'), sha256(mobDigits), mobDigits.slice(-4));
      }
    }

    // Seed a second published Fatwa in Salah category if NA-FATWA-2026-0002 doesn't exist yet
    const hasSecondPub = db.prepare("SELECT 1 FROM fatwa_questions WHERE id = 'fq-6'").get();
    if (!hasSecondPub) {
      const q6 = 'fq-6';
      const issued2 = nextIssuedFatwaNumber();
      const code2 = nextFatwaCode();
      const d6Ur = `بسم اللہ الرحمٰن الرحیم\n\nالجواب وباللہ التوفیق:\nشرعی مسافر (جو اڑتالیس میل یعنی تقریباً ۷۸ کلومیٹر یا اس سے زائد سفر کی نیت سے اپنی بستی کی آبادی سے باہر نکل جائے) پر چار رکعت والی فرض نمازوں (ظہر، عصر، عشاء) میں قصر کرنا یعنی دو رکعت پڑھنا واجب ہے۔ تاہم اگر مسافر مقیم امام کی اقتدا کرے تو وہ امام کے ساتھ چار رکعت پوری پڑھے گا۔\n\nواللہ تعالیٰ اعلم بالصواب`;

      db.prepare(`
        INSERT INTO fatwa_questions (
          id, fatwa_code, issued_fatwa_number, question_date, questioner_name, questioner_phone,
          city, country, category_id, subject_title, subject_title_ur, question_text,
          is_identity_private, allow_public_identity, source, workflow_status, publication_status, registered_by, issued_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 'public_portal', 'issued', 'published', 'prof-staff', ?)
      `).run(
        q6, code2, issued2, twoDaysAgo, 'Abdul Qadir Khan', '+92-321-7700112',
        'Karachi', 'Pakistan', 'cat-salah',
        'Distance Threshold & Rules for Qasr Prayer During Travel',
        'سفر میں نمازِ قصر کی مسافت اور مقیم امام کی اقتدا کا حکم',
        'کتنے کلومیٹر کے سفر پر نماز قصر واجب ہوتی ہے اور اگر مسافر مقیم امام کے پیچھے نماز پڑھے تو کتنی رکعت پڑھے گا؟',
        today
      );

      db.prepare(`
        INSERT INTO fatwa_references (id, question_id, book_name, author, volume, page_number, chapter, arabic_quotation, explanation, is_reusable, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(
        uid(), q6,
        'رد المحتار (فتاویٰ شامی)', 'علامہ ابن عابدین شامی رحمہ اللہ', 'ج ۲', 'ص ۱۲۱', 'باب صلاۃ المسافر',
        'من خرج من عمارۃ موضع إقامتہ قاصداً مسیرۃ ثلاثۃ أیام ولیالیہا صلی الفرض الرباعی رکعتین، وإن اقتدی بالمقیم أتم أربعاً۔',
        'تین دن کی مسافت (موجودہ پیمائش کے مطابق تقریباً ۷۷.۲۵ کلومیٹر) پر نکلنے والا مسافر قصر کرے گا اور مقیم امام کی اقتدا میں اتمام کرے گا۔',
        'prof-teacher-1'
      );

      db.prepare('INSERT INTO fatwa_drafts (id, question_id, draft_title, draft_body_ur, draft_body_ar, current_version, last_edited_by) VALUES (?, ?, ?, ?, ?, 1, ?)').run(
        uid(), q6, 'سفر میں نمازِ قصر کا شرعی حکم', d6Ur, 'واللہ اعلم بالصواب', 'prof-teacher-1'
      );

      db.prepare('INSERT INTO fatwa_reviews (id, question_id, version_number, reviewer_profile_id, reviewer_name, decision, comments, reviewed_at) VALUES (?, ?, 1, ?, ?, ?, ?, ?)').run(
        uid(), q6, 'prof-teacher-2', 'مفتی خالد سیف اللہ (مفتیِ اعظم)', 'approved_for_final', 'حوالہ جات درست ہیں، حتمی منظوری و اشاعت کے لیے پیش ہے۔', twoDaysAgo
      );

      db.prepare('INSERT INTO fatwa_approvals (id, question_id, approver_profile_id, approver_name, decision, comments, approved_version, issued_fatwa_number, approved_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)').run(
        uid(), q6, 'prof-admin', 'مفتی وارث نصیب', 'issued', 'منظور و جاری شدہ برائے عوامی رہنمائی۔', issued2, today
      );

      db.prepare('INSERT INTO fatwa_publications (id, question_id, is_published, public_title_ur, public_title_en, public_question_text, public_answer_text, approved_by, published_at) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)').run(
        uid(), q6,
        'سفر میں نمازِ قصر کی شرعی مسافت اور مقیم امام کے پیچھے نماز کا حکم',
        'Distance Threshold and Imamate Rules for Qasr Prayer',
        'کتنے کلومیٹر کے سفر پر نماز قصر واجب ہوتی ہے اور اگر مسافر مقیم امام کے پیچھے نماز پڑھے تو کتنی رکعت پڑھے گا؟',
        d6Ur,
        'prof-admin', today
      );
    }
  });

  tx();
}

