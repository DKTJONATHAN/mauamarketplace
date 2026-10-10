import { Link } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { getCategory, homeCategorySlugs } from '../config/categories';

export function CategoryShortcuts() {
  return (
    <nav className="wrap shortcuts" aria-label="Shop by category">
      <ul>
        {homeCategorySlugs.map((slug) => {
          const c = getCategory(slug);
          return (
            <li key={slug}>
              <Link to={`/category/${slug}`}>
                <span className="shortcut-icon"><c.icon aria-hidden /></span>
                <span className="shortcut-label">{c.label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <Link to="/categories">
            <span className="shortcut-icon shortcut-all"><LayoutGrid aria-hidden /></span>
            <span className="shortcut-label">All categories</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
