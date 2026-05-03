import { randomBytes } from 'node:crypto';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export function randomTempPassword(length = 18): string {
  const buf = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += CHARS[buf[i]! % CHARS.length]!;
  return out;
}
