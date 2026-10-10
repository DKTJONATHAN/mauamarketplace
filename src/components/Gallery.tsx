import { useRef, useState, type TouchEvent } from 'react';
import { ListingImage } from './ListingImage';

export function Gallery({ images, category, title }: { images: string[]; category: string; title: string }) {
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);
  const last = Math.max(0, images.length - 1);
  const shown = Math.min(index, last);
  const current = images[shown];

  function onTouchStart(e: TouchEvent) {
    startX.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(e: TouchEvent) {
    if (startX.current === null || images.length < 2) return;
    const dx = (e.changedTouches[0]?.clientX ?? startX.current) - startX.current;
    startX.current = null;
    if (Math.abs(dx) < 40) return;
    setIndex(dx < 0 ? Math.min(shown + 1, last) : Math.max(shown - 1, 0));
  }

  return (
    <div className="gallery">
      <div className="gallery-main" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <ListingImage key={current ?? 'none'} path={current} category={category} alt={title} eager />
        {images.length > 1 && <span className="gallery-count" aria-hidden="true">{shown + 1}/{images.length}</span>}
      </div>
      {images.length > 1 && (
        <ul className="gallery-thumbs" aria-label="Photos">
          {images.map((path, i) => (
            <li key={path}>
              <button
                type="button"
                className={i === shown ? 'is-current' : ''}
                aria-label={`Show photo ${i + 1} of ${images.length}`}
                aria-current={i === shown}
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
