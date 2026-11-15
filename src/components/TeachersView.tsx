import React, { useEffect, useState } from 'react';
import { Plus, ArrowLeft, ArrowRight, X, Edit, Calendar, Clock, Trash2, Search, BookOpen, Layers, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { todayLocal } from '../lib/date';
import { formatPakistaniMobile, matchesPhoneSearch } from '../lib/phone';
import { ErrorState } from './ErrorState';
import { StatusText } from './StatusText';
import { ConfirmDialog } from './ConfirmDialog';

interface TeachersViewProps {
  initialTeacherId?: string;
}

export const TeachersView: React.FC<TeachersViewProps> = ({ initialTeacherId }) => {
  const { lang, t, pick } = useLanguage();
  const { user, canManageStudents } = useAuth();
  const [subTab, setSubTab] = useState<'directory' | 'schedule'>('directory');
  const [search, setSearch] = useState('');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [lookups, setLookups] = useState<any>({ classes: [], subjects: [], books: [], sessions: [] });

  const [schedClassFilter, setSchedClassFilter] = useState('');
  const [schedTeacherFilter, setSchedTeacherFilter] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(initialTeacherId || null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  // Teacher Profile Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  // Schedule Slot (Class & Subject/Book) Add / Edit Modal
  const [schedModalOpen, setSchedModalOpen] = useState(false);
  const [editingSchedId, setEditingSchedId] = useState<string | null>(null);

  // Quick Daily Lesson Modal
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [lessonForm, setLessonForm] = useState({
    teacher_id: '',
    lesson_date: todayLocal(),
    class_id: '',
    subject_id: '',
    book_id: '',
    start_position: '',
    end_position: '',
    homework: '',
    remarks: '',
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: '',
    full_name_ur: '',
    qualification: '',
    qualification_ur: '',
    specialization: '',
    phone: '',
    email: '',
    responsibilities: '',
    responsibilities_ur: '',
    assign_class_id: 'cls-tak1',
    assign_subject_id: 'sub-fiqh',
    assign_book_id: 'bk-radd',
    assign_session_id: 'ses-morning',
    assign_start_time: '08:30',
    assign_end_time: '09:30',
    assign_days: 'ہفتہ تا بدھ',
    assign_room: 'درسگاہ ۱',
  });

  const [schedForm, setSchedForm] = useState({
    teacher_id: 'tch-1',
    class_id: 'cls-tak1',
    subject_id: 'sub-fiqh',
    book_id: 'bk-radd',
    session_id: 'ses-morning',
    start_time: '08:30',
    end_time: '09:30',
    days_of_week: 'ہفتہ تا بدھ',
    room_name: 'درسگاہ ۱',
  });

  useEffect(() => {
    if (initialTeacherId) setSelectedId(initialTeacherId);
  }, [initialTeacherId]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (schedClassFilter) sp.set('classId', schedClassFilter);
      if (schedTeacherFilter) sp.set('teacherId', schedTeacherFilter);

      const [tRes, lkp, scRes] = await Promise.all([
        apiFetch('/api/teachers', {}, user),
        apiFetch('/api/lookups', {}, user),
        apiFetch(`/api/schedule${sp.toString() ? `?${sp.toString()}` : ''}`, {}, user),
      ]);
      const safeTeachers = Array.isArray(tRes) ? tRes : Array.isArray(tRes?.teachers) ? tRes.teachers : [];
      setTeachers(safeTeachers);
      setLookups({
        classes: Array.isArray(lkp?.classes) ? lkp.classes : [],
        subjects: Array.isArray(lkp?.subjects) ? lkp.subjects : [],
        books: Array.isArray(lkp?.books) ? lkp.books : [],
        sessions: Array.isArray(lkp?.sessions) ? lkp.sessions : [],
        ...(lkp || {}),
      });
      setSchedule(Array.isArray(scRes) ? scRes : []);
      if (safeTeachers?.[0]?.id && !schedForm.teacher_id) {
        setSchedForm((sf) => ({ ...sf, teacher_id: safeTeachers[0].id }));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load teachers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.role, schedClassFilter, schedTeacherFilter]);

  useEffect(() => {
    if (!selectedId) {
      setProfile(null);
      return;
    }
    apiFetch(`/api/teachers/${selectedId}`, {}, user)
      .then((res) => {
        if (!res) return;
        const teacherObj = res.teacher || (res.id ? res : null);
        setProfile({
          teacher: teacherObj,
          assignments: Array.isArray(res.assignments) ? res.assignments : [],
          supervisedStudents: Array.isArray(res.supervisedStudents) ? res.supervisedStudents : [],
          lessons: Array.isArray(res.lessons) ? res.lessons : [],
          studyReviews: Array.isArray(res.studyReviews) ? res.studyReviews : [],
          researchSupervisions: Array.isArray(res.researchSupervisions) ? res.researchSupervisions : [],
          performance: res.performance || {
            supervisedStudentCount: (res.supervisedStudents || []).length,
            totalLessons: (res.lessons || []).length,
            totalStudyReviews: (res.studyReviews || []).length,
            researchCount: (res.researchSupervisions || []).length,
          },
        });
      })
      .catch((err) => console.error('Failed to load teacher profile', err));
  }, [selectedId]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      full_name: '',
      full_name_ur: '',
      qualification: '',
      qualification_ur: '',
      specialization: '',
      phone: '',
      email: '',
      responsibilities: '',
      responsibilities_ur: '',
      assign_class_id: lookups.classes?.[0]?.id || 'cls-tak1',
      assign_subject_id: lookups.subjects?.[0]?.id || 'sub-fiqh',
      assign_book_id: lookups.books?.[0]?.id || 'bk-radd',
      assign_session_id: 'ses-morning',
      assign_start_time: '08:30',
      assign_end_time: '09:30',
      assign_days: 'ہفتہ تا بدھ',
      assign_room: 'درسگاہ ۱',
    });
    setModalOpen(true);
  };

  const openEdit = (tc: any) => {
    setEditing(tc);
    const firstA = tc.assignments?.[0];
    setForm({
      full_name: tc.full_name || '',
      full_name_ur: tc.full_name_ur || '',
      qualification: tc.qualification || '',
      qualification_ur: tc.qualification_ur || '',
      specialization: tc.specialization || '',
      phone: tc.phone || '',
      email: tc.email || '',
      responsibilities: tc.responsibilities || '',
      responsibilities_ur: tc.responsibilities_ur || '',
      assign_class_id: firstA?.class_id || lookups.classes?.[0]?.id || 'cls-tak1',
      assign_subject_id: firstA?.subject_id || lookups.subjects?.[0]?.id || 'sub-fiqh',
      assign_book_id: firstA?.book_id || lookups.books?.[0]?.id || 'bk-radd',
      assign_session_id: firstA?.session_id || 'ses-morning',
      assign_start_time: firstA?.start_time || '08:30',
      assign_end_time: firstA?.end_time || '09:30',
      assign_days: firstA?.days_of_week || 'ہفتہ تا بدھ',
      assign_room: firstA?.room_name || 'درسگاہ ۱',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      phone: formatPakistaniMobile(form.phone),
      assignments: [
        {
          class_id: form.assign_class_id,
          subject_id: form.assign_subject_id,
          book_id: form.assign_book_id,
          session_id: form.assign_session_id,
          start_time: form.assign_start_time,
          end_time: form.assign_end_time,
          days_of_week: form.assign_days,
          room_name: form.assign_room,
          is_class_supervisor: true,
        },
      ],
    };
    if (editing) {
      await apiFetch(`/api/teachers/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) }, user);
      setBanner(lang === 'ur' ? 'استاذ کے کوائف کامیابی سے اپ ڈیٹ ہو گئے۔' : 'Teacher details updated successfully.');
    } else {
      await apiFetch('/api/teachers', { method: 'POST', body: JSON.stringify(payload) }, user);
      setBanner(lang === 'ur' ? 'نیا استاذ کامیابی سے شامل ہو گیا۔' : 'New teacher added successfully.');
    }
    setModalOpen(false);
    await load();
    if (selectedId) {
      apiFetch(`/api/teachers/${selectedId}`, {}, user).then(setProfile);
    }
    setTimeout(() => setBanner(null), 4000);
  };

  // Schedule Open Add & Edit
  const openAddSchedule = (prefillTeacherId?: string) => {
    setEditingSchedId(null);
    setSchedForm({
      teacher_id: prefillTeacherId || teachers[0]?.id || 'tch-1',
      class_id: lookups.classes?.[0]?.id || 'cls-tak1',
      subject_id: lookups.subjects?.[0]?.id || 'sub-fiqh',
      book_id: lookups.books?.[0]?.id || 'bk-radd',
      session_id: 'ses-morning',
      start_time: '08:30',
      end_time: '09:30',
      days_of_week: 'ہفتہ تا بدھ',
      room_name: 'درسگاہ ۱',
    });
    setSchedModalOpen(true);
  };

  const openEditSchedule = (slot: any) => {
    setEditingSchedId(slot.id);
    setSchedForm({
      teacher_id: slot.teacher_id,
      class_id: slot.class_id,
      subject_id: slot.subject_id,
      book_id: slot.book_id || '',
      session_id: slot.session_id || 'ses-morning',
      start_time: slot.start_time || '08:30',
      end_time: slot.end_time || '09:30',
      days_of_week: slot.days_of_week || 'ہفتہ تا بدھ',
      room_name: slot.room_name || 'درسگاہ ۱',
    });
    setSchedModalOpen(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSchedId) {
        await apiFetch(`/api/schedule/${editingSchedId}`, { method: 'PUT', body: JSON.stringify(schedForm) }, user);
        setBanner(lang === 'ur' ? 'کلاس و کتاب شیڈول کامیابی سے اپ ڈیٹ ہو گیا۔' : 'Schedule slot updated successfully.');
      } else {
        await apiFetch('/api/schedule', { method: 'POST', body: JSON.stringify(schedForm) }, user);
        setBanner(lang === 'ur' ? 'نیا کلاس و کتاب شیڈول کامیابی سے شامل ہو گیا۔' : 'New schedule slot added successfully.');
      }
      setSchedModalOpen(false);
      setEditingSchedId(null);
      await load();
      if (selectedId) {
        apiFetch(`/api/teachers/${selectedId}`, {}, user).then(setProfile);
      }
      setTimeout(() => setBanner(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Error saving schedule');
    }
  };

  const handleDeleteSchedule = async () => {
    if (!confirmDeleteId) return;
    try {
      await apiFetch(`/api/schedule/${confirmDeleteId}`, { method: 'DELETE' }, user);
      setConfirmDeleteId(null);
      setBanner(lang === 'ur' ? 'کلاس شیڈول کامیابی سے حذف ہو گیا۔' : 'Schedule slot deleted.');
      await load();
      if (selectedId) {
        apiFetch(`/api/teachers/${selectedId}`, {}, user).then(setProfile);
      }
      setTimeout(() => setBanner(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Error deleting schedule');
    }
  };

  const openQuickLesson = (slot: {
    teacher_id: string;
    class_id: string;
    subject_id: string;
    book_id: string;
    latest_end_position?: string;
  }) => {
    setLessonForm({
      teacher_id: slot.teacher_id,
      lesson_date: todayLocal(),
      class_id: slot.class_id || lookups.classes?.[0]?.id || 'cls-tak1',
      subject_id: slot.subject_id || lookups.subjects?.[0]?.id || 'sub-fiqh',
      book_id: slot.book_id || lookups.books?.[0]?.id || 'bk-radd',
      start_position: slot.latest_end_position || '',
      end_position: '',
      homework: '',
      remarks: '',
    });
    setLessonModalOpen(true);
  };

  const handleSaveQuickLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/lessons', { method: 'POST', body: JSON.stringify(lessonForm) }, user);
      setLessonModalOpen(false);
      setBanner(lang === 'ur' ? 'آج کا پڑھایا گیا سبق محفوظ ہو گیا۔' : 'Lesson saved successfully.');
      await load();
      if (selectedId) {
        apiFetch(`/api/teachers/${selectedId}`, {}, user).then(setProfile);
      }
      setTimeout(() => setBanner(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Error saving lesson');
    }
  };

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  // TEACHER PROFILE VIEW
  if (selectedId && profile) {
    const tc = profile.teacher || {};
    const performance = profile.performance || {
      supervisedStudentCount: (profile.supervisedStudents || []).length,
      totalLessons: (profile.lessons || []).length,
      totalStudyReviews: (profile.studyReviews || []).length,
    };
    const assignments: any[] = Array.isArray(profile.assignments) ? profile.assignments : [];
    const supervisedStudents: any[] = Array.isArray(profile.supervisedStudents) ? profile.supervisedStudents : [];
    const lessons: any[] = Array.isArray(profile.lessons) ? profile.lessons : [];
    const studyReviews: any[] = Array.isArray(profile.studyReviews) ? profile.studyReviews : [];

    return (
      <div className="space-y-5">
        {banner && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{banner}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="inline-flex items-center gap-2 text-sm text-[#065F46] hover:underline font-semibold"
          >
            {lang === 'ur' ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
            <span>{lang === 'ur' ? '← واپس فہرستِ اساتذہ' : '← Back to Teachers Directory'}</span>
          </button>
          {canManageStudents && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openAddSchedule(tc.id)}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#065F46] px-3.5 py-2 text-xs text-white hover:bg-[#064E3B] shadow-sm font-medium"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{lang === 'ur' ? '📅 نیا کلاس و کتاب شیڈول بنائیں' : 'Schedule Class / Assign Book'}</span>
              </button>
              <button
                type="button"
                onClick={() => openEdit(tc)}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#DCE4E0] bg-white px-3.5 py-2 text-xs text-[#065F46] hover:bg-[#F6F8F7]"
              >
                <Edit className="h-3.5 w-3.5 text-[#065F46]" />
                <span>{t('edit')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Teacher Header Card */}
        <div className="rounded-xl border border-[#DCE4E0] bg-white p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono-code text-xs font-bold text-[#065F46] px-2.5 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                {tc.teacher_code}
              </span>
              <span className="text-[#CBD5D1]">·</span>
              <StatusText status={tc.status} />
            </div>
            <h2 className="mt-1.5 text-xl font-bold text-[#111C18]">{pick(tc.full_name, tc.full_name_ur)}</h2>
            <div className="text-xs text-[#5A6D65] mt-0.5">{pick(tc.qualification, tc.qualification_ur)}</div>
            <div className="text-xs text-[#2A3B34] mt-1">{pick(tc.responsibilities, tc.responsibilities_ur)}</div>
            {tc.phone && (
              <div className="mt-1 font-mono-code text-xs text-[#065F46]" dir="ltr">
                {formatPakistaniMobile(tc.phone)}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-5 text-xs tabular-nums border-t sm:border-t-0 pt-3 sm:pt-0 border-[#E5ECE8]">
            <div className="rounded-lg bg-[#F6F8F7] p-3 text-center border border-[#E5ECE8]">
              <div className="text-[#5A6D65] text-[11px]">{t('supervisedStudents')}</div>
              <div className="text-xl font-bold text-[#065F46] font-mono-code mt-0.5">{performance.supervisedStudentCount}</div>
            </div>
            <div className="rounded-lg bg-[#F6F8F7] p-3 text-center border border-[#E5ECE8]">
              <div className="text-[#5A6D65] text-[11px]">{t('teacherLessons')}</div>
              <div className="text-xl font-bold text-[#111C18] font-mono-code mt-0.5">{performance.totalLessons}</div>
            </div>
            <div className="rounded-lg bg-[#F6F8F7] p-3 text-center border border-[#E5ECE8]">
              <div className="text-[#5A6D65] text-[11px]">{t('teacherReviews')}</div>
              <div className="text-xl font-bold text-[#111C18] font-mono-code mt-0.5">{performance.totalStudyReviews}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assigned Books, Classes & Schedule with Direct Edit/Delete */}
          <div className="rounded-xl border border-[#DCE4E0] bg-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-[#EEF2F0]">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[#065F46]" />
                <h3 className="text-sm font-bold text-[#111C18]">
                  {lang === 'ur' ? 'متعلقہ تدریسی کتب، کلاس اور شیڈول' : 'Assigned Classes, Books & Schedule'}
                </h3>
              </div>
              {canManageStudents && (
                <button
                  type="button"
                  onClick={() => openAddSchedule(tc.id)}
                  className="inline-flex items-center gap-1 rounded bg-[#065F46] px-2.5 py-1 text-xs text-white hover:bg-[#064E3B]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{lang === 'ur' ? 'کتاب تفویض / شیڈول' : 'Assign / Schedule'}</span>
                </button>
              )}
            </div>

            <div className="divide-y divide-[#EEF2F0] text-xs">
              {assignments.length === 0 ? (
                <div className="py-8 text-center text-[#5A6D65]">
                  <p>{lang === 'ur' ? 'فی الحال کوئی کلاس یا کتاب تفویض نہیں ہے۔' : 'No books or classes assigned yet.'}</p>
                  {canManageStudents && (
                    <button
                      type="button"
                      onClick={() => openAddSchedule(tc.id)}
                      className="mt-2 text-xs text-[#065F46] underline font-semibold"
                    >
                      {lang === 'ur' ? '+ پہلی کتاب یا کلاس شیڈول کریں' : '+ Assign first class & book'}
                    </button>
                  )}
                </div>
              ) : (
                assignments.map((a: any) => (
                  <div key={a.id} className="py-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-[#111C18] flex items-center gap-2">
                        <span className="text-[#065F46]">📚</span>
                        <span>{pick(a.book_title_en, a.book_title_ur) || pick(a.subject_name_en, a.subject_name_ur)}</span>
                        <span className="text-[11px] font-normal text-[#5A6D65]">
                          ({pick(a.subject_name_en, a.subject_name_ur)})
                        </span>
                      </div>
                      <div className="text-[#5A6D65] flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 text-[11px]">
                          {pick(a.class_name_en, a.class_name_ur)}
                        </span>
                        {a.days_of_week && (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[11px]">
                            {a.days_of_week}
                          </span>
                        )}
                        {a.room_name && (
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[11px]">
                            {a.room_name}
                          </span>
                        )}
                      </div>
                      <div className="text-[#065F46] text-xs pt-1">
                        <span className="text-[#5A6D65]">{lang === 'ur' ? 'آخری پڑھایا گیا سبق: ' : 'Taught: '}</span>
                        {a.latest_end_position ? (
                          <span className="font-medium">
                            {a.latest_start_position} — {a.latest_end_position}{' '}
                            <span className="font-mono-code text-[11px] text-[#5A6D65]">({a.latest_lesson_date})</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">{lang === 'ur' ? 'تاحال درج نہیں' : 'Not recorded yet'}</span>
                        )}
                      </div>
                    </div>

                    <div className="text-end shrink-0 space-y-1.5">
                      <div className="text-xs font-semibold text-[#065F46]">
                        {pick(a.session_name_en, a.session_name_ur) || '—'}
                      </div>
                      {a.start_time && (
                        <div className="font-mono-code tabular-nums text-xs text-[#5A6D65]">
                          {a.start_time} – {a.end_time}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 justify-end pt-1">
                        {canManageStudents && (
                          <button
                            type="button"
                            onClick={() => openEditSchedule(a)}
                            title={lang === 'ur' ? 'کتاب، وقت یا شیڈول میں ترمیم' : 'Edit assignment & schedule'}
                            className="inline-flex items-center gap-1 rounded bg-[#F0FDF4] border border-[#BBF7D0] px-2 py-1 text-[11px] text-[#065F46] hover:bg-[#DCFCE7]"
                          >
                            <Edit className="h-3 w-3" />
                            <span>{lang === 'ur' ? 'ترمیم' : 'Edit'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openQuickLesson(a)}
                          className="inline-flex items-center gap-1 rounded bg-sky-50 border border-sky-200 px-2 py-1 text-[11px] text-[#0284C7] hover:bg-sky-100 font-medium"
                        >
                          <Plus className="h-3 w-3" />
                          <span>{lang === 'ur' ? 'آج کا سبق' : 'Today Lesson'}</span>
                        </button>
                        {canManageStudents && (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(a.id)}
                            title={t('delete')}
                            className="p-1 rounded bg-rose-50 border border-rose-200 text-[#B91C1C] hover:bg-rose-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Supervised Students */}
          <div className="rounded-xl border border-[#DCE4E0] bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-[#111C18] pb-3 border-b border-[#EEF2F0]">
              {t('supervisedStudents')} ({supervisedStudents.length})
            </h3>
            <div className="divide-y divide-[#EEF2F0] text-xs max-h-[350px] overflow-y-auto">
              {supervisedStudents.length === 0 ? (
                <p className="py-6 text-center text-[#5A6D65]">{t('noData')}</p>
              ) : (
                supervisedStudents.map((st: any) => (
                  <div key={st.id} className="py-2.5 flex items-center justify-between">
                    <span className="font-medium text-[#111C18]">{pick(st.full_name, st.full_name_ur)}</span>
                    <span className="font-mono-code font-bold text-[#065F46]">{st.student_code}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Lesson History */}
          <div className="rounded-xl border border-[#DCE4E0] bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-[#111C18] pb-3 border-b border-[#EEF2F0]">
              {t('teacherLessons')} ({lessons.length})
            </h3>
            <div className="divide-y divide-[#EEF2F0] text-xs max-h-[350px] overflow-y-auto">
              {lessons.length === 0 ? (
                <p className="py-6 text-center text-[#5A6D65]">{t('noData')}</p>
              ) : (
                lessons.map((l: any) => (
                  <div key={l.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[#111C18]">{pick(l.book_title_en, l.book_title_ur)}</div>
                      <div className="text-[#5A6D65]">{l.start_position} — {l.end_position}</div>
                    </div>
                    <span className="font-mono-code text-[#5A6D65] tabular-nums text-xs">{l.lesson_date}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Study Reviews */}
          <div className="rounded-xl border border-[#DCE4E0] bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-[#111C18] pb-3 border-b border-[#EEF2F0]">
              {t('teacherReviews')} ({studyReviews.length})
            </h3>
            <div className="divide-y divide-[#EEF2F0] text-xs max-h-[350px] overflow-y-auto">
              {studyReviews.length === 0 ? (
                <p className="py-6 text-center text-[#5A6D65]">{t('noData')}</p>
              ) : (
                studyReviews.map((sr: any) => (
                  <div key={sr.id} className="py-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#111C18]">{pick(sr.student_name, sr.student_name_ur)}</span>
                      <StatusText status={sr.decision} />
                    </div>
                    <div className="text-[#5A6D65]">{sr.comments}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // DIRECTORY & SCHEDULE TABS
  return (
    <div className="space-y-5">
      {banner && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{banner}</span>
        </div>
      )}

      {/* Top Bar: Sub-tabs + Filter + Actions */}
      <div className="rounded-xl border border-[#DCE4E0] bg-white p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#F6F8F7] border border-[#DCE4E0]">
            <button
              type="button"
              onClick={() => setSubTab('directory')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
                subTab === 'directory' ? 'bg-white text-[#065F46] shadow-sm' : 'text-[#5A6D65] hover:text-[#111C18]'
              }`}
            >
              {t('navTeachers')}
            </button>
            <button
              type="button"
              onClick={() => setSubTab('schedule')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
                subTab === 'schedule' ? 'bg-white text-[#065F46] shadow-sm' : 'text-[#5A6D65] hover:text-[#111C18]'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>{lang === 'ur' ? 'کلاس و کتاب شیڈول (ٹائم ٹیبل)' : 'Class & Book Schedule'}</span>
            </button>
          </div>

          {subTab === 'schedule' && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={schedClassFilter}
                onChange={(e) => setSchedClassFilter(e.target.value)}
                className="rounded-md border border-[#DCE4E0] px-3 py-1.5 text-xs bg-white text-[#0F1F38]"
              >
                <option value="">{t('allClasses')}</option>
                {lookups.classes.map((c: any) => (
                  <option key={c.id} value={c.id}>{pick(c.name_en, c.name_ur)}</option>
                ))}
              </select>
              <select
                value={schedTeacherFilter}
                onChange={(e) => setSchedTeacherFilter(e.target.value)}
                className="rounded-md border border-[#DCE4E0] px-3 py-1.5 text-xs bg-white text-[#0F1F38]"
              >
                <option value="">{lang === 'ur' ? 'تمام اساتذہ' : 'All Teachers'}</option>
                {teachers.map((tc: any) => (
                  <option key={tc.id} value={tc.id}>{pick(tc.full_name, tc.full_name_ur)}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {canManageStudents && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openAddSchedule()}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0284C7] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0369A1] shadow-sm whitespace-nowrap"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>{lang === 'ur' ? 'کلاس شیڈول کریں / کتاب تفویض' : 'Schedule Class / Assign Book'}</span>
            </button>
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#065F46] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#064E3B] shadow-sm whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t('addTeacher')}</span>
            </button>
          </div>
        )}
      </div>

      {/* DIRECTORY TAB */}
      {subTab === 'directory' && (() => {
        const filteredTeachers = teachers.filter((tc: any) => {
          if (!search.trim()) return true;
          const q = search.trim().toLowerCase();
          return (
            (tc.full_name || '').toLowerCase().includes(q) ||
            (tc.full_name_ur || '').includes(q) ||
            (tc.teacher_code || '').toLowerCase().includes(q) ||
            (tc.qualification || '').toLowerCase().includes(q) ||
            (tc.qualification_ur || '').includes(q) ||
            (tc.specialization || '').toLowerCase().includes(q) ||
            matchesPhoneSearch(tc.phone, q)
          );
        });

        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#DCE4E0] bg-white p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="relative w-full sm:max-w-md">
                <Search className={`h-4 w-4 text-[#64746D] absolute top-1/2 -translate-y-1/2 ${lang === 'ur' ? 'right-3' : 'left-3'}`} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={lang === 'ur' ? 'نام، تخصص یا موبائل نمبر (03001234567) سے تلاش کریں...' : 'Search teacher by name or mobile...'}
                  className={`w-full rounded-md border border-[#DCE4E0] py-2 text-xs ${lang === 'ur' ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                />
              </div>
              <div className="text-xs text-[#5A6D65] font-semibold">
                {lang === 'ur' ? `کل اساتذہ: ${filteredTeachers.length}` : `Total Teachers: ${filteredTeachers.length}`}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {loading ? (
                <div className="col-span-2 p-8 text-center text-xs text-[#5A6D65]">{t('loading')}</div>
              ) : filteredTeachers.length === 0 ? (
                <div className="col-span-2 p-8 text-center text-xs text-[#5A6D65] bg-white rounded-lg border border-[#DCE4E0]">
                  {t('noData')}
                </div>
              ) : (
                filteredTeachers.map((tc) => (
                  <div
                    key={tc.id}
                    className="rounded-xl border border-[#DCE4E0] bg-white p-5 hover:border-[#065F46]/60 transition-all shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-code text-xs font-bold text-[#065F46] px-2.5 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                          {tc.teacher_code}
                        </span>
                        <StatusText status={tc.status} />
                      </div>
                      {canManageStudents && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(tc);
                          }}
                          className="inline-flex items-center gap-1 rounded border border-[#DCE4E0] bg-white px-2 py-1 text-[11px] text-[#5A6D65] hover:text-[#065F46] hover:bg-[#F6F8F7]"
                        >
                          <Edit className="h-3 w-3" />
                          <span>{t('edit')}</span>
                        </button>
                      )}
                    </div>

                    <div>
                      <h3
                        onClick={() => setSelectedId(tc.id)}
                        className="text-base font-bold text-[#111C18] hover:text-[#065F46] cursor-pointer"
                      >
                        {pick(tc.full_name, tc.full_name_ur)}
                      </h3>
                      <div className="text-xs text-[#5A6D65] mt-0.5">{pick(tc.qualification, tc.qualification_ur)}</div>
                      <div className="text-xs text-[#2A3B34] mt-0.5">{pick(tc.responsibilities, tc.responsibilities_ur)}</div>
                    </div>

                    {/* Assigned Books & Schedule inside Teacher Card with Direct Edit button */}
                    {tc.assignments && tc.assignments.length > 0 && (
                      <div className="pt-2 border-t border-[#EEF2F0] space-y-2">
                        <div className="text-[11px] font-semibold text-[#5A6D65] flex items-center justify-between">
                          <span>{lang === 'ur' ? 'تفویض شدہ کتب و شیڈول:' : 'Assigned Books & Schedule:'}</span>
                        </div>
                        {tc.assignments.slice(0, 3).map((a: any) => (
                          <div key={a.id} className="rounded-lg bg-[#F6F8F7] border border-[#E5ECE8] p-2.5 text-xs space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-[#111C18] truncate">
                                {pick(a.class_name_en, a.class_name_ur)} · {pick(a.book_title_en, a.book_title_ur) || pick(a.subject_name_en, a.subject_name_ur)}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="font-mono-code text-[11px] text-[#065F46] tabular-nums">
                                  {a.start_time ? `${a.start_time}–${a.end_time}` : ''}
                                </span>
                                {canManageStudents && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditSchedule(a);
                                    }}
                                    title={lang === 'ur' ? 'کتاب / شیڈول میں ترمیم' : 'Edit assignment & schedule'}
                                    className="p-1 rounded text-[#065F46] hover:bg-white border border-transparent hover:border-[#DCE4E0]"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="text-[11px] text-[#065F46]">
                              <span className="text-[#5A6D65]">{lang === 'ur' ? 'آخری سبق: ' : 'Latest lesson: '}</span>
                              {a.latest_end_position ? (
                                <span>
                                  {a.latest_start_position} — {a.latest_end_position}
                                  {a.latest_lesson_date && (
                                    <span className="ms-1.5 font-mono-code text-[#5A6D65]">({a.latest_lesson_date})</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-400">{lang === 'ur' ? 'تاحال کوئی سبق درج نہیں' : 'No lesson recorded yet'}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Direct Action Buttons on Card */}
                    <div className="pt-2 border-t border-[#EEF2F0] flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-mono-code text-[#5A6D65]" dir="ltr">
                        {formatPakistaniMobile(tc.phone)}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {canManageStudents && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAddSchedule(tc.id);
                              }}
                              className="inline-flex items-center gap-1 rounded bg-[#065F46]/10 border border-[#065F46]/30 px-2.5 py-1 text-[11px] font-medium text-[#065F46] hover:bg-[#065F46]/20 transition-colors"
                            >
                              <Calendar className="h-3 w-3" />
                              <span>{lang === 'ur' ? 'کلاس شیڈول کریں' : 'Schedule'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAddSchedule(tc.id);
                              }}
                              className="inline-flex items-center gap-1 rounded bg-sky-50 border border-sky-200 px-2.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100 transition-colors"
                            >
                              <BookOpen className="h-3 w-3" />
                              <span>{lang === 'ur' ? 'کتاب تفویض کریں' : 'Assign Book'}</span>
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedId(tc.id)}
                          className="text-[11px] text-[#065F46] hover:underline font-semibold"
                        >
                          {lang === 'ur' ? 'مکمل پروفائل ←' : 'View Profile →'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })()}

      {/* CLASS & SUBJECT SCHEDULE TAB */}
      {subTab === 'schedule' && (
        <div className="space-y-4">
          {/* Mobile Card View (shown on small screens) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {schedule.length === 0 ? (
              <div className="rounded-xl border border-[#DCE4E0] bg-white p-8 text-center text-xs text-[#5A6D65]">
                {t('noData')}
              </div>
            ) : (
              schedule.map((sc) => (
                <div key={sc.id} className="rounded-xl border border-[#DCE4E0] bg-white p-4 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-[#065F46] px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                      {pick(sc.session_name_en, sc.session_name_ur) || 'سیشن'}
                    </span>
                    <div className="inline-flex items-center gap-1 font-mono-code text-xs text-[#5A6D65] tabular-nums">
                      <Clock className="h-3 w-3" />
                      <span>{sc.start_time || '--:--'} – {sc.end_time || '--:--'}</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-bold text-[#111C18]">
                      {pick(sc.teacher_name, sc.teacher_name_ur)}
                      <span className="ms-2 font-mono-code text-[11px] text-[#065F46] font-normal">
                        ({sc.teacher_code})
                      </span>
                    </div>
                    <div className="text-xs text-[#0B2545] font-medium mt-1">
                      📚 {pick(sc.book_title_en, sc.book_title_ur) || pick(sc.subject_name_en, sc.subject_name_ur)}
                    </div>
                    <div className="text-[11px] text-[#5A6D65] flex items-center gap-2 mt-1">
                      <span>{pick(sc.class_name_en, sc.class_name_ur)}</span>
                      <span>·</span>
                      <span>{sc.days_of_week || 'ایام'}</span>
                      {sc.room_name && (
                        <>
                          <span>·</span>
                          <span>{sc.room_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-[#065F46] pt-1 border-t border-[#EEF2F0]">
                    <span className="text-[#5A6D65]">{lang === 'ur' ? 'آخری سبق: ' : 'Latest lesson: '}</span>
                    {sc.latest_end_position ? (
                      <span>
                        {sc.latest_start_position} — {sc.latest_end_position}{' '}
                        <span className="font-mono-code text-[11px] text-[#5A6D65]">({sc.latest_lesson_date})</span>
                      </span>
                    ) : (
                      <span className="text-gray-400">{lang === 'ur' ? 'تاحال کوئی سبق درج نہیں' : 'No lesson recorded yet'}</span>
                    )}
                  </div>

                  {canManageStudents && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EEF2F0]">
                      <button
                        type="button"
                        onClick={() => openEditSchedule(sc)}
                        className="inline-flex items-center gap-1 rounded bg-[#F0FDF4] border border-[#BBF7D0] px-2.5 py-1 text-xs text-[#065F46] hover:bg-[#DCFCE7]"
                      >
                        <Edit className="h-3 w-3" />
                        <span>{lang === 'ur' ? 'ترمیم' : 'Edit'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openQuickLesson(sc)}
                        className="inline-flex items-center gap-1 rounded bg-sky-50 border border-sky-200 px-2.5 py-1 text-xs text-[#0284C7] hover:bg-sky-100 font-medium"
                      >
                        <Plus className="h-3 w-3" />
                        <span>{lang === 'ur' ? '+ سبق' : '+ Lesson'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(sc.id)}
                        className="p-1 rounded bg-rose-50 border border-rose-200 text-[#B91C1C] hover:bg-rose-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block rounded-xl border border-[#DCE4E0] bg-white overflow-x-auto shadow-xs">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                  <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{lang === 'ur' ? 'نشست و وقت' : 'Session & Time'}</th>
                  <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('teacherLabel')}</th>
                  <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('classLabel')}</th>
                  <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('subjectLabel')}</th>
                  <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('book')}</th>
                  <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{lang === 'ur' ? 'ایام و درسگاہ' : 'Days & Room'}</th>
                  <th className="px-4 py-3 text-start font-medium whitespace-nowrap">
                    {lang === 'ur' ? 'آخری پڑھایا گیا سبق (کہاں سے کہاں تک)' : 'Latest Taught Lesson'}
                  </th>
                  {canManageStudents && <th className="px-4 py-3 text-end font-medium whitespace-nowrap">{t('actions')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F0]">
                {schedule.length === 0 ? (
                  <tr><td colSpan={canManageStudents ? 8 : 7} className="py-10 text-center text-[#5A6D65]">{t('noData')}</td></tr>
                ) : (
                  schedule.map((sc) => (
                    <tr key={sc.id} className="hover:bg-[#F6F8F7]">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-[#065F46] font-semibold">{pick(sc.session_name_en, sc.session_name_ur) || '—'}</div>
                        <div className="inline-flex items-center gap-1 font-mono-code text-[11px] text-[#5A6D65] tabular-nums">
                          <Clock className="h-3 w-3" />
                          <span>{sc.start_time || '--:--'} – {sc.end_time || '--:--'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedId(sc.teacher_id)}
                          className="text-[#111C18] font-bold hover:text-[#065F46] hover:underline"
                        >
                          {pick(sc.teacher_name, sc.teacher_name_ur)}
                        </button>
                        <div className="font-mono-code text-[11px] text-[#5A6D65]">{sc.teacher_code}</div>
                      </td>
                      <td className="px-4 py-3 text-[#2A3B34] whitespace-nowrap">{pick(sc.class_name_en, sc.class_name_ur)}</td>
                      <td className="px-4 py-3 text-[#0B2545] font-medium whitespace-nowrap">{pick(sc.subject_name_en, sc.subject_name_ur)}</td>
                      <td className="px-4 py-3 text-[#064E3B] font-semibold whitespace-nowrap">{pick(sc.book_title_en, sc.book_title_ur) || '—'}</td>
                      <td className="px-4 py-3 text-[#5A6D65] whitespace-nowrap">
                        <div>{sc.days_of_week || '—'}</div>
                        <div className="text-[11px] text-gray-500">{sc.room_name || ''}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {sc.latest_end_position ? (
                          <div>
                            <div className="text-[#065F46] font-medium">
                              {sc.latest_start_position} — {sc.latest_end_position}
                            </div>
                            <div className="font-mono-code text-[11px] text-[#5A6D65] tabular-nums">{sc.latest_lesson_date}</div>
                          </div>
                        ) : (
                          <span className="text-[#94A3B8]">{lang === 'ur' ? 'تاحال کوئی سبق درج نہیں' : 'No lesson recorded yet'}</span>
                        )}
                      </td>
                      {canManageStudents && (
                        <td className="px-4 py-3 text-end whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditSchedule(sc)}
                              title={lang === 'ur' ? 'کلاس و کتاب شیڈول میں ترمیم' : 'Edit schedule slot'}
                              className="inline-flex items-center gap-1 rounded bg-[#F0FDF4] border border-[#BBF7D0] px-2.5 py-1 text-[11px] text-[#065F46] hover:bg-[#DCFCE7]"
                            >
                              <Edit className="h-3 w-3" />
                              <span>{lang === 'ur' ? 'ترمیم' : 'Edit'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openQuickLesson(sc)}
                              className="text-[#0284C7] hover:underline whitespace-nowrap text-[11px] font-medium"
                            >
                              {lang === 'ur' ? '+ سبق اپ ڈیٹ' : '+ Update'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(sc.id)}
                              title={t('delete')}
                              className="text-[#B91C1C] hover:underline inline-flex items-center gap-1"
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
        </div>
      )}

      {/* Add/Edit Teacher Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-xl border border-[#DCE4E0] bg-white p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE8]">
              <h3 className="text-base font-bold text-[#111C18]">{editing ? t('edit') : t('addTeacher')}</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 rounded-md hover:bg-gray-100">
                <X className="h-4 w-4 text-[#5A6D65]" />
              </button>
            </div>
            <form onSubmit={handleSave} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[#5A6D65] mb-1 font-medium">{t('fullName')} *</label>
                  <input
                    type="text"
                    required
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1 font-medium">{t('fullNameUr')}</label>
                  <input
                    type="text"
                    value={form.full_name_ur}
                    onChange={(e) => setForm({ ...form, full_name_ur: e.target.value })}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1 font-medium">{t('qualification')} *</label>
                  <input
                    type="text"
                    required
                    value={form.qualification}
                    onChange={(e) => setForm({ ...form, qualification: e.target.value, qualification_ur: e.target.value })}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1 font-medium">{t('phone')} *</label>
                  <input
                    type="text"
                    required
                    placeholder="03001234567"
                    dir="ltr"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 font-mono-code text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1 font-medium">{t('classLabel')}</label>
                  <select
                    value={form.assign_class_id}
                    onChange={(e) => setForm({ ...form, assign_class_id: e.target.value })}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white text-xs"
                  >
                    {(lookups?.classes || []).map((c: any) => (
                      <option key={c.id} value={c.id}>{pick(c.name_en, c.name_ur)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1 font-medium">{t('subjectLabel')}</label>
                  <select
                    value={form.assign_subject_id}
                    onChange={(e) => setForm({ ...form, assign_subject_id: e.target.value })}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white text-xs"
                  >
                    {(lookups?.subjects || []).map((s: any) => (
                      <option key={s.id} value={s.id}>{pick(s.name_en, s.name_ur)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1 font-medium">{t('book')}</label>
                  <select
                    value={form.assign_book_id}
                    onChange={(e) => setForm({ ...form, assign_book_id: e.target.value })}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white text-xs"
                  >
                    {(lookups?.books || []).map((b: any) => (
                      <option key={b.id} value={b.id}>{pick(b.title_en, b.title_ur)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1 font-medium">{t('selectSession')}</label>
                  <select
                    value={form.assign_session_id}
                    onChange={(e) => setForm({ ...form, assign_session_id: e.target.value })}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white text-xs"
                  >
                    {(lookups?.sessions || []).map((s: any) => (
                      <option key={s.id} value={s.id}>{pick(s.name_en, s.name_ur)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1 font-medium">{lang === 'ur' ? 'وقت آغاز — اختتام' : 'Start — End Time'}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={form.assign_start_time}
                      onChange={(e) => setForm({ ...form, assign_start_time: e.target.value })}
                      className="w-full rounded-md border border-[#DCE4E0] px-2 py-1.5 font-mono-code text-xs"
                    />
                    <input
                      type="time"
                      value={form.assign_end_time}
                      onChange={(e) => setForm({ ...form, assign_end_time: e.target.value })}
                      className="w-full rounded-md border border-[#DCE4E0] px-2 py-1.5 font-mono-code text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1 font-medium">{lang === 'ur' ? 'ایامِ تدریس و درسگاہ' : 'Days & Room'}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={form.assign_days}
                      onChange={(e) => setForm({ ...form, assign_days: e.target.value })}
                      className="w-full rounded-md border border-[#DCE4E0] px-2.5 py-2 text-xs"
                      placeholder="ہفتہ تا بدھ"
                    />
                    <input
                      type="text"
                      value={form.assign_room}
                      onChange={(e) => setForm({ ...form, assign_room: e.target.value })}
                      className="w-28 rounded-md border border-[#DCE4E0] px-2.5 py-2 text-xs"
                      placeholder="درسگاہ ۱"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1 font-medium">{t('responsibilities')}</label>
                <textarea
                  rows={2}
                  value={form.responsibilities_ur || form.responsibilities}
                  onChange={(e) => setForm({ ...form, responsibilities: e.target.value, responsibilities_ur: e.target.value })}
                  className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#EEF2F0]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-md border border-[#DCE4E0] px-4 py-2 text-xs text-[#5A6D65] hover:bg-gray-50"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-[#065F46] px-5 py-2 text-xs font-semibold text-white hover:bg-[#064E3B]"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Schedule & Book Slot Modal */}
      {schedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-[#DCE4E0] bg-white p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE8]">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#065F46]" />
                <h3 className="text-base font-bold text-[#111C18]">
                  {editingSchedId
                    ? (lang === 'ur' ? 'کلاس و مضمون شیڈول میں ترمیم' : 'Edit Class & Subject Schedule')
                    : (lang === 'ur' ? 'نیا کلاس و مضمون شیڈول بنائیں / کتاب تفویض کریں' : 'Schedule Class / Assign Subject & Book')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSchedModalOpen(false);
                  setEditingSchedId(null);
                }}
                className="p-1 rounded-md hover:bg-gray-100"
              >
                <X className="h-4 w-4 text-[#5A6D65]" />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[#5A6D65] mb-1 font-medium">{t('teacherLabel')} *</label>
                  <select
                    required
                    value={schedForm.teacher_id}
                    onChange={(e) => setSchedForm({ ...schedForm, teacher_id: e.target.value })}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white text-xs font-medium"
                  >
                    {teachers.map((tc) => (
                      <option key={tc.id} value={tc.id}>
                        {pick(tc.full_name, tc.full_name_ur)} ({tc.teacher_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#5A6D65] mb-1 font-medium">{t('classLabel')} *</label>
                  <select
                    required
                    value={schedForm.class_id}
                    onChange={(e) => setSchedForm({ ...schedForm, class_id: e.target.value })}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white text-xs font-medium"
                  >
                    {lookups.classes.map((c: any) => (
                      <option key={c.id} value={c.id}>{pick(c.name_en, c.name_ur)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#5A6D65] mb-1 font-medium">{t('subjectLabel')} *</label>
                  <select
                    required
                    value={schedForm.subject_id}
                    onChange={(e) => setSchedForm({ ...schedForm, subject_id: e.target.value })}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white text-xs font-medium"
                  >
                    {lookups.subjects.map((s: any) => (
                      <option key={s.id} value={s.id}>{pick(s.name_en, s.name_ur)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#5A6D65] mb-1 font-medium">{t('book')}</label>
                  <select
                    value={schedForm.book_id}
                    onChange={(e) => setSchedForm({ ...schedForm, book_id: e.target.value })}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white text-xs font-medium"
                  >
                    <option value="">{lang === 'ur' ? '— کتاب منتخب کریں —' : '— Select Book —'}</option>
                    {lookups.books.map((b: any) => (
                      <option key={b.id} value={b.id}>{pick(b.title_en, b.title_ur)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#5A6D65] mb-1 font-medium">{t('selectSession')} *</label>
                  <select
                    required
                    value={schedForm.session_id}
                    onChange={(e) => setSchedForm({ ...schedForm, session_id: e.target.value })}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white text-xs font-medium"
                  >
                    {lookups.sessions.map((s: any) => (
                      <option key={s.id} value={s.id}>{pick(s.name_en, s.name_ur)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#5A6D65] mb-1 font-medium">{lang === 'ur' ? 'وقت آغاز — اختتام' : 'Start — End Time'}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={schedForm.start_time}
                      onChange={(e) => setSchedForm({ ...schedForm, start_time: e.target.value })}
                      className="w-full rounded-md border border-[#DCE4E0] px-2 py-1.5 font-mono-code text-xs"
                    />
                    <input
                      type="time"
                      value={schedForm.end_time}
                      onChange={(e) => setSchedForm({ ...schedForm, end_time: e.target.value })}
                      className="w-full rounded-md border border-[#DCE4E0] px-2 py-1.5 font-mono-code text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[#5A6D65] mb-1 font-medium">{lang === 'ur' ? 'تدریسی ایام' : 'Days of Week'}</label>
                  <input
                    type="text"
                    value={schedForm.days_of_week}
                    onChange={(e) => setSchedForm({ ...schedForm, days_of_week: e.target.value })}
                    placeholder={lang === 'ur' ? 'ہفتہ تا بدھ' : 'Sat to Wed'}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[#5A6D65] mb-1 font-medium">{lang === 'ur' ? 'درسگاہ / کمرہ' : 'Room / Hall'}</label>
                  <input
                    type="text"
                    value={schedForm.room_name}
                    onChange={(e) => setSchedForm({ ...schedForm, room_name: e.target.value })}
                    placeholder={lang === 'ur' ? 'درسگاہ ۱' : 'Hall 1'}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#EEF2F0]">
                <button
                  type="button"
                  onClick={() => {
                    setSchedModalOpen(false);
                    setEditingSchedId(null);
                  }}
                  className="rounded-md border border-[#DCE4E0] px-4 py-2 text-xs text-[#5A6D65] hover:bg-gray-50"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-[#065F46] px-5 py-2 text-xs font-semibold text-white hover:bg-[#064E3B] shadow-sm"
                >
                  {editingSchedId ? (lang === 'ur' ? 'محفوظ کریں (اپ ڈیٹ)' : 'Update Schedule') : (lang === 'ur' ? 'شیڈول شامل کریں' : 'Save Schedule')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Daily Lesson Modal */}
      {lessonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-xl border border-[#DCE4E0] bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE8]">
              <h3 className="text-sm font-bold text-[#111C18]">
                {lang === 'ur' ? 'آج کا سبق درج کریں (کہاں سے کہاں تک)' : 'Record Today’s Lesson (From — To)'}
              </h3>
              <button type="button" onClick={() => setLessonModalOpen(false)} className="p-1 rounded hover:bg-gray-100">
                <X className="h-4 w-4 text-[#5A6D65]" />
              </button>
            </div>
            <form onSubmit={handleSaveQuickLesson} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-[#5A6D65] mb-1 font-medium">{t('date')}</label>
                <input
                  type="date"
                  required
                  value={lessonForm.lesson_date}
                  onChange={(e) => setLessonForm({ ...lessonForm, lesson_date: e.target.value })}
                  className="font-mono-code w-full rounded-md border border-[#DCE4E0] px-3 py-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#5A6D65] mb-1 font-medium">
                    {lang === 'ur' ? 'کہاں سے پڑھایا *' : 'Taught From *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={lang === 'ur' ? 'مثلاً: ص ۲۸' : 'e.g. Page 28'}
                    value={lessonForm.start_position}
                    onChange={(e) => setLessonForm({ ...lessonForm, start_position: e.target.value })}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1 font-medium">
                    {lang === 'ur' ? 'کہاں تک پڑھایا *' : 'Taught To *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={lang === 'ur' ? 'مثلاً: ص ۴۲' : 'e.g. Page 42'}
                    value={lessonForm.end_position}
                    onChange={(e) => setLessonForm({ ...lessonForm, end_position: e.target.value })}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1 font-medium">{t('homework')}</label>
                <input
                  type="text"
                  placeholder={lang === 'ur' ? 'گھر کا کام / تکرار' : 'Homework assignment'}
                  value={lessonForm.homework}
                  onChange={(e) => setLessonForm({ ...lessonForm, homework: e.target.value })}
                  className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1 font-medium">{t('remarks')}</label>
                <input
                  type="text"
                  placeholder={lang === 'ur' ? 'خصوصی ہدایات / نوٹ' : 'Remarks'}
                  value={lessonForm.remarks}
                  onChange={(e) => setLessonForm({ ...lessonForm, remarks: e.target.value })}
                  className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#EEF2F0]">
                <button
                  type="button"
                  onClick={() => setLessonModalOpen(false)}
                  className="rounded-md border border-[#DCE4E0] px-4 py-2 text-xs text-[#5A6D65] hover:bg-gray-50"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-[#065F46] px-5 py-2 text-xs font-semibold text-white hover:bg-[#064E3B]"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        title={lang === 'ur' ? 'شیڈول حذف کریں' : 'Delete Schedule Slot'}
        message={lang === 'ur' ? 'کیا آپ واقعی یہ کلاس شیڈول حذف کرنا چاہتے ہیں؟' : 'Are you sure you want to remove this schedule slot?'}
        danger
        onConfirm={handleDeleteSchedule}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
};
