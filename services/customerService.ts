import api from './api';

export interface CustomerSupplyItemDto {
  customerAccountId?: string;
  itemId: string;
  itemTitle?: string;
  qty: number;
  secQty?: number;
}

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
  mediaId?: string;
  mediaUrl?: string;
  createdBy?: string;
  createdOn?: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
  supplyItems?: CustomerSupplyItemDto[];
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
  mediaId?: string;
  supplyItems?: CustomerSupplyItemDto[];
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
  mediaId?: string;
  supplyItems?: CustomerSupplyItemDto[];
}

export const customerService = {
  async getCustomers() {
    const response = await api.get('/api/customers');
    return response.data.body as CustomerResponse[];
  },

  async getDetail(account: string) {
    const response = await api.get('/api/customers');
    const customers = response.data.body as CustomerResponse[];
    return customers.find(c => c.account === account);
  },

  async getSupplyItems(params?: { customerId?: string; itemId?: string }) {
    const response = await api.get('/api/customers/supply-items', { params });
    return response.data.body as CustomerSupplyItemDto[];
  },

  async create(data: CustomerCreateRequest) {
    const response = await api.post('/api/customers', data);
    return response.data.body as string;
  },

  async update(account: string, data: CustomerUpdateRequest) {
    const response = await api.put(`/api/customers/${account}`, data);
    return response.data.body as string;
  },

  async getPresignedUploadUrl(fileName: string) {
    const response = await api.post('/api/customers/presigned-upload-url', null, { params: { fileName } });
    return response.data.body as { fileId: string; uploadUrl: string; expiresAt: string };
  }
};

