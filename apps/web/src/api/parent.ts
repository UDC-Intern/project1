import type { CreateChildBody, MomoColor, Pin } from '@udakids/engine';
import { useSession } from '../auth/store';
import * as http from './http/parent';
import * as mock from './mock/parent';
import { isMocked } from './mode';

const token = () => useSession.getState().session?.token ?? null;
const mocked = () => isMocked('parent');

export const overview = () => (mocked() ? mock.overview(token()) : http.overview());
export const createChild = (body: CreateChildBody) =>
  mocked() ? mock.createChild(token(), body) : http.createChild(body);
export const updateChild = (id: string, body: { nickname?: string; momoColor?: MomoColor }) =>
  mocked() ? mock.updateChild(token(), id, body) : http.updateChild(id, body);
export const setPin = (id: string, pin: Pin) =>
  mocked() ? mock.setPin(token(), id, pin) : http.setPin(id, pin);
export const deleteChild = (id: string) =>
  mocked() ? mock.deleteChild(token(), id) : http.deleteChild(id);
export const report = (id: string) => (mocked() ? mock.report(token(), id) : http.report(id));
export const plan = () => (mocked() ? mock.plan(token()) : http.plan());
