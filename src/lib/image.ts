/**
 * Prepares a photo for upload: fixes rotation, shrinks it, and re-encodes it.
 * Re-encoding through a canvas drops all EXIF metadata, including GPS location,
 * so sellers do not accidentally publish where they live.
 */
const MAX_SIDE = 1280;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

export interface PreparedImage {
  blob: Blob;
  ext: 'webp' | 'jpg';
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('This photo could not be read. Try a JPEG or PNG image.');
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error('Only JPEG, PNG or WebP photos can be uploaded.');
  }
  if (file.size > 25 * 1024 * 1024) throw new Error('That photo is too large. Choose one under 25 MB.');

  const decoded = await decode(file);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not process this photo.');
    ctx.fillStyle = '#ffffff'; // flatten transparency so JPEG fallback does not turn black
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(decoded.source, 0, 0, width, height);

    let blob = await toBlob(canvas, 'image/webp', 0.82);
    let ext: 'webp' | 'jpg' = 'webp';
    if (!blob || blob.type !== 'image/webp') {
      blob = await toBlob(canvas, 'image/jpeg', 0.85);
      ext = 'jpg';
    }
    if (!blob) throw new Error('Your browser could not process this photo.');
    if (blob.size > 1_400_000) {
      const smaller = await toBlob(canvas, ext === 'webp' ? 'image/webp' : 'image/jpeg', 0.6);
      if (smaller && smaller.size < blob.size) blob = smaller;
    }
    if (blob.size > 1_500_000) throw new Error('That photo is still too large after shrinking. Try a different one.');
    return { blob, ext };
  } finally {
    decoded.close();
  }
}
