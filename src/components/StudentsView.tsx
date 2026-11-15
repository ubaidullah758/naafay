import React, { useEffect, useState } from 'react';
import { Plus, Search, Trash2, Edit, X, Upload } from 'lucide-react';
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

  const emptyForm = {
    full_name: '',
    full_name_ur: '',
    father_name: '',
    father_name_ur: '',
    date_of_birth: '',
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
    // Typing in the search box used to fire one request per keystroke and let
    // older responses overwrite newer ones. Debounce + abort keeps it clean.
    const controller = new AbortController();
    const timer = setTimeout(() => {
      loadData(controller.signal);
    }, search ? 250 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, classFilter, statusFilter, user?.role]);

  const openAdd = () => {
    setEditingStudent(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (st: any) => {
    setEditingStudent(st);
    setForm({
      full_name: st.full_name || '',
      full_name_ur: st.full_name_ur || '',
      father_name: st.father_name || '',
      father_name_ur: st.father_name_ur || '',
      date_of_birth: st.date_of_birth || '',
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
      academic_year_id: st.academic_year_id || 'ay-1447',
      class_id: st.class_id || 'cls-tak1',
      batch_id: st.batch_id || '',
      status: st.status || 'active',
      photo_url: st.photo_url || '',
    });
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.father_name.trim() || !form.phone.trim()) {
      setFormError(lang === 'ur' ? 'نام، ولدیت اور فون نمبر لازمی ہیں' : 'Name, father name, and phone are required');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        ...form,
        phone: formatPakistaniMobile(form.phone),
        guardian_phone: formatPakistaniMobile(form.guardian_phone),
      };
      if (editingStudent) {
        await apiFetch(`/api/students/${editingStudent.id}`, { method: 'PUT', body: JSON.stringify(payload) }, user);
      } else {
        await apiFetch('/api/students', { method: 'POST', body: JSON.stringify(payload) }, user);
      }
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message);
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
        onClose={() => setModalOpen(false)}
        labelledBy="student-modal-title"
        panelClassName="w-full max-w-2xl rounded-lg border border-[#DCE4E0] bg-white shadow-xl my-4 sm:my-8 max-h-[90vh] overflow-y-auto"
      >
        <div className="px-6 py-4 border-b border-[#E5ECE8] flex items-center justify-between">
          <h3 id="student-modal-title" className="text-base font-bold text-[#111C18]">
            {editingStudent ? t('editStudent') : t('addStudent')}
          </h3>
          <button type="button" onClick={() => setModalOpen(false)} aria-label={t('cancel')} className="p-1 text-[#5A6D65] hover:text-[#111C18]">
            <X className="h-5 w-5" />
          </button>
        </div>

          <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
            {formError && <div className="rounded bg-red-50 p-3 text-red-700">{formError}</div>}

            <div className="flex items-center gap-4 pb-2 border-b border-[#EEF2F0]">
              {form.photo_url ? (
                <img src={form.photo_url} alt="Student" referrerPolicy="no-referrer" className="h-14 w-14 rounded-md object-cover border border-[#DCE4E0]" />
              ) : (
                <div className="h-14 w-14 rounded-md bg-[#F6F8F7] border border-[#DCE4E0] flex items-center justify-center text-[#5A6D65]">
                  {editingStudent ? editingStudent.student_code : 'ST-AUTO'}
                </div>
              )}
              <label className="inline-flex items-center gap-2 rounded-md border border-[#DCE4E0] px-3 py-2 font-medium text-[#111C18] hover:bg-[#F6F8F7] cursor-pointer">
                <Upload className="h-3.5 w-3.5 text-[#065F46]" />
                <span>{t('photoLabel')}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('fullName')} *</label>
                <input type="text" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('fullNameUr')}</label>
                <input type="text" value={form.full_name_ur} onChange={(e) => setForm({ ...form, full_name_ur: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('fatherName')} *</label>
                <input type="text" required value={form.father_name} onChange={(e) => setForm({ ...form, father_name: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('fatherNameUr')}</label>
                <input type="text" value={form.father_name_ur} onChange={(e) => setForm({ ...form, father_name_ur: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('dob')}</label>
                <input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('phone')} *</label>
                <input
                  type="text"
                  required
                  placeholder="03001234567"
                  dir="ltr"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 font-mono-code"
                />
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('guardianName')}</label>
                <input type="text" value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('guardianPhone')}</label>
                <input
                  type="text"
                  placeholder="03001234567"
                  dir="ltr"
                  value={form.guardian_phone}
                  onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })}
                  className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 font-mono-code"
                />
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('academicYear')}</label>
                <select value={form.academic_year_id} onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                  {(lookups?.academicYears || []).map((y: any) => (
                    <option key={y.id} value={y.id}>{pick(y.title_en, y.title_ur)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('classLabel')}</label>
                <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                  {(lookups?.classes || []).map((c: any) => (
                    <option key={c.id} value={c.id}>{pick(c.name_en, c.name_ur)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('batchLabel')}</label>
                <select value={form.batch_id} onChange={(e) => setForm({ ...form, batch_id: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                  <option value="">—</option>
                  {(lookups?.batches || [])
                    .filter((b: any) => !form.class_id || b.class_id === form.class_id)
                    .map((b: any) => (
                      <option key={b.id} value={b.id}>{pick(b.name_en, b.name_ur)}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('status')}</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2 bg-white">
                  <option value="active">{t('active')}</option>
                  <option value="on_leave">{t('on_leave')}</option>
                  <option value="graduated">{t('graduated')}</option>
                  <option value="suspended">{t('suspended')}</option>
                </select>
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('admissionDate')}</label>
                <input type="date" value={form.admission_date} onChange={(e) => setForm({ ...form, admission_date: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
              </div>
              <div>
                <label className="block text-[#5A6D65] mb-1">{t('prevEducation')}</label>
                <input type="text" value={form.previous_education_ur || form.previous_education} onChange={(e) => setForm({ ...form, previous_education: e.target.value, previous_education_ur: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[#5A6D65] mb-1">{t('address')}</label>
                <input type="text" value={form.address_ur || form.address} onChange={(e) => setForm({ ...form, address: e.target.value, address_ur: e.target.value })} className="w-full rounded-md border border-[#DCE4E0] px-3 py-2" />
              </div>
            </div>

            <div className="pt-4 border-t border-[#E5ECE8] flex items-center justify-end gap-3">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-[#DCE4E0] px-4 py-2 font-medium text-[#374841]">
                {t('cancel')}
              </button>
              <button type="submit" disabled={saving} className="rounded-md bg-[#065F46] px-5 py-2 font-medium text-white hover:bg-[#064E3B] disabled:opacity-60">
                {saving ? t('loading') : t('save')}
              </button>
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
      <div className="rounded-lg border border-[#DCE4E0] bg-white p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 flex-1">
          <div className="relative w-full sm:w-72">
            <Search className={`h-4 w-4 text-[#64746D] absolute top-1/2 -translate-y-1/2 ${lang === 'ur' ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={lang === 'ur' ? 'نام، کوڈ، ولدیت یا موبائل نمبر (03001234567) سے تلاش کریں...' : 'Search by name, code, father or mobile (03001234567)...'}
              className={`w-full rounded-md border border-[#DCE4E0] py-2 text-xs ${lang === 'ur' ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
            />
          </div>

          <select
            value={classFilter}
            onChange={(e) => { setClassFilter(e.target.value); setPage(1); }}
            className="flex-1 sm:flex-none rounded-md border border-[#DCE4E0] px-3 py-2 text-xs bg-white min-w-[130px]"
          >
            <option value="">{t('allClasses')}</option>
            {safeClasses.map((c: any) => (
              <option key={c.id} value={c.id}>{pick(c.name_en, c.name_ur)}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="flex-1 sm:flex-none rounded-md border border-[#DCE4E0] px-3 py-2 text-xs bg-white min-w-[130px]"
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
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[#065F46] px-4 py-2 text-xs font-medium text-white hover:bg-[#064E3B] whitespace-nowrap shrink-0 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            <span>{t('addStudent')}</span>
          </button>
        )}
      </div>

      {/* Students Table */}
      <div className="rounded-lg border border-[#DCE4E0] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#E5ECE8] bg-[#F6F8F7] text-[#5A6D65]">
                <th className="px-4 py-3 text-start font-medium">{t('studentId')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('fullNameUr')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('fatherNameUr')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('classLabel')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('phone')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('attendancePct')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('status')}</th>
                <th className="px-4 py-3 text-end font-medium">{t('actions')}</th>
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
                      <td className="px-4 py-3 font-mono-code font-semibold text-[#065F46]">{st.student_code}</td>
                      <td className="px-4 py-3 font-medium text-[#111C18]">{pick(st.full_name, st.full_name_ur)}</td>
                      <td className="px-4 py-3 text-[#4A5D55]">{pick(st.father_name, st.father_name_ur)}</td>
                      <td className="px-4 py-3 text-[#4A5D55]">{pick(st.class_name_en, st.class_name_ur)}</td>
                      <td className="px-4 py-3 font-mono-code text-[#4A5D55]" dir="ltr">{formatPakistaniMobile(st.phone)}</td>
                      <td className="px-4 py-3 text-end font-semibold tabular-nums text-[#065F46]">{pct}%</td>
                      <td className="px-4 py-3"><StatusText status={st.status} /></td>
                      <td className="px-4 py-3 text-end" onClick={(e) => e.stopPropagation()}>
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
          <span className="tabular-nums">
            {safeStudents.length} {lang === 'ur' ? 'طلبہ' : 'students'} · {page} / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-[#DCE4E0] px-3 py-1 disabled:opacity-40 hover:bg-[#F6F8F7]"
            >
              {lang === 'ur' ? 'پچھلا' : 'Prev'}
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-[#DCE4E0] px-3 py-1 disabled:opacity-40 hover:bg-[#F6F8F7]"
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
