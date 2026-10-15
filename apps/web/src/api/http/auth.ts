import type {
  AuthResult,
  ChildLoginBody,
  ChildLoginResult,
  FamilyProfiles,
  LoginBody,
  RegisterParentBody,
} from '@udakids/engine';
import { request } from '../client';

export const familyProfiles = (code: string) =>
  request<FamilyProfiles>(`/auth/family/${encodeURIComponent(code.trim().toUpperCase())}`);

export const childLogin = (body: ChildLoginBody) =>
  request<ChildLoginResult>('/auth/child/login', { method: 'POST', body });

export const parentRegister = (body: RegisterParentBody) =>
  request<AuthResult>('/auth/parent/register', { method: 'POST', body });

export const parentLogin = (body: LoginBody) =>
  request<AuthResult>('/auth/parent/login', { method: 'POST', body });

export const staffLogin = (body: LoginBody) =>
  request<AuthResult>('/auth/staff/login', { method: 'POST', body });
