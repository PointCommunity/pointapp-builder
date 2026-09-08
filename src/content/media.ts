import { z } from 'zod';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export const MediaInputSchema = z.strictObject({
  kind: z.enum(['image', 'audio', 'video']),
  title: z.string().trim().min(1).max(120),
  altText: z.string().trim().min(1).max(500).optional(),
  externalUrl: z
    .url()
    .refine((value) => value.startsWith('https://'))
    .optional(),
  captionUrl: z
    .url()
    .refine((value) => value.startsWith('https://'))
    .optional(),
  expectedSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
});
export type MediaInput = z.infer<typeof MediaInputSchema>;

function readU32(bytes: Uint8Array, offset: number, little = false): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, little);
}

export function imageDimensions(
  bytes: Uint8Array,
  mimeType: string,
): { width: number; height: number } | null {
  if (
    mimeType === 'image/png' &&
    bytes.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
  )
    return { width: readU32(bytes, 16), height: readU32(bytes, 20) };
  if (
    mimeType === 'image/webp' &&
    bytes.length >= 30 &&
    new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP' &&
    new TextDecoder().decode(bytes.slice(12, 16)) === 'VP8X'
  ) {
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    return { width, height };
  }
  if (
    mimeType === 'image/avif' &&
    bytes.length >= 16 &&
    new TextDecoder().decode(bytes.slice(4, 8)) === 'ftyp' &&
    ['avif', 'avis'].includes(new TextDecoder().decode(bytes.slice(8, 12)))
  ) {
    for (let offset = 4; offset + 12 <= bytes.length; offset += 1) {
      if (new TextDecoder().decode(bytes.slice(offset, offset + 4)) === 'ispe')
        return { width: readU32(bytes, offset + 4), height: readU32(bytes, offset + 8) };
    }
  }
  if (mimeType === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
      if (
        [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
          marker,
        )
      ) {
        return {
          height: (bytes[offset + 5] << 8) + bytes[offset + 6],
          width: (bytes[offset + 7] << 8) + bytes[offset + 8],
        };
      }
      offset += Math.max(length + 2, 2);
    }
  }
  return null;
}
