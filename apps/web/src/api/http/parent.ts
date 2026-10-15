import type {
  ChildReport,
  CreateChildBody,
  MomoColor,
  ParentOverview,
  ParentPlan,
  Pin,
} from '@udakids/engine';
import { request } from '../client';

type ChildBrief = { id: string; nickname: string; momoColor: MomoColor; hasPin: boolean };

export const overview = () => request<ParentOverview>('/parent/overview');
export const createChild = (body: CreateChildBody) =>
  request<ChildBrief>('/parent/children', { method: 'POST', body });
export const updateChild = (id: string, body: { nickname?: string; momoColor?: MomoColor }) =>
  request<ParentOverview['children'][number]>(`/parent/children/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
  });
export const setPin = (id: string, pin: Pin) =>
  request<void>(`/parent/children/${encodeURIComponent(id)}/pin`, { method: 'PUT', body: { pin } });
export const deleteChild = (id: string) =>
  request<void>(`/parent/children/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const report = (id: string) =>
  request<ChildReport>(`/parent/children/${encodeURIComponent(id)}/report`);
export const plan = () => request<ParentPlan>('/parent/plan');
