export const MAX_LOGO_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_LOGO_DATA_LENGTH = 360000;
const LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

export function validateLogoFile(file) {
  if (!LOGO_TYPES.has(file.type)) throw new Error('Choisissez une image PNG, JPG, WebP ou SVG.');
  if (!file.size) throw new Error('Ce fichier est vide.');
  if (file.size > MAX_LOGO_FILE_BYTES) throw new Error('Le logo doit faire au maximum 2 Mo.');
}

// Only embedded PNGs produced by the importer are rendered, never remote URLs or raw SVGs.
export function isCustomLogo(value) {
  return typeof value === 'string' && value.length <= MAX_LOGO_DATA_LENGTH &&
    /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(value);
}

export function logoDimensions(width, height) {
  if (!width || !height || width > 8192 || height > 8192 || width * height > 16777216) {
    throw new Error('Image trop grande ou dimensions invalides. Utilisez un logo de moins de 16 mégapixels.');
  }
  const scale = Math.min(1, 256 / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function importToolLogo(file) {
  validateLogoFile(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Impossible de lire cette image. Essayez un autre fichier.')), 10000);
      image.onload = () => { clearTimeout(timer); resolve(); };
      image.onerror = () => { clearTimeout(timer); reject(new Error('Image illisible. Essayez un autre fichier PNG, JPG, WebP ou SVG.')); };
      // SVGs load in image mode: scripts and external resources are not executed.
      image.src = url;
    });
    const dimensions = logoDimensions(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    Object.assign(canvas, dimensions);
    canvas.getContext('2d').drawImage(image, 0, 0, dimensions.width, dimensions.height);
    const logo = canvas.toDataURL('image/png');
    if (!isCustomLogo(logo)) throw new Error('Impossible de préparer ce logo. Essayez une image plus simple.');
    return logo;
  } finally {
    URL.revokeObjectURL(url);
  }
}
