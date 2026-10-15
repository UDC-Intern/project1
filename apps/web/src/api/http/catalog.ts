import type {
  BookDetail,
  CatalogHome,
  ChildProfile,
  MomoColor,
  MomoLook,
  TopicDetail,
} from '@udakids/engine';
import { request } from '../client';

export const home = () => request<CatalogHome>('/catalog/home');
export const book = (slug: string) =>
  request<BookDetail>(`/catalog/books/${encodeURIComponent(slug)}`);
export const topic = (id: string) =>
  request<TopicDetail>(`/catalog/topics/${encodeURIComponent(id)}`);

export const profile = () => request<ChildProfile>('/child/profile');
export const setMomo = (momoColor: MomoColor, momoLook?: MomoLook | null) =>
  request<{ momoColor: MomoColor }>('/child/momo', {
    method: 'PUT',
    body: { momoColor, momoLook },
  });
