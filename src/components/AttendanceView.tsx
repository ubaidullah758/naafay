import React, { useEffect, useState } from 'react';
import { Download, FileText, Edit3, Check, X, BookOpen, GraduationCap, CheckCircle2, AlertCircle, Plus, ChevronDown, Printer } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { exportToExcel, exportToPdf } from '../lib/exports';
import { currentMonthLocal, todayLocal, formatUrduFullDate, formatUrduMonth } from '../lib/date';
import { ErrorState } from './ErrorState';
import { StatusText } from './StatusText';

type AttTab = 'mark' | 'daily' | 'monthly' | 'absent' | 'corrections';

export const AttendanceView: React.FC = () => {
  const { lang, t, pick } = useLanguage();
  const { user, canMarkAttendance } = useAuth();
  const [subTab, setSubTab] = useState<AttTab>(canMarkAttendance ? 'mark' : 'daily');
  const [lookups, setLookups] = useState<any>({ sessions: [], classes: [], batches: [] });

  const [date, setDate] = useState(todayLocal);
  const [month, setMonth] = useState(currentMonthLocal);
  const [classId, setClassId] = useState('');
  const [batchId, setBatchId] = useState('');

  // Daily Mode: Attendance Register (Image 10) vs Academic Register (Image 9) vs Combined
  const [dailyViewMode, setDailyViewMode] = useState<'attendance_sheet' | 'academic_sheet' | 'combined'>('attendance_sheet');
  const [academicClassFilter, setAcademicClassFilter] = useState<string>('cls-tak1');

  // Monthly Mode: Datesheet Register Grid vs Individual 30-Day Register vs Overall Summary Table
  const [monthlyViewMode, setMonthlyViewMode] = useState<'datesheet_grid' | 'individual_register' | 'summary_table'>('datesheet_grid');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentMonthlyData, setStudentMonthlyData] = useState<any | null>(null);
  const [loadingStudentMonthly, setLoadingStudentMonthly] = useState<boolean>(false);
  const [monthlyMatrix, setMonthlyMatrix] = useState<any | null>(null);
  const [loadingMatrix, setLoadingMatrix] = useState<boolean>(false);

  const [rows, setRows] = useState<any[]>([]);
  // remarks draft per student (saved together with the next status selection)
  const [remarksDraft, setRemarksDraft] = useState<Record<string, string>>({});
  const [savingRemarks, setSavingRemarks] = useState<Record<string, boolean>>({});
  // late minutes draft per student (saved directly from the late minutes cell)
  const [lateMinutesDraft, setLateMinutesDraft] = useState<Record<string, string>>({});
  const [savingLate, setSavingLate] = useState<Record<string, boolean>>({});
  // Which session cell has its status menu open, and which one is saving.
  const [openCell, setOpenCell] = useState<{ studentId: string; sessionId: string } | null>(null);
  const [savingCell, setSavingCell] = useState<{ studentId: string; sessionId: string } | null>(null);
  const [flashCell, setFlashCell] = useState<string | null>(null);
  const [reports, setReports] = useState<any>({
    daily: [],
    monthlySummary: [],
    absentList: [],
    corrections: [],
    dailyLessons: [],
    dailyMutala: [],
    dailyGrouped: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // Correction Modal
  const [corrTarget, setCorrTarget] = useState<any | null>(null);
  const [corrStatus, setCorrStatus] = useState('present');
  const [corrReason, setCorrReason] = useState('');
  const [corrRemarks, setCorrRemarks] = useState('');

  const sessionColumns: Array<{ id: string; labelEn: string; labelUr: string }> =
    Array.isArray(lookups?.sessions) && lookups.sessions.length > 0
      ? lookups.sessions.map((s: any) => ({
          id: s.id,
          labelEn: s.name_en,
          labelUr: s.name_ur,
        }))
      : [
          { id: 'ses-morning', labelEn: 'Morning – Zuhr', labelUr: 'صبح تا ظہر' },
          { id: 'ses-zuhr', labelEn: 'Zuhr – Asr', labelUr: 'ظہر تا عصر' },
          { id: 'ses-maghrib', labelEn: 'Maghrib – Isha', labelUr: 'مغرب تا عشاء' },
        ];

  useEffect(() => {
    apiFetch('/api/lookups', {}, user)
      .then((res) => {
        if (res && typeof res === 'object') {
          setLookups({
            sessions: Array.isArray(res.sessions) ? res.sessions : [],
            classes: Array.isArray(res.classes) ? res.classes : [],
            batches: Array.isArray(res.batches) ? res.batches : [],
          });
        }
      })
      .catch((err) => {
        console.warn('Failed to load lookups', err);
      });
  }, [user?.role]);

  useEffect(() => {
    if (!openCell) return;
    const close = () => setOpenCell(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [openCell]);

  const loadAttendanceSheet = async () => {
    setLoading(true);
    setBanner(null);
    setError(null);
    try {
      // Load the full day at once so all sessions show together; the API
      // returns a per-student `sessions` map with everything already recorded.
      const p = new URLSearchParams({ date });
      if (classId) p.set('classId', classId);
      if (batchId) p.set('batchId', batchId);
      const res = await apiFetch(`/api/attendance?${p.toString()}`, {}, user);
      setRows(Array.isArray(res?.rows) ? res.rows : []);
      setRemarksDraft({});
      setLateMinutesDraft({});
      setOpenCell(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load the attendance sheet');
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ date, month });
      if (classId) p.set('classId', classId);
      const res = await apiFetch(`/api/attendance/reports?${p.toString()}`, {}, user);
      if (res && typeof res === 'object') {
        setReports({
          daily: Array.isArray(res.daily) ? res.daily : [],
          monthlySummary: Array.isArray(res.monthlySummary) ? res.monthlySummary : [],
          absentList: Array.isArray(res.absentList) ? res.absentList : [],
          corrections: Array.isArray(res.corrections) ? res.corrections : [],
          dailyLessons: Array.isArray(res.dailyLessons) ? res.dailyLessons : [],
          dailyMutala: Array.isArray(res.dailyMutala) ? res.dailyMutala : [],
          dailyGrouped: Array.isArray(res.dailyGrouped) ? res.dailyGrouped : [],
          ...res,
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load attendance reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'mark') loadAttendanceSheet();
    else loadReports();
  }, [subTab, date, month, classId, batchId, user?.role]);

  // Load monthly datesheet matrix (Full month date-by-date grid for all students)
  const loadMonthlyMatrix = async () => {
    setLoadingMatrix(true);
    try {
      const p = new URLSearchParams({ month });
      if (classId) p.set('classId', classId);
      const res = await apiFetch(`/api/attendance/monthly-matrix?${p.toString()}`, {}, user);
      if (res && res.rows) setMonthlyMatrix(res);
    } catch (err: any) {
      console.warn('Failed to load monthly matrix', err);
    } finally {
      setLoadingMatrix(false);
    }
  };

  useEffect(() => {
    if (subTab === 'monthly') {
      loadMonthlyMatrix();
    }
  }, [subTab, month, classId]);

  // Load individual student monthly register data (Screenshots 4 & 5)
  useEffect(() => {
    if (subTab === 'monthly' && monthlyViewMode === 'individual_register') {
      const availableStudents = rows.length > 0 ? rows : (reports?.monthlySummary || []);
      const targetId = selectedStudentId || availableStudents[0]?.student_id || availableStudents[0]?.id || 'stu-1';
      if (!selectedStudentId && targetId) {
        setSelectedStudentId(targetId);
      }
      if (targetId) {
        setLoadingStudentMonthly(true);
        apiFetch(`/api/attendance/student-monthly?studentId=${targetId}&month=${month}`, {}, user)
          .then((res) => {
            if (res && typeof res === 'object') setStudentMonthlyData(res);
          })
          .catch((err) => console.warn('Failed to load student monthly register', err))
          .finally(() => setLoadingStudentMonthly(false));
      }
    }
  }, [subTab, monthlyViewMode, selectedStudentId, month, rows, reports?.monthlySummary]);

  // Save a single student/session immediately when a status option is clicked.
  const handleMark = async (r: any, sessionId: string, status: string, lateMinutes = 0) => {
    setOpenCell(null);
    setSavingCell({ studentId: r.student_id, sessionId });
    setError(null);
    const remarks = remarksDraft[r.student_id] || '';
    const calcLateMin = lateMinutes || (status === 'late' ? 15 : 0);
    if (status === 'late') {
      setLateMinutesDraft((prev) => ({ ...prev, [r.student_id]: String(calcLateMin) }));
    } else {
      const otherLate = sessionColumns.filter((sc) => sc.id !== sessionId && r.sessions?.[sc.id]?.status === 'late');
      if (otherLate.length === 0) {
        setLateMinutesDraft((prev) => ({ ...prev, [r.student_id]: '' }));
      }
    }

    // Optimistically update immediately
    setRows((prev) =>
      prev.map((row) =>
        row.student_id === r.student_id
          ? {
              ...row,
              sessions: {
                ...(row.sessions || {}),
                [sessionId]: {
                  id: row.sessions?.[sessionId]?.id || `att-${Date.now()}`,
                  status,
                  remarks,
                  late_minutes: calcLateMin,
                },
              },
            }
          : row
      )
    );
    setFlashCell(`${r.student_id}:${sessionId}`);

    try {
      const res = await apiFetch(
        '/api/attendance/quick-mark',
        {
          method: 'POST',
          body: JSON.stringify({
            studentId: r.student_id,
            classId: r.class_id || 'cls-tak1',
            batchId: r.batch_id,
            sessionId,
            date,
            status,
            remarks,
            lateMinutes: calcLateMin,
          }),
        },
        user
      );

      const statusLabels: Record<string, string> = {
        present: lang === 'ur' ? 'حاضر' : 'Present',
        absent: lang === 'ur' ? 'غیر حاضر' : 'Absent',
        leave: lang === 'ur' ? 'رخصت' : 'Leave',
        late: lang === 'ur' ? 'تاخیر' : 'Late',
      };

      setBanner(
        lang === 'ur'
          ? `${pick(r.full_name, r.full_name_ur)}: ${statusLabels[status] || status} حاضری فوراً محفوظ ہو گئی۔`
          : `${pick(r.full_name, r.full_name_ur)}: marked as ${statusLabels[status] || status} and saved.`
      );
      window.setTimeout(() => setFlashCell(null), 1600);
    } catch (err: any) {
      setError(err?.message || 'حاضری محفوظ کرنے میں مسئلہ پیش آیا');
      await loadAttendanceSheet();
    } finally {
      setSavingCell(null);
    }
  };

  // Mark every still-missing session as present and persist immediately.
  const handleMarkAllPresent = async () => {
    const payloads = sessionColumns
      .map((sc) => ({
        sessionId: sc.id,
        entries: rows
          .filter((r) => !r.sessions?.[sc.id])
          .map((r) => ({
            studentId: r.student_id,
            classId: r.class_id || 'cls-tak1',
            batchId: r.batch_id,
            status: 'present',
            remarks: remarksDraft[r.student_id] || '',
          })),
      }))
      .filter((p) => p.entries.length > 0);

    if (payloads.length === 0) {
      setBanner(lang === 'ur' ? 'کوئی غیر نشان زد حاضری موجود نہیں۔' : 'Nothing left to mark.');
      return;
    }

    setSaving(true);
    setError(null);
    setBanner(null);
    try {
      let inserted = 0;
      for (const p of payloads) {
        const res = await apiFetch(
          '/api/attendance/bulk',
          {
            method: 'POST',
            body: JSON.stringify({ date, sessionId: p.sessionId, entries: p.entries }),
          },
          user
        );
        inserted += res.inserted || 0;
      }
      await loadAttendanceSheet();
      setBanner(
        lang === 'ur'
          ? `${inserted} حاضریاں (تمام سیشنز) فوراً محفوظ ہو گئیں۔`
          : `Saved ${inserted} attendance records across all sessions.`
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRemarks = async (r: any) => {
    const text = remarksDraft[r.student_id];
    if (text === undefined) return;
    setSavingRemarks((prev) => ({ ...prev, [r.student_id]: true }));

    const targetSessionId =
      sessionColumns.find((sc) => r.sessions?.[sc.id])?.id ||
      sessionColumns[0]?.id ||
      'ses-morning';
    const currentStatus = r.sessions?.[targetSessionId]?.status || 'present';

    setRows((prev) =>
      prev.map((row) => {
        if (row.student_id !== r.student_id) return row;
        return {
          ...row,
          sessions: {
            ...(row.sessions || {}),
            [targetSessionId]: {
              ...(row.sessions?.[targetSessionId] || { id: `att-${Date.now()}` }),
              status: currentStatus,
              remarks: text,
            },
          },
        };
      })
    );

    try {
      await apiFetch(
        '/api/attendance/quick-mark',
        {
          method: 'POST',
          body: JSON.stringify({
            studentId: r.student_id,
            classId: r.class_id || 'cls-tak1',
            batchId: r.batch_id,
            sessionId: targetSessionId,
            date,
            attendanceDate: date,
            status: currentStatus,
            remarks: text,
          }),
        },
        user
      );
    } catch (err: any) {
      console.warn('Failed to save remarks', err);
    } finally {
      setSavingRemarks((prev) => ({ ...prev, [r.student_id]: false }));
    }
  };

  const handleSaveLateMinutes = async (r: any, customVal?: string) => {
    const rawVal = customVal !== undefined ? customVal : lateMinutesDraft[r.student_id];
    if (rawVal === undefined) return;
    const min = parseInt(rawVal, 10);
    const lateMin = isNaN(min) || min < 0 ? 0 : min;
    setSavingLate((prev) => ({ ...prev, [r.student_id]: true }));

    const targetSessionId =
      sessionColumns.find((sc) => r.sessions?.[sc.id]?.status === 'late')?.id ||
      sessionColumns.find((sc) => r.sessions?.[sc.id])?.id ||
      sessionColumns[0]?.id ||
      'ses-morning';

    const currentSes = r.sessions?.[targetSessionId];
    const newStatus = lateMin > 0 ? 'late' : (currentSes?.status === 'late' ? 'present' : (currentSes?.status || 'present'));
    const remarks = remarksDraft[r.student_id] || currentSes?.remarks || '';

    setRows((prev) =>
      prev.map((row) => {
        if (row.student_id !== r.student_id) return row;
        return {
          ...row,
          sessions: {
            ...(row.sessions || {}),
            [targetSessionId]: {
              ...(row.sessions?.[targetSessionId] || { id: `att-${Date.now()}` }),
              status: newStatus,
              remarks,
              late_minutes: lateMin,
            },
          },
        };
      })
    );

    try {
      await apiFetch(
        '/api/attendance/quick-mark',
        {
          method: 'POST',
          body: JSON.stringify({
            studentId: r.student_id,
            classId: r.class_id || 'cls-tak1',
            batchId: r.batch_id,
            sessionId: targetSessionId,
            date,
            attendanceDate: date,
            status: newStatus,
            remarks,
            lateMinutes: lateMin,
          }),
        },
        user
      );
    } catch (err: any) {
      console.warn('Failed to save late minutes', err);
    } finally {
      setSavingLate((prev) => ({ ...prev, [r.student_id]: false }));
    }
  };

  const handleCorrectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!corrTarget || !corrReason.trim()) return;
    await apiFetch(
      `/api/attendance/${corrTarget.record_id || corrTarget.id}/correct`,
      {
        method: 'PUT',
        body: JSON.stringify({ newStatus: corrStatus, reason: corrReason, remarks: corrRemarks }),
      },
      user
    );
    setCorrTarget(null);
    setCorrReason('');
    if (subTab === 'mark') await loadAttendanceSheet();
    else await loadReports();
  };

  const dailyGroupedRows: any[] =
    reports.dailyGrouped && reports.dailyGrouped.length > 0
      ? reports.dailyGrouped
      : Object.values(
          (reports.daily || []).reduce((acc: Record<string, any>, r: any) => {
            if (!acc[r.student_id]) {
              acc[r.student_id] = {
                student_id: r.student_id,
                student_code: r.student_code,
                full_name: r.full_name,
                full_name_ur: r.full_name_ur,
                class_name_en: r.class_name_en,
                class_name_ur: r.class_name_ur,
                attendance_date: r.attendance_date,
                sessions: {},
                remarks: '',
              };
            }
            acc[r.student_id].sessions[r.session_id] = {
              id: r.id,
              status: r.status,
              remarks: r.remarks || '',
            };
            if (r.remarks && r.remarks.trim()) {
              acc[r.student_id].remarks = acc[r.student_id].remarks
                ? `${acc[r.student_id].remarks} · ${r.remarks.trim()}`
                : r.remarks.trim();
            }
            return acc;
          }, {})
        );

  const exportDailyExcel = () => {
    exportToExcel(
      `attendance_daily_${date}`,
      'Daily Attendance & Study Report',
      dailyGroupedRows.map((r: any) => ({
        Date: r.attendance_date || date,
        Student_ID: r.student_code,
        Name: r.full_name,
        Name_Urdu: r.full_name_ur || '',
        Class: r.class_name_en,
        Class_Urdu: r.class_name_ur || '',
        Morning_Zuhr: r.sessions?.['ses-morning']?.status || 'pending',
        Zuhr_Asr: r.sessions?.['ses-zuhr']?.status || 'pending',
        Maghrib_Isha: r.sessions?.['ses-maghrib']?.status || 'pending',
        Daily_Mutala: (r.mutala || [])
          .map((m: any) => `${m.book_title_ur || m.book_title_en} (${m.start_position || ''} - ${m.end_position || ''}) [${m.status}]`)
          .join('; ') || 'No Mutala logged',
        Daily_Lessons: (r.lessons || [])
          .map((l: any) => `${l.book_title_ur || l.book_title_en}: ${l.start_position || ''}-${l.end_position || ''} (Teacher: ${l.teacher_name_ur || l.teacher_name})`)
          .join('; ') || 'No lesson',
        Remarks: r.remarks || '',
      }))
    );
  };

  const exportDailyPdf = () => {
    exportToPdf(
      `attendance_daily_${date}`,
      `Daily Three-Session Attendance & Study Report (${date})`,
      'Naafay Dar-ul-Ifta Academic Module',
      ['ID', 'Student', 'Class', 'Morning', 'Zuhr', 'Maghrib', 'Daily Mutala', 'Lessons Taught'],
      dailyGroupedRows.map((r: any) => [
        r.student_code,
        r.full_name,
        r.class_name_en,
        r.sessions?.['ses-morning']?.status || '—',
        r.sessions?.['ses-zuhr']?.status || '—',
        r.sessions?.['ses-maghrib']?.status || '—',
        (r.mutala || []).map((m: any) => `${m.book_title_ur || m.book_title_en} (${m.status})`).join(', ') || '—',
        (r.lessons || []).map((l: any) => `${l.book_title_ur || l.book_title_en}`).join(', ') || '—',
      ])
    );
  };

  const exportMonthlyExcel = () => {
    exportToExcel(
      `attendance_monthly_${month}`,
      'Monthly Attendance',
      (reports?.monthlySummary || []).map((r: any) => {
        const pct = r.total_sessions > 0 ? Math.round(((r.present_count + r.late_count) / r.total_sessions) * 100) : 0;
        return {
          Student_ID: r.student_code,
          Name: r.full_name,
          Class: r.class_name_en,
          Total_Sessions: r.total_sessions,
          Present: r.present_count,
          Late: r.late_count,
          Leave: r.leave_count,
          Absent: r.absent_count,
          Attendance_Pct: `${pct}%`,
        };
      })
    );
  };

  const exportMonthlyPdf = () => {
    exportToPdf(
      `attendance_monthly_${month}`,
      `Monthly Attendance Summary (${month})`,
      'Three-Session Attendance Percentage',
      ['ID', 'Student', 'Class', 'Total', 'Present', 'Late', 'Leave', 'Absent', '%'],
      (reports?.monthlySummary || []).map((r: any) => {
        const pct = r.total_sessions > 0 ? Math.round(((r.present_count + r.late_count) / r.total_sessions) * 100) : 0;
        return [
          r.student_code,
          r.full_name,
          r.class_name_en,
          r.total_sessions,
          r.present_count,
          r.late_count,
          r.leave_count,
          r.absent_count,
          `${pct}%`,
        ];
      })
    );
  };

  const tabs: Array<{ id: AttTab; label: string; hide?: boolean }> = [
    { id: 'mark', label: t('attMarkTab'), hide: !canMarkAttendance },
    { id: 'daily', label: t('attDailyTab') },
    { id: 'monthly', label: t('attMonthlyTab') },
    { id: 'absent', label: t('attAbsentTab') },
    { id: 'corrections', label: t('attCorrectionsTab'), hide: !canMarkAttendance },
  ];

  const unmarkedCount = rows.filter((r) => sessionColumns.some((sc) => !r.sessions?.[sc.id])).length;

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => (subTab === 'mark' ? loadAttendanceSheet() : loadReports())}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Sub-navigation tabs */}
      <div className="border-b border-[#DCE4E0] overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {tabs
            .filter((tb) => !tb.hide)
            .map((tb) => (
              <button
                key={tb.id}
                type="button"
                onClick={() => setSubTab(tb.id)}
                className={`whitespace-nowrap shrink-0 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  subTab === tb.id
                    ? 'border-[#065F46] text-[#065F46]'
                    : 'border-transparent text-[#5A6D65] hover:text-[#111C18]'
                }`}
              >
                {tb.label}
              </button>
            ))}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="rounded-lg border border-[#DCE4E0] bg-white p-3 sm:p-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2.5 sm:gap-3">
          {subTab === 'monthly' ? (
            <div className="flex-1 sm:flex-none min-w-[140px]">
              <label className="block text-[11px] text-[#5A6D65] mb-1">{lang === 'ur' ? 'مہینہ' : 'Month'}</label>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full sm:w-auto rounded-md border border-[#DCE4E0] px-3 py-1.5 text-xs" />
            </div>
          ) : (
            <div className="flex-1 sm:flex-none min-w-[140px]">
              <label className="block text-[11px] text-[#5A6D65] mb-1">{t('date')}</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full sm:w-auto rounded-md border border-[#DCE4E0] px-3 py-1.5 text-xs" />
            </div>
          )}

          {/* Session select was removed from top filter as requested; sessions are selected directly via table columns */}

          <div className="flex-1 sm:flex-none min-w-[160px]">
            <label className="block text-[11px] text-[#5A6D65] mb-1">{t('classLabel')}</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className="w-full sm:w-auto rounded-md border border-[#DCE4E0] px-3 py-1.5 text-xs bg-white">
              <option value="">{t('allClasses')}</option>
              {(lookups?.classes || []).map((c: any) => (
                <option key={c.id} value={c.id}>{pick(c.name_en, c.name_ur)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {subTab === 'mark' && canMarkAttendance && unmarkedCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllPresent}
              disabled={saving}
              className="flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 rounded-md border border-[#065F46]/40 bg-white px-3 py-2 text-xs font-medium text-[#065F46] hover:bg-[#065F46]/5 whitespace-nowrap disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" />
              <span>
                {saving
                  ? t('loading')
                  : lang === 'ur'
                    ? 'سب کو حاضر کریں (فوراً محفوظ)'
                    : 'Mark All Present (instant)'}
              </span>
            </button>
          )}
          {(subTab === 'daily' || subTab === 'monthly') && (
            <>
              <button
                type="button"
                onClick={subTab === 'daily' ? exportDailyExcel : exportMonthlyExcel}
                className="flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 rounded-md border border-[#DCE4E0] bg-white px-3 py-1.5 text-xs font-medium text-[#111C18] hover:bg-[#F6F8F7] whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5 text-[#065F46]" />
                <span>{t('exportExcel')}</span>
              </button>
              <button
                type="button"
                onClick={subTab === 'daily' ? exportDailyPdf : exportMonthlyPdf}
                className="flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 rounded-md bg-[#065F46] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#064E3B] whitespace-nowrap"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>{t('exportPdf')}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {banner && (
        <div className="rounded-md border border-[#065F46]/30 bg-[#065F46]/5 px-4 py-3 text-xs font-medium text-[#064E3B]">
          {banner}
        </div>
      )}

      {/* 3-Session Same-Line Overview Strip */}
      {(subTab === 'mark' || subTab === 'daily') && (subTab === 'mark' ? rows : dailyGroupedRows).length > 0 && (() => {
        const list = subTab === 'mark' ? rows : dailyGroupedRows;
        return (
          <div className="rounded-lg border border-[#DCE4E0] bg-white px-4 py-3 flex items-center justify-between gap-4 overflow-x-auto text-xs whitespace-nowrap">
            <span className="text-[#5A6D65]">
              {lang === 'ur' ? `تاریخ ${date} — تینوں سیشنز کا خلاصہ:` : `Date ${date} — Three-Session Summary:`}
            </span>
            <div className="flex items-center gap-6 tabular-nums">
              {sessionColumns.map((sc) => {
                const presentCnt = list.filter((r: any) => r.sessions?.[sc.id]?.status === 'present').length;
                const absentCnt = list.filter((r: any) => r.sessions?.[sc.id]?.status === 'absent').length;
                const markedCnt = list.filter((r: any) => Boolean(r.sessions?.[sc.id])).length;
                return (
                  <div key={sc.id} className="inline-flex items-center gap-2">
                    <span className="text-[#0B2545]">{pick(sc.labelEn, sc.labelUr)}:</span>
                    <span className="text-[#15803D]">{t('present')} {presentCnt}</span>
                    <span className="text-[#B91C1C]">{t('absent')} {absentCnt}</span>
                    <span className="text-[#627D98]">({markedCnt}/{list.length})</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* MARK ATTENDANCE (All 3 Sessions Horizontal Per Student) */}
      {subTab === 'mark' && (
        <div className="rounded-lg border border-[#DCE4E0] bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[720px]">
              <thead>
                <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                  <th className="px-3 py-3 text-start font-medium whitespace-nowrap">{t('studentId')}</th>
                  <th className="px-3 py-3 text-start font-medium whitespace-nowrap min-w-[140px]">{t('fullNameUr')}</th>
                  <th className="px-3 py-3 text-start font-medium whitespace-nowrap">{t('classLabel')}</th>
                  {sessionColumns.map((sc) => {
                    const timingHint =
                      sc.id === 'ses-morning' || sc.id === 'morning_zuhr' ? '8:00 تا 12:00' :
                      sc.id === 'ses-zuhr' || sc.id === 'zuhr_asr' ? '2:00 تا عصر' :
                      'مغرب + 3m تا 8:00';
                    return (
                      <th key={sc.id} className="px-3 py-2 text-start font-medium whitespace-nowrap">
                        <div>{pick(sc.labelEn, sc.labelUr)}</div>
                        <div className="text-[10px] font-normal text-[#8A9C94]">{timingHint}</div>
                      </th>
                    );
                  })}
                  <th className="px-3 py-3 text-start font-medium whitespace-nowrap">{t('lateMinutes')}</th>
                  <th className="px-3 py-3 text-start font-medium whitespace-nowrap">{t('remarks')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F0]">
                {loading ? (
                  <tr><td colSpan={5 + sessionColumns.length} className="py-10 text-center text-[#5A6D65]">{t('loading')}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={5 + sessionColumns.length} className="py-10 text-center text-[#5A6D65]">{t('noData')}</td></tr>
                ) : (
                  rows.map((r) => {
                    const remarksValue = remarksDraft[r.student_id] || '';
                    const existingRemarks = sessionColumns
                      .map((sc) => r.sessions?.[sc.id]?.remarks)
                      .filter((v: string | undefined) => v && v.trim())
                      .join(' · ');
                    const hasPending = sessionColumns.some((sc) => !r.sessions?.[sc.id]);
                    return (
                      <tr key={r.student_id} className="hover:bg-[#F6F8F7]">
                        <td className="px-3 py-3 font-mono-code font-semibold text-[#065F46] whitespace-nowrap">{r.student_code}</td>
                        <td className="px-3 py-3 text-[#111C18] whitespace-nowrap min-w-[140px] font-medium">{pick(r.full_name, r.full_name_ur)}</td>
                        <td className="px-3 py-3 text-[#5A6D65] whitespace-nowrap">{pick(r.class_name_en, r.class_name_ur)}</td>

                        {sessionColumns.map((sc) => {
                          const sesRec = r.sessions?.[sc.id];
                          const isOpen = openCell?.studentId === r.student_id && openCell?.sessionId === sc.id;
                          const isSaving = savingCell?.studentId === r.student_id && savingCell?.sessionId === sc.id;
                          const justSaved = flashCell === `${r.student_id}:${sc.id}`;

                          return (
                            <td key={sc.id} className="px-3 py-3 whitespace-nowrap align-top relative">
                              <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  disabled={!canMarkAttendance || isSaving}
                                  onClick={() =>
                                    setOpenCell((prev) =>
                                      prev?.studentId === r.student_id && prev?.sessionId === sc.id
                                        ? null
                                        : { studentId: r.student_id, sessionId: sc.id }
                                    )
                                  }
                                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all shadow-sm ${
                                    isSaving
                                      ? 'border-[#065F46] bg-[#065F46]/10 text-[#065F46] animate-pulse'
                                      : justSaved
                                        ? 'border-[#15803D] bg-[#15803D]/10 text-[#15803D]'
                                        : sesRec
                                          ? 'border-[#DCE4E0] bg-white hover:border-[#065F46] hover:bg-[#F6F8F7]'
                                          : 'border-dashed border-[#065F46]/50 bg-[#065F46]/5 text-[#065F46] hover:bg-[#065F46]/10'
                                  }`}
                                  title={lang === 'ur' ? 'حاضری منتخب کرنے یا بدلنے کے لیے کلک کریں (فوراً محفوظ ہوگا)' : 'Click to select or change attendance (saves instantly)'}
                                >
                                  {isSaving ? (
                                    <span className="text-[11px] font-semibold text-[#065F46]">
                                      {lang === 'ur' ? 'محفوظ ہو رہا ہے…' : 'Saving…'}
                                    </span>
                                  ) : justSaved ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#15803D]">
                                      <Check className="h-3.5 w-3.5" />
                                      <span>{lang === 'ur' ? 'محفوظ ✓' : 'Saved ✓'}</span>
                                    </span>
                                  ) : sesRec ? (
                                    <div className="inline-flex items-center gap-1.5">
                                      <StatusText status={sesRec.status} />
                                      {canMarkAttendance && (
                                        <ChevronDown className={`h-3 w-3 text-[#5A6D65] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                      )}
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#065F46]">
                                      <Plus className="h-3 w-3" />
                                      <span>{lang === 'ur' ? 'حاضری لگائیں' : 'Mark'}</span>
                                      <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                    </span>
                                  )}
                                </button>

                                {/* Dropdown menu with attendance options that save instantly on click */}
                                {isOpen && (
                                  <div className="absolute z-30 start-0 mt-1 min-w-[155px] rounded-lg border border-[#DCE4E0] bg-white p-1.5 shadow-lg space-y-1 animate-in fade-in zoom-in-95 duration-100">
                                    <div className="px-2 py-1 text-[10px] font-semibold text-[#5A6D65] border-b border-[#EEF2F0]">
                                      {lang === 'ur' ? 'حیثیت منتخب کریں (فوری محفوظ):' : 'Select Status (Auto-Saves):'}
                                    </div>
                                    {(
                                      [
                                        { id: 'present', labelUr: 'حاضر', labelEn: 'Present', color: 'hover:bg-[#15803D]/10 text-[#15803D]', activeColor: 'bg-[#15803D] text-white', icon: Check },
                                        { id: 'absent', labelUr: 'غیر حاضر', labelEn: 'Absent', color: 'hover:bg-[#B91C1C]/10 text-[#B91C1C]', activeColor: 'bg-[#B91C1C] text-white', icon: X },
                                        { id: 'leave', labelUr: 'رخصت', labelEn: 'Leave', color: 'hover:bg-[#0B2545]/10 text-[#0B2545]', activeColor: 'bg-[#0B2545] text-white', icon: AlertCircle },
                                        { id: 'late', labelUr: 'تاخیر (۱۵ منٹ)', labelEn: 'Late (15 min)', color: 'hover:bg-[#B45309]/10 text-[#B45309]', activeColor: 'bg-[#B45309] text-white', icon: AlertCircle, minutes: 15 },
                                        { id: 'late', labelUr: 'تاخیر (۳۰ منٹ)', labelEn: 'Late (30 min)', color: 'hover:bg-[#B45309]/10 text-[#B45309]', activeColor: 'bg-[#B45309] text-white', icon: AlertCircle, minutes: 30 },
                                      ] as const
                                    ).map((stItem, idx) => {
                                      const isCurrent = sesRec?.status === stItem.id && (stItem.id !== 'late' || (sesRec?.late_minutes || 15) === ('minutes' in stItem ? stItem.minutes : 15));
                                      return (
                                        <button
                                          key={`${stItem.id}-${idx}`}
                                          type="button"
                                          onClick={() => handleMark(r, sc.id, stItem.id, 'minutes' in stItem ? stItem.minutes : 0)}
                                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-semibold transition-colors ${
                                            isCurrent ? stItem.activeColor : stItem.color
                                          }`}
                                        >
                                          <span>{lang === 'ur' ? stItem.labelUr : stItem.labelEn}</span>
                                          {isCurrent && <Check className="h-3 w-3 ms-1" />}
                                        </button>
                                      );
                                    })}

                                    {/* Direct Custom Late Minutes Input inside popup */}
                                    <div className="pt-1.5 mt-1 border-t border-[#EEF2F0] px-1 space-y-1">
                                      <div className="text-[10px] text-[#5A6D65] font-medium">
                                        {lang === 'ur' ? 'یا تاخیر کے منٹ لکھیں:' : 'Or custom minutes:'}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="number"
                                          min="1"
                                          max="360"
                                          placeholder="15"
                                          defaultValue={sesRec?.status === 'late' ? (sesRec?.late_minutes || 15) : ''}
                                          id={`custom-late-${r.student_id}-${sc.id}`}
                                          className="w-16 rounded border border-[#DCE4E0] px-1.5 py-0.5 text-xs font-mono-code font-bold text-[#B45309] focus:outline-none focus:border-[#B45309]"
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              const val = parseInt((e.target as HTMLInputElement).value, 10);
                                              handleMark(r, sc.id, 'late', !isNaN(val) && val > 0 ? val : 15);
                                            }
                                          }}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const el = document.getElementById(`custom-late-${r.student_id}-${sc.id}`) as HTMLInputElement;
                                            const val = parseInt(el?.value || '15', 10);
                                            handleMark(r, sc.id, 'late', !isNaN(val) && val > 0 ? val : 15);
                                          }}
                                          className="rounded bg-[#B45309] text-white px-2 py-0.5 text-xs font-semibold hover:bg-[#92400E]"
                                        >
                                          {lang === 'ur' ? 'محفوظ' : 'Save'}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        {/* Daily Delay in Minutes Column (Editable right in this cell/khana) */}
                        <td className="px-3 py-3 whitespace-nowrap align-middle">
                          {(() => {
                            const lateSes = sessionColumns.filter((sc) => r.sessions?.[sc.id]?.status === 'late');
                            const totalMin = lateSes.reduce((acc, sc) => acc + (Number(r.sessions?.[sc.id]?.late_minutes) || 15), 0);
                            const val =
                              lateMinutesDraft[r.student_id] !== undefined
                                ? lateMinutesDraft[r.student_id]
                                : (totalMin > 0 ? String(totalMin) : '');

                            return (
                              <div className="flex items-center gap-1.5 min-w-[95px] max-w-[130px]">
                                <input
                                  type="number"
                                  min="0"
                                  max="360"
                                  placeholder="منٹ..."
                                  value={val}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setLateMinutesDraft((prev) => ({ ...prev, [r.student_id]: v }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSaveLateMinutes(r);
                                    }
                                  }}
                                  onBlur={() => {
                                    if (lateMinutesDraft[r.student_id] !== undefined) {
                                      handleSaveLateMinutes(r);
                                    }
                                  }}
                                  className="w-16 rounded border border-[#DCE4E0] px-2 py-1 text-xs font-mono-code font-bold text-[#B45309] bg-white focus:border-[#B45309] focus:ring-1 focus:ring-[#B45309] focus:outline-none placeholder:text-[#94A3B8] placeholder:font-normal"
                                />
                                <span className="text-[11px] text-[#5A6D65] font-medium">{lang === 'ur' ? 'منٹ' : 'min'}</span>
                                {savingLate[r.student_id] && (
                                  <span className="text-[10px] text-[#065F46] font-bold">✓</span>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5 min-w-[150px] max-w-[240px]">
                            <input
                              type="text"
                              value={
                                remarksDraft[r.student_id] !== undefined
                                  ? remarksDraft[r.student_id]
                                  : (existingRemarks || '')
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                setRemarksDraft((prev) => ({ ...prev, [r.student_id]: val }));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveRemarks(r);
                                }
                              }}
                              onBlur={() => {
                                if (
                                  remarksDraft[r.student_id] !== undefined &&
                                  remarksDraft[r.student_id] !== existingRemarks
                                ) {
                                  handleSaveRemarks(r);
                                }
                              }}
                              placeholder={lang === 'ur' ? 'کیفیت / نوٹ درج کریں...' : 'Enter note / remarks...'}
                              className="w-full rounded border border-[#DCE4E0] bg-white px-2.5 py-1 text-xs text-[#111C18] placeholder-[#94A3B8] focus:border-[#065F46] focus:outline-none focus:ring-1 focus:ring-[#065F46]"
                            />
                            {remarksDraft[r.student_id] !== undefined &&
                              remarksDraft[r.student_id] !== existingRemarks && (
                                <button
                                  type="button"
                                  disabled={savingRemarks[r.student_id]}
                                  onClick={() => handleSaveRemarks(r)}
                                  className="shrink-0 rounded bg-[#065F46] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#044E38] transition-colors shadow-sm whitespace-nowrap"
                                  title={lang === 'ur' ? 'نوٹ محفوظ کریں' : 'Save note'}
                                >
                                  {savingRemarks[r.student_id]
                                    ? (lang === 'ur' ? '...' : '...')
                                    : (lang === 'ur' ? 'محفوظ' : 'Save')}
                                </button>
                              )}
                          </div>
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

      {/* DAILY REPORT (Attendance + Mutala + Lessons Updates) */}
      {subTab === 'daily' && (
        <div className="space-y-5">
          {/* Daily Sub-Navigation Mode Toggles */}
          <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-[#DCE4E0]">
            <div className="flex items-center gap-1.5 p-1 bg-[#F6F8F7] rounded-md border border-[#DCE4E0] overflow-x-auto">
              <button
                type="button"
                onClick={() => setDailyViewMode('attendance_sheet')}
                className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                  dailyViewMode === 'attendance_sheet'
                    ? 'bg-[#065F46] text-white shadow-sm'
                    : 'text-[#5A6D65] hover:text-[#111C18]'
                }`}
              >
                {lang === 'ur' ? '📋 اوقات حاضری کارگزاری (شیٹ فارمیٹ)' : '📋 Attendance Register'}
              </button>
              <button
                type="button"
                onClick={() => setDailyViewMode('academic_sheet')}
                className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                  dailyViewMode === 'academic_sheet'
                    ? 'bg-[#065F46] text-white shadow-sm'
                    : 'text-[#5A6D65] hover:text-[#111C18]'
                }`}
              >
                {lang === 'ur' ? '📖 یومیہ کارگزاری (اساتذہ اسباق و طلبہ مطالعہ)' : '📖 Daily Academic Log'}
              </button>
              <button
                type="button"
                onClick={() => setDailyViewMode('combined')}
                className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                  dailyViewMode === 'combined'
                    ? 'bg-[#065F46] text-white shadow-sm'
                    : 'text-[#5A6D65] hover:text-[#111C18]'
                }`}
              >
                {lang === 'ur' ? '📊 یومیہ جامع سمری و جائزہ' : '📊 Summary & Details'}
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

          {/* MODE 1: اوقات حاضری کارگزاری (Official Daily Attendance Matrix - 100% Real Data) */}
          {dailyViewMode === 'attendance_sheet' && (() => {
            // Group real students dynamically by their class
            const classesMap: Record<string, { classNameUr: string; students: any[] }> = {};
            for (const r of dailyGroupedRows) {
              const clsKey = r.class_id || r.class_name_ur || 'other';
              const clsName = r.class_name_ur || r.class_name_en || (lang === 'ur' ? 'عام جماعت' : 'General Class');
              if (!classesMap[clsKey]) {
                classesMap[clsKey] = { classNameUr: clsName, students: [] };
              }
              classesMap[clsKey].students.push(r);
            }

            const classGroups = Object.values(classesMap);
            const isSundayDate = new Date(date + 'T12:00:00Z').getDay() === 0;

            const renderSessionCell = (stu: any, sesId: string) => {
              if (isSundayDate) return 'تعطیل (اتوار)';
              const sRec = stu.sessions?.[sesId];
              if (!sRec || !sRec.status) return '—';
              if (sRec.status === 'absent') return 'غیر حاضر';
              if (sRec.status === 'leave') return 'رخصت';
              if (sRec.status === 'late') {
                const lm = Number(sRec.late_minutes) || 15;
                if (sesId === 'ses-zuhr' || sesId === 'zuhr_asr') return `حاضر(2:${String(lm).padStart(2, '0')}تا5:00)`;
                return `حاضر (${lm} منٹ تاخیر)`;
              }
              if (sRec.status === 'present') {
                if (sesId === 'ses-morning' || sesId === 'morning_zuhr') return 'حاضر(8:00تا12:00)';
                if (sesId === 'ses-zuhr' || sesId === 'zuhr_asr') return 'حاضر(2:00تا5:00)';
                if (sesId === 'ses-maghrib' || sesId === 'maghrib_isha') return 'حاضر(7:00تا9:00)';
                return 'حاضر';
              }
              return 'حاضر';
            };

            const getLateDisplay = (stu: any) => {
              if (isSundayDate) return '—';
              let totalMin = 0;
              for (const sc of sessionColumns) {
                const s = stu.sessions?.[sc.id];
                if (s?.status === 'late') {
                  totalMin += (Number(s.late_minutes) || 15);
                }
              }
              return totalMin > 0 ? `${totalMin} منٹ` : '0 منٹ';
            };

            return (
              <div className="bg-white border-2 border-black p-6 sm:p-8 rounded-lg space-y-6 max-w-4xl mx-auto shadow-sm print:border-none print:shadow-none print:p-0">
                {/* Header */}
                <div className="text-center space-y-1 pb-1">
                  <h2 className="text-xl sm:text-2xl font-bold text-black font-urdu tracking-wide inline-block border-b-2 border-black pb-1">
                    اوقات حاضری کارگزاری
                  </h2>
                  <div className="text-xs sm:text-sm text-black font-urdu pt-1 font-semibold">
                    {formatUrduFullDate(date)} {isSundayDate && <span className="text-red-600">(ہفتہ وار تعطیل)</span>}
                  </div>
                </div>

                {classGroups.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 font-urdu text-sm">
                    اس تاریخ ({date}) کی حاضری کا کوئی ریکارڈ موجود نہیں ہے۔ براہ کرم "حاضری لگائیں" سے حاضری درج کریں۔
                  </div>
                ) : (
                  classGroups.map((grp, gIdx) => (
                    <div key={gIdx} className="space-y-2 pt-1">
                      <div className="text-center font-bold text-sm sm:text-base text-black font-urdu">
                        {grp.classNameUr} ({grp.students.length} طلباء)
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse border-2 border-black text-center font-urdu">
                          <thead>
                            <tr className="bg-[#FEF3C7] text-black font-bold">
                              <th className="border border-black py-2.5 px-3 w-[22%] text-center font-bold">طلباء کرام</th>
                              <th className="border border-black py-2.5 px-3 w-[20%] text-center font-bold">صبح تا ظہر</th>
                              <th className="border border-black py-2.5 px-3 w-[20%] text-center font-bold">ظہر تا عصر</th>
                              <th className="border border-black py-2.5 px-3 w-[20%] text-center font-bold">مغرب تا عشاء</th>
                              <th className="border border-black py-2.5 px-3 w-[18%] text-center font-bold">یومیہ تاخیر (منٹ)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {grp.students.map((stu: any) => (
                              <tr key={stu.student_id || stu.student_code} className="hover:bg-amber-50/40">
                                <td className="border border-black py-2 px-3 font-semibold text-black">
                                  {pick(stu.full_name, stu.full_name_ur)}{' '}
                                  {stu.student_code && (
                                    <span className="text-[10px] text-gray-600 font-mono-code font-normal">
                                      ({stu.student_code})
                                    </span>
                                  )}
                                </td>
                                <td className="border border-black py-2 px-3">
                                  {renderSessionCell(stu, 'ses-morning')}
                                </td>
                                <td className="border border-black py-2 px-3">
                                  {renderSessionCell(stu, 'ses-zuhr')}
                                </td>
                                <td className="border border-black py-2 px-3">
                                  {renderSessionCell(stu, 'ses-maghrib')}
                                </td>
                                <td className="border border-black py-2 px-3 font-bold text-black font-mono-code">
                                  {getLateDisplay(stu)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                )}

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
            );
          })()}

          {/* MODE 2: یومیہ کارگزاری (اساتذہ اسباق و طلبہ مطالعہ - 100% Real Data) */}
          {dailyViewMode === 'academic_sheet' && (() => {
            const displayLessons = reports?.dailyLessons || [];
            const displayMutala = reports?.dailyMutala || [];

            return (
              <div className="bg-white border-2 border-black p-6 sm:p-8 rounded-lg space-y-6 max-w-4xl mx-auto shadow-sm print:border-none print:shadow-none print:p-0">
                {/* Header */}
                <div className="text-center space-y-1 pb-1">
                  <h2 className="text-xl sm:text-2xl font-bold text-black font-urdu tracking-wide inline-block border-b-2 border-black pb-1">
                    یومیہ کارگزاری تخصص فی الفقہ والافتاء (اسباق و مطالعہ)
                  </h2>
                  <div className="text-xs sm:text-sm text-black font-urdu pt-1 font-semibold">
                    {formatUrduFullDate(date)}
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
                              اس تاریخ ({date}) کے اساتذہ کرام کے تدریسی اسباق کا کوئی ریکارڈ درج نہیں ہے۔
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
                              اس تاریخ ({date}) کا طلبہ کے مطالعے کا کوئی ریکارڈ درج نہیں ہے۔
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
            );
          })()}

          {/* MODE 3: یومیہ جامع سمری و تجزیہ (KPI Badges & Master Table) */}
          {dailyViewMode === 'combined' && (
            <div className="space-y-5">
              {/* Daily KPI Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-[#DCE4E0] bg-white p-3.5">
              <div className="text-[11px] text-[#5A6D65]">{lang === 'ur' ? 'کل درج طلبہ' : 'Total Students'}</div>
              <div className="text-lg font-bold text-[#111C18] mt-0.5">{dailyGroupedRows.length}</div>
            </div>
            <div className="rounded-lg border border-[#DCE4E0] bg-white p-3.5">
              <div className="text-[11px] text-[#5A6D65]">{lang === 'ur' ? 'تینوں سیشنز مکمل حاضر' : 'Full Day Present'}</div>
              <div className="text-lg font-bold text-[#15803D] mt-0.5">
                {dailyGroupedRows.filter((r: any) =>
                  sessionColumns.every((sc) => r.sessions?.[sc.id]?.status === 'present')
                ).length}
              </div>
            </div>
            <div className="rounded-lg border border-[#DCE4E0] bg-white p-3.5">
              <div className="text-[11px] text-[#5A6D65]">{lang === 'ur' ? 'آج کے مطالعہ لاگز' : 'Mutala Logs Today'}</div>
              <div className="text-lg font-bold text-[#065F46] mt-0.5">
                {reports.dailyMutala?.length ?? dailyGroupedRows.reduce((acc: number, r: any) => acc + (r.mutala?.length || 0), 0)}
              </div>
            </div>
            <div className="rounded-lg border border-[#DCE4E0] bg-white p-3.5">
              <div className="text-[11px] text-[#5A6D65]">{lang === 'ur' ? 'آج کے تدریسی اسباق' : 'Lessons Taught Today'}</div>
              <div className="text-lg font-bold text-[#0B2545] mt-0.5">
                {reports.dailyLessons?.length || 0}
              </div>
            </div>
          </div>

          {/* Student-wise Master Attendance, Mutala & Lessons Table */}
          <div className="rounded-lg border border-[#DCE4E0] bg-white overflow-x-auto shadow-sm">
            <div className="px-4 py-3 bg-[#F6F8F7] border-b border-[#E5ECE8] flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold text-[#111C18]">
                {lang === 'ur' ? `یومیہ جامع رپورٹ برائے تاریخ: ${date} (حاضری، مطالعہ اور اسباق)` : `Daily Comprehensive Report (${date})`}
              </h3>
              <span className="text-[11px] text-[#5A6D65]">
                {lang === 'ur' ? 'تینوں سیشنز حاضری مع یومیہ مطالعہ اور تدریسی اسباق' : '3-Session Attendance with Daily Mutala & Lessons'}
              </span>
            </div>
            <table className="w-full text-xs min-w-[850px]">
              <thead>
                <tr className="border-b border-[#E5ECE8] bg-[#FBFDFB] text-[#5A6D65]">
                  <th className="px-3 py-3 text-start font-medium whitespace-nowrap">{t('studentId')}</th>
                  <th className="px-3 py-3 text-start font-medium whitespace-nowrap min-w-[140px]">{t('fullNameUr')}</th>
                  <th className="px-3 py-3 text-start font-medium whitespace-nowrap">{t('classLabel')}</th>
                  {sessionColumns.map((sc) => (
                    <th key={sc.id} className="px-3 py-3 text-start font-medium whitespace-nowrap">
                      {pick(sc.labelEn, sc.labelUr)}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-start font-medium min-w-[200px]">
                    <span className="inline-flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5 text-[#065F46]" />
                      <span>{lang === 'ur' ? 'یومیہ مطالعہ (کتاب و صفحات)' : 'Daily Mutala'}</span>
                    </span>
                  </th>
                  <th className="px-4 py-3 text-start font-medium min-w-[220px]">
                    <span className="inline-flex items-center gap-1">
                      <GraduationCap className="h-3.5 w-3.5 text-[#0B2545]" />
                      <span>{lang === 'ur' ? 'آج کے تدریسی اسباق و ہوم ورک' : 'Lessons Taught Today'}</span>
                    </span>
                  </th>
                  <th className="px-3 py-3 text-start font-medium whitespace-nowrap">{t('remarks')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F0]">
                {dailyGroupedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6 + sessionColumns.length} className="py-10 text-center text-[#5A6D65]">
                      {t('noData')}
                    </td>
                  </tr>
                ) : (
                  dailyGroupedRows.map((r: any) => {
                    const studentMutala = r.mutala && r.mutala.length > 0 ? r.mutala : [];
                    const studentLessons = r.lessons && r.lessons.length > 0
                      ? r.lessons
                      : (reports.dailyLessons || []).filter((l: any) => !l.class_id || l.class_id === r.class_id);

                    return (
                      <tr key={r.student_id} className="hover:bg-[#F6F8F7]/70 transition-colors">
                        <td className="px-3 py-3 font-mono-code font-semibold text-[#065F46] whitespace-nowrap">
                          {r.student_code}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap font-medium text-[#111C18]">
                          {pick(r.full_name, r.full_name_ur)}
                        </td>
                        <td className="px-3 py-3 text-[#5A6D65] whitespace-nowrap">
                          {pick(r.class_name_en, r.class_name_ur)}
                        </td>

                        {sessionColumns.map((sc) => {
                          const sesRec = r.sessions?.[sc.id];
                          return (
                            <td key={sc.id} className="px-3 py-3 whitespace-nowrap">
                              {sesRec ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <StatusText status={sesRec.status} />
                                  {canMarkAttendance && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCorrTarget({
                                          ...r,
                                          record_id: sesRec.id,
                                          attendance_status: sesRec.status,
                                          remarks: sesRec.remarks,
                                        });
                                        setCorrStatus(sesRec.status);
                                        setCorrRemarks(sesRec.remarks || '');
                                      }}
                                      title={t('correctAttendance')}
                                      className="text-[#5A6D65] hover:text-[#065F46]"
                                    >
                                      <Edit3 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[#94A3B8] text-[11px]">{lang === 'ur' ? 'باقی' : 'Pending'}</span>
                              )}
                            </td>
                          );
                        })}

                        {/* Mutala Column */}
                        <td className="px-4 py-3 align-top">
                          {studentMutala.length > 0 ? (
                            <div className="space-y-1.5">
                              {studentMutala.map((m: any, mIdx: number) => (
                                <div key={m.id || mIdx} className="rounded border border-[#E5ECE8] bg-[#FBFDFB] p-2 space-y-1">
                                  <div className="flex items-center justify-between gap-1 flex-wrap">
                                    <span className="font-semibold text-[#111C18] text-[11px]">
                                      {pick(m.book_title_en, m.book_title_ur)}
                                    </span>
                                    <StatusText status={m.status} />
                                  </div>
                                  <div className="text-[11px] text-[#5A6D65]">
                                    <span>{m.chapter}</span>
                                    {m.start_position && (
                                      <span className="mx-1 font-mono-code text-[#065F46]">
                                        ({m.start_position} — {m.end_position})
                                      </span>
                                    )}
                                  </div>
                                  {m.review_comments && (
                                    <div className="text-[10px] text-[#065F46] bg-[#065F46]/5 rounded px-1.5 py-0.5">
                                      <span className="font-medium">{m.reviewer_name || 'استاد'}: </span>
                                      <span>{m.review_comments}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[#94A3B8] italic text-[11px]">
                              {lang === 'ur' ? '— آج کوئی مطالعہ درج نہیں' : '— No Mutala logged'}
                            </span>
                          )}
                        </td>

                        {/* Lessons Column */}
                        <td className="px-4 py-3 align-top">
                          {studentLessons.length > 0 ? (
                            <div className="space-y-1.5">
                              {studentLessons.map((l: any, lIdx: number) => (
                                <div key={l.id || lIdx} className="rounded border border-[#E5ECE8] bg-[#F8FAFC] p-2 space-y-1">
                                  <div className="flex items-center justify-between gap-1 flex-wrap">
                                    <span className="font-semibold text-[#0B2545] text-[11px]">
                                      {pick(l.book_title_en, l.book_title_ur)}
                                    </span>
                                    <span className="text-[10px] text-[#5A6D65]">
                                      {pick(l.teacher_name, l.teacher_name_ur)}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-[#2A3B34]">
                                    <span>{lang === 'ur' ? 'سبق: ' : 'Lesson: '}</span>
                                    <span className="font-medium">{l.start_position} — {l.end_position}</span>
                                  </div>
                                  {l.homework && (
                                    <div className="text-[10px] text-[#B45309] bg-[#B45309]/5 rounded px-1.5 py-0.5">
                                      <span className="font-medium">{lang === 'ur' ? 'ہوم ورک: ' : 'Homework: '}</span>
                                      <span>{l.homework}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[#94A3B8] italic text-[11px]">
                              {lang === 'ur' ? '— کوئی تدریسی سبق درج نہیں' : '— No lesson logged'}
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-3 text-[#5A6D65] whitespace-nowrap">
                          {r.remarks || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Today's Lessons & Mutala Summary Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Today's Lessons Board */}
            <div className="rounded-lg border border-[#DCE4E0] bg-white p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#EEF2F0] pb-2">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-[#065F46]" />
                  <h4 className="text-xs font-bold text-[#111C18]">
                    {lang === 'ur' ? 'آج کے تمام پڑھائے گئے اسباق کا خلاصہ' : "Today's Lessons Log"}
                  </h4>
                </div>
                <span className="text-[11px] text-[#5A6D65] font-mono-code">{date}</span>
              </div>
              {(!reports?.dailyLessons || reports.dailyLessons.length === 0) ? (
                <p className="py-6 text-center text-xs text-[#5A6D65]">
                  {lang === 'ur' ? 'اس تاریخ کو کوئی تدریسی سبق درج نہیں کیا گیا۔' : 'No lessons recorded for this date.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {(reports.dailyLessons || []).map((l: any) => (
                    <div key={l.id} className="rounded-md border border-[#E5ECE8] p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between font-semibold text-[#111C18]">
                        <span>{pick(l.book_title_en, l.book_title_ur)} ({pick(l.class_name_en, l.class_name_ur)})</span>
                        <span className="text-[#065F46] font-normal">{pick(l.teacher_name, l.teacher_name_ur)}</span>
                      </div>
                      <div className="text-[#5A6D65]">
                        <span>{lang === 'ur' ? 'نصاب: ' : 'Range: '}</span>
                        <span className="text-[#111C18] font-medium">{l.start_position} — {l.end_position}</span>
                      </div>
                      {l.homework && (
                        <div className="text-[11px] text-[#064E3B] bg-[#065F46]/5 rounded px-2 py-1">
                          <span className="font-semibold">{lang === 'ur' ? 'ہوم ورک: ' : 'Homework: '}</span>
                          <span>{l.homework}</span>
                        </div>
                      )}
                      {l.remarks && (
                        <div className="text-[11px] text-[#5A6D65]">
                          <span>{lang === 'ur' ? 'کیفیات: ' : 'Remarks: '}</span>
                          <span>{l.remarks}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Today's Mutala Board */}
            <div className="rounded-lg border border-[#DCE4E0] bg-white p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#EEF2F0] pb-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-[#065F46]" />
                  <h4 className="text-xs font-bold text-[#111C18]">
                    {lang === 'ur' ? 'آج کے طلبہ کا مطالعہ و جائزہ' : "Today's Mutala Submissions"}
                  </h4>
                </div>
                <span className="text-[11px] text-[#5A6D65] font-mono-code">{date}</span>
              </div>
              {(!reports?.dailyMutala || reports.dailyMutala.length === 0) ? (
                <p className="py-6 text-center text-xs text-[#5A6D65]">
                  {lang === 'ur' ? 'اس تاریخ کو کوئی مطالعہ لاگ جمع نہیں کروایا گیا۔' : 'No study logs submitted for this date.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {(reports.dailyMutala || []).map((m: any) => (
                    <div key={m.id} className="rounded-md border border-[#E5ECE8] p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#111C18]">
                          {pick(m.full_name, m.full_name_ur)} ({m.student_code})
                        </span>
                        <StatusText status={m.status} />
                      </div>
                      <div className="text-[#065F46] font-medium">
                        {pick(m.book_title_en, m.book_title_ur)} — {m.chapter}
                      </div>
                      <div className="text-[11px] text-[#5A6D65]">
                        <span>{lang === 'ur' ? 'صفحات: ' : 'Pages: '}</span>
                        <span>{m.start_position} — {m.end_position}</span>
                      </div>
                      {m.study_details && (
                        <p className="text-[11px] text-[#2A3B34] line-clamp-2">{m.study_details}</p>
                      )}
                      {m.review_comments && (
                        <div className="text-[11px] text-[#064E3B] bg-[#065F46]/5 rounded px-2 py-1">
                          <span className="font-semibold">{m.reviewer_name || 'استاد'}: </span>
                          <span>{m.review_comments}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )}

      {/* MONTHLY REPORT (Datesheet Register Grid vs Individual Student PDF Sheet vs Percentage Summary) */}
      {subTab === 'monthly' && (
        <div className="space-y-5">
          {/* Monthly Mode Toggles & Action Controls */}
          <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-[#DCE4E0]">
            <div className="flex items-center gap-1.5 p-1 bg-[#F6F8F7] rounded-md border border-[#DCE4E0] overflow-x-auto">
              <button
                type="button"
                onClick={() => setMonthlyViewMode('datesheet_grid')}
                className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                  monthlyViewMode === 'datesheet_grid'
                    ? 'bg-[#065F46] text-white shadow-sm'
                    : 'text-[#5A6D65] hover:text-[#111C18]'
                }`}
              >
                {lang === 'ur' ? '📋 تاریخ وار رجسٹر (ڈیٹ شیٹ فارمیٹ)' : '📋 Date-by-Date Register Grid'}
              </button>
              <button
                type="button"
                onClick={() => setMonthlyViewMode('individual_register')}
                className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                  monthlyViewMode === 'individual_register'
                    ? 'bg-[#065F46] text-white shadow-sm'
                    : 'text-[#5A6D65] hover:text-[#111C18]'
                }`}
              >
                {lang === 'ur' ? '📄 انفرادی طالب علم رجسٹر شیٹ' : '📄 Student Monthly Sheet'}
              </button>
              <button
                type="button"
                onClick={() => setMonthlyViewMode('summary_table')}
                className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                  monthlyViewMode === 'summary_table'
                    ? 'bg-[#065F46] text-white shadow-sm'
                    : 'text-[#5A6D65] hover:text-[#111C18]'
                }`}
              >
                {lang === 'ur' ? '📊 ماہانہ مجموعی فیصد جائزہ' : '📊 Monthly Percentage Summary'}
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {monthlyViewMode === 'individual_register' && (
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="rounded-md border border-[#DCE4E0] px-3 py-1.5 text-xs bg-white font-urdu min-w-[180px]"
                >
                  {(rows.length > 0 ? rows : reports?.monthlySummary || []).map((st: any) => (
                    <option key={st.student_id || st.id} value={st.student_id || st.id}>
                      {st.full_name_ur || st.full_name} ({st.student_code})
                    </option>
                  ))}
                </select>
              )}
              {monthlyViewMode === 'summary_table' && (
                <button
                  type="button"
                  onClick={() =>
                    exportToExcel(
                      `attendance_monthly_summary_${month}`,
                      'Monthly Attendance Summary',
                      (reports?.monthlySummary || []).map((r: any) => ({
                        Roll_No: r.student_code,
                        Name: r.full_name,
                        Name_Urdu: r.full_name_ur || '',
                        Class: r.class_name_en,
                        Total_Sessions: r.total_sessions,
                        Present: r.present_count,
                        Late: r.late_count,
                        Leave: r.leave_count,
                        Absent: r.absent_count,
                        Attendance_Percentage:
                          r.total_sessions > 0
                            ? Math.round(((r.present_count + r.late_count) / r.total_sessions) * 100)
                            : 0,
                      }))
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#DCE4E0] bg-white px-3 py-1.5 text-xs font-medium text-[#111C18] hover:bg-[#F6F8F7]"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Excel</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#0B2545] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#103563] shadow-sm whitespace-nowrap"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>{lang === 'ur' ? 'پرنٹ شیٹ (A4 Print / PDF)' : 'Print Sheet'}</span>
              </button>
            </div>
          </div>

          {/* MODE A: 📋 تاریخ وار رجسٹر (ڈیٹ شیٹ گرڈ فارمیٹ - 100% Real Data) */}
          {monthlyViewMode === 'datesheet_grid' && (
            <div className="bg-white border-2 border-black p-4 sm:p-6 rounded-lg space-y-4 shadow-sm print:border-none print:shadow-none print:p-0">
              {/* Header Box */}
              <div className="text-center space-y-1 pb-2 border-b-2 border-black">
                <div className="text-xs sm:text-sm font-urdu text-gray-700">
                  نافع دار الافتاء و مرکز تحقیقات اسلامی — نظام تعلیمات و تخصص فی الفقہ
                </div>
                <h2 className="text-lg sm:text-2xl font-bold text-black font-urdu">
                  ماہانہ تاریخ وار حاضری رجسٹر (ڈیٹ شیٹ فارمیٹ) — {formatUrduMonth(month)}
                </h2>
                <div className="text-xs text-black font-urdu font-semibold">
                  بمطابق جمادی الثانی 1448ھ (کل فعال طلباء: {monthlyMatrix?.rows?.length || (reports?.monthlySummary?.length || 0)})
                </div>
              </div>

              {loadingMatrix ? (
                <div className="py-16 text-center text-gray-500 font-urdu text-sm">
                  حاضری ڈیٹ شیٹ لوڈ ہو رہی ہے...
                </div>
              ) : (!monthlyMatrix?.rows || monthlyMatrix.rows.length === 0) ? (
                <div className="py-16 text-center text-gray-500 font-urdu text-sm">
                  اس مہینے کا کوئی حاضری ریکارڈ موجود نہیں ہے۔
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] border-collapse border-2 border-black text-center font-urdu">
                      <thead>
                        <tr className="bg-[#FEF3C7] text-black font-bold">
                          <th rowSpan={2} className="border border-black py-2 px-1 w-8 text-center font-bold">#</th>
                          <th rowSpan={2} className="border border-black py-2 px-1.5 w-16 text-center font-bold font-mono-code">رول نمبر</th>
                          <th rowSpan={2} className="border border-black py-2 px-2.5 min-w-[140px] text-start font-bold">نام طالب علم</th>
                          <th rowSpan={2} className="border border-black py-2 px-2 min-w-[110px] text-center font-bold">درجہ / کلاس</th>
                          <th colSpan={(monthlyMatrix.days || []).length} className="border border-black py-1.5 px-1 text-center font-bold">
                            تاریخ وار حاضری شیٹ ({formatUrduMonth(month)})
                          </th>
                          <th colSpan={5} className="border border-black py-1.5 px-1 text-center font-bold bg-[#E2E8F0]">
                            ماہانہ مجموعی میزان
                          </th>
                        </tr>
                        <tr className="bg-[#FEF3C7] text-black font-bold text-[10px]">
                          {(monthlyMatrix.days || []).map((d: any) => (
                            <th
                              key={d.dayNumber}
                              className={`border border-black p-0.5 w-6 min-w-[24px] max-w-[28px] text-center font-bold ${
                                d.isSunday ? 'bg-red-100 text-red-800' : ''
                              }`}
                              title={`${d.dayFormatted} (${d.dayName})`}
                            >
                              <div className="font-mono-code text-[11px] font-bold leading-tight">{d.dayNumber}</div>
                              <div className="text-[9px] font-normal leading-tight">{d.dayName.slice(0, 1)}</div>
                            </th>
                          ))}
                          <th className="border border-black py-1 px-1.5 w-10 text-center font-bold bg-emerald-100 text-emerald-900">حاضر</th>
                          <th className="border border-black py-1 px-1.5 w-10 text-center font-bold bg-rose-100 text-rose-900">غ/ح</th>
                          <th className="border border-black py-1 px-1.5 w-10 text-center font-bold bg-blue-100 text-blue-900">رخصت</th>
                          <th className="border border-black py-1 px-1.5 w-12 text-center font-bold bg-amber-100 text-amber-900">تاخیر</th>
                          <th className="border border-black py-1 px-1.5 w-12 text-center font-bold bg-[#065F46] text-white">فیصد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyMatrix.rows.map((r: any, idx: number) => (
                          <tr key={r.student_id} className="hover:bg-amber-50/40">
                            <td className="border border-black py-1 px-1 font-mono-code font-bold">{idx + 1}</td>
                            <td className="border border-black py-1 px-1 font-mono-code font-semibold text-[#065F46]">{r.student_code}</td>
                            <td className="border border-black py-1 px-2.5 text-start font-semibold text-black whitespace-nowrap">
                              {pick(r.full_name, r.full_name_ur)}
                            </td>
                            <td className="border border-black py-1 px-1.5 text-center text-gray-700 whitespace-nowrap">
                              {pick(r.class_name_en, r.class_name_ur)}
                            </td>
                            {(monthlyMatrix.days || []).map((d: any) => {
                              const dInfo = r.days?.[d.dayNumber] || r.days?.[d.date] || { label: '—', status: 'unmarked' };
                              if (d.isSunday || dInfo.status === 'holiday') {
                                return (
                                  <td
                                    key={d.dayNumber}
                                    className="border border-black p-0.5 text-center bg-red-50 text-red-600 font-bold text-[10px]"
                                    title="اتوار (ہفتہ وار تعطیل)"
                                  >
                                    ع
                                  </td>
                                );
                              }
                              let cellClass = 'text-gray-300';
                              if (dInfo.status === 'present') cellClass = 'font-bold text-emerald-700 bg-emerald-50/60';
                              else if (dInfo.status === 'absent') cellClass = 'font-bold text-rose-700 bg-rose-100';
                              else if (dInfo.status === 'leave') cellClass = 'font-bold text-blue-700 bg-blue-50';
                              else if (dInfo.status === 'late') cellClass = 'font-bold text-amber-800 bg-amber-100';

                              return (
                                <td
                                  key={d.dayNumber}
                                  className={`border border-black p-0.5 text-center ${cellClass}`}
                                  title={dInfo.lateMinutes ? `${dInfo.lateMinutes} منٹ تاخیر` : (dInfo.label || '—')}
                                >
                                  {dInfo.label || dInfo.code || '—'}
                                </td>
                              );
                            })}
                            <td className="border border-black py-1 px-1 text-center font-bold text-emerald-700 bg-emerald-50/50 font-mono-code">
                              {r.totals?.presentDays ?? r.presentDays ?? 0}
                            </td>
                            <td className="border border-black py-1 px-1 text-center font-bold text-rose-700 bg-rose-50/50 font-mono-code">
                              {r.totals?.absentDays ?? r.absentDays ?? 0}
                            </td>
                            <td className="border border-black py-1 px-1 text-center font-bold text-blue-700 bg-blue-50/50 font-mono-code">
                              {r.totals?.leaveDays ?? r.leaveDays ?? 0}
                            </td>
                            <td className="border border-black py-1 px-1 text-center font-bold text-amber-800 bg-amber-50/50 font-mono-code">
                              {(r.totals?.lateDays ?? r.lateDays ?? 0) > 0
                                ? `${r.totals?.lateDays ?? r.lateDays} (${r.totals?.totalLateMinutes ?? r.totalLateMinutes}m)`
                                : '0'}
                            </td>
                            <td className="border border-black py-1 px-1 text-center font-bold text-[#065F46] bg-emerald-50 font-mono-code">
                              {r.totals?.percentage ?? r.percentage ?? 0}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Legend and Summary Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-urdu pt-2 border-t border-gray-300">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-black">رموز و علامات:</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-800">
                        <span className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300 inline-flex items-center justify-center font-bold text-[10px]">ح</span> حاضر
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-rose-800">
                        <span className="w-4 h-4 rounded bg-rose-100 border border-rose-300 inline-flex items-center justify-center font-bold text-[10px]">غ</span> غیر حاضر
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-800">
                        <span className="w-4 h-4 rounded bg-blue-100 border border-blue-300 inline-flex items-center justify-center font-bold text-[10px]">ر</span> رخصت
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-900">
                        <span className="w-4 h-4 rounded bg-amber-100 border border-amber-300 inline-flex items-center justify-center font-bold text-[10px]">ت</span> تاخیر
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                        <span className="w-4 h-4 rounded bg-red-100 border border-red-300 inline-flex items-center justify-center font-bold text-[10px]">ع</span> تعطیل (اتوار)
                      </span>
                    </div>
                    <div className="text-gray-600 font-medium">
                      نوٹ: یہ تاریخ وار گرڈ تمام یومیہ سیشنز اور باضابطہ حاضری ریکارڈز کی عکاس ہے۔
                    </div>
                  </div>

                  {/* Official Signatures Row */}
                  <div className="pt-6 pb-2 flex items-end justify-between px-6 sm:px-16 text-xs font-urdu text-black">
                    <div className="text-center space-y-1">
                      <div className="font-bold text-sm text-black">سراج الحق</div>
                      <div className="text-gray-700 font-medium">(دستخط نگران حاضری)</div>
                      <div className="pt-1 text-sm font-serif italic text-gray-500">سراج الحق ✍️</div>
                    </div>
                    <div className="text-center space-y-1">
                      <div className="font-bold text-sm text-black">مفتی عرفان خالد صاحب</div>
                      <div className="text-gray-700 font-medium">(دستخط ناظم تعلیمات)</div>
                      <div className="pt-1 text-sm font-serif italic text-gray-500">عرفان خالد ✍️</div>
                    </div>
                    <div className="text-center space-y-1">
                      <div className="font-bold text-sm text-black">مہر و تصدیق</div>
                      <div className="text-gray-700 font-medium">(رئیس دار الافتاء)</div>
                      <div className="pt-1 text-xs text-gray-400">مہر ثبت کریں ⭕</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODE B: 📄 انفرادی طالب علم رجسٹر شیٹ (Official Sheet - 100% Real Data) */}
          {monthlyViewMode === 'individual_register' && (
            <div className="bg-white border-2 border-black p-6 sm:p-8 rounded-lg space-y-4 max-w-4xl mx-auto shadow-sm print:border-none print:shadow-none print:p-0">
              {/* Sheet Header */}
              <div className="flex items-center justify-between border-b-2 border-black pb-2 text-xs sm:text-sm font-urdu font-semibold text-black">
                <div>{formatUrduMonth(month)}</div>
                <div>
                  نام طالب علم:{' '}
                  <span className="font-bold">
                    {studentMonthlyData?.student?.full_name_ur ||
                      (rows.find((r) => r.student_id === selectedStudentId)?.full_name_ur) ||
                      (reports?.monthlySummary?.find((r: any) => r.student_id === selectedStudentId)?.full_name_ur) ||
                      '—'}
                  </span>{' '}
                  ({studentMonthlyData?.student?.class_name_ur ||
                    (rows.find((r) => r.student_id === selectedStudentId)?.class_name_ur) ||
                    'تخصص فی الفقہ'})
                </div>
              </div>

              {/* 30-Day Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse border-2 border-black text-center font-urdu">
                  <thead>
                    <tr className="bg-[#FEF3C7] text-black font-bold">
                      <th className="border border-black py-2 px-2 w-[18%] text-center font-bold">تاریخ</th>
                      <th className="border border-black py-2 px-2 w-[17%] text-center font-bold">صبح تا ظہر</th>
                      <th className="border border-black py-2 px-2 w-[17%] text-center font-bold">ظہر تا عصر</th>
                      <th className="border border-black py-2 px-2 w-[17%] text-center font-bold">مغرب تا عشاء</th>
                      <th className="border border-black py-2 px-2 w-[16%] text-center font-bold">یومیہ تاخیر (منٹ)</th>
                      <th className="border border-black py-2 px-2 w-[15%] text-center font-bold">دستخط طالب علم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingStudentMonthly ? (
                      <tr>
                        <td colSpan={6} className="border border-black py-10 text-center text-gray-500 font-urdu">
                          طالب علم کا ماہانہ ریکارڈ لوڈ ہو رہا ہے...
                        </td>
                      </tr>
                    ) : (studentMonthlyData?.days || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="border border-black py-10 text-center text-gray-500 font-urdu">
                          اس مہینے کا کوئی حاضری ریکارڈ موجود نہیں ہے۔
                        </td>
                      </tr>
                    ) : (
                      (studentMonthlyData?.days || []).map((d: any) => {
                        const isSunday = d.isSunday;
                        const sesMorning = d.sessions?.['ses-morning'] || d.sessions?.['morning_zuhr'];
                        const sesZuhr = d.sessions?.['ses-zuhr'] || d.sessions?.['zuhr_asr'];
                        const sesMaghrib = d.sessions?.['ses-maghrib'] || d.sessions?.['maghrib_isha'];
                        const studentSignName = (studentMonthlyData?.student?.full_name_ur || '').split(' ')?.[0] || 'دستخط';
                        return (
                          <tr
                            key={d.dayNumber}
                            className={isSunday ? 'bg-[#E2E8F0] font-semibold text-gray-800' : 'hover:bg-amber-50/30'}
                          >
                            <td className="border border-black py-1.5 px-2 font-medium">{d.dayFormatted}</td>
                            <td className="border border-black py-1.5 px-2">
                              {isSunday ? 'چھٹی' : sesMorning ? (sesMorning.status === 'present' ? 'حاضر' : sesMorning.status === 'absent' ? 'غیر حاضر' : sesMorning.status === 'leave' ? 'رخصت' : sesMorning.status === 'late' ? `حاضر (${sesMorning.late_minutes || 15}m)` : 'حاضر') : '—'}
                            </td>
                            <td className="border border-black py-1.5 px-2">
                              {isSunday ? 'چھٹی' : sesZuhr ? (sesZuhr.status === 'present' ? 'حاضر' : sesZuhr.status === 'absent' ? 'غیر حاضر' : sesZuhr.status === 'leave' ? 'رخصت' : sesZuhr.status === 'late' ? `حاضر (${sesZuhr.late_minutes || 15}m)` : 'حاضر') : '—'}
                            </td>
                            <td className="border border-black py-1.5 px-2">
                              {isSunday ? 'چھٹی' : sesMaghrib ? (sesMaghrib.status === 'present' ? 'حاضر' : sesMaghrib.status === 'absent' ? 'غیر حاضر' : sesMaghrib.status === 'leave' ? 'رخصت' : sesMaghrib.status === 'late' ? `حاضر (${sesMaghrib.late_minutes || 15}m)` : 'حاضر') : '—'}
                            </td>
                            <td className="border border-black py-1.5 px-2 font-mono-code font-bold">
                              {isSunday ? '—' : d.dailyLateMinutes > 0 ? `${d.dailyLateMinutes} منٹ` : '—'}
                            </td>
                            <td className="border border-black py-1.5 px-2 text-[11px] text-gray-700 font-serif italic">
                              {isSunday ? '—' : d.hasSigned ? `${studentSignName} ✍️` : '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Instructions and Timings Box */}
              <div className="mt-3 p-3 border-2 border-black bg-white text-[11px] leading-relaxed text-black font-urdu space-y-1.5">
                <div className="font-semibold text-center pb-1 border-b border-gray-300">
                  {studentMonthlyData?.timings?.morning || 'صبح: 8:00 بجے سے 12:00 بجے تک'}،{' '}
                  {studentMonthlyData?.timings?.zuhr || 'ظہر: 2:00 بجے سے عصر کی اذان تک'}،{' '}
                  {studentMonthlyData?.timings?.maghrib || 'مغرب: مغرب کا وقت داخل ہونے کے تین منٹ بعد سے رات 8:00 بجے تک (اس دورانیے میں کھانا اور نماز شامل نہیں)'}
                </div>
                <p className="text-[10.5px] text-justify">
                  {studentMonthlyData?.rules ||
                    'جمعہ کے روز نماز جمعہ کے متصل بعد کلاس شروع ہو گی۔ نیز عصر تا مغرب تکرار ہو گی، چاہے اسباق ہوں نہ ہوں۔ کلاس میں حاضر ہوں تو آنے کا وقت اور کلاس سے جائیں تو جانے کا وقت درج کریں۔ حاضری شیٹ کی حفاظت طالب علم کی ذمہ داری ہے۔ ایک دن یا اس سے زائد وقت کی رخصت لینے کی صورت میں کم از کم پانچ دن پہلے درخواست جمع کروانا ضروری ہے۔ تاخیر یا غیر حاضری کی وجہ سے ادارہ کسی بھی قسم کی تادیبی کارروائی کا مجاز ہو گا۔'}
                </p>
              </div>

              {/* Bottom Summary Table */}
              <div className="overflow-x-auto pt-2">
                <table className="w-full text-xs border-collapse border-2 border-black text-center font-urdu">
                  <thead>
                    <tr className="bg-[#FEF3C7] text-black font-bold">
                      <th className="border border-black py-2 px-2 w-[20%] text-center font-bold">ماہانہ رخصت</th>
                      <th className="border border-black py-2 px-2 w-[20%] text-center font-bold">ماہانہ غیر حاضری</th>
                      <th className="border border-black py-2 px-2 w-[25%] text-center font-bold">ماہانہ تاخیر</th>
                      <th className="border border-black py-2 px-2 w-[35%] text-center font-bold">کیفیت / برائے نگران</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-black py-2.5 px-2 font-bold font-mono-code">{studentMonthlyData?.totals?.leaves || 0} دن</td>
                      <td className="border border-black py-2.5 px-2 font-bold font-mono-code">{studentMonthlyData?.totals?.absents || 0} دن</td>
                      <td className="border border-black py-2.5 px-2 font-bold font-mono-code">
                        {studentMonthlyData?.totals?.lateMinutes || 0} منٹ ({studentMonthlyData?.totals?.lates || 0} بار)
                      </td>
                      <td className="border border-black py-2.5 px-2 text-[#065F46] font-bold">تسلی بخش / دستخط نگران</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODE C: 📊 ماہانہ مجموعی فیصد جائزہ (تمام طلبہ - 100% Real Data) */}
          {monthlyViewMode === 'summary_table' && (
            <div className="rounded-lg border border-[#DCE4E0] bg-white overflow-x-auto shadow-sm">
              <table className="w-full text-xs min-w-[720px]">
                <thead>
                  <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                    <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('studentId')}</th>
                    <th className="px-4 py-3 text-start font-medium whitespace-nowrap min-w-[140px]">{t('fullNameUr')}</th>
                    <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('classLabel')}</th>
                    <th className="px-4 py-3 text-end font-medium whitespace-nowrap">{t('present')}</th>
                    <th className="px-4 py-3 text-end font-medium whitespace-nowrap">{t('late')}</th>
                    <th className="px-4 py-3 text-end font-medium whitespace-nowrap">{t('leave')}</th>
                    <th className="px-4 py-3 text-end font-medium whitespace-nowrap">{t('absent')}</th>
                    <th className="px-4 py-3 text-end font-medium whitespace-nowrap">{t('attendancePct')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F0]">
                  {(!reports?.monthlySummary || reports.monthlySummary.length === 0) ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-[#5A6D65]">
                        {t('noData')}
                      </td>
                    </tr>
                  ) : (
                    (reports?.monthlySummary || []).map((r: any) => {
                      const pct = r.total_sessions > 0 ? Math.round(((r.present_count + r.late_count) / r.total_sessions) * 100) : 0;
                      return (
                        <tr key={r.student_id} className="hover:bg-[#F6F8F7]">
                          <td className="px-4 py-3 font-mono-code font-semibold text-[#065F46] whitespace-nowrap">{r.student_code}</td>
                          <td className="px-4 py-3 font-medium whitespace-nowrap min-w-[140px]">{pick(r.full_name, r.full_name_ur)}</td>
                          <td className="px-4 py-3 text-[#5A6D65] whitespace-nowrap">{pick(r.class_name_en, r.class_name_ur)}</td>
                          <td className="px-4 py-3 text-end font-mono-code text-[#15803D] whitespace-nowrap">{r.present_count}</td>
                          <td className="px-4 py-3 text-end font-mono-code text-[#B45309] whitespace-nowrap">{r.late_count}</td>
                          <td className="px-4 py-3 text-end font-mono-code whitespace-nowrap">{r.leave_count}</td>
                          <td className="px-4 py-3 text-end font-mono-code text-[#B91C1C] whitespace-nowrap">{r.absent_count}</td>
                          <td className="px-4 py-3 text-end font-bold font-mono-code text-[#065F46] whitespace-nowrap">{pct}%</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ABSENT LIST (One Row Per Absent Student, All 3 Sessions Horizontal) */}
      {subTab === 'absent' && (() => {
        const absentStudents = dailyGroupedRows.filter((r: any) =>
          sessionColumns.some((sc) => r.sessions?.[sc.id]?.status === 'absent')
        );
        return (
          <div className="rounded-lg border border-[#DCE4E0] bg-white overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                  <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('studentId')}</th>
                  <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('fullNameUr')}</th>
                  <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('classLabel')}</th>
                  {sessionColumns.map((sc) => (
                    <th key={sc.id} className="px-4 py-3 text-start font-medium whitespace-nowrap">
                      {pick(sc.labelEn, sc.labelUr)}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F0]">
                {absentStudents.length === 0 ? (
                  <tr><td colSpan={4 + sessionColumns.length} className="py-10 text-center text-[#5A6D65]">{t('noData')}</td></tr>
                ) : (
                  absentStudents.map((r: any) => (
                    <tr key={r.student_id}>
                      <td className="px-4 py-3 font-mono-code font-semibold text-[#B91C1C] whitespace-nowrap">{r.student_code}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{pick(r.full_name, r.full_name_ur)}</td>
                      <td className="px-4 py-3 text-[#5A6D65] whitespace-nowrap">{pick(r.class_name_en, r.class_name_ur)}</td>
                      {sessionColumns.map((sc) => {
                        const sesRec = r.sessions?.[sc.id];
                        return (
                          <td key={sc.id} className="px-4 py-3 whitespace-nowrap">
                            {sesRec ? <StatusText status={sesRec.status} /> : <span className="text-[#94A3B8]">—</span>}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 font-mono-code tabular-nums whitespace-nowrap">{r.attendance_date || date}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* CORRECTION HISTORY */}
      {subTab === 'corrections' && (
        <div className="rounded-lg border border-[#DCE4E0] bg-white overflow-x-auto">
          <table className="w-full text-xs min-w-[720px]">
            <thead>
              <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('date')}</th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap min-w-[140px]">{t('fullNameUr')}</th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('selectSession')}</th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{lang === 'ur' ? 'تبدیلی' : 'Change'}</th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('correctionReason')}</th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{lang === 'ur' ? 'تصحیح کنندہ' : 'Corrected By'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F0]">
              {(!reports?.corrections || reports.corrections.length === 0) ? (
                <tr><td colSpan={6} className="py-10 text-center text-[#5A6D65]">{t('noData')}</td></tr>
              ) : (
                (reports.corrections || []).map((c: any) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-mono-code tabular-nums whitespace-nowrap">{c.attendance_date}</td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap min-w-[140px]">{pick(c.full_name, c.full_name_ur)} ({c.student_code})</td>
                    <td className="px-4 py-3 whitespace-nowrap">{pick(c.session_name_en, c.session_name_ur)}</td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      <span className="text-[#B91C1C]">{t(c.previous_status)}</span>
                      <span className="mx-1.5">→</span>
                      <span className="text-[#15803D]">{t(c.new_status)}</span>
                    </td>
                    <td className="px-4 py-3 text-[#2A3B34] whitespace-nowrap">{c.reason}</td>
                    <td className="px-4 py-3 text-[#5A6D65] whitespace-nowrap">{c.corrected_by_name}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Correction Modal */}
      {corrTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-[#DCE4E0] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE8]">
              <h3 className="text-sm font-bold text-[#111C18]">{t('correctAttendance')}</h3>
              <button type="button" onClick={() => setCorrTarget(null)}><X className="h-4 w-4 text-[#5A6D65]" /></button>
            </div>
            <form onSubmit={handleCorrectSubmit} className="mt-4 space-y-4 text-xs">
              <div className="font-medium text-[#065F46]">
                {pick(corrTarget.full_name, corrTarget.full_name_ur)} · {corrTarget.student_code}
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('status')}</label>
                <select value={corrStatus} onChange={(e) => setCorrStatus(e.target.value)} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                  <option value="present">{t('present')}</option>
                  <option value="absent">{t('absent')}</option>
                  <option value="leave">{t('leave')}</option>
                  <option value="late">{t('late')}</option>
                </select>
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('correctionReason')} *</label>
                <textarea required rows={3} value={corrReason} onChange={(e) => setCorrReason(e.target.value)} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('remarks')}</label>
                <input type="text" value={corrRemarks} onChange={(e) => setCorrRemarks(e.target.value)} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setCorrTarget(null)} className="rounded-md border border-[#DCE4E0] px-4 py-2">{t('cancel')}</button>
                <button type="submit" className="rounded-md bg-[#065F46] px-4 py-2 text-white font-medium">{t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
