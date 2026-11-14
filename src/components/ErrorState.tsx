import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface ErrorStateProps {
  message?: string | null;
  onRetry?: () => void;
  /** Compact variant for inline cards (e.g. public portal widgets). */
  compact?: boolean;
}

/**
 * Standard "load failed" panel used by every data view. Replaces the old
 * behaviour where a failed fetch silently rendered an empty table.
 */
export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry, compact = false }) => {
  const { lang, t } = useLanguage();

  return (
    <div
      className={`rounded-lg border border-red-200 bg-white text-center ${
        compact ? 'p-4' : 'p-6'
      }`}
      role="alert"
    >
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-700">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className={`mt-3 text-red-700 ${compact ? 'text-xs' : 'text-sm'}`}>
        {message || t('errorLoad')}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#065F46] px-4 py-2 text-xs font-medium text-white hover:bg-[#064E3B]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>{lang === 'ur' ? 'دوبارہ کوشش کریں' : 'Retry'}</span>
        </button>
      )}
    </div>
  );
};
