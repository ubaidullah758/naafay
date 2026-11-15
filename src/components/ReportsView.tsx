import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { currentMonthLocal, todayLocal } from '../lib/date';
import { ErrorState } from './ErrorState';
import { exportToExcel, exportToPdf } from '../lib/exports';
import { StatusText } from './StatusText';

type Timeframe = 'daily' | 'weekly' | 'monthly' | 'annual';
type ReportType =
  | 'summary'
  | 'attendance'
  | 'mutala'
  | 'lessons'
  | 'studentPerf'
  | 'teacherPerf'
  | 'examRep'
  | 'researchRep';

export const ReportsView: React.FC = () => {
  const { lang, t, pick } = useLanguage();
  const { user } = useAuth();
  const [type, setType] = useState<ReportType>('summary');
  const [timeframe, setTimeframe] = useState<Timeframe>('monthly');
  const [dateFilter, setDateFilter] = useState(() => todayLocal());
  const [monthFilter, setMonthFilter] = useState(() => currentMonthLocal());
  const [classFilter, setClassFilter] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [rep, setRep] = useState<any | null>(null);
  const [attRep, setAttRep] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = async () => {
    setError(null);
    setLoading(true);
    const p = new URLSearchParams();
    p.set('timeframe', timeframe);
    p.set('date', dateFilter);
    p.set('month', monthFilter);
    if (classFilter) p.set('classId', classFilter);

    const ap = new URLSearchParams({ date: dateFilter, month: monthFilter });
    if (classFilter) ap.set('classId', classFilter);

    try {
      const [r, a] = await Promise.all([
        apiFetch(`/api/reports/overview?${p.toString()}`, {}, user),
        apiFetch(`/api/attendance/reports?${ap.toString()}`, {}, user),
      ]);
      setRep(r);
      setAttRep(a);
    } catch (err: any) {
      setError(err?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiFetch('/api/lookups', {}, user)
      .then((lkp) => setClasses(lkp.classes || []))
      .catch(() => setClasses([]));
  }, [user?.role]);

  useEffect(() => {
    loadReports();
  }, [user?.role, timeframe, dateFilter, monthFilter, classFilter]);

  const dailyRows = useMemo(() => {
    if (!attRep) return [];
    if (Array.isArray(attRep.dailyGrouped) && attRep.dailyGrouped.length > 0) {
      return attRep.dailyGrouped;
    }
    const grouped = new Map<string, any>();
    for (const r of attRep.daily || []) {
      if (!grouped.has(r.student_id)) {
        grouped.set(r.student_id, {
          student_id: r.student_id,
          student_code: r.student_code,
          full_name: r.full_name,
          full_name_ur: r.full_name_ur,
          class_name_en: r.class_name_en,
          class_name_ur: r.class_name_ur,
          attendance_date: r.attendance_date,
          sessions: {},
          remarks: '',
        });
      }
      grouped.get(r.student_id).sessions[r.session_id] = { id: r.id, status: r.status, remarks: r.remarks || '' };
    }
    return Array.from(grouped.values());
  }, [attRep]);

  if (error) {
    return <ErrorState message={error} onRetry={loadReports} />;
  }

  if (!rep) {
    return <div className="p-8 text-center text-sm text-[#5A6D65]">{t('loading')}</div>;
  }

  const students: any[] = rep.studentPerformance || [];
  const teachers: any[] = rep.teacherPerformance || [];
  const mutala: any[] = rep.studyProgress || [];
  const lessons: any[] = rep.lessonsInPeriod || [];
  const exams: any[] = rep.examReport || [];
  const research: any[] = rep.researchReport || [];

  const totals = students.reduce(
    (acc, s) => {
      acc.attTotal += Number(s.att_total) || 0;
      acc.attPresent += Number(s.att_present) || 0;
      acc.attAbsent += Number(s.att_absent) || 0;
      acc.mutalaTotal += Number(s.mutala_total) || 0;
      acc.mutalaApproved += Number(s.mutala_approved) || 0;
      return acc;
    },
    { attTotal: 0, attPresent: 0, attAbsent: 0, mutalaTotal: 0, mutalaApproved: 0 }
  );
  const attPct = totals.attTotal > 0 ? Math.round((totals.attPresent / totals.attTotal) * 100) : 0;
  const mutalaPct = totals.mutalaTotal > 0 ? Math.round((totals.mutalaApproved / totals.mutalaTotal) * 100) : 0;

  const reportTabs: Array<{ id: ReportType; label: string }> = [
    { id: 'summary', label: lang === 'ur' ? 'خلاصہ' : 'Summary' },
    { id: 'attendance', label: lang === 'ur' ? 'حاضری' : 'Attendance' },
    { id: 'mutala', label: lang === 'ur' ? 'مطالعہ' : 'Mutala' },
    { id: 'lessons', label: lang === 'ur' ? 'اسباق' : 'Lessons / Asbaq' },
    { id: 'studentPerf', label: t('repStudentPerf') },
    { id: 'teacherPerf', label: t('repTeacherPerf') },
    { id: 'examRep', label: t('repExam') },
    { id: 'researchRep', label: t('repResearch') },
  ];

  const timeframeTabs: Array<{ id: Timeframe; label: string }> = [
    { id: 'daily', label: lang === 'ur' ? 'روزانہ' : 'Daily' },
    { id: 'weekly', label: lang === 'ur' ? 'ہفتہ وار' : 'Weekly' },
    { id: 'monthly', label: lang === 'ur' ? 'ماہانہ' : 'Monthly' },
    { id: 'annual', label: lang === 'ur' ? 'سالانہ' : 'Annual' },
  ];

  const periodLabel =
    timeframe === 'daily'
      ? dateFilter
      : timeframe === 'weekly'
        ? `${lang === 'ur' ? 'ہفتہ برائے' : 'Week ending'} ${dateFilter}`
        : timeframe === 'monthly'
          ? monthFilter
          : dateFilter.slice(0, 4);

  const statusTextEn = (s?: string) => {
    if (!s) return 'Unmarked';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const handleExcel = () => {
    switch (type) {
      case 'summary':
        exportToExcel(`report_summary_${periodLabel}`, 'Summary', [
          {
            Period: periodLabel,
            Timeframe: timeframe,
            Students: students.length,
            Teachers: teachers.length,
            Attendance_Records: totals.attTotal,
            Attendance_Present: totals.attPresent,
            Attendance_Absent: totals.attAbsent,
            Attendance_Pct: `${attPct}%`,
            Mutala_Logs: totals.mutalaTotal,
            Mutala_Approved: totals.mutalaApproved,
            Mutala_Pct: `${mutalaPct}%`,
            Lessons: lessons.length,
            Exam_Results: exams.length,
            Research_Assignments: research.length,
          },
        ]);
        break;
      case 'attendance':
        exportToExcel(
          `attendance_${periodLabel}`,
          'Attendance',
          students.map((r: any) => {
            const pct = r.att_total > 0 ? Math.round((r.att_present / r.att_total) * 100) : 0;
            return {
              Student_ID: r.student_code,
              Name: r.full_name,
              Name_Urdu: r.full_name_ur || '',
              Class: r.class_name_en || '',
              Total_Records: r.att_total,
              Present: r.att_present,
              Absent: r.att_absent,
              Attendance_Pct: `${pct}%`,
            };
          })
        );
        break;
      case 'mutala':
        exportToExcel(
          `mutala_${periodLabel}`,
          'Mutala',
          mutala.map((r: any) => ({
            Date: r.study_date,
            Student_ID: r.student_code,
            Student: r.student_name,
            Book: r.book_title_en,
            Chapter: r.chapter,
            From: r.start_position,
            To: r.end_position,
            Status: r.status,
          }))
        );
        break;
      case 'lessons':
        exportToExcel(
          `lessons_${periodLabel}`,
          'Lessons',
          lessons.map((r: any) => ({
            Date: r.lesson_date,
            Teacher: r.teacher_name,
            Class: r.class_name_en || '',
            Subject: r.subject_name_en,
            Book: r.book_title_en,
            From: r.start_position,
            To: r.end_position,
          }))
        );
        break;
      case 'studentPerf':
        exportToExcel('student_performance', 'Students', students);
        break;
      case 'teacherPerf':
        exportToExcel('teacher_performance', 'Teachers', teachers);
        break;
      case 'examRep':
        exportToExcel('exam_results', 'Exams', exams);
        break;
      case 'researchRep':
        exportToExcel('research_report', 'Research', research);
        break;
    }
  };

  const handlePdf = () => {
    if (type === 'summary') {
      exportToPdf(
        `report_summary_${periodLabel}`,
        `Institution Summary (${periodLabel})`,
        'Attendance, Mutala, Asbaq, Exams & Research',
        ['Metric', 'Value'],
        [
          ['Students', students.length],
          ['Teachers', teachers.length],
          ['Attendance Records', totals.attTotal],
          ['Attendance Present', totals.attPresent],
          ['Attendance Absent', totals.attAbsent],
          ['Attendance %', `${attPct}%`],
          ['Mutala Logs', totals.mutalaTotal],
          ['Mutala Approved', totals.mutalaApproved],
          ['Mutala %', `${mutalaPct}%`],
          ['Lessons / Asbaq', lessons.length],
          ['Exam Results', exams.length],
          ['Research Assignments', research.length],
        ]
      );
    } else if (type === 'attendance') {
      exportToPdf(
        `attendance_${periodLabel}`,
        `Attendance Report (${periodLabel})`,
        'Period-wise Attendance Summary',
        ['ID', 'Student', 'Class', 'Total', 'Present', 'Absent', '%'],
        students.map((r: any) => {
          const pct = r.att_total > 0 ? Math.round((r.att_present / r.att_total) * 100) : 0;
          return [r.student_code, r.full_name, r.class_name_en || '-', r.att_total, r.att_present, r.att_absent, `${pct}%`];
        })
      );
    } else if (type === 'mutala') {
      exportToPdf(
        `mutala_${periodLabel}`,
        `Mutala Progress (${periodLabel})`,
        'Daily Study Logs',
        ['Date', 'Student', 'Book', 'Chapter', 'Range', 'Status'],
        mutala.map((r: any) => [
          r.study_date,
          r.student_name,
          r.book_title_en,
          r.chapter,
          `${r.start_position}-${r.end_position}`,
          r.status,
        ])
      );
    } else if (type === 'lessons') {
      exportToPdf(
        `lessons_${periodLabel}`,
        `Lessons / Asbaq (${periodLabel})`,
        'Daily Lesson Records',
        ['Date', 'Teacher', 'Class', 'Subject', 'Book', 'Range'],
        lessons.map((r: any) => [
          r.lesson_date,
          r.teacher_name,
          r.class_name_en || '-',
          r.subject_name_en,
          r.book_title_en,
          `${r.start_position}-${r.end_position}`,
        ])
      );
    } else if (type === 'studentPerf') {
      exportToPdf(
        'student_performance',
        'Student Performance Report',
        'Attendance, Mutala & Examination Average',
        ['ID', 'Student', 'Class', 'Attendance %', 'Mutala Approved', 'Exam Avg'],
        students.map((r: any) => {
          const pct = r.att_total > 0 ? Math.round((r.att_present / r.att_total) * 100) : 0;
          return [r.student_code, r.full_name, r.class_name_en, `${pct}%`, `${r.mutala_approved}/${r.mutala_total}`, r.avg_exam_marks ?? '-'];
        })
      );
    } else if (type === 'teacherPerf') {
      exportToPdf(
        'teacher_performance',
        'Teacher Performance Report',
        'Lessons, Mutala Reviews & Research Supervision',
        ['ID', 'Teacher', 'Specialization', 'Lessons', 'Mutala Reviews', 'Research Supervised'],
        teachers.map((r: any) => [
          r.teacher_code,
          r.full_name,
          r.specialization || '-',
          r.total_lessons,
          r.total_reviews,
          r.research_supervised,
        ])
      );
    } else if (type === 'examRep') {
      exportToPdf(
        'exam_report',
        'Examination Results Report',
        'Written + Oral Assessment Marks',
        ['Exam', 'ID', 'Student', 'Subject', 'Written', 'Oral', 'Total', 'Grade'],
        exams.map((r: any) => [
          r.exam_title_en,
          r.student_code,
          r.student_name,
          r.subject_name_en,
          r.written_marks,
          r.oral_marks,
          r.total_marks,
          r.grade,
        ])
      );
    } else {
      exportToPdf(
        'research_report',
        'Research & Maqala Report',
        'Takhassus Research Tracking',
        ['Title', 'Student', 'Supervisor', 'Deadline', 'Status'],
        research.map((r: any) => [r.title_en, r.student_name, r.supervisor_name, r.deadline, r.status])
      );
    }
  };

  const renderSessionCell = (rec?: { status?: string }) => {
    if (!rec?.status) {
      return <span className="text-[#94A3B8] whitespace-nowrap">{lang === 'ur' ? '— غیر درج' : '— Unmarked'}</span>;
    }
    return <StatusText status={rec.status} />;
  };

  const emptyRow = (cols: number) => (
    <tr>
      <td colSpan={cols} className="py-10 text-center text-[#5A6D65]">
        {t('noData')}
      </td>
    </tr>
  );

  const kpiCard = (label: string, value: React.ReactNode, sub?: string, tone = 'text-[#065F46]') => (
    <div className="rounded-lg border border-[#DCE4E0] bg-white p-4">
      <div className="text-[11px] text-[#5A6D65]">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-[#8A9A93]">{sub}</div>}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#DCE4E0] bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
            {timeframeTabs.map((tf) => (
              <button
                key={tf.id}
                type="button"
                onClick={() => setTimeframe(tf.id)}
                className={`px-3 py-1.5 rounded-md text-xs border whitespace-nowrap transition-colors ${
                  timeframe === tf.id
                    ? 'border-[#065F46] bg-[#065F46] text-white'
                    : 'border-[#DCE4E0] bg-white text-[#2A3B34] hover:bg-[#F6F8F7]'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleExcel}
              className="flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 rounded-md border border-[#DCE4E0] bg-white px-3.5 py-2 text-xs text-[#111C18] hover:bg-[#F6F8F7] whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5 text-[#065F46]" />
              <span>{t('exportExcel')}</span>
            </button>
            <button
              type="button"
              onClick={handlePdf}
              className="flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 rounded-md bg-[#065F46] px-3.5 py-2 text-xs text-white hover:bg-[#064E3B] whitespace-nowrap"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>{t('exportPdf')}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-[#EEF2F0] pt-3 overflow-x-auto">
          {reportTabs.map((rt) => (
            <button
              key={rt.id}
              type="button"
              onClick={() => setType(rt.id)}
              className={`px-3 py-1.5 rounded-md text-xs border whitespace-nowrap transition-colors ${
                type === rt.id
                  ? 'border-[#065F46] bg-[#065F46]/10 text-[#065F46] font-medium'
                  : 'border-[#DCE4E0] bg-white text-[#2A3B34] hover:bg-[#F6F8F7]'
              }`}
            >
              {rt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#EEF2F0]">
          {timeframe === 'daily' || timeframe === 'weekly' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#5A6D65] whitespace-nowrap">{t('date')}:</span>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="font-mono-code rounded-md border border-[#DCE4E0] px-3 py-1.5 text-xs bg-white"
              />
            </div>
          ) : timeframe === 'monthly' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#5A6D65] whitespace-nowrap">{lang === 'ur' ? 'مہینہ:' : 'Month:'}</span>
              <input
                type="month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="font-mono-code rounded-md border border-[#DCE4E0] px-3 py-1.5 text-xs bg-white"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#5A6D65] whitespace-nowrap">{lang === 'ur' ? 'سال:' : 'Year:'}</span>
              <input
                type="number"
                min={2000}
                max={2100}
                value={dateFilter.slice(0, 4)}
                onChange={(e) => {
                  const yr = e.target.value.slice(0, 4);
                  if (yr.length === 4) setDateFilter(`${yr}-01-01`);
                }}
                className="font-mono-code w-24 rounded-md border border-[#DCE4E0] px-3 py-1.5 text-xs bg-white"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#5A6D65] whitespace-nowrap">{t('classLabel')}:</span>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="rounded-md border border-[#DCE4E0] px-3 py-1.5 text-xs bg-white"
            >
              <option value="">{t('allClasses')}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {pick(c.name_en, c.name_ur)}
                </option>
              ))}
            </select>
          </div>

          <span className="text-[11px] text-[#8A9A93]">
            {lang === 'ur' ? `مدت: ${periodLabel}` : `Period: ${periodLabel}`}
            {loading ? (lang === 'ur' ? ' — لوڈ ہو رہا ہے…' : ' — loading…') : ''}
          </span>
        </div>
      </div>

      {type === 'summary' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {kpiCard(lang === 'ur' ? 'طلبہ' : 'Students', students.length)}
            {kpiCard(
              lang === 'ur' ? 'حاضری' : 'Attendance',
              `${attPct}%`,
              lang === 'ur'
                ? `${totals.attPresent} حاضر / ${totals.attTotal} کل`
                : `${totals.attPresent} present / ${totals.attTotal} total`
            )}
            {kpiCard(
              lang === 'ur' ? 'مطالعہ منظور' : 'Mutala Approved',
              `${totals.mutalaApproved}/${totals.mutalaTotal}`,
              `${mutalaPct}%`,
              'text-[#0B2545]'
            )}
            {kpiCard(lang === 'ur' ? 'اسباق (دورانیہ)' : 'Lessons (Period)', lessons.length, undefined, 'text-[#0B2545]')}
            {kpiCard(lang === 'ur' ? 'اساتذہ' : 'Teachers', teachers.length, undefined, 'text-[#0B2545]')}
            {kpiCard(lang === 'ur' ? 'امتحانی نتائج' : 'Exam Results', exams.length, undefined, 'text-[#0B2545]')}
            {kpiCard(lang === 'ur' ? 'ریسرچ اسائنمنٹس' : 'Research Assignments', research.length, undefined, 'text-[#0B2545]')}
            {kpiCard(
              lang === 'ur' ? 'غیر حاضر' : 'Absent Records',
              totals.attAbsent,
              undefined,
              'text-[#B91C1C]'
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="rounded-lg border border-[#DCE4E0] bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E5ECE8] text-sm font-medium text-[#111C18]">
                {lang === 'ur' ? 'حالیہ مطالعہ' : 'Recent Mutala'}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                      <th className="px-4 py-3 text-start">{t('date')}</th>
                      <th className="px-4 py-3 text-start">{t('roleStudent')}</th>
                      <th className="px-4 py-3 text-start">{t('book')}</th>
                      <th className="px-4 py-3 text-start">{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2F0]">
                    {mutala.length === 0
                      ? emptyRow(4)
                      : mutala.slice(0, 8).map((r: any) => (
                          <tr key={r.id}>
                            <td className="px-4 py-3 font-mono-code tabular-nums whitespace-nowrap">{r.study_date}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{pick(r.student_name, r.student_name_ur)}</td>
                            <td className="px-4 py-3">{pick(r.book_title_en, r.book_title_ur)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <StatusText status={r.status} />
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg border border-[#DCE4E0] bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E5ECE8] text-sm font-medium text-[#111C18]">
                {lang === 'ur' ? 'حالیہ اسباق' : 'Recent Lessons / Asbaq'}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                      <th className="px-4 py-3 text-start">{t('date')}</th>
                      <th className="px-4 py-3 text-start">{t('teacherLabel')}</th>
                      <th className="px-4 py-3 text-start">{t('subjectLabel')}</th>
                      <th className="px-4 py-3 text-start">{t('book')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2F0]">
                    {lessons.length === 0
                      ? emptyRow(4)
                      : lessons.slice(0, 8).map((r: any) => (
                          <tr key={r.id}>
                            <td className="px-4 py-3 font-mono-code tabular-nums whitespace-nowrap">{r.lesson_date}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{pick(r.teacher_name, r.teacher_name_ur)}</td>
                            <td className="px-4 py-3">{pick(r.subject_name_en, r.subject_name_ur)}</td>
                            <td className="px-4 py-3">{pick(r.book_title_en, r.book_title_ur)}</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {type === 'attendance' && (
        <div className="space-y-5">
          <div className="rounded-lg border border-[#DCE4E0] bg-white overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                  <th className="px-4 py-3 text-start">{t('studentId')}</th>
                  <th className="px-4 py-3 text-start">{t('fullNameUr')}</th>
                  <th className="px-4 py-3 text-start">{t('classLabel')}</th>
                  <th className="px-4 py-3 text-end">{lang === 'ur' ? 'کل اندراج' : 'Total'}</th>
                  <th className="px-4 py-3 text-end">{t('present')}</th>
                  <th className="px-4 py-3 text-end">{t('absent')}</th>
                  <th className="px-4 py-3 text-end">{t('attendancePct')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F0]">
                {students.length === 0
                  ? emptyRow(7)
                  : students.map((r: any) => {
                      const pct = r.att_total > 0 ? Math.round((r.att_present / r.att_total) * 100) : 0;
                      return (
                        <tr key={r.id}>
                          <td className="px-4 py-3 font-mono-code font-semibold text-[#065F46] whitespace-nowrap">{r.student_code}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{pick(r.full_name, r.full_name_ur)}</td>
                          <td className="px-4 py-3 text-[#5A6D65] whitespace-nowrap">{pick(r.class_name_en, r.class_name_ur)}</td>
                          <td className="px-4 py-3 text-end tabular-nums">{r.att_total}</td>
                          <td className="px-4 py-3 text-end tabular-nums text-[#15803D]">{r.att_present}</td>
                          <td className="px-4 py-3 text-end tabular-nums text-[#B91C1C]">{r.att_absent}</td>
                          <td className="px-4 py-3 text-end font-bold tabular-nums text-[#065F46]">{pct}%</td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>

          {timeframe === 'daily' && (
            <div className="rounded-lg border border-[#DCE4E0] bg-white overflow-x-auto">
              <div className="px-4 py-3 border-b border-[#E5ECE8] text-sm font-medium text-[#111C18]">
                {lang === 'ur' ? 'تین سیشنز کی تفصیل' : 'Three-Session Detail'} — {dateFilter}
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                    <th className="px-4 py-3 text-start whitespace-nowrap">{t('studentId')}</th>
                    <th className="px-4 py-3 text-start whitespace-nowrap">{t('fullNameUr')}</th>
                    <th className="px-4 py-3 text-start whitespace-nowrap">{lang === 'ur' ? 'صبح تا ظہر' : 'Morning to Zuhr'}</th>
                    <th className="px-4 py-3 text-start whitespace-nowrap">{lang === 'ur' ? 'ظہر تا عصر' : 'Zuhr to Asr'}</th>
                    <th className="px-4 py-3 text-start whitespace-nowrap">{lang === 'ur' ? 'مغرب تا عشاء' : 'Maghrib to Isha'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F0]">
                  {dailyRows.length === 0
                    ? emptyRow(5)
                    : dailyRows.map((r: any) => (
                        <tr key={r.student_id} className="hover:bg-[#F6F8F7]">
                          <td className="px-4 py-3 font-mono-code font-semibold text-[#065F46] whitespace-nowrap">{r.student_code}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-[#111C18]">{pick(r.full_name, r.full_name_ur)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{renderSessionCell(r.sessions?.['ses-morning'])}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{renderSessionCell(r.sessions?.['ses-zuhr'])}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{renderSessionCell(r.sessions?.['ses-maghrib'])}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {type === 'mutala' && (
        <div className="rounded-lg border border-[#DCE4E0] bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                <th className="px-4 py-3 text-start">{t('date')}</th>
                <th className="px-4 py-3 text-start">{t('roleStudent')}</th>
                <th className="px-4 py-3 text-start">{t('book')}</th>
                <th className="px-4 py-3 text-start">{t('chapter')}</th>
                <th className="px-4 py-3 text-start">{lang === 'ur' ? 'صفحہ (از — تا)' : 'Range'}</th>
                <th className="px-4 py-3 text-start">{t('status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F0]">
              {mutala.length === 0
                ? emptyRow(6)
                : mutala.map((r: any) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-mono-code tabular-nums whitespace-nowrap">{r.study_date}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {pick(r.student_name, r.student_name_ur)} ({r.student_code})
                      </td>
                      <td className="px-4 py-3">{pick(r.book_title_en, r.book_title_ur)}</td>
                      <td className="px-4 py-3 text-[#5A6D65]">{r.chapter}</td>
                      <td className="px-4 py-3 text-[#0B2545] whitespace-nowrap">
                        {r.start_position} — {r.end_position}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusText status={r.status} />
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}

      {type === 'lessons' && (
        <div className="rounded-lg border border-[#DCE4E0] bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                <th className="px-4 py-3 text-start">{t('date')}</th>
                <th className="px-4 py-3 text-start">{t('teacherLabel')}</th>
                <th className="px-4 py-3 text-start">{t('classLabel')}</th>
                <th className="px-4 py-3 text-start">{t('subjectLabel')}</th>
                <th className="px-4 py-3 text-start">{t('book')}</th>
                <th className="px-4 py-3 text-start">{lang === 'ur' ? 'صفحہ (از — تا)' : 'Range'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F0]">
              {lessons.length === 0
                ? emptyRow(6)
                : lessons.map((r: any) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-mono-code tabular-nums whitespace-nowrap">{r.lesson_date}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{pick(r.teacher_name, r.teacher_name_ur)}</td>
                      <td className="px-4 py-3 text-[#5A6D65]">{pick(r.class_name_en, r.class_name_ur)}</td>
                      <td className="px-4 py-3">{pick(r.subject_name_en, r.subject_name_ur)}</td>
                      <td className="px-4 py-3">{pick(r.book_title_en, r.book_title_ur)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.start_position} — {r.end_position}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}

      {type === 'studentPerf' && (
        <div className="rounded-lg border border-[#DCE4E0] bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                <th className="px-4 py-3 text-start">{t('studentId')}</th>
                <th className="px-4 py-3 text-start">{t('fullNameUr')}</th>
                <th className="px-4 py-3 text-start">{t('classLabel')}</th>
                <th className="px-4 py-3 text-end">{t('attendancePct')}</th>
                <th className="px-4 py-3 text-end">{t('navMutala')}</th>
                <th className="px-4 py-3 text-end">{t('totalMarks')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F0]">
              {students.length === 0
                ? emptyRow(6)
                : students.map((r: any) => {
                    const pct = r.att_total > 0 ? Math.round((r.att_present / r.att_total) * 100) : 0;
                    return (
                      <tr key={r.id}>
                        <td className="px-4 py-3 font-mono-code font-semibold text-[#065F46] whitespace-nowrap">{r.student_code}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{pick(r.full_name, r.full_name_ur)}</td>
                        <td className="px-4 py-3 text-[#5A6D65] whitespace-nowrap">{pick(r.class_name_en, r.class_name_ur)}</td>
                        <td className="px-4 py-3 text-end font-semibold tabular-nums">{pct}%</td>
                        <td className="px-4 py-3 text-end tabular-nums">
                          {r.mutala_approved} / {r.mutala_total}
                        </td>
                        <td className="px-4 py-3 text-end font-semibold tabular-nums">{r.avg_exam_marks ?? '—'}</td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      )}

      {type === 'teacherPerf' && (
        <div className="rounded-lg border border-[#DCE4E0] bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                <th className="px-4 py-3 text-start">{t('teacherId')}</th>
                <th className="px-4 py-3 text-start">{t('teacherLabel')}</th>
                <th className="px-4 py-3 text-start">{t('specialization')}</th>
                <th className="px-4 py-3 text-end">{t('navLessons')}</th>
                <th className="px-4 py-3 text-end">{t('teacherReviews')}</th>
                <th className="px-4 py-3 text-end">{t('navResearch')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F0]">
              {teachers.length === 0
                ? emptyRow(6)
                : teachers.map((r: any) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-mono-code font-semibold text-[#065F46] whitespace-nowrap">{r.teacher_code}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{pick(r.full_name, r.full_name_ur)}</td>
                      <td className="px-4 py-3 text-[#5A6D65]">{r.specialization}</td>
                      <td className="px-4 py-3 text-end tabular-nums">{r.total_lessons}</td>
                      <td className="px-4 py-3 text-end tabular-nums">{r.total_reviews}</td>
                      <td className="px-4 py-3 text-end tabular-nums">{r.research_supervised}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}

      {type === 'examRep' && (
        <div className="rounded-lg border border-[#DCE4E0] bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                <th className="px-4 py-3 text-start">{t('examTitle')}</th>
                <th className="px-4 py-3 text-start">{t('roleStudent')}</th>
                <th className="px-4 py-3 text-start">{t('subjectLabel')}</th>
                <th className="px-4 py-3 text-end">{t('writtenMarks')}</th>
                <th className="px-4 py-3 text-end">{t('oralMarks')}</th>
                <th className="px-4 py-3 text-end">{t('totalMarks')}</th>
                <th className="px-4 py-3 text-start">{t('grade')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F0]">
              {exams.length === 0
                ? emptyRow(7)
                : exams.map((r: any) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3">{pick(r.exam_title_en, r.exam_title_ur)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{pick(r.student_name, r.student_name_ur)}</td>
                      <td className="px-4 py-3">{pick(r.subject_name_en, r.subject_name_ur)}</td>
                      <td className="px-4 py-3 text-end tabular-nums">{r.written_marks}</td>
                      <td className="px-4 py-3 text-end tabular-nums">{r.oral_marks}</td>
                      <td className="px-4 py-3 text-end font-bold tabular-nums">{r.total_marks}</td>
                      <td className="px-4 py-3 text-[#065F46] whitespace-nowrap">{r.grade}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}

      {type === 'researchRep' && (
        <div className="rounded-lg border border-[#DCE4E0] bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                <th className="px-4 py-3 text-start">{t('researchTopic')}</th>
                <th className="px-4 py-3 text-start">{t('roleStudent')}</th>
                <th className="px-4 py-3 text-start">{t('supervisor')}</th>
                <th className="px-4 py-3 text-start">{t('deadline')}</th>
                <th className="px-4 py-3 text-start">{t('status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F0]">
              {research.length === 0
                ? emptyRow(5)
                : research.map((r: any) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3">{pick(r.title_en, r.title_ur)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{pick(r.student_name, r.student_name_ur)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{pick(r.supervisor_name, r.supervisor_name_ur)}</td>
                      <td className="px-4 py-3 font-mono-code tabular-nums whitespace-nowrap">{r.deadline}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusText status={r.status} />
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
