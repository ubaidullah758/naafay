import React, { useEffect, useState } from 'react';
import { Plus, Upload, Check, RotateCcw, X, FileText } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch, fileToDataUrl } from '../lib/api';
import { addDaysLocal, todayLocal } from '../lib/date';
import { ErrorState } from './ErrorState';
import { StatusText } from './StatusText';

export const ResearchView: React.FC = () => {
  const { lang, t, pick } = useLanguage();
  const { user, canReviewResearch } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);

  const [reviewTarget, setReviewTarget] = useState<any | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'needs_correction'>('approved');
  const [reviewComments, setReviewComments] = useState('');
  const [archiveChecked, setArchiveChecked] = useState(true);

  const [form, setForm] = useState({
    title_en: '',
    title_ur: '',
    field_of_fiqh: 'فقہِ معاملات',
    description: '',
    student_id: 'stu-1',
    supervisor_teacher_id: 'tch-1',
    deadline: addDaysLocal(30),
  });

  const load = async () => {
    setError(null);
    try {
      const [res, stu, lkp] = await Promise.all([
        apiFetch('/api/research', {}, user),
        apiFetch('/api/students', {}, user),
        apiFetch('/api/lookups', {}, user),
      ]);
      setAssignments(res?.assignments || []);
      setStudents(Array.isArray(stu) ? stu : stu?.students || []);
      setTeachers(lkp?.teachers || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load research records');
    }
  };

  useEffect(() => {
    load();
  }, [user?.role]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/research/assign', { method: 'POST', body: JSON.stringify(form) }, user);
    setAssignOpen(false);
    setForm((f) => ({ ...f, title_en: '', title_ur: '', description: '' }));
    await load();
  };

  const handleFileUpload = async (assignmentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    const up = await apiFetch('/api/uploads', { method: 'POST', body: JSON.stringify({ fileName: file.name, dataUrl }) }, user);
    await apiFetch(
      `/api/research/${assignmentId}/submit`,
      {
        method: 'POST',
        body: JSON.stringify({
          fileName: up.fileName,
          fileUrl: up.fileUrl,
          notes: lang === 'ur' ? 'نیا مسودہ اپ لوڈ کیا گیا' : 'Submitted manuscript file',
        }),
      },
      user
    );
    await load();
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTarget) return;
    await apiFetch(
      `/api/research/${reviewTarget.id}/review`,
      {
        method: 'POST',
        body: JSON.stringify({
          decision: reviewDecision,
          comments: reviewComments,
          archive: reviewDecision === 'approved' && archiveChecked,
        }),
      },
      user
    );
    setReviewTarget(null);
    setReviewComments('');
    await load();
  };

  const visible = assignments.filter((a) => {
    if (filterStatus === 'archive') return a.status === 'approved' || a.status === 'archived';
    if (filterStatus) return a.status === filterStatus;
    return true;
  });

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#DCE4E0] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-md bg-[#F6F8F7] border border-[#DCE4E0] overflow-x-auto">
          {[
            { id: '', label: t('allStatuses') },
            { id: 'assigned', label: t('assigned') },
            { id: 'submitted', label: t('submitted') },
            { id: 'needs_correction', label: t('needs_correction') },
            { id: 'archive', label: t('researchArchive') },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterStatus(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap ${
                filterStatus === f.id ? 'bg-white text-[#065F46] shadow-sm' : 'text-[#5A6D65]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {canReviewResearch && (
          <button
            type="button"
            onClick={() => setAssignOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-[#065F46] px-4 py-2 text-xs font-medium text-white hover:bg-[#064E3B] whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>{t('assignResearch')}</span>
          </button>
        )}
      </div>

      <div className="space-y-4">
        {visible.length === 0 ? (
          <div className="rounded-lg border border-[#DCE4E0] bg-white p-8 text-center text-xs text-[#5A6D65]">{t('noData')}</div>
        ) : (
          visible.map((ra) => {
            const isOwnStudent = user?.role !== 'student' || user.studentId === ra.student_id;
            return (
              <div key={ra.id} className="rounded-lg border border-[#DCE4E0] bg-white p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-xs text-[#065F46] font-medium">{ra.field_of_fiqh}</div>
                    <h3 className="text-base font-bold text-[#111C18]">{pick(ra.title_en, ra.title_ur)}</h3>
                  </div>
                  <StatusText status={ra.status} />
                </div>

                <div className="text-xs text-[#5A6D65] flex flex-wrap items-center gap-2">
                  <span>{t('roleStudent')}: <strong className="text-[#111C18]">{pick(ra.student_name, ra.student_name_ur)} ({ra.student_code})</strong></span>
                  <span>·</span>
                  <span>{t('supervisor')}: <strong className="text-[#111C18]">{pick(ra.supervisor_name, ra.supervisor_name_ur)}</strong></span>
                  <span>·</span>
                  <span className="tabular-nums">{t('deadline')}: {ra.deadline}</span>
                </div>

                {/* Submissions */}
                {ra.submissions?.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-[#EEF2F0]">
                    {ra.submissions.map((sub: any) => (
                      <div key={sub.id} className="flex items-center justify-between text-xs bg-[#F6F8F7] rounded px-3 py-2">
                        <a href={sub.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-medium text-[#065F46] hover:underline">
                          <FileText className="h-3.5 w-3.5" />
                          <span>v{sub.version_number} — {sub.file_name}</span>
                        </a>
                        <span className="font-mono-code text-[#5A6D65] tabular-nums">{(sub.submitted_at || '').slice(0, 10)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Supervisor Reviews */}
                {ra.reviews?.length > 0 && (
                  <div className="space-y-1.5">
                    {ra.reviews.map((rv: any) => (
                      <div key={rv.id} className="rounded bg-[#065F46]/5 border border-[#065F46]/15 p-3 text-xs text-[#064E3B]">
                        <span className="font-semibold">{t('reviewSubmission')}: </span>
                        <span>{rv.comments}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-[#EEF2F0] flex flex-wrap items-center justify-end gap-2">
                  {isOwnStudent && ra.status !== 'archived' && (
                    <label className="inline-flex items-center gap-1.5 rounded-md border border-[#DCE4E0] bg-white px-3 py-1.5 text-xs font-medium text-[#111C18] hover:bg-[#F6F8F7] cursor-pointer">
                      <Upload className="h-3.5 w-3.5 text-[#065F46]" />
                      <span>{t('uploadSubmission')}</span>
                      <input type="file" className="hidden" onChange={(e) => handleFileUpload(ra.id, e)} />
                    </label>
                  )}

                  {canReviewResearch && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setReviewTarget(ra);
                          setReviewDecision('approved');
                          setReviewComments('');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[#065F46] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#064E3B]"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>{t('approved')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReviewTarget(ra);
                          setReviewDecision('needs_correction');
                          setReviewComments('');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#B45309]/40 px-3 py-1.5 text-xs font-medium text-[#B45309] hover:bg-amber-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>{t('needs_correction')}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Assign Research Modal */}
      {assignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-lg border border-[#DCE4E0] bg-white p-4 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE8]">
              <h3 className="text-sm font-bold text-[#111C18]">{t('assignResearch')}</h3>
              <button type="button" onClick={() => setAssignOpen(false)}><X className="h-4 w-4 text-[#5A6D65]" /></button>
            </div>
            <form onSubmit={handleAssign} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('researchTopic')} (EN) *</label>
                <input type="text" required value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('researchTopic')} (UR)</label>
                <input type="text" value={form.title_ur} onChange={(e) => setForm({ ...form, title_ur: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('roleStudent')}</label>
                  <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>{s.student_code} — {pick(s.full_name, s.full_name_ur)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('supervisor')}</label>
                  <select value={form.supervisor_teacher_id} onChange={(e) => setForm({ ...form, supervisor_teacher_id: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                    {teachers.map((tc) => (
                      <option key={tc.id} value={tc.id}>{pick(tc.full_name, tc.full_name_ur)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('fieldOfFiqh')}</label>
                  <input type="text" value={form.field_of_fiqh} onChange={(e) => setForm({ ...form, field_of_fiqh: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('deadline')}</label>
                  <input type="date" required value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setAssignOpen(false)} className="rounded-md border border-[#DCE4E0] px-4 py-2">{t('cancel')}</button>
                <button type="submit" className="rounded-md bg-[#065F46] px-4 py-2 text-white font-medium">{t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supervisor Review Modal */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-[#DCE4E0] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE8]">
              <h3 className="text-sm font-bold text-[#111C18]">{t('reviewSubmission')}</h3>
              <button type="button" onClick={() => setReviewTarget(null)}><X className="h-4 w-4 text-[#5A6D65]" /></button>
            </div>
            <form onSubmit={handleReviewSubmit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('teacherComments')} *</label>
                <textarea required rows={3} value={reviewComments} onChange={(e) => setReviewComments(e.target.value)} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
              </div>
              {reviewDecision === 'approved' && (
                <label className="flex items-center gap-2 text-[#111C18]">
                  <input type="checkbox" checked={archiveChecked} onChange={(e) => setArchiveChecked(e.target.checked)} />
                  <span>{t('archiveApproved')}</span>
                </label>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setReviewTarget(null)} className="rounded-md border border-[#DCE4E0] px-4 py-2">{t('cancel')}</button>
                <button type="submit" className={`rounded-md px-4 py-2 text-white font-medium ${reviewDecision === 'approved' ? 'bg-[#065F46]' : 'bg-[#B45309]'}`}>
                  {t('confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
