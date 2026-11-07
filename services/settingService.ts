import api from './api';

export interface SettingItem {
  key: string;
  value?: string | null;
  description?: string | null;
  category?: string | null;
}

export interface SettingUpdateRequest {
  key: string;
  value?: string | null;
  description?: string | null;
  category?: string | null;
}

export const settingService = {
  async getSettings(category?: string): Promise<SettingItem[]> {
    const params = category ? { category } : undefined;
    const response = await api.get('/api/settings', { params });
    return response.data?.body || response.data || [];
  },

  async getSettingByKey(key: string): Promise<SettingItem> {
    const response = await api.get(`/api/settings/${encodeURIComponent(key)}`);
    return response.data?.body || response.data;
  },

  async saveSetting(setting: SettingUpdateRequest): Promise<SettingItem> {
    const response = await api.post('/api/settings', setting);
    return response.data?.body || response.data;
  },

  async saveBatchSettings(settings: SettingUpdateRequest[]): Promise<SettingItem[]> {
    const response = await api.post('/api/settings/batch', settings);
    return response.data?.body || response.data || [];
  }
};
