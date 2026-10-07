import { Link } from 'react-router-dom';
import { site } from '../config/site';

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="12" fill="#f5b700" />
      <path d="M6 48 22 25l9 12 8-10 19 21z" fill="#0a4a31" />
      <path d="M6 48 22 25l9 12-6 11z" fill="#0f6b45" />
    </svg>
  );
}

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label={`${site.name} home`}>
      <LogoMark />
      <span className="brand-name">{site.name}</span>
    </Link>
  );
}
