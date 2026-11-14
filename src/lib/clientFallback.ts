import {
  STATIC_PORTAL_DATA,
  STATIC_LOOKUPS,
  STATIC_ATTENDANCE,
  STATIC_DASHBOARD,
  STATIC_STUDENTS,
  STATIC_TEACHERS,
  STATIC_FATWAS,
} from './staticInitialData';

const STORAGE_KEYS = {
  attendance: 'naafay_local_attendance',
  questions: 'naafay_local_questions',
  fatwas: 'naafay_local_fatwas',
  lessons: 'naafay_local_lessons',
  mutala: 'naafay_local_mutala',
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

// Initialize local attendance storage from seeded static attendance
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

  // 1. Public Portal Data
  if (pathname === '/api/public/portal-data') {
    return jsonResponse(STATIC_PORTAL_DATA);
  }

  // 2. Public Fatwas List
  if (pathname === '/api/public/fatwas') {
    return jsonResponse(STATIC_FATWAS || { fatwas: [], total: 0 });
  }

  // 3. Public Fatwa Detail
  if (pathname.startsWith('/api/public/fatwas/')) {
    const ident = decodeURIComponent(pathname.replace('/api/public/fatwas/', ''));
    const fatwasList: any[] = STATIC_FATWAS?.fatwas || [];
    const found = fatwasList.find(
      (f) => f.id === ident || f.issued_fatwa_number === ident || f.tracking_number === ident
    ) || fatwasList[0];
    return jsonResponse(found || {});
  }

  // 4. Public Question Submission
  if (pathname === '/api/public/questions' && method === 'POST') {
    const tracking = 'TK-' + Math.floor(100000 + Math.random() * 900000);
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    return jsonResponse({ success: true, trackingNumber: tracking, verificationCode: code });
  }

  // 5. Lookups
  if (pathname === '/api/lookups') {
    return jsonResponse(STATIC_LOOKUPS);
  }

  // 6. Dashboard
  if (pathname === '/api/dashboard') {
    return jsonResponse(STATIC_DASHBOARD);
  }

  // 7. Students List
  if (pathname === '/api/students') {
    return jsonResponse(STATIC_STUDENTS);
  }

  // 8. Teachers List
  if (pathname === '/api/teachers') {
    return jsonResponse(STATIC_TEACHERS);
  }

  // 9. Attendance Sheet
  if (pathname === '/api/attendance' && method === 'GET') {
    const qDate = parsed.searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const qClassId = parsed.searchParams.get('classId');
    const attMap = getAttendanceMap();

    const baseStudents: any[] = STATIC_STUDENTS?.students || STATIC_ATTENDANCE?.rows || [];
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

  // 10. Attendance Quick Mark
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
        message: 'Attendance saved successfully (localStorage)',
      });
    } catch (e: any) {
      return jsonResponse({ error: e?.message || 'Failed to parse body' }, 400);
    }
  }

  // 11. Attendance Bulk Mark
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

  // 12. Attendance Reports
  if (pathname === '/api/attendance/reports') {
    const qDate = parsed.searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const attMap = getAttendanceMap();
    const students = STATIC_STUDENTS?.students || [];

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

  // 13. Admin Login
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

  // 14. Fatwa Dashboard
  if (pathname === '/api/fatwa/dashboard') {
    return jsonResponse({
      stats: {
        totalQuestions: 24,
        pendingReview: 3,
        approvedToday: 2,
        publishedTotal: 18,
      },
    });
  }

  // Fallback default response
  return jsonResponse({ success: true, data: [] });
}
