import React, { useEffect, useState } from 'react';
import { Archive, Download, FileSpreadsheet, Globe, Search } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { ErrorState } from '../ErrorState';
import { exportToExcel, exportToPdf } from '../../lib/exports';
import { StatusText } from '../StatusText';
import { NavSection } from '../Layout';

interface FatwaArchiveViewProps {
  onNavigate: (section: NavSection, payload?: { fatwaId?: string }) => void;
}

export const FatwaArchiveView: React.FC<FatwaArchiveViewProps> = ({ onNavigate }) => {
  const { lang, t, pick } = useLanguage();
  const { user } = useAuth();

  const [rows, setRows] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [workflowStatus, setWorkflowStatus] = useState('');
  const [publicationStatus, setPublicationStatus] = useState('');

  useEffect(() => {
    apiFetch('/api/fatwa/categories', {}, user)
      .then((res) => setCategories(res || []))
      .catch(() => {});
  }, [user?.profileId]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (search.trim()) qs.set('search', search.trim());
        if (categoryId) qs.set('categoryId', categoryId);
        if (workflowStatus) qs.set('workflowStatus', workflowStatus);
        if (publicationStatus) qs.set('publicationStatus', publicationStatus);
        const res = await apiFetch(`/api/fatwa/archive?${qs.toString()}`, {}, user);
        setRows(res || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load the fatwa archive');
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [user?.role, user?.profileId, search, categoryId, workflowStatus, publicationStatus]);

  const handleExportExcel = () => {
    exportToExcel(
      'naafay-fatwa-archive',
      'Fatwa Archive',
      rows.map((r) => ({
        'Fatwa ID': r.fatwa_code,
        'Issued Fatwa No': r.issued_fatwa_number || 'Pending',
        Date: r.issued_at || r.question_date,
        'Subject (Urdu)': r.subject_title_ur,
        'Subject (English)': r.subject_title,
        Category: pick(r.category_name_en, r.category_name_ur),
        Researchers: pick(r.researcher_names_ur, r.researcher_names_ur) || '',
        'Senior Reviewer': r.reviewer_name || '',
        Approver: r.approver_name || '',
        'Workflow Status': r.workflow_status,
        'Publication Status': r.publication_status,
      }))
    );
  };

  const handleExportPdf = () => {
    exportToPdf(
      'naafay-fatwa-archive',
      'Naafay Dar-ul-Ifta — Fatwa Archive Register',
      `Exported ${rows.length} records`,
      ['Fatwa ID', 'Issued No.', 'Date', 'Category', 'Subject', 'Status', 'Publication'],
      rows.map((r) => [
        r.fatwa_code,
        r.issued_fatwa_number || '-',
        r.issued_at || r.question_date,
        r.category_name_en,
        r.subject_title,
        r.workflow_status,
        r.publication_status,
      ])
    );
  };

  if (error) {
    return <ErrorState message={error} onRetry={() => setError(null)} />;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#D9E2EC] bg-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-[#0B2545] text-white flex items-center justify-center shrink-0">
            <Archive className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#0B2545]">{t('navFatwaArchive')}</h2>
            <p className="text-xs text-[#486581]">
              {lang === 'ur'
                ? 'جاری شدہ اور محفوظ شدہ فتاویٰ کا مکمل قابلِ تلاش آرکائیو'
                : 'Searchable archive of issued, approved, and internal Fatwa records'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#057A4B] bg-white px-3.5 py-2 text-xs font-medium text-[#057A4B] hover:bg-[#057A4B]/5 whitespace-nowrap"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>{t('exportExcel')}</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0B2545] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#103563] whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            <span>{t('exportPdf')}</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-[#D9E2EC] bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className={`h-4 w-4 text-[#627D98] absolute top-1/2 -translate-y-1/2 ${lang === 'ur' ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === 'ur' ? 'فتویٰ نمبر یا موضوع تلاش کریں...' : 'Search Fatwa No. or topic...'}
            className={`w-full rounded-md border border-[#D9E2EC] bg-[#F4F7FA] py-2 text-xs ${
              lang === 'ur' ? 'pr-9 pl-3' : 'pl-9 pr-3'
            }`}
          />
        </div>

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-md border border-[#D9E2EC] px-3 py-2 text-xs"
        >
          <option value="">{t('fatwaCategory')} — {t('allStatuses')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{pick(c.name_en, c.name_ur)}</option>
          ))}
        </select>

        <select
          value={workflowStatus}
          onChange={(e) => setWorkflowStatus(e.target.value)}
          className="rounded-md border border-[#D9E2EC] px-3 py-2 text-xs"
        >
          <option value="">{t('status')} — {t('allStatuses')}</option>
          <option value="issued">{t('issued')}</option>
          <option value="final_approval">{t('final_approval')}</option>
          <option value="senior_review">{t('senior_review')}</option>
          <option value="draft">{t('draft')}</option>
          <option value="research">{t('research')}</option>
        </select>

        <select
          value={publicationStatus}
          onChange={(e) => setPublicationStatus(e.target.value)}
          className="rounded-md border border-[#D9E2EC] px-3 py-2 text-xs"
        >
          <option value="">{t('publicationControl')} — {t('allStatuses')}</option>
          <option value="published">{t('published')}</option>
          <option value="internal_only">{t('internal_only')}</option>
        </select>
      </div>

      {/* Archive Table */}
      <div className="rounded-lg border border-[#D9E2EC] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#F4F7FA] border-b border-[#D9E2EC] text-[#486581]">
              <tr>
                <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('issuedFatwaNo')}</th>
                <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('fatwaId')}</th>
                <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('date')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('questionSubject')}</th>
                <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('fatwaCategory')}</th>
                <th className="px-4 py-3 text-start font-semibold">{lang === 'ur' ? 'محقق / مصدق' : 'Researcher / Approver'}</th>
                <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('status')}</th>
                <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('publicationControl')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF2F7]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[#627D98]">
                    {loading ? t('loading') : t('noData')}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => onNavigate('fatwa_questions', { fatwaId: r.id })}
                    className="hover:bg-[#F4F7FA] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3.5 align-top font-mono-code font-bold text-[#057A4B] whitespace-nowrap">
                      {r.issued_fatwa_number || '—'}
                    </td>
                    <td className="px-4 py-3.5 align-top font-mono-code text-[#0B2545] whitespace-nowrap">
                      {r.fatwa_code}
                    </td>
                    <td className="px-4 py-3.5 align-top font-mono-code text-[#486581] whitespace-nowrap">
                      {r.issued_at || r.question_date}
                    </td>
                    <td className="px-4 py-3.5 align-top min-w-[230px] font-semibold text-[#0F1F38]">
                      {pick(r.subject_title, r.subject_title_ur)}
                    </td>
                    <td className="px-4 py-3.5 align-top whitespace-nowrap text-[#243B53]">
                      {pick(r.category_name_en, r.category_name_ur)}
                    </td>
                    <td className="px-4 py-3.5 align-top text-[#486581]">
                      <div>{r.researcher_names_ur || '—'}</div>
                      {r.approver_name && <div className="text-[11px] text-[#057A4B]">{r.approver_name}</div>}
                    </td>
                    <td className="px-4 py-3.5 align-top whitespace-nowrap">
                      <StatusText status={r.workflow_status} />
                    </td>
                    <td className="px-4 py-3.5 align-top whitespace-nowrap">
                      {r.publication_status === 'published' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0284C7]">
                          <Globe className="h-3.5 w-3.5" />
                          <span>{t('published')}</span>
                        </span>
                      ) : (
                        <StatusText status={r.publication_status} />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
