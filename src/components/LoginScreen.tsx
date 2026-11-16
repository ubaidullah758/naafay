import React, { useState, useEffect } from 'react';
import { Shield, BookOpen, GraduationCap, Globe, Lock, Phone, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { STATIC_TEACHERS } from '../lib/staticInitialData';

interface LoginScreenProps {
  onOpenPublicPortal?: () => void;
  onAdminLoggedIn?: () => void;
  onTeacherLoggedIn?: () => void;
  onStudentLoggedIn?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onOpenPublicPortal,
  onAdminLoggedIn,
  onTeacherLoggedIn,
  onStudentLoggedIn,
}) => {
  const { loginAdminWithCredentials, loginStudentWithCredentials, loginTeacherWithCredentials } = useAuth();
  const { lang, toggleLang, t } = useLanguage();

  // Strictly 3 tabs: student_login, teacher_login, admin_login
  const [mode, setMode] = useState<'student_login' | 'teacher_login' | 'admin_login'>('student_login');

  // Student state (Mobile Number & PIN only — NO student names)
  const [studentMobile, setStudentMobile] = useState('');
  const [studentPin, setStudentPin] = useState('');

  // Teacher state
  const [teachers, setTeachers] = useState<any[]>(Array.isArray(STATIC_TEACHERS) ? STATIC_TEACHERS : []);
  const [teacherCode, setTeacherCode] = useState('TCH-001');
  const [teacherPin, setTeacherPin] = useState('123456');

  // Admin state
  const [adminEmail, setAdminEmail] = useState('nazim@naafay.edu.pk');
  const [adminCode, setAdminCode] = useState('naafay2026');

  const [loginError, setLoginError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/teachers')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setTeachers(data);
      })
      .catch(() => {});
  }, []);

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setSubmitting(true);
    try {
      await loginStudentWithCredentials(studentMobile, studentPin || '123456');
      onStudentLoggedIn?.();
    } catch (err: any) {
      setLoginError(err.message || (lang === 'ur' ? 'موبائل نمبر یا پن درست نہیں ہے' : 'Invalid mobile number or PIN'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setSubmitting(true);
    try {
      await loginTeacherWithCredentials(teacherCode, teacherPin || '123456');
      onTeacherLoggedIn?.();
    } catch (err: any) {
      setLoginError(err.message || (lang === 'ur' ? 'استاذ لاگ ان ناکام رہا' : 'Teacher login failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setSubmitting(true);
    try {
      await loginAdminWithCredentials(adminEmail, adminCode || 'naafay2026');
      onAdminLoggedIn?.();
    } catch (err: any) {
      setLoginError(err.message || (lang === 'ur' ? 'ایڈمن لاگ ان ناکام رہا' : 'Admin login failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8] flex flex-col justify-center items-center p-4 sm:p-6 font-urdu">
      <div className="w-full max-w-md">

        {/* Institution Branding Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <img
            src="/assets/aistudio/naafay_logo_8857642c.jpg"
            alt="Naafay Emblem"
            referrerPolicy="no-referrer"
            className="h-16 w-16 sm:h-20 sm:w-20 rounded-full border-2 border-[#057A4B]/40 bg-white object-contain p-1 shadow-sm"
          />
          <h1 className="mt-3 text-lg sm:text-xl font-bold text-[#0B2545] tracking-wide">
            {t('brandName')}
          </h1>
          <p className="mt-0.5 text-xs text-[#057A4B] font-semibold">
            {t('brandSub')}
          </p>
        </div>

        {/* Centered Login Card */}
        <div className="bg-white rounded-2xl border border-[#D9E2EC] shadow-sm p-6 sm:p-8">

          {/* 3 Clean Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-[#F1F5F9] rounded-lg border border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => {
                setMode('student_login');
                setLoginError(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-md py-2 px-1 text-xs font-bold transition-all ${
                mode === 'student_login'
                  ? 'bg-white text-[#065F46] shadow-xs border border-emerald-300'
                  : 'text-[#486581] hover:text-[#0B2545]'
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5 shrink-0" />
              <span>{lang === 'ur' ? 'طالب علم' : 'Student'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('teacher_login');
                setLoginError(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-md py-2 px-1 text-xs font-bold transition-all ${
                mode === 'teacher_login'
                  ? 'bg-white text-[#0B2545] shadow-xs border border-slate-300'
                  : 'text-[#486581] hover:text-[#0B2545]'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              <span>{lang === 'ur' ? 'استاذ / مفتی' : 'Teacher'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('admin_login');
                setLoginError(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-md py-2 px-1 text-xs font-bold transition-all ${
                mode === 'admin_login'
                  ? 'bg-white text-[#0B2545] shadow-xs border border-slate-300'
                  : 'text-[#486581] hover:text-[#0B2545]'
              }`}
            >
              <Shield className="h-3.5 w-3.5 shrink-0" />
              <span>{lang === 'ur' ? 'ایڈمن' : 'Admin'}</span>
            </button>
          </div>

          {/* Error Message */}
          {loginError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-2.5 text-center text-xs text-red-700 font-medium">
              {loginError}
            </div>
          )}

          {/* 1. STUDENT LOGIN FORM (MOBILE NUMBER ONLY — NO NAMES) */}
          {mode === 'student_login' && (
            <form onSubmit={handleStudentSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0B2545] mb-1.5">
                  {lang === 'ur' ? 'موبائل نمبر' : 'Mobile Number'}
                </label>
                <div className="relative">
                  <Phone className={`h-4 w-4 text-[#627D98] absolute top-1/2 -translate-y-1/2 ${lang === 'ur' ? 'right-3' : 'left-3'}`} />
                  <input
                    type="tel"
                    dir="ltr"
                    required
                    placeholder="03001234567"
                    value={studentMobile}
                    onChange={(e) => setStudentMobile(e.target.value)}
                    className={`w-full rounded-lg border border-[#D9E2EC] bg-[#F8FAFC] py-2.5 text-xs font-mono-code focus:border-[#057A4B] focus:bg-white focus:outline-none transition-colors ${
                      lang === 'ur' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0B2545] mb-1.5">
                  {lang === 'ur' ? 'خفیہ پن (PIN)' : 'PIN'}
                </label>
                <div className="relative">
                  <Lock className={`h-4 w-4 text-[#627D98] absolute top-1/2 -translate-y-1/2 ${lang === 'ur' ? 'right-3' : 'left-3'}`} />
                  <input
                    type="password"
                    dir="ltr"
                    required
                    placeholder="••••••"
                    value={studentPin}
                    onChange={(e) => setStudentPin(e.target.value)}
                    className={`w-full rounded-lg border border-[#D9E2EC] bg-[#F8FAFC] py-2.5 text-xs font-mono-code focus:border-[#057A4B] focus:bg-white focus:outline-none transition-colors ${
                      lang === 'ur' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-[#057A4B] px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-[#04633D] transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
              >
                <GraduationCap className="h-4 w-4" />
                <span>{submitting ? t('loading') : (lang === 'ur' ? 'داخل ہوں' : 'Sign In')}</span>
              </button>
            </form>
          )}

          {/* 2. TEACHER LOGIN FORM */}
          {mode === 'teacher_login' && (
            <form onSubmit={handleTeacherSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0B2545] mb-1.5">
                  {lang === 'ur' ? 'استاذ / مفتی' : 'Teacher / Mufti'}
                </label>
                <select
                  value={teacherCode}
                  onChange={(e) => setTeacherCode(e.target.value)}
                  className="w-full rounded-lg border border-[#D9E2EC] bg-[#F8FAFC] px-3 py-2.5 text-xs font-medium text-[#0F1F38] focus:border-[#057A4B] focus:bg-white focus:outline-none transition-colors"
                >
                  {teachers.map((tch) => (
                    <option key={tch.id || tch.teacher_code} value={tch.teacher_code || tch.id}>
                      {tch.full_name_ur || tch.full_name} ({tch.teacher_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0B2545] mb-1.5">
                  {lang === 'ur' ? 'خفیہ پن (PIN)' : 'PIN'}
                </label>
                <div className="relative">
                  <Lock className={`h-4 w-4 text-[#627D98] absolute top-1/2 -translate-y-1/2 ${lang === 'ur' ? 'right-3' : 'left-3'}`} />
                  <input
                    type="password"
                    dir="ltr"
                    required
                    value={teacherPin}
                    onChange={(e) => setTeacherPin(e.target.value)}
                    className={`w-full rounded-lg border border-[#D9E2EC] bg-[#F8FAFC] py-2.5 text-xs font-mono-code focus:border-[#057A4B] focus:bg-white focus:outline-none transition-colors ${
                      lang === 'ur' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-[#0B2545] px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-[#071D36] transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
              >
                <BookOpen className="h-4 w-4" />
                <span>{submitting ? t('loading') : (lang === 'ur' ? 'داخل ہوں' : 'Sign In')}</span>
              </button>
            </form>
          )}

          {/* 3. ADMIN LOGIN FORM */}
          {mode === 'admin_login' && (
            <form onSubmit={handleAdminSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0B2545] mb-1.5">
                  {lang === 'ur' ? 'ایڈمن ای میل' : 'Admin Email'}
                </label>
                <input
                  type="email"
                  dir="ltr"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#D9E2EC] bg-[#F8FAFC] px-3 py-2.5 text-xs font-mono-code focus:border-[#057A4B] focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0B2545] mb-1.5">
                  {lang === 'ur' ? 'پاس ورڈ' : 'Password'}
                </label>
                <div className="relative">
                  <Lock className={`h-4 w-4 text-[#627D98] absolute top-1/2 -translate-y-1/2 ${lang === 'ur' ? 'right-3' : 'left-3'}`} />
                  <input
                    type="password"
                    dir="ltr"
                    required
                    value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value)}
                    className={`w-full rounded-lg border border-[#D9E2EC] bg-[#F8FAFC] py-2.5 text-xs font-mono-code focus:border-[#057A4B] focus:bg-white focus:outline-none transition-colors ${
                      lang === 'ur' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-[#0B2545] px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-[#071D36] transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
              >
                <Shield className="h-4 w-4" />
                <span>{submitting ? t('loading') : (lang === 'ur' ? 'داخل ہوں' : 'Sign In')}</span>
              </button>
            </form>
          )}

          {/* Clean Card Footer */}
          <div className="mt-6 pt-4 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#5A6D65]">
            {onOpenPublicPortal ? (
              <button
                type="button"
                onClick={onOpenPublicPortal}
                className="inline-flex items-center gap-1 text-[#057A4B] hover:underline font-semibold"
              >
                <span>{t('viewPublicPortal')}</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            ) : <span />}

            <button
              type="button"
              onClick={toggleLang}
              className="inline-flex items-center gap-1.5 text-[#486581] hover:text-[#0B2545]"
            >
              <Globe className="h-3.5 w-3.5 text-[#057A4B]" />
              <span>{t('switchLang')}</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
