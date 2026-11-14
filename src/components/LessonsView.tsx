import React, { useEffect, useState } from 'react';
import { Plus, X, BookOpen, Edit3, Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { todayLocal } from '../lib/date';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorState } from './ErrorState';

export const LessonsView: React.FC = () => {
  const { lang, t, pick } = useLanguage();
  const { user, canRecordLessons } = useAuth();
  const [subTab, setSubTab] = useState<'history' | 'progress'>('history');
  const [data, setData] = useState<{ lessons: any[]; bookProgress: any[] }>({ lessons: [], bookProgress: [] });
  const [lookups, setLookups] = useState<any>({ classes: [], subjects: [], books: [], teachers: [] });

  const [classFilter, setClassFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [bookFilter, setBookFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    teacher_id: user?.teacherId || 'tch-1',
    lesson_date: todayLocal(),
    class_id: 'cls-tak1',
    subject_id: 'sub-fiqh',
    book_id: 'bk-radd',
    start_position: '',
    end_position: '',
    homework: '',
    remarks: '',
  });

  const load = async () => {
    setError(null);
    try {
      const p = new URLSearchParams();
      if (classFilter) p.set('classId', classFilter);
      if (teacherFilter) p.set('teacherId', teacherFilter);
      if (bookFilter) p.set('bookId', bookFilter);
      if (dateFilter) p.set('date', dateFilter);

      const [res, lkp] = await Promise.all([
        apiFetch(`/api/lessons${p.toString() ? `?${p.toString()}` : ''}`, {}, user),
        apiFetch('/api/lookups', {}, user),
      ]);
      setData({
        lessons: res?.lessons || (Array.isArray(res) ? res : []),
        syllabus: res?.syllabus || [],
        ...res,
      });
      setLookups({
        teachers: lkp?.teachers || [],
        classes: lkp?.classes || [],
        subjects: lkp?.subjects || [],
        books: lkp?.books || [],
        ...lkp,
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to load lessons');
    }
  };

  useEffect(() => {
    load();
  }, [classFilter, teacherFilter, bookFilter, dateFilter, user?.role]);

  const openAddModal = (preset?: { book_id?: string; class_id?: string; subject_id?: string; start_position?: string }) => {
    setEditingLesson(null);
    setForm({
      teacher_id: user?.teacherId || lookups.teachers?.[0]?.id || 'tch-1',
      lesson_date: todayLocal(),
      class_id: preset?.class_id || lookups.classes?.[0]?.id || 'cls-tak1',
      subject_id: preset?.subject_id || lookups.subjects?.[0]?.id || 'sub-fiqh',
      book_id: preset?.book_id || lookups.books?.[0]?.id || 'bk-radd',
      start_position: preset?.start_position || '',
      end_position: '',
      homework: '',
      remarks: '',
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
      start_position: l.start_position,
      end_position: l.end_position,
      homework: l.homework || '',
      remarks: l.remarks || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLesson) {
      await apiFetch(`/api/lessons/${editingLesson.id}`, { method: 'PUT', body: JSON.stringify(form) }, user);
    } else {
      await apiFetch('/api/lessons', { method: 'POST', body: JSON.stringify(form) }, user);
    }
    setModalOpen(false);
    setEditingLesson(null);
    setForm((f) => ({ ...f, start_position: '', end_position: '', homework: '', remarks: '' }));
    await load();
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    await apiFetch(`/api/lessons/${confirmDeleteId}`, { method: 'DELETE' }, user);
    setConfirmDeleteId(null);
    await load();
  };

  const prevBookProgress = !editingLesson
    ? data.bookProgress.find((bp) => bp.book_id === form.book_id && bp.latest_position)
    : null;

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <div className="space-y-5">
      {/* Controls & Filters */}
      <div className="rounded-lg border border-[#DCE4E0] bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 rounded-md bg-[#F6F8F7] border border-[#DCE4E0]">
            <button
              type="button"
              onClick={() => setSubTab('history')}
              className={`px-3 py-1.5 text-xs rounded whitespace-nowrap ${
                subTab === 'history' ? 'bg-white text-[#065F46] shadow-sm' : 'text-[#5A6D65]'
              }`}
            >
              {lang === 'ur' ? 'یومیہ اسباق (کہاں سے کہاں تک پڑھایا)' : 'Daily Lessons (From — To)'}
            </button>
            <button
              type="button"
              onClick={() => setSubTab('progress')}
              className={`px-3 py-1.5 text-xs rounded whitespace-nowrap ${
                subTab === 'progress' ? 'bg-white text-[#065F46] shadow-sm' : 'text-[#5A6D65]'
              }`}
            >
              {t('bookProgress')}
            </button>
          </div>

          {canRecordLessons && (
            <button
              type="button"
              onClick={() => openAddModal()}
              className="inline-flex items-center gap-2 rounded-md bg-[#065F46] px-4 py-2 text-xs text-white hover:bg-[#064E3B] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>{t('recordLesson')}</span>
            </button>
          )}
        </div>

        {subTab === 'history' && (
          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[#EEF2F0]">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-md border border-[#DCE4E0] px-2.5 py-1.5 text-xs bg-white"
            />
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="rounded-md border border-[#DCE4E0] px-2.5 py-1.5 text-xs bg-white"
            >
              <option value="">{t('allClasses')}</option>
              {lookups.classes.map((c: any) => (
                <option key={c.id} value={c.id}>{pick(c.name_en, c.name_ur)}</option>
              ))}
            </select>
            <select
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="rounded-md border border-[#DCE4E0] px-2.5 py-1.5 text-xs bg-white"
            >
              <option value="">{lang === 'ur' ? 'تمام اساتذہ' : 'All Teachers'}</option>
              {lookups.teachers.map((tc: any) => (
                <option key={tc.id} value={tc.id}>{pick(tc.full_name, tc.full_name_ur)}</option>
              ))}
            </select>
            <select
              value={bookFilter}
              onChange={(e) => setBookFilter(e.target.value)}
              className="rounded-md border border-[#DCE4E0] px-2.5 py-1.5 text-xs bg-white"
            >
              <option value="">{lang === 'ur' ? 'تمام کتب' : 'All Books'}</option>
              {lookups.books.map((b: any) => (
                <option key={b.id} value={b.id}>{pick(b.title_en, b.title_ur)}</option>
              ))}
            </select>
            {(dateFilter || classFilter || teacherFilter || bookFilter) && (
              <button
                type="button"
                onClick={() => {
                  setDateFilter('');
                  setClassFilter('');
                  setTeacherFilter('');
                  setBookFilter('');
                }}
                className="text-xs text-[#065F46] hover:underline whitespace-nowrap"
              >
                {lang === 'ur' ? 'فلٹر صاف کریں' : 'Clear filters'}
              </button>
            )}
          </div>
        )}
      </div>

      {subTab === 'history' ? (
        <div className="rounded-lg border border-[#DCE4E0] bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('date')}</th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('teacherLabel')}</th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('classLabel')}</th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('subjectLabel')}</th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('book')}</th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">
                  {lang === 'ur' ? 'کہاں سے کہاں تک پڑھایا' : 'Taught (From — To)'}
                </th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('homework')}</th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('remarks')}</th>
                {canRecordLessons && <th className="px-4 py-3 text-end font-medium whitespace-nowrap">{t('actions')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F0]">
              {data.lessons.length === 0 ? (
                <tr><td colSpan={canRecordLessons ? 9 : 8} className="py-10 text-center text-[#5A6D65]">{t('noData')}</td></tr>
              ) : (
                data.lessons.map((l) => (
                  <tr key={l.id} className="hover:bg-[#F6F8F7]">
                    <td className="px-4 py-3 font-mono-code tabular-nums whitespace-nowrap">{l.lesson_date}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{pick(l.teacher_name, l.teacher_name_ur)}</td>
                    <td className="px-4 py-3 text-[#5A6D65] whitespace-nowrap">{pick(l.class_name_en, l.class_name_ur)}</td>
                    <td className="px-4 py-3 text-[#0B2545] whitespace-nowrap">{pick(l.subject_name_en, l.subject_name_ur)}</td>
                    <td className="px-4 py-3 text-[#064E3B] whitespace-nowrap">{pick(l.book_title_en, l.book_title_ur)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-[#111C18]">
                      <span>{l.start_position}</span>
                      <span className="mx-1.5 text-[#94A3B8]">—</span>
                      <span>{l.end_position}</span>
                    </td>
                    <td className="px-4 py-3 text-[#2A3B34]">{l.homework || '—'}</td>
                    <td className="px-4 py-3 text-[#5A6D65]">{l.remarks || '—'}</td>
                    {canRecordLessons && (
                      <td className="px-4 py-3 text-end whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(l)}
                            title={t('edit')}
                            className="text-[#0284C7] hover:underline inline-flex items-center gap-1"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>{t('edit')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(l.id)}
                            title={t('delete')}
                            className="text-[#B91C1C] hover:underline"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.bookProgress.map((bp) => (
            <div key={bp.book_id} className="rounded-lg border border-[#DCE4E0] bg-white p-5 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-[#065F46]">
                  <div className="inline-flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 shrink-0" />
                    <span className="text-xs">{pick(bp.subject_name_en, bp.subject_name_ur)}</span>
                  </div>
                  <span className="font-mono-code text-[11px] text-[#5A6D65] tabular-nums">{bp.last_taught_date || '—'}</span>
                </div>
                <h3 className="text-base text-[#111C18]">{pick(bp.title_en, bp.title_ur)}</h3>
                {(bp.latest_teacher_name || bp.latest_class_name_en) && (
                  <div className="text-xs text-[#5A6D65]">
                    {pick(bp.latest_teacher_name, bp.latest_teacher_name_ur)} · {pick(bp.latest_class_name_en, bp.latest_class_name_ur)}
                  </div>
                )}
                <div className="rounded bg-[#F6F8F7] border border-[#E5ECE8] px-3 py-2 text-xs text-[#0B2545]">
                  <div>
                    <span className="text-[#5A6D65]">{lang === 'ur' ? 'آخری پڑھایا گیا سبق:' : 'Latest Lesson:'} </span>
                    <span>{bp.latest_start_position ? `${bp.latest_start_position} — ${bp.latest_position}` : (bp.latest_position || '—')}</span>
                  </div>
                  <div className="text-[11px] text-[#5A6D65] tabular-nums mt-0.5">
                    {lang === 'ur' ? `کل اسباق: ${bp.lessons_count}` : `Total Lessons: ${bp.lessons_count}`}
                    {bp.total_pages > 0 ? ` · ${lang === 'ur' ? `کل صفحات: ${bp.total_pages}` : `Total Pages: ${bp.total_pages}`}` : ''}
                  </div>
                </div>
              </div>
              {canRecordLessons && (
                <button
                  type="button"
                  onClick={() => openAddModal({ book_id: bp.book_id, start_position: bp.latest_position || '' })}
                  className="text-xs text-[#065F46] hover:underline text-start pt-1"
                >
                  {lang === 'ur' ? '+ آج کا نیا سبق اپ ڈیٹ کریں' : '+ Update Today’s Lesson'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Record / Edit Lesson Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-lg border border-[#DCE4E0] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE8]">
              <h3 className="text-sm text-[#111C18]">
                {editingLesson ? (lang === 'ur' ? 'سبق میں ترمیم / اپ ڈیٹ کریں' : 'Update Lesson Record') : t('recordLesson')}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)}><X className="h-4 w-4 text-[#5A6D65]" /></button>
            </div>
            <form onSubmit={handleSave} className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('date')}</label>
                  <input type="date" required value={form.lesson_date} onChange={(e) => setForm({ ...form, lesson_date: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('teacherLabel')}</label>
                  <select value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                    {lookups.teachers.map((tc: any) => (
                      <option key={tc.id} value={tc.id}>{pick(tc.full_name, tc.full_name_ur)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('classLabel')}</label>
                  <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                    {lookups.classes.map((c: any) => (
                      <option key={c.id} value={c.id}>{pick(c.name_en, c.name_ur)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('subjectLabel')}</label>
                  <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                    {lookups.subjects.map((s: any) => (
                      <option key={s.id} value={s.id}>{pick(s.name_en, s.name_ur)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('book')}</label>
                <select value={form.book_id} onChange={(e) => setForm({ ...form, book_id: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                  {lookups.books.map((b: any) => (
                    <option key={b.id} value={b.id}>{pick(b.title_en, b.title_ur)}</option>
                  ))}
                </select>
              </div>

              {prevBookProgress && (
                <div className="rounded-md border border-[#065F46]/25 bg-[#065F46]/5 px-3 py-2 flex items-center justify-between gap-2 text-xs text-[#064E3B]">
                  <span>
                    {lang === 'ur'
                      ? `گذشتہ سبق (${prevBookProgress.last_taught_date}): ${prevBookProgress.latest_start_position || ''} تا ${prevBookProgress.latest_position}`
                      : `Previous (${prevBookProgress.last_taught_date}): ${prevBookProgress.latest_start_position || ''} to ${prevBookProgress.latest_position}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, start_position: prevBookProgress.latest_position }))}
                    className="text-[#065F46] underline whitespace-nowrap"
                  >
                    {lang === 'ur' ? 'یہیں سے آگے شروع کریں' : 'Start from here'}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#5A6D65] mb-1">
                    {lang === 'ur' ? 'کہاں سے پڑھایا (صفحہ / باب از) *' : 'Taught From (Page / Bab) *'}
                  </label>
                  <input type="text" required placeholder={lang === 'ur' ? 'مثلاً: صفحہ ۱۸۰' : 'e.g. Page 180'} value={form.start_position} onChange={(e) => setForm({ ...form, start_position: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">
                    {lang === 'ur' ? 'کہاں تک پڑھایا (صفحہ / باب تا) *' : 'Taught To (Page / Bab) *'}
                  </label>
                  <input type="text" required placeholder={lang === 'ur' ? 'مثلاً: صفحہ ۱۹۵' : 'e.g. Page 195'} value={form.end_position} onChange={(e) => setForm({ ...form, end_position: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('homework')}</label>
                <input type="text" value={form.homework} onChange={(e) => setForm({ ...form, homework: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('remarks')}</label>
                <input type="text" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-[#DCE4E0] px-4 py-2">{t('cancel')}</button>
                <button type="submit" className="rounded-md bg-[#065F46] px-4 py-2 text-white">{t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        title={lang === 'ur' ? 'سبق حذف کریں' : 'Delete Lesson Record'}
        message={lang === 'ur' ? 'کیا آپ واقعی اس سبق کا ریکارڈ حذف کرنا چاہتے ہیں؟' : 'Are you sure you want to delete this lesson record?'}
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
};
