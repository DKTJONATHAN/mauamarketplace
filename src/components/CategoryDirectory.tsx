import { Link } from 'react-router-dom';
import { categoryGroups } from '../config/categories';

export function CategoryDirectory() {
  return (
    <div className="directory">
      {categoryGroups.map((group) => (
        <section key={group.name} className="directory-group" aria-labelledby={`grp-${group.name}`}>
          <h3 id={`grp-${group.name}`}>{group.name}</h3>
          <ul>
            {group.items.map((c) => (
              <li key={c.slug}>
                <Link to={`/browse?cat=${c.slug}`}>
                  <c.icon aria-hidden />
                  <span>{c.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
