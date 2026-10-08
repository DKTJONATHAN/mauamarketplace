import { CategoryDirectory } from '../components/CategoryDirectory';
import { useSeo } from '../hooks';
import { site } from '../config/site';

export function CategoriesPage() {
  useSeo({
    title: 'All categories',
    description: `Browse all categories on ${site.name} — phones, farm produce, vehicles, property, services and more in ${site.place}.`,
    path: '/categories',
  });
  return (
    <div className="wrap page">
      <h1>All categories</h1>
      <CategoryDirectory />
    </div>
  );
}
