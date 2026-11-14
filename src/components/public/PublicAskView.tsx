import React, { useState } from 'react';
import { CheckCircle2, FileText, Lock, SearchCheck, Upload, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { fileToDataUrl } from '../../lib/api';
import { PublicRoute } from './PublicPortalLayout';

interface PublicAskViewProps {
  categories: any[];
  allowOptionalEmail?: boolean;
  onNavigate: (next: PublicRoute) => void;
}

export const PublicAskView: React.FC<PublicAskViewProps> = ({
  categories,
  allowOptionalEmail = true,
  onNavigate,
}) => {
  const { lang, t, pick } = useLanguage();

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    mobile: '',
    country: 'Pakistan',
    city: '',
    category_id: categories[0]?.id || 'cat-taharah',
    subject_title: '',
    question_text: '',
    consent: false,
    website: '', // honeypot
  });

  const [attachments, setAttachments] = useState<Array<{ fileName: string; fileUrl: string; mimeType: string; size: number }>>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<any | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await fetch('/api/public/uploads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, dataUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error_ur || json.error || 'Upload failed');
      setAttachments((prev) => [...prev, json]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.full_name.trim() || !form.mobile.trim() || !form.country.trim() || !form.city.trim()) {
      setError(lang === 'ur' ? 'نام، موبائل نمبر، ملک اور شہر درج کرنا ضروری ہے۔' : 'Full name, mobile, country, and city are required.');
      return;
    }
    if (!form.question_text.trim() || form.question_text.trim().length < 15) {
      setError(lang === 'ur' ? 'براہِ کرم مکمل سوال تفصیل سے تحریر کریں۔' : 'Please provide your complete question (minimum 15 characters).');
      return;
    }
    if (!form.consent) {
      setError(lang === 'ur' ? 'رازداری اور شرائط کی تصدیق ضروری ہے۔' : 'Please confirm the privacy & submission consent.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/public/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          attachments,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error((lang === 'ur' ? json.error_ur : json.error) || json.error || 'Submission failed');
      }
      setReceipt(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (receipt) {
    return (
      <div className="max-w-2xl mx-auto rounded-lg border border-[#057A4B]/40 bg-white p-6 sm:p-8 space-y-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-7 w-7 text-[#057A4B] shrink-0 mt-0.5" />
          <div>
            <h1 className="text-xl font-bold text-[#0B2545]">
              {lang === 'ur' ? 'استفتاء کامیابی سے موصول ہو گیا' : 'Question Submitted Successfully'}
            </h1>
            <p className="mt-1 text-sm text-[#243B53]">
              {lang === 'ur' ? receipt.message_ur : receipt.message_en}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-md border border-[#D9E2EC] bg-[#F4F7FA] p-5">
          <div>
            <div className="text-xs text-[#486581]">{t('trackingNumberLabel')}</div>
            <div className="mt-1 text-2xl font-mono-code font-bold text-[#0B2545]" dir="ltr">
              {receipt.tracking_number}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#486581]">
              {lang === 'ur' ? 'خفیہ تصدیقی کوڈ (محفوظ رکھیں)' : 'Security Verification Code (Save This)'}
            </div>
            <div className="mt-1 text-2xl font-mono-code font-bold text-[#057A4B]" dir="ltr">
              {receipt.verification_code}
            </div>
          </div>
        </div>

        <div className="text-xs text-[#486581] leading-relaxed">
          {lang === 'ur'
            ? 'آپ اپنے ٹریکنگ نمبر اور رجسٹرڈ موبائل نمبر یا مذکورہ تصدیقی کوڈ کے ذریعے کسی بھی وقت اپنے سوال کی کیفیت معلوم کر سکتے ہیں۔'
            : 'Use your Tracking Number together with either your registered mobile number or verification code to track progress securely.'}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() =>
              onNavigate({
                page: 'track',
                trackingNumber: receipt.tracking_number,
                verificationCode: receipt.verification_code,
              })
            }
            className="inline-flex items-center gap-2 rounded-md bg-[#057A4B] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#04643D] whitespace-nowrap"
          >
            <SearchCheck className="h-4 w-4" />
            <span>{t('trackQuestionCta')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setReceipt(null);
              setAttachments([]);
              setForm((f) => ({ ...f, subject_title: '', question_text: '', consent: false }));
            }}
            className="rounded-md border border-[#D9E2EC] px-4 py-2.5 text-xs font-medium text-[#0B2545] hover:bg-[#F4F7FA]"
          >
            {lang === 'ur' ? 'ایک اور سوال پوچھیں' : 'Ask Another Question'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="rounded-lg border border-[#D9E2EC] bg-white p-6 space-y-2">
        <h1 className="text-xl font-bold text-[#0B2545]">{t('askQuestionCta')}</h1>
        <p className="text-xs sm:text-sm text-[#486581]">
          {lang === 'ur'
            ? 'استفتاء ارسال کرنے کے لیے کسی اکاؤنٹ کی ضرورت نہیں۔ آپ کا نام اور رابطہ نمبر مکمل رازداری میں رکھا جائے گا۔'
            : 'No account registration required. Your personal details remain strictly confidential with Dar-ul-Ifta.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-[#D9E2EC] bg-white p-6 space-y-5 text-xs sm:text-sm">
        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-800">{error}</div>
        )}

        {/* Hidden honeypot against automated spam bots */}
        <input
          type="text"
          name="website"
          value={form.website}
          onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          aria-hidden="true"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#0B2545] mb-1.5">
              {lang === 'ur' ? 'مکمل نام *' : 'Full Name *'}
            </label>
            <input
              type="text"
              required
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-sm text-[#0F1F38] focus:border-[#057A4B] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0B2545] mb-1.5">
              {lang === 'ur' ? 'موبائل نمبر *' : 'Mobile Number *'}
            </label>
            <input
              type="tel"
              required
              dir="ltr"
              value={form.mobile}
              onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
              placeholder="+92-300-1234567"
              className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-sm font-mono-code text-[#0F1F38] focus:border-[#057A4B] focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#0B2545] mb-1.5">
              {t('email')} {allowOptionalEmail ? (lang === 'ur' ? '(اختیاری)' : '(Optional)') : '*'}
            </label>
            <input
              type="email"
              required={!allowOptionalEmail}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-sm text-[#0F1F38] focus:border-[#057A4B] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0B2545] mb-1.5">
              {lang === 'ur' ? 'ملک *' : 'Country *'}
            </label>
            <input
              type="text"
              required
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-sm text-[#0F1F38] focus:border-[#057A4B] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0B2545] mb-1.5">
              {lang === 'ur' ? 'شہر *' : 'City *'}
            </label>
            <input
              type="text"
              required
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-sm text-[#0F1F38] focus:border-[#057A4B] focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#0B2545] mb-1.5">
              {t('fatwaCategory')} *
            </label>
            <select
              required
              value={form.category_id}
              onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
              className="w-full rounded-md border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0F1F38] focus:border-[#057A4B] focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {pick(c.name_en, c.name_ur)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0B2545] mb-1.5">
              {lang === 'ur' ? 'موضوع / مختصر عنوان (اختیاری)' : 'Short Subject (Optional)'}
            </label>
            <input
              type="text"
              value={form.subject_title}
              onChange={(e) => setForm((f) => ({ ...f, subject_title: e.target.value }))}
              className="w-full rounded-md border border-[#D9E2EC] px-3 py-2 text-sm text-[#0F1F38] focus:border-[#057A4B] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#0B2545] mb-1.5">
            {t('questionText')} *
          </label>
          <textarea
            required
            rows={6}
            value={form.question_text}
            onChange={(e) => setForm((f) => ({ ...f, question_text: e.target.value }))}
            placeholder={
              lang === 'ur'
                ? 'اپنا شرعی مسئلہ مکمل وضاحت اور صورتِ واقعہ کے ساتھ تحریر فرمائیں...'
                : 'Write your complete Islamic question clearly with all relevant context...'
            }
            className="w-full rounded-md border border-[#D9E2EC] px-3.5 py-2.5 text-sm text-[#0F1F38] focus:border-[#057A4B] focus:outline-none"
          />
        </div>

        {/* Supporting Files Upload (PDF / Image only, max 5MB) */}
        <div className="rounded-md border border-[#D9E2EC] bg-[#F4F7FA] p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-[#0B2545]">
                {lang === 'ur' ? 'معاون دستاویز یا تصویر (اختیاری)' : 'Supporting Documents or Images (Optional)'}
              </div>
              <div className="text-[11px] text-[#627D98]">
                {lang === 'ur' ? 'صرف PDF، JPG، PNG یا WEBP (زیادہ سے زیادہ ۵ ایم بی)' : 'PDF, JPG, PNG, or WEBP only (Max 5 MB)'}
              </div>
            </div>
            <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-[#D9E2EC] bg-white px-3.5 py-2 text-xs font-medium text-[#0B2545] hover:bg-[#E2E8F0]">
              <Upload className="h-3.5 w-3.5 text-[#057A4B]" />
              <span>{uploading ? t('loading') : t('uploadDocument')}</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
          {attachments.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {attachments.map((att, idx) => (
                <div key={idx} className="flex items-center justify-between rounded bg-white border border-[#D9E2EC] px-3 py-1.5 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-[#0B2545]">
                    <FileText className="h-3.5 w-3.5 text-[#057A4B]" />
                    <span>{att.fileName}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-red-600 hover:text-red-800"
                    aria-label="Remove attachment"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Consent & Privacy Confirmation */}
        <label className="flex items-start gap-2.5 cursor-pointer rounded-md border border-[#D9E2EC] p-3.5 bg-white">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(e) => setForm((f) => ({ ...f, consent: e.target.checked }))}
            className="mt-1 rounded border-[#D9E2EC] text-[#057A4B]"
          />
          <span className="text-xs text-[#243B53] leading-relaxed">
            <Lock className="h-3.5 w-3.5 inline mx-1 text-[#057A4B]" />
            {lang === 'ur'
              ? 'میں تصدیق کرتا/کرتی ہوں کہ میرا سوال حقیقی دینی رہنمائی کے لیے ہے۔ دارالافتاء نافع میری ذاتی شناخت خفیہ رکھتے ہوئے فتویٰ کو عوامی استفادہ کے لیے شائع کرنے کا اختیار رکھتا ہے۔'
              : 'I confirm this inquiry is genuine. I understand my personal identity will remain strictly confidential while Dar-ul-Ifta may publish an anonymized version of the ruling for public benefit.'}
          </span>
        </label>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || uploading}
            className="rounded-md bg-[#057A4B] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#04643D] disabled:opacity-60 transition-colors"
          >
            {submitting
              ? lang === 'ur'
                ? 'ارسال کیا جا رہا ہے...'
                : 'Submitting...'
              : lang === 'ur'
                ? 'سوال ارسال کریں'
                : 'Submit Question'}
          </button>
        </div>
      </form>
    </div>
  );
};
