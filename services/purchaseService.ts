import api from './api';

export interface PurchaseDto {
  date: string;
  voucherNo: string;
  account: string;
  amount: number;
  createdBy: string;
  createdOn: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface PurchaseLineDto {
  seq: number;
  date: string;
  voucherNo: string;
  accountId: string;
  narration?: string;
  narrationId?: string;
  description?: string;
  itemId: string;
  itemKey?: string;
  itemCategoryCode: string;
  unit?: string;
  qty: number;
  rate: number;
  addLess: number;
  amount: number;
  createdBy: string;
  createdOn: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface PurchaseLineRequest {
  seq: number;
  itemId: string;
  unit?: string;
  qty: number;
  rate: number;
  addLess: number;
}

export interface PurchaseCreateRequest {
  date: string;
  account: string;
  description?: string;
  narration?: string;
  lines: PurchaseLineRequest[];
}

export interface PurchaseUpdateRequest {
  date: string;
  account: string;
  description?: string;
  narration?: string;
  lines: PurchaseLineRequest[];
}

export const purchaseService = {
  async getList(params?: {
    fromDate?: string;
    toDate?: string;
    account?: string;
    voucherNo?: string;
  }) {
    const response = await api.get('/api/purchases', { params });
    return response.data.body as PurchaseDto[];
  },

  async getDetail(voucherNo: string) {
    const response = await api.get(`/api/purchases/${voucherNo}`);
    return response.data.body as PurchaseLineDto[];
  },

  async create(request: PurchaseCreateRequest) {
    const response = await api.post('/api/purchases', request);
    return response.data.body as string;
  },

  async update(voucherNo: string, request: PurchaseUpdateRequest) {
    await api.put(`/api/purchases/${voucherNo}`, request);
  },

  async delete(voucherNo: string) {
    await api.delete(`/api/purchases/${voucherNo}`);
  },

  async deleteLine(voucherNo: string, seq: number) {
    await api.delete(`/api/purchases/${voucherNo}/lines/${seq}`);
  },
};
