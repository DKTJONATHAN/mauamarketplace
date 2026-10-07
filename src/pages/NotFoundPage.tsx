import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks';

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="wrap page narrow">
      <h1>Page not found</h1>
      <p>That page does not exist. It may have moved, or the link may be wrong.</p>
      <Link to="/" className="btn btn-primary">Go to the home page</Link>
    </div>
  );
}
