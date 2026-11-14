import React, { useEffect, useState } from 'react';
import {
  FileQuestion,
  FolderCog,
  Lock,
  Plus,
  Search,
  Upload,
  X,
  Check,
  Edit2,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, fileToDataUrl } from '../../lib/api';
import { todayLocal } from '../../lib/date';
import { ErrorState } from '../ErrorState';
import { Modal } from '../Modal';
import { StatusText } from '../StatusText';
import { FatwaWorkspaceView } from './FatwaWorkspaceView';

interface FatwaQuestionsViewProps {
  initialFatwaId?: string;
}

export const FatwaQuestionsView: React.FC<FatwaQuestionsViewProps> = ({ initialFatwaId }) => {
  const { lang, t, pick } = useLanguage();
  const { user, canRegisterFatwa, canManageCategories } = useAuth();

  const [selectedFatwaId, setSelectedFatwaId] = useState<string | null>(initialFatwaId || null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Registration Form
  const [regForm, setRegForm] = useState({
    question_date: todayLocal(),
    questioner_name: '',
    questioner_phone: '',
    questioner_email: '',
    city: '',
    country: 'Pakistan',
    category_id: '',
    subject_title: '',
    subject_title_ur: '',
    question_text: '',
    source: 'office',
    is_identity_private: true,
    attachments: [] as Array<{ fileName: string; fileUrl: string; mimeType: string; size: number }>,
  });

  // Categories management state
  const [newCat, setNewCat] = useState({ name_en: '', name_ur: '', name_ar: '' });
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatForm, setEditCatForm] = useState({ name_en: '', name_ur: '', name_ar: '' });

  useEffect(() => {
    if (initialFatwaId) setSelectedFatwaId(initialFatwaId);
  }, [initialFatwaId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('search', search.trim());
      if (categoryFilter) qs.set('categoryId', categoryFilter);
      if (statusFilter) qs.set('status', statusFilter);

      const [dash, cats] = await Promise.all([
        apiFetch(`/api/fatwa/dashboard?${qs.toString()}`, {}, user),
        apiFetch('/api/fatwa/categories', {}, user),
      ]);
      setQuestions(dash?.questions || []);
      const categoryList = Array.isArray(cats) ? cats : Array.isArray(cats?.categories) ? cats.categories : [];
      setCategories(categoryList);
      if (!regForm.category_id && categoryList?.length > 0) {
        setRegForm((f) => ({ ...f, category_id: categoryList[0].id }));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load fatwa questions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadData, 160);
    return () => clearTimeout(timer);
  }, [user?.role, user?.profileId, search, categoryFilter, statusFilter]);

  const handleAttachmentPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      const uploaded = await apiFetch('/api/uploads', {
        method: 'POST',
        body: JSON.stringify({ fileName: file.name, dataUrl }),
      }, user);
      setRegForm((f) => ({
        ...f,
        attachments: [...f.attachments, uploaded],
      }));
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleRegisterQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await apiFetch(
        '/api/fatwa/questions',
        {
          method: 'POST',
          body: JSON.stringify({
            ...regForm,
            subject_title: regForm.subject_title || regForm.subject_title_ur,
            subject_title_ur: regForm.subject_title_ur || regForm.subject_title,
          }),
        },
        user
      );
      setRegModalOpen(false);
      setRegForm({
        question_date: todayLocal(),
        questioner_name: '',
        questioner_phone: '',
        questioner_email: '',
        city: '',
        country: 'Pakistan',
        category_id: categories[0]?.id || '',
        subject_title: '',
        subject_title_ur: '',
        question_text: '',
        source: 'office',
        is_identity_private: true,
        attachments: [],
      });
      await loadData();
      if (created?.id) setSelectedFatwaId(created.id);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.name_en.trim() || !newCat.name_ur.trim()) return;
    try {
      await apiFetch('/api/fatwa/categories', {
        method: 'POST',
        body: JSON.stringify(newCat),
      }, user);
      setNewCat({ name_en: '', name_ur: '', name_ar: '' });
      await loadData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleUpdateCategory = async (catId: string, overrides?: any) => {
    try {
      await apiFetch(
        `/api/fatwa/categories/${catId}`,
        {
          method: 'PUT',
          body: JSON.stringify(overrides || editCatForm),
        },
        user
      );
      setEditingCatId(null);
      await loadData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  if (selectedFatwaId) {
    return (
      <FatwaWorkspaceView
        fatwaId={selectedFatwaId}
        onBack={() => {
          setSelectedFatwaId(null);
          loadData();
        }}
      />
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-5">
      {/* Header Toolbar */}
      <div className="rounded-lg border border-[#D9E2EC] bg-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#0B2545]">{t('navFatwaQuestions')}</h2>
          <p className="text-xs text-[#486581] mt-0.5">
            {lang === 'ur'
              ? 'استفتاء کا اندراج، تفویض، تحقیق و تخریج، مسودہ نویسی، مفتیِ اعظم کا جائزہ، اور حتمی اجراء'
              : 'Question intake, assignment, research workspace, Urdu/Arabic drafting, and multi-stage Fatwa approval'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canManageCategories && (
            <button
              type="button"
              onClick={() => setCatModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#D9E2EC] bg-white px-3.5 py-2 text-xs font-medium text-[#0B2545] hover:bg-[#F4F7FA] whitespace-nowrap"
            >
              <FolderCog className="h-4 w-4 text-[#0284C7]" />
              <span>{t('manageCategories')}</span>
            </button>
          )}
          {canRegisterFatwa && (
            <button
              type="button"
              onClick={() => setRegModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#057A4B] px-4 py-2 text-xs font-medium text-white hover:bg-[#04643D] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>{t('registerQuestion')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-[#D9E2EC] bg-white p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2 relative">
          <Search className={`h-4 w-4 text-[#627D98] absolute top-1/2 -translate-y-1/2 ${lang === 'ur' ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === 'ur' ? 'فتویٰ کوڈ یا عنوان سے تلاش کریں...' : 'Search by FAT code or subject...'}
            className={`w-full rounded-md border border-[#D9E2EC] bg-[#F4F7FA] py-2 text-xs text-[#0F1F38] ${
              lang === 'ur' ? 'pr-9 pl-3' : 'pl-9 pr-3'
            }`}
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-[#D9E2EC] px-3 py-2 text-xs text-[#0F1F38]"
        >
          <option value="">{t('fatwaCategory')} — {t('allStatuses')}</option>
          {categories.filter((c) => c.is_active).map((cat) => (
            <option key={cat.id} value={cat.id}>
              {pick(cat.name_en, cat.name_ur)}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-[#D9E2EC] px-3 py-2 text-xs text-[#0F1F38]"
        >
          <option value="">{t('status')} — {t('allStatuses')}</option>
          {['registered', 'assigned', 'research', 'draft', 'senior_review', 'final_approval', 'issued'].map((st) => (
            <option key={st} value={st}>
              {t(st as any)}
            </option>
          ))}
        </select>
      </div>

      {/* Questions Table */}
      <div className="rounded-lg border border-[#D9E2EC] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#F4F7FA] border-b border-[#D9E2EC] text-[#486581]">
              <tr>
                <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('fatwaId')}</th>
                <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('questionDate')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('questionSubject')}</th>
                <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('fatwaCategory')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('assignResearcher')}</th>
                <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('status')}</th>
                <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF2F7]">
              {questions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[#627D98]">
                    {loading ? t('loading') : t('noData')}
                  </td>
                </tr>
              ) : (
                questions.map((q) => (
                  <tr
                    key={q.id}
                    onClick={() => setSelectedFatwaId(q.id)}
                    className="hover:bg-[#F4F7FA] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3.5 align-top whitespace-nowrap">
                      <div className="font-mono-code font-semibold text-[#0B2545]">{q.fatwa_code}</div>
                      {q.issued_fatwa_number && (
                        <div className="font-mono-code text-[11px] text-[#057A4B]">{q.issued_fatwa_number}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-top font-mono-code text-[#486581] whitespace-nowrap">
                      {q.question_date}
                    </td>
                    <td className="px-4 py-3.5 align-top min-w-[240px]">
                      <div className="font-semibold text-[#0F1F38]">{pick(q.subject_title, q.subject_title_ur)}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#627D98]">
                        <span>{q.questioner_name}</span>
                        {q.is_identity_private ? <Lock className="h-3 w-3 text-[#0B2545]" /> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-top whitespace-nowrap text-[#243B53]">
                      {pick(q.category_name_en, q.category_name_ur)}
                    </td>
                    <td className="px-4 py-3.5 align-top text-[#243B53]">
                      {pick(q.assignees_en, q.assignees_ur) || '—'}
                    </td>
                    <td className="px-4 py-3.5 align-top whitespace-nowrap">
                      <StatusText status={q.workflow_status} />
                    </td>
                    <td className="px-4 py-3.5 align-top whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFatwaId(q.id);
                        }}
                        className="rounded border border-[#0284C7] px-2.5 py-1 text-[11px] font-medium text-[#0284C7] hover:bg-[#0284C7] hover:text-white"
                      >
                        {lang === 'ur' ? 'ورک اسپیس کھولیں' : 'Open Workspace'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Question Modal */}
      <Modal
        open={regModalOpen}
        onClose={() => setRegModalOpen(false)}
        labelledBy="register-question-title"
        panelClassName="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-lg border border-[#D9E2EC] bg-white shadow-xl"
      >
            <div className="flex items-center justify-between border-b border-[#D9E2EC] px-5 py-4">
              <div className="flex items-center gap-2">
                <FileQuestion className="h-4 w-4 text-[#057A4B]" />
                <h3 id="register-question-title" className="text-sm font-bold text-[#0B2545]">{t('registerQuestion')}</h3>
              </div>
              <button type="button" onClick={() => setRegModalOpen(false)} aria-label={t('cancel')} className="p-1 text-[#627D98] hover:text-[#0B2545]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterQuestion} className="p-5 space-y-4 text-xs">
              {formError && <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700">{formError}</div>}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-[#486581] mb-1">{t('questionDate')}</label>
                  <input
                    type="date"
                    required
                    value={regForm.question_date}
                    onChange={(e) => setRegForm((f) => ({ ...f, question_date: e.target.value }))}
                    className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 font-mono-code"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#486581] mb-1">{t('fatwaCategory')} *</label>
                  <select
                    required
                    value={regForm.category_id}
                    onChange={(e) => setRegForm((f) => ({ ...f, category_id: e.target.value }))}
                    className="w-full rounded-md border border-[#D9E2EC] px-3 py-2"
                  >
                    {categories.filter((c) => c.is_active).map((c) => (
                      <option key={c.id} value={c.id}>
                        {pick(c.name_en, c.name_ur)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-[#486581] mb-1">{t('questionSource')}</label>
                  <select
                    value={regForm.source}
                    onChange={(e) => setRegForm((f) => ({ ...f, source: e.target.value }))}
                    className="w-full rounded-md border border-[#D9E2EC] px-3 py-2"
                  >
                    <option value="office">{lang === 'ur' ? 'دفترِ دارالافتاء' : 'Office Desk'}</option>
                    <option value="public_portal">{lang === 'ur' ? 'پبلک پورٹل' : 'Public Portal'}</option>
                    <option value="whatsapp">{lang === 'ur' ? 'واٹس ایپ' : 'WhatsApp'}</option>
                    <option value="email">{lang === 'ur' ? 'ای میل' : 'Email'}</option>
                    <option value="walk_in">{lang === 'ur' ? 'بالکل بالمُشافہ' : 'Walk-In'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-[#486581] mb-1">{t('questionerName')} *</label>
                  <input
                    required
                    type="text"
                    value={regForm.questioner_name}
                    onChange={(e) => setRegForm((f) => ({ ...f, questioner_name: e.target.value }))}
                    className="w-full rounded-md border border-[#D9E2EC] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#486581] mb-1">{t('phone')}</label>
                  <input
                    type="text"
                    value={regForm.questioner_phone}
                    onChange={(e) => setRegForm((f) => ({ ...f, questioner_phone: e.target.value }))}
                    className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 font-mono-code"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#486581] mb-1">{t('email')}</label>
                  <input
                    type="email"
                    value={regForm.questioner_email}
                    onChange={(e) => setRegForm((f) => ({ ...f, questioner_email: e.target.value }))}
                    className="w-full rounded-md border border-[#D9E2EC] px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#486581] mb-1">{lang === 'ur' ? 'شہر' : 'City'}</label>
                  <input
                    type="text"
                    value={regForm.city}
                    onChange={(e) => setRegForm((f) => ({ ...f, city: e.target.value }))}
                    className="w-full rounded-md border border-[#D9E2EC] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#486581] mb-1">{lang === 'ur' ? 'ملک' : 'Country'}</label>
                  <input
                    type="text"
                    value={regForm.country}
                    onChange={(e) => setRegForm((f) => ({ ...f, country: e.target.value }))}
                    className="w-full rounded-md border border-[#D9E2EC] px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#486581] mb-1">
                    {lang === 'ur' ? 'موضوع / عنوان (اردو) *' : 'Subject Title (Urdu)'}
                  </label>
                  <input
                    type="text"
                    required
                    value={regForm.subject_title_ur}
                    onChange={(e) => setRegForm((f) => ({ ...f, subject_title_ur: e.target.value }))}
                    className="w-full rounded-md border border-[#D9E2EC] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#486581] mb-1">
                    {lang === 'ur' ? 'موضوع / عنوان (انگریزی)' : 'Subject Title (English)'}
                  </label>
                  <input
                    type="text"
                    value={regForm.subject_title}
                    onChange={(e) => setRegForm((f) => ({ ...f, subject_title: e.target.value }))}
                    className="w-full rounded-md border border-[#D9E2EC] px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#486581] mb-1">{t('questionText')} *</label>
                <textarea
                  required
                  rows={5}
                  value={regForm.question_text}
                  onChange={(e) => setRegForm((f) => ({ ...f, question_text: e.target.value }))}
                  className="w-full rounded-md border border-[#D9E2EC] px-3 py-2"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#D9E2EC] bg-[#F4F7FA] p-3">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={regForm.is_identity_private}
                    onChange={(e) => setRegForm((f) => ({ ...f, is_identity_private: e.target.checked }))}
                    className="rounded border-[#D9E2EC] text-[#057A4B]"
                  />
                  <span className="font-medium text-[#0B2545]">{t('privacyPrivate')}</span>
                </label>

                <label className="cursor-pointer inline-flex items-center gap-1.5 rounded border border-[#D9E2EC] bg-white px-3 py-1.5 font-medium text-[#0B2545] hover:bg-[#E2E8F0]">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{t('uploadDocument')}</span>
                  <input type="file" onChange={handleAttachmentPick} className="hidden" />
                </label>
              </div>

              {regForm.attachments.length > 0 && (
                <div className="text-[11px] text-[#057A4B]">
                  {regForm.attachments.map((a) => a.fileName).join(', ')}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EDF2F7]">
                <button
                  type="button"
                  onClick={() => setRegModalOpen(false)}
                  className="rounded-md border border-[#D9E2EC] px-4 py-2 font-medium text-[#486581]"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-[#057A4B] px-5 py-2 font-medium text-white hover:bg-[#04643D] disabled:opacity-60"
                >
                  {submitting ? t('loading') : t('save')}
                </button>
              </div>
            </form>
      </Modal>

      {/* Categories Management Modal (Admin) */}
      <Modal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        labelledBy="manage-categories-title"
        panelClassName="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-[#D9E2EC] bg-white shadow-xl"
      >
            <div className="flex items-center justify-between border-b border-[#D9E2EC] px-5 py-4">
              <h3 id="manage-categories-title" className="text-sm font-bold text-[#0B2545]">{t('manageCategories')}</h3>
              <button type="button" onClick={() => setCatModalOpen(false)} aria-label={t('cancel')} className="p-1 text-[#627D98] hover:text-[#0B2545]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 text-xs">
              <form onSubmit={handleCreateCategory} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end rounded-md border border-[#D9E2EC] bg-[#F4F7FA] p-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#486581] mb-1">Urdu Name *</label>
                  <input
                    required
                    type="text"
                    value={newCat.name_ur}
                    onChange={(e) => setNewCat((c) => ({ ...c, name_ur: e.target.value }))}
                    placeholder="وقف و مساجد"
                    className="w-full rounded border border-[#D9E2EC] bg-white px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#486581] mb-1">English Name *</label>
                  <input
                    required
                    type="text"
                    value={newCat.name_en}
                    onChange={(e) => setNewCat((c) => ({ ...c, name_en: e.target.value }))}
                    placeholder="Waqf & Mosques"
                    className="w-full rounded border border-[#D9E2EC] bg-white px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#486581] mb-1">Arabic</label>
                  <input
                    type="text"
                    dir="rtl"
                    value={newCat.name_ar}
                    onChange={(e) => setNewCat((c) => ({ ...c, name_ar: e.target.value }))}
                    placeholder="الوقف والمساجد"
                    className="w-full rounded border border-[#D9E2EC] bg-white px-2.5 py-1.5 font-arabic"
                  />
                </div>
                <button type="submit" className="rounded bg-[#057A4B] px-3 py-2 font-medium text-white hover:bg-[#04643D]">
                  {t('add')}
                </button>
              </form>

              <div className="divide-y divide-[#EDF2F7] border border-[#D9E2EC] rounded-md">
                {categories.map((cat) => (
                  <div key={cat.id} className="p-3 flex flex-wrap items-center justify-between gap-2">
                    {editingCatId === cat.id ? (
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={editCatForm.name_ur}
                          onChange={(e) => setEditCatForm((f) => ({ ...f, name_ur: e.target.value }))}
                          className="rounded border border-[#D9E2EC] px-2 py-1"
                        />
                        <input
                          type="text"
                          value={editCatForm.name_en}
                          onChange={(e) => setEditCatForm((f) => ({ ...f, name_en: e.target.value }))}
                          className="rounded border border-[#D9E2EC] px-2 py-1"
                        />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateCategory(cat.id)}
                            className="rounded bg-[#057A4B] px-2.5 py-1 text-white"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCatId(null)}
                            className="rounded border border-[#D9E2EC] px-2 py-1"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="font-semibold text-[#0B2545]">
                            {cat.name_ur} <span className="text-[#627D98] font-normal">({cat.name_en})</span>
                          </div>
                          {cat.name_ar && <div className="font-arabic text-[#486581]">{cat.name_ar}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCatId(cat.id);
                              setEditCatForm({
                                name_en: cat.name_en,
                                name_ur: cat.name_ur,
                                name_ar: cat.name_ar || '',
                              });
                            }}
                            className="p-1.5 text-[#0284C7] hover:bg-[#F4F7FA] rounded"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateCategory(cat.id, { is_active: !cat.is_active })}
                            className={`rounded px-2.5 py-1 text-[11px] font-medium border ${
                              cat.is_active
                                ? 'border-[#057A4B]/30 text-[#057A4B]'
                                : 'border-red-200 text-red-700'
                            }`}
                          >
                            {cat.is_active ? t('active') : t('suspended')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
      </Modal>
    </div>
  );
};
