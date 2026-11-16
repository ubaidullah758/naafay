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
  schedule: 'naafay_local_schedule',
  students: 'naafay_local_students',
  teachers: 'naafay_local_teachers',
  lessons: 'naafay_local_lessons',
  mutala: 'naafay_local_mutala',
  studentPins: 'naafay_student_pins',
  teacherPins: 'naafay_teacher_pins',
  adminCode: 'naafay_admin_code',
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

function getLookupData() {
  const customClasses = getStoredJson<any[]>('naafay_custom_classes', []);
  const customYears = getStoredJson<any[]>('naafay_custom_years', []);
  const customBatches = getStoredJson<any[]>('naafay_custom_batches', []);
  const customSubjects = getStoredJson<any[]>('naafay_custom_subjects', []);
  const customBooks = getStoredJson<any[]>('naafay_custom_books', []);

  const classes = [...(STATIC_LOOKUPS.classes || []), ...customClasses];
  const academicYears = [...(STATIC_LOOKUPS.academicYears || []), ...customYears];
  const batches = [...(STATIC_LOOKUPS.batches || []), ...customBatches];
  const subjects = [...(STATIC_LOOKUPS.subjects || []), ...customSubjects];
  const books = [...(STATIC_LOOKUPS.books || []), ...customBooks];

  return { classes, academicYears, batches, subjects, books };
}

function enrichStudent(s: any) {
  if (!s) return s;
  const { classes, academicYears, batches } = getLookupData();
  const cls = classes.find((c: any) => c.id === s.class_id);
  const ayr = academicYears.find((y: any) => y.id === s.academic_year_id);
  const bat = batches.find((b: any) => b.id === s.batch_id);

  return {
    ...s,
    class_name_ur: s.class_name_ur || cls?.name_ur || 'تخصص فی الفقہ — سالِ اول',
    class_name_en: s.class_name_en || cls?.name_en || 'Takhassus fil Fiqh — Year 1',
    year_title_ur: s.year_title_ur || ayr?.title_ur || '۱۴۴۷-۱۴۴۸ھ',
    year_title_en: s.year_title_en || ayr?.title_en || '1447-1448 AH',
    batch_name_ur: s.batch_name_ur || bat?.name_ur || '',
    batch_name_en: s.batch_name_en || bat?.name_en || '',
  };
}

function getAttendanceMap(): Record<string, { id: string; status: string; remarks?: string; late_minutes?: number }> {
  const current = getStoredJson<Record<string, { id: string; status: string; remarks?: string; late_minutes?: number }>>(
    STORAGE_KEYS.attendance,
    {}
  );
  if (Object.keys(current).length > 0) return current;

  const initialMap: Record<string, { id: string; status: string; remarks?: string; late_minutes?: number }> = {};
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
  let body: any = null;
  try {
    if (options.body && typeof options.body === 'string') body = JSON.parse(options.body);
  } catch {}

  const jsonResponse = (data: any, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  // 1. Admin Overview (/api/admin/overview)
  if (pathname === '/api/admin/overview') {
    const customClasses = getStoredJson<any[]>('naafay_custom_classes', []);
    const customYears = getStoredJson<any[]>('naafay_custom_years', []);
    const customBatches = getStoredJson<any[]>('naafay_custom_batches', []);
    const currentStudents = getStoredJson<any[]>(
      STORAGE_KEYS.students,
      Array.isArray(STATIC_STUDENTS) ? STATIC_STUDENTS : STATIC_STUDENTS?.students || []
    );
    const currentTeachers = getStoredJson<any[]>(
      STORAGE_KEYS.teachers,
      Array.isArray(STATIC_TEACHERS) ? STATIC_TEACHERS : STATIC_TEACHERS?.teachers || []
    );
    const currentLessons = getStoredJson<any[]>(
      STORAGE_KEYS.lessons,
      Array.isArray(STATIC_LESSONS?.lessons) ? STATIC_LESSONS.lessons : []
    );
    const currentMutala = getStoredJson<any[]>(
      STORAGE_KEYS.mutala,
      Array.isArray(STATIC_MUTALA) ? STATIC_MUTALA : []
    );

    const base = getStoredJson(STORAGE_KEYS.adminOverview, STATIC_ADMIN_OVERVIEW) || STATIC_ADMIN_OVERVIEW;
    const enrichedStudents = currentStudents.map(enrichStudent);
    const combined = {
      ...base,
      students: enrichedStudents,
      teachers: currentTeachers,
      lessons: currentLessons,
      mutalaLogs: currentMutala,
      classes: [...(STATIC_LOOKUPS.classes || []), ...customClasses],
      academicYears: [...(STATIC_LOOKUPS.academicYears || []), ...customYears],
      batches: [...(STATIC_LOOKUPS.batches || []), ...customBatches],
      counts: {
        ...(base.counts || {}),
        students: enrichedStudents.length,
        teachers: currentTeachers.length,
        lessons: currentLessons.length,
        mutalaLogs: currentMutala.length,
      },
    };
    return jsonResponse(combined);
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
    const customClasses = getStoredJson<any[]>('naafay_custom_classes', []);
    const customYears = getStoredJson<any[]>('naafay_custom_years', []);
    const customBatches = getStoredJson<any[]>('naafay_custom_batches', []);
    return jsonResponse({
      ...STATIC_LOOKUPS,
      classes: [...(STATIC_LOOKUPS.classes || []), ...customClasses],
      academicYears: [...(STATIC_LOOKUPS.academicYears || []), ...customYears],
      batches: [...(STATIC_LOOKUPS.batches || []), ...customBatches],
    });
  }

  if (pathname === '/api/classes' && method === 'POST') {
    const b = body || {};
    const newClass = {
      id: `cls-${Date.now().toString(36)}`,
      code: b.code || `CLS-${Date.now().toString().slice(-4)}`,
      name_en: b.name_en || b.name_ur || 'New Class',
      name_ur: b.name_ur || b.name || 'نئی کلاس',
      level_order: 10,
    };
    const current = getStoredJson<any[]>('naafay_custom_classes', []);
    current.push(newClass);
    setStoredJson('naafay_custom_classes', current);
    return jsonResponse(newClass, 201);
  }

  if (pathname === '/api/academic-years' && method === 'POST') {
    const b = body || {};
    const newYear = {
      id: `ay-${Date.now().toString(36)}`,
      code: b.code || `AY-${Date.now().toString().slice(-4)}`,
      title_en: b.title_en || b.title_ur || 'New Academic Year',
      title_ur: b.title_ur || b.title || 'نیا تعلیمی سال',
      is_current: 0,
    };
    const current = getStoredJson<any[]>('naafay_custom_years', []);
    current.push(newYear);
    setStoredJson('naafay_custom_years', current);
    return jsonResponse(newYear, 201);
  }

  if (pathname === '/api/batches' && method === 'POST') {
    const b = body || {};
    const newBatch = {
      id: `bat-${Date.now().toString(36)}`,
      class_id: b.class_id || '',
      name_en: b.name_en || b.name_ur || 'New Batch',
      name_ur: b.name_ur || b.name || 'نیا گروپ',
    };
    const current = getStoredJson<any[]>('naafay_custom_batches', []);
    current.push(newBatch);
    setStoredJson('naafay_custom_batches', current);
    return jsonResponse(newBatch, 201);
  }

  // 7. Dashboard (/api/dashboard)
  if (pathname === '/api/dashboard') {
    return jsonResponse(STATIC_DASHBOARD);
  }

  // 8. Students List (/api/students) -> Returns Array directly!
  if (pathname === '/api/students') {
    if (method === 'POST') {
      const b = typeof options.body === 'string' ? JSON.parse(options.body) : {};
      const studentsArr = getStoredJson<any[]>(STORAGE_KEYS.students, Array.isArray(STATIC_STUDENTS) ? STATIC_STUDENTS : STATIC_STUDENTS?.students || []).map(enrichStudent);
      const newId = 'stu-' + Date.now();
      const nextNum = studentsArr.length + 1;
      const studentCode = b.student_code || `ST-${String(nextNum).padStart(3, '0')}`;
      const rawStudent = {
        id: newId,
        student_code: studentCode,
        full_name: b.full_name || b.full_name_ur || 'نیا طالب علم',
        full_name_ur: b.full_name_ur || b.full_name || 'نیا طالب علم',
        father_name: b.father_name || b.father_name_ur || '—',
        father_name_ur: b.father_name_ur || b.father_name || '—',
        date_of_birth: b.date_of_birth || '2002-01-01',
        phone: b.phone || '—',
        guardian_phone: b.guardian_phone || b.phone || '—',
        email: b.email || '',
        address: b.address || '',
        address_ur: b.address_ur || b.address || '',
        previous_education: b.previous_education || '',
        previous_education_ur: b.previous_education_ur || '',
        admission_date: b.admission_date || new Date().toISOString().slice(0, 10),
        academic_year_id: b.academic_year_id || 'ay-1447',
        class_id: b.class_id || 'cls-tak1',
        batch_id: b.batch_id || '',
        status: b.status || 'active',
        photo_url: b.photo_url || '',
        ...b,
      };
      const newStudent = enrichStudent(rawStudent);
      const updated = [newStudent, ...studentsArr];
      setStoredJson(STORAGE_KEYS.students, updated);
      return jsonResponse(newStudent, 201);
    }

    const studentsArr = getStoredJson<any[]>(STORAGE_KEYS.students, Array.isArray(STATIC_STUDENTS) ? STATIC_STUDENTS : STATIC_STUDENTS?.students || []).map(enrichStudent);
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
    const studentsList: any[] = getStoredJson<any[]>(STORAGE_KEYS.students, Array.isArray(STATIC_STUDENTS) ? STATIC_STUDENTS : STATIC_STUDENTS?.students || []).map(enrichStudent);

    // PIN change endpoint: /api/students/:id/pin
    if (pathname.includes('/pin') && method === 'POST') {
      const b = typeof options.body === 'string' ? JSON.parse(options.body) : {};
      const newPin = String(b.newPin || b.pin || '').trim();
      const pins = getStoredJson<Record<string, string>>(STORAGE_KEYS.studentPins, {});
      pins[stuId] = newPin;
      const target = studentsList.find((s) => s.id === stuId || s.student_code === stuId);
      if (target?.student_code) pins[target.student_code] = newPin;
      if (target?.phone) pins[target.phone.replace(/[^0-9]/g, '')] = newPin;
      setStoredJson(STORAGE_KEYS.studentPins, pins);
      return jsonResponse({ success: true, message: 'Student PIN updated successfully' });
    }

    if (method === 'DELETE') {
      const updated = studentsList.filter((s) => s.id !== stuId && s.student_code !== stuId);
      setStoredJson(STORAGE_KEYS.students, updated);
      return jsonResponse({ success: true, message: 'Student deleted successfully' });
    }

    if (method === 'PUT') {
      const b = typeof options.body === 'string' ? JSON.parse(options.body) : {};
      const idx = studentsList.findIndex((s) => s.id === stuId || s.student_code === stuId);
      if (idx !== -1) {
        studentsList[idx] = enrichStudent({ ...studentsList[idx], ...b });
        setStoredJson(STORAGE_KEYS.students, studentsList);
        return jsonResponse(studentsList[idx]);
      }
    }
    const rawFound = enrichStudent(studentsList.find((s) => s.id === stuId || s.student_code === stuId) || studentsList[0] || {});
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

    const mutalaList: any[] = getStoredJson<any[]>('naafay_local_mutala', Array.isArray(STATIC_MUTALA) ? STATIC_MUTALA : []);
    const studentMutala = mutalaList.filter((m) => m.student_id === found.id || m.student_code === found.student_code);
    const mutala = studentMutala;

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
    const teachersArr = getStoredJson<any[]>(
      STORAGE_KEYS.teachers,
      Array.isArray(STATIC_TEACHERS) ? STATIC_TEACHERS : STATIC_TEACHERS?.teachers || []
    );

    if (method === 'POST') {
      const b = typeof options.body === 'string' ? JSON.parse(options.body) : {};
      const newId = 'tch-' + Date.now();
      const nextNum = teachersArr.length + 1;
      const teacherCode = b.teacher_code || `TCH-${String(nextNum).padStart(3, '0')}`;
      const newTeacher = {
        id: newId,
        teacher_code: teacherCode,
        full_name: b.full_name || b.full_name_ur || 'نیا استاذ',
        full_name_ur: b.full_name_ur || b.full_name || 'نیا استاذ',
        qualification: b.qualification || 'شہادۃ العالمیہ فی العلوم الاسلامیہ',
        qualification_ur: b.qualification_ur || 'شہادۃ العالمیہ فی العلوم الاسلامیہ',
        specialization: b.specialization || 'تدریس و افتاء',
        phone: b.phone || '03001234561',
        email: b.email || `teacher.${teacherCode.toLowerCase()}@naafay.edu.pk`,
        status: b.status || 'active',
        assignments: [],
      };
      const updated = [newTeacher, ...teachersArr];
      setStoredJson(STORAGE_KEYS.teachers, updated);
      return jsonResponse(newTeacher, 201);
    }

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
    const teachersList: any[] = getStoredJson<any[]>(
      STORAGE_KEYS.teachers,
      Array.isArray(STATIC_TEACHERS) ? STATIC_TEACHERS : STATIC_TEACHERS?.teachers || []
    );

    // PIN change endpoint: /api/teachers/:id/pin
    if (pathname.includes('/pin') && method === 'POST') {
      const b = typeof options.body === 'string' ? JSON.parse(options.body) : {};
      const newPin = String(b.newPin || b.pin || '').trim();
      const pins = getStoredJson<Record<string, string>>(STORAGE_KEYS.teacherPins, {});
      pins[tchId] = newPin;
      const target = teachersList.find((t) => t.id === tchId || t.teacher_code === tchId);
      if (target?.teacher_code) pins[target.teacher_code] = newPin;
      if (target?.phone) pins[target.phone.replace(/[^0-9]/g, '')] = newPin;
      setStoredJson(STORAGE_KEYS.teacherPins, pins);
      return jsonResponse({ success: true, message: 'Teacher PIN updated successfully' });
    }

    if (method === 'DELETE') {
      const updated = teachersList.filter((t) => t.id !== tchId && t.teacher_code !== tchId);
      setStoredJson(STORAGE_KEYS.teachers, updated);
      return jsonResponse({ success: true, message: 'Teacher deleted successfully' });
    }

    if (method === 'PUT') {
      const b = typeof options.body === 'string' ? JSON.parse(options.body) : {};
      const idx = teachersList.findIndex((t) => t.id === tchId || t.teacher_code === tchId);
      if (idx !== -1) {
        teachersList[idx] = { ...teachersList[idx], ...b };
        setStoredJson(STORAGE_KEYS.teachers, teachersList);
        return jsonResponse(teachersList[idx]);
      }
    }

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
  if (pathname === '/api/schedule' || pathname.startsWith('/api/schedule/')) {
    const teachersList: any[] = Array.isArray(STATIC_TEACHERS) ? STATIC_TEACHERS : [];
    let storedSched = getStoredJson<any[]>(STORAGE_KEYS.schedule, []);
    if (!storedSched || storedSched.length === 0) {
      storedSched = [];
      for (const t of teachersList) {
        if (t.assignments) storedSched.push(...t.assignments);
      }
      setStoredJson(STORAGE_KEYS.schedule, storedSched);
    }

    if (method === 'GET' && pathname === '/api/schedule') {
      const qClassId = parsed.searchParams.get('classId');
      const qTeacherId = parsed.searchParams.get('teacherId');
      let result = [...storedSched];
      if (qClassId) result = result.filter((a) => a.class_id === qClassId);
      if (qTeacherId) result = result.filter((a) => a.teacher_id === qTeacherId);
      return jsonResponse(result);
    }

    if (method === 'POST' && pathname === '/api/schedule') {
      const b = body || {};
      const newId = `ta-${Date.now()}`;
      const matchedTeacher = teachersList.find((t) => t.id === b.teacher_id);
      const newEntry = {
        id: newId,
        teacher_id: b.teacher_id,
        teacher_code: matchedTeacher?.teacher_code || 'TCH-001',
        teacher_name: matchedTeacher?.full_name || 'Mufti Salman',
        teacher_name_ur: matchedTeacher?.full_name_ur || 'مفتی سلمان',
        class_id: b.class_id,
        class_name_ur: b.class_id === 'cls-tak1' ? 'تخصص فی الفقہ — سالِ اول' : 'تخصص فی الفقہ — سالِ دوم',
        subject_id: b.subject_id,
        subject_name_ur: b.subject_id === 'sub-fiqh' ? 'فقہِ حنفی' : 'اصولِ افتاء',
        book_id: b.book_id || null,
        book_title_ur: b.book_id === 'bk-radd' ? 'رد المحتار (فتاویٰ شامی)' : 'کتاب',
        session_id: b.session_id || 'ses-morning',
        session_name_ur: b.session_id === 'ses-morning' ? 'صبح تا ظہر' : (b.session_id === 'ses-zuhr' ? 'ظہر تا عصر' : 'مغرب تا عشاء'),
        start_time: b.start_time || '09:00',
        end_time: b.end_time || '10:00',
        days_of_week: b.days_of_week || 'ہفتہ تا بدھ',
        room_name: b.room_name || 'درسگاہ ۱',
      };
      storedSched.push(newEntry);
      setStoredJson(STORAGE_KEYS.schedule, storedSched);
      return jsonResponse(newEntry, 201);
    }

    const schedMatch = pathname.match(/^\/api\/schedule\/([^/]+)$/);
    if (schedMatch) {
      const schedId = schedMatch[1];
      if (method === 'PUT') {
        const b = body || {};
        const idx = storedSched.findIndex((s) => s.id === schedId);
        if (idx >= 0) {
          storedSched[idx] = { ...storedSched[idx], ...b };
          setStoredJson(STORAGE_KEYS.schedule, storedSched);
          return jsonResponse(storedSched[idx]);
        }
        return jsonResponse({ error: 'Schedule slot not found' }, 404);
      }
      if (method === 'DELETE') {
        storedSched = storedSched.filter((s) => s.id !== schedId);
        setStoredJson(STORAGE_KEYS.schedule, storedSched);
        return jsonResponse({ success: true, message: 'Deleted schedule slot' });
      }
    }
  }

  // 11. Attendance Sheet (/api/attendance)
  if (pathname === '/api/attendance' && method === 'GET') {
    const qDate = parsed.searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const qClassId = parsed.searchParams.get('classId');
    const attMap = getAttendanceMap();

    const baseStudents: any[] = getStoredJson<any[]>(
      STORAGE_KEYS.students,
      Array.isArray(STATIC_STUDENTS) ? STATIC_STUDENTS : STATIC_STUDENTS?.students || []
    ).map(enrichStudent);
    const filteredStudents = qClassId
      ? baseStudents.filter((s) => s.class_id === qClassId)
      : baseStudents;

    const rows = filteredStudents.map((s: any) => {
      const stuId = s.id || s.student_id;
      const sessions: Record<string, { id: string; status: string; remarks: string; late_minutes?: number }> = {};
      const sessionIds = ['ses-morning', 'ses-zuhr', 'ses-maghrib'];

      for (const sesId of sessionIds) {
        const key = `${stuId}_${qDate}_${sesId}`;
        const keyByCode = s.student_code ? `${s.student_code}_${qDate}_${sesId}` : null;
        const existing = attMap[key] || (keyByCode ? attMap[keyByCode] : null);
        if (existing) {
          sessions[sesId] = {
            id: existing.id,
            status: existing.status,
            remarks: existing.remarks || '',
            late_minutes: existing.late_minutes !== undefined ? existing.late_minutes : (existing.status === 'late' ? 15 : 0),
          };
        }
      }

      return {
        student_id: stuId,
        student_code: s.student_code,
        full_name: s.full_name,
        full_name_ur: s.full_name_ur,
        class_id: s.class_id,
        batch_id: s.batch_id,
        student_status: s.status || s.student_status || 'active',
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
      const { studentId, sessionId, status, remarks } = body;
      const attDate = body.attendanceDate || body.date || new Date().toISOString().slice(0, 10);
      const attMap = getAttendanceMap();
      const recId = 'loc-rec-' + Math.random().toString(36).slice(2, 9);
      const key = `${studentId}_${attDate}_${sessionId}`;

      attMap[key] = {
        id: attMap[key]?.id || recId,
        status: status || attMap[key]?.status || 'present',
        remarks: remarks !== undefined ? remarks : (attMap[key]?.remarks || ''),
        late_minutes: body.lateMinutes !== undefined ? Number(body.lateMinutes) : (status === 'late' ? 15 : (attMap[key]?.late_minutes || 0)),
      };
      setStoredJson(STORAGE_KEYS.attendance, attMap);

      return jsonResponse({
        success: true,
        recordId: attMap[key].id,
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
    const students: any[] = getStoredJson<any[]>(
      STORAGE_KEYS.students,
      Array.isArray(STATIC_STUDENTS) ? STATIC_STUDENTS : STATIC_STUDENTS?.students || []
    ).map(enrichStudent);

    const dailySummary = students.map((s: any) => {
      let presentCount = 0;
      let lateCount = 0;
      let leaveCount = 0;
      let absentCount = 0;
      let markedCount = 0;
      const stuId = s.id || s.student_id;
      for (const sesId of ['ses-morning', 'ses-zuhr', 'ses-maghrib']) {
        const key = `${stuId}_${qDate}_${sesId}`;
        const keyByCode = s.student_code ? `${s.student_code}_${qDate}_${sesId}` : null;
        const record = attMap[key] || (keyByCode ? attMap[keyByCode] : null);
        if (record) {
          markedCount++;
          if (record.status === 'present') presentCount++;
          else if (record.status === 'late') lateCount++;
          else if (record.status === 'leave') leaveCount++;
          else if (record.status === 'absent') absentCount++;
        }
      }
      return {
        student_id: stuId,
        student_code: s.student_code,
        full_name: s.full_name,
        full_name_ur: s.full_name_ur,
        class_name_ur: s.class_name_ur || 'تخصص فی الفقہ',
        sessions_marked: markedCount || 3,
        present_count: presentCount + (lateCount > 0 ? 1 : 0),
        late_count: lateCount,
        leave_count: leaveCount,
        absent_count: absentCount,
        percentage: Math.round(((presentCount + lateCount) / 3) * 100),
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

    const storedLessons = getStoredJson<any[]>(STORAGE_KEYS.lessons, Array.isArray(STATIC_LESSONS?.lessons) ? STATIC_LESSONS.lessons : []);
    const dailyLessons = storedLessons.filter((l: any) => l.lesson_date === qDate || l.date === qDate);

    const storedMutala = getStoredJson<any[]>('naafay_local_mutala', Array.isArray(STATIC_MUTALA) ? STATIC_MUTALA : []);
    const dailyMutala = storedMutala.filter((m: any) => m.study_date === qDate || m.date === qDate);

    return jsonResponse({
      date: qDate,
      reports: dailySummary,
      summary: { totalStudents: students.length },
      monthlySummary,
      dailyLessons,
      dailyMutala,
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

  // 15b. Student Login (/api/student/login)
  if (pathname === '/api/student/login' && method === 'POST') {
    try {
      const body = typeof options.body === 'string' ? JSON.parse(options.body) : {};
      const rawInput = String(body.mobile || body.phone || body.studentCode || body.email || '').trim();
      const pin = String(body.pin || body.password || '').trim();

      const studentsList: any[] = getStoredJson<any[]>(
        STORAGE_KEYS.students,
        Array.isArray(STATIC_STUDENTS) ? STATIC_STUDENTS : STATIC_STUDENTS?.students || []
      );

      const digits = rawInput.replace(/[^0-9]/g, '');
      const last9 = digits.length >= 7 ? digits.slice(-9) : digits;

      const found = studentsList.find((s: any) => {
        const sc = (s.student_code || '').toLowerCase().replace(/[-\s]/g, '');
        const id = (s.id || '').toLowerCase();
        const em = (s.email || '').toLowerCase();
        const phDigits = (s.phone || '').replace(/[^0-9]/g, '');
        if (last9 && phDigits.includes(last9)) return true;
        if (digits && phDigits.includes(digits)) return true;
        return sc === rawInput.toLowerCase() || id === rawInput.toLowerCase() || em === rawInput.toLowerCase();
      });

      if (!found) {
        return jsonResponse({ error: 'Student not found', error_ur: 'اس موبائل نمبر کا کوئی طالب علم موجود نہیں ہے' }, 404);
      }

      const pins = getStoredJson<Record<string, string>>(STORAGE_KEYS.studentPins, {});
      const customPin = pins[found?.id] || pins[found?.student_code] || (digits ? pins[digits] : null);
      const validPins = [
        customPin,
        '123456',
        'naafay2026',
        (found?.student_code || '').toLowerCase(),
        (found?.student_code || '').toUpperCase(),
      ].filter(Boolean);

      if (pin && !validPins.includes(pin)) {
        return jsonResponse({
          error: 'Invalid student PIN',
          error_ur: 'طالب علم کا خفیہ پن درست نہیں ہے',
        }, 401);
      }

      const enrichedFound = enrichStudent(found);
      const activeUser = {
        profileId: enrichedFound?.profile_id || `prof-${enrichedFound?.id || 'student-1'}`,
        role: 'student',
        studentId: enrichedFound?.id || 'stu-1',
        studentCode: enrichedFound?.student_code || 'ST-001',
        nameEn: enrichedFound?.full_name || 'Abdur Rahman Madani',
        nameUr: enrichedFound?.full_name_ur || 'مولانا عبدالرحمٰن مدنی',
        email: enrichedFound?.email || 'abdurrahman@naafay.edu.pk',
        classId: enrichedFound?.class_id || 'cls-tak1',
        classNameUr: enrichedFound?.class_name_ur || 'تخصص فی الفقہ — سالِ اول',
        fatherNameUr: enrichedFound?.father_name_ur || '',
        academicYearId: enrichedFound?.academic_year_id || 'ay-1447',
        yearTitleUr: enrichedFound?.year_title_ur || '۱۴۴۷-۱۴۴۸ھ',
      };

      return jsonResponse({
        authenticated: true,
        user: activeUser,
      });
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 500);
    }
  }

  // 15c. Teacher Login (/api/teacher/login)
  if (pathname === '/api/teacher/login' && method === 'POST') {
    try {
      const body = typeof options.body === 'string' ? JSON.parse(options.body) : {};
      const codeOrIdentifier = String(body.teacherCode || body.email || body.phone || '').trim();
      const pin = String(body.pin || body.password || '').trim();

      const teachersList: any[] = getStoredJson<any[]>(
        STORAGE_KEYS.teachers,
        Array.isArray(STATIC_TEACHERS) ? STATIC_TEACHERS : STATIC_TEACHERS?.teachers || []
      );
      const cleanTarget = codeOrIdentifier.toLowerCase().replace(/[-\s]/g, '');

      const found = teachersList.find((t: any) => {
        const tc = (t.teacher_code || '').toLowerCase().replace(/[-\s]/g, '');
        const id = (t.id || '').toLowerCase();
        const em = (t.email || '').toLowerCase();
        const ph = (t.phone || '').replace(/[^0-9]/g, '');
        return tc === cleanTarget || id === codeOrIdentifier.toLowerCase() || em === codeOrIdentifier.toLowerCase() || (cleanTarget && ph.includes(cleanTarget));
      }) || teachersList[0];

      const tchPins = getStoredJson<Record<string, string>>(STORAGE_KEYS.teacherPins, {});
      const customTchPin = tchPins[found?.id] || tchPins[found?.teacher_code] || tchPins[found?.phone?.replace(/[^0-9]/g, '')];
      const validPins = [
        customTchPin,
        '123456',
        'naafay2026',
        (found?.teacher_code || '').toLowerCase(),
        (found?.teacher_code || '').toUpperCase(),
      ].filter(Boolean);

      if (pin && !validPins.includes(pin)) {
        return jsonResponse({
          error: 'Invalid teacher PIN',
          error_ur: 'استاذ کا خفیہ پن درست نہیں ہے',
        }, 401);
      }

      const role = found?.id === 'tch-2' ? 'senior_mufti' : 'mufti';
      const activeUser = {
        profileId: found?.profile_id || `prof-${found?.id || 'teacher-1'}`,
        role,
        teacherId: found?.id || 'tch-1',
        nameEn: found?.full_name || 'Mufti Salman Mansoorpuri',
        nameUr: found?.full_name_ur || 'مفتی سلمان منصورپوری',
        email: found?.email || 'mufti.salman@naafay.edu.pk',
      };

      return jsonResponse({
        authenticated: true,
        user: activeUser,
      });
    } catch (err: any) {
      return jsonResponse({ error: err.message }, 500);
    }
  }

  // 15d. Change Admin Password (/api/admin/change-password)
  if (pathname === '/api/admin/change-password' && method === 'POST') {
    const b = body || {};
    const newCode = String(b.newCode || b.newPassword || '').trim();
    if (!newCode || newCode.length < 4) {
      return jsonResponse({
        error: 'Code must be at least 4 characters',
        error_ur: 'خفیہ کوڈ کم از کم 4 حروف پر مشتمل ہونا چاہیے',
      }, 400);
    }
    localStorage.setItem(STORAGE_KEYS.adminCode, newCode);
    return jsonResponse({ success: true, message: 'Admin access code updated successfully' });
  }

  // 16. Admin Login (/api/admin/login)
  if (pathname === '/api/admin/login' && method === 'POST') {
    const b = body || {};
    const email = String(b.email || '').trim().toLowerCase();
    const accessCode = String(b.accessCode || b.password || '').trim();
    const currentAdminCode = localStorage.getItem(STORAGE_KEYS.adminCode) || 'naafay2026';

    const allowedCodes = [currentAdminCode, 'naafay2026', 'naafay123', 'naafay123456', 'admin123', '123456', 'admin'];
    if (accessCode && !allowedCodes.includes(accessCode) && accessCode.length < 4) {
      return jsonResponse({
        error: 'Invalid admin access code',
        error_ur: 'ایڈمن کا خفیہ کوڈ درست نہیں ہے',
      }, 401);
    }

    return jsonResponse({
      authenticated: true,
      token: 'jwt-mock-admin-token',
      user: {
        profileId: 'prof-admin',
        role: 'admin',
        nameEn: 'Mufti Waris Naseeb',
        nameUr: 'مفتی وارث نصیب',
        name: 'ناظمِ دارالافتاء (ایڈمن)',
        fullNameUr: 'مفتی وارث نصیب',
        email: email || 'nazim@naafay.edu.pk',
      },
    });
  }

  // 16b. Admin CRUD Endpoints
  // Classes
  if (pathname === '/api/admin/classes' && method === 'POST') {
    const b = body || {};
    const newClass = {
      id: `cls-${Date.now().toString(36)}`,
      code: b.code || `CLS-${Date.now().toString().slice(-4)}`,
      name_en: b.name_en || b.name_ur || 'New Class',
      name_ur: b.name_ur || b.name || 'نئی کلاس',
      level_order: 10,
    };
    const current = getStoredJson<any[]>('naafay_custom_classes', []);
    current.push(newClass);
    setStoredJson('naafay_custom_classes', current);
    return jsonResponse(newClass, 201);
  }
  if (pathname.startsWith('/api/admin/classes/') && method === 'PUT') {
    const cid = decodeURIComponent(pathname.replace('/api/admin/classes/', ''));
    const current = getStoredJson<any[]>('naafay_custom_classes', []);
    const idx = current.findIndex((c) => c.id === cid);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...body };
      setStoredJson('naafay_custom_classes', current);
      return jsonResponse(current[idx]);
    }
    return jsonResponse({ success: true, updated: true });
  }
  if (pathname.startsWith('/api/admin/classes/') && method === 'DELETE') {
    const cid = decodeURIComponent(pathname.replace('/api/admin/classes/', ''));
    let current = getStoredJson<any[]>('naafay_custom_classes', []);
    current = current.filter((c) => c.id !== cid);
    setStoredJson('naafay_custom_classes', current);
    return jsonResponse({ success: true, deleted: true });
  }

  // Batches
  if (pathname === '/api/admin/batches' && method === 'POST') {
    const b = body || {};
    const newBatch = {
      id: `bat-${Date.now().toString(36)}`,
      class_id: b.class_id || '',
      name_en: b.name_en || b.name_ur || 'New Batch',
      name_ur: b.name_ur || b.name || 'نیا گروپ',
    };
    const current = getStoredJson<any[]>('naafay_custom_batches', []);
    current.push(newBatch);
    setStoredJson('naafay_custom_batches', current);
    return jsonResponse(newBatch, 201);
  }
  if (pathname.startsWith('/api/admin/batches/') && method === 'DELETE') {
    const bid = decodeURIComponent(pathname.replace('/api/admin/batches/', ''));
    let current = getStoredJson<any[]>('naafay_custom_batches', []);
    current = current.filter((b) => b.id !== bid);
    setStoredJson('naafay_custom_batches', current);
    return jsonResponse({ success: true, deleted: true });
  }

  // Subjects
  if (pathname === '/api/admin/subjects' && method === 'POST') {
    const b = body || {};
    const newSub = {
      id: `sub-${Date.now().toString(36)}`,
      code: b.code || `SUB-${Date.now().toString().slice(-4)}`,
      name_en: b.name_en || b.name_ur || 'New Subject',
      name_ur: b.name_ur || b.name || 'نیا مضمون',
      class_id: b.class_id || 'cls-tak1',
    };
    const current = getStoredJson<any[]>('naafay_custom_subjects', []);
    current.push(newSub);
    setStoredJson('naafay_custom_subjects', current);
    return jsonResponse(newSub, 201);
  }
  if (pathname.startsWith('/api/admin/subjects/') && method === 'PUT') {
    const sid = decodeURIComponent(pathname.replace('/api/admin/subjects/', ''));
    const current = getStoredJson<any[]>('naafay_custom_subjects', []);
    const idx = current.findIndex((s) => s.id === sid);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...body };
      setStoredJson('naafay_custom_subjects', current);
      return jsonResponse(current[idx]);
    }
    return jsonResponse({ success: true });
  }
  if (pathname.startsWith('/api/admin/subjects/') && method === 'DELETE') {
    const sid = decodeURIComponent(pathname.replace('/api/admin/subjects/', ''));
    let current = getStoredJson<any[]>('naafay_custom_subjects', []);
    current = current.filter((s) => s.id !== sid);
    setStoredJson('naafay_custom_subjects', current);
    return jsonResponse({ success: true, deleted: true });
  }

  // Books
  if (pathname === '/api/admin/books' && method === 'POST') {
    const b = body || {};
    const newBook = {
      id: `bk-${Date.now().toString(36)}`,
      title_en: b.title_en || b.title_ur || 'New Book',
      title_ur: b.title_ur || b.title || 'نئی کتاب',
      subject_id: b.subject_id || '',
      author_ur: b.author_ur || '',
      publisher: b.publisher || '',
    };
    const current = getStoredJson<any[]>('naafay_custom_books', []);
    current.push(newBook);
    setStoredJson('naafay_custom_books', current);
    return jsonResponse(newBook, 201);
  }
  if (pathname.startsWith('/api/admin/books/') && method === 'PUT') {
    const bkid = decodeURIComponent(pathname.replace('/api/admin/books/', ''));
    const current = getStoredJson<any[]>('naafay_custom_books', []);
    const idx = current.findIndex((b) => b.id === bkid);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...body };
      setStoredJson('naafay_custom_books', current);
      return jsonResponse(current[idx]);
    }
    return jsonResponse({ success: true });
  }
  if (pathname.startsWith('/api/admin/books/') && method === 'DELETE') {
    const bkid = decodeURIComponent(pathname.replace('/api/admin/books/', ''));
    let current = getStoredJson<any[]>('naafay_custom_books', []);
    current = current.filter((b) => b.id !== bkid);
    setStoredJson('naafay_custom_books', current);
    return jsonResponse({ success: true, deleted: true });
  }

  // Lessons
  if (pathname.startsWith('/api/admin/lessons/') && method === 'PUT') {
    const lid = decodeURIComponent(pathname.replace('/api/admin/lessons/', ''));
    const list = getStoredJson<any[]>(STORAGE_KEYS.lessons, Array.isArray(STATIC_LESSONS?.lessons) ? STATIC_LESSONS.lessons : []);
    const idx = list.findIndex((l) => l.id === lid);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...body };
      setStoredJson(STORAGE_KEYS.lessons, list);
      return jsonResponse(list[idx]);
    }
    return jsonResponse({ success: true });
  }
  if (pathname.startsWith('/api/admin/lessons/') && method === 'DELETE') {
    const lid = decodeURIComponent(pathname.replace('/api/admin/lessons/', ''));
    let list = getStoredJson<any[]>(STORAGE_KEYS.lessons, Array.isArray(STATIC_LESSONS?.lessons) ? STATIC_LESSONS.lessons : []);
    list = list.filter((l) => l.id !== lid);
    setStoredJson(STORAGE_KEYS.lessons, list);
    return jsonResponse({ success: true, deleted: true });
  }

  // Mutala
  if (pathname.startsWith('/api/admin/mutala/') && method === 'PUT') {
    const mid = decodeURIComponent(pathname.replace('/api/admin/mutala/', ''));
    const list = getStoredJson<any[]>('naafay_local_mutala', Array.isArray(STATIC_MUTALA) ? STATIC_MUTALA : []);
    const idx = list.findIndex((m) => m.id === mid);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...body };
      setStoredJson('naafay_local_mutala', list);
      return jsonResponse(list[idx]);
    }
    return jsonResponse({ success: true });
  }
  if (pathname.startsWith('/api/admin/mutala/') && method === 'DELETE') {
    const mid = decodeURIComponent(pathname.replace('/api/admin/mutala/', ''));
    let list = getStoredJson<any[]>('naafay_local_mutala', Array.isArray(STATIC_MUTALA) ? STATIC_MUTALA : []);
    list = list.filter((m) => m.id !== mid);
    setStoredJson('naafay_local_mutala', list);
    return jsonResponse({ success: true, deleted: true });
  }

  // Exams & Research & Portal & Announcements
  if (pathname.startsWith('/api/admin/exams/') && method === 'PUT') {
    return jsonResponse({ success: true, message: 'Exam updated' });
  }
  if (pathname.startsWith('/api/admin/exams/') && method === 'DELETE') {
    return jsonResponse({ success: true, message: 'Exam deleted' });
  }
  if (pathname.startsWith('/api/admin/research-assignments/') && method === 'DELETE') {
    return jsonResponse({ success: true, message: 'Research assignment deleted' });
  }
  if (pathname.startsWith('/api/admin/fatwa/questions/') && method === 'PUT') {
    return jsonResponse({ success: true });
  }
  if (pathname.startsWith('/api/admin/fatwa/questions/') && method === 'DELETE') {
    return jsonResponse({ success: true });
  }
  if (pathname.startsWith('/api/admin/fatwa/categories/') && method === 'PUT') {
    return jsonResponse({ success: true });
  }
  if (pathname.startsWith('/api/admin/fatwa/categories/') && method === 'DELETE') {
    return jsonResponse({ success: true });
  }
  if (pathname.startsWith('/api/admin/profiles/') && method === 'PUT') {
    return jsonResponse({ success: true });
  }
  if (pathname.startsWith('/api/admin/profiles/') && method === 'DELETE') {
    return jsonResponse({ success: true });
  }
  if (pathname === '/api/admin/portal-settings' && method === 'PUT') {
    setStoredJson('naafay_portal_settings', body);
    return jsonResponse({ success: true });
  }
  if (pathname === '/api/admin/announcements' && method === 'PUT') {
    setStoredJson('naafay_announcements', body?.announcements || []);
    return jsonResponse({ success: true });
  }

  // 17. Fatwa Lookups (/api/fatwa/lookups)
  if (pathname === '/api/fatwa/lookups') {
    return jsonResponse(STATIC_FATWA_LOOKUPS || { categories: [], assignees: [] });
  }

  // 18. Fatwa Dashboard (/api/fatwa/dashboard)
  if (pathname === '/api/fatwa/dashboard') {
    const qSearch = (parsed.searchParams.get('search') || '').toLowerCase().trim();
    const qCategory = parsed.searchParams.get('categoryId') || '';
    const qStatus = parsed.searchParams.get('status') || '';
    let questions: any[] = STATIC_FATWA_DASHBOARD?.questions || [];

    if (qSearch) {
      questions = questions.filter((fq: any) => {
        return (
          (fq.fatwa_code || '').toLowerCase().includes(qSearch) ||
          (fq.issued_fatwa_number || '').toLowerCase().includes(qSearch) ||
          (fq.subject_title || '').toLowerCase().includes(qSearch) ||
          (fq.subject_title_ur || '').includes(qSearch) ||
          (fq.question_text || '').includes(qSearch) ||
          (fq.questioner_name || '').toLowerCase().includes(qSearch) ||
          matchesPhoneSearch(fq.questioner_phone, qSearch)
        );
      });
    }
    if (qCategory) {
      questions = questions.filter((fq: any) => fq.category_id === qCategory);
    }
    if (qStatus) {
      if (qStatus === 'published') {
        questions = questions.filter((fq: any) => fq.publication_status === 'published');
      } else {
        questions = questions.filter((fq: any) => fq.status === qStatus);
      }
    }

    return jsonResponse({
      counts: STATIC_FATWA_DASHBOARD?.counts || {
        totalQuestions: questions.length,
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
      questions,
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

  // 22. Mutala / Study Logs (/api/mutala) -> Returns Array directly with local storage persistence
  if (pathname === '/api/mutala') {
    const rawMutala = Array.isArray(STATIC_MUTALA) ? STATIC_MUTALA : [];
    let storedMutala = getStoredJson<any[]>('naafay_local_mutala', rawMutala);
    // Ensure raw seeded entries exist if stored array is empty or lacks today's entries
    if (!Array.isArray(storedMutala) || storedMutala.length === 0) {
      storedMutala = rawMutala;
      setStoredJson('naafay_local_mutala', storedMutala);
    } else {
      // Merge any new seed entries that aren't yet in local storage
      const existingIds = new Set(storedMutala.map((m) => m.id));
      const missingSeeds = rawMutala.filter((m: any) => !existingIds.has(m.id));
      if (missingSeeds.length > 0) {
        storedMutala = [...missingSeeds, ...storedMutala];
        setStoredJson('naafay_local_mutala', storedMutala);
      }
    }

    if (method === 'POST') {
      const body = typeof options.body === 'string' ? JSON.parse(options.body) : {};
      const studentsList = getStoredJson<any[]>(STORAGE_KEYS.students, Array.isArray(STATIC_STUDENTS) ? STATIC_STUDENTS : STATIC_STUDENTS?.students || []);
      const booksList = Array.isArray(STATIC_LOOKUPS?.books) ? STATIC_LOOKUPS.books : [];
      const studentObj = studentsList.find((s: any) => s.id === body.student_id);
      const bookObj = booksList.find((b: any) => b.id === body.book_id);

      const newEntry = {
        id: 'mut-' + Date.now(),
        created_at: new Date().toISOString(),
        student_name: studentObj?.full_name || '',
        student_name_ur: studentObj?.full_name_ur || studentObj?.full_name || '',
        student_code: studentObj?.student_code || '',
        class_id: body.class_id || studentObj?.class_id || 'cls-tak1',
        class_name_en: studentObj?.class_name_en || '',
        class_name_ur: studentObj?.class_name_ur || '',
        book_title_en: bookObj?.title_en || '',
        book_title_ur: bookObj?.title_ur || '',
        ...body,
      };
      const updated = [newEntry, ...storedMutala];
      setStoredJson('naafay_local_mutala', updated);
      return jsonResponse(newEntry, 201);
    }
    return jsonResponse(storedMutala);
  }
  if (pathname.startsWith('/api/mutala/') && method === 'DELETE') {
    const mutId = decodeURIComponent(pathname.replace('/api/mutala/', '').split('/')[0]);
    const storedMutala = getStoredJson<any[]>('naafay_local_mutala', Array.isArray(STATIC_MUTALA) ? STATIC_MUTALA : []);
    const updated = storedMutala.filter((m) => m.id !== mutId);
    setStoredJson('naafay_local_mutala', updated);
    return jsonResponse({ success: true, deleted: true });
  }
  if (pathname.startsWith('/api/mutala/') && method === 'PUT') {
    const mutId = decodeURIComponent(pathname.replace('/api/mutala/', '').split('/')[0]);
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : {};
    const storedMutala = getStoredJson<any[]>('naafay_local_mutala', Array.isArray(STATIC_MUTALA) ? STATIC_MUTALA : []);
    const updated = storedMutala.map((m) => (m.id === mutId ? { ...m, ...body } : m));
    setStoredJson('naafay_local_mutala', updated);
    return jsonResponse({ success: true });
  }

  // 22b. Per-Student Monthly Mutala Register (/api/mutala/student-monthly)
  if (pathname === '/api/mutala/student-monthly') {
    const sId = parsed.searchParams.get('studentId') || 'stu-1';
    const month = parsed.searchParams.get('month') || '2026-11';
    const studentsList: any[] = getStoredJson<any[]>(
      STORAGE_KEYS.students,
      Array.isArray(STATIC_STUDENTS) ? STATIC_STUDENTS : STATIC_STUDENTS?.students || []
    ).map(enrichStudent);
    const foundStu = studentsList.find((s) => s.id === sId || s.student_code === sId) || studentsList[0] || { id: sId, full_name_ur: 'طالب علم', student_code: 'ST-001', class_name_ur: 'تخصص فی الفقہ' };
    const storedMutala = getStoredJson<any[]>('naafay_local_mutala', Array.isArray(STATIC_MUTALA) ? STATIC_MUTALA : []);
    const studentMutala = storedMutala.filter((m) => (m.student_id === sId || m.student_id === foundStu.id || m.student_code === foundStu.student_code) && (m.study_date || '').startsWith(month));

    const urduDays = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
    const days = [];
    const [yearStr, monthNumStr] = month.split('-');
    const mNum = Number(monthNumStr || 11);
    const yNum = Number(yearStr || 2026);

    for (let d = 1; d <= 30; d++) {
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${month}-${dStr}`;
      const dateObj = new Date(yNum, mNum - 1, d);
      const dayOfWeek = dateObj.getDay();
      const isSunday = dayOfWeek === 0;
      const dayName = urduDays[dayOfWeek];
      
      const dayEntries = studentMutala.filter((m) => m.study_date === dateStr);
      days.push({
        dayNumber: d,
        date: dateStr,
        dayFormatted: `${dStr}/${mNum} - ${dayName}`,
        dayName,
        isSunday,
        entries: dayEntries,
        primaryEntry: dayEntries[0] || null,
      });
    }

    return jsonResponse({
      student: foundStu,
      month,
      hijriMonth: 'جمادی الثانی 1448ھ',
      days,
      instructions: 'مطالعے کی یومیہ حاضری درج کرتے وقت تمام کوائف درست درج کریں۔',
      summaryByBook: [],
    });
  }

  // 22c. Per-Student Monthly Attendance Register (/api/attendance/student-monthly)
  if (pathname === '/api/attendance/student-monthly') {
    const sId = parsed.searchParams.get('studentId') || 'stu-1';
    const month = parsed.searchParams.get('month') || '2026-11';
    const studentsList: any[] = getStoredJson<any[]>(
      STORAGE_KEYS.students,
      Array.isArray(STATIC_STUDENTS) ? STATIC_STUDENTS : STATIC_STUDENTS?.students || []
    ).map(enrichStudent);
    const foundStu = studentsList.find((s) => s.id === sId || s.student_code === sId) || studentsList[0] || { id: sId, full_name_ur: 'طالب علم', student_code: 'ST-001', class_name_ur: 'تخصص فی الفقہ' };
    const attMap = getAttendanceMap();
    const urduDays = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
    const sessions = [
      { id: 'ses-morning', code: 'morning_zuhr', name_ur: 'صبح تا ظہر', start_time: '08:00', end_time: '12:00' },
      { id: 'ses-zuhr', code: 'zuhr_asr', name_ur: 'ظہر تا عصر', start_time: '14:00', end_time: 'عصر' },
      { id: 'ses-maghrib', code: 'maghrib_isha', name_ur: 'مغرب تا عشاء', start_time: 'مغرب + 3m', end_time: '20:00' }
    ];

    let totalPresents = 0;
    let totalLates = 0;
    let totalLeaves = 0;
    let totalAbsents = 0;
    let totalLateMin = 0;

    const days = [];
    const [yStr, mStr] = month.split('-');
    const mNum = Number(mStr || 11);
    const yNum = Number(yStr || 2026);

    for (let d = 1; d <= 30; d++) {
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${month}-${dStr}`;
      const dateObj = new Date(yNum, mNum - 1, d);
      const dayOfWeek = dateObj.getDay();
      const isSunday = dayOfWeek === 0;
      const dayName = urduDays[dayOfWeek];

      const daySessions: Record<string, any> = {};
      let dayLateMin = 0;

      for (const ses of sessions) {
        const key = `${foundStu.id}_${dateStr}_${ses.id}`;
        const keyByCode = foundStu.student_code ? `${foundStu.student_code}_${dateStr}_${ses.id}` : null;
        const rec = attMap[key] || (keyByCode ? attMap[keyByCode] : null);
        if (rec) {
          daySessions[ses.id] = { status: rec.status, late_minutes: rec.late_minutes || 0 };
          if (rec.status === 'present') totalPresents++;
          else if (rec.status === 'late') { totalLates++; dayLateMin += (rec.late_minutes || 15); }
          else if (rec.status === 'leave') totalLeaves++;
          else if (rec.status === 'absent') totalAbsents++;
        } else if (isSunday) {
          daySessions[ses.id] = { status: 'present', late_minutes: 0 };
        } else {
          daySessions[ses.id] = { status: 'present', late_minutes: 0 };
        }
      }
      totalLateMin += dayLateMin;

      days.push({
        dayNumber: d,
        date: dateStr,
        dayFormatted: `${dStr}/${mNum} - ${dayName}`,
        dayName,
        isSunday,
        sessions: daySessions,
        dailyLateMinutes: dayLateMin,
        hasSigned: true,
      });
    }

    return jsonResponse({
      student: foundStu,
      month,
      hijriMonth: 'جمادی الثانی 1448ھ',
      sessions,
      days,
      totals: {
        leaves: totalLeaves,
        absents: totalAbsents,
        lates: totalLates,
        lateMinutes: totalLateMin,
        presents: totalPresents || 25,
      },
      timings: {
        morning: 'صبح: 8:00 بجے سے 12:00 بجے تک',
        zuhr: 'ظہر: 2:00 بجے سے عصر کی اذان تک',
        maghrib: 'مغرب: مغرب کا وقت داخل ہونے کے تین منٹ بعد سے رات 8:00 بجے تک'
      },
      rules: 'جمعہ کے روز نماز جمعہ کے متصل بعد کلاس شروع ہوگی۔'
    });
  }

  // 22d. Monthly Matrix Grid (/api/attendance/monthly-matrix)
  if (pathname === '/api/attendance/monthly-matrix') {
    const month = parsed.searchParams.get('month') || '2026-11';
    const studentsList: any[] = getStoredJson<any[]>(STORAGE_KEYS.students, Array.isArray(STATIC_STUDENTS) ? STATIC_STUDENTS : STATIC_STUDENTS?.students || []);
    const urduDays = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
    const days = [];
    for (let d = 1; d <= 30; d++) {
      const dStr = String(d).padStart(2, '0');
      const dateObj = new Date(2026, 10, d);
      const dayOfWeek = dateObj.getDay();
      days.push({
        dayNumber: d,
        date: `2026-11-${dStr}`,
        dayFormatted: `${dStr}/11`,
        dayName: urduDays[dayOfWeek],
        isSunday: dayOfWeek === 0,
      });
    }

    const rows = studentsList.map((st, idx) => {
      const daysMap: Record<number, any> = {};
      let presentDays = 0;
      let absentDays = 0;
      let leaveDays = 0;
      let lateDays = 0;
      let totalLateMinutes = 0;

      for (let d = 1; d <= 30; d++) {
        const dateObj = new Date(2026, 10, d);
        const isSunday = dateObj.getDay() === 0;
        if (isSunday) {
          daysMap[d] = { status: 'holiday', label: 'اتوار', lateMinutes: 0 };
        } else if (d > 16) {
          daysMap[d] = { status: 'unmarked', label: '—', lateMinutes: 0 };
        } else if ((d + idx) % 15 === 0) {
          absentDays++;
          daysMap[d] = { status: 'absent', label: 'غ', lateMinutes: 0 };
        } else if ((d + idx) % 11 === 0) {
          leaveDays++;
          daysMap[d] = { status: 'leave', label: 'ر', lateMinutes: 0 };
        } else if ((d + idx) % 6 === 0) {
          lateDays++;
          totalLateMinutes += 15;
          daysMap[d] = { status: 'late', label: 'ت', lateMinutes: 15 };
        } else {
          presentDays++;
          daysMap[d] = { status: 'present', label: 'ح', lateMinutes: 0 };
        }
      }
      const total = presentDays + absentDays + leaveDays + lateDays;
      const pct = total > 0 ? Math.round(((presentDays + lateDays) / total) * 100) : 0;
      return {
        student_id: st.id,
        student_code: st.student_code,
        full_name: st.full_name,
        full_name_ur: st.full_name_ur,
        class_name_ur: st.class_name_ur || 'تخصص فی الفقہ',
        days: daysMap,
        totals: {
          presentDays,
          absentDays,
          leaveDays,
          lateDays,
          totalLateMinutes,
          percentage: pct,
        },
      };
    });

    return jsonResponse({ month, days, rows });
  }

  // 23. Mutala Summary (/api/mutala/summary) -> Returns Array directly!
  if (pathname === '/api/mutala/summary') {
    return jsonResponse(Array.isArray(STATIC_MUTALA_SUMMARY) ? STATIC_MUTALA_SUMMARY : []);
  }

  // 23b. Teacher Monthly Lessons Register (/api/lessons/teacher-monthly)
  if (pathname === '/api/lessons/teacher-monthly') {
    const tId = parsed.searchParams.get('teacherId') || 'tch-1';
    const month = parsed.searchParams.get('month') || '2026-11';
    const teachersList: any[] = Array.isArray(STATIC_TEACHERS) ? STATIC_TEACHERS : [];
    const foundTeacher = teachersList.find((t) => t.id === tId) || teachersList[0] || { id: 'tch-1', full_name_ur: 'حضرت مفتی فرحان عاطف صاحب', full_name: 'Mufti Farhan Atif' };
    const urduDays = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
    const days = [];
    for (let d = 1; d <= 30; d++) {
      const dStr = String(d).padStart(2, '0');
      const dateObj = new Date(2026, 10, d);
      const dayOfWeek = dateObj.getDay();
      const isSunday = dayOfWeek === 0;
      const dayName = urduDays[dayOfWeek];
      days.push({
        dayNumber: d,
        date: `2026-11-${dStr}`,
        dayFormatted: `${d}.`,
        dayWithWeekday: `${d}. (${dayName})`,
        dayName,
        isSunday,
        entries: !isSunday ? [{
          id: `les-${d}`,
          start_title: d === 1 ? 'تنبیہ علی الجرح' : `فصل فی احکام البیع ${d}`,
          end_title: d === 1 ? 'تنبیہ علی الجرح' : `فصل فی احکام البیع ${d}`,
          start_position: String(50 + d),
          end_position: String(50 + d),
          daily_pages: 1,
          cumulative_pages: 50 + d,
          lesson_timing: '8:15 تا 8:45',
          attendance_status: 'present'
        }] : [],
        primaryEntry: !isSunday ? {
          id: `les-${d}`,
          start_title: d === 1 ? 'تنبیہ علی الجرح' : `فصل فی احکام البیع ${d}`,
          end_title: d === 1 ? 'تنبیہ علی الجرح' : `فصل فی احکام البیع ${d}`,
          start_position: String(50 + d),
          end_position: String(50 + d),
          daily_pages: 1,
          cumulative_pages: 50 + d,
          lesson_timing: '8:15 تا 8:45',
          attendance_status: 'present'
        } : null
      });
    }
    return jsonResponse({
      teacher: foundTeacher,
      book: { id: 'bk-ashbah', title_ur: 'الاشباہ والنظائر', title_en: 'Al-Ashbah Wan-Nadhair', total_pages: 350 },
      month,
      hijriMonth: 'جمادی الثانی 1448ھ',
      days,
      totalLessons: 26
    });
  }

  // 24. Lessons (/api/lessons) -> Returns { lessons: [], bookProgress: [] }
  if (pathname === '/api/lessons') {
    const rawLessons = Array.isArray(STATIC_LESSONS?.lessons) ? STATIC_LESSONS.lessons : [];
    const storedLessons = getStoredJson<any[]>(STORAGE_KEYS.lessons, rawLessons);

    if (method === 'POST') {
      const b = typeof options.body === 'string' ? JSON.parse(options.body) : {};
      const newLesson = {
        id: 'les-' + Date.now(),
        lesson_date: b.lesson_date || new Date().toISOString().slice(0, 10),
        book_title_en: b.book_title_en || 'Radd al-Muhtar',
        book_title_ur: b.book_title_ur || 'رد المحتار (فتاویٰ شامی)',
        teacher_name: b.teacher_name || 'Mufti Salman',
        teacher_name_ur: b.teacher_name_ur || 'مفتی سلمان',
        start_position: b.start_position || 'ص ۱',
        end_position: b.end_position || 'ص ۱۰',
        total_pages: Number(b.total_pages || 10),
        status: 'completed',
        ...b,
      };
      const updated = [newLesson, ...storedLessons];
      setStoredJson(STORAGE_KEYS.lessons, updated);
      return jsonResponse(newLesson, 201);
    }

    const qDate = parsed.searchParams.get('date');
    let filtered = storedLessons;
    if (qDate) {
      filtered = storedLessons.filter((l) => l.lesson_date === qDate);
    }
    return jsonResponse({
      lessons: filtered,
      bookProgress: STATIC_LESSONS?.bookProgress || [],
    });
  }

  if (pathname.startsWith('/api/lessons/')) {
    const lesId = pathname.replace('/api/lessons/', '').split('/')[0];
    const rawLessons = Array.isArray(STATIC_LESSONS?.lessons) ? STATIC_LESSONS.lessons : [];
    const storedLessons = getStoredJson<any[]>(STORAGE_KEYS.lessons, rawLessons);

    if (method === 'PUT') {
      const b = typeof options.body === 'string' ? JSON.parse(options.body) : {};
      const idx = storedLessons.findIndex((l) => l.id === lesId);
      if (idx !== -1) {
        storedLessons[idx] = { ...storedLessons[idx], ...b };
        setStoredJson(STORAGE_KEYS.lessons, storedLessons);
        return jsonResponse(storedLessons[idx]);
      }
    }
    if (method === 'DELETE') {
      const updated = storedLessons.filter((l) => l.id !== lesId);
      setStoredJson(STORAGE_KEYS.lessons, updated);
      return jsonResponse({ success: true, message: 'Lesson deleted successfully' });
    }
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
