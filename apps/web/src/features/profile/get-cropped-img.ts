/**
 * Canvas crop util for react-easy-crop (feature plan §Avatar, web §10). Takes the source
 * image and the pixel crop area the user positioned in the circular viewport, and produces a
 * square PNG Blob. The backend re-encodes to a canonical WEBP, so we just need clean square
 * pixels here — the circular mask is purely a viewport cue (the Avatar component clips to a
 * circle wherever it renders).
 */

/** The pixel rectangle react-easy-crop reports via `onCropComplete` (croppedAreaPixels). */
export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Maximum edge of the produced square; matches the backend's canonical output size. */
const OUTPUT_SIZE = 512;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (e) => reject(e));
    image.src = src;
  });
}

export async function getCroppedBlob(imageSrc: string, crop: PixelCrop): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  // Draw the cropped square region scaled to the canonical output square.
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas toBlob failed'))),
      'image/png',
    );
  });
}
