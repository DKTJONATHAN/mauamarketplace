import { CategoryDirectory } from '../components/CategoryDirectory';
import { useDocumentTitle } from '../hooks';

export function CategoriesPage() {
  useDocumentTitle('All categories');
  return (
    <div className="wrap page">
      <h1>All categories</h1>
      <CategoryDirectory />
    </div>
  );
}
