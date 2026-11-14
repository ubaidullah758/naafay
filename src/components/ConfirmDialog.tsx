import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useLanguage();

  return (
    <Modal open={open} onClose={onCancel} labelledBy="confirm-dialog-title">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${danger ? 'bg-red-50 text-red-700' : 'bg-[#065F46]/10 text-[#065F46]'}`}>
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 id="confirm-dialog-title" className="text-base font-semibold text-[#111C18]">{title}</h3>
          <p className="mt-2 text-sm text-[#4A5D55]">{message}</p>
        </div>
      </div>
      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="whitespace-nowrap shrink-0 rounded-md border border-[#DCE4E0] bg-white px-4 py-2 text-sm font-medium text-[#374841] hover:bg-[#F6F8F7] transition-colors"
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`whitespace-nowrap shrink-0 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors ${
            danger ? 'bg-red-700 hover:bg-red-800' : 'bg-[#065F46] hover:bg-[#064E3B]'
          }`}
        >
          {confirmLabel || t('confirm')}
        </button>
      </div>
    </Modal>
  );
};
