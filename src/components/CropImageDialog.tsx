import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Check, Move, X } from 'lucide-react';

interface Props {
  file: File;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}

interface Metrics {
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
  baseScale: number;
}

const OUTPUT_SIZE = 1000;

/** Square cover-photo cropper. It only processes the image selected as the listing cover. */
export function CropImageDialog({ file, onCancel, onConfirm }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function measureImage() {
    const image = imageRef.current;
    const stage = stageRef.current;
    if (!image || !stage || !image.naturalWidth || !image.naturalHeight) return;
    const rect = stage.getBoundingClientRect();
    const baseScale = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
    setMetrics({
      width: rect.width,
      height: rect.height,
      imageWidth: image.naturalWidth,
      imageHeight: image.naturalHeight,
      baseScale,
    });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  useEffect(() => {
    if (!imageUrl) return;
    const frame = requestAnimationFrame(measureImage);
    window.addEventListener('resize', measureImage);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measureImage);
    };
  }, [imageUrl]);

  function clampOffset(next: { x: number; y: number }, nextZoom = zoom) {
    if (!metrics) return next;
    const renderedWidth = metrics.imageWidth * metrics.baseScale * nextZoom;
    const renderedHeight = metrics.imageHeight * metrics.baseScale * nextZoom;
    return {
      x: Math.max(-(renderedWidth - metrics.width) / 2, Math.min((renderedWidth - metrics.width) / 2, next.x)),
      y: Math.max(-(renderedHeight - metrics.height) / 2, Math.min((renderedHeight - metrics.height) / 2, next.y)),
    };
  }

  function changeZoom(value: number) {
    setZoom(value);
    setOffset((current) => clampOffset(current, value));
  }

  function pointerDown(e: PointerEvent<HTMLDivElement>) {
    if (working) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, offsetX: offset.x, offsetY: offset.y };
  }

  function pointerMove(e: PointerEvent<HTMLDivElement>) {
    const start = dragRef.current;
    if (!start) return;
    setOffset(clampOffset({
      x: start.offsetX + e.clientX - start.x,
      y: start.offsetY + e.clientY - start.y,
    }));
  }

  function pointerUp() {
    dragRef.current = null;
  }

  async function confirmCrop() {
    const image = imageRef.current;
    if (!image || !metrics || working) return;
    setWorking(true);
    setError('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Your browser could not crop this photo.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      const outputScale = OUTPUT_SIZE / metrics.width;
      const renderedWidth = metrics.imageWidth * metrics.baseScale * zoom;
      const renderedHeight = metrics.imageHeight * metrics.baseScale * zoom;
      const left = (metrics.width - renderedWidth) / 2 + offset.x;
      const top = (metrics.height - renderedHeight) / 2 + offset.y;
      context.drawImage(
        image,
        left * outputScale,
        top * outputScale,
        renderedWidth * outputScale,
        renderedHeight * outputScale,
      );
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/webp', 0.9);
      });
      if (!blob) throw new Error('Your browser could not crop this photo. Try another image.');
      onConfirm(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not crop this photo.');
      setWorking(false);
    }
  }

  return (
    <div className="crop-overlay" role="presentation">
      <section className="crop-dialog" role="dialog" aria-modal="true" aria-labelledby="crop-title">
        <header className="crop-head">
          <div>
            <h2 id="crop-title">Crop display photo</h2>
            <p>Drag to position the photo, then zoom until it looks right.</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Cancel crop" onClick={onCancel} disabled={working}>
            <X aria-hidden />
          </button>
        </header>

        <div
          ref={stageRef}
          className={`crop-stage${metrics ? ' is-ready' : ''}`}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onLostPointerCapture={pointerUp}
          aria-label="Photo crop area. Drag the photo to reposition it."
        >
          {imageUrl && (
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Photo being cropped"
              draggable={false}
              onLoad={measureImage}
              style={metrics ? {
                width: metrics.imageWidth * metrics.baseScale,
                height: metrics.imageHeight * metrics.baseScale,
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              } : { visibility: 'hidden' }}
            />
          )}
          {!metrics && <span className="crop-loading">Preparing photo…</span>}
        </div>

        <label className="crop-zoom">
          <span>Zoom</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => changeZoom(Number(e.target.value))}
            disabled={!metrics || working}
          />
          <output>{zoom.toFixed(1)}×</output>
        </label>
        <p className="crop-tip"><Move aria-hidden /> The display photo is square. Other photos will stay unchanged.</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="actions crop-actions">
          <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={working}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={confirmCrop} disabled={!metrics || working}>
            <Check aria-hidden /> {working ? 'Cropping…' : 'Use this crop'}
          </button>
        </div>
      </section>
    </div>
  );
}
