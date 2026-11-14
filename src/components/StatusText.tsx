import React from 'react';
import { CheckCircle2, Clock, AlertCircle, XCircle, Archive, BookOpen, Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { TranslationKey } from '../i18n/translations';

interface StatusTextProps {
  status: string;
}

export const StatusText: React.FC<StatusTextProps> = ({ status }) => {
  const { t } = useLanguage();
  const key = status as TranslationKey;
  const label = t(key) || status;

  switch (status) {
    case 'active':
    case 'present':
    case 'approved':
    case 'published':
    case 'completed':
    case 'issued':
    case 'approved_for_final':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#057A4B] whitespace-nowrap">
          {status === 'published' ? <Globe className="h-3.5 w-3.5 shrink-0 text-[#0284C7]" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
          <span>{label}</span>
        </span>
      );
    case 'pending':
    case 'late':
    case 'needs_correction':
    case 'on_leave':
    case 'leave':
    case 'scheduled':
    case 'ongoing':
    case 'submitted':
    case 'resubmitted':
    case 'research':
    case 'draft':
    case 'senior_review':
    case 'final_approval':
    case 'corrections_requested':
    case 'returned':
    case 'returned_to_review':
    case 'pending_publication':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B45309] whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>{label}</span>
        </span>
      );
    case 'absent':
    case 'suspended':
    case 'withdrawn':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B91C1C] whitespace-nowrap">
          <XCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{label}</span>
        </span>
      );
    case 'archived':
    case 'graduated':
    case 'internal_only':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0B2545] whitespace-nowrap">
          <Archive className="h-3.5 w-3.5 shrink-0" />
          <span>{label}</span>
        </span>
      );
    case 'assigned':
    case 'registered':
    case 'received':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0284C7] whitespace-nowrap">
          <BookOpen className="h-3.5 w-3.5 shrink-0" />
          <span>{label}</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#486581] whitespace-nowrap">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{label}</span>
        </span>
      );
  }
};
