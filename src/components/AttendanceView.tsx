import React, { useEffect, useState } from 'react';
import { Download, FileText, Edit3, Check, X, BookOpen, GraduationCap, CheckCircle2, AlertCircle, Plus, ChevronDown } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { exportToExcel, exportToPdf } from '../lib/exports';
import { currentMonthLocal, todayLocal } from '../lib/date';
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

  const [rows, setRows] = useState<any[]>([]);
  // remarks draft per student (saved together with the next status selection)
  const [remarksDraft, setRemarksDraft] = useState<Record<string, string>>({});
  // Which session cell has its status menu open, and which one is saving.
  const [openCell, setOpenCell] = useState<{ studentId: string; sessionId: string } | null>(null);
  const [savingCell, setSavingCell] = useState<{ studentId: string; sessionId: string } | null>(null);
  const [flashCell, setFlashCell] = useState<string | null>(null);
  const [reports, setReports] = useState<any>({ daily: [], monthlySummary: [], absentList: [], corrections: [] });
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
    lookups.sessions && lookups.sessions.length > 0
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
    apiFetch('/api/lookups', {}, user).then((res) => {
      setLookups(res);
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
      setRows(res.rows);
      setRemarksDraft({});
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
      setReports(res);
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

  // Save a single student/session immediately when a status option is clicked.
  const handleMark = async (r: any, sessionId: string, status: string) => {
    setOpenCell(null);
    setSavingCell({ studentId: r.student_id, sessionId });
    setError(null);
    const remarks = remarksDraft[r.student_id] || '';

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
      reports.monthlySummary.map((r: any) => {
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
      reports.monthlySummary.map((r: any) => {
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
      <div className="rounded-lg border border-[#DCE4E0] bg-white p-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          {subTab === 'monthly' ? (
            <div>
              <label className="block text-[11px] text-[#5A6D65] mb-1">{lang === 'ur' ? 'مہینہ' : 'Month'}</label>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-md border border-[#DCE4E0] px-3 py-1.5 text-xs" />
            </div>
          ) : (
            <div>
              <label className="block text-[11px] text-[#5A6D65] mb-1">{t('date')}</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md border border-[#DCE4E0] px-3 py-1.5 text-xs" />
            </div>
          )}

          {/* Session select was removed from top filter as requested; sessions are selected directly via table columns */}

          <div>
            <label className="block text-[11px] text-[#5A6D65] mb-1">{t('classLabel')}</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-md border border-[#DCE4E0] px-3 py-1.5 text-xs bg-white">
              <option value="">{t('allClasses')}</option>
              {lookups.classes.map((c: any) => (
                <option key={c.id} value={c.id}>{pick(c.name_en, c.name_ur)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {subTab === 'mark' && canMarkAttendance && unmarkedCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllPresent}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#065F46]/40 bg-white px-3 py-2 text-xs font-medium text-[#065F46] hover:bg-[#065F46]/5 whitespace-nowrap disabled:opacity-60"
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
                className="inline-flex items-center gap-1.5 rounded-md border border-[#DCE4E0] bg-white px-3 py-1.5 text-xs font-medium text-[#111C18] hover:bg-[#F6F8F7] whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5 text-[#065F46]" />
                <span>{t('exportExcel')}</span>
              </button>
              <button
                type="button"
                onClick={subTab === 'daily' ? exportDailyPdf : exportMonthlyPdf}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#065F46] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#064E3B] whitespace-nowrap"
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
          <div className="px-4 py-2.5 bg-[#F6F8F7] border-b border-[#E5ECE8] text-xs text-[#4A5D55] flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              {lang === 'ur'
                ? 'ہر طالب علم کے ہر سیشن پر «حاضری» پر کلک کریں، پھر حیثیت منتخب کریں — حاضری خود بخود محفوظ ہو جائے گی۔'
                : 'Click “Mark” in any session cell, then pick a status — attendance saves automatically.'}
            </span>
            {rows.some((r) => Object.keys(r.sessions || {}).length > 0) && (
              <span className="text-[#627D98]">{t('alreadyRecordedNote')}</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                  <th className="px-3 py-3 text-start font-medium whitespace-nowrap">{t('studentId')}</th>
                  <th className="px-3 py-3 text-start font-medium whitespace-nowrap">{t('fullNameUr')}</th>
                  <th className="px-3 py-3 text-start font-medium whitespace-nowrap">{t('classLabel')}</th>
                  {sessionColumns.map((sc) => (
                    <th key={sc.id} className="px-3 py-3 text-start font-medium whitespace-nowrap">
                      {pick(sc.labelEn, sc.labelUr)}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-start font-medium whitespace-nowrap">{t('remarks')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F0]">
                {loading ? (
                  <tr><td colSpan={4 + sessionColumns.length} className="py-10 text-center text-[#5A6D65]">{t('loading')}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={4 + sessionColumns.length} className="py-10 text-center text-[#5A6D65]">{t('noData')}</td></tr>
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
                        <td className="px-3 py-3 text-[#111C18] whitespace-nowrap">{pick(r.full_name, r.full_name_ur)}</td>
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

                                {/* Dropdown menu with 4 attendance options that save instantly on click */}
                                {isOpen && (
                                  <div className="absolute z-30 start-0 mt-1 min-w-[140px] rounded-lg border border-[#DCE4E0] bg-white p-1.5 shadow-lg space-y-1 animate-in fade-in zoom-in-95 duration-100">
                                    <div className="px-2 py-1 text-[10px] font-semibold text-[#5A6D65] border-b border-[#EEF2F0]">
                                      {lang === 'ur' ? 'حیثیت منتخب کریں (فوری محفوظ):' : 'Select Status (Auto-Saves):'}
                                    </div>
                                    {(
                                      [
                                        { id: 'present', labelUr: 'حاضر', labelEn: 'Present', color: 'hover:bg-[#15803D]/10 text-[#15803D]', activeColor: 'bg-[#15803D] text-white', icon: Check },
                                        { id: 'absent', labelUr: 'غیر حاضر', labelEn: 'Absent', color: 'hover:bg-[#B91C1C]/10 text-[#B91C1C]', activeColor: 'bg-[#B91C1C] text-white', icon: X },
                                        { id: 'leave', labelUr: 'رخصت', labelEn: 'Leave', color: 'hover:bg-[#0B2545]/10 text-[#0B2545]', activeColor: 'bg-[#0B2545] text-white', icon: AlertCircle },
                                        { id: 'late', labelUr: 'تاخیر', labelEn: 'Late', color: 'hover:bg-[#B45309]/10 text-[#B45309]', activeColor: 'bg-[#B45309] text-white', icon: AlertCircle },
                                      ] as const
                                    ).map((stItem) => {
                                      const isCurrent = sesRec?.status === stItem.id;
                                      return (
                                        <button
                                          key={stItem.id}
                                          type="button"
                                          onClick={() => handleMark(r, sc.id, stItem.id)}
                                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-semibold transition-colors ${
                                            isCurrent ? stItem.activeColor : stItem.color
                                          }`}
                                        >
                                          <span>{lang === 'ur' ? stItem.labelUr : stItem.labelEn}</span>
                                          {isCurrent && <Check className="h-3 w-3 ms-1" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        <td className="px-3 py-3">
                          {existingRemarks && (
                            <span className="block text-[#5A6D65] mb-1">{existingRemarks}</span>
                          )}
                          {hasPending && (
                            <input
                              type="text"
                              value={remarksValue}
                              onChange={(e) =>
                                setRemarksDraft((prev) => ({ ...prev, [r.student_id]: e.target.value }))
                              }
                              placeholder={t('remarks')}
                              className="w-full min-w-[110px] rounded border border-[#DCE4E0] px-2.5 py-1 text-xs"
                            />
                          )}
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
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E5ECE8] bg-[#FBFDFB] text-[#5A6D65]">
                  <th className="px-3 py-3 text-start font-medium whitespace-nowrap">{t('studentId')}</th>
                  <th className="px-3 py-3 text-start font-medium whitespace-nowrap">{t('fullNameUr')}</th>
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
              {(!reports.dailyLessons || reports.dailyLessons.length === 0) ? (
                <p className="py-6 text-center text-xs text-[#5A6D65]">
                  {lang === 'ur' ? 'اس تاریخ کو کوئی تدریسی سبق درج نہیں کیا گیا۔' : 'No lessons recorded for this date.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {reports.dailyLessons.map((l: any) => (
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
              {(!reports.dailyMutala || reports.dailyMutala.length === 0) ? (
                <p className="py-6 text-center text-xs text-[#5A6D65]">
                  {lang === 'ur' ? 'اس تاریخ کو کوئی مطالعہ لاگ جمع نہیں کروایا گیا۔' : 'No study logs submitted for this date.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {reports.dailyMutala.map((m: any) => (
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

      {/* MONTHLY SUMMARY */}
      {subTab === 'monthly' && (
        <div className="rounded-lg border border-[#DCE4E0] bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                <th className="px-4 py-3 text-start font-medium">{t('studentId')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('fullNameUr')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('classLabel')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('present')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('late')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('leave')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('absent')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('attendancePct')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F0]">
              {reports.monthlySummary.map((r: any) => {
                const pct = r.total_sessions > 0 ? Math.round(((r.present_count + r.late_count) / r.total_sessions) * 100) : 0;
                return (
                  <tr key={r.student_id}>
                    <td className="px-4 py-3 font-mono-code font-semibold text-[#065F46]">{r.student_code}</td>
                    <td className="px-4 py-3 font-medium">{pick(r.full_name, r.full_name_ur)}</td>
                    <td className="px-4 py-3 text-[#5A6D65]">{pick(r.class_name_en, r.class_name_ur)}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-[#15803D]">{r.present_count}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-[#B45309]">{r.late_count}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{r.leave_count}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-[#B91C1C]">{r.absent_count}</td>
                    <td className="px-4 py-3 text-end font-bold tabular-nums text-[#065F46]">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                <th className="px-4 py-3 text-start font-medium">{t('date')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('fullNameUr')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('selectSession')}</th>
                <th className="px-4 py-3 text-start font-medium">{lang === 'ur' ? 'تبدیلی' : 'Change'}</th>
                <th className="px-4 py-3 text-start font-medium">{t('correctionReason')}</th>
                <th className="px-4 py-3 text-start font-medium">{lang === 'ur' ? 'تصحیح کنندہ' : 'Corrected By'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F0]">
              {reports.corrections.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-[#5A6D65]">{t('noData')}</td></tr>
              ) : (
                reports.corrections.map((c: any) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-mono-code tabular-nums">{c.attendance_date}</td>
                    <td className="px-4 py-3 font-medium">{pick(c.full_name, c.full_name_ur)} ({c.student_code})</td>
                    <td className="px-4 py-3">{pick(c.session_name_en, c.session_name_ur)}</td>
                    <td className="px-4 py-3 font-medium">
                      <span className="text-[#B91C1C]">{t(c.previous_status)}</span>
                      <span className="mx-1.5">→</span>
                      <span className="text-[#15803D]">{t(c.new_status)}</span>
                    </td>
                    <td className="px-4 py-3 text-[#2A3B34]">{c.reason}</td>
                    <td className="px-4 py-3 text-[#5A6D65]">{c.corrected_by_name}</td>
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
