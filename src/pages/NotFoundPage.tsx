import { Link } from 'react-router-dom';
import { useSeo } from '../hooks';

export function NotFoundPage() {
  useSeo({ title: 'Page not found', noindex: true, path: '/not-found' });
  return (
    <div className="wrap page narrow">
      <h1>Page not found</h1>
      <p>That page does not exist. It may have moved, or the link may be wrong.</p>
      <Link to="/" className="btn btn-primary">Go to the home page</Link>
    </div>
  );
}
