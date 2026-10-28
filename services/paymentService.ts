import api from './api';

export interface PaymentDto {
  date: string;
  clearingDate?: string;
  voucherNo: string;
  amount: number;
  narration: string;
  narrationId?: string;
  createdBy: string;
  createdOn: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface PaymentLineDto {
  seq: number;
  date: string;
  clearingDate?: string;
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

export interface PaymentLineRequest {
  seq: number;
  account: string;
  amount: number;
  checkNum?: string;
  checkDate?: string;
  remarks?: string;
}

export interface PaymentCreateRequest {
  date: string;
  clearingDate?: string;
  cashBankAccount: string;
  narration?: string;
  lines: PaymentLineRequest[];
}

export interface PaymentUpdateRequest {
  date: string;
  clearingDate?: string;
  cashBankAccount: string;
  narration?: string;
  lines: PaymentLineRequest[];
}

export const paymentService = {
  async getList(params?: {
    fromDate?: string;
    toDate?: string;
    cashBankAccount?: string;
    account?: string;
    narration?: string;
    voucherNo?: string;
    pageNumber?: number;
    pageSize?: number;
  }) {
    const response = await api.get('/api/payments/paged', { params });
    const body = response.data.body;
    return {
      data: (body?.data ?? []) as PaymentDto[],
      totalCount: (body?.metadata?.totalCount ?? 0) as number,
      currentPage: (body?.metadata?.currentPage ?? 1) as number,
      totalPages: (body?.metadata?.totalPages ?? 1) as number,
    };
  },

  async getDetail(voucherNo: string, cashBankAccount?: string) {
    const response = await api.get(`/api/payments/${voucherNo}`, {
      params: { cashBankAccount },
    });
    return response.data.body as PaymentLineDto[];
  },

  async getAccountBalance(accountId: string) {
    const response = await api.get(`/api/payments/accounts/${accountId}/balance`);
    return response.data.body.balance as number;
  },

  async create(request: PaymentCreateRequest) {
    const response = await api.post('/api/payments', request);
    return response.data.body as string;
  },

  async update(voucherNo: string, request: PaymentUpdateRequest) {
    await api.put(`/api/payments/${voucherNo}`, request);
  },

  async delete(voucherNo: string) {
    await api.delete(`/api/payments/${voucherNo}`);
  },

  async deleteLine(voucherNo: string, seq: number) {
    await api.delete(`/api/payments/${voucherNo}/lines/${seq}`);
  },
};
