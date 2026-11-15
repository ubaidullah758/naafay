import {
  STATIC_PORTAL_DATA,
  STATIC_LOOKUPS,
  STATIC_ATTENDANCE,
  STATIC_DASHBOARD,
  STATIC_STUDENTS,
  STATIC_TEACHERS,
  STATIC_FATWAS,
  STATIC_ADMIN_OVERVIEW,
  STATIC_FATWA_LOOKUPS,
  STATIC_FATWA_DASHBOARD,
  STATIC_MUTALA,
  STATIC_MUTALA_SUMMARY,
  STATIC_LESSONS,
  STATIC_EXAMS,
  STATIC_RESEARCH,
  STATIC_REPORTS_OVERVIEW,
} from './staticInitialData';
import { formatPakistaniMobile, matchesPhoneSearch } from './phone';

const STORAGE_KEYS = {
  attendance: 'naafay_local_attendance',
  adminOverview: 'naafay_local_admin_overview',
  portalData: 'naafay_local_portal_data',
};

function getStoredJson<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

function setStoredJson(key: string, val: any) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // Ignore storage quota errors
  }
}

function getAttendanceMap(): Record<string, { id: string; status: string; remarks?: string }> {
  const current = getStoredJson<Record<string, { id: string; status: string; remarks?: string }>>(
    STORAGE_KEYS.attendance,
    {}
  );
  if (Object.keys(current).length > 0) return current;

  const initialMap: Record<string, { id: string; status: string; remarks?: string }> = {};
  const date = STATIC_ATTENDANCE.date || new Date().toISOString().slice(0, 10);
  for (const r of STATIC_ATTENDANCE.rows || []) {
    if (r.sessions) {
      for (const [sesId, sVal] of Object.entries(r.sessions as Record<string, any>)) {
        if (sVal?.status) {
          const key = `${r.student_id}_${date}_${sesId}`;
          initialMap[key] = { id: sVal.id || Math.random().toString(36).slice(2), status: sVal.status, remarks: sVal.remarks || '' };
        }
      }
    }
  }
  setStoredJson(STORAGE_KEYS.attendance, initialMap);
  return initialMap;
}

export async function handleClientFallback(url: string, options: RequestInit = {}): Promise<Response> {
  const parsed = new URL(url, window.location.origin);
  const pathname = parsed.pathname;
  const method = (options.method || 'GET').toUpperCase();

  const jsonResponse = (data: any, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  // 1. Admin Overview (/api/admin/overview)
  if (pathname === '/api/admin/overview') {
    const stored = getStoredJson(STORAGE_KEYS.adminOverview, STATIC_ADMIN_OVERVIEW);
    return jsonResponse(stored || STATIC_ADMIN_OVERVIEW);
  }

  // 2. Public Portal Data (/api/public/portal-data)
  if (pathname === '/api/public/portal-data') {
    const stored = getStoredJson(STORAGE_KEYS.portalData, STATIC_PORTAL_DATA);
    return jsonResponse(stored || STATIC_PORTAL_DATA);
  }

  // 3. Public Fatwas List (/api/public/fatwas)
  if (pathname === '/api/public/fatwas') {
    return jsonResponse(STATIC_FATWAS || []);
  }

  // 4. Public Fatwa Detail (/api/public/fatwas/:id)
  if (pathname.startsWith('/api/public/fatwas/')) {
    const ident = decodeURIComponent(pathname.replace('/api/public/fatwas/', ''));
    const fatwasList: any[] = Array.isArray(STATIC_FATWAS) ? STATIC_FATWAS : STATIC_ADMIN_OVERVIEW?.fatwas || [];
    const found = fatwasList.find(
      (f) => f.id === ident || f.issued_fatwa_number === ident || f.tracking_number === ident
    ) || fatwasList[0];
    return jsonResponse(found || {});
  }

  // 5. Public Question Submission
  if (pathname === '/api/public/questions' && method === 'POST') {
    const tracking = 'TK-' + Math.floor(100000 + Math.random() * 900000);
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    return jsonResponse({ success: true, trackingNumber: tracking, verificationCode: code });
  }

  // 6. Lookups (/api/lookups)
  if (pathname === '/api/lookups') {
    return jsonResponse(STATIC_LOOKUPS);
  }

  // 7. Dashboard (/api/dashboard)
  if (pathname === '/api/dashboard') {
    return jsonResponse(STATIC_DASHBOARD);
  }

  // 8. Students List (/api/students) -> Returns Array directly!
  if (pathname === '/api/students') {
    const studentsArr = Array.isArray(STATIC_STUDENTS) ? STATIC_STUDENTS : STATIC_STUDENTS?.students || [];
    const qSearch = (parsed.searchParams.get('search') || '').toLowerCase().trim();
    const qClassId = parsed.searchParams.get('classId');
    const qStatus = parsed.searchParams.get('status');

    let filtered = studentsArr;
    if (qSearch) {
      filtered = filtered.filter(
        (s: any) =>
          (s.full_name || '').toLowerCase().includes(qSearch) ||
          (s.full_name_ur || '').includes(qSearch) ||
          (s.student_code || '').toLowerCase().includes(qSearch) ||
          (s.father_name || '').toLowerCase().includes(qSearch) ||
          matchesPhoneSearch(s.phone, qSearch) ||
          matchesPhoneSearch(s.guardian_phone, qSearch)
      );
    }
    if (qClassId) {
      filtered = filtered.filter((s: any) => s.class_id === qClassId);
    }
    if (qStatus) {
      filtered = filtered.filter((s: any) => s.status === qStatus);
    }

    const formatted = filtered.map((s: any) => ({
      ...s,
      phone: formatPakistaniMobile(s.phone),
      guardian_phone: formatPakistaniMobile(s.guardian_phone || s.phone),
    }));

    return jsonResponse(formatted);
  }

  // 9. Single Student Detail (/api/students/:id)
  if (pathname.startsWith('/api/students/')) {
    const stuId = decodeURIComponent(pathname.replace('/api/students/', '').split('/')[0]);
    const studentsList: any[] = Array.isArray(STATIC_STUDENTS) ? STATIC_STUDENTS : STATIC_STUDENTS?.students || [];
    const rawFound = studentsList.find((s) => s.id === stuId || s.student_code === stuId) || studentsList[0] || {};
    const found = {
      ...rawFound,
      phone: formatPakistaniMobile(rawFound.phone),
      guardian_phone: formatPakistaniMobile(rawFound.guardian_phone || rawFound.phone),
    };

    const guardians = [
      {
        id: 'g-' + (found.id || '1'),
        student_id: found.id,
        full_name: found.guardian_name || found.father_name || 'Hafiz Muhammad Ibrahim',
        full_name_ur: found.guardian_name_ur || found.father_name_ur || 'حافظ محمد ابراہیم',
        phone: formatPakistaniMobile(found.guardian_phone || found.phone || '03017782310'),
        relationship: 'Father / Guardian',
        is_primary: 1,
      },
    ];

    const attMap = getAttendanceMap();
    const date = STATIC_ATTENDANCE.date || new Date().toISOString().slice(0, 10);
    const attendanceRecords: any[] = [];
    const sessionDefs = [
      { id: 'ses-morning', code: 'morning_zuhr', name_en: 'Morning to Zuhr', name_ur: 'صبح تا ظہر', sort_order: 1 },
      { id: 'ses-zuhr', code: 'zuhr_asr', name_en: 'Zuhr to Asr', name_ur: 'ظہر تا عصر', sort_order: 2 },
      { id: 'ses-maghrib', code: 'maghrib_isha', name_en: 'Maghrib to Isha', name_ur: 'مغرب تا عشاء', sort_order: 3 },
    ];
    for (const sDef of sessionDefs) {
      const key = `${found.id}_${date}_${sDef.id}`;
      const rec = attMap[key];
      attendanceRecords.push({
        id: rec?.id || 'att-' + Math.random().toString(36).slice(2, 7),
        student_id: found.id,
        session_id: sDef.id,
        session_code: sDef.code,
        session_name_en: sDef.name_en,
        session_name_ur: sDef.name_ur,
        sort_order: sDef.sort_order,
        attendance_date: date,
        status: rec?.status || 'present',
        remarks: rec?.remarks || '',
      });
    }

    const mutalaList: any[] = Array.isArray(STATIC_MUTALA) ? STATIC_MUTALA : [];
    const studentMutala = mutalaList.filter((m) => m.student_id === found.id || m.student_code === found.student_code);
    const mutala = studentMutala.length > 0 ? studentMutala : mutalaList.slice(0, 6);

    const lessonsList: any[] = Array.isArray(STATIC_LESSONS?.lessons) ? STATIC_LESSONS.lessons : Array.isArray(STATIC_LESSONS) ? STATIC_LESSONS : [];
    const lessons = lessonsList.filter((l) => !found.class_id || l.class_id === found.class_id || !l.class_id);

    const examsList: any[] = Array.isArray(STATIC_EXAMS) ? STATIC_EXAMS : [];
    const results: any[] = [];
    for (const ex of examsList) {
      for (const res of ex.results || []) {
        if (res.student_id === found.id || res.student_code === found.student_code) {
          results.push({ ...res, exam_title_en: ex.title_en, exam_title_ur: ex.title_ur });
        }
      }
    }

    const researchList: any[] = Array.isArray(STATIC_RESEARCH?.assignments) ? STATIC_RESEARCH.assignments : [];
    const research = researchList.filter((r) => r.student_id === found.id || r.student_code === found.student_code);

    const subList: any[] = Array.isArray(STATIC_LOOKUPS?.subjects) ? STATIC_LOOKUPS.subjects : [];
    const enrolledSubjects = subList
      .filter((s) => !found.class_id || s.class_id === found.class_id)
      .map((s) => {
        const bk = (STATIC_LOOKUPS?.books || []).find((b: any) => b.subject_id === s.id) || {};
        return {
          subject_id: s.id,
          subject_code: s.code,
          subject_name_en: s.name_en,
          subject_name_ur: s.name_ur,
          book_id: bk.id || 'bk-1',
          book_title_en: bk.title_en || 'Fiqh Book',
          book_title_ur: bk.title_ur || 'کتاب الفقہ',
          teacher_name: 'Mufti Salman Mansoorpuri',
          teacher_name_ur: 'مفتی سلمان منصورپوری',
          start_time: '08:00',
          end_time: '09:30',
          days_of_week: 'ہفتہ تا بدھ',
          room_name: 'درسگاہ ۱',
        };
      });

    const monthlyReports = [
      {
        month: date.slice(0, 7),
        attTotal: 24,
        attPresent: 22,
        attAbsent: 2,
        mutalaCount: mutala.length || 10,
        mutalaApproved: mutala.length || 9,
      },
    ];

    return jsonResponse({
      student: found,
      guardians,
      attendance: attendanceRecords,
      mutala,
      lessons: lessons.slice(0, 10),
      exams: examsList,
      results,
      research,
      documents: [],
      monthlyReports,
      activityHistory: [],
      enrolledSubjects,
    });
  }

  // 10. Teachers List (/api/teachers) -> Returns Array directly!
  if (pathname === '/api/teachers') {
    const teachersArr = Array.isArray(STATIC_TEACHERS) ? STATIC_TEACHERS : STATIC_TEACHERS?.teachers || [];
    const qSearch = (parsed.searchParams.get('search') || '').toLowerCase().trim();

    let filtered = teachersArr;
    if (qSearch) {
      filtered = filtered.filter(
        (t: any) =>
          (t.full_name || '').toLowerCase().includes(qSearch) ||
          (t.full_name_ur || '').includes(qSearch) ||
          (t.teacher_code || '').toLowerCase().includes(qSearch) ||
          (t.qualification || '').toLowerCase().includes(qSearch) ||
          (t.specialization || '').toLowerCase().includes(qSearch) ||
          matchesPhoneSearch(t.phone, qSearch)
      );
    }

    const formatted = filtered.map((t: any) => ({
      ...t,
      phone: formatPakistaniMobile(t.phone),
    }));

    return jsonResponse(formatted);
  }

  // 10b. Single Teacher Detail (/api/teachers/:id)
  if (pathname.startsWith('/api/teachers/')) {
    const tchId = decodeURIComponent(pathname.replace('/api/teachers/', '').split('/')[0]);
    const teachersList: any[] = Array.isArray(STATIC_TEACHERS) ? STATIC_TEACHERS : STATIC_TEACHERS?.teachers || [];
    const rawFound = teachersList.find((t) => t.id === tchId || t.teacher_code === tchId) || teachersList[0] || {};
    const found = {
      ...rawFound,
      phone: formatPakistaniMobile(rawFound.phone),
    };

    const assignments = found.assignments || [
      {
        id: 'ta-1',
        teacher_id: found.id,
        class_id: 'cls-tak1',
        class_name_en: 'Takhassus fil Fiqh — Year 1',
        class_name_ur: 'تخصص فی الفقہ — سالِ اول',
        subject_name_en: 'Hanafi Fiqh',
        subject_name_ur: 'فقہِ حنفی',
        book_title_en: 'Radd al-Muhtar (Shami)',
        book_title_ur: 'رد المحتار (فتاویٰ شامی)',
        session_name_en: 'Morning to Zuhr',
        session_name_ur: 'صبح تا ظہر',
        start_time: '08:00',
        end_time: '09:30',
        days_of_week: 'ہفتہ تا بدھ',
        room_name: 'درسگاہ ۱',
        latest_lesson_date: '2026-11-14',
        latest_start_position: 'باب صلوۃ المسافر',
        latest_end_position: 'ص ۱۱۰ تا ۱۲۵',
      },
    ];

    const supervisedStudents = (Array.isArray(STATIC_STUDENTS) ? STATIC_STUDENTS : []).slice(0, 5);
    const lessons = (Array.isArray(STATIC_LESSONS?.lessons) ? STATIC_LESSONS.lessons : []).slice(0, 10);
    const studyReviews = (Array.isArray(STATIC_MUTALA) ? STATIC_MUTALA : []).slice(0, 6);
    const researchSupervisions = (Array.isArray(STATIC_RESEARCH?.assignments) ? STATIC_RESEARCH.assignments : []).slice(0, 4);

    return jsonResponse({
      teacher: found,
      assignments,
      supervisedStudents,
      lessons,
      studyReviews,
      researchSupervisions,
      performance: {
        totalLessons: lessons.length || 14,
        totalStudyReviews: studyReviews.length || 8,
        supervisedStudentCount: supervisedStudents.length || 5,
        researchCount: researchSupervisions.length || 2,
      },
    });
  }

  // 10c. Schedule (/api/schedule)
  if (pathname === '/api/schedule') {
    const qClassId = parsed.searchParams.get('classId');
    const qTeacherId = parsed.searchParams.get('teacherId');
    const teachersList: any[] = Array.isArray(STATIC_TEACHERS) ? STATIC_TEACHERS : [];
    let allAssignments: any[] = [];
    for (const t of teachersList) {
      if (t.assignments) allAssignments.push(...t.assignments);
    }
    if (qClassId) allAssignments = allAssignments.filter((a) => a.class_id === qClassId);
    if (qTeacherId) allAssignments = allAssignments.filter((a) => a.teacher_id === qTeacherId);
    return jsonResponse(allAssignments);
  }

  // 11. Attendance Sheet (/api/attendance)
  if (pathname === '/api/attendance' && method === 'GET') {
    const qDate = parsed.searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const qClassId = parsed.searchParams.get('classId');
    const attMap = getAttendanceMap();

    const baseStudents: any[] = Array.isArray(STATIC_STUDENTS) ? STATIC_STUDENTS : STATIC_ATTENDANCE?.rows || [];
    const filteredStudents = qClassId
      ? baseStudents.filter((s) => s.class_id === qClassId)
      : baseStudents;

    const rows = filteredStudents.map((s: any) => {
      const sessions: Record<string, { id: string; status: string; remarks: string }> = {};
      const sessionIds = ['ses-morning', 'ses-zuhr', 'ses-maghrib'];

      for (const sesId of sessionIds) {
        const key = `${s.id || s.student_id}_${qDate}_${sesId}`;
        const existing = attMap[key];
        if (existing) {
          sessions[sesId] = {
            id: existing.id,
            status: existing.status,
            remarks: existing.remarks || '',
          };
        }
      }

      return {
        student_id: s.id || s.student_id,
        student_code: s.student_code,
        full_name: s.full_name,
        full_name_ur: s.full_name_ur,
        class_id: s.class_id,
        batch_id: s.batch_id,
        student_status: s.student_status || 'active',
        class_name_en: s.class_name_en || 'Takhassus fil Fiqh',
        class_name_ur: s.class_name_ur || 'تخصص فی الفقہ',
        batch_name_en: s.batch_name_en || 'Cohort A',
        batch_name_ur: s.batch_name_ur || 'بیچ الف',
        sessions,
      };
    });

    return jsonResponse({ date: qDate, sessionId: '', rows });
  }

  // 12. Attendance Quick Mark (/api/attendance/quick-mark)
  if (pathname === '/api/attendance/quick-mark' && method === 'POST') {
    try {
      const body = typeof options.body === 'string' ? JSON.parse(options.body) : {};
      const { studentId, sessionId, attendanceDate, status, remarks } = body;
      const attMap = getAttendanceMap();
      const recId = 'loc-rec-' + Math.random().toString(36).slice(2, 9);
      const key = `${studentId}_${attendanceDate}_${sessionId}`;

      attMap[key] = { id: recId, status, remarks: remarks || '' };
      setStoredJson(STORAGE_KEYS.attendance, attMap);

      return jsonResponse({
        success: true,
        recordId: recId,
        updated: true,
        message: 'Attendance saved successfully',
      });
    } catch (e: any) {
      return jsonResponse({ error: e?.message || 'Failed to parse body' }, 400);
    }
  }

  // 13. Attendance Bulk Mark
  if (pathname === '/api/attendance/bulk' && method === 'POST') {
    try {
      const body = typeof options.body === 'string' ? JSON.parse(options.body) : {};
      const { date, sessionId, records } = body;
      const attMap = getAttendanceMap();

      for (const r of records || []) {
        const key = `${r.studentId}_${date}_${sessionId}`;
        attMap[key] = {
          id: 'loc-rec-' + Math.random().toString(36).slice(2, 9),
          status: r.status,
          remarks: r.remarks || '',
        };
      }
      setStoredJson(STORAGE_KEYS.attendance, attMap);
      return jsonResponse({ success: true, count: records?.length || 0 });
    } catch (e: any) {
      return jsonResponse({ error: e?.message || 'Failed to save bulk' }, 400);
    }
  }

  // 14. Attendance Reports (/api/attendance/reports)
  if (pathname === '/api/attendance/reports') {
    const qDate = parsed.searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const attMap = getAttendanceMap();
    const students: any[] = Array.isArray(STATIC_STUDENTS) ? STATIC_STUDENTS : STATIC_STUDENTS?.students || [];

    const dailySummary = students.map((s: any) => {
      let presentCount = 0;
      let totalCount = 3;
      for (const sesId of ['ses-morning', 'ses-zuhr', 'ses-maghrib']) {
        const key = `${s.id}_${qDate}_${sesId}`;
        if (attMap[key]?.status === 'present') presentCount++;
      }
      return {
        student_id: s.id,
        student_code: s.student_code,
        full_name: s.full_name,
        full_name_ur: s.full_name_ur,
        class_name_ur: s.class_name_ur || 'تخصص فی الفقہ',
        sessions_marked: 3,
        present_count: presentCount,
        percentage: Math.round((presentCount / totalCount) * 100),
      };
    });

    const monthlySummary = students.map((s: any) => ({
      student_id: s.id,
      student_code: s.student_code,
      full_name: s.full_name,
      full_name_ur: s.full_name_ur,
      class_name_en: s.class_name_en || 'Takhassus fil Fiqh',
      class_name_ur: s.class_name_ur || 'تخصص فی الفقہ',
      present_count: 22,
      late_count: 2,
      leave_count: 1,
      absent_count: 1,
      total_sessions: 26,
    }));

    return jsonResponse({
      date: qDate,
      reports: dailySummary,
      summary: { totalStudents: students.length },
      monthlySummary,
      dailyLessons: [],
      dailyMutala: [],
      absentList: [],
      corrections: [],
      daily: [],
      dailyGrouped: [],
    });
  }

  // 15. Reports Overview (/api/reports/overview)
  if (pathname === '/api/reports/overview') {
    return jsonResponse(STATIC_REPORTS_OVERVIEW || {
      overview: {
        totalStudents: 8,
        activeStudents: 7,
        avgAttendance: 89,
        lessonsCount: 16,
        mutalaSubmissions: 28,
        examsConducted: 4,
      },
    });
  }

  // 16. Admin Login (/api/admin/login)
  if (pathname === '/api/admin/login' && method === 'POST') {
    return jsonResponse({
      token: 'jwt-mock-admin-token',
      user: {
        role: 'admin',
        profileId: 'prof-admin',
        name: 'ناظمِ دارالافتاء (ایڈمن)',
        fullNameUr: 'مفتی وارث نصیب',
      },
    });
  }

  // 17. Fatwa Lookups (/api/fatwa/lookups)
  if (pathname === '/api/fatwa/lookups') {
    return jsonResponse(STATIC_FATWA_LOOKUPS || { categories: [], assignees: [] });
  }

  // 18. Fatwa Dashboard (/api/fatwa/dashboard)
  if (pathname === '/api/fatwa/dashboard') {
    return jsonResponse(STATIC_FATWA_DASHBOARD || {
      counts: {
        totalQuestions: 6,
        newQuestions: 1,
        assignedQuestions: 0,
        underResearch: 1,
        draftsInProgress: 0,
        pendingSeniorReview: 1,
        pendingFinalApproval: 1,
        approvedFatwas: 2,
        issuedFatwas: 2,
        publishedFatwas: 2,
      },
      questions: STATIC_FATWA_DASHBOARD?.questions || [],
    });
  }

  // 19. Fatwa Archive (/api/fatwa/archive) -> Returns Array directly!
  if (pathname === '/api/fatwa/archive') {
    const list = STATIC_FATWA_DASHBOARD?.questions || [];
    return jsonResponse(list);
  }

  // 20. Single Fatwa Question Detail (/api/fatwa/questions/:id)
  if (pathname.startsWith('/api/fatwa/questions/')) {
    const fId = pathname.replace('/api/fatwa/questions/', '').split('/')[0];
    const qList: any[] = STATIC_FATWA_DASHBOARD?.questions || [];
    const found = qList.find((q) => q.id === fId || q.fatwa_code === fId) || qList[0] || {};
    return jsonResponse({
      question: found,
      draft: found.draft || {
        draft_title: found.subject_title_ur || '',
        draft_body_ur: found.answer_text_ur || 'بسم اللہ الرحمٰن الرحیم\nالجواب وباللہ التوفیق:\n\nواللہ تعالیٰ اعلم بالصواب',
        draft_body_ar: '',
        current_version: 1,
      },
      drafts: [],
      references: found.references || [],
      documents: [],
      attachments: found.attachments || [],
      assignments: found.assignments || [],
      research: found.research || [],
      versions: found.versions || [],
      reviews: found.reviews || [],
      approvals: found.approvals || [],
      publication: found.publication || null,
    });
  }

  // 21. Fatwa Categories (/api/fatwa/categories) -> Returns Array directly!
  if (pathname === '/api/fatwa/categories') {
    const catsArr = STATIC_FATWA_LOOKUPS?.categories || STATIC_PORTAL_DATA?.categories || [];
    return jsonResponse(catsArr);
  }

  // 22. Mutala / Study Logs (/api/mutala) -> Returns Array directly!
  if (pathname === '/api/mutala') {
    return jsonResponse(Array.isArray(STATIC_MUTALA) ? STATIC_MUTALA : []);
  }

  // 23. Mutala Summary (/api/mutala/summary) -> Returns Array directly!
  if (pathname === '/api/mutala/summary') {
    return jsonResponse(Array.isArray(STATIC_MUTALA_SUMMARY) ? STATIC_MUTALA_SUMMARY : []);
  }

  // 24. Lessons (/api/lessons) -> Returns { lessons: [], bookProgress: [] }
  if (pathname === '/api/lessons') {
    return jsonResponse(STATIC_LESSONS || { lessons: [], bookProgress: [] });
  }

  // 25. Exams (/api/exams) -> Returns Array directly!
  if (pathname === '/api/exams') {
    return jsonResponse(Array.isArray(STATIC_EXAMS) ? STATIC_EXAMS : []);
  }

  // 26. Single Exam Detail (/api/exams/:id)
  if (pathname.startsWith('/api/exams/')) {
    const exId = pathname.replace('/api/exams/', '').split('/')[0];
    const examList: any[] = Array.isArray(STATIC_EXAMS) ? STATIC_EXAMS : [];
    const found = examList.find((e) => e.id === exId) || examList[0];
    return jsonResponse({ exam: found, subjects: [], results: [] });
  }

  // 27. Research Assignments (/api/research) -> Returns { topics: [], assignments: [] }
  if (pathname === '/api/research') {
    return jsonResponse(STATIC_RESEARCH || { topics: [], assignments: [] });
  }

  // 28. Documents (/api/documents)
  if (pathname === '/api/documents') {
    return jsonResponse({ documents: [] });
  }

  // 29. Global Search (/api/search)
  if (pathname === '/api/search') {
    const q = (parsed.searchParams.get('q') || '').toLowerCase().trim();
    const studentsList: any[] = Array.isArray(STATIC_STUDENTS) ? STATIC_STUDENTS : [];
    const teachersList: any[] = Array.isArray(STATIC_TEACHERS) ? STATIC_TEACHERS : [];
    const booksList: any[] = Array.isArray(STATIC_LOOKUPS?.books) ? STATIC_LOOKUPS.books : [];
    const researchList: any[] = Array.isArray(STATIC_RESEARCH?.topics) ? STATIC_RESEARCH.topics : [];

    const matchedStudents = q
      ? studentsList
          .filter(
            (s) =>
              (s.full_name || '').toLowerCase().includes(q) ||
              (s.full_name_ur || '').includes(q) ||
              (s.student_code || '').toLowerCase().includes(q) ||
              matchesPhoneSearch(s.phone, q) ||
              matchesPhoneSearch(s.guardian_phone, q)
          )
          .map((s) => ({ ...s, phone: formatPakistaniMobile(s.phone) }))
          .slice(0, 6)
      : studentsList.slice(0, 6).map((s) => ({ ...s, phone: formatPakistaniMobile(s.phone) }));

    const matchedTeachers = q
      ? teachersList
          .filter(
            (t) =>
              (t.full_name || '').toLowerCase().includes(q) ||
              (t.full_name_ur || '').includes(q) ||
              (t.teacher_code || '').toLowerCase().includes(q) ||
              (t.qualification || '').toLowerCase().includes(q) ||
              matchesPhoneSearch(t.phone, q)
          )
          .map((t) => ({ ...t, phone: formatPakistaniMobile(t.phone) }))
          .slice(0, 5)
      : teachersList.slice(0, 5).map((t) => ({ ...t, phone: formatPakistaniMobile(t.phone) }));

    const matchedBooks = q
      ? booksList.filter((b) => (b.title_en || '').toLowerCase().includes(q) || (b.title_ur || '').includes(q) || (b.author || '').includes(q)).slice(0, 5)
      : booksList.slice(0, 5);

    return jsonResponse({
      students: matchedStudents,
      teachers: matchedTeachers,
      books: matchedBooks,
      research: researchList.slice(0, 5),
    });
  }

  // 29b. Reference Search (/api/fatwa/references/search)
  if (pathname === '/api/fatwa/references/search') {
    return jsonResponse([]);
  }

  // 29c. Uploads (/api/uploads)
  if (pathname === '/api/uploads' && method === 'POST') {
    try {
      const body = typeof options.body === 'string' ? JSON.parse(options.body) : {};
      return jsonResponse({
        fileName: body.fileName || 'document.png',
        fileUrl: body.dataUrl || '/assets/placeholder.png',
        mimeType: 'image/png',
        size: 2048,
      });
    } catch {
      return jsonResponse({ fileName: 'file.png', fileUrl: '/assets/placeholder.png', mimeType: 'image/png', size: 1024 });
    }
  }

  // 30. All POST, PUT, DELETE operations succeed
  if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
    return jsonResponse({ success: true, message: 'Updated successfully in local state' });
  }

  // Fallback default response
  return jsonResponse({ success: true, data: [] });
}
