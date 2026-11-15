import React, { useEffect, useState } from 'react';
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
  Clock,
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

export const LessonsView: React.FC = () => {
  const { lang, pick } = useLanguage();
  const { user, canRecordLessons } = useAuth();

  // Timeframe: روزانہ (Daily), ہفتہ وار (Weekly), ماہانہ (Monthly), سالانہ (Annual)
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'annual'>('daily');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(todayLocal());
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthLocal());
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [bookFilter, setBookFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');

  // Data
  const [data, setData] = useState<{ lessons: any[] }>({ lessons: [] });
  const [lookups, setLookups] = useState<any>({ classes: [], subjects: [], books: [], teachers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    teacher_id: '',
    lesson_date: todayLocal(),
    class_id: '',
    subject_id: '',
    book_id: '',
    start_title: '',
    end_title: '',
    lesson_timing: '8:15 تا 8:45',
    attendance_status: 'present',
    start_position: '',
    end_position: '',
    daily_pages: '1',
    cumulative_pages: '',
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      if (classFilter) p.set('classId', classFilter);
      if (teacherFilter) p.set('teacherId', teacherFilter);
      if (bookFilter) p.set('bookId', bookFilter);

      const [res, lkp] = await Promise.all([
        apiFetch(`/api/lessons${p.toString() ? `?${p.toString()}` : ''}`, {}, user),
        apiFetch('/api/lookups', {}, user),
      ]);
      setData({
        lessons: res?.lessons || (Array.isArray(res) ? res : []),
      });
      setLookups({
        teachers: lkp?.teachers || [],
        classes: lkp?.classes || [],
        subjects: lkp?.subjects || [],
        books: lkp?.books || [],
      });
      if (user?.teacherId) {
        setTeacherFilter(user.teacherId);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load lessons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [classFilter, teacherFilter, bookFilter]);

  const getWeekBounds = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const curr = new Date(y, m - 1, d);
    const day = curr.getDay();
    const diffToMonday = curr.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(curr.setDate(diffToMonday));
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);

    const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
    const startStr = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
    const endStr = `${saturday.getFullYear()}-${pad(saturday.getMonth() + 1)}-${pad(saturday.getDate())}`;
    return { start: startStr, end: endStr };
  };

  const weekBounds = getWeekBounds(selectedDate);

  const filteredLessons = data.lessons.filter((l) => {
    if (teacherFilter && l.teacher_id !== teacherFilter) return false;
    if (bookFilter && l.book_id !== bookFilter) return false;
    if (classFilter && l.class_id !== classFilter) return false;

    if (timeframe === 'daily') {
      return l.lesson_date === selectedDate;
    }
    if (timeframe === 'weekly') {
      return l.lesson_date >= weekBounds.start && l.lesson_date <= weekBounds.end;
    }
    if (timeframe === 'monthly') {
      return l.lesson_date?.startsWith(selectedMonth);
    }
    if (timeframe === 'annual') {
      return l.lesson_date?.startsWith(selectedYear);
    }
    return true;
  });

  const totalLessonsCount = filteredLessons.length;
  const totalPagesTaught = filteredLessons.reduce((acc, l) => {
    const dp = Number(toWesternDigits(l.daily_pages));
    if (!isNaN(dp) && dp > 0) return acc + dp;
    const s = parseInt(toWesternDigits(l.start_position), 10);
    const e = parseInt(toWesternDigits(l.end_position), 10);
    return acc + (!isNaN(s) && !isNaN(e) && e >= s ? e - s + 1 : 1);
  }, 0);

  const latestTaughtPos = toWesternDigits(filteredLessons[0]?.end_position || filteredLessons[0]?.start_position || '—');

  const handlePageChange = (field: 'start_position' | 'end_position', val: string) => {
    const wVal = toWesternDigits(val);
    const updated = { ...form, [field]: wVal };
    const s = parseInt(updated.start_position, 10);
    const e = parseInt(updated.end_position, 10);
    if (!isNaN(s) && !isNaN(e) && e >= s) {
      updated.daily_pages = String(e - s + 1);
    }
    setForm(updated);
  };

  const openAddModal = (preset?: {
    book_id?: string;
    class_id?: string;
    start_position?: string;
    teacher_id?: string;
    lesson_date?: string;
  }) => {
    setEditingLesson(null);
    setForm({
      teacher_id: preset?.teacher_id || teacherFilter || user?.teacherId || lookups.teachers?.[0]?.id || '',
      lesson_date: preset?.lesson_date || selectedDate || todayLocal(),
      class_id: preset?.class_id || classFilter || lookups.classes?.[0]?.id || '',
      subject_id: lookups.subjects?.[0]?.id || '',
      book_id: preset?.book_id || bookFilter || lookups.books?.[0]?.id || '',
      start_title: '',
      end_title: '',
      lesson_timing: '8:15 تا 8:45',
      attendance_status: 'present',
      start_position: preset?.start_position ? toWesternDigits(preset.start_position) : '',
      end_position: '',
      daily_pages: '1',
      cumulative_pages: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (l: any) => {
    setEditingLesson(l);
    setForm({
      teacher_id: l.teacher_id,
      lesson_date: l.lesson_date,
      class_id: l.class_id,
      subject_id: l.subject_id,
      book_id: l.book_id,
      start_title: l.start_title || '',
      end_title: l.end_title || '',
      lesson_timing: toWesternDigits(l.lesson_timing || '8:15 تا 8:45'),
      attendance_status: l.attendance_status || 'present',
      start_position: toWesternDigits(l.start_position || ''),
      end_position: toWesternDigits(l.end_position || ''),
      daily_pages: toWesternDigits(l.daily_pages ? String(l.daily_pages) : '1'),
      cumulative_pages: toWesternDigits(l.cumulative_pages ? String(l.cumulative_pages) : ''),
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      start_position: toWesternDigits(form.start_position),
      end_position: toWesternDigits(form.end_position),
      daily_pages: toWesternDigits(form.daily_pages),
      cumulative_pages: toWesternDigits(form.cumulative_pages),
      lesson_timing: toWesternDigits(form.lesson_timing),
    };
    if (editingLesson) {
      await apiFetch(`/api/lessons/${editingLesson.id}`, { method: 'PUT', body: JSON.stringify(payload) }, user);
    } else {
      await apiFetch('/api/lessons', { method: 'POST', body: JSON.stringify(payload) }, user);
    }
    setModalOpen(false);
    setEditingLesson(null);
    await load();
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    await apiFetch(`/api/lessons/${confirmDeleteId}`, { method: 'DELETE' }, user);
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

  return (
    <div className="space-y-4">
      {/* 1. TOOLBAR & FILTERS */}
      <div className="no-print rounded-xl border border-[#DCE4E0] bg-white p-3.5 sm:p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Timeframe switcher */}
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
              {lang === 'ur' ? 'روزانہ' : 'Daily'}
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
              {lang === 'ur' ? 'ہفتہ وار' : 'Weekly'}
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
              {lang === 'ur' ? 'ماہانہ' : 'Monthly'}
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
              {lang === 'ur' ? 'سالانہ' : 'Annual'}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {timeframe !== 'annual' && (
              <div className="inline-flex items-center rounded-lg border border-[#DCE4E0] bg-[#F6F8F7] p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  title={lang === 'ur' ? 'ٹیبل ویو' : 'Table View'}
                  className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-white text-[#065F46] shadow-sm' : 'text-[#5A6D65]'}`}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  title={lang === 'ur' ? 'کارڈز ویو' : 'Cards View'}
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
              <span>{lang === 'ur' ? 'پرنٹ' : 'Print'}</span>
            </button>

            {canRecordLessons && (
              <button
                type="button"
                onClick={() => openAddModal()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#065F46] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#054E3A] shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>{lang === 'ur' ? '+ نیا سبق درج کریں' : '+ Add Lesson'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-[#EEF2F0]">
          <div>
            <label className="block text-[11px] font-medium text-[#5A6D65] mb-1 font-urdu">
              {lang === 'ur' ? 'استاد محترم' : 'Teacher'}
            </label>
            <select
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 text-xs bg-white font-urdu focus:ring-1 focus:ring-[#065F46]"
            >
              <option value="">{lang === 'ur' ? 'تمام اساتذہ' : 'All Teachers'}</option>
              {lookups.teachers.map((t: any) => (
                <option key={t.id} value={t.id}>{t.full_name_ur || t.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#5A6D65] mb-1 font-urdu">
              {lang === 'ur' ? 'کتاب' : 'Book'}
            </label>
            <select
              value={bookFilter}
              onChange={(e) => setBookFilter(e.target.value)}
              className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 text-xs bg-white font-urdu focus:ring-1 focus:ring-[#065F46]"
            >
              <option value="">{lang === 'ur' ? 'تمام کتب' : 'All Books'}</option>
              {lookups.books.map((b: any) => (
                <option key={b.id} value={b.id}>{pick(b.title_en, b.title_ur)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#5A6D65] mb-1 font-urdu">
              {lang === 'ur' ? 'درجہ' : 'Class'}
            </label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 text-xs bg-white font-urdu focus:ring-1 focus:ring-[#065F46]"
            >
              <option value="">{lang === 'ur' ? 'تمام درجات' : 'All Classes'}</option>
              {lookups.classes.map((c: any) => (
                <option key={c.id} value={c.id}>{pick(c.name_en, c.name_ur)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#5A6D65] mb-1 font-urdu">
              {timeframe === 'daily'
                ? (lang === 'ur' ? 'تاریخ' : 'Date')
                : timeframe === 'weekly'
                ? (lang === 'ur' ? 'ہفتہ' : 'Week')
                : timeframe === 'monthly'
                ? (lang === 'ur' ? 'مہینہ' : 'Month')
                : (lang === 'ur' ? 'سال' : 'Year')}
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
                  {lang === 'ur' ? 'آج' : 'Today'}
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
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 text-xs bg-white font-mono-code"
              />
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

      {/* 2. SLEEK METRICS (Western 1234 Digits) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="rounded-xl border border-[#DCE4E0] bg-white p-3 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-[#5A6D65] font-urdu">{lang === 'ur' ? 'کل اسباق' : 'Total Lessons'}</div>
            <div className="text-xl font-bold font-mono-code text-[#065F46] mt-0.5">
              {totalLessonsCount} <span className="text-xs font-normal text-gray-500 font-urdu">اسباق</span>
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center text-[#065F46] shrink-0">
            <BookMarked className="h-4 w-4" />
          </div>
        </div>

        <div className="rounded-xl border border-[#DCE4E0] bg-white p-3 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-[#5A6D65] font-urdu">{lang === 'ur' ? 'تدریسی صفحات' : 'Pages Taught'}</div>
            <div className="text-xl font-bold font-mono-code text-[#0284C7] mt-0.5">
              {totalPagesTaught} <span className="text-xs font-normal text-gray-500 font-urdu">صفحات</span>
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-sky-50 flex items-center justify-center text-[#0284C7] shrink-0">
            <BookOpen className="h-4 w-4" />
          </div>
        </div>

        <div className="rounded-xl border border-[#DCE4E0] bg-white p-3 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-[#5A6D65] font-urdu">{lang === 'ur' ? 'اوسط دورانیہ' : 'Duration'}</div>
            <div className="text-xl font-bold font-mono-code text-amber-600 mt-0.5">
              45 <span className="text-xs font-normal text-gray-500 font-urdu">منٹ</span>
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Clock className="h-4 w-4" />
          </div>
        </div>

        <div className="rounded-xl border border-[#DCE4E0] bg-white p-3 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-[#5A6D65] font-urdu">{lang === 'ur' ? 'آخری پڑھایا گیا صفحہ' : 'Latest Page'}</div>
            <div className="text-xl font-bold font-mono-code text-indigo-600 mt-0.5">
              {latestTaughtPos}
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <BookMarked className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* 3. MAIN CONTENT DISPLAY (Table / Cards) */}
      {timeframe !== 'annual' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-[#DCE4E0] pb-2 text-xs">
            <div className="font-bold text-[#111C18] font-urdu">
              {timeframe === 'daily'
                ? formatUrduFullDate(selectedDate)
                : timeframe === 'weekly'
                ? `${weekBounds.start} تا ${weekBounds.end}`
                : formatUrduMonth(selectedMonth)}
            </div>
            <span className="text-[#5A6D65] font-mono-code font-bold">
              {filteredLessons.length} اسباق
            </span>
          </div>

          {filteredLessons.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#DCE4E0] bg-white p-8 text-center space-y-2">
              <BookMarked className="h-8 w-8 text-[#5A6D65] mx-auto opacity-35" />
              <div className="text-xs font-bold text-[#111C18] font-urdu">
                {lang === 'ur' ? 'کوئی تدریسی سبق درج نہیں ہے' : 'No lessons recorded'}
              </div>
              {canRecordLessons && (
                <button
                  type="button"
                  onClick={() => openAddModal({ lesson_date: selectedDate })}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#065F46] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#054E3A]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{lang === 'ur' ? '+ نیا سبق درج کریں' : '+ Add Lesson'}</span>
                </button>
              )}
            </div>
          ) : viewMode === 'table' ? (
            /* EXACT TEACHER REGISTER COLUMNS */
            <div className="rounded-xl border border-[#DCE4E0] bg-white overflow-x-auto shadow-sm">
              <table className="w-full text-xs font-urdu min-w-[850px]">
                <thead>
                  <tr className="border-b border-[#E5ECE8] bg-[#F8FAF9] text-[#5A6D65]">
                    <th className="px-3 py-2.5 text-start font-bold whitespace-nowrap">تاریخ</th>
                    <th className="px-3 py-2.5 text-start font-bold whitespace-nowrap">نام اساتذہ کرام</th>
                    <th className="px-3 py-2.5 text-start font-bold whitespace-nowrap">نام کتاب</th>
                    <th className="px-3 py-2.5 text-center font-bold whitespace-nowrap">سبق حاضری / وقت</th>
                    <th className="px-3 py-2.5 text-start font-bold min-w-[200px]">عبارت (ابتداء تا انتہاء)</th>
                    <th className="px-3 py-2.5 text-center font-bold whitespace-nowrap">صفحہ (ابتداء تا انتہاء)</th>
                    <th className="px-3 py-2.5 text-center font-bold whitespace-nowrap">یومیہ صفحات</th>
                    <th className="px-3 py-2.5 text-center font-bold whitespace-nowrap">تاحال کل صفحات</th>
                    {canRecordLessons && <th className="px-3 py-2.5 text-end font-bold whitespace-nowrap">کارروائی</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F0]">
                  {filteredLessons.map((l) => {
                    const startP = toWesternDigits(l.start_position || '');
                    const endP = toWesternDigits(l.end_position || '');
                    const dailyP = toWesternDigits(l.daily_pages || (startP && endP ? String(parseInt(endP, 10) - parseInt(startP, 10) + 1) : '1'));
                    const cumP = toWesternDigits(l.cumulative_pages || '—');
                    const timing = toWesternDigits(l.lesson_timing || '8:15 تا 8:45');

                    return (
                      <tr key={l.id} className="hover:bg-[#F8FAF9] transition-colors">
                        <td className="px-3 py-2.5 whitespace-nowrap font-mono-code font-bold text-[#0B2545]">
                          {l.lesson_date}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-bold text-[#111C18]">
                          {pick(l.teacher_name, l.teacher_name_ur)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="font-bold text-[#065F46]">{pick(l.book_title_en, l.book_title_ur)}</div>
                          <div className="text-[10px] text-gray-500 font-mono-code">{pick(l.class_name_en, l.class_name_ur)}</div>
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[#065F46] font-mono-code text-[11px] font-bold border border-emerald-200">
                            حاضر ({timing})
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-[#2A3B34]">
                          {l.start_title || l.end_title ? (
                            <div className="space-y-0.5">
                              {l.start_title && <div>{l.start_title}</div>}
                              {l.end_title && l.end_title !== l.start_title && <div className="text-gray-500">تا: {l.end_title}</div>}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
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
                        {canRecordLessons && (
                          <td className="px-3 py-2.5 text-end whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditModal(l)}
                                className="text-[#0284C7] hover:underline"
                                title="ترمیم"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(l.id)}
                                className="text-red-600 hover:underline"
                                title="حذف"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* CLEAN CARDS VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredLessons.map((l) => {
                const startP = toWesternDigits(l.start_position || '');
                const endP = toWesternDigits(l.end_position || '');
                const dailyP = toWesternDigits(l.daily_pages || (startP && endP ? String(parseInt(endP, 10) - parseInt(startP, 10) + 1) : '1'));
                const cumP = toWesternDigits(l.cumulative_pages || '—');
                const timing = toWesternDigits(l.lesson_timing || '8:15 تا 8:45');

                return (
                  <div
                    key={l.id}
                    className="rounded-xl border border-[#DCE4E0] bg-white p-3.5 shadow-sm hover:shadow transition-all space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono-code text-xs font-bold text-[#065F46]">{l.lesson_date}</span>
                      <div className="flex items-center gap-1">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[#065F46] font-mono-code text-[11px] font-bold border border-emerald-200">
                          حاضر ({timing})
                        </span>
                        {canRecordLessons && (
                          <>
                            <button type="button" onClick={() => openEditModal(l)} className="p-1 text-[#0284C7] hover:bg-sky-50 rounded">
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => setConfirmDeleteId(l.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-bold text-[#111C18] font-urdu">{pick(l.teacher_name, l.teacher_name_ur)}</div>
                      <div className="text-xs text-[#065F46] font-bold font-urdu">
                        {pick(l.book_title_en, l.book_title_ur)}
                      </div>
                    </div>

                    {(l.start_title || l.end_title) && (
                      <div className="rounded-lg bg-[#F8FAF9] p-2 text-xs text-[#2A3B34] font-urdu">
                        <div className="font-semibold text-[#5A6D65]">عبارت:</div>
                        <div className="line-clamp-2">{l.start_title} {l.end_title && l.end_title !== l.start_title ? `تا ${l.end_title}` : ''}</div>
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. ANNUAL VIEW (Months grid with Western 1234 Digits) */}
      {timeframe === 'annual' && (
        <div className="rounded-xl border border-[#DCE4E0] bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-sm font-bold text-[#111C18] font-urdu">
            <span>سالانہ تدریسی کارگزاری برائے سال {selectedYear}ء</span>
            <span className="font-mono-code text-[#065F46]">{totalPagesTaught} کل صفحات</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {annualMonths.map((m) => {
              const monthStr = `${selectedYear}-${m.num}`;
              const mLessons = data.lessons.filter((l) => {
                if (teacherFilter && l.teacher_id !== teacherFilter) return false;
                if (bookFilter && l.book_id !== bookFilter) return false;
                return l.lesson_date?.startsWith(monthStr);
              });
              const mPages = mLessons.reduce((acc, l) => acc + (Number(toWesternDigits(l.daily_pages)) || 1), 0);

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
                    <span className="font-bold text-xs text-[#111C18] font-urdu">{m.name}</span>
                    <span className="font-mono-code text-[10px] text-gray-400">{m.num}</span>
                  </div>
                  <div className="text-base font-bold font-mono-code text-[#065F46]">
                    {mPages} <span className="text-[10px] font-normal text-gray-500 font-urdu">صفحات</span>
                  </div>
                  <div className="text-[10px] text-[#5A6D65] font-mono-code">
                    {mLessons.length} اسباق
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. ADD / EDIT LESSON MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-[#DCE4E0] bg-white p-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#E5ECE8]">
              <h3 className="text-sm font-bold text-[#111C18] font-urdu flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[#065F46]" />
                <span>{editingLesson ? 'تدریسی سبق کی ترمیم' : 'نیا سبق درج کریں'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 pt-3 text-xs font-urdu">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[#5A6D65] font-semibold mb-1">استاد محترم *</label>
                  <select
                    value={form.teacher_id}
                    required
                    onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
                    className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 bg-white"
                  >
                    <option value="">استاد منتخب کریں</option>
                    {lookups.teachers.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.full_name_ur || t.full_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#5A6D65] font-semibold mb-1">تاریخ *</label>
                  <input
                    type="date"
                    required
                    value={form.lesson_date}
                    onChange={(e) => setForm({ ...form, lesson_date: e.target.value })}
                    className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 bg-white font-mono-code"
                  />
                </div>
              </div>

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
                    {lookups.books.map((b: any) => (
                      <option key={b.id} value={b.id}>{pick(b.title_en, b.title_ur)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#5A6D65] font-semibold mb-1">سبق اوقات (دورانیہ)</label>
                  <input
                    type="text"
                    placeholder="مثلاً: 8:15 تا 8:45"
                    value={form.lesson_timing}
                    onChange={(e) => setForm({ ...form, lesson_timing: e.target.value })}
                    className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 bg-white font-mono-code"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[#5A6D65] font-semibold mb-1">عبارت (ابتداء) *</label>
                  <input
                    type="text"
                    required
                    placeholder="جہاں سے سبق شروع کیا"
                    value={form.start_title}
                    onChange={(e) => setForm({ ...form, start_title: e.target.value })}
                    className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[#5A6D65] font-semibold mb-1">عبارت (انتہاء) *</label>
                  <input
                    type="text"
                    required
                    placeholder="جہاں تک سبق مکمل ہوا"
                    value={form.end_title}
                    onChange={(e) => setForm({ ...form, end_title: e.target.value })}
                    className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[#5A6D65] font-semibold mb-1">صفحہ (ابتداء) *</label>
                  <input
                    type="text"
                    required
                    placeholder="54"
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
                    placeholder="55"
                    value={form.end_position}
                    onChange={(e) => handlePageChange('end_position', e.target.value)}
                    className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 bg-white font-mono-code font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block text-[#5A6D65] font-semibold mb-1">یومیہ صفحات</label>
                  <input
                    type="text"
                    value={form.daily_pages}
                    onChange={(e) => setForm({ ...form, daily_pages: toWesternDigits(e.target.value) })}
                    className="w-full rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 font-mono-code font-bold text-[#065F46] text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#5A6D65] font-semibold mb-1">تاحال کل صفحات</label>
                <input
                  type="text"
                  placeholder="مثلاً: 51"
                  value={form.cumulative_pages}
                  onChange={(e) => setForm({ ...form, cumulative_pages: toWesternDigits(e.target.value) })}
                  className="w-full rounded-lg border border-[#DCE4E0] px-2.5 py-1.5 bg-white font-mono-code font-bold"
                />
              </div>

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
        title="تدریسی سبق حذف کریں؟"
        message="کیا آپ واقعی اس تدریسی سبق کے ریکارڈ کو حذف کرنا چاہتے ہیں؟"
        confirmLabel="حذف کریں"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
};
