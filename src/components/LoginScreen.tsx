import React, { useState } from 'react';
import { Shield, UserCheck, BookOpen, GraduationCap, Award, Globe, Lock } from 'lucide-react';
import { useAuth, ROLE_PERSONAS, UserRole } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

interface LoginScreenProps {
  onOpenPublicPortal?: () => void;
  onAdminLoggedIn?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onOpenPublicPortal, onAdminLoggedIn }) => {
  const { signInAsRole, loginAdminWithCredentials } = useAuth();
  const { lang, toggleLang, t } = useLanguage();
  const [mode, setMode] = useState<'admin_login' | 'role_select'>('admin_login');
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [adminEmail, setAdminEmail] = useState('nazim@naafay.edu.pk');
  const [adminCode, setAdminCode] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const roles: Array<{ role: UserRole; label: string; icon: React.ReactNode }> = [
    { role: 'admin', label: t('roleAdmin'), icon: <Shield className="h-4 w-4 shrink-0" /> },
    { role: 'senior_mufti', label: t('roleSeniorMufti'), icon: <Award className="h-4 w-4 shrink-0" /> },
    { role: 'mufti', label: t('roleTeacher'), icon: <BookOpen className="h-4 w-4 shrink-0" /> },
    { role: 'office_staff', label: t('roleStaff'), icon: <UserCheck className="h-4 w-4 shrink-0" /> },
    { role: 'student', label: t('roleStudent'), icon: <GraduationCap className="h-4 w-4 shrink-0" /> },
  ];

  const persona = ROLE_PERSONAS[selectedRole];

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setSubmitting(true);
    try {
      await loginAdminWithCredentials(adminEmail, adminCode || 'naafay2026');
      onAdminLoggedIn?.();
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] flex items-center justify-center p-3 sm:p-4 lg:p-8">
      <div className="w-full max-w-5xl rounded-lg border border-[#D9E2EC] bg-white grid grid-cols-1 lg:grid-cols-2 items-stretch shadow-sm">
        {/* Institutional Branding Panel (Logo Only, No Cover Photo) */}
        <div className="relative bg-gradient-to-br from-[#0B2545] via-[#0F3A68] to-[#057A4B] p-5 sm:p-8 lg:p-10 flex flex-col justify-between text-white rounded-t-lg lg:rounded-t-none lg:rounded-s-lg min-h-0 lg:min-h-[540px]">
          <div className="flex items-center gap-3 sm:gap-4">
            <img
              src="/assets/aistudio/naafay_logo_8857642c.jpg"
              alt="Naafay Emblem"
              referrerPolicy="no-referrer"
              className="h-12 w-12 sm:h-16 sm:w-16 shrink-0 rounded-full border-2 border-white/40 bg-white object-contain p-0.5"
            />
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">{t('brandName')}</h2>
              <p className="text-xs text-sky-100/95">{t('brandSub')}</p>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4 my-4 sm:my-6">
            <div className="text-xs font-medium text-[#6EE7B7]">
              {lang === 'ur' ? 'مربوط علمی، تعلیمی و افتاء سافٹ ویئر' : 'Unified Academic, Fatwa & Public Portal Platform'}
            </div>
            <p className="text-xs sm:text-sm text-sky-50/95 max-w-md">
              {lang === 'ur'
                ? 'نافع دارالافتاء و تخصص فی الفقہ کا مربوط تعلیمی، افتاء اور ایڈمن پورٹل: طلبہ، سہ وقتی حاضری، روزانہ مطالعہ، استفتاء، تحقیق، منظوری اور پبلک پورٹل کنٹرول۔'
                : 'Integrated Academic, Dar-ul-Ifta & Master Admin platform for Takhassus fil Fiqh: full management across all three modules.'}
            </p>
          </div>

          <div className="pt-3 sm:pt-4 border-t border-white/15 text-xs text-sky-100/80 flex items-center justify-between gap-2">
            <span>{lang === 'ur' ? 'ناظم: مفتی وارث نصیب' : 'Nazim: Mufti Waris Naseeb'}</span>
            <span className="font-mono-code">1447-1448 AH</span>
          </div>
        </div>

        {/* Login Tabs */}
        <div className="p-4 sm:p-6 lg:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-4 sm:pb-5 border-b border-[#E2E8F0] flex-wrap">
              <span className="text-sm font-semibold text-[#0B2545]">{t('loginTitle')}</span>
              <div className="flex items-center gap-2">
                {onOpenPublicPortal && (
                  <button
                    type="button"
                    onClick={onOpenPublicPortal}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#057A4B]/35 px-3 py-1.5 text-xs font-medium text-[#057A4B] hover:bg-[#057A4B]/5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>{t('viewPublicPortal')}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleLang}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#D9E2EC] px-3 py-1.5 text-xs font-medium text-[#0F1F38] hover:bg-[#F4F7FA] transition-colors whitespace-nowrap shrink-0"
                >
                  <Globe className="h-3.5 w-3.5 text-[#057A4B]" />
                  <span>{t('switchLang')}</span>
                </button>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('admin_login')}
                className={`rounded-md px-3.5 py-2 text-xs font-semibold transition-colors ${
                  mode === 'admin_login'
                    ? 'bg-[#0B2545] text-white'
                    : 'border border-[#D9E2EC] bg-white text-[#243B53]'
                }`}
              >
                {t('adminLoginTitle')}
              </button>
              <button
                type="button"
                onClick={() => setMode('role_select')}
                className={`rounded-md px-3.5 py-2 text-xs font-semibold transition-colors ${
                  mode === 'role_select'
                    ? 'bg-[#0B2545] text-white'
                    : 'border border-[#D9E2EC] bg-white text-[#243B53]'
                }`}
              >
                {t('selectRole')}
              </button>
            </div>

            {mode === 'admin_login' ? (
              <form onSubmit={handleAdminSubmit} className="mt-6 space-y-4">
                <div>
                  <h1 className="text-lg font-bold text-[#0F1F38]">{t('adminLoginTitle')}</h1>
                  <p className="mt-1 text-xs text-[#486581]">
                    {lang === 'ur'
                      ? 'ناظمِ دارالافتاء (مفتی وارث نصیب) کے لیے مرکزی ایڈمن پینل تک رسائی۔'
                      : 'Sign in as Nazim Dar-ul-Ifta (Mufti Waris Naseeb) to access Admin Panel.'}
                  </p>
                </div>

                {loginError && (
                  <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">{loginError}</div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#0B2545] mb-1">
                    {lang === 'ur' ? 'ایڈمن ای میل' : 'Admin Email'}
                  </label>
                  <input
                    type="email"
                    dir="ltr"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full rounded-md border border-[#D9E2EC] bg-[#F4F7FA] px-3 py-2 text-xs font-mono-code focus:border-[#057A4B] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0B2545] mb-1">{t('adminAccessCode')}</label>
                  <div className="relative">
                    <Lock className={`h-4 w-4 text-[#627D98] absolute top-1/2 -translate-y-1/2 ${lang === 'ur' ? 'right-3' : 'left-3'}`} />
                    <input
                      type="password"
                      dir="ltr"
                      placeholder="naafay2026"
                      value={adminCode}
                      onChange={(e) => setAdminCode(e.target.value)}
                      className={`w-full rounded-md border border-[#D9E2EC] bg-[#F4F7FA] py-2 text-xs font-mono-code focus:border-[#057A4B] focus:bg-white focus:outline-none ${
                        lang === 'ur' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                      }`}
                    />
                  </div>
                  <div className="mt-1 text-[11px] font-mono-code text-[#627D98]">
                    {lang === 'ur' ? 'ڈیفالٹ کوڈ: naafay2026' : 'Default access code: naafay2026'}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-md bg-[#057A4B] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#04633D] transition-colors disabled:opacity-60"
                >
                  {submitting ? t('loading') : t('adminLoginBtn')}
                </button>
              </form>
            ) : (
              <div className="mt-6">
                <h1 className="text-lg font-bold text-[#0F1F38]">{t('loginSubtitle')}</h1>
                <p className="mt-1 text-sm text-[#486581]">{t('selectRole')}</p>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {roles.map((r) => {
                    const active = selectedRole === r.role;
                    return (
                      <button
                        key={r.role}
                        type="button"
                        onClick={() => setSelectedRole(r.role)}
                        className={`flex items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-start transition-colors ${
                          active
                            ? 'border-[#057A4B] bg-[#057A4B]/8 text-[#0B2545]'
                            : 'border-[#D9E2EC] bg-white text-[#243B53] hover:bg-[#F4F7FA]'
                        }`}
                      >
                        <span className={active ? 'text-[#057A4B]' : 'text-[#486581]'}>{r.icon}</span>
                        <span className="text-xs font-semibold">{r.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-md border border-[#D9E2EC] bg-[#F4F7FA] p-4">
                  <div className="text-xs text-[#486581]">{lang === 'ur' ? 'منتخب صارف' : 'Selected Account'}</div>
                  <div className="mt-1 text-sm font-semibold text-[#0F1F38]">
                    {lang === 'ur' ? persona.nameUr : persona.nameEn}
                  </div>
                  <div className="mt-0.5 text-xs font-mono-code text-[#486581]">{persona.email}</div>
                </div>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      signInAsRole(selectedRole);
                      if (selectedRole === 'admin') onAdminLoggedIn?.();
                    }}
                    className="w-full rounded-md bg-[#057A4B] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#04633D] transition-colors"
                  >
                    {t('enterPortal')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
