import React, { useState } from 'react';
import {
  BookOpen,
  FileQuestion,
  Globe,
  Home,
  Lock,
  Menu,
  SearchCheck,
  X,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export type PublicRoute =
  | { page: 'home' }
  | { page: 'ask' }
  | { page: 'track'; trackingNumber?: string; verificationCode?: string }
  | { page: 'library'; categoryCode?: string; initialQuery?: string }
  | { page: 'fatwa_detail'; identifier: string }
  | { page: 'not_found' };

interface PublicPortalLayoutProps {
  route: PublicRoute;
  onNavigate: (next: PublicRoute) => void;
  onOpenStaffPortal: () => void;
  settings?: any;
  children: React.ReactNode;
}

export const PublicPortalLayout: React.FC<PublicPortalLayoutProps> = ({
  route,
  onNavigate,
  onOpenStaffPortal,
  settings,
  children,
}) => {
  const { lang, toggleLang, t, pick } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: Array<{ label: string; active: boolean; target: PublicRoute; icon: React.ReactNode }> = [
    {
      label: t('publicPortalNavHome'),
      active: route.page === 'home',
      target: { page: 'home' },
      icon: <Home className="h-4 w-4 shrink-0" />,
    },
    {
      label: t('publicPortalNavAsk'),
      active: route.page === 'ask',
      target: { page: 'ask' },
      icon: <FileQuestion className="h-4 w-4 shrink-0" />,
    },
    {
      label: t('publicPortalNavTrack'),
      active: route.page === 'track',
      target: { page: 'track' },
      icon: <SearchCheck className="h-4 w-4 shrink-0" />,
    },
    {
      label: t('publicPortalNavLibrary'),
      active: route.page === 'library' || route.page === 'fatwa_detail',
      target: { page: 'library' },
      icon: <BookOpen className="h-4 w-4 shrink-0" />,
    },
  ];

  const instName = settings
    ? pick(settings.institution_name_en, settings.institution_name_ur)
    : t('brandName');

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7FA] text-[#0F1F38]">
      {/* Main Public Navigation */}
      <header className="no-print sticky top-0 z-30 bg-white border-b border-[#D9E2EC]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => onNavigate({ page: 'home' })}
            className="flex items-center gap-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#057A4B] rounded-md"
          >
            <img
              src="/assets/aistudio/naafay_logo_8857642c.jpg"
              alt={instName}
              referrerPolicy="no-referrer"
              className="h-11 w-11 rounded-full border border-[#D9E2EC] object-contain p-0.5 bg-white shrink-0"
            />
            <div>
              <div className="text-base font-bold text-[#0B2545]">{instName}</div>
              <div className="text-[11px] text-[#057A4B] font-medium">
                {lang === 'ur' ? 'آن لائن دارالافتاء و تصدیق شدہ فتاویٰ پورٹل' : 'Online Fatwa Research & Public Guidance Portal'}
              </div>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6" aria-label="Primary public navigation">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onNavigate(item.target)}
                className={`inline-flex items-center gap-1.5 py-1.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  item.active
                    ? 'border-[#057A4B] text-[#057A4B]'
                    : 'border-transparent text-[#243B53] hover:text-[#0B2545] hover:border-[#D9E2EC]'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate({ page: 'ask' })}
              className="hidden sm:inline-flex items-center gap-2 rounded-md bg-[#057A4B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#04643D] transition-colors whitespace-nowrap"
            >
              <span>{t('askQuestionCta')}</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="md:hidden rounded-md border border-[#D9E2EC] p-2 text-[#0B2545]"
              aria-label="Toggle public menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#D9E2EC] bg-white px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  onNavigate(item.target);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium text-start ${
                  item.active ? 'bg-[#057A4B]/10 text-[#057A4B]' : 'text-[#243B53] hover:bg-[#F4F7FA]'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
            <div className="pt-2 border-t border-[#EEF2F0] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  toggleLang();
                  setMobileMenuOpen(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#D9E2EC] px-3 py-1.5 text-xs font-medium text-[#243B53]"
              >
                <Globe className="h-3.5 w-3.5 text-[#057A4B]" />
                <span>{t('switchLang')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenStaffPortal();
                  setMobileMenuOpen(false);
                }}
                className="inline-flex items-center gap-1 text-xs text-[#057A4B] font-semibold"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>{t('staffPortalLogin')}</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Public Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>

      {/* Trustworthy Institutional Footer */}
      <footer className="no-print bg-[#0B2545] text-sky-100 border-t border-white/10 mt-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8 text-xs">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img
                src="/assets/aistudio/naafay_logo_8857642c.jpg"
                alt={instName}
                referrerPolicy="no-referrer"
                className="h-10 w-10 rounded-full bg-white object-contain p-0.5 shrink-0"
              />
              <div>
                <div className="text-sm font-bold text-white">{instName}</div>
                <div className="text-sky-200/85">
                  {lang === 'ur' ? 'ناظمِ دارالافتاء: مفتی وارث نصیب' : 'Nazim: Mufti Waris Naseeb'}
                </div>
              </div>
            </div>
            <p className="text-sky-100/85 leading-relaxed">
              {lang === 'ur'
                ? 'قرآن و سنت اور فقہِ اسلامی کی روشنی میں مستند شرعی رہنمائی۔ سائلین کی ذاتی معلومات مکمل رازداری میں رکھی جاتی ہیں۔'
                : 'Authentic Islamic jurisprudence guidance rooted in Quran, Sunnah, and classical Fiqh. Questioner personal identities remain strictly confidential.'}
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="text-sm font-semibold text-white">{lang === 'ur' ? 'فوری روابط' : 'Quick Links'}</div>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => onNavigate({ page: 'ask' })} className="text-start text-sky-100/90 hover:text-white">
                {t('publicPortalNavAsk')}
              </button>
              <button type="button" onClick={() => onNavigate({ page: 'track' })} className="text-start text-sky-100/90 hover:text-white">
                {t('publicPortalNavTrack')}
              </button>
              <button type="button" onClick={() => onNavigate({ page: 'library' })} className="text-start text-sky-100/90 hover:text-white">
                {t('publicPortalNavLibrary')}
              </button>
              <button type="button" onClick={onOpenStaffPortal} className="text-start text-[#34D399] hover:underline">
                {t('staffPortalLogin')}
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="text-sm font-semibold text-white">{t('contactDarulIfta')}</div>
            <div className="space-y-2 text-sky-100/90">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-[#34D399] shrink-0 mt-0.5" />
                <span>
                  {settings
                    ? pick(settings.contact_address_en, settings.contact_address_ur)
                    : lang === 'ur'
                      ? 'مرکزی کیمپس، گلبرگ، لاہور'
                      : 'Markazi Campus, Gulberg, Lahore'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-[#34D399] shrink-0" />
                <span className="font-mono-code" dir="ltr">{settings?.contact_phone || '+92-21-34589012'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#34D399] shrink-0" />
                <span className="font-mono-code">{settings?.contact_email || 'ifta@naafay.edu.pk'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 bg-[#081C36] py-3 px-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-sky-200/80">
          <span>© {new Date().getFullYear()} {instName}</span>
          <button
            type="button"
            onClick={toggleLang}
            className="inline-flex items-center gap-1 rounded bg-white/10 hover:bg-white/20 text-sky-100 px-2 py-0.5 text-[10px] transition-colors"
          >
            <Globe className="h-3 w-3 text-[#34D399]" />
            <span>{lang === 'ur' ? 'EN' : 'اردو'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
