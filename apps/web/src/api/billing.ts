import type {
  CreateOrderBody,
  OrderStatus,
  UpdateMethodBody,
  UpdatePackageBody,
  UploadProofBody,
} from '@udakids/engine';
import { useSession } from '../auth/store';
import * as http from './http/billing';
import * as mock from './mock/billing';
import { isMocked } from './mode';

const token = () => useSession.getState().session?.token ?? null;
const mocked = () => isMocked('billing');

export const packages = () => (mocked() ? mock.packages(token()) : http.packages());
export const methods = () => (mocked() ? mock.methods(token()) : http.methods());
export const orders = () => (mocked() ? mock.orders(token()) : http.orders());
export const order = (id: string) => (mocked() ? mock.order(token(), id) : http.order(id));
export const createOrder = (body: CreateOrderBody) =>
  mocked() ? mock.createOrder(token(), body) : http.createOrder(body);
export const uploadProof = (id: string, body: UploadProofBody) =>
  mocked() ? mock.uploadProof(token(), id, body) : http.uploadProof(id, body);
export const cancelOrder = (id: string) =>
  mocked() ? mock.cancelOrder(token(), id) : http.cancelOrder(id);
export const pendingCount = async () =>
  mocked()
    ? mock.pendingCount(token())
    : (await http.orders()).filter(
        (o) => o.status === 'awaiting_payment' || o.status === 'rejected',
      ).length;

export const adminOrders = (status: OrderStatus | null = null) =>
  mocked() ? mock.adminOrders(token(), status) : http.adminOrders(status);
export const approveOrder = (id: string) =>
  mocked() ? mock.approveOrder(token(), id) : http.approveOrder(id);
export const rejectOrder = (id: string, note: string) =>
  mocked() ? mock.rejectOrder(token(), id, note) : http.rejectOrder(id, note);
export const adminPackages = () => (mocked() ? mock.adminPackages(token()) : http.adminPackages());
export const updatePackage = (id: string, body: UpdatePackageBody) =>
  mocked() ? mock.updatePackage(token(), id, body) : http.updatePackage(id, body);
export const adminMethods = () => (mocked() ? mock.adminMethods(token()) : http.adminMethods());
export const updateMethod = (id: string, body: UpdateMethodBody) =>
  mocked() ? mock.updateMethod(token(), id, body) : http.updateMethod(id, body);
