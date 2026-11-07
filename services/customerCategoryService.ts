import api from './api';

export interface CustomerCategoryResponse {
  code: string;
  title: string;
  description?: string;
  active: boolean;
}

export interface CustomerCategoryLookupResponse {
  code: string;
  title: string;
}

export interface CustomerCategoryCreateRequest {
  code?: string;
  title: string;
  description?: string;
  active: boolean;
}

export interface CustomerCategoryUpdateRequest {
  title: string;
  description?: string;
  active: boolean;
}

export const customerCategoryService = {
  async getAll() {
    const response = await api.get('/api/customercategories');
    return (response.data.body || []) as CustomerCategoryResponse[];
  },

  async getLookup() {
    const response = await api.get('/api/customercategories/lookup');
    return (response.data.body || []) as CustomerCategoryLookupResponse[];
  },

  async create(data: CustomerCategoryCreateRequest) {
    const response = await api.post('/api/customercategories', data);
    return response.data.body as string;
  },

  async update(code: string, data: CustomerCategoryUpdateRequest) {
    const response = await api.put(`/api/customercategories/${encodeURIComponent(code)}`, data);
    return response.data.body as string;
  },

  async delete(code: string) {
    const response = await api.delete(`/api/customercategories/${encodeURIComponent(code)}`);
    return response.data.body as string;
  }
};
