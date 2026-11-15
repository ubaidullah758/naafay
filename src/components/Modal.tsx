import React, { useCallback, useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** id of the element that labels this dialog (usually the heading). */
  labelledBy: string;
  children: React.ReactNode;
  /** Extra classes for the inner panel. */
  panelClassName?: string;
  /** Set false when the dialog should only close via its own buttons. */
  closeOnBackdrop?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal shell.
 *
 * Before this existed every dialog was a bare `div[role=dialog]`: keyboard users
 * could tab into the page behind it, Escape did nothing, and screen readers got
 * no title. This wraps focus, restores it on close, and keeps the background
 * from scrolling.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  labelledBy,
  children,
  panelClassName = 'w-full max-w-md rounded-lg border border-[#DCE4E0] bg-white p-4 sm:p-6 shadow-lg max-h-[90vh] overflow-y-auto',
  closeOnBackdrop = true,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      }
    },
    []
  );

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Set initial focus once when the modal is opened
    const firstInput = panel?.querySelector<HTMLElement>('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])')
      || panel?.querySelector<HTMLElement>(FOCUSABLE);
    (firstInput ?? panel)?.focus();

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const keyListener = (e: KeyboardEvent) => handleKeyDown(e);
    document.addEventListener('keydown', keyListener, true);

    return () => {
      document.removeEventListener('keydown', keyListener, true);
      document.body.style.overflow = originalOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onMouseDown={(event) => {
        if (!closeOnBackdrop) return;
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={panelRef} tabIndex={-1} className={panelClassName}>
        {children}
      </div>
    </div>
  );
};
