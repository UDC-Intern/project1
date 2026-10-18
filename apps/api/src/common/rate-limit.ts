import { fail } from './errors.js';

export class RateLimiter {
  private hits = new Map<string, number[]>();
  private calls = 0;
  private max: number;
  constructor(
    max: number,
    private windowMs: number,
    private now = Date.now,
    private maxKeys = 20_000,
  ) {
    this.max = Math.max(1, Math.round(max * Number(process.env.RATE_LIMIT_SCALE ?? 1)));
  }
  private recent(key: string) {
    const list = (this.hits.get(key) ?? []).filter((t) => this.now() - t < this.windowMs);
    if (list.length) this.hits.set(key, list);
    else this.hits.delete(key);
    return list;
  }
  check(key: string) {
    if (++this.calls % 500 === 0 || this.hits.size >= this.maxKeys) {
      for (const k of this.hits.keys()) this.recent(k);
      while (this.hits.size >= this.maxKeys) this.hits.delete(this.hits.keys().next().value!);
    }
    if (this.recent(key).length >= this.max)
      fail(429, 'RATE_LIMITED', 'Terlalu banyak percobaan. Coba lagi nanti.');
  }
  fail(key: string) {
    this.hits.set(key, [...this.recent(key), this.now()].slice(-this.max));
  }
  reset(key: string) {
    this.hits.delete(key);
  }
  take(key: string) {
    this.check(key);
    this.fail(key);
  }
}
