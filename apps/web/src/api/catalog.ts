import type { MomoColor, MomoLook } from '@udakids/engine';
import { useSession } from '../auth/store';
import * as http from './http/catalog';
import * as mock from './mock/catalog';
import { isMocked } from './mode';

const token = () => useSession.getState().session?.token ?? null;

export const home = () => (isMocked('catalog') ? mock.home(token()) : http.home());
export const book = (slug: string) =>
  isMocked('catalog') ? mock.book(token(), slug) : http.book(slug);
export const topic = (id: string) =>
  isMocked('catalog') ? mock.topic(token(), id) : http.topic(id);

export const profile = () => (isMocked('catalog') ? mock.profile(token()) : http.profile());
export const setMomo = (momoColor: MomoColor, momoLook?: MomoLook | null) =>
  isMocked('catalog')
    ? mock.setMomo(token(), momoColor, momoLook)
    : http.setMomo(momoColor, momoLook);
