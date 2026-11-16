import React, { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  BookOpen,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Edit3,
  Trash2,
  Printer,
  LayoutGrid,
  List,
  Sparkles,
  BookMarked,
  X,
  CheckCircle2,
  GraduationCap,
  Users
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import {
  todayLocal,
  currentMonthLocal,
  formatUrduMonth,
  formatUrduFullDate,
  addDaysLocal,
  toWesternDigits
} from '../lib/date';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorState } from './ErrorState';
import {
  STATIC_STUDENTS,
  STATIC_LOOKUPS,
  STATIC_MUTALA,
} from '../lib/staticInitialData';

// Official Teacher Monthly Cumulative Karguzari (Image 5)
const DEFAULT_TEACHER_CUMULATIVE = [
  {
    id: 'tch-cum-1',
    teacher_name: 'مفتی سراج الحق صاحب',
    book_title: 'السراجی فی المیراث',
    class_id: 'cls-tak2',
    class_name: 'تخصص فی الفقہ — سالِ دوم',
    start_excerpt: 'باب احوال الاولاد و الزوجین',
    end_excerpt: 'باب احوال الاخوات و العصبات',
    pages_span: '12 تا 48',
    total_pages: '36',
    monthly_duration: '45 گھنٹے',
    absences: '0',
    syllabus_status: 'مکمل (الحمدللہ)',
  },
  {
    id: 'tch-cum-2',
    teacher_name: 'مفتی سلمان منصورپوری صاحب',
    book_title: 'رد المحتار (فتاویٰ شامی)',
    class_id: 'cls-tak1',
    class_name: 'تخصص فی الفقہ — سالِ اول',
    start_excerpt: 'کتاب الطہارۃ — احکام المیاہ',
    end_excerpt: 'کتاب الصلوۃ — شرائط الصلوۃ',
    pages_span: '160 تا 240',
    total_pages: '80',
    monthly_duration: '48 گھنٹے',
    absences: '1',
    syllabus_status: 'مکمل حسبِ منصوبہ',
  },
  {
    id: 'tch-cum-3',
    teacher_name: 'مفتی خالد سیف اللہ صاحب',
    book_title: 'شرح عقود رسم المفتی',
    class_id: 'cls-tak1',
    class_name: 'تخصص فی الفقہ — سالِ اول',
    start_excerpt: 'مقدمہ رسم المفتی و آداب الفتویٰ',
    end_excerpt: 'فصل فی مراعاۃ العرف و تغیر الاحکام',
    pages_span: '1 تا 55',
    total_pages: '55',
    monthly_duration: '42 گھنٹے',
    absences: '0',
    syllabus_status: 'مکمل',
  },
  {
    id: 'tch-cum-4',
    teacher_name: 'مفتی انس ندوی صاحب',
    book_title: 'الاشباہ والنظائر',
    class_id: 'cls-tak1',
    class_name: 'تخصص فی الفقہ — سالِ اول',
    start_excerpt: 'الفن الاول: القواعد الکلیۃ الکبریٰ',
    end_excerpt: 'القاعدۃ الخامسۃ: الضرر یزال',
    pages_span: '20 تا 78',
    total_pages: '58',
    monthly_duration: '44 گھنٹے',
    absences: '0',
    syllabus_status: 'مکمل',
  },
];

// Official Student Monthly Cumulative Karguzari (Image 4)
const DEFAULT_STUDENT_CUMULATIVE = [
  {
    id: 'stu-cum-1',
    student_id: 'stu-1',
    student_code: 'ST-001',
    student_name: 'مولانا عبدالرحمٰن مدنی',
    class_id: 'cls-tak1',
    class_name: 'تخصص فی الفقہ — سالِ اول',
    book_title: 'رد المحتار (فتاویٰ شامی)',
    start_excerpt: 'کتاب الطہارۃ (احکام میاہ)',
    end_excerpt: 'باب المیاہ و الاسئار و النجاسات',
    pages_span: '160 تا 240',
    monthly_pages: '80',
    cumulative_pages: '450',
    juziyat_count: '24 اہم جزئیات و خلاصہ جات',
  },
  {
    id: 'stu-cum-2',
    student_id: 'stu-2',
    student_code: 'ST-002',
    student_name: 'مولانا محمد عمر فاروق',
    class_id: 'cls-tak1',
    class_name: 'تخصص فی الفقہ — سالِ اول',
    book_title: 'الاشباہ والنظائر',
    start_excerpt: 'القاعدۃ الاولیٰ: الامور بمقاصدہا',
    end_excerpt: 'القاعدۃ الخامسۃ: الضرر یزال',
    pages_span: '20 تا 78',
    monthly_pages: '58',
    cumulative_pages: '285',
    juziyat_count: '18 فقہی قواعد و فروعات',
  },
  {
    id: 'stu-cum-3',
    student_id: 'stu-3',
    student_code: 'ST-003',
    student_name: 'مولانا حذیفہ بن یوسف',
    class_id: 'cls-tak1',
    class_name: 'تخصص فی الفقہ — سالِ اول',
    book_title: 'شرح عقود رسم المفتی',
    start_excerpt: 'مقدمہ در رسم المفتی و آداب افتاء',
    end_excerpt: 'فصل فی مراتب کتب المذہب',
    pages_span: '1 تا 55',
    monthly_pages: '55',
    cumulative_pages: '110',
    juziyat_count: '15 اصول و مناہج فتویٰ',
  },
  {
    id: 'stu-cum-4',
    student_id: 'stu-4',
    student_code: 'ST-004',
    student_name: 'مولانا زید اللہ خان',
    class_id: 'cls-tak1',
    class_name: 'تخصص فی الفقہ — سالِ اول',
    book_title: 'رد المحتار (فتاویٰ شامی)',
    start_excerpt: 'کتاب الصلوۃ (شرائطِ نماز)',
    end_excerpt: 'استقبال قبلہ و ارکان صلوۃ',
    pages_span: '320 تا 385',
    monthly_pages: '65',
    cumulative_pages: '335',
    juziyat_count: '21 جزئیاتِ صلوۃ',
  },
  {
    id: 'stu-cum-5',
    student_id: 'stu-5',
    student_code: 'ST-005',
    student_name: 'مولانا طلحہ بن زبیر',
    class_id: 'cls-tak2',
    class_name: 'تخصص فی الفقہ — سالِ دوم',
    book_title: 'فقہ البیوع و جدید مالیات',
    start_excerpt: 'احکام التورق المنظم المعاصر',
    end_excerpt: 'بیع المرابحۃ للآمر بالشراء',
    pages_span: '110 تا 195',
    monthly_pages: '85',
    cumulative_pages: '420',
    juziyat_count: '26 معاصر مالیاتی جزئیات',
  },
  {
    id: 'stu-cum-6',
    student_id: 'stu-6',
    student_code: 'ST-006',
    student_name: 'مولانا سعد بن ابی وقاص',
    class_id: 'cls-tak2',
    class_name: 'تخصص فی الفقہ — سالِ دوم',
    book_title: 'السراجی فی المیراث',
    start_excerpt: 'باب احوال الاولاد و الزوجین',
    end_excerpt: 'باب احوال الاخوات و العصبات',
    pages_span: '12 تا 48',
    monthly_pages: '36',
    cumulative_pages: '155',
    juziyat_count: '14 ترکہ و تقسیم کے جداول',
  },
  {
    id: 'stu-cum-7',
    student_id: 'stu-7',
    student_code: 'ST-007',
    student_name: 'مولانا اسامہ بن زید',
    class_id: 'cls-ifta',
    class_name: 'تمرینِ افتاء و تحقیق',
    book_title: 'شرح عقود رسم المفتی',
    start_excerpt: 'تحقیق مناط الحکم فی قضایا النوازل',
    end_excerpt: 'منہج التخریج علی اقوال ائمۃ المذہب',
    pages_span: '85 تا 140',
    monthly_pages: '55',
    cumulative_pages: '140',
    juziyat_count: '20 تخریج و تنقیح فتاویٰ',
  },
  {
    id: 'stu-cum-8',
    student_id: 'stu-8',
    student_code: 'ST-008',
    student_name: 'مولانا بلال احمد عثمانی',
    class_id: 'cls-tak2',
    class_name: 'تخصص فی الفقہ — سالِ دوم',
    book_title: 'الہدایہ (کتاب البیوع)',
    start_excerpt: 'کتاب البیوع (خیار الشرط)',
    end_excerpt: 'خیار العیب و خیار الرؤیۃ',
    pages_span: '74 تا 145',
    monthly_pages: '71',
    cumulative_pages: '230',
    juziyat_count: '22 جزئیات بیوع',
  },
];

export const MutalaView: React.FC = () => {
  const { lang, pick } = useLanguage();
  const { user } = useAuth();

  // Sub-Navigation: روزانہ مطالعہ ریکارڈ و اندراجات vs یومیہ کارگزاری (اساتذہ اسباق و طلبہ مطالعہ)
  type MutalaSubTab = 'logs' | 'academic_sheet';
  const [activeTab, setActiveTab] = useState<MutalaSubTab>('logs');

  // Academic Sheet Sub-Modes: Daily Sheet vs Monthly Cumulative Performance
  type AcademicSubMode = 'daily_sheet' | 'monthly_cumulative';
  const [academicMode, setAcademicMode] = useState<AcademicSubMode>('daily_sheet');

  // Timeframe filters: روزانہ (Daily), ہفتہ وار (Weekly), ماہانہ (Monthly), سالانہ (Annual)
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'annual'>('daily');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Filter selections
  const [selectedDate, setSelectedDate] = useState<string>(todayLocal());
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthLocal());
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedBookId, setSelectedBookId] = useState<string>('');

  // Data with complete resilient fallback
  const defaultStudents = Array.isArray(STATIC_STUDENTS) ? STATIC_STUDENTS : STATIC_STUDENTS?.students || [];
  const defaultBooks = Array.isArray(STATIC_LOOKUPS?.books) ? STATIC_LOOKUPS.books : [];
  const defaultClasses = Array.isArray(STATIC_LOOKUPS?.classes) ? STATIC_LOOKUPS.classes : [];
  const defaultLogs = Array.isArray(STATIC_MUTALA) ? STATIC_MUTALA : [];

  const [logs, setLogs] = useState<any[]>(defaultLogs);
  const [students, setStudents] = useState<any[]>(defaultStudents);
  const [books, setBooks] = useState<any[]>(defaultBooks);
  const [classes, setClasses] = useState<any[]>(defaultClasses);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Academic Sheet (اساتذہ اسباق و طلبہ مطالعہ)
  const [academicReports, setAcademicReports] = useState<{ dailyLessons: any[]; dailyMutala: any[] }>({
    dailyLessons: [],
    dailyMutala: [],
  });
  const [loadingAcademic, setLoadingAcademic] = useState(false);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    class_id: 'cls-tak1',
    student_id: '',
    study_date: todayLocal(),
    book_id: '',
    maktaba: 'مکتبہ امدادیہ',
    start_title: '',
    end_title: '',
    start_position: '',
    end_position: '',
    daily_pages: '',
    cumulative_pages: '',
    juziyat_notes: '',
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      if (selectedBookId) p.set('bookId', selectedBookId);
      if (selectedStudentId) p.set('studentId', selectedStudentId);

      const [mRes, lkpRes, stuRes] = await Promise.allSettled([
        apiFetch(`/api/mutala${p.toString() ? `?${p.toString()}` : ''}`, {}, user),
        apiFetch('/api/lookups', {}, user),
        apiFetch('/api/students', {}, user),
      ]);

      const mData = mRes.status === 'fulfilled' ? mRes.value : null;
      const lkpData = lkpRes.status === 'fulfilled' ? lkpRes.value : null;
      const stuData = stuRes.status === 'fulfilled' ? stuRes.value : null;

      const fetchedLogs = Array.isArray(mData) && mData.length > 0 ? mData : defaultLogs;
      setLogs(fetchedLogs);

      const bookList = Array.isArray(lkpData?.books) && lkpData.books.length > 0
        ? lkpData.books
        : defaultBooks;
      setBooks(bookList);

      const classList = Array.isArray(lkpData?.classes) && lkpData.classes.length > 0
        ? lkpData.classes
        : defaultClasses;
      setClasses(classList);

      const studentList = Array.isArray(stuData) && stuData.length > 0
        ? stuData
        : Array.isArray(stuData?.students) && stuData.students.length > 0
        ? stuData.students
        : defaultStudents;
      setStudents(studentList);

      if (user?.studentId) {
        setSelectedStudentId(user.studentId);
      }
    } catch (err: any) {
      console.warn('Fallback applied for mutala loading', err);
      setLogs(defaultLogs);
      setBooks(defaultBooks);
      setClasses(defaultClasses);
      setStudents(defaultStudents);
    } finally {
      setLoading(false);
    }
  };

  const loadAcademicSheet = async (targetDate: string) => {
    setLoadingAcademic(true);
    try {
      const [attRes, lesRes] = await Promise.allSettled([
        apiFetch(`/api/attendance/reports?date=${targetDate}`, {}, user),
        apiFetch(`/api/lessons?date=${targetDate}`, {}, user),
      ]);
      const attData = attRes.status === 'fulfilled' ? attRes.value : null;
      const lesData = lesRes.status === 'fulfilled' ? lesRes.value : null;

      const lessonsList = Array.isArray(attData?.dailyLessons) && attData.dailyLessons.length > 0
        ? attData.dailyLessons
        : Array.isArray(lesData?.lessons)
        ? lesData.lessons
        : Array.isArray(lesData)
        ? lesData
        : [];

      const mutalaList = Array.isArray(attData?.dailyMutala) ? attData.dailyMutala : [];

      setAcademicReports({
        dailyLessons: lessonsList,
        dailyMutala: mutalaList,
      });
    } catch (e) {
      console.warn('Failed to load academic reports', e);
    } finally {
      setLoadingAcademic(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'academic_sheet') {
      loadAcademicSheet(selectedDate);
    }
  }, [activeTab, selectedDate]);

  // Compute week range for selectedDate
  const weekBounds = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const curr = new Date(y, m - 1, d);
    const day = curr.getDay(); // 0 is Sunday
    const diffToMonday = curr.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(curr.setDate(diffToMonday));
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);

    const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
    const startStr = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
    const endStr = `${saturday.getFullYear()}-${pad(saturday.getMonth() + 1)}-${pad(saturday.getDate())}`;
    return { start: startStr, end: endStr };
  }, [selectedDate]);

  // Actual recorded logs filtered strictly by the active timeframe and filters
  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      // If student is logged in, strictly show only their own records!
      if (user?.role === 'student') {
        const isMyLog =
          (user.studentId && l.student_id === user.studentId) ||
          (user.studentCode && (l.student_code === user.studentCode || l.student_id === user.studentCode));
        if (!isMyLog) return false;
      } else {
        if (selectedClassId && (l.class_id || '').toLowerCase() !== selectedClassId.toLowerCase()) return false;
        if (selectedStudentId && l.student_id !== selectedStudentId) return false;
      }
      if (selectedBookId && l.book_id !== selectedBookId) return false;

      if (timeframe === 'daily') {
        return l.study_date === selectedDate;
      }
      if (timeframe === 'weekly') {
        return l.study_date >= weekBounds.start && l.study_date <= weekBounds.end;
      }
      if (timeframe === 'monthly') {
        return l.study_date?.startsWith(selectedMonth);
      }
      if (timeframe === 'annual') {
        return l.study_date?.startsWith(selectedYear);
      }
      return true;
    });
  }, [logs, user, selectedClassId, selectedStudentId, selectedBookId, timeframe, selectedDate, weekBounds, selectedMonth, selectedYear]);

  // KPI Computations with Western 1234 Digits
  const totalPagesRead = filteredLogs.reduce((acc, l) => {
    const dp = Number(toWesternDigits(l.daily_pages));
    if (!isNaN(dp) && dp > 0) return acc + dp;
    const s = parseInt(toWesternDigits(l.start_position), 10);
    const e = parseInt(toWesternDigits(l.end_position), 10);
    return acc + (!isNaN(s) && !isNaN(e) && e >= s ? e - s + 1 : 1);
  }, 0);

  const totalEntriesCount = filteredLogs.length;
  const totalJuziyatCount = filteredLogs.filter((l) => (l.juziyat_notes || l.study_details)?.trim()).length;
  const latestReachedPos = toWesternDigits(filteredLogs[0]?.end_position || filteredLogs[0]?.start_position || '—');

  // Page calculations
  const handlePageChange = (field: 'start_position' | 'end_position', val: string) => {
    const westernVal = toWesternDigits(val);
    const updated = { ...form, [field]: westernVal };
    const s = parseInt(updated.start_position, 10);
    const e = parseInt(updated.end_position, 10);
    if (!isNaN(s) && !isNaN(e) && e >= s) {
      updated.daily_pages = String(e - s + 1);
    }
    setForm(updated);
  };

  const openAddModal = (preset?: { classId?: string; studentId?: string; bookId?: string; startFrom?: string; studyDate?: string }) => {
    setEditingLog(null);
    const chosenClassId = preset?.classId || (user?.role === 'student' && user.classId) || selectedClassId || 'cls-tak1';
    const studentsInClass = students.filter((s) => !chosenClassId || s.class_id === chosenClassId);
    const firstStudent = (user?.role === 'student' && user.studentId) ? user.studentId : (preset?.studentId || selectedStudentId || studentsInClass[0]?.id || students[0]?.id || '');
    const stObj = students.find((s) => s.id === firstStudent);
    const effectiveClassId = stObj?.class_id || user?.classId || chosenClassId;

    setForm({
      class_id: effectiveClassId,
      student_id: firstStudent,
      study_date: preset?.studyDate || selectedDate || todayLocal(),
      book_id: preset?.bookId || selectedBookId || books?.[0]?.id || '',
      maktaba: 'مکتبہ امدادیہ',
      start_title: '',
      end_title: '',
      start_position: preset?.startFrom ? toWesternDigits(preset.startFrom) : '',
      end_position: '',
      daily_pages: '',
      cumulative_pages: '',
      juziyat_notes: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (m: any) => {
    setEditingLog(m);
    setForm({
      class_id: m.class_id || 'cls-tak1',
      student_id: m.student_id,
      study_date: m.study_date,
      book_id: m.book_id,
      maktaba: m.maktaba || 'مکتبہ امدادیہ',
      start_title: m.start_title || m.chapter || '',
      end_title: m.end_title || '',
      start_position: toWesternDigits(m.start_position || ''),
      end_position: toWesternDigits(m.end_position || ''),
      daily_pages: toWesternDigits(m.daily_pages ? String(m.daily_pages) : ''),
      cumulative_pages: toWesternDigits(m.cumulative_pages ? String(m.cumulative_pages) : ''),
      juziyat_notes: m.juziyat_notes || m.study_details || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const studentObj = students.find((s) => s.id === form.student_id);
    const bookObj = books.find((b) => b.id === form.book_id);
    const classObj = classes.find((c) => c.id === form.class_id) || classes.find((c) => c.id === studentObj?.class_id);

    const payload = {
      ...form,
      start_position: toWesternDigits(form.start_position),
      end_position: toWesternDigits(form.end_position),
      daily_pages: toWesternDigits(form.daily_pages),
      cumulative_pages: toWesternDigits(form.cumulative_pages),
      chapter: form.start_title || 'مطالعہ',
      study_details: form.juziyat_notes || '',
      student_name: studentObj?.full_name || '',
      student_name_ur: studentObj?.full_name_ur || studentObj?.full_name || '',
      student_code: studentObj?.student_code || '',
      class_id: form.class_id || studentObj?.class_id || 'cls-tak1',
      class_name_en: classObj?.name_en || studentObj?.class_name_en || '',
      class_name_ur: classObj?.name_ur || studentObj?.class_name_ur || '',
      book_title_en: bookObj?.title_en || '',
      book_title_ur: bookObj?.title_ur || '',
    };

    try {
      if (editingLog) {
        await apiFetch(`/api/mutala/${editingLog.id}`, { method: 'PUT', body: JSON.stringify(payload) }, user);
        setLogs((prev) => prev.map((l) => (l.id === editingLog.id ? { ...l, ...payload } : l)));
      } else {
        const created = await apiFetch('/api/mutala', { method: 'POST', body: JSON.stringify(payload) }, user);
        const newEntry = created?.id ? created : { id: 'mut-' + Date.now(), ...payload };
        setLogs((prev) => [newEntry, ...prev]);
      }
    } catch (e) {
      console.warn('API error saving mutala, saving locally', e);
      const localEntry = { id: editingLog ? editingLog.id : 'mut-' + Date.now(), ...payload };
      if (editingLog) {
        setLogs((prev) => prev.map((l) => (l.id === editingLog.id ? { ...l, ...localEntry } : l)));
      } else {
        setLogs((prev) => [localEntry, ...prev]);
      }
    }
    setModalOpen(false);
    setEditingLog(null);
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    await apiFetch(`/api/mutala/${confirmDeleteId}`, { method: 'DELETE' }, user);
    setConfirmDeleteId(null);
    await load();
  };

  const annualMonths = [
    { num: '01', name: 'جنوری' },
    { num: '02', name: 'فروری' },
    { num: '03', name: 'مارچ' },
    { num: '04', name: 'اپریل' },
    { num: '05', name: 'مئی' },
    { num: '06', name: 'جون' },
    { num: '07', name: 'جولائی' },
    { num: '08', name: 'اگست' },
    { num: '09', name: 'ستمبر' },
    { num: '10', name: 'اکتوبر' },
    { num: '11', name: 'نومبر' },
    { num: '12', name: 'دسمبر' },
  ];

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  const rawDailyLessons = (academicReports.dailyLessons && academicReports.dailyLessons.length > 0)
    ? academicReports.dailyLessons
    : [];

  const displayLessons = rawDailyLessons.filter((l: any) => {
    if (user?.role === 'student' && user.classId) {
      if (l.class_id && l.class_id !== user.classId) return false;
    }
    return true;
  });

  const rawDailyMutala = (academicReports.dailyMutala && academicReports.dailyMutala.length > 0)
    ? academicReports.dailyMutala
    : logs
        .filter((l) => l.study_date === selectedDate)
        .map((l) => ({
          ...l,
          full_name_ur: l.student_name_ur || l.full_name_ur,
          full_name: l.student_name || l.full_name,
        }));

  const displayMutala = rawDailyMutala.filter((m: any) => {
    if (user?.role === 'student') {
      return (
        (user.studentId && (m.student_id === user.studentId || m.id === user.studentId)) ||
        (user.studentCode && (m.student_code === user.studentCode || m.student_id === user.studentCode))
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Top Sub-Navigation Tabs */}
      <div className="no-print border-b border-[#DCE4E0] overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`whitespace-nowrap shrink-0 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-[#065F46] text-[#065F46] font-bold'
                : 'border-transparent text-[#5A6D65] hover:text-[#111C18]'
            }`}
          >
            {lang === 'ur' ? '📚 مطالعہ ریکارڈ و اندراجات' : '📚 Study Records & Entries'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('academic_sheet')}
            className={`whitespace-nowrap shrink-0 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'academic_sheet'
                ? 'border-[#065F46] text-[#065F46] font-bold'
                : 'border-transparent text-[#5A6D65] hover:text-[#111C18]'
            }`}
          >
            {lang === 'ur' ? '📋 کارگزاری رپورٹس شیٹ' : '📋 Performance Reports Sheet'}
          </button>
        </div>
      </div>

      {activeTab === 'logs' && (
        <>
          {/* 1. TIMEFRAME FILTERS BAR & ACTIONS */}
          <div className="no-print rounded-xl border border-[#DCE4E0] bg-white p-3.5 sm:p-4 shadow-sm space-y-3 font-urdu">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Daily, Weekly, Monthly, Annual Filter Tabs */}
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#F0F4F2] border border-[#DCE4E0]/80">
            <button
              type="button"
              onClick={() => setTimeframe('daily')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                timeframe === 'daily'
                  ? 'bg-white text-[#065F46] shadow-sm font-bold'
                  : 'text-[#5A6D65] hover:text-[#111C18]'
              }`}
            >
              روزانہ
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('weekly')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                timeframe === 'weekly'
                  ? 'bg-white text-[#065F46] shadow-sm font-bold'
                  : 'text-[#5A6D65] hover:text-[#111C18]'
              }`}
            >
              ہفتہ وار
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('monthly')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                timeframe === 'monthly'
                  ? 'bg-white text-[#065F46] shadow-sm font-bold'
                  : 'text-[#5A6D65] hover:text-[#111C18]'
              }`}
            >
              ماہانہ
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('annual')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                timeframe === 'annual'
                  ? 'bg-white text-[#065F46] shadow-sm font-bold'
                  : 'text-[#5A6D65] hover:text-[#111C18]'
              }`}
            >
              سالانہ
            </button>
          </div>

          {/* Actions & View Toggle */}
          <div className="flex items-center gap-2">
            {timeframe !== 'annual' && (
              <div className="inline-flex items-center rounded-lg border border-[#DCE4E0] bg-[#F6F8F7] p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  title="ٹیبل ویو"
                  className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-white text-[#065F46] shadow-sm' : 'text-[#5A6D65]'}`}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  title="کارڈز ویو"
                  className={`p-1.5 rounded ${viewMode === 'cards' ? 'bg-white text-[#065F46] shadow-sm' : 'text-[#5A6D65]'}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE4E0] bg-white px-3 py-1.5 text-xs font-semibold text-[#0B2545] hover:bg-[#F6F8F7]"
            >
              <Printer className="h-3.5 w-3.5 text-[#0B2545]" />
              <span>پرنٹ رپورٹ</span>
            </button>

            <button
              type="button"
              onClick={() => openAddModal()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#065F46] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#054E3A] shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>+ نیا مطالعہ درج کریں</span>
            </button>
          </div>
        </div>

        {/* Filters (Class, Student, Book, and Period Navigation) */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${user?.role === 'student' ? 'lg:grid-cols-3' : 'lg:grid-cols-5'} gap-2.5 pt-2 border-t border-[#EEF2F0]`}>
          {user?.role !== 'student' && (
            <div>
              <label className="block text-[11px] font-medium text-[#5A6D65] mb-1">
                درجہ / کلاس
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setSelectedStudentId('');
                }}
                className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#065F46]"
              >
                <option value="">تمام درجات</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name_ur || cls.name_en}
                  </option>
                ))}
              </select>
            </div>
          )}

          {user?.role !== 'student' && (
            <div>
              <label className="block text-[11px] font-medium text-[#5A6D65] mb-1">
                طالب علم
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#065F46]"
              >
                <option value="">تمام طلباء</option>
                {students
                  .filter((st) => !selectedClassId || st.class_id === selectedClassId)
                  .map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.full_name_ur || st.full_name} ({st.student_code})
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-[#5A6D65] mb-1">
              کتاب
            </label>
            <select
              value={selectedBookId}
              onChange={(e) => setSelectedBookId(e.target.value)}
              className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#065F46]"
            >
              <option value="">تمام کتب</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>{pick(b.title_en, b.title_ur)}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[11px] font-medium text-[#5A6D65] mb-1">
              {timeframe === 'daily'
                ? 'تاریخ کا انتخاب'
                : timeframe === 'weekly'
                ? 'ہفتہ'
                : timeframe === 'monthly'
                ? 'مہینہ منتخب کریں'
                : 'سال'}
            </label>

            {timeframe === 'daily' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedDate(addDaysLocal(-1, new Date(selectedDate)))}
                  className="p-1.5 rounded-lg border border-[#DCE4E0] bg-white text-[#5A6D65] hover:bg-[#F6F8F7]"
                  title="پچھلا دن"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex-1 rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 text-xs bg-white font-mono-code"
                />
                <button
                  type="button"
                  onClick={() => setSelectedDate(addDaysLocal(1, new Date(selectedDate)))}
                  className="p-1.5 rounded-lg border border-[#DCE4E0] bg-white text-[#5A6D65] hover:bg-[#F6F8F7]"
                  title="اگلا دن"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayLocal())}
                  className="px-2.5 py-1.5 rounded-lg bg-[#E6F4EA] text-[#065F46] font-bold text-xs"
                >
                  آج
                </button>
              </div>
            )}

            {timeframe === 'weekly' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedDate(addDaysLocal(-7, new Date(selectedDate)))}
                  className="p-1.5 rounded-lg border border-[#DCE4E0] bg-white text-[#5A6D65] hover:bg-[#F6F8F7]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="flex-1 rounded-lg border border-[#DCE4E0] px-3 py-1.5 text-xs bg-white text-center font-mono-code font-bold text-[#065F46]">
                  {weekBounds.start} تا {weekBounds.end}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDate(addDaysLocal(7, new Date(selectedDate)))}
                  className="p-1.5 rounded-lg border border-[#DCE4E0] bg-white text-[#5A6D65] hover:bg-[#F6F8F7]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            )}

            {timeframe === 'monthly' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="flex-1 rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 text-xs bg-white font-mono-code"
                />
                <div className="px-3 py-1.5 rounded-lg bg-emerald-50 text-[#065F46] border border-emerald-200 text-xs font-bold whitespace-nowrap">
                  {formatUrduMonth(selectedMonth)}
                </div>
              </div>
            )}

            {timeframe === 'annual' && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 text-xs bg-white font-bold text-[#065F46] font-mono-code"
              >
                <option value="2026">2026ء (1448ھ)</option>
                <option value="2027">2027ء (1449ھ)</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* 2. SLEEK KPI METRICS (Western 1234 Digits, Clean) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="rounded-xl border border-[#DCE4E0] bg-white p-3 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-[#5A6D65] font-urdu">کل صفحات</div>
            <div className="text-xl font-bold font-mono-code text-[#065F46] mt-0.5">
              {totalPagesRead} <span className="text-xs font-normal text-gray-500 font-urdu">صفحات</span>
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center text-[#065F46] shrink-0">
            <BookOpen className="h-4 w-4" />
          </div>
        </div>

        <div className="rounded-xl border border-[#DCE4E0] bg-white p-3 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-[#5A6D65] font-urdu">مطالعہ اندراجات</div>
            <div className="text-xl font-bold font-mono-code text-[#0284C7] mt-0.5">
              {totalEntriesCount} <span className="text-xs font-normal text-gray-500 font-urdu">اندراجات</span>
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-sky-50 flex items-center justify-center text-[#0284C7] shrink-0">
            <Calendar className="h-4 w-4" />
          </div>
        </div>

        <div className="rounded-xl border border-[#DCE4E0] bg-white p-3 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-[#5A6D65] font-urdu">خلاصہ و جزئیات</div>
            <div className="text-xl font-bold font-mono-code text-amber-600 mt-0.5">
              {totalJuziyatCount} <span className="text-xs font-normal text-gray-500 font-urdu">نکات</span>
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
        </div>

        <div className="rounded-xl border border-[#DCE4E0] bg-white p-3 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-[#5A6D65] font-urdu">آخری صفحہ</div>
            <div className="text-xl font-bold font-mono-code text-indigo-600 mt-0.5">
              {latestReachedPos}
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <BookMarked className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* 3. MAIN DATA DISPLAY (Table / Cards - Shows actual recorded logs only) */}
      {timeframe !== 'annual' && (
        <div className="space-y-3 font-urdu">
          {/* Section Header */}
          <div className="flex items-center justify-between border-b border-[#DCE4E0] pb-2 text-xs">
            <div className="font-bold text-[#111C18]">
              {timeframe === 'daily'
                ? formatUrduFullDate(selectedDate)
                : timeframe === 'weekly'
                ? `${weekBounds.start} تا ${weekBounds.end}`
                : formatUrduMonth(selectedMonth)}
            </div>
            <span className="text-[#5A6D65] font-mono-code font-bold">
              {filteredLogs.length} اندراجات
            </span>
          </div>

          {filteredLogs.length === 0 ? (
            /* Empty State */
            <div className="rounded-xl border border-dashed border-[#DCE4E0] bg-white p-8 text-center space-y-3">
              <BookOpen className="h-8 w-8 text-[#5A6D65] mx-auto opacity-35" />
              <div className="text-sm font-bold text-[#111C18]">
                {timeframe === 'daily'
                  ? `اس تاریخ (${selectedDate}) کا کوئی مطالعہ ریکارڈ درج نہیں ہے`
                  : 'منتخب مدت کا کوئی مطالعہ ریکارڈ درج نہیں ہے'}
              </div>
              <p className="text-xs text-[#5A6D65] max-w-md mx-auto">
                آپ نیا مطالعہ ریکارڈ درج کر سکتے ہیں، یا پورے مہینے کے تمام اندراجات کا جائزہ لے سکتے ہیں۔
              </p>
              <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => openAddModal({ studyDate: selectedDate })}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#065F46] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#054E3A]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>+ نیا مطالعہ درج کریں</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTimeframe('monthly')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE4E0] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#0B2545] hover:bg-[#F6F8F7]"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>ماہانہ تمام اندراجات دیکھیں</span>
                </button>
                {logs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const latestDate = logs[0]?.study_date || '2026-11-16';
                      setSelectedDate(latestDate);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-300 px-3 py-1.5 text-xs font-bold text-[#065F46] hover:bg-emerald-100"
                  >
                    <span>تازہ ترین ریکارڈ دیکھیں ({logs[0]?.study_date})</span>
                  </button>
                )}
              </div>
            </div>
          ) : viewMode === 'table' ? (
            /* Table View with EXACT Sheet Columns */
            <div className="rounded-xl border border-[#DCE4E0] bg-white overflow-x-auto shadow-sm">
              <table className="w-full text-xs min-w-[950px] border-collapse">
                <thead>
                  <tr className="border-b border-[#E5ECE8] bg-[#F8FAF9] text-[#5A6D65]">
                    <th className="px-3 py-2.5 text-start font-bold whitespace-nowrap">تاریخ</th>
                    <th className="px-3 py-2.5 text-start font-bold whitespace-nowrap">طالب علم</th>
                    <th className="px-3 py-2.5 text-start font-bold whitespace-nowrap">کتاب و مکتبہ</th>
                    <th className="px-3 py-2.5 text-start font-bold min-w-[170px]">ابتداء عبارت / عنوان</th>
                    <th className="px-3 py-2.5 text-start font-bold min-w-[170px]">انتہاء عبارت / عنوان</th>
                    <th className="px-3 py-2.5 text-center font-bold whitespace-nowrap">صفحہ (ابتداء تا انتہاء)</th>
                    <th className="px-3 py-2.5 text-center font-bold whitespace-nowrap">یومیہ کل صفحات</th>
                    <th className="px-3 py-2.5 text-center font-bold whitespace-nowrap">تاحال کل صفحات</th>
                    <th className="px-3 py-2.5 text-start font-bold min-w-[150px]">خلاصہ / جزئیات</th>
                    <th className="px-3 py-2.5 text-center font-bold whitespace-nowrap">دستخط نگران</th>
                    <th className="px-3 py-2.5 text-end font-bold whitespace-nowrap">کارروائی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F0]">
                  {filteredLogs.map((m) => {
                    const startP = toWesternDigits(m.start_position || '');
                    const endP = toWesternDigits(m.end_position || '');
                    const dailyP = toWesternDigits(
                      m.daily_pages || (startP && endP ? String(parseInt(endP, 10) - parseInt(startP, 10) + 1) : '1')
                    );
                    const cumP = toWesternDigits(m.cumulative_pages || '—');
                    const startTitle = m.start_title || m.chapter || '';
                    const endTitle = m.end_title || '';
                    const notes = m.juziyat_notes || m.study_details || '';

                    return (
                      <tr key={m.id} className="hover:bg-[#F8FAF9] transition-colors">
                        <td className="px-3 py-2.5 whitespace-nowrap font-mono-code font-bold text-[#0B2545]">
                          {m.study_date}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="font-bold text-[#111C18]">{pick(m.student_name, m.student_name_ur)}</div>
                          <div className="text-[10px] text-[#5A6D65] font-mono-code">{m.student_code}</div>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="font-bold text-[#065F46]">{pick(m.book_title_en, m.book_title_ur)}</div>
                          <div className="text-[10px] text-gray-500 font-mono-code">{m.maktaba || 'مکتبہ امدادیہ'}</div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-[#111C18]">
                          {startTitle ? <span>“{startTitle}”</span> : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-[#111C18]">
                          {endTitle ? <span>“{endTitle}”</span> : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap font-mono-code font-bold text-[#0B2545]">
                          {startP && endP ? `${startP} - ${endP}` : startP || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap font-mono-code font-bold text-[#065F46]">
                          {dailyP}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap font-mono-code font-bold text-[#0F172A]">
                          {cumP}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-amber-900">
                          {notes ? (
                            <span className="line-clamp-2" title={notes}>
                              {notes}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-medium border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>تصدیق شدہ</span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-end whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(m)}
                              className="text-[#0284C7] hover:underline"
                              title="ترمیم"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(m.id)}
                              className="text-red-600 hover:underline"
                              title="حذف"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Cards View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredLogs.map((m) => {
                const startP = toWesternDigits(m.start_position || '');
                const endP = toWesternDigits(m.end_position || '');
                const dailyP = toWesternDigits(
                  m.daily_pages || (startP && endP ? String(parseInt(endP, 10) - parseInt(startP, 10) + 1) : '1')
                );
                const cumP = toWesternDigits(m.cumulative_pages || '—');
                const startTitle = m.start_title || m.chapter || '';
                const endTitle = m.end_title || '';
                const notes = m.juziyat_notes || m.study_details || '';

                return (
                  <div
                    key={m.id}
                    className="rounded-xl border border-[#DCE4E0] bg-white p-3.5 shadow-sm hover:shadow transition-all space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono-code text-xs font-bold text-[#065F46]">{m.study_date}</span>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => openEditModal(m)} className="p-1 text-[#0284C7] hover:bg-sky-50 rounded">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteId(m.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-bold text-[#111C18]">{pick(m.student_name, m.student_name_ur)}</div>
                      <div className="text-xs text-[#065F46] font-bold">
                        {pick(m.book_title_en, m.book_title_ur)}
                        <span className="text-gray-500 font-normal ms-1 text-[11px]">({m.maktaba || 'مکتبہ امدادیہ'})</span>
                      </div>
                    </div>

                    {(startTitle || endTitle) && (
                      <div className="rounded-lg bg-[#F8FAF9] p-2 text-xs text-[#2A3B34] space-y-0.5">
                        {startTitle && <div><span className="text-[#5A6D65]">ابتداء:</span> “{startTitle}”</div>}
                        {endTitle && <div><span className="text-[#5A6D65]">انتہاء:</span> “{endTitle}”</div>}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-1.5 bg-[#F6F8F7] p-2 rounded-lg text-center font-mono-code text-xs">
                      <div>
                        <div className="text-[10px] text-[#5A6D65] font-urdu">صفحات</div>
                        <div className="font-bold text-[#0B2545]">{startP && endP ? `${startP}-${endP}` : startP || '—'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#5A6D65] font-urdu">یومیہ</div>
                        <div className="font-bold text-[#065F46]">{dailyP}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#5A6D65] font-urdu">تاحال</div>
                        <div className="font-bold text-[#0F172A]">{cumP}</div>
                      </div>
                    </div>

                    {notes && (
                      <div className="text-xs text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200 line-clamp-2">
                        <span className="font-bold">خلاصہ/جزئیات: </span>{notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. ANNUAL VIEW (12-month summary breakdown) */}
      {timeframe === 'annual' && (
        <div className="rounded-xl border border-[#DCE4E0] bg-white p-4 shadow-sm space-y-3 font-urdu">
          <div className="flex items-center justify-between text-sm font-bold text-[#111C18]">
            <span>سالانہ تعلیمی کارگزاری برائے سال {selectedYear}ء</span>
            <span className="font-mono-code text-[#065F46]">{totalPagesRead} کل صفحات</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {annualMonths.map((m) => {
              const monthStr = `${selectedYear}-${m.num}`;
              const mLogs = logs.filter((l) => {
                if (selectedStudentId && l.student_id !== selectedStudentId) return false;
                if (selectedBookId && l.book_id !== selectedBookId) return false;
                return l.study_date?.startsWith(monthStr);
              });
              const mPages = mLogs.reduce((acc, l) => acc + (Number(toWesternDigits(l.daily_pages)) || 1), 0);

              return (
                <div
                  key={m.num}
                  onClick={() => {
                    setSelectedMonth(monthStr);
                    setTimeframe('monthly');
                  }}
                  className="rounded-lg border border-[#DCE4E0] p-3 bg-[#F8FAF9] hover:bg-emerald-50 hover:border-emerald-300 transition-all cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#111C18]">{m.name}</span>
                    <span className="font-mono-code text-[10px] text-gray-400">{m.num}</span>
                  </div>
                  <div className="text-base font-bold font-mono-code text-[#065F46]">
                    {mPages} <span className="text-[10px] font-normal text-gray-500">صفحات</span>
                  </div>
                  <div className="text-[10px] text-[#5A6D65] font-mono-code">
                    {mLogs.length} اندراجات
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
        </>
      )}

      {/* 2. ACADEMIC SHEET TAB (یومیہ کارگزاری و ماہانہ مجموعی کارگزاری) */}
      {activeTab === 'academic_sheet' && (
        <div className="space-y-4 font-urdu">
          {/* Sub-Header / Toggle: یومیہ کارگزاری شیٹ vs ماہانہ مجموعی کارگزاری */}
          <div className="no-print flex items-center justify-between gap-2 flex-wrap bg-[#F6F8F7] p-2 rounded-lg border border-[#DCE4E0]">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setAcademicMode('daily_sheet')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition-all ${
                  academicMode === 'daily_sheet'
                    ? 'bg-[#065F46] text-white shadow-sm'
                    : 'text-[#5A6D65] hover:text-[#111C18] bg-white border border-[#DCE4E0]'
                }`}
              >
                📋 {lang === 'ur' ? 'یومیہ کارگزاری شیٹ' : 'Daily Academic Sheet'}
              </button>
              <button
                type="button"
                onClick={() => setAcademicMode('monthly_cumulative')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition-all ${
                  academicMode === 'monthly_cumulative'
                    ? 'bg-[#065F46] text-white shadow-sm'
                    : 'text-[#5A6D65] hover:text-[#111C18] bg-white border border-[#DCE4E0]'
                }`}
              >
                📊 {lang === 'ur' ? 'ماہانہ مجموعی کارگزاری' : 'Monthly Cumulative Performance'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0B2545] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#103563] shadow-sm whitespace-nowrap"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{lang === 'ur' ? 'پرنٹ شیٹ (A4 Print / PDF)' : 'Print Register'}</span>
            </button>
          </div>

          {/* MODE 1: DAILY ACADEMIC REGISTER SHEET */}
          {academicMode === 'daily_sheet' && (
            <div className="space-y-4">
              {/* Daily Controls Bar */}
              <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-[#DCE4E0]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-[#5A6D65]">
                    {lang === 'ur' ? 'تاریخ منتخب کریں:' : 'Select Date:'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedDate(addDaysLocal(-1, new Date(selectedDate)))}
                      className="p-1.5 rounded-lg border border-[#DCE4E0] bg-white text-[#5A6D65] hover:bg-[#F6F8F7]"
                      title="پچھلا دن"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 text-xs bg-white font-mono-code"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedDate(addDaysLocal(1, new Date(selectedDate)))}
                      className="p-1.5 rounded-lg border border-[#DCE4E0] bg-white text-[#5A6D65] hover:bg-[#F6F8F7]"
                      title="اگلا دن"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(todayLocal())}
                      className="px-2.5 py-1.5 rounded-lg bg-[#E6F4EA] text-[#065F46] font-bold text-xs"
                    >
                      آج
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAcademicMode('monthly_cumulative')}
                  className="inline-flex items-center gap-1 text-xs text-[#065F46] font-bold hover:underline"
                >
                  <span>ماہانہ مجموعی کارگزاری کا جائزہ لیں 👈</span>
                </button>
              </div>

              {/* Official Academic Daily Sheet (A4 Print Ready) */}
              {loadingAcademic ? (
                <div className="py-16 text-center text-gray-500 font-urdu text-sm bg-white rounded-lg border border-[#DCE4E0]">
                  تعلیمی کارگزاری شیٹ لوڈ ہو رہی ہے...
                </div>
              ) : (
                <div className="bg-white border-2 border-black p-6 sm:p-8 rounded-lg space-y-6 max-w-4xl mx-auto shadow-sm print:border-none print:shadow-none print:p-0">
                  {/* Header */}
                  <div className="text-center space-y-1 pb-1">
                    <h2 className="text-xl sm:text-2xl font-bold text-black font-urdu tracking-wide inline-block border-b-2 border-black pb-1">
                      {user?.role === 'student' ? 'یومیہ مطالعہ کارگزاری شیٹ' : 'یومیہ کارگزاری تخصص فی الفقہ والافتاء (اسباق و مطالعہ)'}
                    </h2>
                    {user?.role === 'student' && (
                      <div className="text-xs sm:text-sm font-bold text-[#065F46] font-urdu pt-0.5">
                        طالب علم: {user.nameUr || user.name || 'طالب علم'} ({user.studentCode || ''}) — {user.classNameUr || 'تخصص فی الفقہ'}
                      </div>
                    )}
                    <div className="text-xs sm:text-sm text-black font-urdu pt-1 font-semibold">
                      {formatUrduFullDate(selectedDate)}
                    </div>
                  </div>

                  {/* Section 1: اساتذہ کرام اسباق کارگزاری (Only for Staff / Admin) */}
                  {user?.role !== 'student' && (
                    <div className="space-y-2">
                      <div className="text-center font-bold text-sm sm:text-base text-black font-urdu">
                        اساتذہ کرام اسباق کارگزاری ({displayLessons.length} اسباق)
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse border-2 border-black text-center font-urdu">
                          <thead>
                            <tr className="bg-[#FEF3C7] text-black font-bold">
                              <th className="border border-black py-2.5 px-2 text-center font-bold w-[18%]">نام اساتذہ کرام</th>
                              <th className="border border-black py-2.5 px-2 text-center font-bold w-[16%]">نام کتاب</th>
                              <th className="border border-black py-2.5 px-2 text-center font-bold w-[16%]">سبق حاضری/اوقات</th>
                              <th className="border border-black py-2.5 px-3 text-center font-bold w-[24%]">عبارت (ابتداء تا انتہاء)</th>
                              <th className="border border-black py-2.5 px-2 text-center font-bold w-[10%]">صفحہ (ابتداء تا انتہاء)</th>
                              <th className="border border-black py-2.5 px-2 text-center font-bold w-[8%]">یومیہ صفحات</th>
                              <th className="border border-black py-2.5 px-2 text-center font-bold w-[8%]">تاحال کل صفحات</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayLessons.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="border border-black py-6 text-center text-gray-500 font-urdu">
                                  اس تاریخ ({selectedDate}) کے اساتذہ کرام کے تدریسی اسباق کا کوئی ریکارڈ درج نہیں ہے۔
                                </td>
                              </tr>
                            ) : (
                              displayLessons.map((l: any, idx: number) => {
                                const pageSpan = l.end_position && l.end_position !== l.start_position
                                  ? `${l.end_position} تا ${l.start_position}`
                                  : (l.start_position || '—');
                                const textSpan = l.end_title
                                  ? `${l.start_title} تا ${l.end_title}`
                                  : (l.start_title || '—');
                                return (
                                  <tr key={l.id || idx} className="hover:bg-amber-50/40">
                                    <td className="border border-black py-2 px-2 font-semibold text-black">
                                      {pick(l.teacher_name, l.teacher_name_ur)}
                                    </td>
                                    <td className="border border-black py-2 px-2">
                                      {pick(l.book_title_en, l.book_title_ur)}
                                    </td>
                                    <td className="border border-black py-2 px-2">
                                      {l.lesson_timing || (l.attendance_status === 'present' ? 'حاضر' : 'حاضر')}
                                    </td>
                                    <td className="border border-black py-2 px-3 text-start">
                                      {textSpan}
                                    </td>
                                    <td className="border border-black py-2 px-2 font-mono-code font-bold">
                                      {pageSpan}
                                    </td>
                                    <td className="border border-black py-2 px-2 font-bold font-mono-code">
                                      {l.daily_pages || 1}
                                    </td>
                                    <td className="border border-black py-2 px-2 font-bold font-mono-code">
                                      {l.cumulative_pages || '—'}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Section 2: طلباء کرام مطالعہ کارگزاری */}
                  <div className="space-y-2 pt-2">
                    <div className="text-center font-bold text-sm sm:text-base text-black font-urdu">
                      {user?.role === 'student'
                        ? `یومیہ مطالعہ کارگزاری (${displayMutala.length} ریکارڈ)`
                        : `طلباء کرام یومیہ مطالعہ کارگزاری (${displayMutala.length} اندراجات)`}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse border-2 border-black text-center font-urdu">
                        <thead>
                          <tr className="bg-[#FEF3C7] text-black font-bold">
                            <th className="border border-black py-2.5 px-2 text-center font-bold w-[18%]">نام طلباء کرام</th>
                            <th className="border border-black py-2.5 px-3 text-center font-bold w-[36%]">عبارت (ابتداء تا انتہاء)</th>
                            <th className="border border-black py-2.5 px-2 text-center font-bold w-[16%]">صفحہ نمبر (ابتداء تا انتہاء)</th>
                            <th className="border border-black py-2.5 px-2 text-center font-bold w-[10%]">یومیہ کل صفحات</th>
                            <th className="border border-black py-2.5 px-2 text-center font-bold w-[10%]">تاحال کل صفحات</th>
                            <th className="border border-black py-2.5 px-2 text-center font-bold w-[10%]">جزئیات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayMutala.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="border border-black py-6 text-center text-gray-500 font-urdu">
                                اس تاریخ ({selectedDate}) کا طلبہ کے مطالعے کا کوئی ریکارڈ درج نہیں ہے۔
                              </td>
                            </tr>
                          ) : (
                            displayMutala.map((m: any, idx: number) => {
                              const pageSpan = m.end_position && m.end_position !== m.start_position
                                ? `${m.end_position} تا ${m.start_position}`
                                : (m.start_position || '—');
                              const textSpan = m.end_title
                                ? `${m.start_title} تا ${m.end_title}`
                                : (m.start_title || m.chapter || '—');
                              const studentName = m.full_name_ur || m.student_name_ur || pick(m.full_name, m.full_name_ur);
                              return (
                                <tr key={m.id || idx} className="hover:bg-amber-50/40">
                                  <td className="border border-black py-2 px-2 font-semibold text-black">
                                    {studentName}{' '}
                                    {m.student_code && (
                                      <span className="text-[10px] text-gray-600 font-mono-code font-normal">
                                        ({m.student_code})
                                      </span>
                                    )}
                                  </td>
                                  <td className="border border-black py-2 px-3 text-start">
                                    {textSpan}
                                  </td>
                                  <td className="border border-black py-2 px-2 font-mono-code font-bold">
                                    {pageSpan}
                                  </td>
                                  <td className="border border-black py-2 px-2 font-bold font-mono-code">
                                    {m.daily_pages || 1}
                                  </td>
                                  <td className="border border-black py-2 px-2 font-bold font-mono-code">
                                    {m.cumulative_pages || '—'}
                                  </td>
                                  <td className="border border-black py-2 px-2 font-bold text-[#065F46] font-mono-code">
                                    {m.juziyat_count || m.juziyat_notes || '—'}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="pt-8 pb-3 flex items-end justify-between px-6 sm:px-12 text-xs font-urdu text-black">
                    <div className="text-center space-y-1">
                      <div className="font-bold text-sm sm:text-base text-black">سراج الحق</div>
                      <div className="text-gray-700 font-medium">(دستخط نگران)</div>
                      <div className="pt-2 text-base font-serif italic text-gray-500">سراج الحق ✍️</div>
                    </div>
                    <div className="text-center space-y-1">
                      <div className="font-bold text-sm sm:text-base text-black">مفتی عرفان خالد صاحب</div>
                      <div className="text-gray-700 font-medium">(دستخط ناظم)</div>
                      <div className="pt-2 text-base font-serif italic text-gray-500">عرفان خالد ✍️</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODE 2: MONTHLY CUMULATIVE ACADEMIC PERFORMANCE (اساتذہ و طلبہ دونوں کا - Exact Images 4 & 5) */}
          {academicMode === 'monthly_cumulative' && (
            <div className="space-y-4">
              {/* Monthly Controls Bar */}
              <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-[#DCE4E0]">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-[#5A6D65]">مہینہ:</span>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 text-xs bg-white font-mono-code"
                    />
                    <span className="text-xs font-bold text-[#065F46] bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                      {formatUrduMonth(selectedMonth)}
                    </span>
                  </div>

                  {user?.role !== 'student' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-[#5A6D65]">درجہ / کلاس:</span>
                      <select
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className="rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 text-xs bg-white font-urdu"
                      >
                        <option value="">تمام درجات (مجموعی)</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name_ur || cls.name_en}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#5A6D65] font-mono-code font-bold">
                    جمادی الثانی 1448ھ
                  </span>
                </div>
              </div>

              {/* Main Official Monthly Performance Sheet (A4 Print Ready) */}
              <div className="bg-white border-2 border-black p-6 sm:p-8 rounded-lg space-y-7 max-w-4xl mx-auto shadow-sm print:border-none print:shadow-none print:p-0">
                {/* Official Darul Ifta Header */}
                <div className="text-center space-y-1 pb-1">
                  <div className="text-xs text-gray-700 font-urdu font-medium">
                    نافع دار الافتاء و مرکز تحقیقات اسلامی — نظام تعلیمات و تخصص فی الفقہ
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-black font-urdu tracking-wide inline-block border-b-2 border-black pb-1">
                    {user?.role === 'student' ? 'ماہانہ مجموعی مطالعہ کارگزاری شیٹ' : 'ماہانہ مجموعی تعلیمی و تدریسی کارگزاری (اساتذہ کرام و طلبہ کرام)'}
                  </h2>
                  {user?.role === 'student' && (
                    <div className="text-xs sm:text-sm font-bold text-[#065F46] font-urdu pt-0.5">
                      طالب علم: {user.nameUr || user.name || 'طالب علم'} ({user.studentCode || ''}) — {user.classNameUr || 'تخصص فی الفقہ'}
                    </div>
                  )}
                  <div className="text-xs sm:text-sm text-black font-urdu pt-1 font-semibold">
                    مہینہ: {formatUrduMonth(selectedMonth)} بمطابق جمادی الثانی 1448ھ
                  </div>
                </div>

                {/* ============================================================== */}
                {/* SECTION 1: اساتذہ کرام کی ماہانہ مجموعی کارگزاری (Only for Staff / Admin) */}
                {/* ============================================================== */}
                {user?.role !== 'student' && (
                  <div className="space-y-2">
                    <div className="text-center font-bold text-base sm:text-lg text-black font-urdu border-b border-black/40 pb-1">
                      ماہانہ مجموعی کارگزاری (اساتذہ کرام)
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse border-2 border-black text-center font-urdu">
                        <thead>
                          <tr className="bg-[#FEF3C7] text-black font-bold">
                            <th className="border border-black py-2.5 px-2 text-center font-bold w-[18%]">نام استاد و کتاب</th>
                            <th className="border border-black py-2.5 px-3 text-center font-bold w-[18%]">عبارت (آغاز)</th>
                            <th className="border border-black py-2.5 px-3 text-center font-bold w-[18%]">عبارت (اختتام)</th>
                            <th className="border border-black py-2.5 px-2 text-center font-bold w-[12%]">صفحہ (اول تا آخر)</th>
                            <th className="border border-black py-2.5 px-2 text-center font-bold w-[8%]">ماہانہ کل صفحات</th>
                            <th className="border border-black py-2.5 px-2 text-center font-bold w-[8%]">ماہانہ دورانیہ</th>
                            <th className="border border-black py-2.5 px-2 text-center font-bold w-[6%]">ماہانہ غیر حاضری</th>
                            <th className="border border-black py-2.5 px-2 text-center font-bold w-[12%]">ماہانہ نصاب ، مکمل / نامکمل</th>
                          </tr>
                        </thead>
                        <tbody>
                          {DEFAULT_TEACHER_CUMULATIVE
                            .filter((tc) => !selectedClassId || tc.class_id === selectedClassId)
                            .map((tc) => (
                              <tr key={tc.id} className="hover:bg-amber-50/40">
                                <td className="border border-black py-2 px-2 font-bold text-black whitespace-nowrap">
                                  <div>{tc.teacher_name}</div>
                                  <div className="text-[10px] text-gray-700 font-normal">({tc.book_title})</div>
                                </td>
                                <td className="border border-black py-2 px-2 text-start font-medium">{tc.start_excerpt}</td>
                                <td className="border border-black py-2 px-2 text-start font-medium">{tc.end_excerpt}</td>
                                <td className="border border-black py-2 px-2 font-mono-code font-bold">{tc.pages_span}</td>
                                <td className="border border-black py-2 px-2 font-mono-code font-bold text-[#065F46]">{tc.total_pages}</td>
                                <td className="border border-black py-2 px-2 font-bold">{tc.monthly_duration}</td>
                                <td className="border border-black py-2 px-2 font-mono-code font-bold text-rose-700">{tc.absences}</td>
                                <td className="border border-black py-2 px-2 font-bold text-emerald-800 bg-emerald-50/50">{tc.syllabus_status}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ============================================================== */}
                {/* SECTION 2: طلباء کرام کی ماہانہ مجموعی کارگزاری */}
                {/* ============================================================== */}
                <div className="space-y-2 pt-2">
                  {/* Centered Heading */}
                  <div className="text-center space-y-0.5 pt-1">
                    <div className="font-bold text-base sm:text-lg text-black font-urdu">ماہانہ مجموعی کارگزاری</div>
                  </div>

                  {/* Table matching Attachment 4 Columns */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse border-2 border-black text-center font-urdu">
                      <thead>
                        <tr className="bg-[#FEF3C7] text-black font-bold">
                          <th className="border border-black py-2.5 px-2 text-center font-bold w-[16%]">طالب علم</th>
                          <th className="border border-black py-2.5 px-2 text-center font-bold w-[14%]">کتاب</th>
                          <th className="border border-black py-2.5 px-3 text-center font-bold w-[18%]">ابتداء عبارت / عنوان</th>
                          <th className="border border-black py-2.5 px-3 text-center font-bold w-[18%]">انتہاء عبارت / عنوان</th>
                          <th className="border border-black py-2.5 px-2 text-center font-bold w-[11%]">صفحہ (ابتداء تا انتہاء)</th>
                          <th className="border border-black py-2.5 px-2 text-center font-bold w-[7%]">ماہانہ کل صفحات</th>
                          <th className="border border-black py-2.5 px-2 text-center font-bold w-[7%]">تاحال کل صفحات</th>
                          <th className="border border-black py-2.5 px-2 text-center font-bold w-[9%]">کل جزئیات / خلاصہ جات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DEFAULT_STUDENT_CUMULATIVE
                          .filter((sc) => {
                            if (user?.role === 'student') {
                              return (
                                (user.studentId && (sc.student_id === user.studentId || sc.id === user.studentId)) ||
                                (user.studentCode && (sc.student_code === user.studentCode || sc.student_id === user.studentCode))
                              );
                            }
                            return !selectedClassId || sc.class_id === selectedClassId;
                          })
                          .map((sc) => (
                            <tr key={sc.id} className="hover:bg-amber-50/40">
                              <td className="border border-black py-2 px-2 font-bold text-black whitespace-nowrap">
                                <div>{sc.student_name}</div>
                                <div className="text-[10px] text-gray-600 font-mono-code font-normal">({sc.student_code})</div>
                              </td>
                              <td className="border border-black py-2 px-2 font-medium">{sc.book_title}</td>
                              <td className="border border-black py-2 px-2 text-start font-medium">{sc.start_excerpt}</td>
                              <td className="border border-black py-2 px-2 text-start font-medium">{sc.end_excerpt}</td>
                              <td className="border border-black py-2 px-2 font-mono-code font-bold">{sc.pages_span}</td>
                              <td className="border border-black py-2 px-2 font-mono-code font-bold text-[#065F46]">{sc.monthly_pages}</td>
                              <td className="border border-black py-2 px-2 font-mono-code font-bold text-[#0F172A]">{sc.cumulative_pages}</td>
                              <td className="border border-black py-2 px-2 text-[#065F46] font-medium">{sc.juziyat_count}</td>
                            </tr>
                          ))}

                        {/* Full Width Row: ماہانہ نصاب (Exact from Attachment 4) */}
                        <tr className="bg-[#FEF9C3] font-bold text-black">
                          <td className="border border-black py-2.5 px-3 font-bold text-center text-sm" colSpan={2}>
                            ماہانہ نصاب
                          </td>
                          <td className="border border-black py-2.5 px-4 text-start font-medium text-xs leading-relaxed" colSpan={6}>
                            مقررہ ماہانہ نصاب بحمد اللہ مکمل ہے۔ تمام طلبہ نے اپنے درجات کے مطابق فقہی کتب کے ابواب و مباحث کا فہم و درایت کے ساتھ عمیق مطالعہ کیا اور خلاصہ جات و جزئیات باحسن طریق ضبط کیے۔
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Signatures */}
                <div className="pt-8 pb-3 flex items-end justify-between px-6 sm:px-12 text-xs font-urdu text-black">
                  <div className="text-center space-y-1">
                    <div className="font-bold text-sm sm:text-base text-black">سراج الحق</div>
                    <div className="text-gray-700 font-medium">(دستخط نگران)</div>
                    <div className="pt-2 text-base font-serif italic text-gray-500">سراج الحق ✍️</div>
                  </div>
                  <div className="text-center space-y-1">
                    <div className="font-bold text-sm sm:text-base text-black">مفتی عرفان خالد صاحب</div>
                    <div className="text-gray-700 font-medium">(دستخط ناظم)</div>
                    <div className="pt-2 text-base font-serif italic text-gray-500">عرفان خالد ✍️</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. ADD / EDIT MUTALA MODAL (With Class, Student, Book & Fallbacks) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-[#DCE4E0] bg-white p-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#E5ECE8]">
              <h3 className="text-sm font-bold text-[#111C18] font-urdu flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[#065F46]" />
                <span>{editingLog ? 'مطالعہ اندراج کی ترمیم' : 'کارگزاری یومیہ مطالعہ اندراج'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 pt-3 text-xs font-urdu">
              {/* Row 1: Class & Student Selection */}
              {user?.role === 'student' ? (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#065F46]">
                      {user.nameUr || user.name || 'طالب علم'}
                    </span>
                    {user.studentCode && (
                      <span className="text-xs bg-white px-2 py-0.5 rounded border border-emerald-300 text-gray-700 font-mono-code font-bold">
                        {user.studentCode}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-emerald-800 font-medium">
                    {classes.find((c) => c.id === form.class_id)?.name_ur || 'تخصص فی الفقہ'}
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[#5A6D65] font-semibold mb-1">درجہ / کلاس *</label>
                    <select
                      value={form.class_id}
                      required
                      onChange={(e) => {
                        const newCls = e.target.value;
                        const inClass = students.filter((s) => !newCls || s.class_id === newCls);
                        setForm({
                          ...form,
                          class_id: newCls,
                          student_id: inClass[0]?.id || form.student_id,
                        });
                      }}
                      className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 bg-white font-medium"
                    >
                      <option value="">درجہ منتخب کریں</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name_ur || cls.name_en}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#5A6D65] font-semibold mb-1">نام طالب علم *</label>
                    <select
                      value={form.student_id}
                      required
                      onChange={(e) => {
                        const stId = e.target.value;
                        const stObj = students.find((s) => s.id === stId);
                        setForm({
                          ...form,
                          student_id: stId,
                          class_id: stObj?.class_id || form.class_id,
                        });
                      }}
                      className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 font-medium bg-white"
                    >
                      <option value="">طالب علم منتخب کریں</option>
                      {students
                        .filter((st) => !form.class_id || st.class_id === form.class_id)
                        .map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.full_name_ur || st.full_name} ({st.student_code})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Row 2: Date & Maktaba */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[#5A6D65] font-semibold mb-1">تاریخ *</label>
                  <input
                    type="date"
                    required
                    value={form.study_date}
                    onChange={(e) => setForm({ ...form, study_date: e.target.value })}
                    className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 bg-white font-mono-code"
                  />
                </div>

                <div>
                  <label className="block text-[#5A6D65] font-semibold mb-1">مکتبہ / اشاعت</label>
                  <input
                    type="text"
                    placeholder="مثلاً: مکتبہ امدادیہ"
                    value={form.maktaba}
                    onChange={(e) => setForm({ ...form, maktaba: e.target.value })}
                    className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 bg-white"
                  />
                </div>
              </div>

              {/* Row 3: Book */}
              <div>
                <label className="block text-[#5A6D65] font-semibold mb-1">کتاب *</label>
                <select
                  value={form.book_id}
                  required
                  onChange={(e) => setForm({ ...form, book_id: e.target.value })}
                  className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 bg-white font-medium"
                >
                  <option value="">کتاب منتخب کریں</option>
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {pick(b.title_en, b.title_ur)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 4: Starting & Ending Excerpt / Heading */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[#5A6D65] font-semibold mb-1">ابتداء عبارت / عنوان *</label>
                  <input
                    type="text"
                    required
                    placeholder="جس عبارت یا عنوان سے مطالعہ شروع کیا"
                    value={form.start_title}
                    onChange={(e) => setForm({ ...form, start_title: e.target.value })}
                    className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[#5A6D65] font-semibold mb-1">انتہاء عبارت / عنوان *</label>
                  <input
                    type="text"
                    required
                    placeholder="جس عبارت یا عنوان پر مطالعہ مکمل ہوا"
                    value={form.end_title}
                    onChange={(e) => setForm({ ...form, end_title: e.target.value })}
                    className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 bg-white"
                  />
                </div>
              </div>

              {/* Row 5: Page (Start to End) & Daily Pages */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[#5A6D65] font-semibold mb-1">صفحہ (ابتداء) *</label>
                  <input
                    type="text"
                    required
                    placeholder="74"
                    value={form.start_position}
                    onChange={(e) => handlePageChange('start_position', e.target.value)}
                    className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 bg-white font-mono-code font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block text-[#5A6D65] font-semibold mb-1">صفحہ (انتہاء) *</label>
                  <input
                    type="text"
                    required
                    placeholder="84"
                    value={form.end_position}
                    onChange={(e) => handlePageChange('end_position', e.target.value)}
                    className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 bg-white font-mono-code font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block text-[#5A6D65] font-semibold mb-1">یومیہ کل صفحات</label>
                  <input
                    type="text"
                    value={form.daily_pages}
                    onChange={(e) => setForm({ ...form, daily_pages: toWesternDigits(e.target.value) })}
                    className="w-full rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 font-mono-code font-bold text-[#065F46] text-center"
                  />
                </div>
              </div>

              {/* Row 6: Cumulative Total Pages */}
              <div>
                <label className="block text-[#5A6D65] font-semibold mb-1">تاحال کل صفحات</label>
                <input
                  type="text"
                  placeholder="مثلاً: 455"
                  value={form.cumulative_pages}
                  onChange={(e) => setForm({ ...form, cumulative_pages: toWesternDigits(e.target.value) })}
                  className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 bg-white font-mono-code font-bold"
                />
              </div>

              {/* Row 7: Juziyat / Notes */}
              <div>
                <label className="block text-[#5A6D65] font-semibold mb-1">خلاصہ / جزئیات</label>
                <textarea
                  rows={2.5}
                  placeholder="مطالعے کے دوران اخذ کردہ اہم فقہی جزئیات یا خلاصہ..."
                  value={form.juziyat_notes}
                  onChange={(e) => setForm({ ...form, juziyat_notes: e.target.value })}
                  className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 bg-white"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-[#E5ECE8] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-[#DCE4E0] text-gray-700 hover:bg-gray-50"
                >
                  منسوخ کریں
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#065F46] text-white font-bold hover:bg-[#054E3A] shadow-sm"
                >
                  محفوظ کریں
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        open={!!confirmDeleteId}
        title="مطالعہ ریکارڈ حذف کریں؟"
        message="کیا آپ واقعی اس مطالعہ ریکارڈ کو حذف کرنا چاہتے ہیں؟"
        confirmLabel="حذف کریں"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
};
