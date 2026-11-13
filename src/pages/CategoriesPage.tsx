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
    <div className="wrap page categories-page">
      <header className="page-intro">
        <div>
          <span className="page-eyebrow">FIND YOUR NEXT GOOD THING</span>
          <h1>Explore all categories</h1>
          <p>From farm produce and electronics to homes, vehicles and local services — discover what's available around Maua.</p>
        </div>
      </header>
      <CategoryDirectory />
    </div>
  );
}
