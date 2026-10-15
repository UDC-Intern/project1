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
