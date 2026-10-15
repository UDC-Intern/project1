import { describe, expect, it } from 'vitest';
import { isValidPin, pinSecret, samePin, type Pin } from '../src/pin.js';

describe('sandi gambar', () => {
  const pin: Pin = ['apple', 'star', 'fish'];

  it('menerima tepat 3 gambar yang dikenal', () => {
    expect(isValidPin(pin)).toBe(true);
    expect(isValidPin(['apple', 'star'])).toBe(false);
    expect(isValidPin(['apple', 'star', 'robot'])).toBe(false);
    expect(isValidPin('apple-star-fish')).toBe(false);
  });

  it('membuat teks rahasia berurutan', () => {
    expect(pinSecret(pin)).toBe('apple-star-fish');
  });

  it('membandingkan urutan', () => {
    expect(samePin(pin, ['apple', 'star', 'fish'])).toBe(true);
    expect(samePin(pin, ['star', 'apple', 'fish'])).toBe(false);
  });
});
