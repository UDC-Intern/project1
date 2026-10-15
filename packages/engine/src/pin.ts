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
export const PIN_LOCK_MS = 60_000;

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
