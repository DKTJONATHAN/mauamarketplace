import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** When false the dialog cannot be dismissed with Esc, the backdrop or a close button. */
  dismissible?: boolean;
}

export function Dialog({ open, onClose, title, children, dismissible = true }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        if (!dismissible) e.preventDefault();
      }}
      onClose={onClose}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="dialog-body">
          <div className="dialog-head">
            <h2 id={titleId}>{title}</h2>
            {dismissible && (
              <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
                <X aria-hidden />
              </button>
            )}
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
