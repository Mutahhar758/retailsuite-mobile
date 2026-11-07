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

export interface SalePaymentRequest {
  seq: number;
  accountId: string;
  amount: number;
  reference?: string;
  checkNum?: string;
  checkDate?: string;
}

export interface SalePaymentResponse {
  seq: number;
  accountId: string;
  accountTitle?: string;
  amount: number;
  reference?: string;
  checkNum?: string;
  checkDate?: string;
}

export interface CustomerItemSaleHistoryEntry {
  voucherNo: string;
  vType: string;
  date: string;
  qty: number;
  unit?: string;
  rate: number;
  discount: number;
  carriage: number;
  amount: number;
  secQty?: number;
  secRate?: number;
}

export interface CustomerItemPriceHistoryResponse {
  accountId: string;
  itemId: string;
  hasHistory: boolean;
  lastSaleDate?: string;
  lastRate?: number;
  lastQty?: number;
  lastDiscount?: number;
  lastSecRate?: number;
  lastVoucherNo?: string;
  lastVType?: string;
  recentSales: CustomerItemSaleHistoryEntry[];
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
  imei?: string;
}

export interface SaleCreateRequest {
  date: string;
  account: string;
  description?: string;
  narration?: string;
  cashReceipt?: number;
  cashBack?: number;
  lines: SaleLineRequest[];
  payments?: SalePaymentRequest[];
}

export interface SaleUpdateRequest {
  date: string;
  account: string;
  description?: string;
  narration?: string;
  cashReceipt?: number;
  cashBack?: number;
  lines: SaleLineRequest[];
  payments?: SalePaymentRequest[];
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

  async getPayments(voucherNo: string) {
    const response = await api.get(`/api/sales/${voucherNo}/payments`);
    return (response.data.body ?? []) as SalePaymentResponse[];
  },

  async getCustomerItemHistory(accountId: string, itemId: string, limit: number = 10) {
    const response = await api.get('/api/sales/customer-history', {
      params: { accountId, itemId, limit },
    });
    return response.data.body as CustomerItemPriceHistoryResponse;
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
