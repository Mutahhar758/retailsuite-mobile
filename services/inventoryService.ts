import api from './api';

export interface Item {
  id: string;
  barcode?: string;
  itemCategoryCode: string;
  title: string;
  itemKey?: string;
  priRate: number;
  secRate: number;
  primaryUnit?: string;
  secondaryUnit?: string;
  defaultUnit?: string;
  qtyInPack?: number;
  alert: boolean;
  lowStockAlert?: boolean;
  opnStock?: number;
  opnRate?: number;
}

export interface Unit {
  code: string;
  title: string;
}

export const inventoryService = {
  async getItems(categoryCode?: string) {
    const response = await api.get('/api/inventory/items', { params: { itemCategoryCode: categoryCode } });
    return response.data.body as Item[];
  },

  async getById(id: string) {
    const response = await api.get(`/api/inventory/items/${id}`);
    return response.data.body as Item;
  },

  async getUnits() {
    const response = await api.get('/api/units');
    return response.data.body as Unit[];
  }
};
