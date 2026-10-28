import api from './api';

export interface SaleDto {
  date: string;
  voucherNo: string;
  account: string;
  amount: number;
  createdBy: string;
  createdOn: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface SaleLineDto {
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
  discount: number;
  carriage?: number;
  amount: number;
  secUnit?: string;
  secQty?: number;
  secRate?: number;
  qtyInPack?: number;
  packing?: number;
  cashReceipt?: number;
  cashBack?: number;
  createdBy: string;
  createdOn: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface SaleLineRequest {
  seq: number;
  itemId: string;
  unit?: string;
  qty: number;
  rate: number;
  discount: number;
  carriage?: number;
  secUnit?: string;
  secQty?: number;
  secRate?: number;
  qtyInPack?: number | null;
  packing?: number | null;
  packQty?: number;
}

export interface SaleCreateRequest {
  date: string;
  account: string;
  description?: string;
  narration?: string;
  cashReceipt?: number;
  cashBack?: number;
  lines: SaleLineRequest[];
}

export interface SaleUpdateRequest {
  date: string;
  account: string;
  description?: string;
  narration?: string;
  cashReceipt?: number;
  cashBack?: number;
  lines: SaleLineRequest[];
}

export const saleService = {
  async getList(params?: {
    fromDate?: string;
    toDate?: string;
    account?: string;
    voucherNo?: string;
    searchTerm?: string;
    pageNumber?: number;
    pageSize?: number;
  }) {
    const response = await api.get('/api/sales/paged', { params });
    const body = response.data.body;
    return {
      data: (body?.data ?? []) as SaleDto[],
      totalCount: (body?.metadata?.totalCount ?? 0) as number,
      currentPage: (body?.metadata?.currentPage ?? 1) as number,
      totalPages: (body?.metadata?.totalPages ?? 1) as number,
    };
  },

  async getDetail(voucherNo: string) {
    const response = await api.get(`/api/sales/${voucherNo}`);
    return response.data.body as SaleLineDto[];
  },

  async create(request: SaleCreateRequest) {
    const response = await api.post('/api/sales', request);
    return response.data.body as string;
  },

  async update(voucherNo: string, request: SaleUpdateRequest) {
    await api.put(`/api/sales/${voucherNo}`, request);
  },

  async delete(voucherNo: string) {
    await api.delete(`/api/sales/${voucherNo}`);
  },

  async deleteLine(voucherNo: string, seq: number) {
    await api.delete(`/api/sales/${voucherNo}/lines/${seq}`);
  },
};
