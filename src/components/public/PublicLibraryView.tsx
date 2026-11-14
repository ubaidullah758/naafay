import React, { useEffect, useState } from 'react';
import { BookOpen, Calendar, Search, Filter } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { ErrorState } from '../ErrorState';
import { PublicRoute } from './PublicPortalLayout';

interface PublicLibraryViewProps {
  categories: any[];
  initialCategoryCode?: string;
  initialQuery?: string;
  onNavigate: (next: PublicRoute) => void;
}

export const PublicLibraryView: React.FC<PublicLibraryViewProps> = ({
  categories,
  initialCategoryCode = '',
  initialQuery = '',
  onNavigate,
}) => {
  const { lang, t, pick } = useLanguage();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategoryCode);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [fatwas, setFatwas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCategory(initialCategoryCode);
  }, [initialCategoryCode]);

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (query.trim()) qs.set('q', query.trim());
        if (category) qs.set('category', category);
        if (dateFrom) qs.set('dateFrom', dateFrom);
        if (dateTo) qs.set('dateTo', dateTo);
        const res = await fetch(`/api/public/fatwas?${qs.toString()}`);
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const json = await res.json();
        setFatwas(Array.isArray(json) ? json : []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load the fatwa library');
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [query, category, dateFrom, dateTo]);

  const activeCategoryObj = categories.find(
    (c) => c.code?.toUpperCase() === category.toUpperCase() || c.id === category
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[#D9E2EC] bg-white p-6 space-y-2">
        <div className="flex items-center gap-2 text-[#0B2545]">
          <BookOpen className="h-5 w-5 text-[#057A4B]" />
          <h1 className="text-xl font-bold">
            {activeCategoryObj
              ? pick(activeCategoryObj.name_en, activeCategoryObj.name_ur)
              : t('publicPortalNavLibrary')}
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-[#486581]">
          {lang === 'ur'
            ? 'نافع دارالافتاء سے باضابطہ طور پر منظور و شائع شدہ فتاویٰ کا قابلِ تلاش ذخیرہ۔'
            : 'Official library of Fatawa reviewed by Senior Muftis and approved for public publication.'}
        </p>
      </div>

      {/* Category Quick Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCategory('')}
          className={`rounded-md px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
            category === ''
              ? 'bg-[#057A4B] text-white'
              : 'bg-white border border-[#D9E2EC] text-[#243B53] hover:bg-[#F4F7FA]'
          }`}
        >
          {t('allStatuses')}
        </button>
        {categories.map((c) => {
          const active = category.toUpperCase() === c.code?.toUpperCase() || category === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onNavigate({ page: 'library', categoryCode: c.code })}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-[#057A4B] text-white'
                  : 'bg-white border border-[#D9E2EC] text-[#243B53] hover:bg-[#F4F7FA]'
              }`}
            >
              {pick(c.name_en, c.name_ur)}
            </button>
          );
        })}
      </div>

      {/* Search & Date Filter Bar */}
      <div className="rounded-lg border border-[#D9E2EC] bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div className="lg:col-span-2">
          <label className="block text-[11px] font-medium text-[#486581] mb-1">
            {lang === 'ur' ? 'فتویٰ نمبر، عنوان یا لفظ تلاش کریں' : 'Search Fatwa No. or Keyword'}
          </label>
          <div className="relative">
            <Search className={`h-4 w-4 text-[#627D98] absolute top-1/2 -translate-y-1/2 ${lang === 'ur' ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="NA-FATWA-2026-0001..."
              className={`w-full rounded-md border border-[#D9E2EC] bg-[#F4F7FA] py-2 text-xs text-[#0F1F38] focus:border-[#057A4B] focus:bg-white focus:outline-none ${
                lang === 'ur' ? 'pr-9 pl-3' : 'pl-9 pr-3'
              }`}
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#486581] mb-1">{t('startDate')}</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-xs font-mono-code"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#486581] mb-1">{t('endDate')}</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-xs font-mono-code"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setQuery('');
            setCategory('');
            setDateFrom('');
            setDateTo('');
            onNavigate({ page: 'library' });
          }}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#D9E2EC] bg-[#F4F7FA] px-3 py-2 text-xs font-medium text-[#0B2545] hover:bg-[#E2E8F0]"
        >
          <Filter className="h-3.5 w-3.5" />
          <span>{lang === 'ur' ? 'فلٹر صاف کریں' : 'Reset Filters'}</span>
        </button>
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 rounded-lg border border-[#D9E2EC] bg-white animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => setError(null)} compact />
        ) : fatwas.length === 0 ? (
          <div className="rounded-lg border border-[#D9E2EC] bg-white p-10 text-center text-sm text-[#627D98]">
            {t('noData')}
          </div>
        ) : (
          fatwas.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onNavigate({ page: 'fatwa_detail', identifier: f.issued_fatwa_number || f.id })}
              className="w-full text-start rounded-lg border border-[#D9E2EC] bg-white p-5 hover:border-[#057A4B] transition-colors space-y-2.5"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#486581]">
                <span className="font-mono-code font-bold text-[#057A4B]">{f.issued_fatwa_number}</span>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-[#0284C7]">{pick(f.category_name_en, f.category_name_ur)}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-mono-code">
                  <Calendar className="h-3 w-3" />
                  <span>{(f.published_at || f.issued_at || '').slice(0, 10)}</span>
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[#0B2545]">
                {pick(f.public_title_en, f.public_title_ur)}
              </h2>
              <p className="text-xs sm:text-sm text-[#243B53]">
                {f.public_question_text && f.public_question_text.length > 180
                  ? `${f.public_question_text.slice(0, 180)}...`
                  : f.public_question_text}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
