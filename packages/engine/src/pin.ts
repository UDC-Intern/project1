export const PIN_PICTURES = [
  'apple',
  'star',
  'fish',
  'flower',
  'ball',
  'cat',
  'house',
  'cloud',
  'leaf',
] as const;
export type PinPicture = (typeof PIN_PICTURES)[number];
export type Pin = [PinPicture, PinPicture, PinPicture];

export const PIN_LENGTH = 3;
export const PIN_MAX_ATTEMPTS = 5;
/** Lama kunci makin panjang bila anak terkunci lagi: 1, 5, 30, lalu 120 menit. */
export const PIN_LOCK_STEPS_MS = [60_000, 300_000, 1_800_000, 7_200_000] as const;

/** `lockCount` = jumlah kunci beruntun yang sudah terjadi, termasuk yang sedang dipasang (minimal 1). */
export const pinLockMs = (lockCount: number): number =>
  PIN_LOCK_STEPS_MS[Math.min(Math.max(lockCount, 1), PIN_LOCK_STEPS_MS.length) - 1]!;

export function isValidPin(value: unknown): value is Pin {
  return (
    Array.isArray(value) &&
    value.length === PIN_LENGTH &&
    value.every((v) => (PIN_PICTURES as readonly unknown[]).includes(v))
  );
}

/** Teks yang di-hash di server, mis. "apple-star-fish". */
export function pinSecret(pin: Pin): string {
  return pin.join('-');
}

export const samePin = (a: Pin, b: Pin): boolean => a.every((p, i) => p === b[i]);
