import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { defaultNotice, getCategory } from '../config/categories';

export function SafetyPanel({ category }: { category: string }) {
  const notice = getCategory(category).notice;
  return (
    <aside className="safety-panel" aria-labelledby="safety-title">
      <h2 id="safety-title">
        <ShieldAlert aria-hidden /> Before you pay
      </h2>
      <p>{notice ?? defaultNotice}</p>
      {notice ? (
        <details>
          <summary>More safety tips</summary>
          <p>{defaultNotice}</p>
          <p>
            <Link to="/safety">Read all safety tips</Link>
          </p>
        </details>
      ) : (
        <p>
          <Link to="/safety">Read all safety tips</Link>
        </p>
      )}
    </aside>
  );
}
