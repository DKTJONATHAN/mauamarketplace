import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Official-style Lipa na M-PESA payment button (green Safaricom/M-PESA treatment). */
export function MpesaMark({ className = '' }: { className?: string }) {
  return (
    <span className={`mpesa-mark ${className}`.trim()} aria-hidden>
      <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
        <rect x="3" y="2" width="18" height="20" rx="3" fill="#fff" />
        <path d="M7 7h10v2.2H9.6V17H7V7zm4.2 4.2H17V13h-3.2v4H11.2v-5.8z" fill="#00A651" />
      </svg>
      <span className="mpesa-mark-text">
        <span className="mpesa-mark-lipa">LIPA NA</span>
        <span className="mpesa-mark-mpesa">M-PESA</span>
      </span>
    </span>
  );
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingLabel?: string;
  children?: ReactNode;
  fullWidth?: boolean;
};

export function MpesaPayButton({
  loading = false,
  loadingLabel = 'Sending M-PESA prompt…',
  children,
  fullWidth = false,
  className = '',
  disabled,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`mpesa-pay-btn ${fullWidth ? 'is-full' : ''} ${className}`.trim()}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="mpesa-pay-label">{loadingLabel}</span>
      ) : (
        <>
          <MpesaMark />
          <span className="mpesa-pay-label">{children ?? 'Pay with M-PESA'}</span>
        </>
      )}
    </button>
  );
}
