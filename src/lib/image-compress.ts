const MAX_PROFILE_PHOTO_BYTES = 50 * 1024;
const MAX_DIMENSION = 512;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function isAcceptedImageType(type: string): boolean {
  return ACCEPTED_TYPES.includes(type);
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this image file.'));
    };
    image.src = url;
  });
}

function scaledDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) {
    return { width, height };
  }
  const ratio = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function drawImageToCanvas(
  image: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not prepare image canvas.');
  }
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to encode compressed image.'));
    reader.readAsDataURL(blob);
  });
}

async function compressCanvasToLimit(
  source: HTMLCanvasElement,
  maxBytes: number,
): Promise<string> {
  const qualities = [0.88, 0.8, 0.72, 0.64, 0.56, 0.48, 0.4, 0.32];
  let maxSide = Math.max(source.width, source.height);

  while (maxSide >= 96) {
    const scale = maxSide / Math.max(source.width, source.height);
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = drawImageToCanvas(source, width, height);

    for (const quality of qualities) {
      const blob = await canvasToBlob(canvas, quality);
      if (blob && blob.size <= maxBytes) {
        return blobToDataUrl(blob);
      }
    }

    maxSide = Math.round(maxSide * 0.82);
  }

  throw new Error('Could not compress image below 50 KB. Try a simpler photo.');
}

export async function compressProfilePhotoFile(
  file: File,
  maxBytes = MAX_PROFILE_PHOTO_BYTES,
): Promise<{ dataUrl: string; sizeBytes: number }> {
  if (!isAcceptedImageType(file.type)) {
    throw new Error('Use a JPG, PNG, WebP, or GIF image.');
  }

  const image = await loadImageFromFile(file);
  const { width, height } = scaledDimensions(
    image.naturalWidth,
    image.naturalHeight,
    MAX_DIMENSION,
  );
  const canvas = drawImageToCanvas(image, width, height);
  const dataUrl = await compressCanvasToLimit(canvas, maxBytes);
  const base64 = dataUrl.split(',')[1] ?? '';
  const sizeBytes = Math.ceil((base64.length * 3) / 4);

  return { dataUrl, sizeBytes };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}
