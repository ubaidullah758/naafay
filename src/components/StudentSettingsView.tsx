import React, { useState, useEffect } from 'react';
import { UserCheck, Lock, Save, Phone, MapPin, Mail, Shield, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch } from '../lib/api';

export const StudentSettingsView: React.FC = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [pinSaving, setPinSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Profile fields
  const [phone, setPhone] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  // Password / PIN fields
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Load current student details
  useEffect(() => {
    if (!user?.studentId && !user?.studentCode) return;
    const stuIdent = user.studentId || user.studentCode;
    setLoading(true);
    apiFetch(`/api/students/${stuIdent}`, {}, user)
      .then((data) => {
        const s = data?.student || data;
        if (s) {
          setPhone(s.phone || '');
          setGuardianPhone(s.guardian_phone || s.guardianPhone || '');
          setEmail(s.email || user.email || '');
          setAddress(s.address_ur || s.address || '');
        }
      })
      .catch(() => {
        // Fallback from localStorage
        try {
          const raw = localStorage.getItem('naafay_active_student_user');
          if (raw) {
            const p = JSON.parse(raw);
            setEmail(p.email || '');
            if (p.phone) setPhone(p.phone);
          }
        } catch {}
      })
      .finally(() => setLoading(false));
  }, [user]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileSaving(true);
    try {
      const stuIdent = user.studentId || user.studentCode || 'stu-1';
      const payload = {
        phone,
        guardian_phone: guardianPhone,
        email,
        address_ur: address,
      };

      await apiFetch(`/api/students/${stuIdent}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }, user);

      // Update active user in localStorage
      const updatedUser = { ...user, email };
      localStorage.setItem('naafay_active_student_user', JSON.stringify(updatedUser));

      showToast(
        lang === 'ur'
          ? 'آپ کا پروفائل کامیابی کے ساتھ اپڈیٹ ہو گیا ہے!'
          : 'Profile updated successfully!',
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'پروفائل محفوظ کرنے میں خرابی پیش آگئی', 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (newPin.length < 4) {
      showToast(
        lang === 'ur' ? 'نیا پن کم از کم 4 ہندسوں پر مشتمل ہونا چاہیے' : 'New PIN must be at least 4 digits',
        'error'
      );
      return;
    }

    if (newPin !== confirmPin) {
      showToast(
        lang === 'ur' ? 'نیا پن اور تصدیقی پن مماثل نہیں ہیں' : 'New PIN and confirm PIN do not match',
        'error'
      );
      return;
    }

    setPinSaving(true);
    try {
      const stuIdent = user.studentId || user.studentCode || 'stu-1';
      await apiFetch(`/api/students/${stuIdent}/pin`, {
        method: 'POST',
        body: JSON.stringify({
          currentPin,
          newPin,
        }),
      }, user);

      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');

      showToast(
        lang === 'ur'
          ? 'آپ کا لاگ ان خفیہ پن کامیابی کے ساتھ تبدیل کر دیا گیا ہے!'
          : 'Login PIN changed successfully!',
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'پن تبدیل کرنے میں خرابی پیش آگئی', 'error');
    } finally {
      setPinSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-urdu">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`flex items-center gap-2 p-3.5 rounded-lg border text-xs sm:text-sm font-semibold transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="rounded-xl border border-[#D9E2EC] bg-white p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#0B2545] flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-[#057A4B]" />
            <span>{lang === 'ur' ? 'طالب علم پروفائل و سیٹنگز' : 'Student Profile & Settings'}</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#486581] mt-1">
            {lang === 'ur'
              ? 'اپنے ذاتی کوائف، رابطہ نمبر اور لاگ ان خفیہ پن کو یہاں سے تبدیل کر سکتے ہیں۔'
              : 'Update your personal info, contact details, and change your login PIN.'}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#057A4B]/10 border border-[#057A4B]/30 text-xs font-bold text-[#065F46]">
          <span>{user?.studentCode || 'ST-007'}</span>
          <span>•</span>
          <span>{user?.classNameUr || 'تخصص فی الفقہ'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD 1: Profile Information */}
        <div className="rounded-xl border border-[#D9E2EC] bg-white p-5 sm:p-6 shadow-sm space-y-5">
          <div className="border-b border-[#EDF2F7] pb-3">
            <h3 className="text-sm sm:text-base font-bold text-[#0B2545] flex items-center gap-2">
              <Phone className="h-4 w-4 text-[#057A4B]" />
              <span>{lang === 'ur' ? 'ذاتی و رابطہ کی معلومات' : 'Personal & Contact Info'}</span>
            </h3>
            <p className="text-xs text-[#627D98] mt-0.5">
              {lang === 'ur' ? 'اپنا درست موبائل نمبر اور پتہ درج رکھیں۔' : 'Keep your contact information updated.'}
            </p>
          </div>

          {/* Academic Info Preview (Readonly) */}
          <div className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] p-3 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[#627D98]">{lang === 'ur' ? 'طالب علم کا نام:' : 'Student Name:'}</span>
              <span className="font-bold text-[#0B2545]">{user?.nameUr || user?.nameEn}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#627D98]">{lang === 'ur' ? 'رجسٹریشن کوڈ:' : 'Code:'}</span>
              <span className="font-mono-code font-bold text-[#057A4B]">{user?.studentCode}</span>
            </div>
            {user?.fatherNameUr && (
              <div className="flex justify-between">
                <span className="text-[#627D98]">{lang === 'ur' ? 'والد کا نام:' : 'Father Name:'}</span>
                <span className="text-[#0B2545]">{user.fatherNameUr}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[#627D98]">{lang === 'ur' ? 'شعبہ و درجہ:' : 'Class:'}</span>
              <span className="text-[#0B2545]">{user?.classNameUr || 'تخصص فی الفقہ'}</span>
            </div>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-[#0B2545] mb-1">
                {lang === 'ur' ? 'طالب علم کا موبائل نمبر' : 'Student Mobile'}
              </label>
              <input
                type="text"
                dir="ltr"
                required
                placeholder="03319239011"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-[#D9E2EC] bg-[#F8FAFC] px-3 py-2 font-mono-code text-xs text-[#0F1F38] focus:border-[#057A4B] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#0B2545] mb-1">
                {lang === 'ur' ? 'سرپرست کا رابطہ نمبر' : 'Guardian Phone'}
              </label>
              <input
                type="text"
                dir="ltr"
                placeholder="03001234567"
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                className="w-full rounded-lg border border-[#D9E2EC] bg-[#F8FAFC] px-3 py-2 font-mono-code text-xs text-[#0F1F38] focus:border-[#057A4B] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#0B2545] mb-1">
                {lang === 'ur' ? 'ای میل ایڈریس' : 'Email Address'}
              </label>
              <input
                type="email"
                dir="ltr"
                placeholder="student@naafay.edu.pk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[#D9E2EC] bg-[#F8FAFC] px-3 py-2 font-mono-code text-xs text-[#0F1F38] focus:border-[#057A4B] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#0B2545] mb-1">
                {lang === 'ur' ? 'رہائشی پتہ / دار الاقامہ' : 'Residential Address'}
              </label>
              <textarea
                rows={2}
                placeholder={lang === 'ur' ? 'مکمل پتہ یا دار الاقامہ ہاسٹل کمرہ نمبر...' : 'Full address or hostel room...'}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-lg border border-[#D9E2EC] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F1F38] focus:border-[#057A4B] focus:bg-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={profileSaving}
              className="w-full rounded-lg bg-[#057A4B] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#04633D] transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              <Save className="h-4 w-4" />
              <span>{profileSaving ? (lang === 'ur' ? 'محفوظ ہو رہا ہے...' : 'Saving...') : (lang === 'ur' ? 'معلومات محفوظ کریں' : 'Save Profile')}</span>
            </button>
          </form>
        </div>

        {/* CARD 2: Password / PIN Security */}
        <div className="rounded-xl border border-[#D9E2EC] bg-white p-5 sm:p-6 shadow-sm space-y-5">
          <div className="border-b border-[#EDF2F7] pb-3">
            <h3 className="text-sm sm:text-base font-bold text-[#0B2545] flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#0B2545]" />
              <span>{lang === 'ur' ? 'لاگ ان پن / پاس ورڈ تبدیل کریں' : 'Change Login PIN / Password'}</span>
            </h3>
            <p className="text-xs text-[#627D98] mt-0.5">
              {lang === 'ur' ? 'طالب علم ڈیش بورڈ میں لاگ ان ہونے کا خفیہ پن تبدیل کریں۔' : 'Change your confidential PIN for logging in.'}
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-[#0B2545] mb-1">
                {lang === 'ur' ? 'موجودہ پن (Current PIN)' : 'Current PIN'}
              </label>
              <div className="relative">
                <Lock className={`h-4 w-4 text-[#627D98] absolute top-1/2 -translate-y-1/2 ${lang === 'ur' ? 'right-3' : 'left-3'}`} />
                <input
                  type="password"
                  dir="ltr"
                  required
                  placeholder="••••••"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                  className={`w-full rounded-lg border border-[#D9E2EC] bg-[#F8FAFC] py-2 font-mono-code text-xs text-[#0F1F38] focus:border-[#0B2545] focus:bg-white focus:outline-none ${
                    lang === 'ur' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                  }`}
                />
              </div>
              <p className="text-[10px] text-[#627D98] mt-1">
                {lang === 'ur' ? 'ابتدائی ڈیفالٹ پن: 123456 ہے' : 'Initial default PIN: 123456'}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-[#0B2545] mb-1">
                {lang === 'ur' ? 'نیا خفیہ پن (New PIN)' : 'New PIN'}
              </label>
              <div className="relative">
                <Lock className={`h-4 w-4 text-[#627D98] absolute top-1/2 -translate-y-1/2 ${lang === 'ur' ? 'right-3' : 'left-3'}`} />
                <input
                  type="password"
                  dir="ltr"
                  required
                  placeholder="کم از کم 4 ہندسے"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className={`w-full rounded-lg border border-[#D9E2EC] bg-[#F8FAFC] py-2 font-mono-code text-xs text-[#0F1F38] focus:border-[#0B2545] focus:bg-white focus:outline-none ${
                    lang === 'ur' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#0B2545] mb-1">
                {lang === 'ur' ? 'نئے پن کی تصدیق (Confirm New PIN)' : 'Confirm New PIN'}
              </label>
              <div className="relative">
                <Lock className={`h-4 w-4 text-[#627D98] absolute top-1/2 -translate-y-1/2 ${lang === 'ur' ? 'right-3' : 'left-3'}`} />
                <input
                  type="password"
                  dir="ltr"
                  required
                  placeholder="دوبارہ درج کریں"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  className={`w-full rounded-lg border border-[#D9E2EC] bg-[#F8FAFC] py-2 font-mono-code text-xs text-[#0F1F38] focus:border-[#0B2545] focus:bg-white focus:outline-none ${
                    lang === 'ur' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                  }`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={pinSaving}
              className="w-full rounded-lg bg-[#0B2545] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#103563] transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              <Lock className="h-4 w-4" />
              <span>{pinSaving ? (lang === 'ur' ? 'تبدیل ہو رہا ہے...' : 'Updating...') : (lang === 'ur' ? 'نیا پن محفوظ کریں' : 'Save New PIN')}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
