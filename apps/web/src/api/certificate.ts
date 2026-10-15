import type { Certificate } from '@udakids/engine';
import { useSession } from '../auth/store';
import { request } from './client';
import * as mock from './mock/certificate';
import { isMocked } from './mode';

export const certificate = (bookSlug: string): Promise<Certificate> =>
  isMocked('catalog')
    ? mock.certificate(useSession.getState().session?.token ?? null, bookSlug)
    : request<Certificate>(`/certificates/${encodeURIComponent(bookSlug)}`);
