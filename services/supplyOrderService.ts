import api from './api';

export interface SupplyOrderDetail {
  customerId: string;
  sortOrder: number;
}

export interface SupplyOrder {
  id: number;
  title: string;
  details: SupplyOrderDetail[];
}

const BASE_PATH = '/api/SupplyOrders';

export const supplyOrderService = {
  async getList(): Promise<SupplyOrder[]> {
    const response = await api.get(BASE_PATH);
    return response.data.body || [];
  },

  async getById(id: number): Promise<SupplyOrder | null> {
    const response = await api.get(`${BASE_PATH}/${id}`);
    return response.data.body || null;
  }
};
