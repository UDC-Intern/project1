import type {
  ChangePasswordBody,
  ParentAccount,
  Referral,
  RequestEmailBody,
} from '@udakids/engine';
import { useSession } from '../auth/store';
import { request } from './client';
import * as mock from './mock/account';
import { isMocked } from './mode';

const token = () => useSession.getState().session?.token ?? null;
const mocked = () => isMocked('parent');

export { MOCK_EMAIL_CODE } from './mock/account';

export const account = (): Promise<ParentAccount> =>
  mocked() ? mock.account(token()) : request<ParentAccount>('/parent/account');
export const updateName = (name: string): Promise<ParentAccount> =>
  mocked()
    ? mock.updateName(token(), name)
    : request<ParentAccount>('/parent/account', { method: 'PATCH', body: { name } });
export const changePassword = (body: ChangePasswordBody): Promise<ParentAccount> =>
  mocked()
    ? mock.changePassword(token(), body)
    : request<ParentAccount>('/parent/password', { method: 'PUT', body });
export const requestEmailChange = (body: RequestEmailBody): Promise<ParentAccount> =>
  mocked()
    ? mock.requestEmailChange(token(), body)
    : request<ParentAccount>('/parent/email/request', { method: 'POST', body });
export const confirmEmailChange = (code: string): Promise<ParentAccount> =>
  mocked()
    ? mock.confirmEmailChange(token(), code)
    : request<ParentAccount>('/parent/email/confirm', { method: 'POST', body: { code } });
export const referral = (): Promise<Referral> =>
  mocked() ? mock.referral(token()) : request<Referral>('/parent/referral');
