import type {
  AdminInsights,
  InsightRange,
  AdminCatalog,
  AdminOverview,
  AdminUsers,
  ChildReport,
  LevelStats,
  PreviewResult,
  UpdateLevelBody,
  UpdateTopicBody,
} from '@udakids/engine';
import { request } from '../client';

const enc = encodeURIComponent;

export const overview = () => request<AdminOverview>('/admin/overview');
export const catalog = () => request<AdminCatalog>('/admin/catalog');
export const updateTopic = (id: string, body: UpdateTopicBody) =>
  request<void>(`/admin/topics/${enc(id)}`, { method: 'PATCH', body });
export const updateLevel = (id: string, body: UpdateLevelBody) =>
  request<void>(`/admin/levels/${enc(id)}`, { method: 'PATCH', body });
export const preview = (levelId: string, seed: number) =>
  request<PreviewResult>(`/admin/preview?levelId=${enc(levelId)}&seed=${seed}`);
export const aiAssist = (topicId: string, purpose: 'lesson' | 'curriculum') =>
  request<{ jobId: string; draft: string }>('/admin/ai/assist', {
    method: 'POST',
    body: { topicId, purpose },
  });
export const aiJobs = () =>
  request<{
    jobs: {
      id: string;
      adminName: string;
      topicTitle: string;
      purpose: string;
      model: string;
      createdAt: string;
    }[];
  }>('/admin/ai/jobs');
export const users = (q: string) => request<AdminUsers>(`/admin/users?q=${enc(q)}`);
export const setPremium = (childId: string, until: string) =>
  request<void>(`/admin/children/${enc(childId)}/premium`, { method: 'PUT', body: { until } });
export const revokePremium = (childId: string) =>
  request<void>(`/admin/children/${enc(childId)}/premium`, { method: 'DELETE' });
export const childReport = (childId: string) =>
  request<ChildReport>(`/admin/reports/children/${enc(childId)}`);
export const levelStats = () => request<LevelStats>('/admin/reports/levels');

export const insights = (range: InsightRange) =>
  request<AdminInsights>(`/admin/insights?range=${range}`);
