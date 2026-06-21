import api from './api';

export interface ChartOfAccountDto {
  account: string;
  title: string;
  accType: string;
}

export interface ChartOfAccountHeadDto {
  account: string;
  title: string;
}

export const chartOfAccountService = {
  async getActiveAccounts() {
    const response = await api.get('/api/chartofaccounts');
    return response.data.body as ChartOfAccountDto[];
  },

  async getCustomerAccounts() {
    const response = await api.get('/api/chartofaccounts/customers');
    return response.data.body as ChartOfAccountHeadDto[];
  },

  async getDetailAccounts() {
    const response = await api.get('/api/chartofaccounts/detail');
    return response.data.body as ChartOfAccountHeadDto[];
  },

  async getCashBankAccounts() {
    const response = await api.get('/api/chartofaccounts/cashbanks');
    return response.data.body as ChartOfAccountHeadDto[];
  },

  async getSupplierAccounts() {
    const response = await api.get('/api/chartofaccounts/suppliers');
    return response.data.body as ChartOfAccountHeadDto[];
  }
};

