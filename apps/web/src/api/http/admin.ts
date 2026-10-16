import type {
  AdminCertificates,
  AdminInsights,
  Certificate,
  CertificateDesign,
  ClaimCertificateBody,
  InsightRange,
  AdminCatalog,
  AdminOverview,
  PreviewResult,
} from '@udakids/engine';
import { request } from '../client';

const enc = encodeURIComponent;

export const overview = () => request<AdminOverview>('/admin/overview');
export const catalog = () => request<AdminCatalog>('/admin/catalog');
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

export const insights = (range: InsightRange) =>
  request<AdminInsights>(`/admin/insights?range=${range}`);

export const certificates = () => request<AdminCertificates>('/admin/certificates');
export const issueCertificate = (body: ClaimCertificateBody) =>
  request<Certificate>('/admin/certificates', { method: 'POST', body });
export const refreshCertificate = (id: string) =>
  request<Certificate>(`/admin/certificates/${enc(id)}/refresh`, { method: 'POST' });
export const deleteCertificate = (id: string) =>
  request<void>(`/admin/certificates/${enc(id)}`, { method: 'DELETE' });
export const setCertificateDesign = (design: CertificateDesign) =>
  request<{ design: CertificateDesign }>('/admin/certificates/design', {
    method: 'PUT',
    body: { design },
  });
