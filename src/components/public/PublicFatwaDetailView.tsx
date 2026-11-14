import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Download, Printer, Share2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { exportToPdf } from '../../lib/exports';

interface PublicFatwaDetailViewProps {
  identifier: string;
  onBack: () => void;
  onLoadedTitle?: (fatwa: any) => void;
}

export const PublicFatwaDetailView: React.FC<PublicFatwaDetailViewProps> = ({
  identifier,
  onBack,
  onLoadedTitle,
}) => {
  const { lang, t, pick } = useLanguage();
  const [fatwa, setFatwa] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/public/fatwas/${encodeURIComponent(identifier)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error((lang === 'ur' ? json.error_ur : json.error) || json.error || 'Not found');
        return json;
      })
      .then((data) => {
        if (!active) return;
        setFatwa(data);
        onLoadedTitle?.(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [identifier]);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/fatwa/${encodeURIComponent(fatwa?.issued_fatwa_number || identifier)}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleExportPdf = () => {
    if (!fatwa) return;
    exportToPdf(
      `fatwa-${fatwa.issued_fatwa_number}`,
      `Official Published Fatwa: ${fatwa.issued_fatwa_number}`,
      `Category: ${fatwa.category_name_en} | Issued: ${(fatwa.issued_at || '').slice(0, 10)}`,
      ['Field', 'Details'],
      [
        ['Fatwa Number', fatwa.issued_fatwa_number],
        ['Issuing Institution', fatwa.institution?.institution_name_en || 'Naafay Dar-ul-Ifta'],
        ['Nazim Dar-ul-Ifta', fatwa.institution?.nazim_name_en || 'Mufti Waris Naseeb'],
        ['Category', fatwa.category_name_en],
        ['Subject', fatwa.public_title_en || fatwa.issued_fatwa_number],
        ['Question Date', fatwa.question_date],
        ['Answer / Issuance Date', (fatwa.issued_at || fatwa.published_at || '').slice(0, 10)],
        ['Classical References', String((fatwa.references || []).length)],
        ...(fatwa.references || []).map((r: any, idx: number) => [
          `Reference ${idx + 1}`,
          `${r.book_name}${r.volume ? ` (${r.volume}` : ''}${r.page_number ? `, ${r.page_number})` : r.volume ? ')' : ''}`,
        ]),
      ]
    );
  };

  if (loading) {
    return <div className="h-96 rounded-lg border border-[#D9E2EC] bg-white animate-pulse" />;
  }

  if (error || !fatwa) {
    return (
      <div className="max-w-2xl mx-auto rounded-lg border border-red-200 bg-white p-8 text-center space-y-4">
        <p className="text-sm text-red-700">{error || t('noData')}</p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-md bg-[#0B2545] px-4 py-2 text-xs font-medium text-white"
        >
          <span>{lang === 'ur' ? 'فتاویٰ لائبریری پر واپس جائیں' : 'Back to Published Fatawa'}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Top Action Toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#D9E2EC] bg-white px-5 py-3.5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#0B2545] hover:text-[#057A4B]"
        >
          {lang === 'ur' ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
          <span>{t('publicPortalNavLibrary')}</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#D9E2EC] bg-white px-3.5 py-2 text-xs font-medium text-[#0B2545] hover:bg-[#F4F7FA] whitespace-nowrap"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-[#057A4B]" /> : <Share2 className="h-3.5 w-3.5 text-[#0284C7]" />}
            <span>{copied ? t('linkCopied') : t('shareLink')}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#057A4B] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#04643D] whitespace-nowrap"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>{t('downloadOfficialPdf')}</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#0B2545] bg-white px-3.5 py-2 text-xs font-medium text-[#0B2545] hover:bg-[#F4F7FA] whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{t('exportPdf')}</span>
          </button>
        </div>
      </div>

      {/* Official Clean Published Fatwa Reading Document */}
      <article className="print-container rounded-lg border border-[#D9E2EC] bg-white p-6 sm:p-10 space-y-6">
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-[#057A4B] pb-5">
          <div className="flex items-center gap-4">
            <img
              src="/assets/aistudio/naafay_logo_8857642c.jpg"
              alt="Naafay Darul Ifta"
              referrerPolicy="no-referrer"
              className="h-14 w-14 rounded-full border border-[#D9E2EC] object-contain p-0.5 bg-white shrink-0"
            />
            <div>
              <div className="text-lg font-bold text-[#0B2545]">
                {pick(fatwa.institution?.institution_name_en, fatwa.institution?.institution_name_ur) || t('brandName')}
              </div>
              <div className="text-xs text-[#057A4B] font-medium">
                {lang === 'ur' ? 'مصدقہ فتویٰ شرعیہ — عوامی رہنمائی' : 'Verified Public Fatwa Document'}
              </div>
            </div>
          </div>

          <div className="text-xs space-y-1 text-end">
            <div>
              <span className="text-[#627D98]">{t('issuedFatwaNo')}: </span>
              <span className="font-mono-code font-bold text-[#057A4B]">{fatwa.issued_fatwa_number}</span>
            </div>
            <div>
              <span className="text-[#627D98]">{t('questionDate')}: </span>
              <span className="font-mono-code text-[#0B2545]">{fatwa.question_date}</span>
            </div>
            <div>
              <span className="text-[#627D98]">{t('issuanceDateLabel')}: </span>
              <span className="font-mono-code text-[#0B2545]">{(fatwa.issued_at || fatwa.published_at || '').slice(0, 10)}</span>
            </div>
            <div>
              <span className="text-[#627D98]">{t('fatwaCategory')}: </span>
              <span className="font-semibold text-[#0284C7]">{pick(fatwa.category_name_en, fatwa.category_name_ur)}</span>
            </div>
          </div>
        </header>

        <h1 className="text-xl sm:text-2xl font-bold text-[#0B2545] leading-relaxed text-center border-b border-[#EDF2F7] pb-4">
          {pick(fatwa.public_title_en, fatwa.public_title_ur)}
        </h1>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-[#0284C7]">{t('questionLabel')}</h2>
          <div className="rounded-md border border-[#D9E2EC] bg-[#F4F7FA] p-4 sm:p-5 text-sm sm:text-base text-[#0F1F38] whitespace-pre-wrap leading-loose">
            {fatwa.public_question_text}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-[#057A4B]">{t('answerLabel')}</h2>
          <div dir="rtl" className="font-urdu text-base sm:text-lg text-[#0F1F38] whitespace-pre-wrap leading-[2.3]">
            {fatwa.public_answer_text}
          </div>
        </section>

        {fatwa.references?.length > 0 && (
          <section className="border-t border-[#D9E2EC] pt-5 space-y-3">
            <h2 className="text-sm font-bold text-[#0B2545]">{t('referencesLabel')}</h2>
            <ol className="space-y-3">
              {fatwa.references.map((r: any, idx: number) => (
                <li key={r.id} className="rounded-md border border-[#D9E2EC] bg-[#F4F7FA] p-4 text-xs sm:text-sm space-y-1.5">
                  <div className="font-semibold text-[#0B2545]">
                    ({idx + 1}) {r.book_name}
                    {r.author ? ` — ${r.author}` : ''}
                    {r.volume ? ` · ${r.volume}` : ''}
                    {r.page_number ? ` · ${r.page_number}` : ''}
                  </div>
                  <div dir="rtl" className="font-arabic text-base text-[#0F1F38]">{r.arabic_quotation}</div>
                  {r.explanation && <div className="text-xs text-[#486581]">{r.explanation}</div>}
                </li>
              ))}
            </ol>
          </section>
        )}

        <footer className="border-t-2 border-[#0B2545] pt-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-xs">
          <div className="text-[#486581]">
            <div>{lang === 'ur' ? 'جاری کردہ: نافع دارالافتاء' : 'Issued by: Naafay Dar-ul-Ifta'}</div>
            <div className="mt-1 font-mono-code">{fatwa.issued_fatwa_number}</div>
          </div>
          <div className="text-end">
            <div className="font-bold text-[#0B2545]">{t('authorizedSeal')}</div>
            <div className="text-[#057A4B] mt-0.5">
              {pick(fatwa.institution?.nazim_name_en, fatwa.institution?.nazim_name_ur) ||
                (lang === 'ur' ? 'مفتی وارث نصیب' : 'Mufti Waris Naseeb')}
            </div>
          </div>
        </footer>
      </article>
    </div>
  );
};
