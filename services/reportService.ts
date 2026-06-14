import api from './api';

export interface AccountStatementLine {
  vDate: string;
  vNo: string | null;
  vSeq: number;
  particular: string;
  dr: number;
  cr: number;
}

export interface CustomerBillLine {
  date: string;
  vNo: string;
  item: string;
  unitTitle: string;
  qty: number;
  rate: number;
  addLess: number;
  amount: number;
}

export interface CustomerBillResponse {
  lines: CustomerBillLine[];
  summary: {
    previousBalance: number;
    payment: number;
    balance: number;
  };
}

export interface BalanceDetailLine {
  account: string;
  balance: number;
}

export const reportService = {
  async getAccountStatement(params: { fromDate: string; toDate: string; account: string }) {
    const response = await api.get('/api/reports/account-statement', { params });
    return response.data.body as AccountStatementLine[];
  },

  async getCustomerBill(params: { fromDate: string; toDate: string; account: string }) {
    const response = await api.get('/api/reports/customer-bill', { params });
    return response.data.body as CustomerBillResponse;
  },

  async getBalanceDetail(params: { account: string; toDate: string }) {
    const response = await api.get('/api/reports/balance-detail', { params });
    return response.data.body as BalanceDetailLine[];
  },
};


