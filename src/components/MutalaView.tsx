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
  CheckCircle2
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

export const MutalaView: React.FC = () => {
  const { lang, pick } = useLanguage();
  const { user } = useAuth();

  // Sub-Navigation: روزانہ مطالعہ لاگز و ریکارڈ vs یومیہ کارگزاری (اساتذہ اسباق و طلبہ مطالعہ)
  type MutalaSubTab = 'logs' | 'academic_sheet';
  const [activeTab, setActiveTab] = useState<MutalaSubTab>('logs');

  // Timeframe filters: روزانہ (Daily), ہفتہ وار (Weekly), ماہانہ (Monthly), سالانہ (Annual)
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'annual'>('daily');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Filter selections
  const [selectedDate, setSelectedDate] = useState<string>(todayLocal());
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthLocal());
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedBookId, setSelectedBookId] = useState<string>('');

  // Data
  const [logs, setLogs] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
    student_id: '',
    study_date: todayLocal(),
    book_id: '',
    maktaba: '',
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

      const [mRes, lkp, stuRes] = await Promise.all([
        apiFetch(`/api/mutala${p.toString() ? `?${p.toString()}` : ''}`, {}, user),
        apiFetch('/api/lookups', {}, user),
        apiFetch('/api/students', {}, user),
      ]);
      setLogs(Array.isArray(mRes) ? mRes : []);
      const bookList = Array.isArray(lkp?.books) ? lkp.books : [];
      setBooks(bookList);
      const studentList = Array.isArray(stuRes) ? stuRes : Array.isArray(stuRes?.students) ? stuRes.students : [];
      setStudents(studentList);

      if (user?.studentId) {
        setSelectedStudentId(user.studentId);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load study logs');
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

  // Actual recorded logs filtered strictly by the active timeframe
  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (selectedStudentId && l.student_id !== selectedStudentId) return false;
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
  }, [logs, selectedStudentId, selectedBookId, timeframe, selectedDate, weekBounds, selectedMonth, selectedYear]);

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

  const openAddModal = (preset?: { studentId?: string; bookId?: string; startFrom?: string; studyDate?: string }) => {
    setEditingLog(null);
    setForm({
      student_id: preset?.studentId || selectedStudentId || user?.studentId || students?.[0]?.id || '',
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
    const payload = {
      ...form,
      start_position: toWesternDigits(form.start_position),
      end_position: toWesternDigits(form.end_position),
      daily_pages: toWesternDigits(form.daily_pages),
      cumulative_pages: toWesternDigits(form.cumulative_pages),
      chapter: form.start_title || 'مطالعہ',
      study_details: form.juziyat_notes || '',
    };
    if (editingLog) {
      await apiFetch(`/api/mutala/${editingLog.id}`, { method: 'PUT', body: JSON.stringify(payload) }, user);
    } else {
      await apiFetch('/api/mutala', { method: 'POST', body: JSON.stringify(payload) }, user);
    }
    setModalOpen(false);
    setEditingLog(null);
    await load();
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

  const displayLessons = academicReports.dailyLessons || [];
  const displayMutala = (academicReports.dailyMutala && academicReports.dailyMutala.length > 0)
    ? academicReports.dailyMutala
    : logs
        .filter((l) => l.study_date === selectedDate)
        .map((l) => ({
          ...l,
          full_name_ur: l.student_name_ur || l.full_name_ur,
          full_name: l.student_name || l.full_name,
        }));

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
            {lang === 'ur' ? '📚 روزانہ مطالعہ لاگز و ریکارڈ' : '📚 Study Logs & Entries'}
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
            {lang === 'ur' ? '📖 یومیہ کارگزاری (اساتذہ اسباق و طلبہ مطالعہ)' : '📖 Daily Academic Log (Lessons & Mutala)'}
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

        {/* Filters (Student, Book, and Period Navigation) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-[#EEF2F0]">
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
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.full_name_ur || st.full_name} ({st.student_code})
                </option>
              ))}
            </select>
          </div>

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
            <div className="rounded-xl border border-dashed border-[#DCE4E0] bg-white p-8 text-center space-y-2">
              <BookOpen className="h-8 w-8 text-[#5A6D65] mx-auto opacity-35" />
              <div className="text-xs font-bold text-[#111C18]">
                منتخب مدت کا کوئی مطالعہ ریکارڈ درج نہیں ہے
              </div>
              <button
                type="button"
                onClick={() => openAddModal({ studyDate: selectedDate })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#065F46] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#054E3A]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ نیا مطالعہ درج کریں</span>
              </button>
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

      {/* 2. ACADEMIC SHEET TAB (یومیہ کارگزاری: اساتذہ اسباق و طلبہ مطالعہ) */}
      {activeTab === 'academic_sheet' && (
        <div className="space-y-4 font-urdu">
          {/* Controls Bar */}
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
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0B2545] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#103563] shadow-sm whitespace-nowrap"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{lang === 'ur' ? 'پرنٹ شیٹ (A4 Print / PDF)' : 'Print Register'}</span>
            </button>
          </div>

          {/* Official Academic Sheet */}
          {loadingAcademic ? (
            <div className="py-16 text-center text-gray-500 font-urdu text-sm bg-white rounded-lg border border-[#DCE4E0]">
              تعلیمی کارگزاری شیٹ لوڈ ہو رہی ہے...
            </div>
          ) : (
            <div className="bg-white border-2 border-black p-6 sm:p-8 rounded-lg space-y-6 max-w-4xl mx-auto shadow-sm print:border-none print:shadow-none print:p-0">
              {/* Header */}
              <div className="text-center space-y-1 pb-1">
                <h2 className="text-xl sm:text-2xl font-bold text-black font-urdu tracking-wide inline-block border-b-2 border-black pb-1">
                  یومیہ کارگزاری تخصص فی الفقہ والافتاء (اسباق و مطالعہ)
                </h2>
                <div className="text-xs sm:text-sm text-black font-urdu pt-1 font-semibold">
                  {formatUrduFullDate(selectedDate)}
                </div>
              </div>

              {/* Section 1: اساتذہ کرام اسباق کارگزاری */}
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

              {/* Section 2: مطالعہ کارگزاری */}
              <div className="space-y-2 pt-2">
                <div className="text-center font-bold text-sm sm:text-base text-black font-urdu">
                  طلباء کرام یومیہ مطالعہ کارگزاری ({displayMutala.length} اندراجات)
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

      {/* 5. ADD / EDIT MUTALA MODAL (Exact Sheet Fields Only) */}
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
              {/* Row 1: Student & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[#5A6D65] font-semibold mb-1">نام طالب علم *</label>
                  <select
                    value={form.student_id}
                    required
                    onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                    className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 bg-white"
                  >
                    <option value="">طالب علم منتخب کریں</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.full_name_ur || st.full_name} ({st.student_code})
                      </option>
                    ))}
                  </select>
                </div>

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
              </div>

              {/* Row 2: Book & Maktaba */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[#5A6D65] font-semibold mb-1">کتاب *</label>
                  <select
                    value={form.book_id}
                    required
                    onChange={(e) => setForm({ ...form, book_id: e.target.value })}
                    className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 bg-white"
                  >
                    <option value="">کتاب منتخب کریں</option>
                    {books.map((b) => (
                      <option key={b.id} value={b.id}>{pick(b.title_en, b.title_ur)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#5A6D65] font-semibold mb-1">مکتبہ</label>
                  <input
                    type="text"
                    placeholder="مثلاً: مکتبہ امدادیہ"
                    value={form.maktaba}
                    onChange={(e) => setForm({ ...form, maktaba: e.target.value })}
                    className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 bg-white"
                  />
                </div>
              </div>

              {/* Row 3: Starting & Ending Excerpt / Heading */}
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

              {/* Row 4: Page (Start to End) & Daily Pages */}
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

              {/* Row 5: Cumulative Total Pages */}
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

              {/* Row 6: Juziyat / Notes */}
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
