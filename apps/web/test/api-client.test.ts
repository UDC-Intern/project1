import { afterEach, describe, expect, it, vi } from 'vitest';
import { request } from '../src/api/client';

describe('request', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mengirim satu request untuk klik berulang pada aksi yang sama', async () => {
    let finish!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockReturnValue(response);
    const action = { email: 'anak@example.test' };

    const first = request('/parent/account/email', { body: action });
    const second = request('/parent/account/email', { body: action });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    finish(new Response(JSON.stringify({ sent: true }), { status: 200 }));
    await expect(Promise.all([first, second])).resolves.toEqual([{ sent: true }, { sent: true }]);

    await request('/parent/account/email', { body: action });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
