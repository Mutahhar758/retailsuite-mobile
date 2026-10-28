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
  secQty?: number;
  secRate?: number;
  secUnit?: string;
  qtyInPack?: number;
  packing?: number;
  cashPaid?: number;
  cashBack?: number;
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
  secQty?: number;
  secRate?: number;
  secUnit?: string;
  qtyInPack?: number | null;
  packing?: number | null;
  packQty?: number;
}

export interface PurchaseCreateRequest {
  date: string;
  account: string;
  description?: string;
  narration?: string;
  cashPaid?: number;
  cashBack?: number;
  lines: PurchaseLineRequest[];
}

export interface PurchaseUpdateRequest {
  date: string;
  account: string;
  description?: string;
  narration?: string;
  cashPaid?: number;
  cashBack?: number;
  lines: PurchaseLineRequest[];
}

export const purchaseService = {
  async getList(params?: {
    fromDate?: string;
    toDate?: string;
    account?: string;
    voucherNo?: string;
    searchTerm?: string;
    pageNumber?: number;
    pageSize?: number;
  }) {
    const response = await api.get('/api/purchases/paged', { params });
    const body = response.data.body;
    return {
      data: (body?.data ?? []) as PurchaseDto[],
      totalCount: (body?.metadata?.totalCount ?? 0) as number,
      currentPage: (body?.metadata?.currentPage ?? 1) as number,
      totalPages: (body?.metadata?.totalPages ?? 1) as number,
    };
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
