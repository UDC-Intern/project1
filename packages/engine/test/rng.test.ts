import { describe, expect, it } from 'vitest';
import { mulberry32, seedFrom, shuffle, xmur3 } from '../src/rng.js';

describe('rng ber-seed', () => {
  it('xmur3 memberi deret yang sama untuk teks sama', () => {
    const a = xmur3('ronde-1');
    const b = xmur3('ronde-1');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(seedFrom('a')).not.toBe(seedFrom('b'));
  });

  it('mulberry32 deterministik dan berada di [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 50; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('shuffle dengan seed sama memberi urutan sama dan tidak mengubah masukan', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const copy = [...items];
    const one = shuffle(items, 'abc');
    expect(shuffle(items, 'abc')).toEqual(one);
    expect(items).toEqual(copy);
    expect([...one].sort((x, y) => x - y)).toEqual(items);
  });

  it('shuffle menerima seed angka dan seed berbeda biasanya mengubah urutan', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffle(items, 1)).toEqual(shuffle(items, 1));
    expect(shuffle(items, 1)).not.toEqual(shuffle(items, 2));
  });
});
