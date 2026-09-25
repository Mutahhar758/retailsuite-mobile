import api from './api';
import { arrayBufferToBase64 } from '../utils/pdfUtils';

export interface TrialBalanceLine {
  lvl1: string;
  lvl2: string;
  lvl3: string;
  lvl4: string;
  title: string;
  priBal: number;
  dr: number;
  cr: number;
  curBal: number;
}

export interface BalanceDetailLine {
  account: string;
  balance: number;
}

export interface AccountStatementLine {
  vDate: string;
  vNo: string | null;
  vSeq: number;
  particular: string;
  dr: number;
  cr: number;
}

export interface AccountStatementWithDueLine extends AccountStatementLine {
  dueDays: number | null;
}

export interface StockBalanceLine {
  item: string;
  unit: string;
  priQty: number;
  qty: number;
  qtyIn: number;
  qtyOut: number;
  qtyBal: number;
  rate: number;
  secUnit?: string;
  secPriQty?: number;
  secQtyIn?: number;
  secQtyOut?: number;
  secQtyBal?: number;
}

export interface StockLedgerLine {
  vdate: string;
  vno: string | null;
  particular: string;
  qtyIn: number;
  qtyOut: number;
  rate: number | null;
  costPrice?: number | null;
  costAmount?: number | null;
  secUnit?: string;
  secQtyIn?: number;
  secQtyOut?: number;
  secQtyBal?: number;
}

export interface BalanceSheetLine {
  lvl1: string;
  lvl2: string;
  lvl3: string;
  lvl4: string;
  title: string;
  priBal: number;
  drCr: number;
  curBal: number;
}

export interface IncomeSummaryLine {
  vType: string;
  title: string;
  dr: number;
  cr: number;
  bal: number;
}

export interface CustomerBillLine {
  date: string;
  vNo: string;
  item: string;
  unitTitle: string;
  qty: number;
  rate: number;
  addLess: number;
  amount: number;
  secQty?: number;
  secRate?: number;
  qtyInPack?: number;
  secUnitTitle?: string;
  receiptDate?: string;
  receiptAmount?: number;
}

export interface CustomerBillResponse {
  lines: CustomerBillLine[];
  summary: {
    previousBalance: number;
    payment: number;
    balance: number;
  };
}

export interface CustomerBalanceRecoveryLine {
  customerAccountId: string;
  customerTitle: string;
  phone?: string;
  address?: string;
  previousBalance: number;
  currentBilling: number;
  totalDue: number;
  recoveryAmount: number;
  discount: number;
  closingBalance: number;
  recoveryPercentage: number;
  status: 'Cleared' | 'Partial' | 'Unpaid' | 'Advance' | string;
}

export interface CustomerBalanceRecoverySummary {
  totalCustomers: number;
  totalPreviousBalance: number;
  totalCurrentBilling: number;
  totalDue: number;
  totalRecovery: number;
  totalDiscount: number;
  totalClosingBalance: number;
  overallRecoveryRate: number;
}

export interface CustomerBalanceRecoveryResponse {
  lines: CustomerBalanceRecoveryLine[];
  summary: CustomerBalanceRecoverySummary;
}

export interface PurchaseSupplyComparisonLine {
  date: string;
  dayName: string;
  purchaseQty: number;
  purchaseAvgRate: number;
  purchaseAmount: number;
  supplyQty: number;
  supplyAvgRate: number;
  supplyAmount: number;
  regularSaleQty: number;
  regularSaleAmount: number;
  totalDispatchedQty: number;
  diffQty: number;
  diffAmount: number;
  netDiffQty: number;
  status: 'Equal' | 'Surplus' | 'Shortage' | string;
}

export interface PurchaseSupplyComparisonSummary {
  totalPurchaseQty: number;
  totalPurchaseAmount: number;
  avgPurchaseRate: number;
  totalSupplyQty: number;
  totalSupplyAmount: number;
  avgSupplyRate: number;
  totalRegularSaleQty: number;
  totalRegularSaleAmount: number;
  totalDispatchedQty: number;
  totalDiffQty: number;
  totalDiffAmount: number;
  totalNetDiffQty: number;
}

export interface PurchaseSupplyComparisonResponse {
  itemTitle: string;
  unitTitle?: string;
  lines: PurchaseSupplyComparisonLine[];
  summary: PurchaseSupplyComparisonSummary;
}

async function fetchPdfBase64(url: string, params?: any): Promise<string> {
  const response = await api.get(url, {
    params,
    responseType: 'arraybuffer'
  });
  return arrayBufferToBase64(response.data);
}

export const reportService = {
  // 1. Account Statement
  async getAccountStatement(params: { fromDate: string; toDate: string; account: string; dateBasis?: 'VoucherDate' | 'ClearingDate' }) {
    const response = await api.get('/api/reports/account-statement', { params });
    return response.data.body as AccountStatementLine[];
  },
  async getAccountStatementPdf(params: { fromDate: string; toDate: string; account: string; dateBasis?: 'VoucherDate' | 'ClearingDate' }): Promise<string> {
    return fetchPdfBase64('/api/reports/account-statement/pdf', params);
  },

  // 2. Account Statement With Due Days
  async getAccountStatementWithDue(params: { fromDate: string; toDate: string; account: string; dateBasis?: 'VoucherDate' | 'ClearingDate' }) {
    const response = await api.get('/api/reports/account-statement-with-due', { params });
    return response.data.body as AccountStatementWithDueLine[];
  },
  async getAccountStatementWithDuePdf(params: { fromDate: string; toDate: string; account: string; dateBasis?: 'VoucherDate' | 'ClearingDate' }): Promise<string> {
    return fetchPdfBase64('/api/reports/account-statement-with-due/pdf', params);
  },

  // 3. Balance Detail (Account Balance Report)
  async getBalanceDetail(params: { toDate: string; account: string }) {
    const response = await api.get('/api/reports/balance-detail', { params });
    return response.data.body as BalanceDetailLine[];
  },
  async getBalanceDetailPdf(params: { toDate: string; account: string }): Promise<string> {
    return fetchPdfBase64('/api/reports/balance-detail/pdf', params);
  },

  // 4. Trial Balance
  async getTrialBalance(params: { fromDate: string; toDate: string }) {
    const response = await api.get('/api/reports/trial-balance', { params });
    return response.data.body as TrialBalanceLine[];
  },
  async getTrialBalancePdf(params: { fromDate: string; toDate: string }): Promise<string> {
    return fetchPdfBase64('/api/reports/trial-balance/pdf', params);
  },

  // 5. Stock Balance
  async getStockBalance(params: { fromDate: string; toDate: string; catagory?: string; showStockValue?: boolean }) {
    const response = await api.get('/api/reports/stock-balance', { params });
    return response.data.body as StockBalanceLine[];
  },
  async getStockBalancePdf(params: { fromDate: string; toDate: string; catagory?: string; showStockValue?: boolean }): Promise<string> {
    return fetchPdfBase64('/api/reports/stock-balance/pdf', params);
  },

  // 6. Stock Ledger / Item Ledger
  async getStockLedger(params: { fromDate: string; toDate: string; fkItem: string; showCostPrice?: boolean }) {
    const response = await api.get('/api/reports/stock-ledger', { params });
    return response.data.body as StockLedgerLine[];
  },
  async getStockLedgerPdf(params: { fromDate: string; toDate: string; fkItem: string; showCostPrice?: boolean }): Promise<string> {
    return fetchPdfBase64('/api/reports/stock-ledger/pdf', params);
  },

  // 7. Balance Sheet
  async getBalanceSheet(params: { toDate: string }) {
    const response = await api.get('/api/reports/balance-sheet', { params });
    return response.data.body as BalanceSheetLine[];
  },
  async getBalanceSheetPdf(params: { toDate: string }): Promise<string> {
    return fetchPdfBase64('/api/reports/balance-sheet/pdf', params);
  },

  // 8. Income Summary
  async getIncomeSummary(params: { fromDate: string; toDate: string }) {
    const response = await api.get('/api/reports/income-summary', { params });
    return response.data.body as IncomeSummaryLine[];
  },
  async getIncomeSummaryPdf(params: { fromDate: string; toDate: string }): Promise<string> {
    return fetchPdfBase64('/api/reports/income-summary/pdf', params);
  },

  // 9. Customer Bill
  async getCustomerBill(params: { fromDate: string; toDate: string; account: string; dateBasis?: 'VoucherDate' | 'ClearingDate' }) {
    const response = await api.get('/api/reports/customer-bill', { params });
    return response.data.body as CustomerBillResponse;
  },
  async getCustomerBillPdf(params: {
    fromDate: string;
    toDate: string;
    account: string;
    dateBasis?: 'VoucherDate' | 'ClearingDate';
    layout?: 'A4' | 'Thermal';
  }): Promise<string> {
    return fetchPdfBase64('/api/reports/customer-bill/pdf', params);
  },

  // 10. Purchase vs Supply Comparison (Milk Comparison)
  async getPurchaseSupplyComparison(params: { fromDate: string; toDate: string; itemId?: string }) {
    const response = await api.get('/api/reports/purchase-supply-comparison', { params });
    return response.data.body as PurchaseSupplyComparisonResponse;
  },
  async getPurchaseSupplyComparisonPdf(params: { fromDate: string; toDate: string; itemId?: string }): Promise<string> {
    return fetchPdfBase64('/api/reports/purchase-supply-comparison/pdf', params);
  },

  // 11. Customer Balance Recovery
  async getCustomerBalanceRecovery(params: {
    fromDate: string;
    toDate: string;
    customerAccountId?: string;
    dateBasis?: 'ClearingDate' | 'VoucherDate';
    balanceFilter?: 'All' | 'OutstandingOnly' | 'ClearedOnly' | 'UnpaidOnly';
  }) {
    const response = await api.get('/api/reports/customer-balance-recovery', { params });
    return response.data.body as CustomerBalanceRecoveryResponse;
  },
  async getCustomerBalanceRecoveryPdf(params: {
    fromDate: string;
    toDate: string;
    customerAccountId?: string;
    dateBasis?: 'ClearingDate' | 'VoucherDate';
    balanceFilter?: 'All' | 'OutstandingOnly' | 'ClearedOnly' | 'UnpaidOnly';
  }): Promise<string> {
    return fetchPdfBase64('/api/reports/customer-balance-recovery/pdf', params);
  },
};
