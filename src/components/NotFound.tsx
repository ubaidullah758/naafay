import React from 'react';
import { Compass, ArrowLeft, ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface NotFoundProps {
  onGoHome?: () => void;
  onGoBack?: () => void;
}

/**
 * Real 404 screen. Unknown URLs used to be silently rendered as the home page,
 * which confuses users and produces "soft 404" pages for search engines.
 */
export const NotFound: React.FC<NotFoundProps> = ({ onGoHome, onGoBack }) => {
  const { lang } = useLanguage();
  const isUr = lang === 'ur';
  const BackIcon = isUr ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-[#DCE4E0] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#065F46]/10 text-[#065F46]">
          <Compass className="h-6 w-6" />
        </div>
        <p className="mt-4 text-3xl font-bold tabular-nums text-[#111C18]">404</p>
        <h1 className="mt-2 text-base font-bold text-[#111C18]">
          {isUr ? 'صفحہ نہیں ملا' : 'Page not found'}
        </h1>
        <p className="mt-2 text-sm text-[#4A5D55]">
          {isUr
            ? 'جو صفحہ آپ تلاش کر رہے ہیں وہ موجود نہیں یا منتقل ہو چکا ہے۔'
            : 'The page you are looking for does not exist or has been moved.'}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {onGoBack && (
            <button
              type="button"
              onClick={onGoBack}
              className="inline-flex items-center gap-2 rounded-md border border-[#DCE4E0] px-4 py-2 text-xs font-medium text-[#374841] hover:bg-[#F6F8F7]"
            >
              <BackIcon className="h-3.5 w-3.5" />
              <span>{isUr ? 'واپس جائیں' : 'Go back'}</span>
            </button>
          )}
          {onGoHome && (
            <button
              type="button"
              onClick={onGoHome}
              className="inline-flex items-center gap-2 rounded-md bg-[#065F46] px-4 py-2 text-xs font-medium text-white hover:bg-[#064E3B]"
            >
              <span>{isUr ? 'مرکزی صفحہ' : 'Home'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
