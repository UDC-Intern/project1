import type {
  AdminOrder,
  BillingPackage,
  CreateOrderBody,
  Order,
  OrderStatus,
  PaymentMethod,
  UpdateMethodBody,
  UpdatePackageBody,
  UploadProofBody,
} from '@udakids/engine';
import { request } from '../client';

const enc = encodeURIComponent;

export const packages = () => request<BillingPackage[]>('/billing/packages');
export const publicPackages = () => request<BillingPackage[]>('/packages');
export const methods = () => request<PaymentMethod[]>('/billing/methods');
export const orders = () => request<Order[]>('/billing/orders');
export const order = (id: string) => request<Order>(`/billing/orders/${enc(id)}`);
export const createOrder = (body: CreateOrderBody) =>
  request<Order>('/billing/orders', { method: 'POST', body });
export const uploadProof = (id: string, body: UploadProofBody) =>
  request<Order>(`/billing/orders/${enc(id)}/proof`, { method: 'POST', body });
export const cancelOrder = (id: string) =>
  request<Order>(`/billing/orders/${enc(id)}/cancel`, { method: 'POST' });

export const adminOrders = (status: OrderStatus | null) =>
  request<AdminOrder[]>(`/admin/orders${status ? `?status=${status}` : ''}`);
export const approveOrder = (id: string) =>
  request<AdminOrder>(`/admin/orders/${enc(id)}/approve`, { method: 'POST' });
export const rejectOrder = (id: string, note: string) =>
  request<AdminOrder>(`/admin/orders/${enc(id)}/reject`, { method: 'POST', body: { note } });
export const adminPackages = () => request<BillingPackage[]>('/admin/packages');
export const updatePackage = (id: string, body: UpdatePackageBody) =>
  request<BillingPackage>(`/admin/packages/${enc(id)}`, { method: 'PATCH', body });
export const adminMethods = () => request<PaymentMethod[]>('/admin/payment-methods');
export const updateMethod = (id: string, body: UpdateMethodBody) =>
  request<PaymentMethod>(`/admin/payment-methods/${enc(id)}`, { method: 'PATCH', body });
