import api from './api';

export interface DashboardStatsDto {
  totalSalesMTD: number;
  cashInMTD: number;
  cashOutMTD: number;
  totalStockValue: number;
}

export interface SalesTrendDto {
  month: string;
  sales: number;
}

export interface RecentPaymentDto {
  id: string;
  date: string;
  party: string;
  type: string;
  amount: number;
  status: string;
}

export const dashboardService = {
  async getStats() {
    const response = await api.get('/api/dashboards/stats');
    return response.data.body as DashboardStatsDto;
  },

  async getSalesTrend() {
    const response = await api.get('/api/dashboards/sales-trend');
    return response.data.body as SalesTrendDto[];
  },

  async getRecentPayments() {
    const response = await api.get('/api/dashboards/recent-payments');
    return response.data.body as RecentPaymentDto[];
  },
};
