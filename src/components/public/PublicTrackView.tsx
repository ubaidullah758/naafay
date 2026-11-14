import React, { useEffect, useState } from 'react';
import { BookOpen, Check, Lock, SearchCheck } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { PublicRoute } from './PublicPortalLayout';

interface PublicTrackViewProps {
  initialTrackingNumber?: string;
  initialVerificationCode?: string;
  onNavigate: (next: PublicRoute) => void;
}

const PUBLIC_STAGES = [
  'received',
  'under_review',
  'research_in_progress',
  'answer_preparation',
  'completed',
] as const;

export const PublicTrackView: React.FC<PublicTrackViewProps> = ({
  initialTrackingNumber = '',
  initialVerificationCode = '',
  onNavigate,
}) => {
  const { lang, t, pick } = useLanguage();
  const [trackingNumber, setTrackingNumber] = useState(initialTrackingNumber);
  const [verificationFactor, setVerificationFactor] = useState(initialVerificationCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const runTrack = async (trk: string, factor: string) => {
    setError(null);
    setResult(null);
    if (!trk.trim() || !factor.trim()) {
      setError(
        lang === 'ur'
          ? 'ٹریکنگ نمبر اور رجسٹرڈ موبائل نمبر یا تصدیقی کوڈ دونوں درج کریں۔'
          : 'Please enter both your Tracking Number and your registered Mobile Number or Verification Code.'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/public/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracking_number: trk.trim(),
          verification_factor: factor.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error((lang === 'ur' ? json.error_ur : json.error) || json.error || 'Tracking failed');
      }
      setResult(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialTrackingNumber && initialVerificationCode) {
      setTrackingNumber(initialTrackingNumber);
      setVerificationFactor(initialVerificationCode);
      runTrack(initialTrackingNumber, initialVerificationCode);
    }
  }, [initialTrackingNumber, initialVerificationCode]);

  const stageLabel = (stage: string) => {
    switch (stage) {
      case 'received':
        return t('stageReceived');
      case 'under_review':
        return t('stageUnderReview');
      case 'research_in_progress':
        return t('stageResearchInProgress');
      case 'answer_preparation':
        return t('stageAnswerPreparation');
      case 'completed':
        return t('stageCompleted');
      default:
        return stage;
    }
  };

  const activeStageIdx = result ? PUBLIC_STAGES.indexOf(result.public_stage) : -1;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="rounded-lg border border-[#D9E2EC] bg-white p-6 space-y-2">
        <div className="flex items-center gap-2 text-[#0B2545]">
          <SearchCheck className="h-5 w-5 text-[#057A4B]" />
          <h1 className="text-xl font-bold">{t('trackQuestionCta')}</h1>
        </div>
        <p className="text-xs sm:text-sm text-[#486581]">
          {lang === 'ur'
            ? 'رازداری کے تحفظ کے لیے ٹریکنگ نمبر کے ساتھ اپنا رجسٹرڈ موبائل نمبر یا تصدیقی کوڈ درج کریں۔'
            : 'For your privacy, enter your Tracking Number together with your registered Mobile Number or Verification Code.'}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runTrack(trackingNumber, verificationFactor);
        }}
        className="rounded-lg border border-[#D9E2EC] bg-white p-6 space-y-4"
      >
        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-800">{error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#0B2545] mb-1.5">
              {t('trackingNumberLabel')} *
            </label>
            <input
              type="text"
              required
              dir="ltr"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="TRK-2026-0001"
              className="w-full rounded-md border border-[#D9E2EC] px-3 py-2.5 text-sm font-mono-code text-[#0F1F38] focus:border-[#057A4B] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0B2545] mb-1.5">
              {t('verificationFactorLabel')} *
            </label>
            <input
              type="text"
              required
              dir="ltr"
              value={verificationFactor}
              onChange={(e) => setVerificationFactor(e.target.value)}
              placeholder="+92-300-5128834 or NF2026"
              className="w-full rounded-md border border-[#D9E2EC] px-3 py-2.5 text-sm font-mono-code text-[#0F1F38] focus:border-[#057A4B] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-[#627D98]">
            <Lock className="h-3.5 w-3.5 text-[#057A4B]" />
            <span>
              {lang === 'ur' ? 'داخلی تحقیقی نوٹس اور ذاتی تفصیلات خفیہ رہتی ہیں' : 'Internal notes & personal data remain private'}
            </span>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-[#057A4B] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-[#04643D] disabled:opacity-60 whitespace-nowrap"
          >
            {loading ? t('loading') : t('trackNowBtn')}
          </button>
        </div>
      </form>

      {result && (
        <div className="rounded-lg border border-[#D9E2EC] bg-white p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDF2F7] pb-4">
            <div>
              <div className="text-xs text-[#627D98]">{t('trackingNumberLabel')}</div>
              <div className="font-mono-code text-lg font-bold text-[#0B2545]" dir="ltr">
                {result.tracking_number}
              </div>
            </div>
            <div className="text-end text-xs space-y-1">
              <div className="text-[#057A4B] font-semibold">{pick(result.category_name_en, result.category_name_ur)}</div>
              <div className="font-mono-code text-[#627D98]">
                {lang === 'ur' ? `تاریخِ اندراج: ${result.submitted_date}` : `Submitted: ${result.submitted_date}`}
              </div>
            </div>
          </div>

          {/* 5-Step Public Status Stepper */}
          <div className="space-y-3">
            {PUBLIC_STAGES.map((st, idx) => {
              const done = activeStageIdx > idx || (st === 'completed' && result.public_stage === 'completed');
              const current = activeStageIdx === idx && !done;
              return (
                <div key={st} className="flex items-center gap-3">
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-mono-code font-bold border shrink-0 ${
                      done
                        ? 'bg-[#057A4B] border-[#057A4B] text-white'
                        : current
                          ? 'bg-[#0284C7] border-[#0284C7] text-white'
                          : 'bg-white border-[#D9E2EC] text-[#829AB1]'
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : idx + 1}
                  </div>
                  <div className="flex-1 flex items-center justify-between border-b border-[#EDF2F7] py-2">
                    <span
                      className={`text-sm ${
                        done || current ? 'font-bold text-[#0B2545]' : 'text-[#627D98]'
                      }`}
                    >
                      {stageLabel(st)}
                    </span>
                    {current && (
                      <span className="text-xs font-medium text-[#0284C7]">
                        {lang === 'ur' ? 'موجودہ مرحلہ' : 'Current Stage'}
                      </span>
                    )}
                    {done && (
                      <span className="text-xs font-medium text-[#057A4B]">
                        {lang === 'ur' ? 'مکمل' : 'Done'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {result.is_published && result.issued_fatwa_number && (
            <div className="rounded-md border border-[#057A4B]/30 bg-[#057A4B]/5 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs space-y-0.5">
                <div className="font-semibold text-[#057A4B]">
                  {lang === 'ur' ? 'فتویٰ پبلک پورٹل پر شائع ہو چکا ہے' : 'This Fatwa has been published'}
                </div>
                <div className="font-mono-code text-[#0B2545]">{result.issued_fatwa_number}</div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate({ page: 'fatwa_detail', identifier: result.issued_fatwa_number })}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#057A4B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#04643D]"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>{lang === 'ur' ? 'فتویٰ پڑھیں' : 'Read Published Fatwa'}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
