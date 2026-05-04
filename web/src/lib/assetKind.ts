import type { AssetKind } from '../domain/types';

export function guessAssetKindFromFile(file: File): AssetKind {
  const t = file.type;
  if (t === 'application/pdf') return 'pdf';
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  return 'document';
}
