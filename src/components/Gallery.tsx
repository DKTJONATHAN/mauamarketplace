import { useState } from 'react';
import { ListingImage } from './ListingImage';

export function Gallery({ images, category, title }: { images: string[]; category: string; title: string }) {
  const [index, setIndex] = useState(0);
  const current = images[Math.min(index, Math.max(0, images.length - 1))];
  return (
    <div className="gallery">
      <div className="gallery-main">
        <ListingImage key={current ?? 'none'} path={current} category={category} alt={title} eager />
      </div>
      {images.length > 1 && (
        <ul className="gallery-thumbs" aria-label="Photos">
          {images.map((path, i) => (
            <li key={path}>
              <button
                type="button"
                className={i === index ? 'is-current' : ''}
                aria-label={`Show photo ${i + 1} of ${images.length}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
              >
                <ListingImage path={path} category={category} alt="" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
