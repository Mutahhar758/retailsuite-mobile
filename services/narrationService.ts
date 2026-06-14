import api from './api';

export interface NarrationDto {
  code: string;
  title: string;
}

export const narrationService = {
  async getActiveNarrations() {
    const response = await api.get('/api/narrations');
    return response.data.body as NarrationDto[];
  }
};
