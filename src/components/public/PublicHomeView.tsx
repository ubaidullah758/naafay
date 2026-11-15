import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  FileQuestion,
  Megaphone,
  Phone,
  Search,
  SearchCheck,
  Mail,
  MapPin,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { PublicRoute } from './PublicPortalLayout';

interface PublicHomeViewProps {
  portalData: any;
  loading: boolean;
  onNavigate: (next: PublicRoute) => void;
}

export const PublicHomeView: React.FC<PublicHomeViewProps> = ({ portalData, loading, onNavigate }) => {
  const { lang, t, pick } = useLanguage();
  const [quickSearch, setQuickSearch] = useState('');

  const settings = portalData?.settings;
  const categories = portalData?.categories || [];
  const recentFatwas = portalData?.recentFatwas || [];
  const announcements = portalData?.announcements || [];

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigate({ page: 'library', initialQuery: quickSearch.trim() });
  };

  if (loading && !portalData) {
    return (
      <div className="space-y-6">
        <div className="h-64 rounded-lg border border-[#D9E2EC] bg-white animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg border border-[#D9E2EC] bg-white animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Hero Banner: Clean Institutional Focal Anchor + Quick Fatwa Search (No Cover Photo) */}
      <section className="rounded-lg border border-[#D9E2EC] bg-white overflow-hidden">
        <div className="p-4 sm:p-8 lg:p-10 space-y-4 sm:space-y-5">
          <div className="flex items-center gap-3 sm:gap-3.5">
            <img
              src="/assets/aistudio/naafay_logo_8857642c.jpg"
              alt="Naafay Darul Ifta"
              referrerPolicy="no-referrer"
              className="h-12 w-12 sm:h-14 sm:w-14 rounded-full border border-[#D9E2EC] object-contain p-0.5 bg-white shrink-0"
            />
            <div className="text-xs sm:text-sm text-[#057A4B]">
              <span>{settings ? pick(settings.institution_name_en, settings.institution_name_ur) : t('brandName')}</span>
              <span className="mx-2 text-[#9FB3C8]" aria-hidden="true">·</span>
              <span className="text-[#486581]">
                {lang === 'ur' ? `ناظم: ${settings?.nazim_name_ur || 'مفتی وارث نصیب'}` : `Nazim: ${settings?.nazim_name_en || 'Mufti Waris Naseeb'}`}
              </span>
            </div>
          </div>

          <div className="space-y-2 sm:space-y-2.5">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#0B2545]">
              {settings ? pick(settings.welcome_title_en, settings.welcome_title_ur) : t('brandName')}
            </h1>

            <p className="text-xs sm:text-sm md:text-base text-[#243B53] max-w-3xl">
              {settings
                ? pick(settings.welcome_body_en, settings.welcome_body_ur)
                : lang === 'ur'
                  ? 'اپنے شرعی مسائل مستند مفتیانِ کرام سے دریافت کریں اور تصدیق شدہ فتاویٰ کا مطالعہ کریں۔'
                  : 'Submit your religious inquiries directly to our panel of qualified Muftis and browse published Fatawa.'}
            </p>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
            {/* Primary & Secondary Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full lg:w-auto">
              <button
                type="button"
                onClick={() => onNavigate({ page: 'ask' })}
                className="flex-1 sm:flex-none justify-center inline-flex items-center gap-2 rounded-md bg-[#057A4B] px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-[#04643D] transition-colors whitespace-nowrap"
              >
                <FileQuestion className="h-4 w-4 shrink-0" />
                <span>{t('askQuestionCta')}</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate({ page: 'track' })}
                className="flex-1 sm:flex-none justify-center inline-flex items-center gap-2 rounded-md border border-[#0B2545]/25 bg-white px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium text-[#0B2545] hover:bg-[#F4F7FA] transition-colors whitespace-nowrap"
              >
                <SearchCheck className="h-4 w-4 text-[#0284C7] shrink-0" />
                <span>{t('trackQuestionCta')}</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate({ page: 'library' })}
                className="flex-1 sm:flex-none justify-center inline-flex items-center gap-2 rounded-md border border-[#D9E2EC] bg-[#F4F7FA] px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium text-[#243B53] hover:bg-[#E2E8F0] transition-colors whitespace-nowrap"
              >
                <BookOpen className="h-4 w-4 text-[#057A4B] shrink-0" />
                <span>{t('searchFatwasCta')}</span>
              </button>
            </div>

            {/* Search Published Fatwas Input */}
            <form onSubmit={handleQuickSearch} className="flex flex-col sm:flex-row gap-2 w-full lg:max-w-md">
              <div className="relative flex-1">
                <Search className={`h-4 w-4 text-[#627D98] absolute top-1/2 -translate-y-1/2 ${lang === 'ur' ? 'right-3' : 'left-3'}`} />
                <input
                  type="text"
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  placeholder={
                    lang === 'ur'
                      ? 'شائع شدہ فتویٰ نمبر یا موضوع تلاش کریں...'
                      : 'Search Fatwa number or topic...'
                  }
                  className={`w-full rounded-md border border-[#D9E2EC] bg-[#F4F7FA] py-2 text-xs sm:text-sm text-[#0F1F38] focus:border-[#057A4B] focus:bg-white focus:outline-none ${
                    lang === 'ur' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                  }`}
                />
              </div>
              <button
                type="submit"
                className="w-full sm:w-auto rounded-md bg-[#0B2545] px-5 py-2 text-xs sm:text-sm font-medium text-white hover:bg-[#103563] transition-colors whitespace-nowrap"
              >
                {t('searchFatwasCta')}
              </button>
            </form>
          </div>
        </div>

        <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 sm:px-8 lg:px-10 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#486581]">
          <span className="text-[#057A4B] font-medium">
            {lang === 'ur' ? 'عوام الناس کے لیے مکمل رازداری' : 'Guaranteed Questioner Privacy'}
          </span>
          <span>
            {lang === 'ur'
              ? 'سائلین کے نام اور ذاتی معلومات کبھی پبلک ویب سائٹ پر ظاہر نہیں کی جاتیں؛ صرف ناظمِ دارالافتاء کی اجازت سے منظور شدہ فتاویٰ شائع ہوتے ہیں۔'
              : 'Personal names and contact details are never displayed publicly; only officially approved Fatawa appear in the library.'}
          </span>
        </div>
      </section>

      {/* Fatwa Categories Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#0B2545]">{t('publicPortalNavCategories')}</h2>
            <p className="text-xs text-[#486581]">
              {lang === 'ur'
                ? 'اپنے مطلوبہ فقہی موضوع کے مطابق شائع شدہ فتاویٰ کا مطالعہ کریں'
                : 'Browse verified Fatawa organized by Islamic jurisprudence topic'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate({ page: 'library' })}
            className="text-xs font-semibold text-[#057A4B] hover:underline whitespace-nowrap"
          >
            {lang === 'ur' ? 'تمام فتاویٰ دیکھیں' : 'View All Fatawa'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {categories.map((cat: any) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onNavigate({ page: 'library', categoryCode: cat.code })}
              className="text-start rounded-lg border border-[#D9E2EC] bg-white p-4 hover:border-[#057A4B] transition-colors flex flex-col justify-between gap-2"
            >
              <div>
                <div className="text-sm font-semibold text-[#0B2545]">{pick(cat.name_en, cat.name_ur)}</div>
                {cat.name_ar && <div className="font-arabic text-xs text-[#627D98] mt-0.5">{cat.name_ar}</div>}
              </div>
              <div className="text-xs font-mono-code text-[#057A4B] tabular-nums">
                {lang === 'ur' ? `${cat.published_count || 0} شائع شدہ فتاویٰ` : `${cat.published_count || 0} published`}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Recently Published Fatawa */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[#0B2545]">{t('recentPublishedFatwas')}</h2>
          <button
            type="button"
            onClick={() => onNavigate({ page: 'library' })}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0284C7] hover:underline whitespace-nowrap"
          >
            <span>{t('searchFatwasCta')}</span>
            {lang === 'ur' ? <ArrowLeft className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
          </button>
        </div>

        {recentFatwas.length === 0 ? (
          <div className="rounded-lg border border-[#D9E2EC] bg-white p-8 text-center text-sm text-[#627D98]">
            {t('noData')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentFatwas.map((f: any) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onNavigate({ page: 'fatwa_detail', identifier: f.issued_fatwa_number || f.id })}
                className="text-start rounded-lg border border-[#D9E2EC] bg-white p-5 hover:border-[#057A4B] transition-colors space-y-2.5"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#486581]">
                  <span className="font-mono-code font-bold text-[#057A4B]">{f.issued_fatwa_number}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-[#0284C7]">{pick(f.category_name_en, f.category_name_ur)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-code">{(f.published_at || f.issued_at || '').slice(0, 10)}</span>
                </div>
                <h3 className="text-base font-bold text-[#0B2545]">
                  {pick(f.public_title_en, f.public_title_ur)}
                </h3>
                <p className="text-xs text-[#486581]">
                  {f.public_question_text && f.public_question_text.length > 150
                    ? `${f.public_question_text.slice(0, 150)}...`
                    : f.public_question_text}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Announcements & Contact Information */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-lg border border-[#D9E2EC] bg-white p-6 space-y-4">
          <div className="flex items-center gap-2 text-[#0B2545]">
            <Megaphone className="h-4 w-4 text-[#057A4B]" />
            <h2 className="text-base font-bold">{t('importantAnnouncements')}</h2>
          </div>
          <div className="divide-y divide-[#EDF2F7]">
            {announcements.map((ann: any) => (
              <div key={ann.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#0F1F38]">{pick(ann.title_en, ann.title_ur)}</h3>
                  <span className="text-xs font-mono-code text-[#627D98]">{ann.date}</span>
                </div>
                <p className="text-xs text-[#486581] leading-relaxed">{pick(ann.body_en, ann.body_ur)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#D9E2EC] bg-white p-6 space-y-4">
          <h2 className="text-base font-bold text-[#0B2545]">{t('contactDarulIfta')}</h2>
          <div className="space-y-3 text-xs text-[#243B53]">
            <div className="flex items-start gap-2.5">
              <MapPin className="h-4 w-4 text-[#057A4B] shrink-0 mt-0.5" />
              <span>{settings ? pick(settings.contact_address_en, settings.contact_address_ur) : (lang === 'ur' ? 'مرکزی کیمپس، گلبرگ، لاہور' : 'Markazi Campus, Gulberg, Lahore')}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 text-[#057A4B] shrink-0" />
              <span className="font-mono-code" dir="ltr">{settings?.contact_phone || '+92-21-34589012'}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 text-[#057A4B] shrink-0" />
              <span className="font-mono-code">{settings?.contact_email || 'ifta@naafay.edu.pk'}</span>
            </div>
          </div>
          <div className="pt-3 border-t border-[#EDF2F7] text-xs text-[#486581]">
            {lang === 'ur'
              ? 'دفتری اوقات: ہفتہ تا جمعرات صبح ۹ بجے تا ظہر'
              : 'Office Hours: Saturday – Thursday, 9:00 AM – 2:00 PM'}
          </div>
        </div>
      </section>
    </div>
  );
};
