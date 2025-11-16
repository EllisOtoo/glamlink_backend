const IMAGE_MIME_TYPE_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export const SUPPORTED_IMAGE_MIME_TYPES = Object.keys(IMAGE_MIME_TYPE_MAP);

export function normalizeMimeType(mimeType: string | undefined | null): string {
  return typeof mimeType === 'string' ? mimeType.trim().toLowerCase() : '';
}

export function resolveImageExtension(mimeType: string): string | null {
  const normalized = normalizeMimeType(mimeType);
  return IMAGE_MIME_TYPE_MAP[normalized] ?? null;
}
