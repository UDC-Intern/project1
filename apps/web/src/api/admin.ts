import type {
  CertificateDesign,
  ClaimCertificateBody,
  InsightRange,
  UpdateLevelBody,
  UpdateTopicBody,
} from '@udakids/engine';
import { useSession } from '../auth/store';
import * as http from './http/admin';
import * as mock from './mock/admin';
import * as certMock from './mock/certificate';
import * as insightsMock from './mock/insights';
import { isMocked } from './mode';

const token = () => useSession.getState().session?.token ?? null;
const mocked = () => isMocked('admin');

export const overview = () => (mocked() ? mock.overview(token()) : http.overview());
export const catalog = () => (mocked() ? mock.catalog(token()) : http.catalog());
export const updateTopic = (id: string, body: UpdateTopicBody) =>
  mocked() ? mock.updateTopic(token(), id, body) : http.updateTopic(id, body);
export const updateLevel = (id: string, body: UpdateLevelBody) =>
  mocked() ? mock.updateLevel(token(), id, body) : http.updateLevel(id, body);
export const preview = (levelId: string, seed: number) =>
  mocked() ? mock.preview(token(), levelId, seed) : http.preview(levelId, seed);
export const aiAssist = (topicId: string, purpose: 'lesson' | 'curriculum') =>
  mocked() ? mock.aiAssist(token(), topicId, purpose) : http.aiAssist(topicId, purpose);
export const aiJobs = () => (mocked() ? mock.aiJobs(token()) : http.aiJobs());
export const users = (q = '') => (mocked() ? mock.users(token(), q) : http.users(q));
export const setPremium = (childId: string, until: string) =>
  mocked() ? mock.setPremium(token(), childId, until) : http.setPremium(childId, until);
export const revokePremium = (childId: string) =>
  mocked() ? mock.revokePremium(token(), childId) : http.revokePremium(childId);
export const childReport = (childId: string) =>
  mocked() ? mock.childReport(token(), childId) : http.childReport(childId);
export const levelStats = () => (mocked() ? mock.levelStats(token()) : http.levelStats());

export const insights = (range: InsightRange = '7d') =>
  mocked() ? insightsMock.insights(token(), range) : http.insights(range);

export const certificates = () =>
  mocked() ? certMock.adminCertificates(token()) : http.certificates();
export const issueCertificate = (body: ClaimCertificateBody) =>
  mocked() ? certMock.adminIssue(token(), body) : http.issueCertificate(body);
export const refreshCertificate = (id: string) =>
  mocked() ? certMock.adminRefresh(token(), id) : http.refreshCertificate(id);
export const deleteCertificate = (id: string) =>
  mocked() ? certMock.adminDelete(token(), id) : http.deleteCertificate(id);
export const setCertificateDesign = (design: CertificateDesign) =>
  mocked() ? certMock.setDesign(token(), design) : http.setCertificateDesign(design);
