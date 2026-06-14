import api from './api';

export interface ReceiptDto {
  date: string;
  voucherNo: string;
  amount: number;
  narration: string;
  narrationId?: string;
  createdBy: string;
  createdOn: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface ReceiptLineDto {
  seq: number;
  date: string;
  voucherNo: string;
  cashBankAccountId: string;
  accountId: string;
  amount: number;
  narration: string;
  narrationId?: string;
  checkNum?: string;
  checkDate?: string;
  remarks?: string;
  createdBy: string;
  createdOn: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface ReceiptLineRequest {
  seq: number;
  account: string;
  amount: number;
  checkNum?: string;
  checkDate?: string;
  remarks?: string;
}

export interface ReceiptCreateRequest {
  date: string;
  cashBankAccount: string;
  narration?: string;
  lines: ReceiptLineRequest[];
}

export interface ReceiptUpdateRequest {
  date: string;
  cashBankAccount: string;
  narration?: string;
  lines: ReceiptLineRequest[];
}

export const receiptService = {
  async getList(params?: {
    fromDate?: string;
    toDate?: string;
    cashBankAccount?: string;
    account?: string;
    narration?: string;
  }) {
    const response = await api.get('/api/receipts', { params });
    return response.data.body as ReceiptDto[];
  },

  async getDetail(voucherNo: string, cashBankAccount?: string) {
    const response = await api.get(`/api/receipts/${voucherNo}`, {
      params: { cashBankAccount },
    });
    return response.data.body as ReceiptLineDto[];
  },

  async getAccountBalance(accountId: string) {
    const response = await api.get(`/api/receipts/accounts/${accountId}/balance`);
    return response.data.body.balance as number;
  },

  async create(request: ReceiptCreateRequest) {
    const response = await api.post('/api/receipts', request);
    return response.data.body as string;
  },

  async update(voucherNo: string, request: ReceiptUpdateRequest) {
    await api.put(`/api/receipts/${voucherNo}`, request);
  },

  async delete(voucherNo: string) {
    await api.delete(`/api/receipts/${voucherNo}`);
  },

  async deleteLine(voucherNo: string, seq: number) {
    await api.delete(`/api/receipts/${voucherNo}/lines/${seq}`);
  },
};
