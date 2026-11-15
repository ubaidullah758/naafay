import React, { useEffect, useState } from 'react';
import { Plus, Check, RotateCcw, X, Edit3, BookOpen, List, LayoutGrid } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { todayLocal } from '../lib/date';
import { ErrorState } from './ErrorState';
import { StatusText } from './StatusText';

export const MutalaView: React.FC = () => {
  const { lang, t, pick } = useLanguage();
  const { user, canReviewMutala } = useAuth();

  const [subTab, setSubTab] = useState<'logs' | 'summary'>('logs');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [logs, setLogs] = useState<any[]>([]);
  const [summaryRows, setSummaryRows] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);

  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [bookFilter, setBookFilter] = useState('');
  const [studentFilter, setStudentFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [reviewTarget, setReviewTarget] = useState<any | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'needs_correction'>('approved');
  const [reviewComments, setReviewComments] = useState('');

  const [form, setForm] = useState({
    student_id: 'stu-1',
    study_date: todayLocal(),
    book_id: 'bk-radd',
    chapter: '',
    start_position: '',
    end_position: '',
    study_details: '',
    student_comments: '',
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      if (statusFilter) p.set('status', statusFilter);
      if (dateFilter) p.set('date', dateFilter);
      if (bookFilter) p.set('bookId', bookFilter);
      if (studentFilter) p.set('studentId', studentFilter);

      const sp = new URLSearchParams();
      if (bookFilter) sp.set('bookId', bookFilter);
      if (studentFilter) sp.set('studentId', studentFilter);

      const [mRes, sumRes, lkp, stuRes] = await Promise.all([
        apiFetch(`/api/mutala${p.toString() ? `?${p.toString()}` : ''}`, {}, user),
        apiFetch(`/api/mutala/summary${sp.toString() ? `?${sp.toString()}` : ''}`, {}, user),
        apiFetch('/api/lookups', {}, user),
        apiFetch('/api/students', {}, user),
      ]);
      setLogs(Array.isArray(mRes) ? mRes : []);
      setSummaryRows(Array.isArray(sumRes) ? sumRes : []);
      setBooks(Array.isArray(lkp?.books) ? lkp.books : []);
      const studentList = Array.isArray(stuRes) ? stuRes : Array.isArray(stuRes?.students) ? stuRes.students : [];
      setStudents(studentList);
      if (user?.studentId) {
        setForm((f) => ({ ...f, student_id: user.studentId! }));
      } else if (studentList?.[0]?.id && !editingLog) {
        setForm((f) => ({ ...f, student_id: studentList[0].id }));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load study logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter, dateFilter, bookFilter, studentFilter, user?.role]);

  const openAddModal = (preset?: { studentId?: string; bookId?: string; startFrom?: string; chapter?: string }) => {
    setEditingLog(null);
    setForm({
      student_id: preset?.studentId || user?.studentId || students?.[0]?.id || 'stu-1',
      study_date: todayLocal(),
      book_id: preset?.bookId || books?.[0]?.id || 'bk-radd',
      chapter: preset?.chapter || '',
      start_position: preset?.startFrom || '',
      end_position: '',
      study_details: '',
      student_comments: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (m: any) => {
    setEditingLog(m);
    setForm({
      student_id: m.student_id,
      study_date: m.study_date,
      book_id: m.book_id,
      chapter: m.chapter,
      start_position: m.start_position,
      end_position: m.end_position,
      study_details: m.study_details,
      student_comments: m.student_comments || '',
    });
    setModalOpen(true);
  };

  const handleSubmitMutala = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLog) {
      await apiFetch(`/api/mutala/${editingLog.id}`, { method: 'PUT', body: JSON.stringify(form) }, user);
    } else {
      await apiFetch('/api/mutala', { method: 'POST', body: JSON.stringify(form) }, user);
    }
    setModalOpen(false);
    setEditingLog(null);
    setForm((f) => ({ ...f, chapter: '', start_position: '', end_position: '', study_details: '', student_comments: '' }));
    await load();
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTarget) return;
    await apiFetch(
      `/api/mutala/${reviewTarget.id}/review`,
      {
        method: 'POST',
        body: JSON.stringify({ decision: reviewDecision, comments: reviewComments }),
      },
      user
    );
    setReviewTarget(null);
    setReviewComments('');
    await load();
  };

  // Find latest study record for the currently selected student + book inside the modal
  const previousForSelection = !editingLog
    ? summaryRows.find((s) => s.student_id === form.student_id && s.book_id === form.book_id)
    : null;

  const canEditEntry = (m: any) => {
    if (user?.role === 'admin' || user?.role === 'mufti' || user?.role === 'senior_mufti' || user?.role === 'office_staff') return true;
    if (user?.role === 'student' && m.student_id === user.studentId && m.status !== 'approved') return true;
    return false;
  };

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <div className="space-y-5">
      {/* Top Sub-tabs + Controls */}
      <div className="rounded-lg border border-[#DCE4E0] bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 rounded-md bg-[#F6F8F7] border border-[#DCE4E0]">
            <button
              type="button"
              onClick={() => setSubTab('logs')}
              className={`px-3 py-1.5 text-xs rounded transition-colors whitespace-nowrap ${
                subTab === 'logs' ? 'bg-white text-[#065F46] shadow-sm' : 'text-[#5A6D65] hover:text-[#111C18]'
              }`}
            >
              {lang === 'ur' ? 'روزانہ مطالعہ (یومیہ اندراج)' : 'Daily Study Register'}
            </button>
            <button
              type="button"
              onClick={() => setSubTab('summary')}
              className={`px-3 py-1.5 text-xs rounded transition-colors whitespace-nowrap ${
                subTab === 'summary' ? 'bg-white text-[#065F46] shadow-sm' : 'text-[#5A6D65] hover:text-[#111C18]'
              }`}
            >
              {lang === 'ur' ? 'کتاب و صفحہ وار خلاصہ (کہاں سے کہاں تک)' : 'Book & Page Progress Summary'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {subTab === 'logs' && (
              <div className="inline-flex items-center rounded-md border border-[#DCE4E0] bg-[#F6F8F7] p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  title={lang === 'ur' ? 'ٹیبل رجسٹر' : 'Table View'}
                  className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-white text-[#065F46] shadow-sm' : 'text-[#5A6D65]'}`}
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  title={lang === 'ur' ? 'کارڈز' : 'Card View'}
                  className={`p-1.5 rounded ${viewMode === 'cards' ? 'bg-white text-[#065F46] shadow-sm' : 'text-[#5A6D65]'}`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => openAddModal()}
              className="inline-flex items-center gap-2 rounded-md bg-[#065F46] px-4 py-2 text-xs text-white hover:bg-[#064E3B] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>{t('submitMutala')}</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#EEF2F0]">
          {subTab === 'logs' && (
            <>
              <div className="flex flex-wrap items-center gap-1 p-1 rounded-md bg-[#F6F8F7] border border-[#DCE4E0]">
                {[
                  { id: '', label: t('allStatuses') },
                  { id: 'pending', label: t('pending') },
                  { id: 'approved', label: t('approved') },
                  { id: 'needs_correction', label: t('needs_correction') },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStatusFilter(f.id)}
                    className={`px-3 py-1.5 text-xs rounded transition-colors whitespace-nowrap ${
                      statusFilter === f.id ? 'bg-white text-[#065F46] shadow-sm' : 'text-[#5A6D65] hover:text-[#111C18]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="font-mono-code rounded-md border border-[#DCE4E0] px-3 py-2 text-xs bg-white min-h-[42px]"
              />
            </>
          )}

          <select
            value={bookFilter}
            onChange={(e) => setBookFilter(e.target.value)}
            className="rounded-md border border-[#DCE4E0] px-3 py-2 text-xs bg-white min-w-[160px]"
          >
            <option value="">{lang === 'ur' ? 'تمام کتب' : 'All Books'}</option>
            {books.map((b) => (
              <option key={b.id} value={b.id}>{pick(b.title_en, b.title_ur)}</option>
            ))}
          </select>

          {user?.role !== 'student' && (
            <select
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
              className="rounded-md border border-[#DCE4E0] px-3 py-2 text-xs bg-white min-w-[180px]"
            >
              <option value="">{lang === 'ur' ? 'تمام طلبہ' : 'All Students'}</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.student_code} — {pick(s.full_name, s.full_name_ur)}</option>
              ))}
            </select>
          )}

          {(dateFilter || bookFilter || studentFilter || statusFilter) && (
            <button
              type="button"
              onClick={() => {
                setDateFilter('');
                setBookFilter('');
                setStudentFilter('');
                setStatusFilter('');
              }}
              className="text-xs text-[#065F46] hover:underline whitespace-nowrap px-2"
            >
              {lang === 'ur' ? 'فلٹر صاف کریں' : 'Clear filters'}
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: DAILY STUDY REGISTER (RESPONSIVE TABLE ON DESKTOP + CARDS ON MOBILE OR CARD MODE) */}
      {subTab === 'logs' && (
        loading ? (
          <div className="rounded-lg border border-[#DCE4E0] bg-white p-8 text-center text-xs text-[#5A6D65]">{t('loading')}</div>
        ) : logs.length === 0 ? (
          <div className="rounded-lg border border-[#DCE4E0] bg-white p-8 text-center text-xs text-[#5A6D65]">{t('noData')}</div>
        ) : (
          <>
            {viewMode === 'table' && (
              <div className="hidden md:block rounded-lg border border-[#DCE4E0] bg-white overflow-x-auto">
                <table className="w-full min-w-[920px] text-xs">
                  <thead>
                    <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                      <th className="px-3.5 py-3 text-start whitespace-nowrap">{t('date')}</th>
                      <th className="px-3.5 py-3 text-start whitespace-nowrap">{t('roleStudent')}</th>
                      <th className="px-3.5 py-3 text-start whitespace-nowrap">
                        {lang === 'ur' ? 'کتاب و باب' : 'Book & Chapter'}
                      </th>
                      <th className="px-3.5 py-3 text-start whitespace-nowrap">
                        {lang === 'ur' ? 'صفحہ (کہاں سے کہاں تک)' : 'Page Range (From — To)'}
                      </th>
                      <th className="px-3.5 py-3 text-start min-w-[260px]">{t('studyDetails')}</th>
                      <th className="px-3.5 py-3 text-start whitespace-nowrap">{t('status')}</th>
                      <th className="px-3.5 py-3 text-end whitespace-nowrap">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2F0]">
                    {logs.map((m) => (
                      <tr key={m.id} className="hover:bg-[#F6F8F7] align-top">
                        <td className="px-3.5 py-3.5 font-mono-code tabular-nums whitespace-nowrap text-[#4A5D55]">
                          {m.study_date}
                        </td>
                        <td className="px-3.5 py-3.5 whitespace-nowrap">
                          <div className="text-[#111C18]">{pick(m.student_name, m.student_name_ur)}</div>
                          <div className="font-mono-code text-[11px] text-[#065F46]">{m.student_code}</div>
                        </td>
                        <td className="px-3.5 py-3.5 min-w-[170px]">
                          <div className="text-[#064E3B]">{pick(m.book_title_en, m.book_title_ur)}</div>
                          <div className="text-[11px] text-[#5A6D65]">{m.chapter}</div>
                        </td>
                        <td className="px-3.5 py-3.5 whitespace-nowrap text-[#0B2545]">
                          <span>{m.start_position}</span>
                          <span className="mx-1.5 text-[#94A3B8]">—</span>
                          <span>{m.end_position}</span>
                        </td>
                        <td className="px-3.5 py-3.5 text-[#2A3B34] min-w-[260px] max-w-md whitespace-normal">
                          <div>{m.study_details}</div>
                          {m.review_comments && (
                            <div className="mt-1.5 text-[11px] text-[#065F46] bg-[#F6F8F7] rounded px-2.5 py-1 border border-[#E5ECE8]">
                              {m.reviewer_name}: {m.review_comments}
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-3.5 whitespace-nowrap">
                          <StatusText status={m.status} />
                        </td>
                        <td className="px-3.5 py-3.5 text-end whitespace-nowrap">
                          <div className="inline-flex items-center gap-2.5">
                            {canEditEntry(m) && (
                              <button
                                type="button"
                                onClick={() => openEditModal(m)}
                                title={t('edit')}
                                className="inline-flex items-center gap-1 text-[#0284C7] hover:underline"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                <span>{t('edit')}</span>
                              </button>
                            )}
                            {canReviewMutala && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewTarget(m);
                                    setReviewDecision('approved');
                                    setReviewComments(m.review_comments || '');
                                  }}
                                  title={t('approveMutala')}
                                  className="inline-flex items-center gap-1 text-[#065F46] hover:underline"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>{t('approveMutala')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewTarget(m);
                                    setReviewDecision('needs_correction');
                                    setReviewComments(m.review_comments || '');
                                  }}
                                  title={t('returnMutala')}
                                  className="inline-flex items-center gap-1 text-[#B45309] hover:underline"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className={`space-y-3 ${viewMode === 'table' ? 'md:hidden' : ''}`}>
              {logs.map((m) => (
              <div key={m.id} className="rounded-lg border border-[#DCE4E0] bg-white p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono-code text-xs font-semibold text-[#065F46]">{m.student_code}</span>
                      <span className="text-sm text-[#111C18]">{pick(m.student_name, m.student_name_ur)}</span>
                      <span className="text-[#CBD5D1]">·</span>
                      <span className="text-xs text-[#5A6D65] font-mono-code tabular-nums">{m.study_date}</span>
                    </div>
                    <div className="mt-1 text-xs text-[#2A3B34]">
                      {pick(m.book_title_en, m.book_title_ur)} — {m.chapter}
                      <span className="mx-2 text-[#CBD5D1]">·</span>
                      <span>{m.start_position} — {m.end_position}</span>
                    </div>
                  </div>
                  <StatusText status={m.status} />
                </div>

                <p className="text-xs text-[#2A3B34]">{m.study_details}</p>

                {m.student_comments && (
                  <div className="text-xs text-[#5A6D65]">
                    <span>{t('studentComments')}: </span>
                    <span>{m.student_comments}</span>
                  </div>
                )}

                {m.review_comments && (
                  <div className="rounded-md bg-[#F6F8F7] border border-[#E5ECE8] p-3 text-xs text-[#064E3B]">
                    <span>{m.reviewer_name}: </span>
                    <span>{m.review_comments}</span>
                  </div>
                )}

                {(canEditEntry(m) || canReviewMutala) && (
                  <div className="pt-2 border-t border-[#EEF2F0] flex items-center justify-end gap-2">
                    {canEditEntry(m) && (
                      <button
                        type="button"
                        onClick={() => openEditModal(m)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#DCE4E0] bg-white px-3 py-1.5 text-xs text-[#0284C7] hover:bg-[#F6F8F7]"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>{t('edit')}</span>
                      </button>
                    )}
                    {canReviewMutala && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setReviewTarget(m);
                            setReviewDecision('approved');
                            setReviewComments(m.review_comments || '');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md bg-[#065F46] px-3 py-1.5 text-xs text-white hover:bg-[#064E3B]"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>{t('approveMutala')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReviewTarget(m);
                            setReviewDecision('needs_correction');
                            setReviewComments(m.review_comments || '');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md border border-[#B45309]/40 bg-white px-3 py-1.5 text-xs text-[#B45309] hover:bg-amber-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>{t('returnMutala')}</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
            </div>
          </>
        )
      )}

      {/* TAB 2: BOOK & PAGE PROGRESS SUMMARY (WHERE EACH STUDENT REACHED IN EACH BOOK) */}
      {subTab === 'summary' && (
        <div className="rounded-lg border border-[#DCE4E0] bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('roleStudent')}</th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('book')}</th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('chapter')}</th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">
                  {lang === 'ur' ? 'آخری مطالعہ (کہاں سے کہاں تک)' : 'Latest Studied Range'}
                </th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('date')}</th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('status')}</th>
                <th className="px-4 py-3 text-end font-medium whitespace-nowrap">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F0]">
              {summaryRows.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-[#5A6D65]">{t('noData')}</td></tr>
              ) : (
                summaryRows.map((s) => (
                  <tr key={`${s.student_id}-${s.book_id}`} className="hover:bg-[#F6F8F7]">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-[#111C18]">{pick(s.student_name, s.student_name_ur)}</div>
                      <div className="font-mono-code text-[11px] text-[#065F46]">{s.student_code}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 text-[#064E3B]">
                        <BookOpen className="h-3.5 w-3.5 shrink-0" />
                        <span>{pick(s.book_title_en, s.book_title_ur)}</span>
                      </div>
                      <div className="text-[11px] text-[#5A6D65]">{pick(s.subject_name_en, s.subject_name_ur)}</div>
                    </td>
                    <td className="px-4 py-3 text-[#2A3B34]">{s.chapter}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-[#0B2545]">
                      {s.start_position} — {s.end_position}
                      <span className="ms-2 text-[11px] text-[#5A6D65] tabular-nums">({s.entries_count})</span>
                    </td>
                    <td className="px-4 py-3 font-mono-code tabular-nums whitespace-nowrap">{s.study_date}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><StatusText status={s.status} /></td>
                    <td className="px-4 py-3 text-end whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          openAddModal({
                            studentId: s.student_id,
                            bookId: s.book_id,
                            startFrom: s.end_position,
                            chapter: s.chapter,
                          })
                        }
                        className="text-xs text-[#065F46] hover:underline whitespace-nowrap"
                      >
                        {lang === 'ur' ? '+ آج کا مطالعہ اپ ڈیٹ کریں' : '+ Update Next Pages'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Mutala Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-lg border border-[#DCE4E0] bg-white p-4 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE8]">
              <h3 className="text-sm text-[#111C18]">
                {editingLog ? (lang === 'ur' ? 'روزانہ مطالعہ اپ ڈیٹ کریں' : 'Update Daily Mutala') : t('submitMutala')}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)}><X className="h-4 w-4 text-[#5A6D65]" /></button>
            </div>
            <form onSubmit={handleSubmitMutala} className="mt-4 space-y-3 text-xs">
              {user?.role !== 'student' && (
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('roleStudent')}</label>
                  <select
                    value={form.student_id}
                    disabled={Boolean(editingLog)}
                    onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white"
                  >
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>{s.student_code} — {pick(s.full_name, s.full_name_ur)}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('date')}</label>
                  <input type="date" required value={form.study_date} onChange={(e) => setForm({ ...form, study_date: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('book')}</label>
                  <select value={form.book_id} onChange={(e) => setForm({ ...form, book_id: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                    {books.map((b) => (
                      <option key={b.id} value={b.id}>{pick(b.title_en, b.title_ur)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {previousForSelection && (
                <div className="rounded-md border border-[#065F46]/25 bg-[#065F46]/5 px-3 py-2 flex items-center justify-between gap-2 text-xs text-[#064E3B]">
                  <span>
                    {lang === 'ur'
                      ? `آخری مطالعہ (${previousForSelection.study_date}): ${previousForSelection.start_position} تا ${previousForSelection.end_position}`
                      : `Previous (${previousForSelection.study_date}): ${previousForSelection.start_position} to ${previousForSelection.end_position}`}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        chapter: f.chapter || previousForSelection.chapter,
                        start_position: previousForSelection.end_position,
                      }))
                    }
                    className="text-[#065F46] underline whitespace-nowrap"
                  >
                    {lang === 'ur' ? 'یہیں سے آگے شروع کریں' : 'Continue from here'}
                  </button>
                </div>
              )}

              <div>
                <label className="block text-[#5A6D65] mb-1">{t('chapter')} *</label>
                <input
                  type="text"
                  required
                  placeholder={lang === 'ur' ? 'مثلاً: کتاب الطہارۃ / باب المیاہ' : 'e.g. Kitab al-Taharah / Bab al-Miyah'}
                  value={form.chapter}
                  onChange={(e) => setForm({ ...form, chapter: e.target.value })}
                  className="w-full rounded-md border border-[#DCE4E0] px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#5A6D65] mb-1">
                    {lang === 'ur' ? 'کہاں سے (صفحہ نمبر از) *' : 'From Page / Position *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={lang === 'ur' ? 'مثلاً: صفحہ ۱۲۰' : 'e.g. Page 120'}
                    value={form.start_position}
                    onChange={(e) => setForm({ ...form, start_position: e.target.value })}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">
                    {lang === 'ur' ? 'کہاں تک (صفحہ نمبر تا) *' : 'To Page / Position *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={lang === 'ur' ? 'مثلاً: صفحہ ۱۴۵' : 'e.g. Page 145'}
                    value={form.end_position}
                    onChange={(e) => setForm({ ...form, end_position: e.target.value })}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#5A6D65] mb-1">{t('studyDetails')} *</label>
                <textarea
                  required
                  rows={3}
                  placeholder={lang === 'ur' ? 'آج کے مطالعہ کا خلاصہ اور اہم فقہی نکات تحریر کریں...' : 'Summarize today’s Mutala and key Fiqh points...'}
                  value={form.study_details}
                  onChange={(e) => setForm({ ...form, study_details: e.target.value })}
                  className="w-full rounded-md border border-[#DCE4E0] px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('studentComments')}</label>
                <input type="text" value={form.student_comments} onChange={(e) => setForm({ ...form, student_comments: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-[#DCE4E0] px-4 py-2">{t('cancel')}</button>
                <button type="submit" className="rounded-md bg-[#065F46] px-4 py-2 text-white">{t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Teacher Review Modal */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-lg border border-[#DCE4E0] bg-white p-4 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE8]">
              <h3 className="text-sm text-[#111C18]">
                {reviewDecision === 'approved' ? t('approveMutala') : t('returnMutala')}
              </h3>
              <button type="button" onClick={() => setReviewTarget(null)}><X className="h-4 w-4 text-[#5A6D65]" /></button>
            </div>
            <form onSubmit={handleReviewSubmit} className="mt-4 space-y-3 text-xs">
              <div className="text-[#111C18]">
                {pick(reviewTarget.student_name, reviewTarget.student_name_ur)} · {pick(reviewTarget.book_title_en, reviewTarget.book_title_ur)}
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('teacherComments')}</label>
                <textarea
                  rows={3}
                  required={reviewDecision === 'needs_correction'}
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  placeholder={lang === 'ur' ? 'استاذ کا تبصرہ یا رہنمائی درج کریں...' : 'Enter feedback or approval remarks...'}
                  className="w-full rounded-md border border-[#DCE4E0] px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setReviewTarget(null)} className="rounded-md border border-[#DCE4E0] px-4 py-2">{t('cancel')}</button>
                <button
                  type="submit"
                  className={`rounded-md px-4 py-2 text-white ${reviewDecision === 'approved' ? 'bg-[#065F46]' : 'bg-[#B45309]'}`}
                >
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
