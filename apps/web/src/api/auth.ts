import type { ChildLoginBody, LoginBody, RegisterParentBody } from '@udakids/engine';
import * as http from './http/auth';
import * as accounts from './mock/accounts';
import * as mock from './mock/auth';
import * as staff from './mock/staff';
import { isMocked } from './mode';

// Halaman memanggil fungsi di sini. Mock atau http dipilih lewat VITE_MOCK_MODULES (tanda tangan sama).
export const familyProfiles = (code: string) =>
  isMocked('auth') ? mock.familyProfiles(code) : http.familyProfiles(code);

export const childLogin = (body: ChildLoginBody) =>
  isMocked('auth') ? mock.childLogin(body) : http.childLogin(body);

export const parentRegister = (body: RegisterParentBody) =>
  isMocked('auth') ? accounts.parentRegister(body) : http.parentRegister(body);

export const parentLogin = (body: LoginBody) =>
  isMocked('auth') ? accounts.parentLogin(body) : http.parentLogin(body);

export const staffLogin = (body: LoginBody) =>
  isMocked('auth') ? staff.staffLogin(body) : http.staffLogin(body);
