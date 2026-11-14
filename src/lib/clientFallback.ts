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
    return jsonResponse(studentsArr);
  }

  // 9. Single Student Detail (/api/students/:id)
  if (pathname.startsWith('/api/students/')) {
    const stuId = pathname.replace('/api/students/', '');
    const studentsList: any[] = Array.isArray(STATIC_STUDENTS) ? STATIC_STUDENTS : STATIC_STUDENTS?.students || [];
    const found = studentsList.find((s) => s.id === stuId || s.student_code === stuId) || studentsList[0];
    return jsonResponse({ student: found, records: [] });
  }

  // 10. Teachers List (/api/teachers) -> Returns Array directly!
  if (pathname === '/api/teachers') {
    const teachersArr = Array.isArray(STATIC_TEACHERS) ? STATIC_TEACHERS : STATIC_TEACHERS?.teachers || [];
    return jsonResponse(teachersArr);
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

    return jsonResponse({ date: qDate, reports: dailySummary, summary: { totalStudents: students.length } });
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
    const found = qList.find((q) => q.id === fId || q.fatwa_code === fId) || qList[0];
    return jsonResponse({ question: found, drafts: [], references: [], documents: [] });
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
    return jsonResponse({ results: [] });
  }

  // 30. All POST, PUT, DELETE operations succeed
  if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
    return jsonResponse({ success: true, message: 'Updated successfully in local state' });
  }

  // Fallback default response
  return jsonResponse({ success: true, data: [] });
}
