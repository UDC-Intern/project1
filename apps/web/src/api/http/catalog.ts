import type { BookDetail, CatalogHome, TopicDetail } from '@udakids/engine';
import { request } from '../client';

export const home = () => request<CatalogHome>('/catalog/home');
export const book = (slug: string) =>
  request<BookDetail>(`/catalog/books/${encodeURIComponent(slug)}`);
export const topic = (id: string) =>
  request<TopicDetail>(`/catalog/topics/${encodeURIComponent(id)}`);
