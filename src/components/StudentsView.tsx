import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Trash2, Edit, X, Upload, Calendar, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch, fileToDataUrl } from '../lib/api';
import { todayLocal } from '../lib/date';
import { formatPakistaniMobile } from '../lib/phone';
import { StatusText } from './StatusText';
import { StudentProfileView } from './StudentProfileView';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorState } from './ErrorState';
import { Modal } from './Modal';

interface StudentsViewProps {
  initialStudentId?: string;
}

const yearsList = Array.from({ length: 70 }, (_, i) => 2026 - i); // 2026 down to 1957
const monthsList = [
  { val: '01', ur: '01 - جنوری' },
  { val: '02', ur: '02 - فروری' },
  { val: '03', ur: '03 - مارچ' },
  { val: '04', ur: '04 - اپریل' },
  { val: '05', ur: '05 - مئی' },
  { val: '06', ur: '06 - جون' },
  { val: '07', ur: '07 - جولائی' },
  { val: '08', ur: '08 - اگست' },
  { val: '09', ur: '09 - ستمبر' },
  { val: '10', ur: '10 - اکتوبر' },
  { val: '11', ur: '11 - نومبر' },
  { val: '12', ur: '12 - دسمبر' },
];
const daysList = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

export const StudentsView: React.FC<StudentsViewProps> = ({ initialStudentId }) => {
  const { lang, t, pick } = useLanguage();
  const { user, canManageStudents, canDeleteStudents } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [lookups, setLookups] = useState<any>({ classes: [], batches: [], academicYears: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(initialStudentId || null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Quick Add states for Class, Academic Year, and Batch
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [savingClass, setSavingClass] = useState(false);

  const [showAddYear, setShowAddYear] = useState(false);
  const [newYearTitle, setNewYearTitle] = useState('');
  const [savingYear, setSavingYear] = useState(false);

  const [showAddBatch, setShowAddBatch] = useState(false);
  const [newBatchName, setNewBatchName] = useState('');
  const [savingBatch, setSavingBatch] = useState(false);

  // Optional English Name Toggle
  const [showEnglishFields, setShowEnglishFields] = useState(false);

  const emptyForm = {
    full_name: '',
    full_name_ur: '',
    father_name: '',
    father_name_ur: '',
    date_of_birth: '2002-01-01',
    phone: '',
    email: '',
    address: '',
    address_ur: '',
    guardian_name: '',
    guardian_name_ur: '',
    guardian_phone: '',
    previous_education: '',
    previous_education_ur: '',
    admission_date: todayLocal(),
    academic_year_id: 'ay-1447',
    class_id: 'cls-tak1',
    batch_id: 'bat-1a',
    status: 'active',
    photo_url: '',
  };
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);

  useEffect(() => {
    if (initialStudentId) setSelectedStudentId(initialStudentId);
  }, [initialStudentId]);

  const loadData = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (classFilter) params.set('classId', classFilter);
      if (statusFilter) params.set('status', statusFilter);

      const [stuRes, lkpRes] = await Promise.all([
        apiFetch(`/api/students?${params.toString()}`, { signal }, user),
        apiFetch('/api/lookups', { signal }, user),
      ]);
      setStudents(Array.isArray(stuRes) ? stuRes : Array.isArray(stuRes?.students) ? stuRes.students : []);
      setLookups({
        classes: Array.isArray(lkpRes?.classes) ? lkpRes.classes : [],
        batches: Array.isArray(lkpRes?.batches) ? lkpRes.batches : [],
        academicYears: Array.isArray(lkpRes?.academicYears) ? lkpRes.academicYears : [],
        ...(lkpRes || {}),
      });
    } catch (err: any) {
      if (signal?.aborted) return;
      setError(err?.message || 'Failed to load students');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      loadData(controller.signal);
    }, search ? 250 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, classFilter, statusFilter, user?.role]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setShowAddClass(false);
    setShowAddYear(false);
    setShowAddBatch(false);
  }, []);

  const openAdd = () => {
    setEditingStudent(null);
    setForm({
      ...emptyForm,
      academic_year_id: lookups.academicYears?.[0]?.id || 'ay-1447',
      class_id: lookups.classes?.[0]?.id || 'cls-tak1',
      batch_id: lookups.batches?.[0]?.id || '',
    });
    setFormError('');
    setShowEnglishFields(false);
    setModalOpen(true);
  };

  const openEdit = (st: any) => {
    setEditingStudent(st);
    setForm({
      full_name: st.full_name || '',
      full_name_ur: st.full_name_ur || st.full_name || '',
      father_name: st.father_name || '',
      father_name_ur: st.father_name_ur || st.father_name || '',
      date_of_birth: st.date_of_birth || '2002-01-01',
      phone: st.phone || '',
      email: st.email || '',
      address: st.address || '',
      address_ur: st.address_ur || '',
      guardian_name: st.guardian_name || st.father_name || '',
      guardian_name_ur: st.guardian_name_ur || st.father_name_ur || '',
      guardian_phone: st.guardian_phone || st.phone || '',
      previous_education: st.previous_education || '',
      previous_education_ur: st.previous_education_ur || '',
      admission_date: st.admission_date || todayLocal(),
      academic_year_id: st.academic_year_id || lookups.academicYears?.[0]?.id || 'ay-1447',
      class_id: st.class_id || lookups.classes?.[0]?.id || 'cls-tak1',
      batch_id: st.batch_id || '',
      status: st.status || 'active',
      photo_url: st.photo_url || '',
    });
    setShowEnglishFields(Boolean(st.full_name && st.full_name !== st.full_name_ur));
    setFormError('');
    setModalOpen(true);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    const up = await apiFetch('/api/uploads', { method: 'POST', body: JSON.stringify({ fileName: file.name, dataUrl }) }, user);
    setForm((prev) => ({ ...prev, photo_url: up.fileUrl }));
  };

  // DOB date handler
  const [dobYear, dobMonth, dobDay] = (form.date_of_birth || '2002-01-01').split('-');
  const handleDobChange = (field: 'year' | 'month' | 'day', val: string) => {
    let y = dobYear || '2002';
    let m = dobMonth || '01';
    let d = dobDay || '01';
    if (field === 'year') y = val;
    if (field === 'month') m = val;
    if (field === 'day') d = val;
    setForm((prev) => ({
      ...prev,
      date_of_birth: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`,
    }));
  };

  // Quick Add Class Handler
  const handleQuickAddClass = async () => {
    if (!newClassName.trim()) return;
    setSavingClass(true);
    try {
      const res = await apiFetch('/api/classes', {
        method: 'POST',
        body: JSON.stringify({ name_ur: newClassName.trim() }),
      }, user);
      if (res && res.id) {
        setLookups((prev: any) => ({
          ...prev,
          classes: [...(prev.classes || []), res],
        }));
        setForm((prev) => ({ ...prev, class_id: res.id }));
        setNewClassName('');
        setShowAddClass(false);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to add class');
    } finally {
      setSavingClass(false);
    }
  };

  // Quick Add Academic Year Handler
  const handleQuickAddYear = async () => {
    if (!newYearTitle.trim()) return;
    setSavingYear(true);
    try {
      const res = await apiFetch('/api/academic-years', {
        method: 'POST',
        body: JSON.stringify({ title_ur: newYearTitle.trim() }),
      }, user);
      if (res && res.id) {
        setLookups((prev: any) => ({
          ...prev,
          academicYears: [...(prev.academicYears || []), res],
        }));
        setForm((prev) => ({ ...prev, academic_year_id: res.id }));
        setNewYearTitle('');
        setShowAddYear(false);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to add academic year');
    } finally {
      setSavingYear(false);
    }
  };

  // Quick Add Batch Handler
  const handleQuickAddBatch = async () => {
    if (!newBatchName.trim()) return;
    setSavingBatch(true);
    try {
      const res = await apiFetch('/api/batches', {
        method: 'POST',
        body: JSON.stringify({
          name_ur: newBatchName.trim(),
          class_id: form.class_id,
          academic_year_id: form.academic_year_id,
        }),
      }, user);
      if (res && res.id) {
        setLookups((prev: any) => ({
          ...prev,
          batches: [...(prev.batches || []), res],
        }));
        setForm((prev) => ({ ...prev, batch_id: res.id }));
        setNewBatchName('');
        setShowAddBatch(false);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to add batch');
    } finally {
      setSavingBatch(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const studentName = (form.full_name_ur || form.full_name || '').trim();
    if (!studentName) {
      setFormError(lang === 'ur' ? 'طالب علم کا مکمل نام درج کرنا لازمی ہے' : 'Student full name is required');
      return;
    }
    const fatherName = (form.father_name_ur || form.father_name || '').trim() || '—';
    const phone = (form.phone || '').trim() || '—';
    const guardianPhone = (form.guardian_phone || '').trim() || phone;
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        ...form,
        full_name: (form.full_name || '').trim() || studentName,
        full_name_ur: studentName,
        father_name: (form.father_name || '').trim() || fatherName,
        father_name_ur: fatherName,
        phone: phone !== '—' ? formatPakistaniMobile(phone) : '—',
        guardian_phone: guardianPhone !== '—' ? formatPakistaniMobile(guardianPhone) : '—',
      };
      if (editingStudent) {
        await apiFetch(`/api/students/${editingStudent.id}`, { method: 'PUT', body: JSON.stringify(payload) }, user);
      } else {
        await apiFetch('/api/students', { method: 'POST', body: JSON.stringify(payload) }, user);
      }
      setSaveSuccess(true);
      setTimeout(() => {
        closeModal();
        setSaveSuccess(false);
      }, 450);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || (lang === 'ur' ? 'محفوظ کرنے میں خرابی پیش آگئی' : 'Failed to save student'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await apiFetch(`/api/students/${deleteTarget.id}`, { method: 'DELETE' }, user);
    setDeleteTarget(null);
    await loadData();
  };

  if (selectedStudentId) {
    return (
      <>
        <StudentProfileView
          studentId={selectedStudentId}
          onBack={() => setSelectedStudentId(null)}
          onEditStudent={(st) => openEdit(st)}
        />
        {modalOpen && renderModal()}
      </>
    );
  }

  function renderModal() {
    return (
      <Modal
        open={modalOpen}
        onClose={closeModal}
        labelledBy="student-modal-title"
        panelClassName="w-full max-w-2xl rounded-2xl border border-[#DCE4E0] bg-white shadow-2xl my-auto flex flex-col max-h-[90vh] overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-[#E5ECE8] flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-50 text-[#065F46] flex items-center justify-center font-bold">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h3 id="student-modal-title" className="text-base font-bold text-[#111C18]">
                {editingStudent ? t('editStudent') : t('addStudent')}
              </h3>
              <p className="text-[11px] text-[#5A6D65]">
                {lang === 'ur' ? 'طالب علم کی بنیادی اور تعلیمی معلومات درج کریں' : 'Enter basic and academic information'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label={t('cancel')}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-xs">
            {/* Photo & ST-Code header */}
            <div className="flex items-center gap-3.5 pb-3 border-b border-[#EEF2F0]">
              {form.photo_url ? (
                <img src={form.photo_url} alt="Student" referrerPolicy="no-referrer" className="h-12 w-12 rounded-lg object-cover border border-[#DCE4E0]" />
              ) : (
                <div className="h-10 px-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center font-mono-code font-bold text-[#065F46] text-xs whitespace-nowrap shadow-2xs">
                  {editingStudent ? editingStudent.student_code : 'ST-AUTO'}
                </div>
              )}
              <label className="inline-flex items-center gap-2 rounded-lg border border-[#DCE4E0] px-3.5 py-2 text-xs font-medium text-[#111C18] hover:bg-[#F6F8F7] cursor-pointer transition-colors shadow-2xs">
                <Upload className="h-3.5 w-3.5 text-[#065F46]" />
                <span>{t('photoLabel')}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Student Full Name */}
              <div>
                <label className="block text-[#374841] mb-1 font-semibold text-xs">
                  {lang === 'ur' ? 'طالب علم کا مکمل نام *' : 'Student Full Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={lang === 'ur' ? 'مثلاً: مولانا عبد الرحمن' : 'e.g. Abdur Rahman'}
                  value={form.full_name_ur || form.full_name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      full_name_ur: val,
                      full_name: !prev.full_name || prev.full_name === prev.full_name_ur ? val : prev.full_name,
                    }));
                  }}
                  className="w-full h-10 rounded-lg border border-[#DCE4E0] px-3 text-xs font-medium bg-white focus:border-[#065F46] focus:ring-1 focus:ring-[#065F46] transition-colors"
                />
              </div>

              {/* Father Name */}
              <div>
                <label className="block text-[#374841] mb-1 font-semibold text-xs">
                  {lang === 'ur' ? 'ولدیت / والد کا نام' : "Father's Name"}
                </label>
                <input
                  type="text"
                  placeholder={lang === 'ur' ? 'مثلاً: محمد سلیمان' : 'e.g. Muhammad Suleman'}
                  value={form.father_name_ur || form.father_name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      father_name_ur: val,
                      father_name: !prev.father_name || prev.father_name === prev.father_name_ur ? val : prev.father_name,
                    }));
                  }}
                  className="w-full h-10 rounded-lg border border-[#DCE4E0] px-3 text-xs font-medium bg-white focus:border-[#065F46] focus:ring-1 focus:ring-[#065F46] transition-colors"
                />
              </div>

              {/* Optional English Name Toggle */}
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setShowEnglishFields((o) => !o)}
                  className="text-[11px] text-[#065F46] hover:underline font-bold inline-flex items-center gap-1"
                >
                  {showEnglishFields
                    ? (lang === 'ur' ? '− انگریزی نام چھپائیں' : '− Hide English Name')
                    : (lang === 'ur' ? '+ انگریزی نام درج کریں (سرٹیفکیٹ / پاسپورٹ کے لیے - اختیاری)' : '+ Add English Name (Optional)')}
                </button>
                {showEnglishFields && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 p-3 rounded-xl bg-gray-50 border border-gray-200">
                    <div>
                      <label className="block text-[#5A6D65] mb-1 font-medium text-[11px]">{lang === 'ur' ? 'انگریزی نام' : 'Full Name (English)'}</label>
                      <input
                        type="text"
                        placeholder="e.g. Abdur Rahman"
                        value={form.full_name}
                        onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                        className="w-full h-9 rounded-lg border border-[#DCE4E0] px-3 text-xs font-mono-code bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[#5A6D65] mb-1 font-medium text-[11px]">{lang === 'ur' ? 'ولدیت انگریزی' : "Father's Name (English)"}</label>
                      <input
                        type="text"
                        placeholder="e.g. Muhammad Suleman"
                        value={form.father_name}
                        onChange={(e) => setForm({ ...form, father_name: e.target.value })}
                        className="w-full h-9 rounded-lg border border-[#DCE4E0] px-3 text-xs font-mono-code bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Date of Birth Picker with Year Dropdown */}
              <div className="sm:col-span-2 rounded-xl bg-[#F6F8F7] border border-[#DCE4E0] p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[#374841] font-bold text-xs">
                    {t('dob')} <span className="text-[#5A6D65] font-normal">({lang === 'ur' ? 'سال، مہینہ اور دن منتخب کریں' : 'Select Year, Month & Day'})</span>
                  </label>
                  {form.date_of_birth && (
                    <span className="font-mono-code text-xs text-[#065F46] font-bold bg-white px-2.5 py-0.5 rounded-md border border-[#DCE4E0] shadow-2xs">
                      {form.date_of_birth}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5A6D65] mb-1">{lang === 'ur' ? 'سال' : 'Year'}</label>
                    <select
                      value={dobYear || '2002'}
                      onChange={(e) => handleDobChange('year', e.target.value)}
                      className="w-full h-10 rounded-lg border border-[#DCE4E0] px-2.5 bg-white text-xs font-mono-code font-medium focus:border-[#065F46] focus:ring-1 focus:ring-[#065F46]"
                    >
                      {yearsList.map((yr) => (
                        <option key={yr} value={String(yr)}>{yr}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5A6D65] mb-1">{lang === 'ur' ? 'ماہ' : 'Month'}</label>
                    <select
                      value={dobMonth || '01'}
                      onChange={(e) => handleDobChange('month', e.target.value)}
                      className="w-full h-10 rounded-lg border border-[#DCE4E0] px-2.5 bg-white text-xs font-medium focus:border-[#065F46] focus:ring-1 focus:ring-[#065F46]"
                    >
                      {monthsList.map((m) => (
                        <option key={m.val} value={m.val}>{m.ur}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5A6D65] mb-1">{lang === 'ur' ? 'دن' : 'Day'}</label>
                    <select
                      value={dobDay || '01'}
                      onChange={(e) => handleDobChange('day', e.target.value)}
                      className="w-full h-10 rounded-lg border border-[#DCE4E0] px-2.5 bg-white text-xs font-mono-code font-medium focus:border-[#065F46] focus:ring-1 focus:ring-[#065F46]"
                    >
                      {daysList.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Mobile / Phone */}
              <div>
                <label className="block text-[#374841] mb-1 font-semibold text-xs">
                  {t('phone')} <span className="text-[#5A6D65] font-normal">({lang === 'ur' ? 'اختیاری' : 'Optional'})</span>
                </label>
                <input
                  type="text"
                  placeholder="03001234567"
                  dir="ltr"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full h-10 rounded-lg border border-[#DCE4E0] px-3 font-mono-code text-xs bg-white focus:border-[#065F46] focus:ring-1 focus:ring-[#065F46]"
                />
              </div>

              {/* Guardian Phone */}
              <div>
                <label className="block text-[#374841] mb-1 font-semibold text-xs">{t('guardianPhone')}</label>
                <input
                  type="text"
                  placeholder="03001234567"
                  dir="ltr"
                  value={form.guardian_phone}
                  onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })}
                  className="w-full h-10 rounded-lg border border-[#DCE4E0] px-3 font-mono-code text-xs bg-white focus:border-[#065F46] focus:ring-1 focus:ring-[#065F46]"
                />
              </div>

              {/* Academic Year with Quick Add Option */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[#374841] font-semibold text-xs">{t('academicYear')}</label>
                  <button
                    type="button"
                    onClick={() => setShowAddYear((o) => !o)}
                    className="text-[11px] text-[#065F46] hover:underline font-bold"
                  >
                    {showAddYear ? (lang === 'ur' ? 'منسوخ' : 'Cancel') : (lang === 'ur' ? '+ نیا سال' : '+ Add Year')}
                  </button>
                </div>
                {showAddYear && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <input
                      type="text"
                      placeholder={lang === 'ur' ? 'مثلاً: 1448-1449ھ' : 'e.g. 2026-2027'}
                      value={newYearTitle}
                      onChange={(e) => setNewYearTitle(e.target.value)}
                      className="w-full h-8 rounded-lg border border-[#065F46] px-2.5 text-xs bg-white"
                    />
                    <button
                      type="button"
                      disabled={savingYear}
                      onClick={handleQuickAddYear}
                      className="h-8 rounded-lg bg-[#065F46] px-2.5 text-xs text-white shrink-0 font-medium hover:bg-[#064E3B]"
                    >
                      {savingYear ? '...' : (lang === 'ur' ? 'شامل کریں' : 'Add')}
                    </button>
                  </div>
                )}
                <select
                  value={form.academic_year_id}
                  onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })}
                  className="w-full h-10 rounded-lg border border-[#DCE4E0] px-3 bg-white text-xs font-medium focus:border-[#065F46] focus:ring-1 focus:ring-[#065F46]"
                >
                  {(lookups?.academicYears || []).map((y: any) => (
                    <option key={y.id} value={y.id}>{pick(y.title_en, y.title_ur)}</option>
                  ))}
                </select>
              </div>

              {/* Class with Quick Add Option */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[#374841] font-semibold text-xs">{t('classLabel')}</label>
                  <button
                    type="button"
                    onClick={() => setShowAddClass((o) => !o)}
                    className="text-[11px] text-[#065F46] hover:underline font-bold"
                  >
                    {showAddClass ? (lang === 'ur' ? 'منسوخ' : 'Cancel') : (lang === 'ur' ? '+ نئی کلاس' : '+ Add Class')}
                  </button>
                </div>
                {showAddClass && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <input
                      type="text"
                      placeholder={lang === 'ur' ? 'مثلاً: درجہ سادسہ / تخصص سال سوم' : 'e.g. Year 3'}
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      className="w-full h-8 rounded-lg border border-[#065F46] px-2.5 text-xs bg-white"
                    />
                    <button
                      type="button"
                      disabled={savingClass}
                      onClick={handleQuickAddClass}
                      className="h-8 rounded-lg bg-[#065F46] px-2.5 text-xs text-white shrink-0 font-medium hover:bg-[#064E3B]"
                    >
                      {savingClass ? '...' : (lang === 'ur' ? 'شامل کریں' : 'Add')}
                    </button>
                  </div>
                )}
                <select
                  value={form.class_id}
                  onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                  className="w-full h-10 rounded-lg border border-[#DCE4E0] px-3 bg-white text-xs font-medium focus:border-[#065F46] focus:ring-1 focus:ring-[#065F46]"
                >
                  {(lookups?.classes || []).map((c: any) => (
                    <option key={c.id} value={c.id}>{pick(c.name_en, c.name_ur)}</option>
                  ))}
                </select>
              </div>

              {/* Batch / Group with Quick Add Option */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[#374841] font-semibold text-xs">{t('batchLabel')}</label>
                  <button
                    type="button"
                    onClick={() => setShowAddBatch((o) => !o)}
                    className="text-[11px] text-[#065F46] hover:underline font-bold"
                  >
                    {showAddBatch ? (lang === 'ur' ? 'منسوخ' : 'Cancel') : (lang === 'ur' ? '+ نیا گروپ' : '+ Add Group')}
                  </button>
                </div>
                {showAddBatch && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <input
                      type="text"
                      placeholder={lang === 'ur' ? 'مثلاً: گروپ الف' : 'e.g. Section A'}
                      value={newBatchName}
                      onChange={(e) => setNewBatchName(e.target.value)}
                      className="w-full h-8 rounded-lg border border-[#065F46] px-2.5 text-xs bg-white"
                    />
                    <button
                      type="button"
                      disabled={savingBatch}
                      onClick={handleQuickAddBatch}
                      className="h-8 rounded-lg bg-[#065F46] px-2.5 text-xs text-white shrink-0 font-medium hover:bg-[#064E3B]"
                    >
                      {savingBatch ? '...' : (lang === 'ur' ? 'شامل کریں' : 'Add')}
                    </button>
                  </div>
                )}
                <select
                  value={form.batch_id}
                  onChange={(e) => setForm({ ...form, batch_id: e.target.value })}
                  className="w-full h-10 rounded-lg border border-[#DCE4E0] px-3 bg-white text-xs font-medium focus:border-[#065F46] focus:ring-1 focus:ring-[#065F46]"
                >
                  <option value="">{lang === 'ur' ? '— تمام / کوئی گروپ نہیں —' : '— None —'}</option>
                  {(lookups?.batches || [])
                    .filter((b: any) => !form.class_id || !b.class_id || b.class_id === form.class_id)
                    .map((b: any) => (
                      <option key={b.id} value={b.id}>{pick(b.name_en, b.name_ur)}</option>
                    ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-[#374841] mb-1 font-semibold text-xs">{t('status')}</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full h-10 rounded-lg border border-[#DCE4E0] px-3 bg-white text-xs font-medium focus:border-[#065F46] focus:ring-1 focus:ring-[#065F46]"
                >
                  <option value="active">{t('active')}</option>
                  <option value="on_leave">{t('on_leave')}</option>
                  <option value="graduated">{t('graduated')}</option>
                  <option value="suspended">{t('suspended')}</option>
                </select>
              </div>

              {/* Admission Date */}
              <div>
                <label className="block text-[#374841] mb-1 font-semibold text-xs">{t('admissionDate')}</label>
                <input
                  type="date"
                  value={form.admission_date}
                  onChange={(e) => setForm({ ...form, admission_date: e.target.value })}
                  className="w-full h-10 rounded-lg border border-[#DCE4E0] px-3 text-xs font-mono-code bg-white focus:border-[#065F46] focus:ring-1 focus:ring-[#065F46]"
                />
              </div>

              {/* Previous Education */}
              <div>
                <label className="block text-[#374841] mb-1 font-semibold text-xs">{t('prevEducation')}</label>
                <input
                  type="text"
                  placeholder={lang === 'ur' ? 'مثلاً: عالمیہ (دورۂ حدیث) وفاق المدارس' : 'e.g. Al-Alimiyyah'}
                  value={form.previous_education_ur || form.previous_education}
                  onChange={(e) => setForm({ ...form, previous_education: e.target.value, previous_education_ur: e.target.value })}
                  className="w-full h-10 rounded-lg border border-[#DCE4E0] px-3 text-xs bg-white focus:border-[#065F46] focus:ring-1 focus:ring-[#065F46]"
                />
              </div>

              {/* Address */}
              <div className="sm:col-span-2">
                <label className="block text-[#374841] mb-1 font-semibold text-xs">{t('address')}</label>
                <input
                  type="text"
                  placeholder={lang === 'ur' ? 'مکمل رہائشی پتہ درج کریں' : 'Full residential address'}
                  value={form.address_ur || form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value, address_ur: e.target.value })}
                  className="w-full h-10 rounded-lg border border-[#DCE4E0] px-3 text-xs bg-white focus:border-[#065F46] focus:ring-1 focus:ring-[#065F46]"
                />
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="px-6 py-3.5 border-t border-[#E5ECE8] bg-[#F9FBFA] shrink-0 flex items-center justify-between gap-3">
            <div className="flex-1 text-xs">
              {formError && (
                <span className="text-red-600 font-bold flex items-center gap-1.5">
                  <span className="h-4 w-4 shrink-0 text-red-600 font-mono font-bold flex items-center justify-center rounded-full bg-red-100 text-[10px]">✕</span>
                  {formError}
                </span>
              )}
              {saveSuccess && (
                <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  {lang === 'ur' ? 'طالب علم کامیابی سے محفوظ ہو گیا!' : 'Student saved successfully!'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={closeModal}
                className="h-9 rounded-lg border border-[#DCE4E0] px-4 font-semibold text-[#374841] hover:bg-gray-100 transition-colors text-xs"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-9 rounded-lg bg-[#065F46] px-5 font-bold text-white hover:bg-[#064E3B] shadow-sm disabled:opacity-60 transition-colors text-xs flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{lang === 'ur' ? 'محفوظ ہو رہا ہے...' : 'Saving...'}</span>
                  </>
                ) : (
                  <span>{t('save')}</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    );
  }

  const safeStudents = Array.isArray(students) ? students : [];
  const safeClasses = Array.isArray(lookups?.classes) ? lookups.classes : [];
  const totalPages = Math.max(1, Math.ceil(safeStudents.length / pageSize));
  const paged = safeStudents.slice((page - 1) * pageSize, page * pageSize);

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="rounded-xl border border-[#DCE4E0] bg-white p-3 sm:p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 flex-1">
          <div className="relative w-full sm:w-72">
            <Search className={`h-4 w-4 text-[#64746D] absolute top-1/2 -translate-y-1/2 ${lang === 'ur' ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={lang === 'ur' ? 'نام، کوڈ، ولدیت یا موبائل نمبر سے تلاش کریں...' : 'Search by name, code or mobile...'}
              className={`w-full rounded-md border border-[#DCE4E0] py-2 text-xs ${lang === 'ur' ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
            />
          </div>

          <select
            value={classFilter}
            onChange={(e) => { setClassFilter(e.target.value); setPage(1); }}
            className="flex-1 sm:flex-none rounded-md border border-[#DCE4E0] px-3 py-2 text-xs bg-white min-w-[130px] font-medium"
          >
            <option value="">{t('allClasses')}</option>
            {safeClasses.map((c: any) => (
              <option key={c.id} value={c.id}>{pick(c.name_en, c.name_ur)}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="flex-1 sm:flex-none rounded-md border border-[#DCE4E0] px-3 py-2 text-xs bg-white min-w-[130px] font-medium"
          >
            <option value="">{t('allStatuses')}</option>
            <option value="active">{t('active')}</option>
            <option value="on_leave">{t('on_leave')}</option>
            <option value="graduated">{t('graduated')}</option>
          </select>
        </div>

        {canManageStudents && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[#065F46] px-4 py-2 text-xs font-semibold text-white hover:bg-[#064E3B] shadow-sm whitespace-nowrap shrink-0 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            <span>{t('addStudent')}</span>
          </button>
        )}
      </div>

      {/* Students Table */}
      <div className="rounded-xl border border-[#DCE4E0] bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[720px]">
            <thead>
              <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('studentId')}</th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap min-w-[140px]">{lang === 'ur' ? 'مکمل نام' : 'Full Name'}</th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap min-w-[120px]">{lang === 'ur' ? 'ولدیت' : "Father's Name"}</th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('classLabel')}</th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('phone')}</th>
                <th className="px-4 py-3 text-end font-medium whitespace-nowrap">{t('attendancePct')}</th>
                <th className="px-4 py-3 text-start font-medium whitespace-nowrap">{t('status')}</th>
                <th className="px-4 py-3 text-end font-medium whitespace-nowrap">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F0]">
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center text-[#5A6D65]">{t('loading')}</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-[#5A6D65]">{t('noData')}</td></tr>
              ) : (
                paged.map((st) => {
                  const pct = st.att_total > 0 ? Math.round((st.att_present / st.att_total) * 100) : 0;
                  return (
                    <tr
                      key={st.id}
                      onClick={() => setSelectedStudentId(st.id)}
                      className="hover:bg-[#F6F8F7] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono-code font-bold text-[#065F46] whitespace-nowrap">{st.student_code}</td>
                      <td className="px-4 py-3 font-semibold text-[#111C18] whitespace-nowrap min-w-[140px]">{pick(st.full_name, st.full_name_ur)}</td>
                      <td className="px-4 py-3 text-[#4A5D55] whitespace-nowrap min-w-[120px]">{pick(st.father_name, st.father_name_ur)}</td>
                      <td className="px-4 py-3 text-[#4A5D55] whitespace-nowrap">{pick(st.class_name_en, st.class_name_ur)}</td>
                      <td className="px-4 py-3 font-mono-code text-[#4A5D55] whitespace-nowrap" dir="ltr">{formatPakistaniMobile(st.phone)}</td>
                      <td className="px-4 py-3 text-end font-semibold tabular-nums text-[#065F46] whitespace-nowrap">{pct}%</td>
                      <td className="px-4 py-3 whitespace-nowrap"><StatusText status={st.status} /></td>
                      <td className="px-4 py-3 text-end whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          {canManageStudents && (
                            <button
                              type="button"
                              onClick={() => openEdit(st)}
                              className="p-1.5 text-[#065F46] hover:bg-[#065F46]/10 rounded"
                              aria-label="Edit student"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canDeleteStudents && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(st)}
                              className="p-1.5 text-red-700 hover:bg-red-50 rounded"
                              aria-label="Delete student"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-[#E5ECE8] flex items-center justify-between text-xs text-[#5A6D65]">
          <span className="tabular-nums font-medium">
            {safeStudents.length} {lang === 'ur' ? 'طلبہ' : 'students'} · {page} / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-[#DCE4E0] px-3 py-1 disabled:opacity-40 hover:bg-[#F6F8F7] font-medium"
            >
              {lang === 'ur' ? 'پچھلا' : 'Prev'}
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-[#DCE4E0] px-3 py-1 disabled:opacity-40 hover:bg-[#F6F8F7] font-medium"
            >
              {lang === 'ur' ? 'اگلا' : 'Next'}
            </button>
          </div>
        </div>
      </div>

      {modalOpen && renderModal()}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('delete')}
        message={t('deleteStudentConfirm')}
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
