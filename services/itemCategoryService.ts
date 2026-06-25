import api from './api';

export interface ItemCategoryDto {
  code: string;
  title: string;
  active: boolean;
  mediaId?: string;
  mediaUrl?: string;
}

export const itemCategoryService = {
  async getActiveItemCategories() {
    const response = await api.get('/api/itemcategories');
    return response.data.body as ItemCategoryDto[];
  }
};
