import type { ChildLoginBody } from '@udakids/engine';
import * as http from './http/auth';
import * as mock from './mock/auth';
import { isMocked } from './mode';

// Halaman memanggil fungsi di sini. Mock atau http dipilih lewat VITE_MOCK_MODULES (tanda tangan sama).
export const familyProfiles = (code: string) =>
  isMocked('auth') ? mock.familyProfiles(code) : http.familyProfiles(code);

export const childLogin = (body: ChildLoginBody) =>
  isMocked('auth') ? mock.childLogin(body) : http.childLogin(body);
