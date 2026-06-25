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
  itemType?: string;
  mediaId?: string;
  mediaUrl?: string;
}

export interface InventoryItemUpsertRequest {
  id?: string;
  itemCategoryCode: string;
  barcode?: string;
  title: string;
  itemKey?: string;
  priRate: number;
  secRate: number;
  primaryUnit: string;
  secondaryUnit?: string;
  defaultUnit?: string;
  qtyInPack?: number;
  alert: boolean;
  lowStockAlert?: boolean;
  opnStock?: number;
  opnRate?: number;
  itemType?: string;
  mediaId?: string;
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
  },

  async create(data: InventoryItemUpsertRequest) {
    const response = await api.post('/api/inventory/items', data);
    return response.data.body as string;
  },

  async update(id: string, data: InventoryItemUpsertRequest) {
    const response = await api.put(`/api/inventory/items/${id}`, data);
    return response.data.body as string;
  },

  async delete(id: string) {
    const response = await api.delete(`/api/inventory/items/${id}`);
    return response.data.body as string;
  },

  async getPresignedUploadUrl(fileName: string) {
    const response = await api.post('/api/inventory/items/presigned-upload-url', null, { params: { fileName } });
    return response.data.body as { fileId: string; uploadUrl: string; expiresAt: string };
  }
};
