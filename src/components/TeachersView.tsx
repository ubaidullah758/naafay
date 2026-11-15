import React, { useEffect, useState } from 'react';
import { Plus, ArrowLeft, ArrowRight, X, Edit, Calendar, Clock, Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { todayLocal } from '../lib/date';
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
  const [teachers, setTeachers] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [lookups, setLookups] = useState<any>({ classes: [], subjects: [], books: [], sessions: [] });

  const [schedClassFilter, setSchedClassFilter] = useState('');
  const [schedTeacherFilter, setSchedTeacherFilter] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(initialTeacherId || null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [schedModalOpen, setSchedModalOpen] = useState(false);
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
  const [editing, setEditing] = useState<any | null>(null);
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
    assign_start_time: '09:00',
    assign_end_time: '10:00',
    assign_days: 'ہفتہ تا جمعرات',
    assign_room: 'درسگاہ ۱',
  });

  const [schedForm, setSchedForm] = useState({
    teacher_id: 'tch-1',
    class_id: 'cls-tak1',
    subject_id: 'sub-fiqh',
    book_id: 'bk-radd',
    session_id: 'ses-morning',
    start_time: '09:00',
    end_time: '10:00',
    days_of_week: 'ہفتہ تا جمعرات',
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
      assign_class_id: 'cls-tak1',
      assign_subject_id: 'sub-fiqh',
      assign_book_id: 'bk-radd',
      assign_session_id: 'ses-morning',
      assign_start_time: '09:00',
      assign_end_time: '10:00',
      assign_days: 'ہفتہ تا جمعرات',
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
      assign_class_id: firstA?.class_id || 'cls-tak1',
      assign_subject_id: firstA?.subject_id || 'sub-fiqh',
      assign_book_id: firstA?.book_id || 'bk-radd',
      assign_session_id: firstA?.session_id || 'ses-morning',
      assign_start_time: firstA?.start_time || '09:00',
      assign_end_time: firstA?.end_time || '10:00',
      assign_days: firstA?.days_of_week || 'ہفتہ تا جمعرات',
      assign_room: firstA?.room_name || 'درسگاہ ۱',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
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
    } else {
      await apiFetch('/api/teachers', { method: 'POST', body: JSON.stringify(payload) }, user);
    }
    setModalOpen(false);
    await load();
    if (selectedId) {
      apiFetch(`/api/teachers/${selectedId}`, {}, user).then(setProfile);
    }
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/schedule', { method: 'POST', body: JSON.stringify(schedForm) }, user);
    setSchedModalOpen(false);
    await load();
    if (selectedId) {
      apiFetch(`/api/teachers/${selectedId}`, {}, user).then(setProfile);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!confirmDeleteId) return;
    await apiFetch(`/api/schedule/${confirmDeleteId}`, { method: 'DELETE' }, user);
    setConfirmDeleteId(null);
    await load();
    if (selectedId) {
      apiFetch(`/api/teachers/${selectedId}`, {}, user).then(setProfile);
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
      class_id: slot.class_id || 'cls-tak1',
      subject_id: slot.subject_id || 'sub-fiqh',
      book_id: slot.book_id || 'bk-radd',
      start_position: slot.latest_end_position || '',
      end_position: '',
      homework: '',
      remarks: '',
    });
    setLessonModalOpen(true);
  };

  const handleSaveQuickLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/lessons', { method: 'POST', body: JSON.stringify(lessonForm) }, user);
    setLessonModalOpen(false);
    await load();
    if (selectedId) {
      apiFetch(`/api/teachers/${selectedId}`, {}, user).then(setProfile);
    }
  };

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

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
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setSelectedId(null)} className="inline-flex items-center gap-2 text-sm text-[#065F46] hover:underline">
            {lang === 'ur' ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
            <span>{t('navTeachers')}</span>
          </button>
          {canManageStudents && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSchedForm((sf) => ({ ...sf, teacher_id: tc.id }));
                  setSchedModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#065F46] px-3.5 py-2 text-xs text-white hover:bg-[#064E3B]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{lang === 'ur' ? 'شیڈول / کلاس شامل کریں' : 'Add Schedule Slot'}</span>
              </button>
              <button type="button" onClick={() => openEdit(tc)} className="inline-flex items-center gap-1.5 rounded-md border border-[#DCE4E0] bg-white px-3.5 py-2 text-xs">
                <Edit className="h-3.5 w-3.5 text-[#065F46]" />
                <span>{t('edit')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Teacher Header */}
        <div className="rounded-lg border border-[#DCE4E0] bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono-code text-xs font-semibold text-[#065F46]">{tc.teacher_code}</span>
              <span className="text-[#CBD5D1]">·</span>
              <StatusText status={tc.status} />
            </div>
            <h2 className="mt-1 text-lg text-[#111C18]">{pick(tc.full_name, tc.full_name_ur)}</h2>
            <div className="text-xs text-[#5A6D65] mt-0.5">{pick(tc.qualification, tc.qualification_ur)}</div>
            <div className="text-xs text-[#2A3B34] mt-1">{pick(tc.responsibilities, tc.responsibilities_ur)}</div>
          </div>
          <div className="grid grid-cols-3 gap-5 text-xs tabular-nums border-t sm:border-t-0 pt-3 sm:pt-0 border-[#E5ECE8]">
            <div>
              <div className="text-[#5A6D65]">{t('supervisedStudents')}</div>
              <div className="text-lg font-bold text-[#065F46]">{performance.supervisedStudentCount}</div>
            </div>
            <div>
              <div className="text-[#5A6D65]">{t('teacherLessons')}</div>
              <div className="text-lg font-bold text-[#111C18]">{performance.totalLessons}</div>
            </div>
            <div>
              <div className="text-[#5A6D65]">{t('teacherReviews')}</div>
              <div className="text-lg font-bold text-[#111C18]">{performance.totalStudyReviews}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assigned Books, Classes & Weekly Schedule */}
          <div className="rounded-lg border border-[#DCE4E0] bg-white p-5">
            <h3 className="text-sm text-[#111C18] pb-3 border-b border-[#EEF2F0]">
              {lang === 'ur' ? 'متعلقہ کلاس، مضمون اور شیڈول' : 'Assigned Classes, Subjects & Schedule'}
            </h3>
            <div className="divide-y divide-[#EEF2F0] text-xs">
              {assignments.map((a: any) => (
                <div key={a.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-[#111C18]">
                      {pick(a.subject_name_en, a.subject_name_ur)} — {pick(a.book_title_en, a.book_title_ur)}
                    </div>
                    <div className="text-[#5A6D65]">
                      {pick(a.class_name_en, a.class_name_ur)}
                      {a.days_of_week ? ` · ${a.days_of_week}` : ''}
                      {a.room_name ? ` · ${a.room_name}` : ''}
                    </div>
                    <div className="text-[#065F46]">
                      <span className="text-[#5A6D65]">{lang === 'ur' ? 'کہاں سے کہاں تک پڑھایا: ' : 'Taught: '}</span>
                      {a.latest_end_position
                        ? `${a.latest_start_position} — ${a.latest_end_position} (${a.latest_lesson_date})`
                        : (lang === 'ur' ? 'تاحال درج نہیں' : 'Not recorded yet')}
                    </div>
                  </div>
                  <div className="text-end shrink-0 space-y-1">
                    <div className="text-[#065F46]">{pick(a.session_name_en, a.session_name_ur) || '—'}</div>
                    {a.start_time && (
                      <div className="font-mono-code tabular-nums text-[#5A6D65]">
                        {a.start_time} – {a.end_time}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => openQuickLesson(a)}
                      className="text-[11px] text-[#0284C7] hover:underline whitespace-nowrap"
                    >
                      {lang === 'ur' ? '+ آج کا سبق درج کریں' : '+ Update Lesson'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Supervised Students */}
          <div className="rounded-lg border border-[#DCE4E0] bg-white p-5">
            <h3 className="text-sm text-[#111C18] pb-3 border-b border-[#EEF2F0]">{t('supervisedStudents')}</h3>
            <div className="divide-y divide-[#EEF2F0] text-xs">
              {supervisedStudents.map((st: any) => (
                <div key={st.id} className="py-2.5 flex items-center justify-between">
                  <span className="text-[#111C18]">{pick(st.full_name, st.full_name_ur)}</span>
                  <span className="font-mono-code text-[#065F46]">{st.student_code}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Lesson History */}
          <div className="rounded-lg border border-[#DCE4E0] bg-white p-5">
            <h3 className="text-sm text-[#111C18] pb-3 border-b border-[#EEF2F0]">{t('teacherLessons')}</h3>
            <div className="divide-y divide-[#EEF2F0] text-xs">
              {lessons.length === 0 ? (
                <p className="py-6 text-center text-[#5A6D65]">{t('noData')}</p>
              ) : (
                lessons.map((l: any) => (
                  <div key={l.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[#111C18]">{pick(l.book_title_en, l.book_title_ur)}</div>
                      <div className="text-[#5A6D65]">{l.start_position} — {l.end_position}</div>
                    </div>
                    <span className="font-mono-code text-[#5A6D65] tabular-nums">{l.lesson_date}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Study Reviews */}
          <div className="rounded-lg border border-[#DCE4E0] bg-white p-5">
            <h3 className="text-sm text-[#111C18] pb-3 border-b border-[#EEF2F0]">{t('teacherReviews')}</h3>
            <div className="divide-y divide-[#EEF2F0] text-xs">
              {studyReviews.length === 0 ? (
                <p className="py-6 text-center text-[#5A6D65]">{t('noData')}</p>
              ) : (
                studyReviews.map((sr: any) => (
                  <div key={sr.id} className="py-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[#111C18]">{pick(sr.student_name, sr.student_name_ur)}</span>
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

  return (
    <div className="space-y-5">
      {/* Top Bar: Sub-tabs + Actions */}
      <div className="rounded-lg border border-[#DCE4E0] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-md bg-[#F6F8F7] border border-[#DCE4E0]">
            <button
              type="button"
              onClick={() => setSubTab('directory')}
              className={`px-3 py-1.5 text-xs rounded whitespace-nowrap transition-colors ${
                subTab === 'directory' ? 'bg-white text-[#065F46] shadow-sm' : 'text-[#5A6D65] hover:text-[#111C18]'
              }`}
            >
              {t('navTeachers')}
            </button>
            <button
              type="button"
              onClick={() => setSubTab('schedule')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded whitespace-nowrap transition-colors ${
                subTab === 'schedule' ? 'bg-white text-[#065F46] shadow-sm' : 'text-[#5A6D65] hover:text-[#111C18]'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>{lang === 'ur' ? 'کلاس اور مضمون شیڈول (ٹائم ٹیبل)' : 'Class & Subject Schedule'}</span>
            </button>
          </div>

          {subTab === 'schedule' && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={schedClassFilter}
                onChange={(e) => setSchedClassFilter(e.target.value)}
                className="rounded-md border border-[#DCE4E0] px-2.5 py-1.5 text-xs bg-white"
              >
                <option value="">{t('allClasses')}</option>
                {lookups.classes.map((c: any) => (
                  <option key={c.id} value={c.id}>{pick(c.name_en, c.name_ur)}</option>
                ))}
              </select>
              <select
                value={schedTeacherFilter}
                onChange={(e) => setSchedTeacherFilter(e.target.value)}
                className="rounded-md border border-[#DCE4E0] px-2.5 py-1.5 text-xs bg-white"
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
          <div className="flex items-center gap-2">
            {subTab === 'schedule' ? (
              <button
                type="button"
                onClick={() => setSchedModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-md bg-[#065F46] px-4 py-2 text-xs text-white hover:bg-[#064E3B] whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                <span>{lang === 'ur' ? 'نیا پیریڈ / شیڈول شامل کریں' : 'Add Schedule Slot'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-2 rounded-md bg-[#065F46] px-4 py-2 text-xs text-white hover:bg-[#064E3B] whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                <span>{t('addTeacher')}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* DIRECTORY TAB */}
      {subTab === 'directory' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-2 p-8 text-center text-xs text-[#5A6D65]">{t('loading')}</div>
          ) : (
            teachers.map((tc) => (
              <div
                key={tc.id}
                onClick={() => setSelectedId(tc.id)}
                className="rounded-lg border border-[#DCE4E0] bg-white p-5 hover:border-[#065F46]/60 cursor-pointer transition-colors space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono-code text-xs font-semibold text-[#065F46]">{tc.teacher_code}</span>
                  <StatusText status={tc.status} />
                </div>
                <h3 className="text-base text-[#111C18]">{pick(tc.full_name, tc.full_name_ur)}</h3>
                <div className="text-xs text-[#5A6D65]">{pick(tc.qualification, tc.qualification_ur)}</div>
                <div className="text-xs text-[#2A3B34]">{pick(tc.responsibilities, tc.responsibilities_ur)}</div>

                {tc.assignments && tc.assignments.length > 0 && (
                  <div className="pt-2.5 border-t border-[#EEF2F0] space-y-2 text-xs">
                    {tc.assignments.slice(0, 3).map((a: any) => (
                      <div key={a.id} className="rounded bg-[#F6F8F7] border border-[#E5ECE8] px-3 py-2 space-y-0.5">
                        <div className="flex items-center justify-between gap-2 text-[#111C18]">
                          <span>
                            {pick(a.class_name_en, a.class_name_ur)} · {pick(a.book_title_en, a.book_title_ur) || pick(a.subject_name_en, a.subject_name_ur)}
                          </span>
                          <span className="font-mono-code text-[11px] text-[#065F46] tabular-nums whitespace-nowrap">
                            {a.start_time ? `${a.start_time}–${a.end_time}` : ''}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#065F46]">
                          <span className="text-[#5A6D65]">{lang === 'ur' ? 'روزانہ سبق (کہاں سے کہاں تک): ' : 'Taught (From — To): '}</span>
                          {a.latest_end_position
                            ? `${a.latest_start_position} — ${a.latest_end_position}`
                            : (lang === 'ur' ? 'تاحال درج نہیں' : 'No lesson recorded yet')}
                          {a.latest_lesson_date && (
                            <span className="ms-2 font-mono-code text-[#5A6D65] tabular-nums">({a.latest_lesson_date})</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-[#EEF2F0] flex items-center justify-between text-xs text-[#5A6D65]">
                  <span className="font-mono-code">{tc.phone}</span>
                  <span className="text-[#065F46]">{lang === 'ur' ? 'پروفائل اور مکمل اسباق ←' : 'View Profile & Lessons →'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* CLASS & SUBJECT SCHEDULE TAB */}
      {subTab === 'schedule' && (
        <div className="rounded-lg border border-[#DCE4E0] bg-white overflow-x-auto">
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
                      <div className="text-[#065F46]">{pick(sc.session_name_en, sc.session_name_ur) || '—'}</div>
                      <div className="inline-flex items-center gap-1 font-mono-code text-[11px] text-[#5A6D65] tabular-nums">
                        <Clock className="h-3 w-3" />
                        <span>{sc.start_time || '--:--'} – {sc.end_time || '--:--'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedId(sc.teacher_id)}
                        className="text-[#111C18] hover:text-[#065F46] hover:underline"
                      >
                        {pick(sc.teacher_name, sc.teacher_name_ur)}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[#2A3B34] whitespace-nowrap">{pick(sc.class_name_en, sc.class_name_ur)}</td>
                    <td className="px-4 py-3 text-[#0B2545] whitespace-nowrap">{pick(sc.subject_name_en, sc.subject_name_ur)}</td>
                    <td className="px-4 py-3 text-[#064E3B] whitespace-nowrap">{pick(sc.book_title_en, sc.book_title_ur) || '—'}</td>
                    <td className="px-4 py-3 text-[#5A6D65] whitespace-nowrap">
                      <div>{sc.days_of_week || '—'}</div>
                      <div className="text-[11px]">{sc.room_name || ''}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {sc.latest_end_position ? (
                        <div>
                          <div className="text-[#065F46]">
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
                        <div className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openQuickLesson(sc)}
                            className="text-[#0284C7] hover:underline whitespace-nowrap"
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
      )}

      {/* Add/Edit Teacher Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-lg border border-[#DCE4E0] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE8]">
              <h3 className="text-sm text-[#111C18]">{editing ? t('edit') : t('addTeacher')}</h3>
              <button type="button" onClick={() => setModalOpen(false)}><X className="h-4 w-4 text-[#5A6D65]" /></button>
            </div>
            <form onSubmit={handleSave} className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('fullName')} *</label>
                  <input type="text" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('fullNameUr')}</label>
                  <input type="text" value={form.full_name_ur} onChange={(e) => setForm({ ...form, full_name_ur: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('qualification')} *</label>
                  <input type="text" required value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value, qualification_ur: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('phone')} *</label>
                  <input type="text" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('classLabel')}</label>
                  <select value={form.assign_class_id} onChange={(e) => setForm({ ...form, assign_class_id: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                    {lookups.classes.map((c: any) => (
                      <option key={c.id} value={c.id}>{pick(c.name_en, c.name_ur)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('subjectLabel')}</label>
                  <select value={form.assign_subject_id} onChange={(e) => setForm({ ...form, assign_subject_id: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                    {lookups.subjects.map((s: any) => (
                      <option key={s.id} value={s.id}>{pick(s.name_en, s.name_ur)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('book')}</label>
                  <select value={form.assign_book_id} onChange={(e) => setForm({ ...form, assign_book_id: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                    {lookups.books.map((b: any) => (
                      <option key={b.id} value={b.id}>{pick(b.title_en, b.title_ur)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('selectSession')}</label>
                  <select value={form.assign_session_id} onChange={(e) => setForm({ ...form, assign_session_id: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                    {lookups.sessions.map((s: any) => (
                      <option key={s.id} value={s.id}>{pick(s.name_en, s.name_ur)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{lang === 'ur' ? 'وقت آغاز — اختتام' : 'Start — End Time'}</label>
                  <div className="flex items-center gap-2">
                    <input type="time" value={form.assign_start_time} onChange={(e) => setForm({ ...form, assign_start_time: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-2 py-2" />
                    <input type="time" value={form.assign_end_time} onChange={(e) => setForm({ ...form, assign_end_time: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-2 py-2" />
                  </div>
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{lang === 'ur' ? 'ایامِ تدریس و درسگاہ' : 'Days & Room'}</label>
                  <div className="flex items-center gap-2">
                    <input type="text" value={form.assign_days} onChange={(e) => setForm({ ...form, assign_days: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-2.5 py-2" />
                    <input type="text" value={form.assign_room} onChange={(e) => setForm({ ...form, assign_room: e.target.value })} className="w-28 rounded-md border border-[#DCE4E0] px-2.5 py-2" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('responsibilities')}</label>
                <textarea rows={2} value={form.responsibilities_ur || form.responsibilities} onChange={(e) => setForm({ ...form, responsibilities: e.target.value, responsibilities_ur: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-[#DCE4E0] px-4 py-2">{t('cancel')}</button>
                <button type="submit" className="rounded-md bg-[#065F46] px-4 py-2 text-white">{t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Schedule Slot Modal */}
      {schedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-lg border border-[#DCE4E0] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE8]">
              <h3 className="text-sm text-[#111C18]">{lang === 'ur' ? 'نیا کلاس و مضمون شیڈول شامل کریں' : 'Add Class & Subject Schedule'}</h3>
              <button type="button" onClick={() => setSchedModalOpen(false)}><X className="h-4 w-4 text-[#5A6D65]" /></button>
            </div>
            <form onSubmit={handleAddSchedule} className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('teacherLabel')}</label>
                  <select value={schedForm.teacher_id} onChange={(e) => setSchedForm({ ...schedForm, teacher_id: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                    {teachers.map((tc) => (
                      <option key={tc.id} value={tc.id}>{pick(tc.full_name, tc.full_name_ur)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('classLabel')}</label>
                  <select value={schedForm.class_id} onChange={(e) => setSchedForm({ ...schedForm, class_id: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                    {lookups.classes.map((c: any) => (
                      <option key={c.id} value={c.id}>{pick(c.name_en, c.name_ur)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('subjectLabel')}</label>
                  <select value={schedForm.subject_id} onChange={(e) => setSchedForm({ ...schedForm, subject_id: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                    {lookups.subjects.map((s: any) => (
                      <option key={s.id} value={s.id}>{pick(s.name_en, s.name_ur)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('book')}</label>
                  <select value={schedForm.book_id} onChange={(e) => setSchedForm({ ...schedForm, book_id: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                    {lookups.books.map((b: any) => (
                      <option key={b.id} value={b.id}>{pick(b.title_en, b.title_ur)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{t('selectSession')}</label>
                  <select value={schedForm.session_id} onChange={(e) => setSchedForm({ ...schedForm, session_id: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                    {lookups.sessions.map((s: any) => (
                      <option key={s.id} value={s.id}>{pick(s.name_en, s.name_ur)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{lang === 'ur' ? 'وقت آغاز — اختتام' : 'Start — End Time'}</label>
                  <div className="flex items-center gap-2">
                    <input type="time" value={schedForm.start_time} onChange={(e) => setSchedForm({ ...schedForm, start_time: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-2 py-2" />
                    <input type="time" value={schedForm.end_time} onChange={(e) => setSchedForm({ ...schedForm, end_time: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-2 py-2" />
                  </div>
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{lang === 'ur' ? 'ایام' : 'Days'}</label>
                  <input type="text" value={schedForm.days_of_week} onChange={(e) => setSchedForm({ ...schedForm, days_of_week: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">{lang === 'ur' ? 'درسگاہ / کمرہ' : 'Room'}</label>
                  <input type="text" value={schedForm.room_name} onChange={(e) => setSchedForm({ ...schedForm, room_name: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setSchedModalOpen(false)} className="rounded-md border border-[#DCE4E0] px-4 py-2">{t('cancel')}</button>
                <button type="submit" className="rounded-md bg-[#065F46] px-4 py-2 text-white">{t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Daily Lesson Modal */}
      {lessonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-lg border border-[#DCE4E0] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE8]">
              <h3 className="text-sm text-[#111C18]">
                {lang === 'ur' ? 'آج کا سبق درج کریں (کہاں سے کہاں تک)' : 'Record Today’s Lesson (From — To)'}
              </h3>
              <button type="button" onClick={() => setLessonModalOpen(false)}><X className="h-4 w-4 text-[#5A6D65]" /></button>
            </div>
            <form onSubmit={handleSaveQuickLesson} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('date')}</label>
                <input
                  type="date"
                  required
                  value={lessonForm.lesson_date}
                  onChange={(e) => setLessonForm({ ...lessonForm, lesson_date: e.target.value })}
                  className="font-mono-code w-full rounded-md border border-[#DCE4E0] px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#5A6D65] mb-1">
                    {lang === 'ur' ? 'کہاں سے پڑھایا *' : 'Taught From *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={lang === 'ur' ? 'مثلاً: ص ۲۸' : 'e.g. Page 28'}
                    value={lessonForm.start_position}
                    onChange={(e) => setLessonForm({ ...lessonForm, start_position: e.target.value })}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[#5A6D65] mb-1">
                    {lang === 'ur' ? 'کہاں تک پڑھایا *' : 'Taught To *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={lang === 'ur' ? 'مثلاً: ص ۴۲' : 'e.g. Page 42'}
                    value={lessonForm.end_position}
                    onChange={(e) => setLessonForm({ ...lessonForm, end_position: e.target.value })}
                    className="w-full rounded-md border border-[#DCE4E0] px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('homework')}</label>
                <input
                  type="text"
                  value={lessonForm.homework}
                  onChange={(e) => setLessonForm({ ...lessonForm, homework: e.target.value })}
                  className="w-full rounded-md border border-[#DCE4E0] px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('remarks')}</label>
                <input
                  type="text"
                  value={lessonForm.remarks}
                  onChange={(e) => setLessonForm({ ...lessonForm, remarks: e.target.value })}
                  className="w-full rounded-md border border-[#DCE4E0] px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setLessonModalOpen(false)} className="rounded-md border border-[#DCE4E0] px-4 py-2">{t('cancel')}</button>
                <button type="submit" className="rounded-md bg-[#065F46] px-4 py-2 text-white">{t('save')}</button>
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
