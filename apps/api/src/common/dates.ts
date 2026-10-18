export const jakartaDate = (d = new Date()) =>
  new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
export const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;
export const DAY = 86_400_000;
