import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import crypto from 'crypto';
import {
  db,
  initDatabase,
  uid,
  sha256,
  normalizePhoneDigits,
  nextStudentCode,
  nextTeacherCode,
  nextFatwaCode,
  nextIssuedFatwaNumber,
  nextTrackingNumber,
  computeGrade,
} from './src/server/db.ts';

dotenv.config();

initDatabase();

const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

type AppRole = 'admin' | 'senior_mufti' | 'mufti' | 'office_staff' | 'teacher' | 'student';

interface SessionRequest extends Request {
  actor?: {
    profileId: string;
    role: AppRole;
    name: string;
    teacherId?: string;
    studentId?: string;
  };
}

function getActor(req: Request) {
  const roleHeader = (req.headers['x-user-role'] as string) || 'admin';
  const profileIdHeader = (req.headers['x-user-id'] as string) || 'prof-admin';
  const validRoles: AppRole[] = ['admin', 'senior_mufti', 'mufti', 'office_staff', 'teacher', 'student'];
  const role: AppRole = validRoles.includes(roleHeader as AppRole) ? (roleHeader as AppRole) : 'admin';

  const prof = db.prepare('SELECT id, full_name, full_name_ur FROM profiles WHERE id = ?').get(profileIdHeader) as
    | { id: string; full_name: string; full_name_ur: string | null }
    | undefined;

  const teacherRow = db.prepare('SELECT id FROM teachers WHERE profile_id = ?').get(profileIdHeader) as { id: string } | undefined;
  const studentRow = db.prepare('SELECT id FROM students WHERE profile_id = ?').get(profileIdHeader) as { id: string } | undefined;

  return {
    profileId: prof?.id || profileIdHeader,
    role,
    name: prof?.full_name_ur || prof?.full_name || 'System User',
    teacherId: teacherRow?.id || (role === 'teacher' || role === 'mufti' ? 'tch-1' : role === 'senior_mufti' ? 'tch-2' : undefined),
    studentId: studentRow?.id || (role === 'student' ? 'stu-1' : undefined),
  };
}

function attachActor(req: SessionRequest, _res: Response, next: NextFunction) {
  req.actor = getActor(req);
  next();
}

function requireRole(...allowed: AppRole[]) {
  return (req: SessionRequest, res: Response, next: NextFunction) => {
    const role = req.actor?.role || 'student';
    const effectiveMatch =
      allowed.includes(role) ||
      (allowed.includes('teacher') && (role === 'mufti' || role === 'senior_mufti'));
    if (!effectiveMatch) {
      return res.status(403).json({
        error: 'Access denied for current role',
        error_ur: 'موجودہ عہدے کو اس عمل کی اجازت نہیں ہے',
      });
    }
    next();
  };
}

function logAudit(req: SessionRequest, action: string, entityType: string, entityId: string, details: Record<string, unknown>) {
  db.prepare(
    'INSERT INTO audit_logs (id, actor_profile_id, actor_name, actor_role, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(uid(), req.actor?.profileId || null, req.actor?.name || 'System', req.actor?.role || 'system', action, entityType, entityId, JSON.stringify(details));
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use(attachActor);

  // Serve uploaded files safely
  app.get('/api/uploads/:filename', (req, res) => {
    const safeName = path.basename(req.params.filename);
    const fullPath = path.join(uploadsDir, safeName);
    if (fs.existsSync(fullPath)) {
      return res.sendFile(fullPath);
    }
    // Sample placeholder file for seeded demo documents
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(`Naafay Dar-ul-Ifta Academic Document: ${safeName}\nArchived in Academic Document Repository.`);
  });

  app.post('/api/uploads', (req: SessionRequest, res) => {
    try {
      const { fileName, dataUrl } = req.body as { fileName?: string; dataUrl?: string };
      if (!fileName || !dataUrl) {
        return res.status(400).json({ error: 'fileName and dataUrl are required' });
      }
      const ext = path.extname(fileName) || '.bin';
      const base = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
      const storedName = `${Date.now()}_${base}${ext}`;
      const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
      const buffer = match ? Buffer.from(match[2], 'base64') : Buffer.from(dataUrl, 'utf-8');
      fs.writeFileSync(path.join(uploadsDir, storedName), buffer);
      res.json({
        fileName,
        storedName,
        fileUrl: `/api/uploads/${storedName}`,
        size: buffer.length,
        mimeType: match ? match[1] : 'application/octet-stream',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      mode: process.env.VITE_SUPABASE_URL ? 'supabase_configured' : 'local_sqlite',
    });
  });

  // Lookups
  app.get('/api/lookups', (_req, res) => {
    const academicYears = db.prepare('SELECT * FROM academic_years ORDER BY is_current DESC, code DESC').all();
    const classes = db.prepare('SELECT * FROM classes ORDER BY level_order ASC').all();
    const batches = db.prepare('SELECT * FROM batches ORDER BY name_en ASC').all();
    const subjects = db.prepare('SELECT * FROM subjects ORDER BY code ASC').all();
    const books = db.prepare(`
      SELECT b.*, s.name_en as subject_name_en, s.name_ur as subject_name_ur
      FROM books b JOIN subjects s ON s.id = b.subject_id
      ORDER BY b.title_en ASC
    `).all();
    const sessions = db.prepare('SELECT * FROM attendance_sessions ORDER BY sort_order ASC').all();
    const roles = db.prepare('SELECT * FROM roles').all();
    const teachers = db.prepare('SELECT id, teacher_code, full_name, full_name_ur, specialization, status FROM teachers ORDER BY teacher_code ASC').all();

    res.json({ academicYears, classes, batches, subjects, books, sessions, roles, teachers });
  });

  // Create new Class, Academic Year, and Batch / Group
  app.post('/api/classes', requireRole('admin', 'office_staff'), (req: SessionRequest, res) => {
    try {
      const b = req.body;
      const name_ur = (b.name_ur || b.name || '').trim();
      if (!name_ur) return res.status(400).json({ error: 'Class name is required' });
      const id = `cls-${Date.now().toString(36)}`;
      const count = (db.prepare('SELECT COUNT(*) as c FROM classes').get() as { c: number }).c;
      const code = b.code || `CLS-${count + 1}`;
      const name_en = b.name_en || name_ur;
      db.prepare(`
        INSERT INTO classes (id, code, name_en, name_ur, level_order, description, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(id, code, name_en, name_ur, count + 1, b.description || null);
      logAudit(req, 'CLASS_CREATED', 'class', id, { code, name_ur });
      res.status(201).json(db.prepare('SELECT * FROM classes WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/academic-years', requireRole('admin', 'office_staff'), (req: SessionRequest, res) => {
    try {
      const b = req.body;
      const title_ur = (b.title_ur || b.title || '').trim();
      if (!title_ur) return res.status(400).json({ error: 'Academic year title is required' });
      const id = `ay-${Date.now().toString(36)}`;
      const count = (db.prepare('SELECT COUNT(*) as c FROM academic_years').get() as { c: number }).c;
      const code = b.code || `AY-${count + 1}`;
      const title_en = b.title_en || title_ur;
      const startDate = b.start_date || new Date().toISOString().slice(0, 10);
      const endDate = b.end_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      db.prepare(`
        INSERT INTO academic_years (id, code, title_en, title_ur, hijri_year, start_date, end_date, is_current)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `).run(id, code, title_en, title_ur, b.hijri_year || null, startDate, endDate);
      logAudit(req, 'ACADEMIC_YEAR_CREATED', 'academic_year', id, { code, title_ur });
      res.status(201).json(db.prepare('SELECT * FROM academic_years WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/batches', requireRole('admin', 'office_staff'), (req: SessionRequest, res) => {
    try {
      const b = req.body;
      const name_ur = (b.name_ur || b.name || '').trim();
      if (!name_ur) return res.status(400).json({ error: 'Batch name is required' });
      const id = `bat-${Date.now().toString(36)}`;
      const name_en = b.name_en || name_ur;
      const class_id = b.class_id || (db.prepare('SELECT id FROM classes LIMIT 1').get() as { id: string })?.id;
      const academic_year_id = b.academic_year_id || (db.prepare('SELECT id FROM academic_years LIMIT 1').get() as { id: string })?.id;
      db.prepare(`
        INSERT INTO batches (id, class_id, academic_year_id, name_en, name_ur, capacity, is_active)
        VALUES (?, ?, ?, ?, ?, 30, 1)
      `).run(id, class_id, academic_year_id, name_en, name_ur);
      logAudit(req, 'BATCH_CREATED', 'batch', id, { name_ur, class_id });
      res.status(201).json(db.prepare('SELECT * FROM batches WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Dashboard & Global Search
  app.get('/api/dashboard', (req: SessionRequest, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const totalStudents = (db.prepare('SELECT COUNT(*) as c FROM students').get() as { c: number }).c;
    const activeStudents = (db.prepare("SELECT COUNT(*) as c FROM students WHERE status = 'active'").get() as { c: number }).c;
    const totalTeachers = (db.prepare("SELECT COUNT(*) as c FROM teachers WHERE status = 'active'").get() as { c: number }).c;

    const todayAttendance = db.prepare(`
      SELECT
        COUNT(*) as total_marked,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leave_count
      FROM attendance_records
      WHERE attendance_date = ?
    `).get(today) as Record<string, number>;

    const sessionBreakdown = db.prepare(`
      SELECT
        s.id, s.code, s.name_en, s.name_ur, s.start_time, s.end_time,
        COUNT(ar.id) as total_marked,
        SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN ar.status = 'leave' THEN 1 ELSE 0 END) as leave_count
      FROM attendance_sessions s
      LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.attendance_date = ?
      GROUP BY s.id
      ORDER BY s.sort_order ASC
    `).all(today);

    const pendingStudy = (db.prepare("SELECT COUNT(*) as c FROM study_logs WHERE status = 'pending'").get() as { c: number }).c;
    const pendingResearchReviews = (db.prepare("SELECT COUNT(*) as c FROM research_assignments WHERE status IN ('submitted', 'resubmitted')").get() as { c: number }).c;

    const recentLessons = db.prepare(`
      SELECT lr.*, t.full_name as teacher_name, t.full_name_ur as teacher_name_ur,
             c.name_en as class_name_en, c.name_ur as class_name_ur,
             s.name_en as subject_name_en, s.name_ur as subject_name_ur,
             b.title_en as book_title_en, b.title_ur as book_title_ur
      FROM lesson_records lr
      JOIN teachers t ON t.id = lr.teacher_id
      JOIN classes c ON c.id = lr.class_id
      JOIN subjects s ON s.id = lr.subject_id
      JOIN books b ON b.id = lr.book_id
      ORDER BY lr.lesson_date DESC, lr.created_at DESC
      LIMIT 5
    `).all();

    const upcomingExams = db.prepare(`
      SELECT e.*, c.name_en as class_name_en, c.name_ur as class_name_ur
      FROM exams e
      JOIN classes c ON c.id = e.class_id
      WHERE e.status IN ('scheduled', 'ongoing')
      ORDER BY e.start_date ASC
      LIMIT 5
    `).all();

    const recentActivities = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 8').all();

    const absentTodayList = db.prepare(`
      SELECT ar.id, ar.status, ar.attendance_date, st.id as student_id, st.student_code, st.full_name, st.full_name_ur,
             c.name_en as class_name_en, c.name_ur as class_name_ur,
             ses.name_en as session_name_en, ses.name_ur as session_name_ur
      FROM attendance_records ar
      JOIN students st ON st.id = ar.student_id
      JOIN classes c ON c.id = ar.class_id
      JOIN attendance_sessions ses ON ses.id = ar.session_id
      WHERE ar.attendance_date = ? AND ar.status = 'absent'
      ORDER BY ses.sort_order ASC
    `).all(today);

    const role = req.actor?.role || 'admin';
    const studentSelf = role === 'student' && req.actor?.studentId
      ? db.prepare('SELECT * FROM students WHERE id = ?').get(req.actor.studentId)
      : null;

    res.json({
      today,
      metrics: {
        totalStudents,
        activeStudents,
        totalTeachers,
        todayPresent: todayAttendance?.present_count || 0,
        todayMarked: todayAttendance?.total_marked || 0,
        todayAbsent: todayAttendance?.absent_count || 0,
        pendingStudySubmissions: pendingStudy,
        pendingTeacherReviews: pendingStudy + pendingResearchReviews,
      },
      sessionBreakdown,
      recentLessons,
      upcomingExams,
      recentActivities,
      absentTodayList,
      studentSelf,
    });
  });

  app.get('/api/search', (req, res) => {
    const q = ((req.query.q as string) || '').trim();
    if (!q) return res.json({ students: [], teachers: [], books: [], research: [] });
    const like = `%${q}%`;
    const cleanQ = q.replace(/[-\s+]/g, '');
    const cleanLike = `%${cleanQ}%`;
    const students = db.prepare(
      `SELECT id, student_code, full_name, full_name_ur, phone, status 
       FROM students 
       WHERE full_name LIKE ? OR full_name_ur LIKE ? OR student_code LIKE ? OR phone LIKE ? 
          OR REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '+92', '0') LIKE ? 
       LIMIT 6`
    ).all(like, like, like, like, cleanLike);
    const teachers = db.prepare(
      `SELECT id, teacher_code, full_name, full_name_ur, phone, specialization 
       FROM teachers 
       WHERE full_name LIKE ? OR full_name_ur LIKE ? OR teacher_code LIKE ? OR phone LIKE ? 
          OR REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '+92', '0') LIKE ? 
       LIMIT 5`
    ).all(like, like, like, like, cleanLike);
    const books = db.prepare(
      'SELECT id, title_en, title_ur, author FROM books WHERE title_en LIKE ? OR title_ur LIKE ? OR author LIKE ? LIMIT 5'
    ).all(like, like, like);
    const research = db.prepare(
      'SELECT rt.id, rt.title_en, rt.title_ur, ra.id as assignment_id FROM research_topics rt LEFT JOIN research_assignments ra ON ra.topic_id = rt.id WHERE rt.title_en LIKE ? OR rt.title_ur LIKE ? LIMIT 5'
    ).all(like, like);
    res.json({ students, teachers, books, research });
  });

  // =========================================================================
  // STUDENTS & 10-TAB COMPLETE PROFILE
  // =========================================================================
  app.get('/api/students', (req: SessionRequest, res) => {
    const search = ((req.query.search as string) || '').trim();
    const classId = (req.query.classId as string) || '';
    const batchId = (req.query.batchId as string) || '';
    const status = (req.query.status as string) || '';

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (req.actor?.role === 'student' && req.actor.studentId) {
      where += ' AND st.id = ?';
      params.push(req.actor.studentId);
    }

    if (search) {
      const cleanSearch = search.replace(/[-\s+]/g, '');
      const searchDigits = search.replace(/\D/g, '');
      where += ` AND (
        st.full_name LIKE ? OR
        st.full_name_ur LIKE ? OR
        st.student_code LIKE ? OR
        st.father_name LIKE ? OR
        st.father_name_ur LIKE ? OR
        st.phone LIKE ? OR
        REPLACE(REPLACE(REPLACE(st.phone, '-', ''), ' ', ''), '+92', '0') LIKE ? OR
        REPLACE(REPLACE(REPLACE(g.phone, '-', ''), ' ', ''), '+92', '0') LIKE ?
      )`;
      const like = `%${search}%`;
      const cleanLike = `%${cleanSearch}%`;
      const digitLike = searchDigits ? `%${searchDigits}%` : cleanLike;
      params.push(like, like, like, like, like, like, digitLike, digitLike);
    }
    if (classId) {
      where += ' AND st.class_id = ?';
      params.push(classId);
    }
    if (batchId) {
      where += ' AND st.batch_id = ?';
      params.push(batchId);
    }
    if (status) {
      where += ' AND st.status = ?';
      params.push(status);
    }

    const students = db.prepare(`
      SELECT st.*,
        c.name_en as class_name_en, c.name_ur as class_name_ur,
        b.name_en as batch_name_en, b.name_ur as batch_name_ur,
        ay.title_en as year_title_en, ay.title_ur as year_title_ur,
        g.full_name as guardian_name, g.full_name_ur as guardian_name_ur, g.phone as guardian_phone, g.whatsapp as guardian_whatsapp,
        (SELECT COUNT(*) FROM attendance_records ar WHERE ar.student_id = st.id) as att_total,
        (SELECT COUNT(*) FROM attendance_records ar WHERE ar.student_id = st.id AND ar.status IN ('present', 'late')) as att_present
      FROM students st
      LEFT JOIN classes c ON c.id = st.class_id
      LEFT JOIN batches b ON b.id = st.batch_id
      LEFT JOIN academic_years ay ON ay.id = st.academic_year_id
      LEFT JOIN student_guardians sg ON sg.student_id = st.id AND sg.is_primary = 1
      LEFT JOIN guardians g ON g.id = sg.guardian_id
      ${where}
      ORDER BY st.student_code ASC
    `).all(...params);

    res.json(students);
  });

  app.get('/api/students/:id', (req: SessionRequest, res) => {
    const { id } = req.params;
    if (req.actor?.role === 'student' && req.actor.studentId !== id) {
      return res.status(403).json({ error: 'Students may only view their own profile' });
    }

    const student = db.prepare(`
      SELECT st.*,
        c.name_en as class_name_en, c.name_ur as class_name_ur,
        b.name_en as batch_name_en, b.name_ur as batch_name_ur,
        ay.title_en as year_title_en, ay.title_ur as year_title_ur, ay.hijri_year
      FROM students st
      LEFT JOIN classes c ON c.id = st.class_id
      LEFT JOIN batches b ON b.id = st.batch_id
      LEFT JOIN academic_years ay ON ay.id = st.academic_year_id
      WHERE st.id = ?
    `).get(id) as any;

    if (!student) return res.status(404).json({ error: 'Student not found' });

    const guardians = db.prepare(`
      SELECT g.*, sg.relationship, sg.is_primary
      FROM guardians g
      JOIN student_guardians sg ON sg.guardian_id = g.id
      WHERE sg.student_id = ?
    `).all(id);

    const attendance = db.prepare(`
      SELECT ar.*, ses.code as session_code, ses.name_en as session_name_en, ses.name_ur as session_name_ur, ses.sort_order
      FROM attendance_records ar
      JOIN attendance_sessions ses ON ses.id = ar.session_id
      WHERE ar.student_id = ?
      ORDER BY ar.attendance_date DESC, ses.sort_order ASC
    `).all(id) as any[];

    const mutala = db.prepare(`
      SELECT sl.*, b.title_en as book_title_en, b.title_ur as book_title_ur,
             s.name_en as subject_name_en, s.name_ur as subject_name_ur,
             sr.decision, sr.comments as review_comments, sr.reviewer_name, sr.reviewed_at
      FROM study_logs sl
      JOIN books b ON b.id = sl.book_id
      JOIN subjects s ON s.id = b.subject_id
      LEFT JOIN study_reviews sr ON sr.study_log_id = sl.id
      WHERE sl.student_id = ?
      ORDER BY sl.study_date DESC, sl.created_at DESC
    `).all(id);

    const lessons = db.prepare(`
      SELECT lr.*, t.full_name as teacher_name, t.full_name_ur as teacher_name_ur,
             s.name_en as subject_name_en, s.name_ur as subject_name_ur,
             b.title_en as book_title_en, b.title_ur as book_title_ur
      FROM lesson_records lr
      JOIN teachers t ON t.id = lr.teacher_id
      JOIN subjects s ON s.id = lr.subject_id
      JOIN books b ON b.id = lr.book_id
      WHERE lr.class_id = ?
      ORDER BY lr.lesson_date DESC
      LIMIT 30
    `).all(student.class_id || '');

    const exams = db.prepare(`
      SELECT e.*, c.name_en as class_name_en, c.name_ur as class_name_ur
      FROM exams e
      JOIN classes c ON c.id = e.class_id
      WHERE e.class_id = ?
      ORDER BY e.start_date DESC
    `).all(student.class_id || '');

    const results = db.prepare(`
      SELECT er.*, e.title_en as exam_title_en, e.title_ur as exam_title_ur, e.exam_type, e.start_date,
             es.written_max_marks, es.oral_max_marks, es.passing_marks,
             s.name_en as subject_name_en, s.name_ur as subject_name_ur,
             b.title_en as book_title_en, b.title_ur as book_title_ur
      FROM exam_results er
      JOIN exams e ON e.id = er.exam_id
      JOIN exam_subjects es ON es.id = er.exam_subject_id
      JOIN subjects s ON s.id = es.subject_id
      LEFT JOIN books b ON b.id = es.book_id
      WHERE er.student_id = ?
      ORDER BY e.start_date DESC, s.code ASC
    `).all(id);

    const research = db.prepare(`
      SELECT ra.*, rt.title_en, rt.title_ur, rt.field_of_fiqh,
             t.full_name as supervisor_name, t.full_name_ur as supervisor_name_ur
      FROM research_assignments ra
      JOIN research_topics rt ON rt.id = ra.topic_id
      JOIN teachers t ON t.id = ra.supervisor_teacher_id
      WHERE ra.student_id = ?
      ORDER BY ra.assigned_at DESC
    `).all(id) as any[];

    for (const r of research) {
      r.submissions = db.prepare('SELECT * FROM research_submissions WHERE assignment_id = ? ORDER BY version_number DESC').all(r.id);
      r.reviews = db.prepare('SELECT * FROM research_reviews WHERE assignment_id = ? ORDER BY reviewed_at DESC').all(r.id);
    }

    const documents = db.prepare("SELECT * FROM documents WHERE entity_type = 'student' AND entity_id = ? ORDER BY created_at DESC").all(id);

    // Monthly attendance & study summary
    const monthlyMap: Record<string, { month: string; attTotal: number; attPresent: number; attAbsent: number; mutalaCount: number; mutalaApproved: number }> = {};
    for (const a of attendance) {
      const m = (a.attendance_date || '').slice(0, 7);
      if (!m) continue;
      if (!monthlyMap[m]) monthlyMap[m] = { month: m, attTotal: 0, attPresent: 0, attAbsent: 0, mutalaCount: 0, mutalaApproved: 0 };
      monthlyMap[m].attTotal++;
      if (a.status === 'present' || a.status === 'late') monthlyMap[m].attPresent++;
      if (a.status === 'absent') monthlyMap[m].attAbsent++;
    }
    for (const mLog of mutala as any[]) {
      const m = (mLog.study_date || '').slice(0, 7);
      if (!m) continue;
      if (!monthlyMap[m]) monthlyMap[m] = { month: m, attTotal: 0, attPresent: 0, attAbsent: 0, mutalaCount: 0, mutalaApproved: 0 };
      monthlyMap[m].mutalaCount++;
      if (mLog.status === 'approved') monthlyMap[m].mutalaApproved++;
    }

    const activityHistory = db.prepare(
      'SELECT * FROM audit_logs WHERE entity_id = ? OR details LIKE ? ORDER BY created_at DESC LIMIT 25'
    ).all(id, `%${student.student_code}%`);

    // Attach enrolled subjects and assigned teachers for student's class
    const enrolledSubjects = db.prepare(`
      SELECT s.id as subject_id, s.code as subject_code, s.name_en as subject_name_en, s.name_ur as subject_name_ur,
             b.id as book_id, b.title_en as book_title_en, b.title_ur as book_title_ur, b.author, b.total_pages,
             t.id as teacher_id, t.full_name as teacher_name, t.full_name_ur as teacher_name_ur,
             ta.start_time, ta.end_time, ta.days_of_week, ta.room_name
      FROM subjects s
      LEFT JOIN books b ON b.subject_id = s.id
      LEFT JOIN teacher_assignments ta ON ta.subject_id = s.id AND (ta.class_id = ? OR ta.class_id IS NULL)
      LEFT JOIN teachers t ON t.id = ta.teacher_id
      WHERE s.class_id = ? OR s.class_id IS NULL
      ORDER BY s.code ASC
    `).all(student.class_id || '', student.class_id || '');

    res.json({
      student,
      guardians,
      attendance,
      mutala,
      lessons,
      exams,
      results,
      research,
      documents,
      monthlyReports: Object.values(monthlyMap).sort((a, b) => b.month.localeCompare(a.month)),
      activityHistory,
      enrolledSubjects,
    });
  });

  app.post('/api/students', requireRole('admin', 'office_staff'), (req: SessionRequest, res) => {
    try {
      const b = req.body;
      const fullName = (b.full_name_ur || b.full_name || '').trim();
      if (!fullName) {
        return res.status(400).json({ error: 'طالب علم کا نام درج کرنا لازمی ہے', error_ur: 'طالب علم کا نام درج کرنا لازمی ہے' });
      }
      const fatherName = (b.father_name_ur || b.father_name || '').trim() || '—';
      const phone = (b.phone || '').trim() || '—';
      const studentId = uid();
      const studentCode = nextStudentCode();
      const tx = db.transaction(() => {
        db.prepare(`
          INSERT INTO students (
            id, student_code, full_name, full_name_ur, father_name, father_name_ur,
            date_of_birth, phone, email, address, address_ur, previous_education, previous_education_ur,
            admission_date, academic_year_id, class_id, batch_id, status, photo_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          studentId,
          studentCode,
          b.full_name || fullName,
          b.full_name_ur || fullName,
          b.father_name || fatherName,
          b.father_name_ur || fatherName,
          b.date_of_birth || null,
          phone,
          b.email || null,
          b.address || null,
          b.address_ur || b.address || null,
          b.previous_education || null,
          b.previous_education_ur || b.previous_education || null,
          b.admission_date || new Date().toISOString().slice(0, 10),
          b.academic_year_id || 'ay-1447',
          b.class_id || 'cls-tak1',
          b.batch_id || null,
          b.status || 'active',
          b.photo_url || null
        );

        if (b.guardian_name || b.guardian_phone || fatherName !== '—') {
          const gId = uid();
          db.prepare('INSERT INTO guardians (id, full_name, full_name_ur, phone, whatsapp, occupation, address) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            gId,
            b.guardian_name || b.father_name || fatherName,
            b.guardian_name_ur || b.father_name_ur || b.guardian_name || b.father_name || fatherName,
            b.guardian_phone || phone,
            b.guardian_whatsapp || b.guardian_phone || phone,
            b.guardian_occupation || null,
            b.address || null
          );
          db.prepare('INSERT INTO student_guardians (id, student_id, guardian_id, relationship, is_primary) VALUES (?, ?, ?, ?, 1)').run(
            uid(),
            studentId,
            gId,
            b.guardian_relationship || 'father'
          );
        }

        if (b.academic_year_id && b.class_id) {
          db.prepare('INSERT INTO enrollments (id, student_id, academic_year_id, class_id, batch_id, roll_number, status, enrolled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
            uid(),
            studentId,
            b.academic_year_id,
            b.class_id,
            b.batch_id || null,
            studentCode,
            'enrolled',
            b.admission_date || new Date().toISOString().slice(0, 10)
          );
        }

        logAudit(req, 'STUDENT_CREATED', 'student', studentId, { studentCode, name: b.full_name_ur || b.full_name });
      });
      tx();

      const created = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/students/:id', requireRole('admin', 'office_staff'), (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      const b = req.body;
      const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(id) as any;
      if (!existing) return res.status(404).json({ error: 'Student not found' });

      const tx = db.transaction(() => {
        db.prepare(`
          UPDATE students SET
            full_name = ?, full_name_ur = ?, father_name = ?, father_name_ur = ?,
            date_of_birth = ?, phone = ?, email = ?, address = ?, address_ur = ?,
            previous_education = ?, previous_education_ur = ?, admission_date = ?,
            academic_year_id = ?, class_id = ?, batch_id = ?, status = ?, photo_url = ?,
            updated_at = datetime('now')
          WHERE id = ?
        `).run(
          b.full_name ?? existing.full_name,
          b.full_name_ur ?? existing.full_name_ur,
          b.father_name ?? existing.father_name,
          b.father_name_ur ?? existing.father_name_ur,
          b.date_of_birth ?? existing.date_of_birth,
          b.phone ?? existing.phone,
          b.email ?? existing.email,
          b.address ?? existing.address,
          b.address_ur ?? existing.address_ur,
          b.previous_education ?? existing.previous_education,
          b.previous_education_ur ?? existing.previous_education_ur,
          b.admission_date ?? existing.admission_date,
          b.academic_year_id ?? existing.academic_year_id,
          b.class_id ?? existing.class_id,
          b.batch_id ?? existing.batch_id,
          b.status ?? existing.status,
          b.photo_url !== undefined ? b.photo_url : existing.photo_url,
          id
        );

        if (b.guardian_name || b.guardian_phone) {
          const sg = db.prepare('SELECT guardian_id FROM student_guardians WHERE student_id = ? AND is_primary = 1').get(id) as { guardian_id: string } | undefined;
          if (sg) {
            db.prepare('UPDATE guardians SET full_name = ?, full_name_ur = ?, phone = ?, whatsapp = ? WHERE id = ?').run(
              b.guardian_name || existing.father_name,
              b.guardian_name_ur || b.guardian_name || existing.father_name_ur,
              b.guardian_phone || existing.phone,
              b.guardian_whatsapp || b.guardian_phone || existing.phone,
              sg.guardian_id
            );
          }
        }
        logAudit(req, 'STUDENT_UPDATED', 'student', id, { studentCode: existing.student_code });
      });
      tx();

      res.json(db.prepare('SELECT * FROM students WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/students/:id', requireRole('admin'), (req: SessionRequest, res) => {
    const { id } = req.params;
    const existing = db.prepare('SELECT student_code FROM students WHERE id = ?').get(id) as { student_code: string } | undefined;
    if (!existing) return res.status(404).json({ error: 'Student not found' });
    db.prepare('DELETE FROM students WHERE id = ?').run(id);
    logAudit(req, 'STUDENT_DELETED', 'student', id, { studentCode: existing.student_code });
    res.json({ deleted: true });
  });

  // =========================================================================
  // THREE-SESSION ATTENDANCE
  // =========================================================================
  app.get('/api/attendance', (req: SessionRequest, res) => {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const sessionId = (req.query.sessionId as string) || '';
    const classId = (req.query.classId as string) || '';
    const batchId = (req.query.batchId as string) || '';

    let stuWhere = "WHERE st.status != 'withdrawn'";
    const stuParams: any[] = [];
    if (classId) {
      stuWhere += ' AND st.class_id = ?';
      stuParams.push(classId);
    }
    if (batchId) {
      stuWhere += ' AND st.batch_id = ?';
      stuParams.push(batchId);
    }
    if (req.actor?.role === 'student' && req.actor.studentId) {
      stuWhere += ' AND st.id = ?';
      stuParams.push(req.actor.studentId);
    }

    const students = db.prepare(`
      SELECT st.id as student_id, st.student_code, st.full_name, st.full_name_ur, st.class_id, st.batch_id, st.status as student_status,
             c.name_en as class_name_en, c.name_ur as class_name_ur,
             b.name_en as batch_name_en, b.name_ur as batch_name_ur
      FROM students st
      LEFT JOIN classes c ON c.id = st.class_id
      LEFT JOIN batches b ON b.id = st.batch_id
      ${stuWhere}
      ORDER BY st.student_code ASC
    `).all(...stuParams) as any[];

    const existingRecords = sessionId
      ? (db.prepare('SELECT * FROM attendance_records WHERE attendance_date = ? AND session_id = ?').all(date, sessionId) as any[])
      : [];

    const allDayRecords = db.prepare('SELECT * FROM attendance_records WHERE attendance_date = ?').all(date) as any[];
    const allSessionsByStudent = new Map<string, Record<string, { id: string; status: string; remarks: string; late_minutes?: number }>>();
    for (const r of allDayRecords) {
      if (!allSessionsByStudent.has(r.student_id)) {
        allSessionsByStudent.set(r.student_id, {});
      }
      allSessionsByStudent.get(r.student_id)![r.session_id] = {
        id: r.id,
        status: r.status,
        remarks: r.remarks || '',
        late_minutes: r.late_minutes !== null && r.late_minutes !== undefined ? r.late_minutes : (r.status === 'late' ? 15 : 0),
      };
    }

    const recordByStudent = new Map<string, any>();
    for (const r of existingRecords) recordByStudent.set(r.student_id, r);

    const rows = students.map((st) => {
      const rec = recordByStudent.get(st.student_id);
      return {
        ...st,
        record_id: rec?.id || null,
        attendance_status: rec?.status || null,
        remarks: rec?.remarks || '',
        already_recorded: Boolean(rec),
        sessions: allSessionsByStudent.get(st.student_id) || {},
      };
    });

    res.json({ date, sessionId, rows });
  });

  app.post('/api/attendance/quick-mark', requireRole('admin', 'office_staff', 'teacher'), (req: SessionRequest, res) => {
    try {
      const { studentId, classId, batchId, sessionId, date, status, remarks, lateMinutes } = req.body as {
        studentId: string;
        classId?: string;
        batchId?: string;
        sessionId: string;
        date: string;
        status: string;
        remarks?: string;
        lateMinutes?: number;
      };

      if (!studentId || !sessionId || !date || !status) {
        return res.status(400).json({ error: 'studentId, sessionId, date, and status are required' });
      }

      if (!['present', 'absent', 'leave', 'late'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const existing = db.prepare(
        'SELECT id, status, remarks, late_minutes FROM attendance_records WHERE student_id = ? AND attendance_date = ? AND session_id = ?'
      ).get(studentId, date, sessionId) as { id: string; status: string; remarks?: string; late_minutes?: number } | undefined;

      const calcLateMin = lateMinutes !== undefined ? Number(lateMinutes) : (status === 'late' ? 15 : 0);

      let recordId = '';
      if (existing) {
        recordId = existing.id;
        db.prepare(
          'UPDATE attendance_records SET status = ?, remarks = COALESCE(?, remarks), late_minutes = ?, updated_at = datetime(\'now\') WHERE id = ?'
        ).run(status, remarks ?? null, calcLateMin, recordId);

        logAudit(req, 'ATTENDANCE_QUICK_UPDATED', 'attendance', recordId, {
          studentId,
          sessionId,
          date,
          from: existing.status,
          to: status,
          lateMinutes: calcLateMin
        });
      } else {
        recordId = uid();
        const cid = classId || 'cls-tak1';
        db.prepare(
          'INSERT INTO attendance_records (id, student_id, class_id, batch_id, session_id, attendance_date, status, remarks, marked_by, late_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(recordId, studentId, cid, batchId || null, sessionId, date, status, remarks || null, req.actor?.profileId || null, calcLateMin);

        logAudit(req, 'ATTENDANCE_QUICK_MARKED', 'attendance', recordId, {
          studentId,
          sessionId,
          date,
          status,
          lateMinutes: calcLateMin
        });
      }

      res.json({ success: true, recordId, studentId, sessionId, status, date, lateMinutes: calcLateMin });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/attendance/bulk', requireRole('admin', 'office_staff', 'teacher'), (req: SessionRequest, res) => {
    try {
      const { date, sessionId, entries } = req.body as {
        date: string;
        sessionId: string;
        entries: Array<{ studentId: string; classId: string; batchId?: string; status: string; remarks?: string }>;
      };

      if (!date || !sessionId || !Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: 'date, sessionId, and entries are required' });
      }

      const checkDup = db.prepare('SELECT id, status FROM attendance_records WHERE student_id = ? AND attendance_date = ? AND session_id = ?');
      const insertRec = db.prepare(
        'INSERT INTO attendance_records (id, student_id, class_id, batch_id, session_id, attendance_date, status, remarks, marked_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );

      let inserted = 0;
      let skippedDuplicates = 0;
      const insertedRecords: Array<{ studentId: string; id: string; status: string }> = [];

      const tx = db.transaction(() => {
        for (const item of entries) {
          if (!['present', 'absent', 'leave', 'late'].includes(item.status)) continue;
          const existing = checkDup.get(item.studentId, date, sessionId) as { id: string; status: string } | undefined;
          if (existing) {
            skippedDuplicates++;
            continue;
          }
          const newId = uid();
          insertRec.run(
            newId,
            item.studentId,
            item.classId,
            item.batchId || null,
            sessionId,
            date,
            item.status,
            item.remarks || null,
            req.actor?.profileId || null
          );
          insertedRecords.push({ studentId: item.studentId, id: newId, status: item.status });
          inserted++;
        }
        logAudit(req, 'ATTENDANCE_BULK_SAVED', 'attendance', `${date}:${sessionId}`, { inserted, skippedDuplicates });
      });
      tx();

      res.json({ inserted, skippedDuplicates, insertedRecords });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/attendance/:recordId/correct', requireRole('admin', 'office_staff', 'teacher'), (req: SessionRequest, res) => {
    try {
      const { recordId } = req.params;
      const { newStatus, reason, remarks } = req.body as { newStatus: string; reason: string; remarks?: string };
      if (!newStatus || !reason || !reason.trim()) {
        return res.status(400).json({ error: 'New status and correction reason are mandatory' });
      }

      const existing = db.prepare('SELECT * FROM attendance_records WHERE id = ?').get(recordId) as any;
      if (!existing) return res.status(404).json({ error: 'Attendance record not found' });

      const tx = db.transaction(() => {
        db.prepare("UPDATE attendance_records SET status = ?, remarks = ?, updated_at = datetime('now') WHERE id = ?").run(
          newStatus,
          remarks !== undefined ? remarks : existing.remarks,
          recordId
        );
        db.prepare(
          'INSERT INTO attendance_corrections (id, attendance_record_id, previous_status, new_status, reason, corrected_by, corrected_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(uid(), recordId, existing.status, newStatus, reason.trim(), req.actor?.profileId || null, req.actor?.name || 'Staff');

        logAudit(req, 'ATTENDANCE_CORRECTED', 'attendance', recordId, {
          previousStatus: existing.status,
          newStatus,
          reason: reason.trim(),
        });
      });
      tx();

      res.json({ updated: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/attendance/reports', (req: SessionRequest, res) => {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const month = (req.query.month as string) || date.slice(0, 7);
    const classId = (req.query.classId as string) || '';

    let stuFilter = '';
    const params: any[] = [date];
    if (classId) {
      stuFilter = ' AND st.class_id = ?';
      params.push(classId);
    }
    if (req.actor?.role === 'student' && req.actor.studentId) {
      stuFilter += ' AND st.id = ?';
      params.push(req.actor.studentId);
    }

    const daily = db.prepare(`
      SELECT ar.*, st.student_code, st.full_name, st.full_name_ur,
             c.name_en as class_name_en, c.name_ur as class_name_ur,
             ses.code as session_code, ses.name_en as session_name_en, ses.name_ur as session_name_ur
      FROM attendance_records ar
      JOIN students st ON st.id = ar.student_id
      JOIN classes c ON c.id = ar.class_id
      JOIN attendance_sessions ses ON ses.id = ar.session_id
      WHERE ar.attendance_date = ? ${stuFilter}
      ORDER BY st.student_code ASC, ses.sort_order ASC
    `).all(...params);

    const monthParams: any[] = [`${month}%`];
    let monthStuFilter = '';
    if (classId) {
      monthStuFilter = ' AND st.class_id = ?';
      monthParams.push(classId);
    }
    if (req.actor?.role === 'student' && req.actor.studentId) {
      monthStuFilter += ' AND st.id = ?';
      monthParams.push(req.actor.studentId);
    }

    const monthlySummary = db.prepare(`
      SELECT st.id as student_id, st.student_code, st.full_name, st.full_name_ur,
             c.name_en as class_name_en, c.name_ur as class_name_ur,
             COUNT(ar.id) as total_sessions,
             SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
             SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late_count,
             SUM(CASE WHEN ar.status = 'leave' THEN 1 ELSE 0 END) as leave_count,
             SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent_count
      FROM students st
      LEFT JOIN classes c ON c.id = st.class_id
      LEFT JOIN attendance_records ar ON ar.student_id = st.id AND ar.attendance_date LIKE ?
      WHERE 1=1 ${monthStuFilter}
      GROUP BY st.id
      ORDER BY st.student_code ASC
    `).all(...monthParams);

    const absentList = (daily as any[]).filter((r) => r.status === 'absent');

    // Group daily attendance into 1 row per student showing all 3 sessions horizontally
    let dailyStuWhere = "WHERE st.status != 'withdrawn'";
    const dailyStuParams: any[] = [];
    if (classId) {
      dailyStuWhere += ' AND st.class_id = ?';
      dailyStuParams.push(classId);
    }
    if (req.actor?.role === 'student' && req.actor.studentId) {
      dailyStuWhere += ' AND st.id = ?';
      dailyStuParams.push(req.actor.studentId);
    }
    const dailyStudents = db.prepare(`
      SELECT st.id as student_id, st.student_code, st.full_name, st.full_name_ur,
             c.name_en as class_name_en, c.name_ur as class_name_ur
      FROM students st
      LEFT JOIN classes c ON c.id = st.class_id
      ${dailyStuWhere}
      ORDER BY st.student_code ASC
    `).all(...dailyStuParams) as any[];

    const dailyMap = new Map<string, Record<string, any>>();
    for (const rec of daily as any[]) {
      if (!dailyMap.has(rec.student_id)) dailyMap.set(rec.student_id, {});
      dailyMap.get(rec.student_id)![rec.session_id] = {
        id: rec.id,
        status: rec.status,
        late_minutes: Number(rec.late_minutes) || 0,
        remarks: rec.remarks || '',
      };
    }

    const dailyMutala = db.prepare(`
      SELECT sl.*, st.student_code, st.full_name, st.full_name_ur,
             b.title_en as book_title_en, b.title_ur as book_title_ur,
             s.name_en as subject_name_en, s.name_ur as subject_name_ur,
             sr.decision, sr.comments as review_comments, sr.reviewer_name
      FROM study_logs sl
      JOIN students st ON st.id = sl.student_id
      JOIN books b ON b.id = sl.book_id
      LEFT JOIN subjects s ON s.id = b.subject_id
      LEFT JOIN study_reviews sr ON sr.study_log_id = sl.id
      WHERE sl.study_date = ?
      ORDER BY st.student_code ASC
    `).all(date) as any[];

    const dailyLessons = db.prepare(`
      SELECT lr.*, b.title_en as book_title_en, b.title_ur as book_title_ur,
             s.name_en as subject_name_en, s.name_ur as subject_name_ur,
             t.full_name as teacher_name, t.full_name_ur as teacher_name_ur,
             c.name_en as class_name_en, c.name_ur as class_name_ur
      FROM lesson_records lr
      JOIN books b ON b.id = lr.book_id
      JOIN subjects s ON s.id = lr.subject_id
      JOIN teachers t ON t.id = lr.teacher_id
      LEFT JOIN classes c ON c.id = lr.class_id
      WHERE lr.lesson_date = ?
      ORDER BY lr.created_at ASC
    `).all(date) as any[];

    const dailyGrouped = dailyStudents.map((st) => {
      const sesMap = dailyMap.get(st.student_id) || {};
      const remarksParts = Object.values(sesMap)
        .map((s: any) => s?.remarks)
        .filter((v) => v && v.trim());
      const stuMutala = dailyMutala.filter((m) => m.student_id === st.student_id);
      const stuLessons = dailyLessons.filter((l) => !l.class_id || l.class_id === st.class_id);
      return {
        ...st,
        attendance_date: date,
        sessions: sesMap,
        remarks: remarksParts.join(' · '),
        mutala: stuMutala,
        lessons: stuLessons,
      };
    });

    const corrections = db.prepare(`
      SELECT ac.*, ar.attendance_date, st.student_code, st.full_name, st.full_name_ur,
             ses.name_en as session_name_en, ses.name_ur as session_name_ur
      FROM attendance_corrections ac
      JOIN attendance_records ar ON ar.id = ac.attendance_record_id
      JOIN students st ON st.id = ar.student_id
      JOIN attendance_sessions ses ON ses.id = ar.session_id
      ORDER BY ac.corrected_at DESC
      LIMIT 50
    `).all();

    res.json({ date, month, daily, dailyGrouped, monthlySummary, absentList, corrections, dailyMutala, dailyLessons });
  });

  // Per-Student Monthly Attendance Register (Matching Takhasus Manual PDF Sheet)
  app.get('/api/attendance/student-monthly', (req: SessionRequest, res) => {
    try {
      const studentId = (req.query.studentId as string) || (req.actor?.role === 'student' ? req.actor.studentId : '') || '';
      const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);

      if (!studentId) {
        return res.status(400).json({ error: 'studentId is required' });
      }

      const student = db.prepare(`
        SELECT st.*, c.name_en as class_name_en, c.name_ur as class_name_ur,
               b.name_en as batch_name_en, b.name_ur as batch_name_ur
        FROM students st
        LEFT JOIN classes c ON c.id = st.class_id
        LEFT JOIN batches b ON b.id = st.batch_id
        WHERE st.id = ?
      `).get(studentId) as any;

      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      const sessions = db.prepare('SELECT * FROM attendance_sessions ORDER BY sort_order ASC').all() as any[];

      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr, 10);
      const mNum = parseInt(monthStr, 10);
      const daysCount = new Date(year, mNum, 0).getDate();

      const urduDays = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
      const hijriMap: Record<string, string> = {
        '2026-10': 'جمادی الاول 1448ھ',
        '2026-11': 'جمادی الثانی 1448ھ',
        '2026-12': 'رجب المرجب 1448ھ',
        '2027-01': 'شعبان المعظم 1448ھ',
        '2027-02': 'رمضان المبارک 1448ھ',
        '2027-03': 'شوال المکرم 1448ھ',
        '2027-04': 'ذوالقعدۃ 1448ھ',
        '2027-05': 'ذوالحجہ 1448ھ',
      };
      const hijriMonth = hijriMap[month] || 'جمادی الثانی 1448ھ';

      const records = db.prepare(`
        SELECT ar.*, s.code as session_code, s.name_ur as session_name_ur
        FROM attendance_records ar
        JOIN attendance_sessions s ON s.id = ar.session_id
        WHERE ar.student_id = ? AND ar.attendance_date LIKE ?
      `).all(studentId, `${month}-%`) as any[];

      const recordsByDateSession: Record<string, Record<string, any>> = {};
      for (const r of records) {
        if (!recordsByDateSession[r.attendance_date]) {
          recordsByDateSession[r.attendance_date] = {};
        }
        recordsByDateSession[r.attendance_date][r.session_id] = r;
      }

      let totalPresents = 0;
      let totalAbsents = 0;
      let totalLeaves = 0;
      let totalLates = 0;
      let totalLateMinutes = 0;

      const days = [];
      for (let d = 1; d <= daysCount; d++) {
        const dayStr = String(d).padStart(2, '0');
        const fullDate = `${month}-${dayStr}`;
        const dateObj = new Date(year, mNum - 1, d);
        const dayOfWeek = dateObj.getDay();
        const dayName = urduDays[dayOfWeek];
        const dayFormatted = `${dayStr}/${monthStr} - ${dayName}`;
        const isSunday = dayOfWeek === 0;

        const daySes = recordsByDateSession[fullDate] || {};
        let dayLateMin = 0;
        let dayHasPresent = false;
        let dayHasAbsent = false;
        let dayHasLeave = false;
        let dayHasLate = false;

        for (const ses of sessions) {
          const rec = daySes[ses.id];
          if (rec) {
            if (rec.status === 'present') dayHasPresent = true;
            if (rec.status === 'absent') dayHasAbsent = true;
            if (rec.status === 'leave') dayHasLeave = true;
            if (rec.status === 'late') {
              dayHasLate = true;
              dayLateMin += (Number(rec.late_minutes) || 15);
            }
          }
        }

        if (dayHasLate) {
          totalLates++;
          totalLateMinutes += dayLateMin;
        } else if (dayHasAbsent) {
          totalAbsents++;
        } else if (dayHasLeave) {
          totalLeaves++;
        } else if (dayHasPresent) {
          totalPresents++;
        }

        days.push({
          dayNumber: d,
          date: fullDate,
          dayFormatted,
          dayName,
          isSunday,
          sessions: daySes,
          dailyLateMinutes: dayLateMin,
          hasSigned: Boolean(dayHasPresent || dayHasLate)
        });
      }

      res.json({
        student,
        month,
        hijriMonth,
        sessions,
        days,
        totals: {
          leaves: totalLeaves,
          absents: totalAbsents,
          lates: totalLates,
          lateMinutes: totalLateMinutes,
          presents: totalPresents
        },
        timings: {
          morning: 'صبح: 8:00 بجے سے 12:00 بجے تک',
          zuhr: 'ظہر: 2:00 بجے سے عصر کی اذان تک',
          maghrib: 'مغرب: مغرب کا وقت داخل ہونے کے تین منٹ بعد سے رات 8:00 بجے تک (اس دورانیے میں کھانا اور نماز شامل نہیں)'
        },
        rules: 'جمعہ کے روز نماز جمعہ کے متصل بعد کلاس شروع ہوگی۔ نیز عصر تا مغرب تخلئی نہ ہوگی، چاہے اسباق ہوں نہ ہوں۔ کلاس میں حاضر ہوں تو آنے کا وقت اور کلاس سے جائیں تو جانے کا وقت درج کریں۔ حاضری شیٹ کی حفاظت طالب علم کی ذمہ داری ہے۔ ایک دن یا اس سے زائد وقت کی رخصت لینے کی صورت میں کم از کم پانچ دن پہلے درخواست جمع کروانا ضروری ہے۔ تاخیر یا غیر حاضری کی وجہ سے ادارہ کسی بھی قسم کی تادیبی کارروائی کا مجاز ہوگا۔'
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Monthly Date Sheet Register Grid (Full month date-by-date matrix for all students)
  app.get('/api/attendance/monthly-matrix', (req: SessionRequest, res) => {
    try {
      const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
      const classId = (req.query.classId as string) || '';

      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr, 10);
      const mNum = parseInt(monthStr, 10);
      const daysCount = new Date(year, mNum, 0).getDate();
      const urduDays = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];

      let stuWhere = "WHERE st.status != 'withdrawn'";
      const stuParams: any[] = [];
      if (classId) {
        stuWhere += ' AND st.class_id = ?';
        stuParams.push(classId);
      }
      if (req.actor?.role === 'student' && req.actor.studentId) {
        stuWhere += ' AND st.id = ?';
        stuParams.push(req.actor.studentId);
      }

      const students = db.prepare(`
        SELECT st.id as student_id, st.student_code, st.full_name, st.full_name_ur,
               c.name_en as class_name_en, c.name_ur as class_name_ur
        FROM students st
        LEFT JOIN classes c ON c.id = st.class_id
        ${stuWhere}
        ORDER BY st.student_code ASC
      `).all(...stuParams) as any[];

      const records = db.prepare(`
        SELECT ar.student_id, ar.session_id, ar.attendance_date, ar.status, ar.late_minutes
        FROM attendance_records ar
        WHERE ar.attendance_date LIKE ?
      `).all(`${month}-%`) as any[];

      const recordsByStudentDate: Record<string, Record<string, any[]>> = {};
      for (const r of records) {
        if (!recordsByStudentDate[r.student_id]) recordsByStudentDate[r.student_id] = {};
        if (!recordsByStudentDate[r.student_id][r.attendance_date]) recordsByStudentDate[r.student_id][r.attendance_date] = [];
        recordsByStudentDate[r.student_id][r.attendance_date].push(r);
      }

      const days = [];
      for (let d = 1; d <= daysCount; d++) {
        const dayStr = String(d).padStart(2, '0');
        const fullDate = `${month}-${dayStr}`;
        const dateObj = new Date(year, mNum - 1, d);
        const dayOfWeek = dateObj.getDay();
        days.push({
          dayNumber: d,
          date: fullDate,
          dayFormatted: `${dayStr}/${monthStr}`,
          dayName: urduDays[dayOfWeek],
          isSunday: dayOfWeek === 0,
        });
      }

      const matrixRows = students.map((st) => {
        const stuRecords = recordsByStudentDate[st.student_id] || {};
        const daysMap: Record<number, any> = {};
        let presentDays = 0;
        let absentDays = 0;
        let leaveDays = 0;
        let lateDays = 0;
        let totalLateMinutes = 0;
        let markedDays = 0;

        for (let d = 1; d <= daysCount; d++) {
          const dayStr = String(d).padStart(2, '0');
          const fullDate = `${month}-${dayStr}`;
          const dateObj = new Date(year, mNum - 1, d);
          const isSunday = dateObj.getDay() === 0;

          if (isSunday) {
            daysMap[d] = { status: 'holiday', label: 'اتوار', lateMinutes: 0 };
            continue;
          }

          const dayList = stuRecords[fullDate];
          if (!dayList || dayList.length === 0) {
            daysMap[d] = { status: 'unmarked', label: '—', lateMinutes: 0 };
            continue;
          }

          markedDays++;
          const hasAbsent = dayList.some((r: any) => r.status === 'absent');
          const hasLeave = dayList.some((r: any) => r.status === 'leave');
          const hasLate = dayList.some((r: any) => r.status === 'late');
          const hasPresent = dayList.some((r: any) => r.status === 'present');

          let dayLateMin = 0;
          dayList.forEach((r: any) => {
            if (r.status === 'late') dayLateMin += (Number(r.late_minutes) || 15);
          });

          if (hasLate) {
            lateDays++;
            totalLateMinutes += dayLateMin;
            daysMap[d] = { status: 'late', label: 'ت', lateMinutes: dayLateMin };
          } else if (hasAbsent) {
            absentDays++;
            daysMap[d] = { status: 'absent', label: 'غ', lateMinutes: 0 };
          } else if (hasLeave) {
            leaveDays++;
            daysMap[d] = { status: 'leave', label: 'ر', lateMinutes: 0 };
          } else if (hasPresent) {
            presentDays++;
            daysMap[d] = { status: 'present', label: 'ح', lateMinutes: 0 };
          } else {
            daysMap[d] = { status: 'unmarked', label: '—', lateMinutes: 0 };
          }
        }

        const effectiveTotal = presentDays + absentDays + leaveDays + lateDays;
        const pct = effectiveTotal > 0 ? Math.round(((presentDays + lateDays) / effectiveTotal) * 100) : 0;

        return {
          ...st,
          days: daysMap,
          totals: {
            presentDays,
            absentDays,
            leaveDays,
            lateDays,
            totalLateMinutes,
            markedDays,
            percentage: pct,
          },
        };
      });

      res.json({ month, days, rows: matrixRows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =========================================================================
  // DAILY MUTALA MANAGEMENT
  // =========================================================================
  app.get('/api/mutala', (req: SessionRequest, res) => {
    const status = (req.query.status as string) || '';
    const studentId = (req.query.studentId as string) || '';
    const bookId = (req.query.bookId as string) || '';
    const classId = (req.query.classId as string) || '';
    const date = (req.query.date as string) || '';
    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (req.actor?.role === 'student' && req.actor.studentId) {
      where += ' AND sl.student_id = ?';
      params.push(req.actor.studentId);
    } else if (studentId) {
      where += ' AND sl.student_id = ?';
      params.push(studentId);
    }

    if (status) {
      where += ' AND sl.status = ?';
      params.push(status);
    }
    if (bookId) {
      where += ' AND sl.book_id = ?';
      params.push(bookId);
    }
    if (classId) {
      where += ' AND st.class_id = ?';
      params.push(classId);
    }
    if (date) {
      where += ' AND sl.study_date = ?';
      params.push(date);
    }

    const logs = db.prepare(`
      SELECT sl.*,
        st.student_code, st.full_name as student_name, st.full_name_ur as student_name_ur, st.class_id,
        c.name_en as class_name_en, c.name_ur as class_name_ur,
        b.title_en as book_title_en, b.title_ur as book_title_ur, b.total_pages,
        s.name_en as subject_name_en, s.name_ur as subject_name_ur,
        sr.decision as review_decision, sr.comments as review_comments, sr.reviewer_name, sr.reviewed_at
      FROM study_logs sl
      JOIN students st ON st.id = sl.student_id
      LEFT JOIN classes c ON c.id = st.class_id
      JOIN books b ON b.id = sl.book_id
      JOIN subjects s ON s.id = b.subject_id
      LEFT JOIN study_reviews sr ON sr.id = (
        SELECT id FROM study_reviews WHERE study_log_id = sl.id ORDER BY reviewed_at DESC LIMIT 1
      )
      ${where}
      ORDER BY sl.study_date DESC, sl.created_at DESC
    `).all(...params);

    res.json(logs);
  });

  app.get('/api/mutala/summary', (req: SessionRequest, res) => {
    const studentId = (req.query.studentId as string) || '';
    const bookId = (req.query.bookId as string) || '';
    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (req.actor?.role === 'student' && req.actor.studentId) {
      where += ' AND sl.student_id = ?';
      params.push(req.actor.studentId);
    } else if (studentId) {
      where += ' AND sl.student_id = ?';
      params.push(studentId);
    }
    if (bookId) {
      where += ' AND sl.book_id = ?';
      params.push(bookId);
    }

    const latestByStudentBook = db.prepare(`
      SELECT sl.*,
        st.student_code, st.full_name as student_name, st.full_name_ur as student_name_ur,
        c.name_en as class_name_en, c.name_ur as class_name_ur,
        b.title_en as book_title_en, b.title_ur as book_title_ur, b.total_pages,
        s.name_en as subject_name_en, s.name_ur as subject_name_ur,
        (SELECT COUNT(*) FROM study_logs sl2 WHERE sl2.student_id = sl.student_id AND sl2.book_id = sl.book_id) as entries_count
      FROM study_logs sl
      JOIN students st ON st.id = sl.student_id
      LEFT JOIN classes c ON c.id = st.class_id
      JOIN books b ON b.id = sl.book_id
      JOIN subjects s ON s.id = b.subject_id
      ${where}
      AND sl.id = (
        SELECT sl_latest.id FROM study_logs sl_latest
        WHERE sl_latest.student_id = sl.student_id AND sl_latest.book_id = sl.book_id
        ORDER BY sl_latest.study_date DESC, sl_latest.created_at DESC
        LIMIT 1
      )
      ORDER BY sl.study_date DESC, st.student_code ASC
    `).all(...params);

    res.json(latestByStudentBook);
  });

  // Per-Student Monthly Mutala Register (Matching Takhasus Manual PDF Sheet)
  app.get('/api/mutala/student-monthly', (req: SessionRequest, res) => {
    try {
      const studentId = (req.query.studentId as string) || (req.actor?.role === 'student' ? req.actor.studentId : '') || '';
      const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
      const bookId = (req.query.bookId as string) || '';

      if (!studentId) {
        return res.status(400).json({ error: 'Student ID is required' });
      }

      const student = db.prepare(`
        SELECT st.*, c.name_en as class_name_en, c.name_ur as class_name_ur,
               b.name_en as batch_name_en, b.name_ur as batch_name_ur
        FROM students st
        LEFT JOIN classes c ON c.id = st.class_id
        LEFT JOIN batches b ON b.id = st.batch_id
        WHERE st.id = ?
      `).get(studentId) as any;

      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr, 10);
      const mNum = parseInt(monthStr, 10);
      const daysCount = new Date(year, mNum, 0).getDate();

      const urduDays = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
      const hijriMap: Record<string, string> = {
        '2026-10': 'جمادی الاول 1448ھ',
        '2026-11': 'جمادی الثانی 1448ھ',
        '2026-12': 'رجب المرجب 1448ھ',
        '2027-01': 'شعبان المعظم 1448ھ',
        '2027-02': 'رمضان المبارک 1448ھ',
        '2027-03': 'شوال المکرم 1448ھ',
        '2027-04': 'ذوالقعدۃ 1448ھ',
        '2027-05': 'ذوالحجہ 1448ھ',
      };
      const hijriMonth = hijriMap[month] || 'جمادی الثانی 1448ھ';

      let logQuery = `
        SELECT sl.*, bk.title_en as book_title_en, bk.title_ur as book_title_ur,
               sr.reviewer_name, sr.comments as review_comments, sr.decision as review_decision
        FROM study_logs sl
        JOIN books bk ON bk.id = sl.book_id
        LEFT JOIN study_reviews sr ON sr.id = (
          SELECT id FROM study_reviews WHERE study_log_id = sl.id ORDER BY reviewed_at DESC LIMIT 1
        )
        WHERE sl.student_id = ? AND sl.study_date LIKE ?
      `;
      const logParams: any[] = [studentId, `${month}-%`];
      if (bookId) {
        logQuery += ' AND sl.book_id = ?';
        logParams.push(bookId);
      }
      logQuery += ' ORDER BY sl.study_date ASC, sl.created_at ASC';

      const monthLogs = db.prepare(logQuery).all(...logParams) as any[];

      const logsByDate: Record<string, any[]> = {};
      for (const l of monthLogs) {
        if (!logsByDate[l.study_date]) logsByDate[l.study_date] = [];
        logsByDate[l.study_date].push(l);
      }

      const days = [];
      let runningTotalPages = 0;

      for (let d = 1; d <= daysCount; d++) {
        const dayStr = String(d).padStart(2, '0');
        const fullDate = `${month}-${dayStr}`;
        const dateObj = new Date(year, mNum - 1, d);
        const dayOfWeek = dateObj.getDay();
        const dayName = urduDays[dayOfWeek];
        const dayFormatted = `${dayStr}/${monthStr} - ${dayName}`;
        const isSunday = dayOfWeek === 0;

        const dayEntries = logsByDate[fullDate] || [];
        const firstEntry = dayEntries[0] || null;

        if (firstEntry && firstEntry.daily_pages) {
          runningTotalPages += Number(firstEntry.daily_pages);
        }

        days.push({
          dayNumber: d,
          date: fullDate,
          dayFormatted,
          dayName,
          isSunday,
          entries: dayEntries,
          primaryEntry: firstEntry ? {
            ...firstEntry,
            cumulative_pages: firstEntry.cumulative_pages || runningTotalPages
          } : null
        });
      }

      const summaryByBook = db.prepare(`
        SELECT bk.id as book_id, bk.title_en, bk.title_ur,
               MIN(sl.study_date) as start_date, MAX(sl.study_date) as end_date,
               MIN(sl.start_title) as first_start_title, MAX(sl.end_title) as last_end_title,
               MIN(sl.start_position) as first_start_pos, MAX(sl.end_position) as last_end_pos,
               SUM(COALESCE(sl.daily_pages, 0)) as monthly_total_pages,
               COUNT(sl.id) as total_entries,
               MAX(sl.maktaba) as maktaba
        FROM study_logs sl
        JOIN books bk ON bk.id = sl.book_id
        WHERE sl.student_id = ? AND sl.study_date LIKE ?
        GROUP BY bk.id
      `).all(studentId, `${month}-%`);

      res.json({
        student,
        month,
        hijriMonth,
        days,
        summaryByBook,
        instructions: 'مطالعے کی یومیہ حاضری درج کرتے وقت درج ذیل امور کا خیال رکھیں: مطالعے کا آغاز جس عبارت سے کیا گیا، وہ تحریر کریں۔ مطالعے کا اختتام جس عبارت پر ہوا، وہ بھی واضح طور پر لکھیں۔ ابتدائی اور انتہائی صفحہ نمبر اور جزئیات کی تعداد ضرور درج کریں۔ ہر دن کی رپورٹ اسی دن مکمل اور واضح انداز میں لکھیں۔'
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/mutala', (req: SessionRequest, res) => {
    try {
      const b = req.body;
      const targetStudentId = req.actor?.role === 'student' && req.actor.studentId ? req.actor.studentId : b.student_id;
      const chapter = b.chapter || b.start_title || 'مطالعہ';
      const studyDetails = b.study_details || b.juziyat_notes || b.start_title || 'یومیہ مطالعہ';
      const startPos = b.start_position || '1';
      const endPos = b.end_position || startPos;
      if (!targetStudentId || !b.book_id) {
        return res.status(400).json({ error: 'Student and Book are required' });
      }

      const numStart = parseInt(startPos, 10);
      const numEnd = parseInt(endPos, 10);
      const computedDailyPages = !isNaN(numStart) && !isNaN(numEnd) && numEnd >= numStart
        ? (numEnd - numStart + 1)
        : (parseInt(b.daily_pages, 10) || 1);

      const prevSum = db.prepare(`
        SELECT COALESCE(SUM(daily_pages), 0) as s FROM study_logs
        WHERE student_id = ? AND book_id = ? AND study_date <= ?
      `).get(targetStudentId, b.book_id, b.study_date || new Date().toISOString().slice(0, 10)) as { s: number };
      const computedCumulative = (prevSum?.s || 0) + computedDailyPages;

      const id = uid();
      db.prepare(`
        INSERT INTO study_logs (
          id, student_id, study_date, book_id, chapter, start_position, end_position, study_details, student_comments, status,
          maktaba, start_title, end_title, daily_pages, cumulative_pages, juziyat_notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        targetStudentId,
        b.study_date || new Date().toISOString().slice(0, 10),
        b.book_id,
        chapter,
        startPos,
        endPos,
        studyDetails,
        b.student_comments || null,
        b.maktaba || null,
        b.start_title || null,
        b.end_title || null,
        computedDailyPages,
        b.cumulative_pages || computedCumulative,
        b.juziyat_notes || null
      );
      logAudit(req, 'MUTALA_SUBMITTED', 'study_log', id, { studentId: targetStudentId, chapter: b.chapter });
      res.status(201).json(db.prepare('SELECT * FROM study_logs WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/mutala/:id', (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      const existing = db.prepare('SELECT * FROM study_logs WHERE id = ?').get(id) as any;
      if (!existing) return res.status(404).json({ error: 'Study log not found' });

      if (req.actor?.role === 'student') {
        if (req.actor.studentId && existing.student_id !== req.actor.studentId) {
          return res.status(403).json({ error: 'Cannot edit another student study log' });
        }
        if (existing.status === 'approved') {
          return res.status(400).json({ error: 'Approved study logs can only be modified by staff or teachers' });
        }
      }

      const b = req.body;
      const nextStatus = req.actor?.role === 'student' && existing.status === 'needs_correction'
        ? 'pending'
        : (b.status ?? existing.status);

      const numStart = parseInt(b.start_position ?? existing.start_position, 10);
      const numEnd = parseInt(b.end_position ?? existing.end_position, 10);
      const computedDailyPages = !isNaN(numStart) && !isNaN(numEnd) && numEnd >= numStart
        ? (numEnd - numStart + 1)
        : (parseInt(b.daily_pages, 10) || existing.daily_pages || 0);

      db.prepare(`
        UPDATE study_logs SET
          study_date = ?, book_id = ?, chapter = ?, start_position = ?, end_position = ?,
          study_details = ?, student_comments = ?, status = ?,
          maktaba = ?, start_title = ?, end_title = ?, daily_pages = ?, cumulative_pages = ?, juziyat_notes = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        b.study_date ?? existing.study_date,
        b.book_id ?? existing.book_id,
        b.chapter ?? existing.chapter,
        b.start_position ?? existing.start_position,
        b.end_position ?? existing.end_position,
        b.study_details ?? existing.study_details,
        b.student_comments !== undefined ? b.student_comments : existing.student_comments,
        nextStatus,
        b.maktaba !== undefined ? b.maktaba : existing.maktaba,
        b.start_title !== undefined ? b.start_title : existing.start_title,
        b.end_title !== undefined ? b.end_title : existing.end_title,
        computedDailyPages,
        b.cumulative_pages !== undefined ? b.cumulative_pages : existing.cumulative_pages,
        b.juziyat_notes !== undefined ? b.juziyat_notes : existing.juziyat_notes,
        id
      );
      logAudit(req, 'MUTALA_UPDATED', 'study_log', id, { range: `${b.start_position ?? existing.start_position} - ${b.end_position ?? existing.end_position}` });
      res.json(db.prepare('SELECT * FROM study_logs WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/mutala/:id', (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      const existing = db.prepare('SELECT * FROM study_logs WHERE id = ?').get(id) as any;
      if (!existing) return res.status(404).json({ error: 'Study log not found' });
      db.prepare('DELETE FROM study_logs WHERE id = ?').run(id);
      logAudit(req, 'MUTALA_DELETED', 'study_log', id, {});
      res.json({ deleted: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/mutala/:id/review', requireRole('admin', 'teacher'), (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      const { decision, comments } = req.body as { decision: 'approved' | 'needs_correction'; comments?: string };
      if (!['approved', 'needs_correction'].includes(decision)) {
        return res.status(400).json({ error: 'Invalid review decision' });
      }
      const existing = db.prepare('SELECT * FROM study_logs WHERE id = ?').get(id) as any;
      if (!existing) return res.status(404).json({ error: 'Study log not found' });

      const tx = db.transaction(() => {
        db.prepare("UPDATE study_logs SET status = ?, updated_at = datetime('now') WHERE id = ?").run(decision, id);
        db.prepare(
          'INSERT INTO study_reviews (id, study_log_id, teacher_id, reviewer_profile_id, reviewer_name, decision, comments) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(uid(), id, req.actor?.teacherId || null, req.actor?.profileId || null, req.actor?.name || 'Teacher', decision, comments || null);
        logAudit(req, decision === 'approved' ? 'MUTALA_APPROVED' : 'MUTALA_RETURNED', 'study_log', id, { decision, comments });
      });
      tx();
      res.json({ updated: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =========================================================================
  // TEACHER MANAGEMENT & CLASS/SUBJECT SCHEDULE
  // =========================================================================
  app.get('/api/schedule', (req, res) => {
    const classId = (req.query.classId as string) || '';
    const teacherId = (req.query.teacherId as string) || '';
    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (classId) {
      where += ' AND ta.class_id = ?';
      params.push(classId);
    }
    if (teacherId) {
      where += ' AND ta.teacher_id = ?';
      params.push(teacherId);
    }

    const schedule = db.prepare(`
      SELECT ta.*,
        t.teacher_code, t.full_name as teacher_name, t.full_name_ur as teacher_name_ur,
        c.name_en as class_name_en, c.name_ur as class_name_ur,
        s.name_en as subject_name_en, s.name_ur as subject_name_ur,
        b.title_en as book_title_en, b.title_ur as book_title_ur,
        ses.name_en as session_name_en, ses.name_ur as session_name_ur, ses.sort_order as session_sort_order,
        (SELECT lr.lesson_date FROM lesson_records lr WHERE lr.class_id = ta.class_id AND (ta.book_id IS NULL OR lr.book_id = ta.book_id) ORDER BY lr.lesson_date DESC, lr.created_at DESC LIMIT 1) as latest_lesson_date,
        (SELECT lr.start_position FROM lesson_records lr WHERE lr.class_id = ta.class_id AND (ta.book_id IS NULL OR lr.book_id = ta.book_id) ORDER BY lr.lesson_date DESC, lr.created_at DESC LIMIT 1) as latest_start_position,
        (SELECT lr.end_position FROM lesson_records lr WHERE lr.class_id = ta.class_id AND (ta.book_id IS NULL OR lr.book_id = ta.book_id) ORDER BY lr.lesson_date DESC, lr.created_at DESC LIMIT 1) as latest_end_position
      FROM teacher_assignments ta
      JOIN teachers t ON t.id = ta.teacher_id
      LEFT JOIN classes c ON c.id = ta.class_id
      LEFT JOIN subjects s ON s.id = ta.subject_id
      LEFT JOIN books b ON b.id = ta.book_id
      LEFT JOIN attendance_sessions ses ON ses.id = ta.session_id
      ${where}
      ORDER BY COALESCE(ses.sort_order, 9) ASC, COALESCE(ta.start_time, '99:99') ASC, c.level_order ASC
    `).all(...params);

    res.json(schedule);
  });

  app.post('/api/schedule', requireRole('admin', 'office_staff'), (req: SessionRequest, res) => {
    try {
      const b = req.body;
      if (!b.teacher_id || !b.class_id || !b.subject_id) {
        return res.status(400).json({ error: 'Teacher, class, and subject are required' });
      }
      const id = uid();
      db.prepare(`
        INSERT INTO teacher_assignments (id, teacher_id, academic_year_id, class_id, batch_id, subject_id, book_id, session_id, start_time, end_time, days_of_week, room_name, is_class_supervisor, can_mark_attendance)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        id,
        b.teacher_id,
        b.academic_year_id || 'ay-1447',
        b.class_id,
        b.batch_id || null,
        b.subject_id,
        b.book_id || null,
        b.session_id || 'ses-morning',
        b.start_time || '09:00',
        b.end_time || '10:00',
        b.days_of_week || 'ہفتہ تا جمعرات',
        b.room_name || 'درسگاہ ۱',
        b.is_class_supervisor ? 1 : 0
      );
      logAudit(req, 'SCHEDULE_ADDED', 'teacher_assignment', id, { teacherId: b.teacher_id, classId: b.class_id, subjectId: b.subject_id });
      res.status(201).json(db.prepare('SELECT * FROM teacher_assignments WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/schedule/:id', requireRole('admin', 'office_staff'), (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      const b = req.body;
      db.prepare(`
        UPDATE teacher_assignments
        SET teacher_id = COALESCE(?, teacher_id),
            class_id = COALESCE(?, class_id),
            subject_id = COALESCE(?, subject_id),
            book_id = ?,
            session_id = COALESCE(?, session_id),
            start_time = COALESCE(?, start_time),
            end_time = COALESCE(?, end_time),
            days_of_week = COALESCE(?, days_of_week),
            room_name = COALESCE(?, room_name)
        WHERE id = ?
      `).run(
        b.teacher_id,
        b.class_id,
        b.subject_id,
        b.book_id || null,
        b.session_id,
        b.start_time,
        b.end_time,
        b.days_of_week,
        b.room_name,
        id
      );
      logAudit(req, 'SCHEDULE_UPDATED', 'teacher_assignment', id, { teacherId: b.teacher_id, classId: b.class_id, subjectId: b.subject_id, bookId: b.book_id });
      res.json(db.prepare('SELECT * FROM teacher_assignments WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/schedule/:id', requireRole('admin', 'office_staff'), (req: SessionRequest, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM teacher_assignments WHERE id = ?').run(id);
    logAudit(req, 'SCHEDULE_DELETED', 'teacher_assignment', id, {});
    res.json({ deleted: true });
  });

  app.get('/api/teachers', (req, res) => {
    const search = ((req.query.search as string) || '').trim();
    let teachers = db.prepare('SELECT * FROM teachers ORDER BY teacher_code ASC').all() as any[];
    if (search) {
      const cleanSearch = search.replace(/[-\s+]/g, '').toLowerCase();
      const searchDigits = search.replace(/\D/g, '');
      const q = search.toLowerCase();
      teachers = teachers.filter((t: any) => {
        const phone = (t.phone || '').replace(/[-\s+]/g, '');
        const phoneFormatted = phone.startsWith('92') ? '0' + phone.slice(2) : phone;
        return (
          (t.full_name || '').toLowerCase().includes(q) ||
          (t.full_name_ur || '').includes(q) ||
          (t.teacher_code || '').toLowerCase().includes(q) ||
          (t.qualification || '').toLowerCase().includes(q) ||
          (t.specialization || '').toLowerCase().includes(q) ||
          (t.phone || '').includes(search) ||
          (cleanSearch && phone.includes(cleanSearch)) ||
          (cleanSearch && phoneFormatted.includes(cleanSearch)) ||
          (searchDigits.length >= 3 && phone.includes(searchDigits))
        );
      });
    }
    const assignments = db.prepare(`
      SELECT ta.*, c.name_en as class_name_en, c.name_ur as class_name_ur,
             s.name_en as subject_name_en, s.name_ur as subject_name_ur,
             b.title_en as book_title_en, b.title_ur as book_title_ur,
             ses.name_en as session_name_en, ses.name_ur as session_name_ur,
             (SELECT lr.lesson_date FROM lesson_records lr WHERE lr.teacher_id = ta.teacher_id AND (ta.book_id IS NULL OR lr.book_id = ta.book_id) ORDER BY lr.lesson_date DESC, lr.created_at DESC LIMIT 1) as latest_lesson_date,
             (SELECT lr.start_position FROM lesson_records lr WHERE lr.teacher_id = ta.teacher_id AND (ta.book_id IS NULL OR lr.book_id = ta.book_id) ORDER BY lr.lesson_date DESC, lr.created_at DESC LIMIT 1) as latest_start_position,
             (SELECT lr.end_position FROM lesson_records lr WHERE lr.teacher_id = ta.teacher_id AND (ta.book_id IS NULL OR lr.book_id = ta.book_id) ORDER BY lr.lesson_date DESC, lr.created_at DESC LIMIT 1) as latest_end_position
      FROM teacher_assignments ta
      LEFT JOIN classes c ON c.id = ta.class_id
      LEFT JOIN subjects s ON s.id = ta.subject_id
      LEFT JOIN books b ON b.id = ta.book_id
      LEFT JOIN attendance_sessions ses ON ses.id = ta.session_id
      ORDER BY COALESCE(ses.sort_order, 9) ASC, COALESCE(ta.start_time, '99:99') ASC
    `).all() as any[];

    const latestLessonByTeacher = new Map<string, any>();
    const allLatestLessons = db.prepare(`
      SELECT lr.*, b.title_en as book_title_en, b.title_ur as book_title_ur, c.name_en as class_name_en, c.name_ur as class_name_ur
      FROM lesson_records lr
      LEFT JOIN books b ON b.id = lr.book_id
      LEFT JOIN classes c ON c.id = lr.class_id
      ORDER BY lr.lesson_date DESC, lr.created_at DESC
    `).all() as any[];
    for (const l of allLatestLessons) {
      if (!latestLessonByTeacher.has(l.teacher_id)) {
        latestLessonByTeacher.set(l.teacher_id, l);
      }
    }

    const result = teachers.map((t) => ({
      ...t,
      assignments: assignments.filter((a) => a.teacher_id === t.id),
      latest_lesson: latestLessonByTeacher.get(t.id) || null,
    }));
    res.json(result);
  });

  app.get('/api/teachers/:id', (req, res) => {
    const { id } = req.params;
    const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(id) as any;
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    const assignments = db.prepare(`
      SELECT ta.*, c.name_en as class_name_en, c.name_ur as class_name_ur,
             s.name_en as subject_name_en, s.name_ur as subject_name_ur,
             b.title_en as book_title_en, b.title_ur as book_title_ur,
             ses.name_en as session_name_en, ses.name_ur as session_name_ur,
             (SELECT lr.lesson_date FROM lesson_records lr WHERE lr.teacher_id = ta.teacher_id AND (ta.book_id IS NULL OR lr.book_id = ta.book_id) ORDER BY lr.lesson_date DESC, lr.created_at DESC LIMIT 1) as latest_lesson_date,
             (SELECT lr.start_position FROM lesson_records lr WHERE lr.teacher_id = ta.teacher_id AND (ta.book_id IS NULL OR lr.book_id = ta.book_id) ORDER BY lr.lesson_date DESC, lr.created_at DESC LIMIT 1) as latest_start_position,
             (SELECT lr.end_position FROM lesson_records lr WHERE lr.teacher_id = ta.teacher_id AND (ta.book_id IS NULL OR lr.book_id = ta.book_id) ORDER BY lr.lesson_date DESC, lr.created_at DESC LIMIT 1) as latest_end_position
      FROM teacher_assignments ta
      LEFT JOIN classes c ON c.id = ta.class_id
      LEFT JOIN subjects s ON s.id = ta.subject_id
      LEFT JOIN books b ON b.id = ta.book_id
      LEFT JOIN attendance_sessions ses ON ses.id = ta.session_id
      WHERE ta.teacher_id = ?
      ORDER BY COALESCE(ses.sort_order, 9) ASC, COALESCE(ta.start_time, '99:99') ASC
    `).all(id) as any[];

    const classIds = [...new Set(assignments.map((a) => a.class_id).filter(Boolean))];
    const supervisedStudents = classIds.length
      ? db.prepare(`SELECT id, student_code, full_name, full_name_ur, status, class_id FROM students WHERE class_id IN (${classIds.map(() => '?').join(',')}) ORDER BY student_code ASC`).all(...classIds)
      : [];

    const lessons = db.prepare(`
      SELECT lr.*, c.name_en as class_name_en, c.name_ur as class_name_ur,
             s.name_en as subject_name_en, s.name_ur as subject_name_ur,
             b.title_en as book_title_en, b.title_ur as book_title_ur
      FROM lesson_records lr
      JOIN classes c ON c.id = lr.class_id
      JOIN subjects s ON s.id = lr.subject_id
      JOIN books b ON b.id = lr.book_id
      WHERE lr.teacher_id = ?
      ORDER BY lr.lesson_date DESC
    `).all(id);

    const studyReviews = db.prepare(`
      SELECT sr.*, sl.study_date, sl.chapter, st.student_code, st.full_name as student_name, st.full_name_ur as student_name_ur,
             b.title_en as book_title_en, b.title_ur as book_title_ur
      FROM study_reviews sr
      JOIN study_logs sl ON sl.id = sr.study_log_id
      JOIN students st ON st.id = sl.student_id
      JOIN books b ON b.id = sl.book_id
      WHERE sr.teacher_id = ? OR sr.reviewer_profile_id = ?
      ORDER BY sr.reviewed_at DESC
    `).all(id, teacher.profile_id || '');

    const researchSupervisions = db.prepare(`
      SELECT ra.*, rt.title_en, rt.title_ur, st.student_code, st.full_name as student_name, st.full_name_ur as student_name_ur
      FROM research_assignments ra
      JOIN research_topics rt ON rt.id = ra.topic_id
      JOIN students st ON st.id = ra.student_id
      WHERE ra.supervisor_teacher_id = ?
    `).all(id);

    res.json({
      teacher,
      assignments,
      supervisedStudents,
      lessons,
      studyReviews,
      researchSupervisions,
      performance: {
        totalLessons: lessons.length,
        totalStudyReviews: studyReviews.length,
        supervisedStudentCount: supervisedStudents.length,
        researchCount: researchSupervisions.length,
      },
    });
  });

  app.post('/api/teachers', requireRole('admin', 'office_staff'), (req: SessionRequest, res) => {
    try {
      const b = req.body;
      if (!b.full_name || !b.qualification || !b.phone) {
        return res.status(400).json({ error: 'Name, qualification, and phone are required' });
      }
      const id = uid();
      const code = nextTeacherCode();
      const tx = db.transaction(() => {
        db.prepare(`
          INSERT INTO teachers (id, teacher_code, full_name, full_name_ur, qualification, qualification_ur, specialization, phone, email, address, joining_date, responsibilities, responsibilities_ur, photo_url, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          code,
          b.full_name,
          b.full_name_ur || b.full_name,
          b.qualification,
          b.qualification_ur || b.qualification,
          b.specialization || null,
          b.phone,
          b.email || null,
          b.address || null,
          b.joining_date || new Date().toISOString().slice(0, 10),
          b.responsibilities || null,
          b.responsibilities_ur || b.responsibilities || null,
          b.photo_url || null,
          b.status || 'active'
        );

        if (Array.isArray(b.assignments)) {
          const insTA = db.prepare('INSERT INTO teacher_assignments (id, teacher_id, academic_year_id, class_id, subject_id, book_id, session_id, start_time, end_time, days_of_week, room_name, is_class_supervisor, can_mark_attendance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)');
          for (const a of b.assignments) {
            if (!a.class_id) continue;
            insTA.run(uid(), id, 'ay-1447', a.class_id, a.subject_id || null, a.book_id || null, a.session_id || 'ses-morning', a.start_time || '09:00', a.end_time || '10:00', a.days_of_week || 'ہفتہ تا جمعرات', a.room_name || 'درسگاہ ۱', a.is_class_supervisor ? 1 : 0);
          }
        }
        logAudit(req, 'TEACHER_CREATED', 'teacher', id, { teacherCode: code, name: b.full_name_ur || b.full_name });
      });
      tx();
      res.status(201).json(db.prepare('SELECT * FROM teachers WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/teachers/:id', requireRole('admin', 'office_staff'), (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      const b = req.body;
      const existing = db.prepare('SELECT * FROM teachers WHERE id = ?').get(id) as any;
      if (!existing) return res.status(404).json({ error: 'Teacher not found' });

      const tx = db.transaction(() => {
        db.prepare(`
          UPDATE teachers SET
            full_name = ?, full_name_ur = ?, qualification = ?, qualification_ur = ?,
            specialization = ?, phone = ?, email = ?, address = ?,
            responsibilities = ?, responsibilities_ur = ?, photo_url = ?, status = ?,
            updated_at = datetime('now')
          WHERE id = ?
        `).run(
          b.full_name ?? existing.full_name,
          b.full_name_ur ?? existing.full_name_ur,
          b.qualification ?? existing.qualification,
          b.qualification_ur ?? existing.qualification_ur,
          b.specialization ?? existing.specialization,
          b.phone ?? existing.phone,
          b.email ?? existing.email,
          b.address ?? existing.address,
          b.responsibilities ?? existing.responsibilities,
          b.responsibilities_ur ?? existing.responsibilities_ur,
          b.photo_url !== undefined ? b.photo_url : existing.photo_url,
          b.status ?? existing.status,
          id
        );

        if (Array.isArray(b.assignments)) {
          db.prepare('DELETE FROM teacher_assignments WHERE teacher_id = ?').run(id);
          const insTA = db.prepare('INSERT INTO teacher_assignments (id, teacher_id, academic_year_id, class_id, subject_id, book_id, session_id, start_time, end_time, days_of_week, room_name, is_class_supervisor, can_mark_attendance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)');
          for (const a of b.assignments) {
            if (!a.class_id) continue;
            insTA.run(uid(), id, 'ay-1447', a.class_id, a.subject_id || null, a.book_id || null, a.session_id || 'ses-morning', a.start_time || '09:00', a.end_time || '10:00', a.days_of_week || 'ہفتہ تا جمعرات', a.room_name || 'درسگاہ ۱', a.is_class_supervisor ? 1 : 0);
          }
        }
        logAudit(req, 'TEACHER_UPDATED', 'teacher', id, { teacherCode: existing.teacher_code });
      });
      tx();
      res.json(db.prepare('SELECT * FROM teachers WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =========================================================================
  // LESSON MANAGEMENT (Teacher Lessons — separate from Student Mutala)
  // =========================================================================
  app.get('/api/lessons', (req, res) => {
    const classId = (req.query.classId as string) || '';
    const teacherId = (req.query.teacherId as string) || '';
    const bookId = (req.query.bookId as string) || '';
    const date = (req.query.date as string) || '';
    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (classId) {
      where += ' AND lr.class_id = ?';
      params.push(classId);
    }
    if (teacherId) {
      where += ' AND lr.teacher_id = ?';
      params.push(teacherId);
    }
    if (bookId) {
      where += ' AND lr.book_id = ?';
      params.push(bookId);
    }
    if (date) {
      where += ' AND lr.lesson_date = ?';
      params.push(date);
    }

    const lessons = db.prepare(`
      SELECT lr.*, t.full_name as teacher_name, t.full_name_ur as teacher_name_ur, t.teacher_code,
             c.name_en as class_name_en, c.name_ur as class_name_ur,
             s.name_en as subject_name_en, s.name_ur as subject_name_ur,
             b.title_en as book_title_en, b.title_ur as book_title_ur, b.total_pages
      FROM lesson_records lr
      JOIN teachers t ON t.id = lr.teacher_id
      JOIN classes c ON c.id = lr.class_id
      JOIN subjects s ON s.id = lr.subject_id
      JOIN books b ON b.id = lr.book_id
      ${where}
      ORDER BY lr.lesson_date DESC, lr.created_at DESC
    `).all(...params);

    const bookProgress = db.prepare(`
      SELECT b.id as book_id, b.title_en, b.title_ur, b.total_pages, b.total_chapters,
             s.name_en as subject_name_en, s.name_ur as subject_name_ur,
             COUNT(lr.id) as lessons_count,
             MAX(lr.lesson_date) as last_taught_date,
             (SELECT start_position FROM lesson_records WHERE book_id = b.id ORDER BY lesson_date DESC, created_at DESC LIMIT 1) as latest_start_position,
             (SELECT end_position FROM lesson_records WHERE book_id = b.id ORDER BY lesson_date DESC, created_at DESC LIMIT 1) as latest_position,
             (SELECT t2.full_name FROM lesson_records lr2 JOIN teachers t2 ON t2.id = lr2.teacher_id WHERE lr2.book_id = b.id ORDER BY lr2.lesson_date DESC, lr2.created_at DESC LIMIT 1) as latest_teacher_name,
             (SELECT t2.full_name_ur FROM lesson_records lr2 JOIN teachers t2 ON t2.id = lr2.teacher_id WHERE lr2.book_id = b.id ORDER BY lr2.lesson_date DESC, lr2.created_at DESC LIMIT 1) as latest_teacher_name_ur,
             (SELECT c2.name_en FROM lesson_records lr2 JOIN classes c2 ON c2.id = lr2.class_id WHERE lr2.book_id = b.id ORDER BY lr2.lesson_date DESC, lr2.created_at DESC LIMIT 1) as latest_class_name_en,
             (SELECT c2.name_ur FROM lesson_records lr2 JOIN classes c2 ON c2.id = lr2.class_id WHERE lr2.book_id = b.id ORDER BY lr2.lesson_date DESC, lr2.created_at DESC LIMIT 1) as latest_class_name_ur
      FROM books b
      JOIN subjects s ON s.id = b.subject_id
      LEFT JOIN lesson_records lr ON lr.book_id = b.id
      GROUP BY b.id
      ORDER BY lessons_count DESC, b.title_en ASC
    `).all();

    res.json({ lessons, bookProgress });
  });

  // Per-Teacher Monthly Lessons Register (Matching Takhasus Teachers Manual PDF Sheet - Image 4)
  app.get('/api/lessons/teacher-monthly', (req: SessionRequest, res) => {
    try {
      const teacherId = (req.query.teacherId as string) || (req.actor?.role === 'teacher' ? req.actor.teacherId : '') || 'tch-1';
      const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
      const bookId = (req.query.bookId as string) || '';

      const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(teacherId) as any ||
                      db.prepare('SELECT * FROM teachers LIMIT 1').get() as any;

      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr, 10);
      const mNum = parseInt(monthStr, 10);
      const daysCount = new Date(year, mNum, 0).getDate();

      let book = null;
      if (bookId) {
        book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId) as any;
      }
      if (!book) {
        book = db.prepare(`
          SELECT b.* FROM books b
          JOIN lesson_records lr ON lr.book_id = b.id
          WHERE lr.teacher_id = ?
          ORDER BY lr.lesson_date DESC LIMIT 1
        `).get(teacher?.id || teacherId) as any || db.prepare('SELECT * FROM books LIMIT 1').get() as any;
      }

      let where = 'WHERE lr.teacher_id = ? AND lr.lesson_date LIKE ?';
      const params: any[] = [teacher?.id || teacherId, `${month}-%`];
      if (book?.id) {
        where += ' AND lr.book_id = ?';
        params.push(book.id);
      }

      const lessons = db.prepare(`
        SELECT lr.*, b.title_en as book_title_en, b.title_ur as book_title_ur, b.total_pages
        FROM lesson_records lr
        JOIN books b ON b.id = lr.book_id
        ${where}
        ORDER BY lr.lesson_date ASC, lr.created_at ASC
      `).all(...params) as any[];

      const lessonsByDate: Record<string, any[]> = {};
      for (const l of lessons) {
        if (!lessonsByDate[l.lesson_date]) lessonsByDate[l.lesson_date] = [];
        lessonsByDate[l.lesson_date].push(l);
      }

      const urduDays = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
      const days = [];
      let runningCumulative = 0;

      for (let d = 1; d <= daysCount; d++) {
        const dStr = String(d).padStart(2, '0');
        const fullDate = `${month}-${dStr}`;
        const dObj = new Date(year, mNum - 1, d);
        const dayOfWeek = dObj.getDay();
        const isSunday = dayOfWeek === 0;
        const dayName = urduDays[dayOfWeek];

        const dayEntries = lessonsByDate[fullDate] || [];
        const primaryEntry = dayEntries[0] || null;

        if (primaryEntry) {
          const dp = Number(primaryEntry.daily_pages) || 1;
          runningCumulative += dp;
        }

        days.push({
          dayNumber: d,
          date: fullDate,
          dayFormatted: `${d}.`,
          dayWithWeekday: `${d}. (${dayName})`,
          dayName,
          isSunday,
          entries: dayEntries,
          primaryEntry: primaryEntry ? {
            ...primaryEntry,
            cumulative_pages: primaryEntry.cumulative_pages || runningCumulative
          } : null
        });
      }

      const hijriMap: Record<string, string> = {
        '2026-10': 'جمادی الاول 1448ھ',
        '2026-11': 'جمادی الثانی 1448ھ',
        '2026-12': 'رجب المرجب 1448ھ',
        '2027-01': 'شعبان المعظم 1448ھ',
        '2027-02': 'رمضان المبارک 1448ھ',
      };

      res.json({
        teacher,
        book,
        month,
        hijriMonth: hijriMap[month] || 'جمادی الثانی 1448ھ',
        days,
        totalLessons: lessons.length
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/lessons', requireRole('admin', 'teacher'), (req: SessionRequest, res) => {
    try {
      const b = req.body;
      const teacherId = b.teacher_id || req.actor?.teacherId || 'tch-1';
      if (!b.class_id || !b.subject_id || !b.book_id || !b.start_position || !b.end_position) {
        return res.status(400).json({ error: 'Class, subject, book, start position, and end position are required' });
      }
      const id = uid();
      let dailyPages = b.daily_pages ? Number(b.daily_pages) : 0;
      if (!dailyPages) {
        const s = parseInt(String(b.start_position).replace(/\D/g, ''), 10);
        const e = parseInt(String(b.end_position).replace(/\D/g, ''), 10);
        dailyPages = (!isNaN(s) && !isNaN(e) && e >= s) ? (e - s + 1) : 1;
      }
      const prevTotal = (db.prepare('SELECT COALESCE(SUM(daily_pages), 0) as tot FROM lesson_records WHERE book_id = ?').get(b.book_id) as any)?.tot || 0;
      const cumulativePages = b.cumulative_pages ? Number(b.cumulative_pages) : (prevTotal + dailyPages);

      db.prepare(`
        INSERT INTO lesson_records (
          id, teacher_id, lesson_date, class_id, batch_id, subject_id, book_id,
          start_position, end_position, homework, remarks,
          start_title, end_title, lesson_timing, attendance_status, daily_pages, cumulative_pages
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        teacherId,
        b.lesson_date || new Date().toISOString().slice(0, 10),
        b.class_id,
        b.batch_id || null,
        b.subject_id,
        b.book_id,
        b.start_position,
        b.end_position,
        b.homework || null,
        b.remarks || null,
        b.start_title || null,
        b.end_title || null,
        b.lesson_timing || 'حاضر (8:00 تا 12:00)',
        b.attendance_status || 'present',
        dailyPages,
        cumulativePages
      );
      logAudit(req, 'LESSON_RECORDED', 'lesson_record', id, { bookId: b.book_id, range: `${b.start_position} - ${b.end_position}` });
      res.status(201).json(db.prepare('SELECT * FROM lesson_records WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/lessons/:id', requireRole('admin', 'teacher'), (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      const existing = db.prepare('SELECT * FROM lesson_records WHERE id = ?').get(id) as any;
      if (!existing) return res.status(404).json({ error: 'Lesson record not found' });
      const b = req.body;
      let dailyPages = b.daily_pages !== undefined ? Number(b.daily_pages) : existing.daily_pages;
      if (!dailyPages) {
        const s = parseInt(String(b.start_position ?? existing.start_position).replace(/\D/g, ''), 10);
        const e = parseInt(String(b.end_position ?? existing.end_position).replace(/\D/g, ''), 10);
        dailyPages = (!isNaN(s) && !isNaN(e) && e >= s) ? (e - s + 1) : (existing.daily_pages || 1);
      }
      const cumulativePages = b.cumulative_pages !== undefined ? Number(b.cumulative_pages) : existing.cumulative_pages;

      db.prepare(`
        UPDATE lesson_records SET
          teacher_id = ?, lesson_date = ?, class_id = ?, subject_id = ?, book_id = ?,
          start_position = ?, end_position = ?, homework = ?, remarks = ?,
          start_title = ?, end_title = ?, lesson_timing = ?, attendance_status = ?, daily_pages = ?, cumulative_pages = ?
        WHERE id = ?
      `).run(
        b.teacher_id ?? existing.teacher_id,
        b.lesson_date ?? existing.lesson_date,
        b.class_id ?? existing.class_id,
        b.subject_id ?? existing.subject_id,
        b.book_id ?? existing.book_id,
        b.start_position ?? existing.start_position,
        b.end_position ?? existing.end_position,
        b.homework !== undefined ? b.homework : existing.homework,
        b.remarks !== undefined ? b.remarks : existing.remarks,
        b.start_title !== undefined ? b.start_title : existing.start_title,
        b.end_title !== undefined ? b.end_title : existing.end_title,
        b.lesson_timing !== undefined ? b.lesson_timing : existing.lesson_timing,
        b.attendance_status !== undefined ? b.attendance_status : existing.attendance_status,
        dailyPages,
        cumulativePages,
        id
      );
      logAudit(req, 'LESSON_UPDATED', 'lesson_record', id, { range: `${b.start_position ?? existing.start_position} - ${b.end_position ?? existing.end_position}` });
      res.json(db.prepare('SELECT * FROM lesson_records WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/lessons/:id', requireRole('admin', 'teacher'), (req: SessionRequest, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM lesson_records WHERE id = ?').run(id);
    logAudit(req, 'LESSON_DELETED', 'lesson_record', id, {});
    res.json({ deleted: true });
  });

  // =========================================================================
  // EXAMINATIONS & RESULT CARDS
  // =========================================================================
  app.get('/api/exams', (_req, res) => {
    const exams = db.prepare(`
      SELECT e.*, c.name_en as class_name_en, c.name_ur as class_name_ur,
             ay.title_en as year_title_en, ay.title_ur as year_title_ur,
             (SELECT COUNT(*) FROM exam_subjects es WHERE es.exam_id = e.id) as subject_count
      FROM exams e
      JOIN classes c ON c.id = e.class_id
      JOIN academic_years ay ON ay.id = e.academic_year_id
      ORDER BY e.start_date DESC
    `).all();
    res.json(exams);
  });

  app.post('/api/exams', requireRole('admin', 'office_staff'), (req: SessionRequest, res) => {
    try {
      const b = req.body;
      if (!b.title_en || !b.class_id || !b.start_date || !b.end_date) {
        return res.status(400).json({ error: 'Exam title, class, start date, and end date are required' });
      }
      const examId = uid();
      const tx = db.transaction(() => {
        db.prepare(`
          INSERT INTO exams (id, academic_year_id, class_id, title_en, title_ur, exam_type, start_date, end_date, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          examId,
          b.academic_year_id || 'ay-1447',
          b.class_id,
          b.title_en,
          b.title_ur || b.title_en,
          b.exam_type || 'term',
          b.start_date,
          b.end_date,
          b.status || 'scheduled'
        );

        const insES = db.prepare('INSERT INTO exam_subjects (id, exam_id, subject_id, book_id, exam_date, written_max_marks, oral_max_marks, passing_marks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        const subjectsToAdd = Array.isArray(b.subjects) && b.subjects.length > 0
          ? b.subjects
          : (db.prepare('SELECT id as subject_id FROM subjects LIMIT 3').all() as any[]);
        for (const s of subjectsToAdd) {
          insES.run(uid(), examId, s.subject_id, s.book_id || null, s.exam_date || b.start_date, s.written_max_marks ?? 80, s.oral_max_marks ?? 20, s.passing_marks ?? 40);
        }
        logAudit(req, 'EXAM_CREATED', 'exam', examId, { title: b.title_ur || b.title_en });
      });
      tx();
      res.status(201).json(db.prepare('SELECT * FROM exams WHERE id = ?').get(examId));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/exams/:id', (req: SessionRequest, res) => {
    const { id } = req.params;
    const exam = db.prepare(`
      SELECT e.*, c.name_en as class_name_en, c.name_ur as class_name_ur,
             ay.title_en as year_title_en, ay.title_ur as year_title_ur
      FROM exams e
      JOIN classes c ON c.id = e.class_id
      JOIN academic_years ay ON ay.id = e.academic_year_id
      WHERE e.id = ?
    `).get(id) as any;
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    const subjects = db.prepare(`
      SELECT es.*, s.name_en as subject_name_en, s.name_ur as subject_name_ur,
             b.title_en as book_title_en, b.title_ur as book_title_ur
      FROM exam_subjects es
      JOIN subjects s ON s.id = es.subject_id
      LEFT JOIN books b ON b.id = es.book_id
      WHERE es.exam_id = ?
      ORDER BY es.exam_date ASC
    `).all(id);

    let studentQuery = "SELECT id, student_code, full_name, full_name_ur, father_name, father_name_ur FROM students WHERE class_id = ? AND status != 'withdrawn'";
    const stuParams: any[] = [exam.class_id];
    if (req.actor?.role === 'student' && req.actor.studentId) {
      studentQuery += ' AND id = ?';
      stuParams.push(req.actor.studentId);
    }
    studentQuery += ' ORDER BY student_code ASC';
    const students = db.prepare(studentQuery).all(...stuParams);

    const results = db.prepare('SELECT * FROM exam_results WHERE exam_id = ?').all(id);
    res.json({ exam, subjects, students, results });
  });

  app.post('/api/exams/:id/marks', requireRole('admin', 'office_staff', 'teacher'), (req: SessionRequest, res) => {
    try {
      const { id: examId } = req.params;
      const { entries, publishStatus } = req.body as {
        entries: Array<{ examSubjectId: string; studentId: string; writtenMarks: number; oralMarks: number; remarks?: string }>;
        publishStatus?: string;
      };
      if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries array required' });

      const getES = db.prepare('SELECT written_max_marks, oral_max_marks FROM exam_subjects WHERE id = ?');
      const upsert = db.prepare(`
        INSERT INTO exam_results (id, exam_id, exam_subject_id, student_id, written_marks, oral_marks, total_marks, grade, remarks, entered_by, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(exam_subject_id, student_id) DO UPDATE SET
          written_marks = excluded.written_marks,
          oral_marks = excluded.oral_marks,
          total_marks = excluded.total_marks,
          grade = excluded.grade,
          remarks = excluded.remarks,
          entered_by = excluded.entered_by,
          updated_at = datetime('now')
      `);

      const tx = db.transaction(() => {
        for (const e of entries) {
          const es = getES.get(e.examSubjectId) as { written_max_marks: number; oral_max_marks: number } | undefined;
          const maxTotal = (es?.written_max_marks || 80) + (es?.oral_max_marks || 20);
          const w = Number(e.writtenMarks) || 0;
          const o = Number(e.oralMarks) || 0;
          const total = w + o;
          const grade = computeGrade(total, maxTotal);
          upsert.run(uid(), examId, e.examSubjectId, e.studentId, w, o, total, grade, e.remarks || null, req.actor?.profileId || null);
        }
        if (publishStatus) {
          db.prepare('UPDATE exams SET status = ? WHERE id = ?').run(publishStatus, examId);
        }
        logAudit(req, 'EXAM_MARKS_SAVED', 'exam', examId, { count: entries.length, publishStatus });
      });
      tx();
      res.json({ saved: entries.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =========================================================================
  // RESEARCH MANAGEMENT
  // =========================================================================
  app.get('/api/research', (_req, res) => {
    const topics = db.prepare('SELECT * FROM research_topics ORDER BY created_at DESC').all();
    const assignments = db.prepare(`
      SELECT ra.*, rt.title_en, rt.title_ur, rt.field_of_fiqh, rt.description,
             st.student_code, st.full_name as student_name, st.full_name_ur as student_name_ur,
             t.full_name as supervisor_name, t.full_name_ur as supervisor_name_ur
      FROM research_assignments ra
      JOIN research_topics rt ON rt.id = ra.topic_id
      JOIN students st ON st.id = ra.student_id
      JOIN teachers t ON t.id = ra.supervisor_teacher_id
      ORDER BY ra.assigned_at DESC
    `).all() as any[];

    for (const a of assignments) {
      a.submissions = db.prepare('SELECT * FROM research_submissions WHERE assignment_id = ? ORDER BY version_number DESC').all(a.id);
      a.reviews = db.prepare('SELECT * FROM research_reviews WHERE assignment_id = ? ORDER BY reviewed_at DESC').all(a.id);
    }

    res.json({ topics, assignments });
  });

  app.post('/api/research/assign', requireRole('admin', 'teacher', 'office_staff'), (req: SessionRequest, res) => {
    try {
      const b = req.body;
      if (!b.title_en || !b.student_id || !b.supervisor_teacher_id || !b.deadline) {
        return res.status(400).json({ error: 'Topic title, student, supervisor, and deadline are required' });
      }
      const topicId = uid();
      const assignmentId = uid();
      const tx = db.transaction(() => {
        db.prepare('INSERT INTO research_topics (id, academic_year_id, title_en, title_ur, field_of_fiqh, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
          topicId,
          b.academic_year_id || 'ay-1447',
          b.title_en,
          b.title_ur || b.title_en,
          b.field_of_fiqh || 'فقہ و افتاء',
          b.description || null,
          req.actor?.profileId || null
        );
        db.prepare('INSERT INTO research_assignments (id, topic_id, student_id, supervisor_teacher_id, deadline, status) VALUES (?, ?, ?, ?, ?, ?)').run(
          assignmentId,
          topicId,
          b.student_id,
          b.supervisor_teacher_id,
          b.deadline,
          'assigned'
        );
        logAudit(req, 'RESEARCH_ASSIGNED', 'research', assignmentId, { title: b.title_ur || b.title_en });
      });
      tx();
      res.status(201).json({ topicId, assignmentId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/research/:assignmentId/submit', (req: SessionRequest, res) => {
    try {
      const { assignmentId } = req.params;
      const { fileName, fileUrl, notes } = req.body as { fileName: string; fileUrl: string; notes?: string };
      const ra = db.prepare('SELECT * FROM research_assignments WHERE id = ?').get(assignmentId) as any;
      if (!ra) return res.status(404).json({ error: 'Assignment not found' });
      if (req.actor?.role === 'student' && req.actor.studentId !== ra.student_id) {
        return res.status(403).json({ error: 'Cannot submit for another student' });
      }
      const prevCount = (db.prepare('SELECT COUNT(*) as c FROM research_submissions WHERE assignment_id = ?').get(assignmentId) as { c: number }).c;
      const nextStatus = prevCount > 0 ? 'resubmitted' : 'submitted';

      const tx = db.transaction(() => {
        db.prepare('INSERT INTO research_submissions (id, assignment_id, version_number, file_name, file_url, notes, submitted_by) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
          uid(), assignmentId, prevCount + 1, fileName, fileUrl, notes || null, req.actor?.profileId || null
        );
        db.prepare('UPDATE research_assignments SET status = ? WHERE id = ?').run(nextStatus, assignmentId);
        logAudit(req, 'RESEARCH_SUBMITTED', 'research', assignmentId, { version: prevCount + 1, fileName });
      });
      tx();
      res.json({ submitted: true, version: prevCount + 1, status: nextStatus });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/research/:assignmentId/review', requireRole('admin', 'teacher'), (req: SessionRequest, res) => {
    try {
      const { assignmentId } = req.params;
      const { decision, comments, archive } = req.body as { decision: 'needs_correction' | 'approved'; comments: string; archive?: boolean };
      const ra = db.prepare('SELECT * FROM research_assignments WHERE id = ?').get(assignmentId) as any;
      if (!ra) return res.status(404).json({ error: 'Assignment not found' });

      const latestSub = db.prepare('SELECT id FROM research_submissions WHERE assignment_id = ? ORDER BY version_number DESC LIMIT 1').get(assignmentId) as
        | { id: string }
        | undefined;
      const newStatus = decision === 'approved' && archive ? 'archived' : decision;

      const tx = db.transaction(() => {
        db.prepare('INSERT INTO research_reviews (id, assignment_id, submission_id, supervisor_teacher_id, decision, comments) VALUES (?, ?, ?, ?, ?, ?)').run(
          uid(), assignmentId, latestSub?.id || null, ra.supervisor_teacher_id, decision, comments
        );
        db.prepare('UPDATE research_assignments SET status = ? WHERE id = ?').run(newStatus, assignmentId);
        logAudit(req, decision === 'approved' ? 'RESEARCH_APPROVED' : 'RESEARCH_RETURNED', 'research', assignmentId, { decision, newStatus });
      });
      tx();
      res.json({ updated: true, status: newStatus });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =========================================================================
  // DOCUMENTS & REPORTS
  // =========================================================================
  app.post('/api/documents', requireRole('admin', 'office_staff', 'teacher'), (req: SessionRequest, res) => {
    try {
      const b = req.body;
      if (!b.entity_type || !b.entity_id || !b.title || !b.file_name || !b.file_url) {
        return res.status(400).json({ error: 'Missing required document fields' });
      }
      const id = uid();
      db.prepare(`
        INSERT INTO documents (id, entity_type, entity_id, title, category, file_name, file_url, mime_type, file_size_bytes, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, b.entity_type, b.entity_id, b.title, b.category || 'certificate', b.file_name, b.file_url, b.mime_type || 'application/octet-stream', b.file_size_bytes || 0, req.actor?.profileId || null);
      logAudit(req, 'DOCUMENT_UPLOADED', 'document', id, { title: b.title, entityId: b.entity_id });
      res.status(201).json(db.prepare('SELECT * FROM documents WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/documents/:id', requireRole('admin', 'office_staff'), (req: SessionRequest, res) => {
    db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
    logAudit(req, 'DOCUMENT_DELETED', 'document', req.params.id, {});
    res.json({ deleted: true });
  });

  app.get('/api/reports/overview', (req, res) => {
    const timeframe = (req.query.timeframe as string) || 'monthly';
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    let dateWhereAtt = '';
    let dateWhereMutala = '';
    let dateWhereLesson = '';
    let dateWhereReview = '';
    let dateWhereExam = '';
    let dateWhereResearch = '';
    const attParams: any[] = [];
    const mutalaParams: any[] = [];
    const lessonParams: any[] = [];
    const reviewParams: any[] = [];
    const examParams: any[] = [];
    const researchParams: any[] = [];

    if (timeframe === 'daily') {
      dateWhereAtt = ' AND ar.attendance_date = ?';
      attParams.push(date);
      dateWhereMutala = ' AND sl.study_date = ?';
      mutalaParams.push(date);
      dateWhereLesson = ' AND lr.lesson_date = ?';
      lessonParams.push(date);
      dateWhereReview = ' AND date(sr.reviewed_at) = ?';
      reviewParams.push(date);
      dateWhereExam = ' AND e.start_date = ?';
      examParams.push(date);
      dateWhereResearch = ' AND ra.deadline = ?';
      researchParams.push(date);
    } else if (timeframe === 'weekly') {
      const d = new Date(date);
      const weekStart = new Date(d.getTime() - 6 * 86400000).toISOString().slice(0, 10);
      dateWhereAtt = ' AND ar.attendance_date BETWEEN ? AND ?';
      attParams.push(weekStart, date);
      dateWhereMutala = ' AND sl.study_date BETWEEN ? AND ?';
      mutalaParams.push(weekStart, date);
      dateWhereLesson = ' AND lr.lesson_date BETWEEN ? AND ?';
      lessonParams.push(weekStart, date);
      dateWhereReview = ' AND date(sr.reviewed_at) BETWEEN ? AND ?';
      reviewParams.push(weekStart, date);
      dateWhereExam = ' AND e.start_date BETWEEN ? AND ?';
      examParams.push(weekStart, date);
      dateWhereResearch = ' AND ra.deadline BETWEEN ? AND ?';
      researchParams.push(weekStart, date);
    } else if (timeframe === 'monthly') {
      dateWhereAtt = ' AND ar.attendance_date LIKE ?';
      attParams.push(`${month}%`);
      dateWhereMutala = ' AND sl.study_date LIKE ?';
      mutalaParams.push(`${month}%`);
      dateWhereLesson = ' AND lr.lesson_date LIKE ?';
      lessonParams.push(`${month}%`);
      dateWhereReview = ' AND date(sr.reviewed_at) LIKE ?';
      reviewParams.push(`${month}%`);
      dateWhereExam = ' AND e.start_date LIKE ?';
      examParams.push(`${month}%`);
      dateWhereResearch = ' AND ra.deadline LIKE ?';
      researchParams.push(`${month}%`);
    } else if (timeframe === 'annual') {
      const yr = date.slice(0, 4);
      dateWhereAtt = ' AND ar.attendance_date LIKE ?';
      attParams.push(`${yr}%`);
      dateWhereMutala = ' AND sl.study_date LIKE ?';
      mutalaParams.push(`${yr}%`);
      dateWhereLesson = ' AND lr.lesson_date LIKE ?';
      lessonParams.push(`${yr}%`);
      dateWhereReview = ' AND date(sr.reviewed_at) LIKE ?';
      reviewParams.push(`${yr}%`);
      dateWhereExam = ' AND e.start_date LIKE ?';
      examParams.push(`${yr}%`);
      dateWhereResearch = ' AND ra.deadline LIKE ?';
      researchParams.push(`${yr}%`);
    }

    const studentPerformance = db.prepare(`
      SELECT st.id, st.student_code, st.full_name, st.full_name_ur, c.name_en as class_name_en, c.name_ur as class_name_ur,
        (SELECT COUNT(*) FROM attendance_records ar WHERE ar.student_id = st.id ${dateWhereAtt}) as att_total,
        (SELECT COUNT(*) FROM attendance_records ar WHERE ar.student_id = st.id AND ar.status IN ('present', 'late') ${dateWhereAtt}) as att_present,
        (SELECT COUNT(*) FROM attendance_records ar WHERE ar.student_id = st.id AND ar.status = 'absent' ${dateWhereAtt}) as att_absent,
        (SELECT COUNT(*) FROM study_logs sl WHERE sl.student_id = st.id ${dateWhereMutala}) as mutala_total,
        (SELECT COUNT(*) FROM study_logs sl WHERE sl.student_id = st.id AND sl.status = 'approved' ${dateWhereMutala}) as mutala_approved,
        (SELECT ROUND(AVG(er.total_marks), 1) FROM exam_results er WHERE er.student_id = st.id) as avg_exam_marks,
        (SELECT COUNT(*) FROM research_assignments ra WHERE ra.student_id = st.id) as research_count,
        (SELECT rt.title_ur FROM research_assignments ra JOIN research_topics rt ON rt.id = ra.topic_id WHERE ra.student_id = st.id LIMIT 1) as research_topic_ur
      FROM students st
      LEFT JOIN classes c ON c.id = st.class_id
      ORDER BY st.student_code ASC
    `).all(...attParams, ...attParams, ...attParams, ...mutalaParams, ...mutalaParams);

    const teacherPerformance = db.prepare(`
      SELECT t.id, t.teacher_code, t.full_name, t.full_name_ur, t.specialization,
        (SELECT COUNT(*) FROM lesson_records lr WHERE lr.teacher_id = t.id ${dateWhereLesson}) as total_lessons,
        (SELECT COUNT(*) FROM study_reviews sr WHERE sr.teacher_id = t.id ${dateWhereReview}) as total_reviews,
        (SELECT COUNT(*) FROM research_assignments ra WHERE ra.supervisor_teacher_id = t.id ${dateWhereResearch}) as research_supervised
      FROM teachers t
      ORDER BY t.teacher_code ASC
    `).all(...lessonParams, ...reviewParams, ...researchParams);

    const lessonsInPeriod = db.prepare(`
      SELECT lr.*, b.title_en as book_title_en, b.title_ur as book_title_ur,
             s.name_en as subject_name_en, s.name_ur as subject_name_ur,
             t.full_name as teacher_name, t.full_name_ur as teacher_name_ur,
             c.name_en as class_name_en, c.name_ur as class_name_ur
      FROM lesson_records lr
      JOIN books b ON b.id = lr.book_id
      JOIN subjects s ON s.id = lr.subject_id
      JOIN teachers t ON t.id = lr.teacher_id
      LEFT JOIN classes c ON c.id = lr.class_id
      WHERE 1=1 ${dateWhereLesson}
      ORDER BY lr.lesson_date DESC
    `).all(...lessonParams);

    const studyProgress = db.prepare(`
      SELECT sl.id, sl.study_date, sl.chapter, sl.start_position, sl.end_position, sl.status,
             st.student_code, st.full_name as student_name, st.full_name_ur as student_name_ur,
             b.title_en as book_title_en, b.title_ur as book_title_ur
      FROM study_logs sl
      JOIN students st ON st.id = sl.student_id
      JOIN books b ON b.id = sl.book_id
      WHERE 1=1 ${dateWhereMutala}
      ORDER BY sl.study_date DESC
    `).all(...mutalaParams);

    const examReport = db.prepare(`
      SELECT er.*, e.title_en as exam_title_en, e.title_ur as exam_title_ur,
             st.student_code, st.full_name as student_name, st.full_name_ur as student_name_ur,
             s.name_en as subject_name_en, s.name_ur as subject_name_ur
      FROM exam_results er
      JOIN exams e ON e.id = er.exam_id
      JOIN students st ON st.id = er.student_id
      JOIN exam_subjects es ON es.id = er.exam_subject_id
      JOIN subjects s ON s.id = es.subject_id
      WHERE 1=1 ${dateWhereExam}
      ORDER BY e.start_date DESC, st.student_code ASC
    `).all(...examParams);

    const researchReport = db.prepare(`
      SELECT ra.id, ra.deadline, ra.status, rt.title_en, rt.title_ur, rt.field_of_fiqh,
             st.student_code, st.full_name as student_name, st.full_name_ur as student_name_ur,
             t.full_name as supervisor_name, t.full_name_ur as supervisor_name_ur
      FROM research_assignments ra
      JOIN research_topics rt ON rt.id = ra.topic_id
      JOIN students st ON st.id = ra.student_id
      JOIN teachers t ON t.id = ra.supervisor_teacher_id
      WHERE 1=1 ${dateWhereResearch}
      ORDER BY ra.deadline ASC
    `).all(...researchParams);

    res.json({
      date,
      month,
      timeframe,
      studentPerformance,
      teacherPerformance,
      lessonsInPeriod,
      studyProgress,
      examReport,
      researchReport,
    });
  });

  app.get('/api/audit-logs', requireRole('admin', 'office_staff'), (_req, res) => {
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').all();
    res.json(logs);
  });

  // =========================================================================
  // PART 2: DAR-UL-IFTA MANAGEMENT SYSTEM API ROUTES
  // =========================================================================

  function canAccessFatwaQuestion(req: SessionRequest, questionId: string): boolean {
    const role = req.actor?.role || 'student';
    if (['admin', 'office_staff', 'senior_mufti'].includes(role)) return true;
    const assigned = db
      .prepare('SELECT 1 FROM fatwa_assignments WHERE question_id = ? AND assignee_profile_id = ? AND is_active = 1')
      .get(questionId, req.actor?.profileId || '');
    return Boolean(assigned);
  }

  function sanitizeQuestionPrivacy(req: SessionRequest, q: any) {
    const role = req.actor?.role || 'student';
    const canSeePrivate = ['admin', 'office_staff', 'senior_mufti'].includes(role);
    if (canSeePrivate || !q.is_identity_private) return q;
    return {
      ...q,
      questioner_name: q.allow_public_identity ? q.questioner_name : 'سائل (نام پوشیدہ)',
      questioner_phone: null,
      questioner_email: null,
    };
  }

  app.get('/api/fatwa/lookups', (_req, res) => {
    const categories = db.prepare('SELECT * FROM fatwa_categories WHERE is_active = 1 ORDER BY sort_order ASC').all();
    const assignees = db.prepare(`
      SELECT p.id as profile_id, p.full_name, p.full_name_ur, p.email, r.name as role_name, r.title_en as role_title_en, r.title_ur as role_title_ur
      FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.id
      JOIN roles r ON r.id = ur.role_id
      WHERE p.is_active = 1
      ORDER BY p.full_name ASC
    `).all();
    res.json({ categories, assignees });
  });

  app.get('/api/fatwa/categories', (_req, res) => {
    res.json(db.prepare('SELECT * FROM fatwa_categories ORDER BY sort_order ASC, name_en ASC').all());
  });

  app.post('/api/fatwa/categories', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      const b = req.body;
      if (!b.name_en || !b.name_ur) return res.status(400).json({ error: 'Category English and Urdu names are required' });
      const id = uid();
      const code = (b.code || b.name_en).toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 20);
      const maxOrder = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM fatwa_categories').get() as { m: number }).m;
      db.prepare('INSERT INTO fatwa_categories (id, code, name_en, name_ur, name_ar, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)').run(
        id, code, b.name_en, b.name_ur, b.name_ar || null, maxOrder + 1
      );
      logAudit(req, 'FATWA_CATEGORY_CREATED', 'fatwa_category', id, { name: b.name_ur });
      res.status(201).json(db.prepare('SELECT * FROM fatwa_categories WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/fatwa/categories/:id', requireRole('admin'), (req: SessionRequest, res) => {
    const { id } = req.params;
    const b = req.body;
    const existing = db.prepare('SELECT * FROM fatwa_categories WHERE id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ error: 'Category not found' });
    db.prepare('UPDATE fatwa_categories SET name_en = ?, name_ur = ?, name_ar = ?, is_active = ? WHERE id = ?').run(
      b.name_en ?? existing.name_en,
      b.name_ur ?? existing.name_ur,
      b.name_ar !== undefined ? b.name_ar : existing.name_ar,
      b.is_active !== undefined ? (b.is_active ? 1 : 0) : existing.is_active,
      id
    );
    logAudit(req, 'FATWA_CATEGORY_UPDATED', 'fatwa_category', id, { name: b.name_ur || existing.name_ur });
    res.json(db.prepare('SELECT * FROM fatwa_categories WHERE id = ?').get(id));
  });

  app.get('/api/fatwa/dashboard', (req: SessionRequest, res) => {
    const role = req.actor?.role || 'student';
    const isScopedAssignee = role === 'student' || role === 'mufti' || role === 'teacher';
    const profileId = req.actor?.profileId || '';

    const search = ((req.query.search as string) || '').trim();
    const categoryId = (req.query.categoryId as string) || '';
    const assigneeId = (req.query.assigneeId as string) || '';
    const dateFrom = (req.query.dateFrom as string) || '';
    const dateTo = (req.query.dateTo as string) || '';
    const statusFilter = (req.query.status as string) || '';

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (isScopedAssignee) {
      where += ' AND EXISTS (SELECT 1 FROM fatwa_assignments fa WHERE fa.question_id = fq.id AND fa.assignee_profile_id = ? AND fa.is_active = 1)';
      params.push(profileId);
    }
    if (search) {
      const cleanSearch = search.replace(/[-\s+]/g, '');
      where += ` AND (
        fq.fatwa_code LIKE ? OR
        fq.issued_fatwa_number LIKE ? OR
        fq.subject_title LIKE ? OR
        fq.subject_title_ur LIKE ? OR
        fq.question_text LIKE ? OR
        fq.questioner_name LIKE ? OR
        fq.questioner_phone LIKE ? OR
        REPLACE(REPLACE(REPLACE(fq.questioner_phone, '-', ''), ' ', ''), '+92', '0') LIKE ?
      )`;
      const like = `%${search}%`;
      const cleanLike = `%${cleanSearch}%`;
      params.push(like, like, like, like, like, like, like, cleanLike);
    }
    if (categoryId) {
      where += ' AND fq.category_id = ?';
      params.push(categoryId);
    }
    if (assigneeId) {
      where += ' AND EXISTS (SELECT 1 FROM fatwa_assignments fa2 WHERE fa2.question_id = fq.id AND fa2.assignee_profile_id = ? AND fa2.is_active = 1)';
      params.push(assigneeId);
    }
    if (dateFrom) {
      where += ' AND fq.question_date >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      where += ' AND fq.question_date <= ?';
      params.push(dateTo);
    }
    if (statusFilter) {
      if (statusFilter === 'published') {
        where += " AND fq.publication_status = 'published'";
      } else {
        where += ' AND fq.workflow_status = ?';
        params.push(statusFilter);
      }
    }

    const questions = db.prepare(`
      SELECT fq.*, fc.name_en as category_name_en, fc.name_ur as category_name_ur,
             (SELECT GROUP_CONCAT(p.full_name_ur, '، ') FROM fatwa_assignments fa JOIN profiles p ON p.id = fa.assignee_profile_id WHERE fa.question_id = fq.id AND fa.is_active = 1) as assignees_ur,
             (SELECT GROUP_CONCAT(p.full_name, ', ') FROM fatwa_assignments fa JOIN profiles p ON p.id = fa.assignee_profile_id WHERE fa.question_id = fq.id AND fa.is_active = 1) as assignees_en
      FROM fatwa_questions fq
      JOIN fatwa_categories fc ON fc.id = fq.category_id
      ${where}
      ORDER BY fq.question_date DESC, fq.created_at DESC
    `).all(...params) as any[];

    // Scope-aware counts
    const allScoped = (isScopedAssignee
      ? db.prepare(`
          SELECT fq.workflow_status, fq.publication_status FROM fatwa_questions fq
          WHERE EXISTS (SELECT 1 FROM fatwa_assignments fa WHERE fa.question_id = fq.id AND fa.assignee_profile_id = ? AND fa.is_active = 1)
        `).all(profileId)
      : db.prepare('SELECT workflow_status, publication_status FROM fatwa_questions').all()) as Array<{ workflow_status: string; publication_status: string }>;

    const counts = {
      totalQuestions: allScoped.length,
      newQuestions: allScoped.filter((q) => q.workflow_status === 'received' || q.workflow_status === 'registered').length,
      assignedQuestions: allScoped.filter((q) => q.workflow_status === 'assigned').length,
      underResearch: allScoped.filter((q) => q.workflow_status === 'research').length,
      draftsInProgress: allScoped.filter((q) => q.workflow_status === 'draft').length,
      pendingSeniorReview: allScoped.filter((q) => q.workflow_status === 'senior_review').length,
      pendingFinalApproval: allScoped.filter((q) => q.workflow_status === 'final_approval').length,
      approvedFatwas: allScoped.filter((q) => q.workflow_status === 'issued').length,
      issuedFatwas: allScoped.filter((q) => q.workflow_status === 'issued').length,
      publishedFatwas: allScoped.filter((q) => q.publication_status === 'published').length,
    };

    res.json({
      counts,
      questions: questions.map((q) => sanitizeQuestionPrivacy(req, q)),
    });
  });

  app.post('/api/fatwa/questions', requireRole('admin', 'office_staff', 'mufti', 'senior_mufti', 'teacher'), (req: SessionRequest, res) => {
    try {
      const b = req.body;
      if (!b.questioner_name || !b.category_id || !b.subject_title || !b.question_text) {
        return res.status(400).json({ error: 'Questioner name, category, subject, and question text are required' });
      }
      const id = uid();
      const fatwaCode = nextFatwaCode();
      const tx = db.transaction(() => {
        db.prepare(`
          INSERT INTO fatwa_questions (
            id, fatwa_code, question_date, questioner_name, questioner_phone, questioner_email,
            city, country, category_id, subject_title, subject_title_ur, question_text,
            is_identity_private, allow_public_identity, source, workflow_status, publication_status, registered_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'registered', 'internal_only', ?)
        `).run(
          id,
          fatwaCode,
          b.question_date || new Date().toISOString().slice(0, 10),
          b.questioner_name,
          b.questioner_phone || null,
          b.questioner_email || null,
          b.city || null,
          b.country || 'Pakistan',
          b.category_id,
          b.subject_title,
          b.subject_title_ur || b.subject_title,
          b.question_text,
          b.is_identity_private !== false ? 1 : 0,
          b.allow_public_identity ? 1 : 0,
          b.source || 'office',
          req.actor?.profileId || null
        );

        if (Array.isArray(b.attachments)) {
          const insAtt = db.prepare('INSERT INTO fatwa_attachments (id, question_id, title, file_name, file_url, mime_type, file_size_bytes, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
          for (const att of b.attachments) {
            insAtt.run(uid(), id, att.title || att.fileName, att.fileName, att.fileUrl, att.mimeType || 'application/octet-stream', att.size || 0, req.actor?.profileId || null);
          }
        }
        logAudit(req, 'FATWA_QUESTION_REGISTERED', 'fatwa_question', id, { fatwaCode, source: b.source || 'office' });
      });
      tx();
      res.status(201).json(db.prepare('SELECT * FROM fatwa_questions WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/fatwa/questions/:id', (req: SessionRequest, res) => {
    const { id } = req.params;
    if (!canAccessFatwaQuestion(req, id)) {
      return res.status(403).json({ error: 'Only assigned researchers or authorized Muftis may view this question' });
    }

    const question = db.prepare(`
      SELECT fq.*, fc.name_en as category_name_en, fc.name_ur as category_name_ur, fc.name_ar as category_name_ar
      FROM fatwa_questions fq
      JOIN fatwa_categories fc ON fc.id = fq.category_id
      WHERE fq.id = ?
    `).get(id) as any;

    if (!question) return res.status(404).json({ error: 'Fatwa question not found' });

    const assignments = db.prepare(`
      SELECT fa.*, p.full_name, p.full_name_ur, p.email, ab.full_name_ur as assigned_by_name_ur, ab.full_name as assigned_by_name_en
      FROM fatwa_assignments fa
      JOIN profiles p ON p.id = fa.assignee_profile_id
      LEFT JOIN profiles ab ON ab.id = fa.assigned_by
      WHERE fa.question_id = ?
      ORDER BY fa.created_at DESC
    `).all(id);

    const research = db.prepare('SELECT * FROM fatwa_research WHERE question_id = ? ORDER BY created_at DESC').all(id);
    const references = db.prepare('SELECT * FROM fatwa_references WHERE question_id = ? ORDER BY created_at ASC').all(id);
    const draft = db.prepare('SELECT * FROM fatwa_drafts WHERE question_id = ?').get(id) || null;
    const versions = db.prepare('SELECT * FROM fatwa_versions WHERE question_id = ? ORDER BY version_number DESC').all(id);
    const reviews = db.prepare('SELECT * FROM fatwa_reviews WHERE question_id = ? ORDER BY reviewed_at DESC').all(id);
    const approvals = db.prepare('SELECT * FROM fatwa_approvals WHERE question_id = ? ORDER BY approved_at DESC').all(id);
    const publication = db.prepare('SELECT * FROM fatwa_publications WHERE question_id = ?').get(id) || null;
    const attachments = db.prepare('SELECT * FROM fatwa_attachments WHERE question_id = ? ORDER BY created_at DESC').all(id);
    const activity = db.prepare("SELECT * FROM audit_logs WHERE entity_id = ? OR details LIKE ? ORDER BY created_at DESC LIMIT 30").all(id, `%${question.fatwa_code}%`);

    res.json({
      question: sanitizeQuestionPrivacy(req, question),
      assignments,
      research,
      references,
      draft,
      versions,
      reviews,
      approvals,
      publication,
      attachments,
      activity,
    });
  });

  app.post('/api/fatwa/questions/:id/assign', requireRole('admin', 'senior_mufti'), (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      const { assignee_profile_id, assignee_role, deadline, instructions } = req.body;
      if (!assignee_profile_id || !assignee_role) {
        return res.status(400).json({ error: 'Assignee and role are required' });
      }
      const q = db.prepare('SELECT * FROM fatwa_questions WHERE id = ?').get(id) as any;
      if (!q) return res.status(404).json({ error: 'Question not found' });

      const tx = db.transaction(() => {
        db.prepare(`
          INSERT INTO fatwa_assignments (id, question_id, assignee_profile_id, assignee_role, assigned_by, assigned_date, deadline, instructions)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uid(), id, assignee_profile_id, assignee_role, req.actor?.profileId || null, new Date().toISOString().slice(0, 10), deadline || null, instructions || null);

        if (q.workflow_status === 'received' || q.workflow_status === 'registered') {
          db.prepare("UPDATE fatwa_questions SET workflow_status = 'assigned', updated_at = datetime('now') WHERE id = ?").run(id);
        }
        logAudit(req, 'FATWA_ASSIGNED', 'fatwa_question', id, { fatwaCode: q.fatwa_code, assignee_profile_id, assignee_role });
      });
      tx();
      res.json({ assigned: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/fatwa/questions/:id/research', (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      if (!canAccessFatwaQuestion(req, id)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const b = req.body;
      if (!b.research_notes) return res.status(400).json({ error: 'Research notes are required' });

      const q = db.prepare('SELECT * FROM fatwa_questions WHERE id = ?').get(id) as any;
      if (!q) return res.status(404).json({ error: 'Question not found' });

      const resId = uid();
      const tx = db.transaction(() => {
        db.prepare(`
          INSERT INTO fatwa_research (
            id, question_id, author_profile_id, author_name, research_notes, related_books,
            arabic_quotations, urdu_explanation, fiqhi_opinions, supporting_evidence, researcher_comments
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          resId, id, req.actor?.profileId || null, req.actor?.name || 'Researcher',
          b.research_notes, b.related_books || null, b.arabic_quotations || null,
          b.urdu_explanation || null, b.fiqhi_opinions || null, b.supporting_evidence || null, b.researcher_comments || null
        );
        if (['received', 'registered', 'assigned'].includes(q.workflow_status)) {
          db.prepare("UPDATE fatwa_questions SET workflow_status = 'research', updated_at = datetime('now') WHERE id = ?").run(id);
        }
        logAudit(req, 'FATWA_RESEARCH_ADDED', 'fatwa_question', id, { fatwaCode: q.fatwa_code });
      });
      tx();
      res.status(201).json(db.prepare('SELECT * FROM fatwa_research WHERE id = ?').get(resId));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/fatwa/references/search', (req, res) => {
    const q = ((req.query.q as string) || '').trim();
    const like = `%${q}%`;
    const rows = q
      ? db.prepare(`
          SELECT * FROM fatwa_references
          WHERE is_reusable = 1 AND (book_name LIKE ? OR author LIKE ? OR chapter LIKE ? OR arabic_quotation LIKE ? OR explanation LIKE ?)
          ORDER BY created_at DESC LIMIT 25
        `).all(like, like, like, like, like)
      : db.prepare('SELECT * FROM fatwa_references WHERE is_reusable = 1 ORDER BY created_at DESC LIMIT 25').all();
    res.json(rows);
  });

  app.post('/api/fatwa/questions/:id/references', (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      if (!canAccessFatwaQuestion(req, id)) return res.status(403).json({ error: 'Forbidden' });
      const b = req.body;
      if (!b.book_name || !b.arabic_quotation) {
        return res.status(400).json({ error: 'Book name and Arabic quotation are required' });
      }
      const refId = uid();
      db.prepare(`
        INSERT INTO fatwa_references (id, question_id, book_name, author, volume, page_number, chapter, arabic_quotation, explanation, reference_notes, is_reusable, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(
        refId, id, b.book_name, b.author || null, b.volume || null, b.page_number || null,
        b.chapter || null, b.arabic_quotation, b.explanation || null, b.reference_notes || null, req.actor?.profileId || null
      );
      logAudit(req, 'FATWA_REFERENCE_ADDED', 'fatwa_question', id, { book: b.book_name });
      res.status(201).json(db.prepare('SELECT * FROM fatwa_references WHERE id = ?').get(refId));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/fatwa/references/:refId', requireRole('admin', 'senior_mufti', 'mufti', 'teacher'), (req: SessionRequest, res) => {
    db.prepare('DELETE FROM fatwa_references WHERE id = ?').run(req.params.refId);
    res.json({ deleted: true });
  });

  app.put('/api/fatwa/questions/:id/draft', (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      if (!canAccessFatwaQuestion(req, id)) return res.status(403).json({ error: 'Forbidden' });
      const q = db.prepare('SELECT * FROM fatwa_questions WHERE id = ?').get(id) as any;
      if (!q) return res.status(404).json({ error: 'Question not found' });
      if (q.workflow_status === 'issued') {
        return res.status(400).json({ error: 'Issued fatwa cannot be directly overwritten; create a new version revision first' });
      }

      const { draft_title, draft_body_ur, draft_body_ar, saveVersion, submitForSeniorReview, changeSummary } = req.body as {
        draft_title?: string;
        draft_body_ur: string;
        draft_body_ar?: string;
        saveVersion?: boolean;
        submitForSeniorReview?: boolean;
        changeSummary?: string;
      };

      const existingDraft = db.prepare('SELECT * FROM fatwa_drafts WHERE question_id = ?').get(id) as any;
      const nextVer = existingDraft ? (saveVersion || submitForSeniorReview ? existingDraft.current_version + 1 : existingDraft.current_version) : 1;

      const tx = db.transaction(() => {
        db.prepare(`
          INSERT INTO fatwa_drafts (id, question_id, draft_title, draft_body_ur, draft_body_ar, current_version, last_edited_by, autosaved_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT(question_id) DO UPDATE SET
            draft_title = excluded.draft_title,
            draft_body_ur = excluded.draft_body_ur,
            draft_body_ar = excluded.draft_body_ar,
            current_version = excluded.current_version,
            last_edited_by = excluded.last_edited_by,
            autosaved_at = datetime('now'),
            updated_at = datetime('now')
        `).run(uid(), id, draft_title || q.subject_title_ur || q.subject_title, draft_body_ur || '', draft_body_ar || '', nextVer, req.actor?.profileId || null);

        if (!existingDraft || saveVersion || submitForSeniorReview) {
          const refsSnap = JSON.stringify(db.prepare('SELECT book_name, volume, page_number, arabic_quotation FROM fatwa_references WHERE question_id = ?').all(id));
          db.prepare(`
            INSERT OR REPLACE INTO fatwa_versions (id, question_id, version_number, draft_body_ur, draft_body_ar, references_snapshot, saved_by, saved_by_name, change_summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(uid(), id, nextVer, draft_body_ur || '', draft_body_ar || '', refsSnap, req.actor?.profileId || null, req.actor?.name || 'Author', changeSummary || (submitForSeniorReview ? 'Submitted for Senior Review' : 'Manual version snapshot'));
        }

        let targetStatus = q.workflow_status;
        if (submitForSeniorReview) {
          targetStatus = 'senior_review';
        } else if (['received', 'registered', 'assigned', 'research'].includes(q.workflow_status)) {
          targetStatus = 'draft';
        }

        if (targetStatus !== q.workflow_status) {
          db.prepare("UPDATE fatwa_questions SET workflow_status = ?, updated_at = datetime('now') WHERE id = ?").run(targetStatus, id);
        }

        if (submitForSeniorReview) {
          logAudit(req, 'FATWA_SUBMITTED_FOR_SENIOR_REVIEW', 'fatwa_question', id, { fatwaCode: q.fatwa_code, version: nextVer });
        }
      });
      tx();

      res.json({
        draft: db.prepare('SELECT * FROM fatwa_drafts WHERE question_id = ?').get(id),
        workflow_status: (db.prepare('SELECT workflow_status FROM fatwa_questions WHERE id = ?').get(id) as any).workflow_status,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/fatwa/questions/:id/senior-review', requireRole('admin', 'senior_mufti'), (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      const { decision, comments } = req.body as { decision: 'approved_for_final' | 'corrections_requested' | 'returned'; comments: string };
      if (!['approved_for_final', 'corrections_requested', 'returned'].includes(decision) || !comments?.trim()) {
        return res.status(400).json({ error: 'Valid review decision and comments are required' });
      }
      const q = db.prepare('SELECT * FROM fatwa_questions WHERE id = ?').get(id) as any;
      if (!q) return res.status(404).json({ error: 'Question not found' });
      const draft = db.prepare('SELECT current_version FROM fatwa_drafts WHERE question_id = ?').get(id) as { current_version: number } | undefined;

      const nextStatus = decision === 'approved_for_final' ? 'final_approval' : 'draft';
      const tx = db.transaction(() => {
        db.prepare(`
          INSERT INTO fatwa_reviews (id, question_id, version_number, reviewer_profile_id, reviewer_name, decision, comments)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(uid(), id, draft?.current_version || 1, req.actor!.profileId, req.actor!.name, decision, comments.trim());

        db.prepare("UPDATE fatwa_questions SET workflow_status = ?, updated_at = datetime('now') WHERE id = ?").run(nextStatus, id);
        logAudit(req, 'FATWA_SENIOR_REVIEWED', 'fatwa_question', id, { fatwaCode: q.fatwa_code, decision, nextStatus });
      });
      tx();
      res.json({ updated: true, workflow_status: nextStatus });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/fatwa/questions/:id/final-approval', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      const { decision, comments } = req.body as { decision: 'issued' | 'returned_to_review'; comments?: string };
      const q = db.prepare('SELECT * FROM fatwa_questions WHERE id = ?').get(id) as any;
      if (!q) return res.status(404).json({ error: 'Question not found' });

      // Enforce workflow: Senior Review must precede Final Approval
      const seniorApproved = db.prepare("SELECT 1 FROM fatwa_reviews WHERE question_id = ? AND decision = 'approved_for_final'").get(id);
      if (decision === 'issued' && !seniorApproved && q.workflow_status !== 'final_approval') {
        return res.status(400).json({
          error: 'Senior Mufti review approval is required before Nazim Final Approval and Issuance',
          error_ur: 'حتمی منظوری اور اجراءِ فتویٰ سے پہلے مفتیِ اعظم / سینئر مفتی کی تصدیق لازمی ہے۔',
        });
      }

      const draft = db.prepare('SELECT * FROM fatwa_drafts WHERE question_id = ?').get(id) as any;
      const versionNum = draft?.current_version || 1;

      const tx = db.transaction(() => {
        if (decision === 'issued') {
          const issuedNum = q.issued_fatwa_number || nextIssuedFatwaNumber();
          const nowIso = new Date().toISOString().slice(0, 10);
          db.prepare(`
            INSERT INTO fatwa_approvals (id, question_id, approver_profile_id, approver_name, decision, comments, approved_version, issued_fatwa_number)
            VALUES (?, ?, ?, ?, 'issued', ?, ?, ?)
          `).run(uid(), id, req.actor!.profileId, req.actor!.name, comments || 'Approved and issued by Nazim Dar-ul-Ifta', versionNum, issuedNum);

          db.prepare(`
            UPDATE fatwa_questions
            SET workflow_status = 'issued', issued_fatwa_number = ?, issued_at = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(issuedNum, nowIso, id);

          logAudit(req, 'FATWA_ISSUED', 'fatwa_question', id, { fatwaCode: q.fatwa_code, issuedNum, version: versionNum });
        } else {
          db.prepare(`
            INSERT INTO fatwa_approvals (id, question_id, approver_profile_id, approver_name, decision, comments, approved_version)
            VALUES (?, ?, ?, ?, 'returned_to_review', ?, ?)
          `).run(uid(), id, req.actor!.profileId, req.actor!.name, comments || 'Returned for further review', versionNum);

          db.prepare("UPDATE fatwa_questions SET workflow_status = 'senior_review', updated_at = datetime('now') WHERE id = ?").run(id);
          logAudit(req, 'FATWA_RETURNED_BY_NAZIM', 'fatwa_question', id, { fatwaCode: q.fatwa_code });
        }
      });
      tx();
      res.json(db.prepare('SELECT * FROM fatwa_questions WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/fatwa/questions/:id/publication', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      const { is_published, public_title_ur, public_title_en, public_question_text, public_answer_text } = req.body;
      const q = db.prepare('SELECT * FROM fatwa_questions WHERE id = ?').get(id) as any;
      if (!q) return res.status(404).json({ error: 'Question not found' });
      if (q.workflow_status !== 'issued' && is_published) {
        return res.status(400).json({ error: 'Only issued fatwas can be published to the Public Portal' });
      }

      const tx = db.transaction(() => {
        const pubStatus = is_published ? 'published' : 'internal_only';
        db.prepare("UPDATE fatwa_questions SET publication_status = ?, updated_at = datetime('now') WHERE id = ?").run(pubStatus, id);

        db.prepare(`
          INSERT INTO fatwa_publications (id, question_id, is_published, public_title_ur, public_title_en, public_question_text, public_answer_text, approved_by, published_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END, datetime('now'))
          ON CONFLICT(question_id) DO UPDATE SET
            is_published = excluded.is_published,
            public_title_ur = excluded.public_title_ur,
            public_title_en = excluded.public_title_en,
            public_question_text = excluded.public_question_text,
            public_answer_text = excluded.public_answer_text,
            approved_by = excluded.approved_by,
            published_at = CASE WHEN excluded.is_published = 1 THEN datetime('now') ELSE NULL END,
            updated_at = datetime('now')
        `).run(
          uid(), id, is_published ? 1 : 0,
          public_title_ur || q.subject_title_ur || q.subject_title,
          public_title_en || q.subject_title,
          public_question_text || q.question_text,
          public_answer_text || '',
          req.actor!.profileId,
          is_published ? 1 : 0
        );

        logAudit(req, is_published ? 'FATWA_PUBLISHED_PUBLICLY' : 'FATWA_UNPUBLISHED', 'fatwa_question', id, { fatwaCode: q.fatwa_code, issuedNum: q.issued_fatwa_number });
      });
      tx();
      res.json({ publication_status: is_published ? 'published' : 'internal_only' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/fatwa/archive', (req: SessionRequest, res) => {
    const search = ((req.query.search as string) || '').trim();
    const categoryId = (req.query.categoryId as string) || '';
    const pubStatus = (req.query.publicationStatus as string) || '';
    const wfStatus = (req.query.workflowStatus as string) || '';

    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (req.actor?.role === 'student' || req.actor?.role === 'mufti' || req.actor?.role === 'teacher') {
      where += " AND (fq.workflow_status = 'issued' OR EXISTS (SELECT 1 FROM fatwa_assignments fa WHERE fa.question_id = fq.id AND fa.assignee_profile_id = ? AND fa.is_active = 1))";
      params.push(req.actor.profileId);
    }
    if (search) {
      where += ' AND (fq.fatwa_code LIKE ? OR fq.issued_fatwa_number LIKE ? OR fq.subject_title LIKE ? OR fq.subject_title_ur LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (categoryId) {
      where += ' AND fq.category_id = ?';
      params.push(categoryId);
    }
    if (pubStatus) {
      where += ' AND fq.publication_status = ?';
      params.push(pubStatus);
    }
    if (wfStatus) {
      where += ' AND fq.workflow_status = ?';
      params.push(wfStatus);
    }

    const rows = db.prepare(`
      SELECT fq.*, fc.name_en as category_name_en, fc.name_ur as category_name_ur,
             (SELECT GROUP_CONCAT(p.full_name_ur, '، ') FROM fatwa_assignments fa JOIN profiles p ON p.id = fa.assignee_profile_id WHERE fa.question_id = fq.id AND fa.is_active = 1) as researcher_names_ur,
             (SELECT approver_name FROM fatwa_approvals WHERE question_id = fq.id ORDER BY approved_at DESC LIMIT 1) as approver_name,
             (SELECT reviewer_name FROM fatwa_reviews WHERE question_id = fq.id ORDER BY reviewed_at DESC LIMIT 1) as reviewer_name
      FROM fatwa_questions fq
      JOIN fatwa_categories fc ON fc.id = fq.category_id
      ${where}
      ORDER BY fq.question_date DESC, fq.fatwa_code DESC
    `).all(...params) as any[];

    res.json(rows.map((r) => sanitizeQuestionPrivacy(req, r)));
  });

  // =========================================================================
  // MASTER ADMIN PANEL (PART 1, PART 2, PART 3 & USER PROFILES — ADMIN ONLY)
  // =========================================================================
  app.post('/api/admin/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const accessCode = String(req.body?.accessCode || '').trim();
    const expectedCode = process.env.ADMIN_ACCESS_CODE || 'naafay2026';

    const adminProf = db.prepare(`
      SELECT p.id, p.email, p.full_name, p.full_name_ur, r.name as role_name
      FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.id
      JOIN roles r ON r.id = ur.role_id
      WHERE LOWER(p.email) = ? AND r.name = 'admin' AND p.is_active = 1
      LIMIT 1
    `).get(email) as any;

    if (!adminProf || accessCode !== expectedCode) {
      return res.status(401).json({
        error: 'Invalid admin email or access code.',
        error_ur: 'ایڈمن ای میل یا خفیہ کوڈ درست نہیں ہے۔',
      });
    }

    res.json({
      authenticated: true,
      user: {
        profileId: adminProf.id,
        role: 'admin',
        nameEn: adminProf.full_name,
        nameUr: adminProf.full_name_ur || adminProf.full_name,
        email: adminProf.email,
      },
    });
  });

  app.get('/api/admin/overview', requireRole('admin'), (_req, res) => {
    const academicYears = db.prepare('SELECT * FROM academic_years ORDER BY start_date DESC').all();
    const classes = db.prepare('SELECT * FROM classes ORDER BY level_order ASC, code ASC').all();
    const batches = db.prepare(`
      SELECT b.*, c.name_en as class_name_en, c.name_ur as class_name_ur, ay.title_en as year_title_en, ay.title_ur as year_title_ur
      FROM batches b
      JOIN classes c ON c.id = b.class_id
      JOIN academic_years ay ON ay.id = b.academic_year_id
      ORDER BY c.level_order ASC, b.name_en ASC
    `).all();
    const subjects = db.prepare(`
      SELECT s.*, c.name_en as class_name_en, c.name_ur as class_name_ur
      FROM subjects s
      LEFT JOIN classes c ON c.id = s.class_id
      ORDER BY s.code ASC
    `).all();
    const books = db.prepare(`
      SELECT bk.*, s.name_en as subject_name_en, s.name_ur as subject_name_ur
      FROM books bk
      JOIN subjects s ON s.id = bk.subject_id
      ORDER BY bk.title_en ASC
    `).all();

    const students = db.prepare(`
      SELECT st.*, c.name_en as class_name_en, c.name_ur as class_name_ur
      FROM students st
      LEFT JOIN classes c ON c.id = st.class_id
      ORDER BY st.student_code ASC
    `).all();
    const teachers = db.prepare('SELECT * FROM teachers ORDER BY teacher_code ASC').all();
    const lessons = db.prepare(`
      SELECT lr.*, t.full_name as teacher_name, t.full_name_ur as teacher_name_ur,
             c.name_en as class_name_en, c.name_ur as class_name_ur,
             b.title_en as book_title_en, b.title_ur as book_title_ur
      FROM lesson_records lr
      JOIN teachers t ON t.id = lr.teacher_id
      JOIN classes c ON c.id = lr.class_id
      JOIN books b ON b.id = lr.book_id
      ORDER BY lr.lesson_date DESC
      LIMIT 60
    `).all();
    const exams = db.prepare(`
      SELECT e.*, c.name_en as class_name_en, c.name_ur as class_name_ur
      FROM exams e
      JOIN classes c ON c.id = e.class_id
      ORDER BY e.start_date DESC
    `).all();
    const mutalaLogs = db.prepare(`
      SELECT sl.*, st.student_code, st.full_name as student_name, st.full_name_ur as student_name_ur,
             bk.title_en as book_title_en, bk.title_ur as book_title_ur
      FROM study_logs sl
      JOIN students st ON st.id = sl.student_id
      JOIN books bk ON bk.id = sl.book_id
      ORDER BY sl.study_date DESC
      LIMIT 60
    `).all();
    const researchAssignments = db.prepare(`
      SELECT ra.*, rt.title_en as topic_title_en, rt.title_ur as topic_title_ur, rt.field_of_fiqh,
             st.student_code, st.full_name as student_name, st.full_name_ur as student_name_ur,
             t.full_name as supervisor_name, t.full_name_ur as supervisor_name_ur
      FROM research_assignments ra
      JOIN research_topics rt ON rt.id = ra.topic_id
      JOIN students st ON st.id = ra.student_id
      JOIN teachers t ON t.id = ra.supervisor_teacher_id
      ORDER BY ra.assigned_at DESC
    `).all();

    const fatwaCategories = db.prepare('SELECT * FROM fatwa_categories ORDER BY sort_order ASC, name_en ASC').all();
    const fatwaQuestions = db.prepare(`
      SELECT fq.*, fc.name_en as category_name_en, fc.name_ur as category_name_ur,
             COALESCE(fp.is_published, 0) as is_published,
             fp.public_title_ur, fp.public_title_en, fp.public_question_text, fp.public_answer_text,
             ptt.tracking_number
      FROM fatwa_questions fq
      JOIN fatwa_categories fc ON fc.id = fq.category_id
      LEFT JOIN fatwa_publications fp ON fp.question_id = fq.id
      LEFT JOIN public_tracking_tokens ptt ON ptt.question_id = fq.id
      ORDER BY fq.question_date DESC, fq.created_at DESC
    `).all();

    const publicSubmissions = db.prepare(`
      SELECT ps.*, fq.fatwa_code, fq.subject_title, fq.subject_title_ur, fq.workflow_status, fq.publication_status,
             fq.question_date, fq.city, fq.country, fc.name_en as category_name_en, fc.name_ur as category_name_ur,
             ptt.tracking_number, ptt.mobile_last4
      FROM public_submissions ps
      JOIN fatwa_questions fq ON fq.id = ps.question_id
      JOIN fatwa_categories fc ON fc.id = fq.category_id
      LEFT JOIN public_tracking_tokens ptt ON ptt.id = ps.tracking_token_id
      ORDER BY ps.created_at DESC
      LIMIT 60
    `).all();

    const settingsRow = db.prepare('SELECT * FROM portal_settings LIMIT 1').get() as any;
    let announcements: any[] = [];
    try {
      announcements = settingsRow?.announcements ? JSON.parse(settingsRow.announcements) : [];
    } catch {
      announcements = [];
    }

    const profiles = db.prepare(`
      SELECT p.*, r.id as role_id, r.name as role_name, r.title_en as role_title_en, r.title_ur as role_title_ur
      FROM profiles p
      LEFT JOIN user_roles ur ON ur.user_id = p.id
      LEFT JOIN roles r ON r.id = ur.role_id
      ORDER BY p.created_at ASC
    `).all();
    const roles = db.prepare('SELECT * FROM roles ORDER BY title_en ASC').all();
    const auditLogs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50').all();

    res.json({
      counts: {
        students: students.length,
        teachers: teachers.length,
        classes: classes.length,
        subjects: subjects.length,
        books: books.length,
        exams: exams.length,
        fatwaQuestions: fatwaQuestions.length,
        fatwaCategories: fatwaCategories.length,
        publishedFatwas: fatwaQuestions.filter((q: any) => q.is_published === 1).length,
        publicSubmissions: publicSubmissions.length,
        announcements: announcements.length,
        profiles: profiles.length,
      },
      academicYears,
      classes,
      batches,
      subjects,
      books,
      students,
      teachers,
      lessons,
      exams,
      mutalaLogs,
      researchAssignments,
      fatwaCategories,
      fatwaQuestions,
      publicSubmissions,
      portalSettings: settingsRow || null,
      announcements,
      profiles,
      roles,
      auditLogs,
    });
  });

  // Teachers Delete (Part 1)
  app.delete('/api/teachers/:id', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      const existing = db.prepare('SELECT id, teacher_code, full_name FROM teachers WHERE id = ?').get(id) as any;
      if (!existing) return res.status(404).json({ error: 'Teacher not found' });
      const linkedResearch = db.prepare('SELECT COUNT(*) as c FROM research_assignments WHERE supervisor_teacher_id = ?').get(id) as { c: number };
      if (linkedResearch.c > 0) {
        return res.status(400).json({
          error: 'Cannot delete teacher while supervising active research assignments. Reassign or remove research records first.',
          error_ur: 'اس استاذ کے تحت تحقیقی مقالات تفویض ہیں، حذف کرنے سے پہلے مقالات کی تفویض تبدیل کریں۔',
        });
      }
      db.prepare('DELETE FROM teachers WHERE id = ?').run(id);
      logAudit(req, 'TEACHER_DELETED', 'teacher', id, { teacherCode: existing.teacher_code });
      res.json({ deleted: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Classes & Batches CRUD (Part 1)
  app.post('/api/admin/classes', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      const { code, name_en, name_ur, level_order, description } = req.body;
      if (!code || !name_en || !name_ur) {
        return res.status(400).json({ error: 'Code, English name, and Urdu name are required' });
      }
      const id = uid();
      db.prepare('INSERT INTO classes (id, code, name_en, name_ur, level_order, description, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)')
        .run(id, String(code).trim().toUpperCase(), name_en.trim(), name_ur.trim(), Number(level_order) || 1, description || null);
      logAudit(req, 'ADMIN_CLASS_CREATED', 'class', id, { code });
      res.status(201).json(db.prepare('SELECT * FROM classes WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/classes/:id', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      const existing = db.prepare('SELECT * FROM classes WHERE id = ?').get(id) as any;
      if (!existing) return res.status(404).json({ error: 'Class not found' });
      const b = req.body;
      db.prepare('UPDATE classes SET code = ?, name_en = ?, name_ur = ?, level_order = ?, description = ?, is_active = ? WHERE id = ?')
        .run(
          b.code ? String(b.code).trim().toUpperCase() : existing.code,
          b.name_en ?? existing.name_en,
          b.name_ur ?? existing.name_ur,
          b.level_order !== undefined ? Number(b.level_order) : existing.level_order,
          b.description !== undefined ? b.description : existing.description,
          b.is_active !== undefined ? (b.is_active ? 1 : 0) : existing.is_active,
          id
        );
      logAudit(req, 'ADMIN_CLASS_UPDATED', 'class', id, {});
      res.json(db.prepare('SELECT * FROM classes WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/admin/classes/:id', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      const stuCount = db.prepare('SELECT COUNT(*) as c FROM students WHERE class_id = ?').get(id) as { c: number };
      if (stuCount.c > 0) {
        return res.status(400).json({
          error: 'Cannot delete a class that has enrolled students.',
          error_ur: 'اس درجہ میں طلبہ موجود ہیں، اس لیے اسے حذف نہیں کیا جا سکتا۔',
        });
      }
      db.prepare('DELETE FROM classes WHERE id = ?').run(id);
      logAudit(req, 'ADMIN_CLASS_DELETED', 'class', id, {});
      res.json({ deleted: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/batches', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      const { class_id, academic_year_id, name_en, name_ur, capacity } = req.body;
      if (!class_id || !name_en || !name_ur) {
        return res.status(400).json({ error: 'Class and batch names are required' });
      }
      const id = uid();
      db.prepare('INSERT INTO batches (id, class_id, academic_year_id, name_en, name_ur, capacity, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)')
        .run(id, class_id, academic_year_id || 'ay-1447', name_en.trim(), name_ur.trim(), Number(capacity) || 30);
      logAudit(req, 'ADMIN_BATCH_CREATED', 'batch', id, { name_en });
      res.status(201).json(db.prepare('SELECT * FROM batches WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/admin/batches/:id', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      db.prepare('UPDATE students SET batch_id = NULL WHERE batch_id = ?').run(req.params.id);
      db.prepare('DELETE FROM batches WHERE id = ?').run(req.params.id);
      logAudit(req, 'ADMIN_BATCH_DELETED', 'batch', req.params.id, {});
      res.json({ deleted: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Subjects & Books CRUD (Part 1)
  app.post('/api/admin/subjects', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      const { code, name_en, name_ur, class_id } = req.body;
      if (!code || !name_en || !name_ur) return res.status(400).json({ error: 'Code, English name, and Urdu name are required' });
      const id = uid();
      db.prepare('INSERT INTO subjects (id, code, name_en, name_ur, class_id, is_active) VALUES (?, ?, ?, ?, ?, 1)')
        .run(id, String(code).trim().toUpperCase(), name_en.trim(), name_ur.trim(), class_id || null);
      logAudit(req, 'ADMIN_SUBJECT_CREATED', 'subject', id, { code });
      res.status(201).json(db.prepare('SELECT * FROM subjects WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/subjects/:id', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      const existing = db.prepare('SELECT * FROM subjects WHERE id = ?').get(id) as any;
      if (!existing) return res.status(404).json({ error: 'Subject not found' });
      const b = req.body;
      db.prepare('UPDATE subjects SET code = ?, name_en = ?, name_ur = ?, class_id = ?, is_active = ? WHERE id = ?')
        .run(
          b.code ? String(b.code).trim().toUpperCase() : existing.code,
          b.name_en ?? existing.name_en,
          b.name_ur ?? existing.name_ur,
          b.class_id !== undefined ? (b.class_id || null) : existing.class_id,
          b.is_active !== undefined ? (b.is_active ? 1 : 0) : existing.is_active,
          id
        );
      res.json(db.prepare('SELECT * FROM subjects WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/admin/subjects/:id', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      db.prepare('DELETE FROM subjects WHERE id = ?').run(req.params.id);
      logAudit(req, 'ADMIN_SUBJECT_DELETED', 'subject', req.params.id, {});
      res.json({ deleted: true });
    } catch (err: any) {
      res.status(400).json({ error: 'Subject is referenced by existing lessons, exams, or books. Remove dependent records first.' });
    }
  });

  app.post('/api/admin/books', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      const { subject_id, title_en, title_ur, author, total_pages, total_chapters } = req.body;
      if (!subject_id || !title_en || !title_ur) return res.status(400).json({ error: 'Subject and book titles are required' });
      const id = uid();
      db.prepare('INSERT INTO books (id, subject_id, title_en, title_ur, author, total_pages, total_chapters) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, subject_id, title_en.trim(), title_ur.trim(), author || null, Number(total_pages) || 0, Number(total_chapters) || 0);
      logAudit(req, 'ADMIN_BOOK_CREATED', 'book', id, { title_en });
      res.status(201).json(db.prepare('SELECT * FROM books WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/books/:id', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      const existing = db.prepare('SELECT * FROM books WHERE id = ?').get(id) as any;
      if (!existing) return res.status(404).json({ error: 'Book not found' });
      const b = req.body;
      db.prepare('UPDATE books SET subject_id = ?, title_en = ?, title_ur = ?, author = ?, total_pages = ?, total_chapters = ? WHERE id = ?')
        .run(
          b.subject_id ?? existing.subject_id,
          b.title_en ?? existing.title_en,
          b.title_ur ?? existing.title_ur,
          b.author !== undefined ? b.author : existing.author,
          b.total_pages !== undefined ? Number(b.total_pages) : existing.total_pages,
          b.total_chapters !== undefined ? Number(b.total_chapters) : existing.total_chapters,
          id
        );
      res.json(db.prepare('SELECT * FROM books WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/admin/books/:id', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
      logAudit(req, 'ADMIN_BOOK_DELETED', 'book', req.params.id, {});
      res.json({ deleted: true });
    } catch {
      res.status(400).json({ error: 'Book is referenced by study logs or lessons and cannot be deleted.' });
    }
  });

  // Lessons, Exams, Mutala, Research Admin Edit/Delete (Part 1)
  app.put('/api/admin/lessons/:id', requireRole('admin'), (req: SessionRequest, res) => {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM lesson_records WHERE id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ error: 'Lesson not found' });
    const b = req.body;
    db.prepare('UPDATE lesson_records SET lesson_date = ?, start_position = ?, end_position = ?, homework = ?, remarks = ? WHERE id = ?')
      .run(b.lesson_date ?? existing.lesson_date, b.start_position ?? existing.start_position, b.end_position ?? existing.end_position, b.homework ?? existing.homework, b.remarks ?? existing.remarks, id);
    res.json(db.prepare('SELECT * FROM lesson_records WHERE id = ?').get(id));
  });

  app.delete('/api/admin/lessons/:id', requireRole('admin'), (req: SessionRequest, res) => {
    db.prepare('DELETE FROM lesson_records WHERE id = ?').run(req.params.id);
    logAudit(req, 'ADMIN_LESSON_DELETED', 'lesson', req.params.id, {});
    res.json({ deleted: true });
  });

  app.put('/api/admin/exams/:id', requireRole('admin'), (req: SessionRequest, res) => {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM exams WHERE id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ error: 'Exam not found' });
    const b = req.body;
    db.prepare('UPDATE exams SET title_en = ?, title_ur = ?, exam_type = ?, start_date = ?, end_date = ?, status = ? WHERE id = ?')
      .run(b.title_en ?? existing.title_en, b.title_ur ?? existing.title_ur, b.exam_type ?? existing.exam_type, b.start_date ?? existing.start_date, b.end_date ?? existing.end_date, b.status ?? existing.status, id);
    res.json(db.prepare('SELECT * FROM exams WHERE id = ?').get(id));
  });

  app.delete('/api/admin/exams/:id', requireRole('admin'), (req: SessionRequest, res) => {
    db.prepare('DELETE FROM exams WHERE id = ?').run(req.params.id);
    logAudit(req, 'ADMIN_EXAM_DELETED', 'exam', req.params.id, {});
    res.json({ deleted: true });
  });

  app.delete('/api/admin/mutala/:id', requireRole('admin'), (req: SessionRequest, res) => {
    db.prepare('DELETE FROM study_logs WHERE id = ?').run(req.params.id);
    logAudit(req, 'ADMIN_MUTALA_DELETED', 'study_log', req.params.id, {});
    res.json({ deleted: true });
  });

  app.delete('/api/admin/research-assignments/:id', requireRole('admin'), (req: SessionRequest, res) => {
    db.prepare('DELETE FROM research_assignments WHERE id = ?').run(req.params.id);
    logAudit(req, 'ADMIN_RESEARCH_DELETED', 'research_assignment', req.params.id, {});
    res.json({ deleted: true });
  });

  // Dar-ul-Ifta Questions & Categories Admin Edit/Delete (Part 2)
  app.put('/api/admin/fatwa/questions/:id', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      const existing = db.prepare('SELECT * FROM fatwa_questions WHERE id = ?').get(id) as any;
      if (!existing) return res.status(404).json({ error: 'Question not found' });
      const b = req.body;
      db.prepare(`
        UPDATE fatwa_questions
        SET questioner_name = ?, questioner_phone = ?, questioner_email = ?,
            city = ?, country = ?, category_id = ?,
            subject_title = ?, subject_title_ur = ?, question_text = ?,
            is_identity_private = ?, workflow_status = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(
        b.questioner_name ?? existing.questioner_name,
        b.questioner_phone !== undefined ? b.questioner_phone : existing.questioner_phone,
        b.questioner_email !== undefined ? b.questioner_email : existing.questioner_email,
        b.city !== undefined ? b.city : existing.city,
        b.country ?? existing.country,
        b.category_id ?? existing.category_id,
        b.subject_title ?? existing.subject_title,
        b.subject_title_ur ?? existing.subject_title_ur,
        b.question_text ?? existing.question_text,
        b.is_identity_private !== undefined ? (b.is_identity_private ? 1 : 0) : existing.is_identity_private,
        b.workflow_status ?? existing.workflow_status,
        id
      );
      logAudit(req, 'ADMIN_FATWA_UPDATED', 'fatwa_question', id, { fatwaCode: existing.fatwa_code });
      res.json(db.prepare('SELECT * FROM fatwa_questions WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/admin/fatwa/questions/:id', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      const existing = db.prepare('SELECT fatwa_code FROM fatwa_questions WHERE id = ?').get(id) as any;
      if (!existing) return res.status(404).json({ error: 'Question not found' });
      const tx = db.transaction(() => {
        db.prepare('DELETE FROM public_submissions WHERE question_id = ?').run(id);
        db.prepare('DELETE FROM public_tracking_tokens WHERE question_id = ?').run(id);
        db.prepare('DELETE FROM fatwa_attachments WHERE question_id = ?').run(id);
        db.prepare('DELETE FROM fatwa_publications WHERE question_id = ?').run(id);
        db.prepare('DELETE FROM fatwa_approvals WHERE question_id = ?').run(id);
        db.prepare('DELETE FROM fatwa_reviews WHERE question_id = ?').run(id);
        db.prepare('DELETE FROM fatwa_versions WHERE question_id = ?').run(id);
        db.prepare('DELETE FROM fatwa_drafts WHERE question_id = ?').run(id);
        db.prepare('DELETE FROM fatwa_references WHERE question_id = ?').run(id);
        db.prepare('DELETE FROM fatwa_research WHERE question_id = ?').run(id);
        db.prepare('DELETE FROM fatwa_assignments WHERE question_id = ?').run(id);
        db.prepare('DELETE FROM fatwa_questions WHERE id = ?').run(id);
        logAudit(req, 'ADMIN_FATWA_DELETED', 'fatwa_question', id, { fatwaCode: existing.fatwa_code });
      });
      tx();
      res.json({ deleted: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/admin/fatwa/categories/:id', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      const cnt = db.prepare('SELECT COUNT(*) as c FROM fatwa_questions WHERE category_id = ?').get(id) as { c: number };
      if (cnt.c > 0) {
        return res.status(400).json({
          error: 'Cannot delete category with existing Fatwa questions. Deactivate it or reassign questions first.',
          error_ur: 'اس شعبہ میں سوالات موجود ہیں؛ اسے حذف کرنے کے بجائے غیر فعال کریں یا سوالات منتقل کریں۔',
        });
      }
      db.prepare('DELETE FROM fatwa_categories WHERE id = ?').run(id);
      logAudit(req, 'ADMIN_FATWA_CATEGORY_DELETED', 'fatwa_category', id, {});
      res.json({ deleted: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public Portal Settings & Announcements CMS (Part 3)
  app.put('/api/admin/portal-settings', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      const existing = db.prepare('SELECT * FROM portal_settings LIMIT 1').get() as any;
      if (!existing) return res.status(404).json({ error: 'Portal settings not initialized' });
      const b = req.body;
      db.prepare(`
        UPDATE portal_settings
        SET institution_name_en = ?, institution_name_ur = ?,
            nazim_name_en = ?, nazim_name_ur = ?,
            welcome_title_en = ?, welcome_title_ur = ?,
            welcome_body_en = ?, welcome_body_ur = ?,
            contact_phone = ?, contact_whatsapp = ?, contact_email = ?,
            contact_address_en = ?, contact_address_ur = ?,
            allow_optional_email = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(
        b.institution_name_en ?? existing.institution_name_en,
        b.institution_name_ur ?? existing.institution_name_ur,
        b.nazim_name_en ?? existing.nazim_name_en,
        b.nazim_name_ur ?? existing.nazim_name_ur,
        b.welcome_title_en ?? existing.welcome_title_en,
        b.welcome_title_ur ?? existing.welcome_title_ur,
        b.welcome_body_en ?? existing.welcome_body_en,
        b.welcome_body_ur ?? existing.welcome_body_ur,
        b.contact_phone !== undefined ? b.contact_phone : existing.contact_phone,
        b.contact_whatsapp !== undefined ? b.contact_whatsapp : existing.contact_whatsapp,
        b.contact_email !== undefined ? b.contact_email : existing.contact_email,
        b.contact_address_en !== undefined ? b.contact_address_en : existing.contact_address_en,
        b.contact_address_ur !== undefined ? b.contact_address_ur : existing.contact_address_ur,
        b.allow_optional_email !== undefined ? (b.allow_optional_email ? 1 : 0) : existing.allow_optional_email,
        existing.id
      );
      logAudit(req, 'ADMIN_PORTAL_SETTINGS_UPDATED', 'portal_settings', existing.id, {});
      res.json(db.prepare('SELECT * FROM portal_settings WHERE id = ?').get(existing.id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/announcements', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      const existing = db.prepare('SELECT id FROM portal_settings LIMIT 1').get() as any;
      if (!existing) return res.status(404).json({ error: 'Portal settings not initialized' });
      const list = Array.isArray(req.body?.announcements) ? req.body.announcements : [];
      db.prepare("UPDATE portal_settings SET announcements = ?, updated_at = datetime('now') WHERE id = ?")
        .run(JSON.stringify(list), existing.id);
      logAudit(req, 'ADMIN_ANNOUNCEMENTS_UPDATED', 'portal_settings', existing.id, { count: list.length });
      res.json({ announcements: list });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Staff / User Profiles Management (Unified RBAC)
  app.post('/api/admin/profiles', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      const { email, full_name, full_name_ur, phone, role_name } = req.body;
      if (!email || !full_name || !role_name) {
        return res.status(400).json({ error: 'Email, full name, and role are required' });
      }
      const roleRow = db.prepare('SELECT id FROM roles WHERE name = ?').get(role_name) as { id: string } | undefined;
      if (!roleRow) return res.status(400).json({ error: 'Invalid role' });
      const id = uid();
      const tx = db.transaction(() => {
        db.prepare('INSERT INTO profiles (id, email, full_name, full_name_ur, phone, preferred_language, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)')
          .run(id, email.trim().toLowerCase(), full_name.trim(), (full_name_ur || full_name).trim(), phone || null, 'ur');
        db.prepare('INSERT INTO user_roles (id, user_id, role_id, assigned_by) VALUES (?, ?, ?, ?)')
          .run(uid(), id, roleRow.id, req.actor!.profileId);
        logAudit(req, 'ADMIN_PROFILE_CREATED', 'profile', id, { email, role_name });
      });
      tx();
      res.status(201).json(db.prepare('SELECT * FROM profiles WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/profiles/:id', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      const existing = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as any;
      if (!existing) return res.status(404).json({ error: 'Profile not found' });
      const b = req.body;
      const tx = db.transaction(() => {
        db.prepare("UPDATE profiles SET email = ?, full_name = ?, full_name_ur = ?, phone = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?")
          .run(
            b.email ? b.email.trim().toLowerCase() : existing.email,
            b.full_name ?? existing.full_name,
            b.full_name_ur ?? existing.full_name_ur,
            b.phone !== undefined ? b.phone : existing.phone,
            b.is_active !== undefined ? (b.is_active ? 1 : 0) : existing.is_active,
            id
          );
        if (b.role_name) {
          const roleRow = db.prepare('SELECT id FROM roles WHERE name = ?').get(b.role_name) as { id: string } | undefined;
          if (roleRow) {
            db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(id);
            db.prepare('INSERT INTO user_roles (id, user_id, role_id, assigned_by) VALUES (?, ?, ?, ?)').run(uid(), id, roleRow.id, req.actor!.profileId);
          }
        }
        logAudit(req, 'ADMIN_PROFILE_UPDATED', 'profile', id, {});
      });
      tx();
      res.json(db.prepare('SELECT * FROM profiles WHERE id = ?').get(id));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/admin/profiles/:id', requireRole('admin'), (req: SessionRequest, res) => {
    try {
      const { id } = req.params;
      if (id === 'prof-admin') {
        return res.status(400).json({
          error: 'Primary Nazim Dar-ul-Ifta admin account cannot be deleted.',
          error_ur: 'مرکزی ناظم دارالافتاء کا ایڈمن اکاؤنٹ حذف نہیں کیا جا سکتا۔',
        });
      }
      db.prepare('DELETE FROM profiles WHERE id = ?').run(id);
      logAudit(req, 'ADMIN_PROFILE_DELETED', 'profile', id, {});
      res.json({ deleted: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =========================================================================
  // PART 3: PUBLIC ONLINE FATWA PORTAL (UNAUTHENTICATED, STRICTLY SCOPED)
  // =========================================================================

  const publicRateStore = new Map<string, number[]>();
  function enforcePublicRateLimit(req: Request, res: Response, bucket: string, maxRequests: number, windowMs: number): boolean {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const key = `${bucket}:${ip}`;
    const now = Date.now();
    const hits = (publicRateStore.get(key) || []).filter((t) => now - t < windowMs);
    if (hits.length >= maxRequests) {
      res.status(429).json({
        error: 'Too many requests. Please wait a moment and try again.',
        error_ur: 'بہت زیادہ درخواستیں موصول ہوئی ہیں۔ براہِ کرم کچھ لمحے انتظار کے بعد دوبارہ کوشش کریں۔',
      });
      return false;
    }
    hits.push(now);
    publicRateStore.set(key, hits);
    return true;
  }

  function mapPublicTrackingStage(wfStatus: string) {
    switch (wfStatus) {
      case 'received':
      case 'registered':
        return 'received';
      case 'assigned':
        return 'under_review';
      case 'research':
        return 'research_in_progress';
      case 'draft':
      case 'senior_review':
      case 'final_approval':
        return 'answer_preparation';
      case 'issued':
        return 'completed';
      default:
        return 'received';
    }
  }

  function generateVerificationCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
      out += chars[bytes[i] % chars.length];
    }
    return out;
  }

  // Strict Public File Upload Validator (Images & PDF only, max 5MB)
  app.post('/api/public/uploads', (req, res) => {
    if (!enforcePublicRateLimit(req, res, 'public_upload', 15, 10 * 60 * 1000)) return;
    try {
      const { fileName, dataUrl } = req.body as { fileName?: string; dataUrl?: string };
      if (!fileName || !dataUrl) {
        return res.status(400).json({ error: 'fileName and dataUrl are required' });
      }
      const allowedExt = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
      const allowedMime = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      const ext = path.extname(fileName).toLowerCase();
      if (!allowedExt.includes(ext)) {
        return res.status(400).json({
          error: 'Only PDF, JPG, PNG, or WEBP files are permitted.',
          error_ur: 'صرف PDF، JPG، PNG یا WEBP فائلیں منسلک کرنے کی اجازت ہے۔',
        });
      }
      const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
      if (!match || !allowedMime.includes(match[1].toLowerCase())) {
        return res.status(400).json({
          error: 'Invalid or unsupported file format.',
          error_ur: 'فائل کی قسم غیر مجاز ہے۔',
        });
      }
      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({
          error: 'File size exceeds 5 MB limit.',
          error_ur: 'فائل کا حجم ۵ ایم بی سے زیادہ نہیں ہونا چاہیے۔',
        });
      }
      const base = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
      const storedName = `pub_${Date.now()}_${base}${ext}`;
      fs.writeFileSync(path.join(uploadsDir, storedName), buffer);
      res.json({
        fileName: path.basename(fileName),
        storedName,
        fileUrl: `/api/uploads/${storedName}`,
        size: buffer.length,
        mimeType: match[1].toLowerCase(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public Homepage Portal Data
  app.get('/api/public/portal-data', (_req, res) => {
    const settings = db.prepare('SELECT * FROM portal_settings LIMIT 1').get() as any;
    const categories = db.prepare(`
      SELECT fc.id, fc.code, fc.name_en, fc.name_ur, fc.name_ar, fc.sort_order,
        (
          SELECT COUNT(*)
          FROM fatwa_questions fq
          JOIN fatwa_publications fp ON fp.question_id = fq.id
          WHERE fq.category_id = fc.id
            AND fq.workflow_status = 'issued'
            AND fq.publication_status = 'published'
            AND fp.is_published = 1
        ) as published_count
      FROM fatwa_categories fc
      WHERE fc.is_active = 1
      ORDER BY fc.sort_order ASC
    `).all();

    const recentFatwas = db.prepare(`
      SELECT fq.id, fq.issued_fatwa_number, fq.question_date, fq.issued_at,
             fc.code as category_code, fc.name_en as category_name_en, fc.name_ur as category_name_ur,
             fp.public_title_ur, fp.public_title_en, fp.public_question_text, fp.published_at
      FROM fatwa_publications fp
      JOIN fatwa_questions fq ON fq.id = fp.question_id
      JOIN fatwa_categories fc ON fc.id = fq.category_id
      WHERE fp.is_published = 1
        AND fq.workflow_status = 'issued'
        AND fq.publication_status = 'published'
      ORDER BY COALESCE(fp.published_at, fq.issued_at) DESC
      LIMIT 6
    `).all();

    let announcements: any[] = [];
    try {
      announcements = settings?.announcements ? JSON.parse(settings.announcements) : [];
    } catch {
      announcements = [];
    }

    res.json({
      settings: settings
        ? {
            institution_name_en: settings.institution_name_en,
            institution_name_ur: settings.institution_name_ur,
            nazim_name_en: settings.nazim_name_en,
            nazim_name_ur: settings.nazim_name_ur,
            welcome_title_en: settings.welcome_title_en,
            welcome_title_ur: settings.welcome_title_ur,
            welcome_body_en: settings.welcome_body_en,
            welcome_body_ur: settings.welcome_body_ur,
            contact_phone: settings.contact_phone,
            contact_whatsapp: settings.contact_whatsapp,
            contact_email: settings.contact_email,
            contact_address_en: settings.contact_address_en,
            contact_address_ur: settings.contact_address_ur,
            allow_optional_email: Boolean(settings.allow_optional_email),
          }
        : null,
      announcements,
      categories,
      recentFatwas,
    });
  });

  // Public Question Submission (No Login Required; saved to shared fatwa_questions)
  app.post('/api/public/questions', (req, res) => {
    if (!enforcePublicRateLimit(req, res, 'public_submit', 12, 15 * 60 * 1000)) return;
    try {
      const b = req.body || {};

      // Honeypot bot guard
      if (b.website && String(b.website).trim() !== '') {
        return res.status(400).json({ error: 'Submission rejected' });
      }

      const fullName = String(b.full_name || '').trim();
      const mobile = String(b.mobile || '').trim();
      const email = String(b.email || '').trim();
      const country = String(b.country || '').trim();
      const city = String(b.city || '').trim();
      const categoryId = String(b.category_id || '').trim();
      const questionText = String(b.question_text || '').trim();
      const subjectTitle = String(b.subject_title || '').trim();
      const consent = Boolean(b.consent);

      const mobileDigits = normalizePhoneDigits(mobile);

      if (!fullName || fullName.length < 2) {
        return res.status(400).json({ error: 'Full name is required', error_ur: 'مکمل نام درج کرنا ضروری ہے۔' });
      }
      if (mobileDigits.length < 7) {
        return res.status(400).json({ error: 'Valid mobile number is required', error_ur: 'درست موبائل نمبر درج کرنا ضروری ہے۔' });
      }
      if (!country || !city) {
        return res.status(400).json({ error: 'Country and city are required', error_ur: 'ملک اور شہر کا نام درج کرنا ضروری ہے۔' });
      }
      if (!categoryId) {
        return res.status(400).json({ error: 'Question category is required', error_ur: 'سوال کا شعبہ (کیٹیگری) منتخب کریں۔' });
      }
      if (!questionText || questionText.length < 15) {
        return res.status(400).json({
          error: 'Please enter a complete question (minimum 15 characters)',
          error_ur: 'براہِ کرم مکمل سوال تفصیل سے تحریر کریں (کم از کم ۱۵ حروف)۔',
        });
      }
      if (!consent) {
        return res.status(400).json({
          error: 'Privacy and submission confirmation is required',
          error_ur: 'رازداری اور شرائط کی تصدیق لازمی ہے۔',
        });
      }

      // Verify category exists and is active
      const cat = db.prepare('SELECT id, name_en, name_ur FROM fatwa_categories WHERE id = ? AND is_active = 1').get(categoryId) as any;
      if (!cat) {
        return res.status(400).json({ error: 'Selected category is invalid' });
      }

      // Simple spam link count heuristic
      const linkMatches = (questionText.match(/https?:\/\//gi) || []).length;
      if (linkMatches > 2) {
        return res.status(400).json({
          error: 'Too many URLs in question text.',
          error_ur: 'سوال میں غیر ضروری ویب لنکس کی اجازت نہیں ہے۔',
        });
      }

      const derivedTitle = subjectTitle || questionText.split(/\r?\n/)[0].slice(0, 90);
      const questionId = uid();
      const fatwaCode = nextFatwaCode();
      const trackingNumber = nextTrackingNumber();
      const verificationCode = generateVerificationCode();
      const tokenId = uid();
      const today = new Date().toISOString().slice(0, 10);
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

      const tx = db.transaction(() => {
        db.prepare(`
          INSERT INTO fatwa_questions (
            id, fatwa_code, question_date, questioner_name, questioner_phone, questioner_email,
            city, country, category_id, subject_title, subject_title_ur, question_text,
            is_identity_private, allow_public_identity, source, workflow_status, publication_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 'public_portal', 'registered', 'internal_only')
        `).run(
          questionId,
          fatwaCode,
          today,
          fullName,
          mobile,
          email || null,
          city,
          country,
          categoryId,
          derivedTitle,
          derivedTitle,
          questionText
        );

        db.prepare(`
          INSERT INTO public_tracking_tokens (id, question_id, tracking_number, verification_code_hash, mobile_hash, mobile_last4)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          tokenId,
          questionId,
          trackingNumber,
          sha256(verificationCode.toUpperCase()),
          sha256(mobileDigits),
          mobileDigits.slice(-4)
        );

        db.prepare(`
          INSERT INTO public_submissions (id, question_id, tracking_token_id, ip_hash, user_agent, consent_accepted, spam_score, status)
          VALUES (?, ?, ?, ?, ?, 1, ?, 'accepted')
        `).run(uid(), questionId, tokenId, sha256(ip), String(req.headers['user-agent'] || '').slice(0, 180), linkMatches);

        if (Array.isArray(b.attachments)) {
          const insAtt = db.prepare(
            'INSERT INTO fatwa_attachments (id, question_id, title, file_name, file_url, mime_type, file_size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)'
          );
          for (const att of b.attachments.slice(0, 5)) {
            if (att?.fileUrl && String(att.fileUrl).startsWith('/api/uploads/')) {
              insAtt.run(uid(), questionId, att.fileName || 'Supporting Document', att.fileName || 'document', att.fileUrl, att.mimeType || 'application/octet-stream', att.size || 0);
            }
          }
        }

        db.prepare(
          'INSERT INTO audit_logs (id, actor_profile_id, actor_name, actor_role, action, entity_type, entity_id, details) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)'
        ).run(uid(), 'Public Portal Visitor', 'public', 'PUBLIC_QUESTION_SUBMITTED', 'fatwa_question', questionId, JSON.stringify({ fatwaCode, trackingNumber }));
      });
      tx();

      res.status(201).json({
        success: true,
        tracking_number: trackingNumber,
        verification_code: verificationCode,
        submitted_date: today,
        category_name_en: cat.name_en,
        category_name_ur: cat.name_ur,
        message_ur: 'آپ کا استفتاء کامیابی سے دارالافتاء میں موصول ہو گیا ہے۔ براہِ کرم ٹریکنگ نمبر اور تصدیقی کوڈ محفوظ فرما لیں۔',
        message_en: 'Your question has been received by Dar-ul-Ifta. Please save your Tracking Number and Verification Code.',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public Question Tracking (Requires Tracking Number + 2nd Factor: Mobile Number OR Verification Code)
  app.post('/api/public/track', (req, res) => {
    if (!enforcePublicRateLimit(req, res, 'public_track', 25, 10 * 60 * 1000)) return;
    const trackingNumber = String(req.body?.tracking_number || '').trim().toUpperCase();
    const verificationFactor = String(req.body?.verification_factor || '').trim();

    if (!trackingNumber || !verificationFactor) {
      return res.status(400).json({
        error: 'Tracking number and mobile number or verification code are required.',
        error_ur: 'ٹریکنگ نمبر اور رجسٹرڈ موبائل نمبر یا تصدیقی کوڈ درج کرنا ضروری ہے۔',
      });
    }

    const codeHash = sha256(verificationFactor.toUpperCase());
    const cleanMobile = normalizePhoneDigits(verificationFactor);
    const mobileHash = cleanMobile.length >= 7 ? sha256(cleanMobile) : '';

    const row = db.prepare(`
      SELECT ptt.tracking_number, fq.question_date, fq.workflow_status, fq.publication_status, fq.issued_fatwa_number, fq.issued_at,
             fc.name_en as category_name_en, fc.name_ur as category_name_ur,
             COALESCE(fp.is_published, 0) as is_published
      FROM public_tracking_tokens ptt
      JOIN fatwa_questions fq ON fq.id = ptt.question_id
      JOIN fatwa_categories fc ON fc.id = fq.category_id
      LEFT JOIN fatwa_publications fp ON fp.question_id = fq.id
      WHERE UPPER(ptt.tracking_number) = ?
        AND (ptt.verification_code_hash = ? OR (? <> '' AND ptt.mobile_hash = ?))
    `).get(trackingNumber, codeHash, mobileHash, mobileHash) as any;

    if (!row) {
      return res.status(404).json({
        error: 'No matching question found. Please verify your tracking number and mobile/verification code.',
        error_ur: 'درج کردہ ٹریکنگ نمبر یا تصدیقی تفصیل درست نہیں ہے۔ براہِ کرم دوبارہ چیک کریں۔',
      });
    }

    const isPubliclyVisible = row.workflow_status === 'issued' && row.publication_status === 'published' && row.is_published === 1;
    const publicStage = mapPublicTrackingStage(row.workflow_status);

    // Strictly limited status response: never expose questioner info, question text, internal notes, drafts, or staff comments
    res.json({
      tracking_number: row.tracking_number,
      public_stage: publicStage,
      submitted_date: row.question_date,
      category_name_en: row.category_name_en,
      category_name_ur: row.category_name_ur,
      issued_date: row.workflow_status === 'issued' ? row.issued_at : null,
      is_published: isPubliclyVisible,
      issued_fatwa_number: isPubliclyVisible ? row.issued_fatwa_number : null,
    });
  });

  // Searchable Public Fatwa Library (ONLY explicitly published records)
  app.get('/api/public/fatwas', (req, res) => {
    const q = String(req.query.q || '').trim();
    const category = String(req.query.category || '').trim();
    const dateFrom = String(req.query.dateFrom || '').trim();
    const dateTo = String(req.query.dateTo || '').trim();

    let where = "WHERE fp.is_published = 1 AND fq.workflow_status = 'issued' AND fq.publication_status = 'published'";
    const params: any[] = [];

    if (q) {
      const like = `%${q}%`;
      where += ' AND (fq.issued_fatwa_number LIKE ? OR fp.public_title_ur LIKE ? OR fp.public_title_en LIKE ? OR fp.public_question_text LIKE ? OR fp.public_answer_text LIKE ?)';
      params.push(like, like, like, like, like);
    }
    if (category) {
      where += ' AND (fc.code = ? OR fc.id = ?)';
      params.push(category.toUpperCase(), category);
    }
    if (dateFrom) {
      where += ' AND COALESCE(substr(fp.published_at, 1, 10), fq.issued_at) >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      where += ' AND COALESCE(substr(fp.published_at, 1, 10), fq.issued_at) <= ?';
      params.push(dateTo);
    }

    const rows = db.prepare(`
      SELECT fq.id, fq.issued_fatwa_number, fq.question_date, fq.issued_at,
             fc.id as category_id, fc.code as category_code, fc.name_en as category_name_en, fc.name_ur as category_name_ur,
             fp.public_title_ur, fp.public_title_en, fp.public_question_text, fp.public_answer_text, fp.published_at
      FROM fatwa_publications fp
      JOIN fatwa_questions fq ON fq.id = fp.question_id
      JOIN fatwa_categories fc ON fc.id = fq.category_id
      ${where}
      ORDER BY COALESCE(fp.published_at, fq.issued_at) DESC, fq.issued_fatwa_number DESC
    `).all(...params);

    res.json(rows);
  });

  // Public Fatwa Detail Page (by Issued Fatwa Number or Question ID; ONLY if published)
  app.get('/api/public/fatwas/:identifier', (req, res) => {
    const idOrNum = decodeURIComponent(req.params.identifier).trim();
    const row = db.prepare(`
      SELECT fq.id, fq.issued_fatwa_number, fq.question_date, fq.issued_at,
             fc.id as category_id, fc.code as category_code, fc.name_en as category_name_en, fc.name_ur as category_name_ur, fc.name_ar as category_name_ar,
             fp.public_title_ur, fp.public_title_en, fp.public_question_text, fp.public_answer_text, fp.published_at
      FROM fatwa_publications fp
      JOIN fatwa_questions fq ON fq.id = fp.question_id
      JOIN fatwa_categories fc ON fc.id = fq.category_id
      WHERE fp.is_published = 1
        AND fq.workflow_status = 'issued'
        AND fq.publication_status = 'published'
        AND (UPPER(fq.issued_fatwa_number) = UPPER(?) OR fq.id = ?)
    `).get(idOrNum, idOrNum) as any;

    if (!row) {
      return res.status(404).json({
        error: 'Fatwa not found or not published for public viewing.',
        error_ur: 'مطلوبہ فتویٰ دستیاب نہیں یا عوامی اشاعت کے لیے شائع نہیں کیا گیا۔',
      });
    }

    // Include classical references (excluding internal staff notes)
    const references = db.prepare(`
      SELECT id, book_name, author, volume, page_number, chapter, arabic_quotation, explanation
      FROM fatwa_references
      WHERE question_id = ?
      ORDER BY created_at ASC
    `).all(row.id);

    const settings = db.prepare('SELECT institution_name_en, institution_name_ur, nazim_name_en, nazim_name_ur FROM portal_settings LIMIT 1').get() as any;

    res.json({
      ...row,
      references,
      institution: settings || {
        institution_name_en: 'Naafay Dar-ul-Ifta',
        institution_name_ur: 'نافع دارالافتاء',
        nazim_name_en: 'Mufti Waris Naseeb',
        nazim_name_ur: 'مفتی وارث نصیب',
      },
    });
  });

  // Dynamic SEO: robots.txt & sitemap.xml (Index only public & published routes; exclude private/tracking/staff)
  app.get('/robots.txt', (req, res) => {
    const baseUrl = process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
      ? process.env.APP_URL.replace(/\/$/, '')
      : `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(
      [
        'User-agent: *',
        'Allow: /',
        'Allow: /ask',
        'Allow: /fatwas',
        'Allow: /fatwa/',
        'Allow: /category/',
        'Disallow: /track',
        'Disallow: /staff',
        'Disallow: /api/',
        `Sitemap: ${baseUrl}/sitemap.xml`,
      ].join('\n')
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const baseUrl = process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
      ? process.env.APP_URL.replace(/\/$/, '')
      : `${req.protocol}://${req.get('host')}`;

    const cats = db.prepare('SELECT code FROM fatwa_categories WHERE is_active = 1 ORDER BY sort_order ASC').all() as Array<{ code: string }>;
    const pubs = db.prepare(`
      SELECT fq.issued_fatwa_number, COALESCE(substr(fp.published_at, 1, 10), fq.issued_at) as lastmod
      FROM fatwa_publications fp
      JOIN fatwa_questions fq ON fq.id = fp.question_id
      WHERE fp.is_published = 1 AND fq.workflow_status = 'issued' AND fq.publication_status = 'published'
    `).all() as Array<{ issued_fatwa_number: string; lastmod: string }>;

    const urls = [
      { loc: `${baseUrl}/`, changefreq: 'daily', priority: '1.0' },
      { loc: `${baseUrl}/ask`, changefreq: 'weekly', priority: '0.9' },
      { loc: `${baseUrl}/fatwas`, changefreq: 'daily', priority: '0.9' },
      ...cats.map((c) => ({ loc: `${baseUrl}/category/${encodeURIComponent(c.code)}`, changefreq: 'weekly', priority: '0.8' })),
      ...pubs.map((p) => ({
        loc: `${baseUrl}/fatwa/${encodeURIComponent(p.issued_fatwa_number)}`,
        lastmod: p.lastmod,
        changefreq: 'monthly',
        priority: '0.85',
      })),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map(
        (u: any) =>
          `  <url>\n    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
      )
      .join('\n')}\n</urlset>`;

    res.type('application/xml').send(xml);
  });

  // Vite middleware for dev / static serving for prod
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Naafay Dar-ul-Ifta Academic System running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
