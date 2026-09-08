import { useEffect, useRef } from 'react';

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  useEffect(() => cancel.current?.focus(), []);
  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-describedby="confirm-dialog-message"
        aria-labelledby="confirm-dialog-title"
        aria-modal="true"
        className="confirm-dialog"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel();
          if (event.key === 'Tab') {
            if (event.shiftKey && document.activeElement === cancel.current) {
              event.preventDefault();
              confirm.current?.focus();
            } else if (!event.shiftKey && document.activeElement === confirm.current) {
              event.preventDefault();
              cancel.current?.focus();
            }
          }
        }}
        role="dialog"
      >
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-message">{message}</p>
        <div className="row-actions">
          <button ref={cancel} onClick={onCancel} type="button">
            Keep editing
          </button>
          <button ref={confirm} className="button button--danger" onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
