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
  request<AuthResult | { verificationRequired: true; email: string }>('/auth/parent/register', {
    method: 'POST',
    body,
  });

export const parentVerify = (body: { email: string; code: string }) =>
  request<AuthResult>('/auth/parent/verify', { method: 'POST', body });

export const parentResend = (body: { email: string }) =>
  request<{ ok: true }>('/auth/parent/resend', { method: 'POST', body });

export const parentLogin = (body: LoginBody) =>
  request<AuthResult>('/auth/parent/login', { method: 'POST', body });

export type GoogleAuthResult = AuthResult | { needsConsent: true; email: string; name: string };
export const parentGoogle = (body: { credential: string; consent?: boolean; name?: string }) =>
  request<GoogleAuthResult>('/auth/parent/google', { method: 'POST', body });

export const staffLogin = (body: LoginBody) =>
  request<AuthResult>('/auth/staff/login', { method: 'POST', body });
