import api from './api';

export interface ItemCustomerCategoryPriceDto {
  itemId: string;
  customerCategoryId: string;
  customerCategoryTitle?: string;
  priRate: number;
  secRate: number;
}

export interface Item {
  id: string;
  barcode?: string;
  itemCategoryCode: string;
  itemCategoryTitle?: string;
  title: string;
  itemKey?: string;
  lastPurchaseRate?: number | null;
  lastPurchaseSecRate?: number | null;
  costRate?: number | null;
  secCostRate?: number | null;
  priRate: number;
  secRate: number;
  primaryUnit?: string;
  primaryUnitTitle?: string;
  secondaryUnit?: string;
  secondaryUnitTitle?: string;
  defaultUnit?: string;
  defaultUnitTitle?: string;
  qtyInPack?: number;
  alert: boolean;
  lowStockAlert?: boolean;
  lowStockQty?: number;
  minSalePrice?: number | null;
  opnStock?: number;
  opnRate?: number;
  itemType?: string;
  mediaId?: string;
  mediaUrl?: string;
  quickQtyPresets?: string | null;
  additionalUnits?: string | null;
  brandId?: string | null;
  brandTitle?: string | null;
  requireImei?: boolean;
  customerCategoryPrices?: ItemCustomerCategoryPriceDto[];
}

export interface InventoryItemUpsertRequest {
  id?: string;
  itemCategoryCode: string;
  barcode?: string;
  title: string;
  itemKey?: string;
  lastPurchaseRate?: number | null;
  lastPurchaseSecRate?: number | null;
  costRate?: number | null;
  secCostRate?: number | null;
  priRate: number;
  secRate: number;
  primaryUnit: string;
  secondaryUnit?: string;
  defaultUnit?: string;
  qtyInPack?: number;
  alert: boolean;
  lowStockAlert?: boolean;
  lowStockQty?: number;
  minSalePrice?: number | null;
  opnStock?: number;
  opnRate?: number;
  itemType?: string;
  mediaId?: string;
  quickQtyPresets?: string | null;
  additionalUnits?: string | null;
  brandId?: string | null;
  requireImei?: boolean;
  customerCategoryPrices?: ItemCustomerCategoryPriceDto[];
}

export interface Unit {
  code: string;
  title: string;
  shortTitle?: string | null;
  parentUnitId?: string | null;
  parentUnitTitle?: string | null;
  conversionRatio?: number | null;
}

export const inventoryService = {
  async getItems(categoryCode?: string) {
    const response = await api.get('/api/inventory/items', { params: { itemCategoryCode: categoryCode } });
    return response.data.body as Item[];
  },

  async getItemsLookup(categoryCode?: string, includeLastPurchaseRate: boolean = false) {
    const response = await api.get('/api/inventory/items/lookup', { params: { itemCategoryCode: categoryCode, ...(includeLastPurchaseRate ? { includeLastPurchaseRate: true } : {}) } });
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

  async getUnitsLookup() {
    const response = await api.get('/api/units/lookup');
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
  },

  async getCustomerCategoryPrices(customerCategoryId?: string) {
    const response = await api.get('/api/inventory/customer-category-prices', {
      params: customerCategoryId ? { customerCategoryId } : undefined
    });
    return (response.data.body || []) as ItemCustomerCategoryPriceDto[];
  },

  async getItemCategoryPrices(itemId: string) {
    const response = await api.get(`/api/inventory/items/${encodeURIComponent(itemId)}/customer-category-prices`);
    return (response.data.body || []) as ItemCustomerCategoryPriceDto[];
  },

  async saveItemCategoryPrices(itemId: string, prices: ItemCustomerCategoryPriceDto[]) {
    const response = await api.put(`/api/inventory/items/${encodeURIComponent(itemId)}/customer-category-prices`, prices);
    return response.data.body as string;
  }
};
