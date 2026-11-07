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

export interface CashFlowTrendDto {
  month: string;
  cashIn: number;
  cashOut: number;
}

export interface ExpenseCategoryDto {
  category: string;
  value: number;
}

export interface RecentExpenseDto {
  id: string;
  category: string;
  date: string;
  amount: number;
}

export interface StockStatusDto {
  code?: string;
  name: string;
  qty: number;
  value: number;
  status: string;
  lowStockQty?: number;
  lowStockAlert?: boolean;
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

  async getCashFlowTrend() {
    const response = await api.get('/api/dashboards/cash-flow-trend');
    return response.data.body as CashFlowTrendDto[];
  },

  async getExpensesByCategory() {
    const response = await api.get('/api/dashboards/expenses-by-category');
    return response.data.body as ExpenseCategoryDto[];
  },

  async getRecentExpenses() {
    const response = await api.get('/api/dashboards/recent-expenses');
    return response.data.body as RecentExpenseDto[];
  },

  async getStockStatus() {
    const response = await api.get('/api/dashboards/stock-status');
    return response.data.body as StockStatusDto[];
  },

  async getRecentPayments() {
    const response = await api.get('/api/dashboards/recent-payments');
    return response.data.body as RecentPaymentDto[];
  },
};
