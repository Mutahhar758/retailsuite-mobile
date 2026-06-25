import api from './api';

export interface VendorResponse {
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
  showInSales: boolean;
  mediaId?: string;
  mediaUrl?: string;
  createdBy?: string;
  createdOn?: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface VendorCreateRequest {
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
  showInSales: boolean;
  mediaId?: string;
}

export interface VendorUpdateRequest {
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
  showInSales: boolean;
  mediaId?: string;
}

export const vendorService = {
  async getVendors() {
    const response = await api.get('/api/vendors');
    return response.data.body as VendorResponse[];
  },

  async getDetail(account: string) {
    const response = await api.get('/api/vendors');
    const vendors = response.data.body as VendorResponse[];
    return vendors.find(v => v.account === account);
  },

  async create(data: VendorCreateRequest) {
    const response = await api.post('/api/vendors', data);
    return response.data.body as string;
  },

  async update(account: string, data: VendorUpdateRequest) {
    const response = await api.put(`/api/vendors/${account}`, data);
    return response.data.body as string;
  },

  async getPresignedUploadUrl(fileName: string) {
    const response = await api.post('/api/vendors/presigned-upload-url', null, { params: { fileName } });
    return response.data.body as { fileId: string; uploadUrl: string; expiresAt: string };
  }
};
