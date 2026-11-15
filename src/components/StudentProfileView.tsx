import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Upload, Trash2, Printer, FileText, Edit } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch, fileToDataUrl } from '../lib/api';
import { StatusText } from './StatusText';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorState } from './ErrorState';
import { formatActivityAction } from '../lib/activityLabels';

interface StudentProfileViewProps {
  studentId: string;
  onBack: () => void;
  onEditStudent: (student: any) => void;
}

type ProfileTab =
  | 'overview'
  | 'personal'
  | 'subjects'
  | 'attendance'
  | 'mutala'
  | 'lessons'
  | 'exams'
  | 'results'
  | 'research'
  | 'documents'
  | 'monthly'
  | 'history';

export const StudentProfileView: React.FC<StudentProfileViewProps> = ({
  studentId,
  onBack,
  onEditStudent,
}) => {
  const { lang, t, pick } = useLanguage();
  const { user, canManageStudents } = useAuth();
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ProfileTab>('overview');

  // Document Upload State
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState('certificate');
  const [uploading, setUploading] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/students/${studentId}`, {}, user);
      const studentObj = res?.student || (res?.id ? res : null);
      if (!studentObj) {
        throw new Error('Student record not found');
      }
      setProfile({
        student: studentObj,
        guardians: Array.isArray(res?.guardians) ? res.guardians : [],
        attendance: Array.isArray(res?.attendance) ? res.attendance : [],
        mutala: Array.isArray(res?.mutala) ? res.mutala : [],
        lessons: Array.isArray(res?.lessons) ? res.lessons : [],
        exams: Array.isArray(res?.exams) ? res.exams : [],
        results: Array.isArray(res?.results) ? res.results : [],
        research: Array.isArray(res?.research) ? res.research : [],
        documents: Array.isArray(res?.documents) ? res.documents : [],
        monthlyReports: Array.isArray(res?.monthlyReports) ? res.monthlyReports : [],
        activityHistory: Array.isArray(res?.activityHistory) ? res.activityHistory : [],
        enrolledSubjects: Array.isArray(res?.enrolledSubjects) ? res.enrolledSubjects : [],
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [studentId, user?.role]);

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const uploaded = await apiFetch('/api/uploads', { method: 'POST', body: JSON.stringify({ fileName: file.name, dataUrl }) }, user);
      await apiFetch(
        '/api/documents',
        {
          method: 'POST',
          body: JSON.stringify({
            entity_type: 'student',
            entity_id: studentId,
            title: docTitle.trim() || file.name,
            category: docCategory,
            file_name: uploaded.fileName,
            file_url: uploaded.fileUrl,
            mime_type: uploaded.mimeType,
            file_size_bytes: uploaded.size,
          }),
        },
        user
      );
      setDocTitle('');
      await load();
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async () => {
    if (!docToDelete) return;
    await apiFetch(`/api/documents/${docToDelete}`, { method: 'DELETE' }, user);
    setDocToDelete(null);
    await load();
  };

  if (loading) return <div className="p-8 text-center text-sm text-[#5A6D65]">{t('loading')}</div>;
  if (error || !profile) {
    return <ErrorState message={error || t('errorLoad')} onRetry={load} />;
  }

  const st = profile.student || {};
  const attendance: any[] = Array.isArray(profile.attendance) ? profile.attendance : [];
  const mutala: any[] = Array.isArray(profile.mutala) ? profile.mutala : [];
  const lessons: any[] = Array.isArray(profile.lessons) ? profile.lessons : [];
  const exams: any[] = Array.isArray(profile.exams) ? profile.exams : [];
  const results: any[] = Array.isArray(profile.results) ? profile.results : [];
  const research: any[] = Array.isArray(profile.research) ? profile.research : [];
  const documents: any[] = Array.isArray(profile.documents) ? profile.documents : [];
  const monthlyReports: any[] = Array.isArray(profile.monthlyReports) ? profile.monthlyReports : [];
  const activityHistory: any[] = Array.isArray(profile.activityHistory) ? profile.activityHistory : [];
  const enrolledSubjects: any[] = Array.isArray(profile.enrolledSubjects) ? profile.enrolledSubjects : [];
  const guardians: any[] = Array.isArray(profile.guardians) ? profile.guardians : [];

  const attTotal = attendance.length;
  const attPresent = attendance.filter((a: any) => a.status === 'present' || a.status === 'late').length;
  const attPct = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 0;

  const tabs: Array<{ id: ProfileTab; label: string }> = [
    { id: 'overview', label: lang === 'ur' ? 'خلاصہ' : 'Overview' },
    { id: 'personal', label: t('tabPersonal') },
    { id: 'subjects', label: lang === 'ur' ? 'مضامین' : 'Subjects' },
    { id: 'attendance', label: t('tabAttendance') },
    { id: 'mutala', label: t('tabMutala') },
    { id: 'lessons', label: t('tabLessons') },
    { id: 'exams', label: t('tabExams') },
    { id: 'results', label: t('tabResults') },
    { id: 'research', label: t('tabResearch') },
    { id: 'documents', label: t('tabDocuments') },
    { id: 'monthly', label: t('tabMonthly') },
    { id: 'history', label: t('tabHistory') },
  ];

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="no-print flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#065F46] hover:underline"
        >
          {lang === 'ur' ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
          <span>{t('navStudents')}</span>
        </button>

        {canManageStudents && (
          <button
            type="button"
            onClick={() => onEditStudent(st)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#DCE4E0] bg-white px-3.5 py-2 text-xs font-medium text-[#111C18] hover:bg-[#F6F8F7]"
          >
            <Edit className="h-3.5 w-3.5 text-[#065F46]" />
            <span>{t('editStudent')}</span>
          </button>
        )}
      </div>

      {/* Student Identity Summary */}
      <div className="rounded-lg border border-[#DCE4E0] bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {st.photo_url ? (
            <img
              src={st.photo_url}
              alt={st.full_name}
              referrerPolicy="no-referrer"
              className="h-16 w-16 rounded-md object-cover border border-[#DCE4E0]"
            />
          ) : (
            <div className="h-16 w-16 rounded-md bg-[#065F46]/10 border border-[#065F46]/20 flex items-center justify-center text-lg font-bold text-[#065F46]">
              {(pick(st.full_name, st.full_name_ur) || 'S').slice(0, 2)}
            </div>
          )}
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono-code text-xs font-semibold text-[#065F46]">{st.student_code}</span>
              <span aria-hidden="true" className="text-[#CBD5D1]">·</span>
              <StatusText status={st.status} />
            </div>
            <h2 className="mt-1 text-lg font-bold text-[#111C18]">{pick(st.full_name, st.full_name_ur)}</h2>
            <div className="text-xs text-[#5A6D65]">
              <span>{pick(st.class_name_en, st.class_name_ur)}</span>
              {st.batch_name_en && (
                <>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span>{pick(st.batch_name_en, st.batch_name_ur)}</span>
                </>
              )}
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>{pick(st.year_title_en, st.year_title_ur)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs tabular-nums border-t sm:border-t-0 pt-3 sm:pt-0 border-[#E5ECE8]">
          <div>
            <div className="text-[#5A6D65]">{t('attendancePct')}</div>
            <div className="mt-0.5 text-lg font-bold text-[#065F46]">{attPct}%</div>
          </div>
          <div>
            <div className="text-[#5A6D65]">{t('tabMutala')}</div>
            <div className="mt-0.5 text-lg font-bold text-[#111C18]">{mutala.length}</div>
          </div>
          <div>
            <div className="text-[#5A6D65]">{t('tabResults')}</div>
            <div className="mt-0.5 text-lg font-bold text-[#111C18]">{results.length}</div>
          </div>
        </div>
      </div>

      {/* 10-Tab Bar */}
      <div className="no-print border-b border-[#DCE4E0] overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {tabs.map((tb) => {
            const active = tab === tb.id;
            return (
              <button
                key={tb.id}
                type="button"
                onClick={() => setTab(tb.id)}
                className={`whitespace-nowrap shrink-0 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-[#065F46] text-[#065F46]'
                    : 'border-transparent text-[#5A6D65] hover:text-[#111C18]'
                }`}
              >
                {tb.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="rounded-lg border border-[#DCE4E0] bg-white p-5 print-container">
        {tab === 'overview' && (() => {
          const subjects: any[] = enrolledSubjects;
          const uniqueSubjects = Array.from(
            new Map(subjects.map((s: any) => [s.subject_id, s])).values()
          ) as any[];
          const recentAttendance = Object.values(
            attendance.reduce((acc: Record<string, any>, a: any) => {
              if (!acc[a.attendance_date]) {
                acc[a.attendance_date] = { date: a.attendance_date, sessions: {} };
              }
              acc[a.attendance_date].sessions[a.session_id] = a;
              return acc;
            }, {})
          )
            .sort((a: any, b: any) => (a.date < b.date ? 1 : -1))
            .slice(0, 6);

          const stat = (label: string, value: React.ReactNode, tone = 'text-[#065F46]') => (
            <div className="rounded-md border border-[#E5ECE8] bg-[#FBFDFC] p-3">
              <div className="text-[11px] text-[#5A6D65]">{label}</div>
              <div className={`mt-0.5 text-xl font-bold tabular-nums ${tone}`}>{value}</div>
            </div>
          );

          return (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {stat(t('attendancePct'), `${attPct}%`)}
                {stat(t('tabMutala'), mutala.length, 'text-[#0B2545]')}
                {stat(lang === 'ur' ? 'اسباق' : 'Lessons', lessons.length, 'text-[#0B2545]')}
                {stat(t('tabResults'), results.length, 'text-[#0B2545]')}
                {stat(t('tabResearch'), research.length, 'text-[#0B2545]')}
                {stat(lang === 'ur' ? 'مضامین' : 'Subjects', uniqueSubjects.length, 'text-[#0B2545]')}
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="rounded-md border border-[#E5ECE8] p-4">
                  <h3 className="text-sm font-semibold text-[#065F46] mb-3">{lang === 'ur' ? 'درجہ و تعلیمی تفصیل' : 'Class & Academic Detail'}</h3>
                  <dl className="grid grid-cols-3 gap-y-2 text-xs">
                    <dt className="text-[#5A6D65]">{lang === 'ur' ? 'درجہ' : 'Class'}</dt>
                    <dd className="col-span-2 font-medium text-[#111C18]">{pick(st.class_name_en, st.class_name_ur) || '—'}</dd>
                    <dt className="text-[#5A6D65]">{lang === 'ur' ? 'بیچ' : 'Batch'}</dt>
                    <dd className="col-span-2 text-[#111C18]">{pick(st.batch_name_en, st.batch_name_ur) || '—'}</dd>
                    <dt className="text-[#5A6D65]">{t('academicYear')}</dt>
                    <dd className="col-span-2 text-[#111C18]">{pick(st.year_title_en, st.year_title_ur) || '—'}</dd>
                    <dt className="text-[#5A6D65]">{t('admissionDate')}</dt>
                    <dd className="col-span-2 font-mono-code text-[#111C18]">{st.admission_date || '—'}</dd>
                    <dt className="text-[#5A6D65]">{t('phone')}</dt>
                    <dd className="col-span-2 font-mono-code text-[#111C18]">{st.phone || '—'}</dd>
                    <dt className="text-[#5A6D65]">{t('address')}</dt>
                    <dd className="col-span-2 text-[#111C18]">{pick(st.address, st.address_ur) || '—'}</dd>
                  </dl>
                </div>

                <div className="rounded-md border border-[#E5ECE8] p-4 lg:col-span-2">
                  <h3 className="text-sm font-semibold text-[#065F46] mb-3">{lang === 'ur' ? 'مضامین و کتب' : 'Subjects & Books'}</h3>
                  {uniqueSubjects.length === 0 ? (
                    <p className="py-4 text-center text-xs text-[#5A6D65]">{t('noData')}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {uniqueSubjects.map((s: any) => (
                        <span
                          key={s.subject_id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#DCE4E0] bg-[#F6F8F7] px-3 py-1 text-xs text-[#111C18]"
                        >
                          <span className="font-medium">{pick(s.subject_name_en, s.subject_name_ur)}</span>
                          <span className="text-[#8A9A93]">{s.subject_code}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-md border border-[#E5ECE8] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#E5ECE8] text-sm font-semibold text-[#065F46]">{lang === 'ur' ? 'حالیہ حاضری' : 'Recent Attendance'}</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                          <th className="px-3 py-2 text-start">{t('date')}</th>
                          <th className="px-3 py-2 text-start">{lang === 'ur' ? 'صبح تا ظہر' : 'Morning to Zuhr'}</th>
                          <th className="px-3 py-2 text-start">{lang === 'ur' ? 'ظہر تا عصر' : 'Zuhr to Asr'}</th>
                          <th className="px-3 py-2 text-start">{lang === 'ur' ? 'مغرب تا عشاء' : 'Maghrib to Isha'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EEF2F0]">
                        {recentAttendance.length === 0 ? (
                          <tr><td colSpan={4} className="py-8 text-center text-[#5A6D65]">{t('noData')}</td></tr>
                        ) : (
                          recentAttendance.map((row: any) => (
                            <tr key={row.date}>
                              <td className="px-3 py-2.5 font-mono-code tabular-nums whitespace-nowrap">{row.date}</td>
                              {['ses-morning', 'ses-zuhr', 'ses-maghrib'].map((sid) => (
                                <td key={sid} className="px-3 py-2.5 whitespace-nowrap">
                                  {row.sessions[sid] ? <StatusText status={row.sessions[sid].status} /> : <span className="text-[#94A3B8]">—</span>}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-md border border-[#E5ECE8] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#E5ECE8] text-sm font-semibold text-[#065F46]">{lang === 'ur' ? 'حالیہ مطالعہ' : 'Recent Mutala'}</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                          <th className="px-3 py-2 text-start">{t('date')}</th>
                          <th className="px-3 py-2 text-start">{t('book')}</th>
                          <th className="px-3 py-2 text-start">{t('chapter')}</th>
                          <th className="px-3 py-2 text-start">{t('status')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EEF2F0]">
                        {mutala.length === 0 ? (
                          <tr><td colSpan={4} className="py-8 text-center text-[#5A6D65]">{t('noData')}</td></tr>
                        ) : (
                          mutala.slice(0, 6).map((m: any) => (
                            <tr key={m.id}>
                              <td className="px-3 py-2.5 font-mono-code tabular-nums whitespace-nowrap">{m.study_date}</td>
                              <td className="px-3 py-2.5">{pick(m.book_title_en, m.book_title_ur)}</td>
                              <td className="px-3 py-2.5 text-[#5A6D65]">{m.chapter}</td>
                              <td className="px-3 py-2.5 whitespace-nowrap"><StatusText status={m.status} /></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-md border border-[#E5ECE8] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#E5ECE8] text-sm font-semibold text-[#065F46]">{lang === 'ur' ? 'حالیہ اسباق' : 'Recent Lessons / Asbaq'}</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                          <th className="px-3 py-2 text-start">{t('date')}</th>
                          <th className="px-3 py-2 text-start">{t('subjectLabel')}</th>
                          <th className="px-3 py-2 text-start">{t('teacherLabel')}</th>
                          <th className="px-3 py-2 text-start">{t('book')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EEF2F0]">
                        {lessons.length === 0 ? (
                          <tr><td colSpan={4} className="py-8 text-center text-[#5A6D65]">{t('noData')}</td></tr>
                        ) : (
                          lessons.slice(0, 6).map((l: any) => (
                            <tr key={l.id}>
                              <td className="px-3 py-2.5 font-mono-code tabular-nums whitespace-nowrap">{l.lesson_date}</td>
                              <td className="px-3 py-2.5">{pick(l.subject_name_en, l.subject_name_ur)}</td>
                              <td className="px-3 py-2.5">{pick(l.teacher_name, l.teacher_name_ur)}</td>
                              <td className="px-3 py-2.5">{pick(l.book_title_en, l.book_title_ur)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-md border border-[#E5ECE8] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#E5ECE8] text-sm font-semibold text-[#065F46]">{lang === 'ur' ? 'حالیہ نتائج' : 'Recent Results'}</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                          <th className="px-3 py-2 text-start">{t('examTitle')}</th>
                          <th className="px-3 py-2 text-start">{t('subjectLabel')}</th>
                          <th className="px-3 py-2 text-end">{t('totalMarks')}</th>
                          <th className="px-3 py-2 text-start">{t('grade')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EEF2F0]">
                        {results.length === 0 ? (
                          <tr><td colSpan={4} className="py-8 text-center text-[#5A6D65]">{t('noData')}</td></tr>
                        ) : (
                          results.slice(0, 6).map((r: any) => (
                            <tr key={r.id}>
                              <td className="px-3 py-2.5">{pick(r.exam_title_en, r.exam_title_ur)}</td>
                              <td className="px-3 py-2.5">{pick(r.subject_name_en, r.subject_name_ur)}</td>
                              <td className="px-3 py-2.5 text-end font-semibold tabular-nums">{r.total_marks}</td>
                              <td className="px-3 py-2.5 font-medium text-[#065F46]">{r.grade}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {tab === 'subjects' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#065F46]">{lang === 'ur' ? 'مضامین، کتب اور اساتذہ' : 'Subjects, Books & Teachers'}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#E5ECE8] text-[#5A6D65]">
                    <th className="py-2.5 text-start font-medium">{lang === 'ur' ? 'کوڈ' : 'Code'}</th>
                    <th className="py-2.5 text-start font-medium">{t('subjectLabel')}</th>
                    <th className="py-2.5 text-start font-medium">{t('book')}</th>
                    <th className="py-2.5 text-start font-medium">{t('teacherLabel')}</th>
                    <th className="py-2.5 text-start font-medium">{lang === 'ur' ? 'اوقات' : 'Schedule'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F0]">
                  {enrolledSubjects.length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-[#5A6D65]">{t('noData')}</td></tr>
                  ) : (
                    enrolledSubjects.map((s: any, idx: number) => (
                      <tr key={`${s.subject_id}-${s.book_id || idx}`}>
                        <td className="py-2.5 font-mono-code font-semibold text-[#065F46] whitespace-nowrap">{s.subject_code}</td>
                        <td className="py-2.5 font-medium">{pick(s.subject_name_en, s.subject_name_ur)}</td>
                        <td className="py-2.5">{pick(s.book_title_en, s.book_title_ur) || '—'}</td>
                        <td className="py-2.5">{pick(s.teacher_name, s.teacher_name_ur) || '—'}</td>
                        <td className="py-2.5 text-[#5A6D65]">
                          {s.start_time ? `${s.start_time} - ${s.end_time || ''}` : '—'}
                          {s.days_of_week ? ` · ${s.days_of_week}` : ''}
                          {s.room_name ? ` · ${s.room_name}` : ''}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'personal' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-3">
              <h3 className="font-semibold text-[#065F46] border-b border-[#EEF2F0] pb-2">{t('tabPersonal')}</h3>
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <dt className="text-[#5A6D65]">{t('studentId')}</dt>
                <dd className="col-span-2 font-mono-code font-semibold text-[#111C18]">{st.student_code}</dd>
                <dt className="text-[#5A6D65]">{t('fullNameUr')}</dt>
                <dd className="col-span-2 text-[#111C18]">{st.full_name_ur}</dd>
                <dt className="text-[#5A6D65]">{t('fullName')}</dt>
                <dd className="col-span-2 text-[#111C18] font-poppins">{st.full_name}</dd>
                <dt className="text-[#5A6D65]">{t('fatherNameUr')}</dt>
                <dd className="col-span-2 text-[#111C18]">{pick(st.father_name, st.father_name_ur)}</dd>
                <dt className="text-[#5A6D65]">{t('dob')}</dt>
                <dd className="col-span-2 tabular-nums text-[#111C18]">{st.date_of_birth || '—'}</dd>
                <dt className="text-[#5A6D65]">{t('phone')}</dt>
                <dd className="col-span-2 font-mono-code text-[#111C18]">{st.phone}</dd>
                <dt className="text-[#5A6D65]">{t('email')}</dt>
                <dd className="col-span-2 font-mono-code text-[#111C18]">{st.email || '—'}</dd>
                <dt className="text-[#5A6D65]">{t('address')}</dt>
                <dd className="col-span-2 text-[#111C18]">{pick(st.address, st.address_ur) || '—'}</dd>
              </dl>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-[#065F46] border-b border-[#EEF2F0] pb-2">
                {lang === 'ur' ? 'تعلیمی اور سرپرست کی تفصیلات' : 'Academic & Guardian Details'}
              </h3>
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <dt className="text-[#5A6D65]">{t('admissionDate')}</dt>
                <dd className="col-span-2 tabular-nums text-[#111C18]">{st.admission_date}</dd>
                <dt className="text-[#5A6D65]">{t('prevEducation')}</dt>
                <dd className="col-span-2 text-[#111C18]">{pick(st.previous_education, st.previous_education_ur) || '—'}</dd>
                <dt className="text-[#5A6D65]">{t('academicYear')}</dt>
                <dd className="col-span-2 text-[#111C18]">{pick(st.year_title_en, st.year_title_ur)}</dd>
                <dt className="text-[#5A6D65]">{t('classLabel')}</dt>
                <dd className="col-span-2 text-[#111C18]">{pick(st.class_name_en, st.class_name_ur)}</dd>
                {guardians.map((g: any) => (
                  <React.Fragment key={g.id}>
                    <dt className="text-[#5A6D65]">{t('guardianName')}</dt>
                    <dd className="col-span-2 text-[#111C18]">{pick(g.full_name, g.full_name_ur)}</dd>
                    <dt className="text-[#5A6D65]">{t('guardianPhone')}</dt>
                    <dd className="col-span-2 font-mono-code text-[#111C18]">{g.phone}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </div>
          </div>
        )}

        {tab === 'attendance' && (() => {
          const groupedByDate = Object.values(
            attendance.reduce((acc: Record<string, any>, a: any) => {
              if (!acc[a.attendance_date]) {
                acc[a.attendance_date] = { date: a.attendance_date, sessions: {}, remarks: [] as string[] };
              }
              acc[a.attendance_date].sessions[a.session_id] = a;
              if (a.remarks && a.remarks.trim()) acc[a.attendance_date].remarks.push(a.remarks.trim());
              return acc;
            }, {})
          ).sort((a: any, b: any) => (a.date < b.date ? 1 : -1));

          const sessionCols = [
            { id: 'ses-morning', label: lang === 'ur' ? 'صبح تا ظہر' : 'Morning – Zuhr' },
            { id: 'ses-zuhr', label: lang === 'ur' ? 'ظہر تا عصر' : 'Zuhr – Asr' },
            { id: 'ses-maghrib', label: lang === 'ur' ? 'مغرب تا عشاء' : 'Maghrib – Isha' },
          ];

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                    <th className="px-3 py-2.5 text-start font-medium whitespace-nowrap">{t('date')}</th>
                    {sessionCols.map((sc) => (
                      <th key={sc.id} className="px-3 py-2.5 text-start font-medium whitespace-nowrap">{sc.label}</th>
                    ))}
                    <th className="px-3 py-2.5 text-start font-medium">{t('remarks')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F0]">
                  {groupedByDate.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[#5A6D65]">{t('noData')}</td>
                    </tr>
                  ) : (
                    groupedByDate.map((row: any) => (
                      <tr key={row.date} className="hover:bg-[#F6F8F7]">
                        <td className="px-3 py-2.5 font-mono-code tabular-nums whitespace-nowrap">{row.date}</td>
                        {sessionCols.map((sc) => {
                          const rec = row.sessions[sc.id];
                          return (
                            <td key={sc.id} className="px-3 py-2.5 whitespace-nowrap">
                              {rec ? (
                                <StatusText status={rec.status} />
                              ) : (
                                <span className="text-[#94A3B8]">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2.5 text-[#5A6D65]">{row.remarks.join(' · ') || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          );
        })()}

        {tab === 'mutala' && (
          <div className="space-y-3">
            {mutala.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#5A6D65]">{t('noData')}</p>
            ) : (
              mutala.map((m: any) => (
                <div key={m.id} className="rounded-md border border-[#E5ECE8] p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm font-semibold text-[#111C18]">
                      {pick(m.book_title_en, m.book_title_ur)} — {m.chapter}
                    </div>
                    <StatusText status={m.status} />
                  </div>
                  <div className="text-xs text-[#5A6D65] tabular-nums">
                    <span>{m.study_date}</span>
                    <span className="mx-1.5">·</span>
                    <span>{m.start_position} — {m.end_position}</span>
                  </div>
                  <p className="text-xs text-[#2A3B34]">{m.study_details}</p>
                  {m.review_comments && (
                    <div className="mt-2 rounded bg-[#F6F8F7] p-2.5 text-xs text-[#064E3B]">
                      <span className="font-semibold">{m.reviewer_name}: </span>
                      <span>{m.review_comments}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'lessons' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E5ECE8] text-[#5A6D65]">
                  <th className="py-2.5 text-start font-medium">{t('date')}</th>
                  <th className="py-2.5 text-start font-medium">{t('book')}</th>
                  <th className="py-2.5 text-start font-medium">{t('teacherLabel')}</th>
                  <th className="py-2.5 text-start font-medium">{t('startPos')} - {t('endPos')}</th>
                  <th className="py-2.5 text-start font-medium">{t('homework')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F0]">
                {lessons.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-[#5A6D65]">{t('noData')}</td></tr>
                ) : (
                  lessons.map((l: any) => (
                    <tr key={l.id}>
                      <td className="py-2.5 font-mono-code tabular-nums">{l.lesson_date}</td>
                      <td className="py-2.5 font-medium">{pick(l.book_title_en, l.book_title_ur)}</td>
                      <td className="py-2.5">{pick(l.teacher_name, l.teacher_name_ur)}</td>
                      <td className="py-2.5">{l.start_position} — {l.end_position}</td>
                      <td className="py-2.5 text-[#5A6D65]">{l.homework || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'exams' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E5ECE8] text-[#5A6D65]">
                  <th className="py-2.5 text-start font-medium">{t('examTitle')}</th>
                  <th className="py-2.5 text-start font-medium">{t('startDate')}</th>
                  <th className="py-2.5 text-start font-medium">{t('endDate')}</th>
                  <th className="py-2.5 text-start font-medium">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F0]">
                {exams.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-[#5A6D65]">{t('noData')}</td></tr>
                ) : (
                  exams.map((ex: any) => (
                    <tr key={ex.id}>
                      <td className="py-2.5 font-medium">{pick(ex.title_en, ex.title_ur)}</td>
                      <td className="py-2.5 font-mono-code tabular-nums">{ex.start_date}</td>
                      <td className="py-2.5 font-mono-code tabular-nums">{ex.end_date}</td>
                      <td className="py-2.5"><StatusText status={ex.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'results' && (
          <div className="space-y-4">
            <div className="no-print flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#111C18]">{t('resultCard')}</h3>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#065F46] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#064E3B]"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>{t('printCard')}</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#E5ECE8] text-[#5A6D65]">
                    <th className="py-2.5 text-start font-medium">{t('examTitle')}</th>
                    <th className="py-2.5 text-start font-medium">{t('subjectLabel')}</th>
                    <th className="py-2.5 text-end font-medium">{t('writtenMarks')}</th>
                    <th className="py-2.5 text-end font-medium">{t('oralMarks')}</th>
                    <th className="py-2.5 text-end font-medium">{t('totalMarks')}</th>
                    <th className="py-2.5 text-start font-medium">{t('grade')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F0]">
                  {results.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-[#5A6D65]">{t('noData')}</td></tr>
                  ) : (
                    results.map((r: any) => (
                      <tr key={r.id}>
                        <td className="py-2.5">{pick(r.exam_title_en, r.exam_title_ur)}</td>
                        <td className="py-2.5 font-medium">{pick(r.subject_name_en, r.subject_name_ur)}</td>
                        <td className="py-2.5 text-end tabular-nums">{r.written_marks} / {r.written_max_marks}</td>
                        <td className="py-2.5 text-end tabular-nums">{r.oral_marks} / {r.oral_max_marks}</td>
                        <td className="py-2.5 text-end font-semibold tabular-nums">{r.total_marks}</td>
                        <td className="py-2.5 font-medium text-[#065F46]">{r.grade}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'research' && (
          <div className="space-y-4">
            {research.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#5A6D65]">{t('noData')}</p>
            ) : (
              research.map((ra: any) => (
                <div key={ra.id} className="rounded-md border border-[#E5ECE8] p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-[#111C18]">{pick(ra.title_en, ra.title_ur)}</h4>
                    <StatusText status={ra.status} />
                  </div>
                  <div className="text-xs text-[#5A6D65]">
                    <span>{t('supervisor')}: {pick(ra.supervisor_name, ra.supervisor_name_ur)}</span>
                    <span className="mx-1.5">·</span>
                    <span className="tabular-nums">{t('deadline')}: {ra.deadline}</span>
                  </div>
                  {ra.reviews?.map((rv: any) => (
                    <div key={rv.id} className="rounded bg-[#F6F8F7] p-2.5 text-xs text-[#2A3B34]">
                      {rv.comments}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'documents' && (
          <div className="space-y-4">
            {canManageStudents && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 pb-4 border-b border-[#EEF2F0]">
                <div className="flex-1">
                  <label className="block text-xs text-[#5A6D65] mb-1">{t('documentTitle')}</label>
                  <input
                    type="text"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder={lang === 'ur' ? 'مثلاً: شہادۃ العالمیہ سند' : 'e.g. Alamiyyah Certificate'}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#5A6D65] mb-1">{t('documentCategory')}</label>
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value)}
                    className="rounded-md border border-[#DCE4E0] px-3 py-2 text-xs bg-white"
                  >
                    <option value="certificate">{lang === 'ur' ? 'سند / سرٹیفکیٹ' : 'Certificate'}</option>
                    <option value="identity">{lang === 'ur' ? 'شناختی دستاویز' : 'Identity / CNIC'}</option>
                    <option value="transcript">{lang === 'ur' ? 'کشف الدرجات' : 'Transcript'}</option>
                  </select>
                </div>
                <label className="inline-flex items-center gap-2 rounded-md bg-[#065F46] px-4 py-2 text-xs font-medium text-white hover:bg-[#064E3B] cursor-pointer whitespace-nowrap">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{uploading ? t('loading') : t('uploadDocument')}</span>
                  <input type="file" className="hidden" onChange={handleUploadDoc} disabled={uploading} />
                </label>
              </div>
            )}

            <div className="divide-y divide-[#EEF2F0]">
              {documents.length === 0 ? (
                <p className="py-8 text-center text-xs text-[#5A6D65]">{t('noData')}</p>
              ) : (
                documents.map((doc: any) => (
                  <div key={doc.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-4 w-4 text-[#065F46] shrink-0" />
                      <div className="min-w-0">
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-[#065F46] hover:underline block break-words"
                        >
                          {doc.title}
                        </a>
                        <div className="text-[11px] text-[#5A6D65]">
                          <span>{doc.category}</span>
                          <span className="mx-1.5">·</span>
                          <span className="font-mono-code">{doc.file_name}</span>
                        </div>
                      </div>
                    </div>
                    {canManageStudents && (
                      <button
                        type="button"
                        onClick={() => setDocToDelete(doc.id)}
                        className="p-1.5 text-red-700 hover:bg-red-50 rounded"
                        aria-label="Delete document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'monthly' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E5ECE8] text-[#5A6D65]">
                  <th className="py-2.5 text-start font-medium">{lang === 'ur' ? 'مہینہ' : 'Month'}</th>
                  <th className="py-2.5 text-end font-medium">{t('attendancePct')}</th>
                  <th className="py-2.5 text-end font-medium">{t('present')}</th>
                  <th className="py-2.5 text-end font-medium">{t('absent')}</th>
                  <th className="py-2.5 text-end font-medium">{t('tabMutala')}</th>
                  <th className="py-2.5 text-end font-medium">{t('approved')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F0]">
                {monthlyReports.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-[#5A6D65]">{t('noData')}</td></tr>
                ) : (
                  monthlyReports.map((mr: any) => {
                    const pct = mr.attTotal > 0 ? Math.round((mr.attPresent / mr.attTotal) * 100) : 0;
                    return (
                      <tr key={mr.month}>
                        <td className="py-2.5 font-mono-code">{mr.month}</td>
                        <td className="py-2.5 text-end font-semibold tabular-nums text-[#065F46]">{pct}%</td>
                        <td className="py-2.5 text-end tabular-nums">{mr.attPresent}</td>
                        <td className="py-2.5 text-end tabular-nums text-[#B91C1C]">{mr.attAbsent}</td>
                        <td className="py-2.5 text-end tabular-nums">{mr.mutalaCount}</td>
                        <td className="py-2.5 text-end tabular-nums text-[#15803D]">{mr.mutalaApproved}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'history' && (
          <div className="divide-y divide-[#EEF2F0]">
            {activityHistory.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#5A6D65]">{t('noData')}</p>
            ) : (
              activityHistory.map((h: any) => (
                <div key={h.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <span className="text-[#111C18]">{formatActivityAction(h.action, lang)}</span>
                    <span className="mx-1.5 text-[#5A6D65]">·</span>
                    <span className="text-[#5A6D65]">{h.actor_name}</span>
                  </div>
                  <span className="font-mono-code text-[#5A6D65] tabular-nums">{(h.created_at || '').slice(0, 16)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(docToDelete)}
        title={t('delete')}
        message={lang === 'ur' ? 'کیا آپ واقعی یہ دستاویز حذف کرنا چاہتے ہیں؟' : 'Are you sure you want to delete this document?'}
        danger
        onConfirm={handleDeleteDoc}
        onCancel={() => setDocToDelete(null)}
      />
    </div>
  );
};
