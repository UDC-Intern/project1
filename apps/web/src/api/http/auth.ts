import type { ChildLoginBody, ChildLoginResult, FamilyProfiles } from '@udakids/engine';
import { request } from '../client';

export const familyProfiles = (code: string) =>
  request<FamilyProfiles>(`/auth/family/${encodeURIComponent(code.trim().toUpperCase())}`);

export const childLogin = (body: ChildLoginBody) =>
  request<ChildLoginResult>('/auth/child/login', { method: 'POST', body });
