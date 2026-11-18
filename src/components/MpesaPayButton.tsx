import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** M-PESA wordmark from Wikimedia Commons (File:M-PESA_LOGO-01.svg). */
const MPESA_LOGO_SRC = `${import.meta.env.BASE_URL}mpesa-logo.svg`.replace(/\/\/+/g, '/');

/** Official M-PESA mark used on all Lipa na M-PESA payment buttons. */
export function MpesaMark({ className = '' }: { className?: string }) {
  return (
    <span className={`mpesa-mark ${className}`.trim()} aria-hidden>
      <span className="mpesa-mark-badge">
        <img
          className="mpesa-mark-logo"
          src={MPESA_LOGO_SRC}
          alt=""
          width={72}
          height={38}
          decoding="async"
        />
      </span>
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
