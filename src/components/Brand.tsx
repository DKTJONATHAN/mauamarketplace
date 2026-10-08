import { Link } from 'react-router-dom';
import { site } from '../config/site';

const LOGO_SRC = `${import.meta.env.BASE_URL}logo.png`;

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <img
      src={LOGO_SRC}
      width={size}
      height={size}
      className="brand-logo-mark"
      alt=""
      aria-hidden="true"
    />
  );
}

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label={`${site.name} home`}>
      <img src={LOGO_SRC} className="brand-logo" alt={site.name} />
    </Link>
  );
}
