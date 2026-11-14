import React, { useEffect, useState } from 'react';
import {
  FileQuestion,
  Search,
  RefreshCw,
  Plus,
  Filter,
  ArrowUpRight,
  Lock,
  Globe,
  Scale,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { StatusText } from '../StatusText';
import { NavSection } from '../Layout';

interface FatwaDashboardViewProps {
  onNavigate: (section: NavSection, payload?: { fatwaId?: string }) => void;
}

export const FatwaDashboardView: React.FC<FatwaDashboardViewProps> = ({ onNavigate }) => {
  const { lang, t, pick } = useLanguage();
  const { user, canRegisterFatwa } = useAuth();

  const [lookups, setLookups] = useState<{ categories: any[]; assignees: any[] }>({
    categories: [],
    assignees: [],
  });
  const [counts, setCounts] = useState<any | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    apiFetch('/api/fatwa/lookups', {}, user)
      .then((res) => setLookups(res))
      .catch(() => {});
  }, [user?.profileId]);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('search', search.trim());
      if (categoryId) qs.set('categoryId', categoryId);
      if (assigneeId) setAssigneeIdParam(qs, assigneeId);
      if (dateFrom) qs.set('dateFrom', dateFrom);
      if (dateTo) qs.set('dateTo', dateTo);
      if (statusFilter) qs.set('status', statusFilter);

      const res = await apiFetch(`/api/fatwa/dashboard?${qs.toString()}`, {}, user);
      setCounts(res.counts);
      setQuestions(res.questions || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  function setAssigneeIdParam(qs: URLSearchParams, val: string) {
    qs.set('assigneeId', val);
  }

  useEffect(() => {
    const timer = setTimeout(loadDashboard, 180);
    return () => clearTimeout(timer);
  }, [user?.role, user?.profileId, search, categoryId, assigneeId, dateFrom, dateTo, statusFilter]);

  const kpiCards = counts
    ? [
        { key: '', label: t('fatwaTotalQuestions'), value: counts.totalQuestions, tone: 'navy' },
        { key: 'registered', label: t('fatwaNewQuestions'), value: counts.newQuestions, tone: 'cerulean' },
        { key: 'assigned', label: t('fatwaAssignedQuestions'), value: counts.assignedQuestions, tone: 'cerulean' },
        { key: 'research', label: t('fatwaUnderResearch'), value: counts.underResearch, tone: 'amber' },
        { key: 'draft', label: t('fatwaDraftsInProgress'), value: counts.draftsInProgress, tone: 'amber' },
        { key: 'senior_review', label: t('fatwaPendingSenior'), value: counts.pendingSeniorReview, tone: 'amber' },
        { key: 'final_approval', label: t('fatwaPendingFinal'), value: counts.pendingFinalApproval, tone: 'navy' },
        { key: 'issued', label: t('fatwaApprovedCount'), value: counts.approvedFatwas, tone: 'emerald' },
        { key: 'issued', label: t('fatwaIssuedCount'), value: counts.issuedFatwas, tone: 'emerald' },
        { key: 'published', label: t('fatwaPublishedCount'), value: counts.publishedFatwas, tone: 'emerald' },
      ]
    : [];

  const clearFilters = () => {
    setSearch('');
    setCategoryId('');
    setAssigneeId('');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('');
  };

  return (
    <div className="space-y-6">
      {/* Institutional Dar-ul-Ifta Header Banner */}
      <div className="rounded-lg border border-[#D9E2EC] bg-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src="/assets/aistudio/naafay_logo_8857642c.jpg"
            alt="Naafay Darul Ifta"
            referrerPolicy="no-referrer"
            className="h-12 w-12 rounded-full border border-[#D9E2EC] object-contain p-0.5 bg-white shrink-0"
          />
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#486581]">
              <Scale className="h-3.5 w-3.5 text-[#057A4B]" />
              <span>{lang === 'ur' ? 'شعبۂ دارالافتاء و تحقیقِ شرعی' : 'Department of Fatwa Research, Review & Issuance'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-code text-[#0B2545]">
                {lang === 'ur' ? `${questions.length} استفتاءات زیرِ نظر` : `${questions.length} matching records`}
              </span>
            </div>
            <h2 className="mt-1 text-lg font-bold text-[#0B2545]">
              {lang === 'ur' ? 'دارالافتاء نافع — فتویٰ ورک فلو ڈیش بورڈ' : 'Naafay Dar-ul-Ifta — Fatwa Workflow Dashboard'}
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canRegisterFatwa && (
            <button
              type="button"
              onClick={() => onNavigate('fatwa_questions')}
              className="inline-flex items-center gap-2 rounded-md bg-[#057A4B] px-4 py-2 text-xs font-medium text-white hover:bg-[#04643D] transition-colors whitespace-nowrap"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>{t('registerQuestion')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('fatwa_archive')}
            className="inline-flex items-center gap-2 rounded-md border border-[#D9E2EC] bg-white px-4 py-2 text-xs font-medium text-[#0B2545] hover:bg-[#F4F7FA] transition-colors whitespace-nowrap"
          >
            <span>{t('navFatwaArchive')}</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
          </button>
        </div>
      </div>

      {/* 10 Workflow KPI Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {loading && !counts
          ? Array.from({ length: 10 }).map((_, idx) => (
              <div key={idx} className="h-24 rounded-lg border border-[#D9E2EC] bg-white animate-pulse" />
            ))
          : kpiCards.map((card, idx) => {
              const isSelected = statusFilter === card.key && card.key !== '';
              const valueColor =
                card.tone === 'emerald'
                  ? 'text-[#057A4B]'
                  : card.tone === 'cerulean'
                    ? 'text-[#0284C7]'
                    : card.tone === 'amber'
                      ? 'text-[#B45309]'
                      : 'text-[#0B2545]';

              return (
                <button
                  key={`${card.label}-${idx}`}
                  type="button"
                  onClick={() => setStatusFilter(isSelected ? '' : card.key)}
                  className={`text-start rounded-lg border p-4 transition-colors ${
                    isSelected
                      ? 'border-[#057A4B] bg-[#057A4B]/5'
                      : 'border-[#D9E2EC] bg-white hover:border-[#0284C7]/60'
                  }`}
                >
                  <div className="text-xs font-medium text-[#486581]">{card.label}</div>
                  <div className={`mt-2 text-2xl font-bold tabular-nums font-poppins ${valueColor}`}>
                    {card.value}
                  </div>
                </button>
              );
            })}
      </div>

      {/* Filters Bar */}
      <div className="rounded-lg border border-[#D9E2EC] bg-white p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-medium text-[#486581] mb-1">
              {t('searchPlaceholder')}
            </label>
            <div className="relative">
              <Search className={`h-4 w-4 text-[#627D98] absolute top-1/2 -translate-y-1/2 ${lang === 'ur' ? 'right-3' : 'left-3'}`} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={lang === 'ur' ? 'فتویٰ نمبر، عنوان، یا سوال تلاش کریں...' : 'Search FAT ID, title, or question...'}
                className={`w-full rounded-md border border-[#D9E2EC] bg-[#F4F7FA] py-2 text-xs text-[#0F1F38] focus:border-[#057A4B] focus:bg-white focus:outline-none ${
                  lang === 'ur' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#486581] mb-1">{t('fatwaCategory')}</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-md border border-[#D9E2EC] bg-white px-3 py-2 text-xs text-[#0F1F38] focus:border-[#057A4B] focus:outline-none"
            >
              <option value="">{t('allStatuses')}</option>
              {lookups.categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {pick(cat.name_en, cat.name_ur)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#486581] mb-1">{t('assignResearcher')}</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full rounded-md border border-[#D9E2EC] bg-white px-3 py-2 text-xs text-[#0F1F38] focus:border-[#057A4B] focus:outline-none"
            >
              <option value="">{lang === 'ur' ? 'تمام محققین / مفتیان' : 'All Assignees'}</option>
              {lookups.assignees.map((a) => (
                <option key={a.profile_id} value={a.profile_id}>
                  {pick(a.full_name, a.full_name_ur)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#486581] mb-1">{t('startDate')}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-md border border-[#D9E2EC] bg-white px-3 py-2 text-xs text-[#0F1F38] font-mono-code focus:border-[#057A4B] focus:outline-none"
            />
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-[#486581] mb-1">{t('endDate')}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-md border border-[#D9E2EC] bg-white px-3 py-2 text-xs text-[#0F1F38] font-mono-code focus:border-[#057A4B] focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={clearFilters}
              title={lang === 'ur' ? 'فلٹر صاف کریں' : 'Clear filters'}
              className="rounded-md border border-[#D9E2EC] bg-[#F4F7FA] px-3 py-2 text-xs font-medium text-[#0B2545] hover:bg-[#E2E8F0] whitespace-nowrap"
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-white p-5 text-center">
          <p className="text-xs text-red-700">{error}</p>
          <button
            type="button"
            onClick={loadDashboard}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[#0B2545] px-4 py-1.5 text-xs font-medium text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{lang === 'ur' ? 'دوبارہ لوڈ کریں' : 'Retry'}</span>
          </button>
        </div>
      )}

      {/* Fatwa Workflow Queue Table */}
      <div className="rounded-lg border border-[#D9E2EC] bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#D9E2EC] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileQuestion className="h-4 w-4 text-[#0284C7]" />
            <h3 className="text-sm font-semibold text-[#0B2545]">
              {lang === 'ur' ? 'استفتاءات و فتاویٰ کی فہرست' : 'Active Fatwa Workflow Queue'}
            </h3>
          </div>
          <span className="text-xs text-[#486581] tabular-nums">
            {lang === 'ur' ? `کل ${questions.length} ریکارڈ` : `${questions.length} records`}
          </span>
        </div>

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
                <th className="px-4 py-3 text-start font-semibold whitespace-nowrap">{t('publicationControl')}</th>
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
                    onClick={() => onNavigate('fatwa_questions', { fatwaId: q.id })}
                    className="hover:bg-[#F4F7FA] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3.5 align-top whitespace-nowrap">
                      <div className="font-mono-code font-semibold text-[#0B2545]">{q.fatwa_code}</div>
                      {q.issued_fatwa_number && (
                        <div className="font-mono-code text-[11px] text-[#057A4B] mt-0.5">{q.issued_fatwa_number}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-top font-mono-code text-[#486581] whitespace-nowrap">
                      {q.question_date}
                    </td>
                    <td className="px-4 py-3.5 align-top min-w-[240px]">
                      <div className="font-semibold text-[#0F1F38] leading-relaxed">
                        {pick(q.subject_title, q.subject_title_ur)}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#627D98]">
                        <span>{q.questioner_name}</span>
                        {q.is_identity_private ? (
                          <span className="inline-flex items-center gap-1 text-[#0B2545]">
                            <Lock className="h-3 w-3" />
                            <span>{lang === 'ur' ? 'پوشیدہ' : 'Private'}</span>
                          </span>
                        ) : null}
                        {q.city && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{q.city}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-top whitespace-nowrap text-[#243B53]">
                      {pick(q.category_name_en, q.category_name_ur)}
                    </td>
                    <td className="px-4 py-3.5 align-top text-[#243B53]">
                      {pick(q.assignees_en, q.assignees_ur) || (
                        <span className="text-[#829AB1]">{lang === 'ur' ? 'غیر تفویض شدہ' : 'Unassigned'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-top whitespace-nowrap">
                      <StatusText status={q.workflow_status} />
                    </td>
                    <td className="px-4 py-3.5 align-top whitespace-nowrap">
                      {q.publication_status === 'published' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0284C7]">
                          <Globe className="h-3.5 w-3.5" />
                          <span>{t('published')}</span>
                        </span>
                      ) : (
                        <StatusText status={q.publication_status} />
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
