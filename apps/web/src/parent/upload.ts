import { PROOF_MAX_BYTES, PROOF_TYPES } from '@udakids/engine';
import { ApiError } from '../api/client';
import { getSession, setSession } from '../auth/session';
import { api } from '../api/pageApi';
import { isMocked } from '../api/mode';
import { API_URL } from '../config/app';
import { t } from '../i18n';
import type { Order } from './billingTypes';

/** Cek bukti di perangkat dulu (server tetap memeriksa isi file). `undefined` = boleh dikirim. */
export function proofProblem(file: { size: number; type: string }): string | undefined {
  if (!(PROOF_TYPES as readonly string[]).includes(file.type)) return t('parent.order.proofType');
  if (file.size > PROOF_MAX_BYTES) return t('parent.order.proofSize');
  if (file.size === 0) return t('parent.order.proofEmpty');
  return undefined;
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const token = getSession('parent')?.token;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ApiError(0, t('common.error.offline'));
  }
  if (!res.ok) {
    if (res.status === 401) setSession('parent', null);
    let message = res.statusText;
    try {
      const body = (await res.json()) as { message?: unknown };
      if (typeof body.message === 'string') message = body.message;
    } catch {
      /* badan bukan JSON */
    }
    throw new ApiError(res.status, message);
  }
  return res;
}

/** Unggah bukti transfer: badan = isi file mentah dengan Content-Type sesuai jenis file. */
const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export async function uploadProof(orderId: string, file: Blob): Promise<Order> {
  if (isMocked('parent')) {
    const f = file as File;
    return api<Order>(`/parent/orders/${orderId}/proof`, {
      method: 'PUT',
      token: getSession('parent')?.token ?? null,
      body: {
        fileName: f.name || 'bukti',
        mime: file.type,
        size: file.size,
        dataUrl: await toDataUrl(file),
      },
    });
  }
  const res = await send(`/parent/orders/${orderId}/proof`, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  return (await res.json()) as Order;
}

/** Ambil bukti yang sudah diunggah (butuh token, jadi lewat fetch → Blob). */
export async function fetchProof(orderId: string): Promise<Blob> {
  if (isMocked('parent')) {
    const res = await api<{ dataUrl: string | null }>(`/parent/orders/${orderId}/proof`, {
      token: getSession('parent')?.token ?? null,
    });
    if (!res.dataUrl) throw new ApiError(404, { code: 'NOT_FOUND', message: 'Bukti belum ada.' });
    return (await fetch(res.dataUrl)).blob();
  }
  const res = await send(`/parent/orders/${orderId}/proof`, { method: 'GET' });
  return res.blob();
}
