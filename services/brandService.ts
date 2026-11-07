import api from './api';

export interface BrandDto {
  id: string;
  title: string;
  active: boolean;
}

export interface BrandLookupDto {
  id: string;
  title: string;
}

export interface BrandUpsertRequest {
  id?: string;
  title: string;
  active: boolean;
}

export const brandService = {
  async getBrands(): Promise<BrandDto[]> {
    const response = await api.get('/api/brands');
    return (response.data.body || []) as BrandDto[];
  },

  async getActiveBrands(): Promise<BrandLookupDto[]> {
    const response = await api.get('/api/brands/active');
    return (response.data.body || []) as BrandLookupDto[];
  },

  async getById(id: string): Promise<BrandDto | null> {
    const response = await api.get(`/api/brands/${encodeURIComponent(id)}`);
    return response.data.body as BrandDto;
  },

  async create(data: BrandUpsertRequest): Promise<string> {
    const response = await api.post('/api/brands', data);
    return response.data.body as string;
  },

  async update(id: string, data: BrandUpsertRequest): Promise<void> {
    await api.put(`/api/brands/${encodeURIComponent(id)}`, data);
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/api/brands/${encodeURIComponent(id)}`);
  }
};
