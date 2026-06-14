import api from './api';

export interface CustomerResponse {
  account: string;
  title: string;
  email?: string;
  fax?: string;
  cnic?: string;
  address?: string;
  qualification?: string;
  phone1?: string;
  phone2?: string;
  smsNumber?: string;
  iban?: string;
  smsAlert: boolean;
  emailAlert: boolean;
  active: boolean;
  createdBy?: string;
  createdOn?: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface CustomerCreateRequest {
  title: string;
  email?: string;
  fax?: string;
  cnic?: string;
  address?: string;
  qualification?: string;
  phone1?: string;
  phone2?: string;
  smsNumber?: string;
  iban?: string;
  smsAlert: boolean;
  emailAlert: boolean;
  active: boolean;
}

export interface CustomerUpdateRequest {
  title?: string;
  email?: string;
  fax?: string;
  cnic?: string;
  address?: string;
  qualification?: string;
  phone1?: string;
  phone2?: string;
  smsNumber?: string;
  iban?: string;
  smsAlert: boolean;
  emailAlert: boolean;
  active: boolean;
}

export const customerService = {
  async getCustomers() {
    const response = await api.get('/api/customers');
    return response.data.body as CustomerResponse[];
  },

  async getDetail(account: string) {
    // Usually there's a detail endpoint, but if not we can just fetch all and filter or assume there's a GET /api/customers/:account
    // The web app doesn't show a getDetail in customerService, it just fetches all and filters in the component.
    // We'll mimic the fetching all and filtering if the specific endpoint isn't defined, but let's assume it exists or we can just get from list.
    const response = await api.get('/api/customers');
    const customers = response.data.body as CustomerResponse[];
    return customers.find(c => c.account === account);
  },

  async create(data: CustomerCreateRequest) {
    const response = await api.post('/api/customers', data);
    return response.data.body as string;
  },

  async update(account: string, data: CustomerUpdateRequest) {
    const response = await api.put(`/api/customers/${account}`, data);
    return response.data.body as string;
  }
};
