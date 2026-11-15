import React, { useEffect, useState } from 'react';
import { Plus, ArrowLeft, ArrowRight, Printer, Check, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { todayLocal } from '../lib/date';
import { ErrorState } from './ErrorState';
import { StatusText } from './StatusText';

export const ExamsView: React.FC = () => {
  const { lang, t, pick } = useLanguage();
  const { user, canManageExams, canManageStudents } = useAuth();
  const [exams, setExams] = useState<any[]>([]);
  const [lookups, setLookups] = useState<any>({ classes: [], subjects: [], academicYears: [] });
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [examDetail, setExamDetail] = useState<any | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [marksDraft, setMarksDraft] = useState<Record<string, { written: number; oral: number; remarks: string }>>({});
  const [resultCardStudentId, setResultCardStudentId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title_en: '',
    title_ur: '',
    class_id: 'cls-tak1',
    academic_year_id: 'ay-1447',
    exam_type: 'term',
    start_date: todayLocal(),
    end_date: todayLocal(),
  });

  const loadExams = async () => {
    setError(null);
    try {
      const [ex, lkp] = await Promise.all([apiFetch('/api/exams', {}, user), apiFetch('/api/lookups', {}, user)]);
      setExams(Array.isArray(ex) ? ex : Array.isArray(ex?.exams) ? ex.exams : []);
      setLookups({
        classes: lkp?.classes || [],
        academicYears: lkp?.academicYears || [],
        subjects: lkp?.subjects || [],
        ...lkp,
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to load exams');
    }
  };

  useEffect(() => {
    loadExams();
  }, [user?.role]);

  const loadExamDetail = async (id: string) => {
    try {
      const res = await apiFetch(`/api/exams/${id}`, {}, user);
      setExamDetail(res);
      const firstSub = res.subjects?.[0]?.id || '';
      setSelectedSubjectId((prev) => (res.subjects?.some((s: any) => s.id === prev) ? prev : firstSub));
    } catch (err: any) {
      setError(err?.message || 'Failed to load exam details');
    }
  };

  useEffect(() => {
    if (selectedExamId) loadExamDetail(selectedExamId);
  }, [selectedExamId]);

  useEffect(() => {
    if (!examDetail || !selectedSubjectId) return;
    const nextDraft: Record<string, { written: number; oral: number; remarks: string }> = {};
    for (const st of examDetail.students) {
      const existing = examDetail.results.find(
        (r: any) => r.exam_subject_id === selectedSubjectId && r.student_id === st.id
      );
      nextDraft[st.id] = {
        written: existing ? existing.written_marks : 0,
        oral: existing ? existing.oral_marks : 0,
        remarks: existing?.remarks || '',
      };
    }
    setMarksDraft(nextDraft);
  }, [examDetail, selectedSubjectId]);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/exams', { method: 'POST', body: JSON.stringify(form) }, user);
    setCreateOpen(false);
    setForm((f) => ({ ...f, title_en: '', title_ur: '' }));
    await loadExams();
  };

  const handleSaveMarks = async (publish = false) => {
    if (!selectedExamId || !selectedSubjectId) return;
    const entries = Object.entries(marksDraft).map(([studentId, val]: [string, { written: number; oral: number; remarks: string }]) => ({
      examSubjectId: selectedSubjectId,
      studentId,
      writtenMarks: val.written,
      oralMarks: val.oral,
      remarks: val.remarks,
    }));
    await apiFetch(
      `/api/exams/${selectedExamId}/marks`,
      {
        method: 'POST',
        body: JSON.stringify({ entries, publishStatus: publish ? 'published' : undefined }),
      },
      user
    );
    await loadExamDetail(selectedExamId);
    await loadExams();
  };

  if (selectedExamId && examDetail) {
    const activeSubject = examDetail.subjects.find((s: any) => s.id === selectedSubjectId);
    const cardStudent = examDetail.students.find((s: any) => s.id === resultCardStudentId);

    return (
      <div className="space-y-5">
        <div className="no-print flex items-center justify-between flex-wrap gap-3">
          <button
            type="button"
            onClick={() => { setSelectedExamId(null); setResultCardStudentId(null); }}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#065F46] hover:underline"
          >
            {lang === 'ur' ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
            <span>{t('navExams')}</span>
          </button>

          {canManageExams && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSaveMarks(false)}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#DCE4E0] bg-white px-3.5 py-2 text-xs font-medium text-[#111C18]"
              >
                <Check className="h-3.5 w-3.5 text-[#065F46]" />
                <span>{t('saveMarks')}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveMarks(true)}
                className="rounded-md bg-[#065F46] px-4 py-2 text-xs font-medium text-white hover:bg-[#064E3B]"
              >
                {t('publishResults')}
              </button>
            </div>
          )}
        </div>

        {/* Exam Header */}
        <div className="rounded-lg border border-[#DCE4E0] bg-white p-5 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-base font-bold text-[#111C18]">{pick(examDetail.exam.title_en, examDetail.exam.title_ur)}</h2>
            <div className="text-xs text-[#5A6D65] mt-1 tabular-nums">
              <span>{pick(examDetail.exam.class_name_en, examDetail.exam.class_name_ur)}</span>
              <span className="mx-1.5">·</span>
              <span>{examDetail.exam.start_date} — {examDetail.exam.end_date}</span>
            </div>
          </div>
          <StatusText status={examDetail.exam.status} />
        </div>

        {/* Subject Selector */}
        <div className="no-print flex items-center gap-1.5 overflow-x-auto pb-1">
          {examDetail.subjects.map((sub: any) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => setSelectedSubjectId(sub.id)}
              className={`px-3.5 py-2 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                selectedSubjectId === sub.id
                  ? 'border-[#065F46] bg-[#065F46] text-white'
                  : 'border-[#DCE4E0] bg-white text-[#2A3B34] hover:bg-[#F6F8F7]'
              }`}
            >
              {pick(sub.subject_name_en, sub.subject_name_ur)}
            </button>
          ))}
        </div>

        {/* Marks Entry Table */}
        <div className="no-print rounded-lg border border-[#DCE4E0] bg-white overflow-x-auto">
          <table className="w-full text-xs min-w-[720px]">
            <thead>
              <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('studentId')}</th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap min-w-[140px]">{t('fullNameUr')}</th>
                <th className="px-4 py-3 text-end font-medium whitespace-nowrap">{t('writtenMarks')} ({activeSubject?.written_max_marks || 80})</th>
                <th className="px-4 py-3 text-end font-medium whitespace-nowrap">{t('oralMarks')} ({activeSubject?.oral_max_marks || 20})</th>
                <th className="px-4 py-3 text-end font-medium whitespace-nowrap">{t('totalMarks')}</th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('grade')}</th>
                <th className="px-4 py-3 text-end font-medium whitespace-nowrap">{t('resultCard')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F0]">
              {examDetail.students.map((st: any) => {
                const d = marksDraft[st.id] || { written: 0, oral: 0, remarks: '' };
                const total = Number(d.written) + Number(d.oral);
                const savedRec = examDetail.results.find(
                  (r: any) => r.exam_subject_id === selectedSubjectId && r.student_id === st.id
                );
                return (
                  <tr key={st.id}>
                    <td className="px-4 py-3 font-mono-code font-semibold text-[#065F46] whitespace-nowrap">{st.student_code}</td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap min-w-[140px]">{pick(st.full_name, st.full_name_ur)}</td>
                    <td className="px-4 py-3 text-end">
                      {canManageExams ? (
                        <input
                          type="number"
                          min={0}
                          max={activeSubject?.written_max_marks || 80}
                          value={d.written}
                          onChange={(e) =>
                            setMarksDraft((prev) => ({
                              ...prev,
                              [st.id]: { ...d, written: Number(e.target.value) },
                            }))
                          }
                          className="w-20 rounded border border-[#DCE4E0] px-2 py-1 text-end tabular-nums"
                        />
                      ) : (
                        <span className="tabular-nums">{d.written}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {canManageExams ? (
                        <input
                          type="number"
                          min={0}
                          max={activeSubject?.oral_max_marks || 20}
                          value={d.oral}
                          onChange={(e) =>
                            setMarksDraft((prev) => ({
                              ...prev,
                              [st.id]: { ...d, oral: Number(e.target.value) },
                            }))
                          }
                          className="w-20 rounded border border-[#DCE4E0] px-2 py-1 text-end tabular-nums"
                        />
                      ) : (
                        <span className="tabular-nums">{d.oral}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end font-bold tabular-nums">{total}</td>
                    <td className="px-4 py-3 font-medium text-[#065F46]">{savedRec?.grade || '—'}</td>
                    <td className="px-4 py-3 text-end">
                      <button
                        type="button"
                        onClick={() => setResultCardStudentId(st.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#065F46] hover:underline"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>{t('resultCard')}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Printable Student Result Card */}
        {cardStudent && (
          <div className="rounded-lg border border-[#065F46]/40 bg-white p-6 print-container space-y-4">
            <div className="flex items-start justify-between border-b border-[#E5ECE8] pb-4">
              <div>
                <h3 className="text-base font-bold text-[#064E3B]">{t('brandName')} — {t('resultCard')}</h3>
                <div className="text-xs text-[#5A6D65] mt-1">
                  <span>{pick(examDetail.exam.title_en, examDetail.exam.title_ur)}</span>
                  <span className="mx-1.5">·</span>
                  <span className="font-mono-code">{cardStudent.student_code}</span>
                  <span className="mx-1.5">·</span>
                  <span className="font-semibold text-[#111C18]">{pick(cardStudent.full_name, cardStudent.full_name_ur)}</span>
                </div>
              </div>
              <div className="no-print flex items-center gap-2">
                <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-md bg-[#065F46] px-3 py-1.5 text-xs font-medium text-white">
                  <Printer className="h-3.5 w-3.5" />
                  <span>{t('printCard')}</span>
                </button>
                <button type="button" onClick={() => setResultCardStudentId(null)} className="rounded-md border border-[#DCE4E0] px-3 py-1.5 text-xs">
                  {t('close')}
                </button>
              </div>
            </div>

            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E5ECE8] text-[#5A6D65]">
                  <th className="py-2 text-start font-medium">{t('subjectLabel')}</th>
                  <th className="py-2 text-end font-medium">{t('writtenMarks')}</th>
                  <th className="py-2 text-end font-medium">{t('oralMarks')}</th>
                  <th className="py-2 text-end font-medium">{t('totalMarks')}</th>
                  <th className="py-2 text-start font-medium">{t('grade')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F0]">
                {examDetail.subjects.map((sub: any) => {
                  const res = examDetail.results.find((r: any) => r.exam_subject_id === sub.id && r.student_id === cardStudent.id);
                  return (
                    <tr key={sub.id}>
                      <td className="py-2 font-medium">{pick(sub.subject_name_en, sub.subject_name_ur)}</td>
                      <td className="py-2 text-end tabular-nums">{res ? res.written_marks : 0} / {sub.written_max_marks}</td>
                      <td className="py-2 text-end tabular-nums">{res ? res.oral_marks : 0} / {sub.oral_max_marks}</td>
                      <td className="py-2 text-end font-bold tabular-nums">{res ? res.total_marks : 0}</td>
                      <td className="py-2 font-medium text-[#065F46]">{res?.grade || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadExams} />;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#DCE4E0] bg-white p-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#111C18]">{t('navExams')}</h2>
        {canManageStudents && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-[#065F46] px-4 py-2 text-xs font-medium text-white hover:bg-[#064E3B]"
          >
            <Plus className="h-4 w-4" />
            <span>{t('createExam')}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exams.map((ex) => (
          <div
            key={ex.id}
            onClick={() => setSelectedExamId(ex.id)}
            className="rounded-lg border border-[#DCE4E0] bg-white p-5 hover:border-[#065F46]/60 cursor-pointer transition-colors space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#065F46]">{pick(ex.class_name_en, ex.class_name_ur)}</span>
              <StatusText status={ex.status} />
            </div>
            <h3 className="text-base font-bold text-[#111C18]">{pick(ex.title_en, ex.title_ur)}</h3>
            <div className="text-xs text-[#5A6D65] tabular-nums">
              <span>{ex.start_date} — {ex.end_date}</span>
              <span className="mx-1.5">·</span>
              <span>{ex.subject_count} {t('subjectLabel')}</span>
            </div>
          </div>
        ))}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-lg border border-[#DCE4E0] bg-white p-4 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE8]">
              <h3 className="text-sm font-bold text-[#111C18]">{t('createExam')}</h3>
              <button type="button" onClick={() => setCreateOpen(false)}><X className="h-4 w-4 text-[#5A6D65]" /></button>
            </div>
            <form onSubmit={handleCreateExam} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('examTitle')} (EN) *</label>
                <input type="text" required value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('examTitle')} (UR)</label>
                <input type="text" value={form.title_ur} onChange={(e) => setForm({ ...form, title_ur: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('classLabel')}</label>
                  <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                    {lookups.classes.map((c: any) => (
                      <option key={c.id} value={c.id}>{pick(c.name_en, c.name_ur)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('examType')}</label>
                  <select value={form.exam_type} onChange={(e) => setForm({ ...form, exam_type: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                    <option value="monthly">{lang === 'ur' ? 'ماہانہ' : 'Monthly'}</option>
                    <option value="term">{lang === 'ur' ? 'ششماہی' : 'Term'}</option>
                    <option value="annual">{lang === 'ur' ? 'سالانہ' : 'Annual'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('startDate')}</label>
                  <input type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('endDate')}</label>
                  <input type="date" required value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setCreateOpen(false)} className="rounded-md border border-[#DCE4E0] px-4 py-2">{t('cancel')}</button>
                <button type="submit" className="rounded-md bg-[#065F46] px-4 py-2 text-white font-medium">{t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
