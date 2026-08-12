import api from './api';

export interface SaleSupply {
  date: string;
  voucherNo: string;
  item: string;
  createdBy: string;
  createdOn: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
  supplyOrderMasterId?: number;
  supplyOrderTitle?: string;
}

export interface SaleSupplyLine {
  seq: number;
  date: string;
  voucherNo: string;
  itemId: string;
  itemTitle?: string;
  narration?: string;
  narrationId?: string;
  description?: string;
  supplyOrderMasterId?: number;
  customerId: string;
  customerTitle?: string;
  unit?: string;
  qty: number;
  rate: number;
  discount: number;
  addLess: number;
  amount: number;
  secQty?: number;
  secRate?: number;
  secUnit?: string;
  createdBy: string;
  createdOn: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface SaleSupplyLineRequest {
  seq: number;
  customerId: string;
  unit?: string;
  qty: number;
  rate: number;
  discount: number;
  addLess: number;
  secQty?: number;
  secRate?: number;
  secUnit?: string;
}

export interface SaleSupplyCustomerLineUpdateRequest {
  voucherNo: string;
  seq: number;
  line: SaleSupplyLineRequest;
}

export interface SaleSupplyCreateRequest {
  date: string;
  itemId: string;
  supplyOrderMasterId?: number;
  narration?: string;
  description?: string;
  lines: SaleSupplyLineRequest[];
}

export interface SaleSupplyUpdateRequest {
  date: string;
  itemId: string;
  supplyOrderMasterId?: number;
  narration?: string;
  description?: string;
  lines: SaleSupplyLineRequest[];
}

export const saleSupplyService = {
  async getList(params?: {
    fromDate?: string;
    toDate?: string;
    itemId?: string;
    voucherNo?: string;
    searchTerm?: string;
  }) {
    const response = await api.get('/api/SaleSupplies', { params });
    return response.data.body as SaleSupply[];
  },

  async getDetail(voucherNo: string) {
    const response = await api.get(`/api/SaleSupplies/${voucherNo}`);
    return response.data.body as SaleSupplyLine[];
  },

  async getCustomerLines(params: {
    customerId: string;
    fromDate?: string;
    toDate?: string;
    itemId?: string;
  }) {
    const response = await api.get('/api/SaleSupplies/customer-records', { params });
    return response.data.body as SaleSupplyLine[];
  },

  async create(request: SaleSupplyCreateRequest) {
    const response = await api.post('/api/SaleSupplies', request);
    return response.data.body as string;
  },

  async update(voucherNo: string, request: SaleSupplyUpdateRequest) {
    await api.put(`/api/SaleSupplies/${voucherNo}`, request);
  },

  async updateLine(voucherNo: string, seq: number, request: SaleSupplyLineRequest) {
    await api.put(`/api/SaleSupplies/${voucherNo}/lines/${seq}`, request);
  },

  async updateCustomerLines(requests: SaleSupplyCustomerLineUpdateRequest[]) {
    await api.put('/api/SaleSupplies/customer-lines', requests);
  },

  async delete(voucherNo: string) {
    await api.delete(`/api/SaleSupplies/${voucherNo}`);
  },

  async deleteLine(voucherNo: string, seq: number) {
    await api.delete(`/api/SaleSupplies/${voucherNo}/lines/${seq}`);
  }
};
