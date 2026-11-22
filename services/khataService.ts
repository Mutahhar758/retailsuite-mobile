import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const DEFAULT_CASH_BANK_KEY = 'khata_default_cash_bank_account';

export interface KhataPartyDto {
  accountId: string;
  title: string;
  partyType: 'Customer' | 'Vendor' | string;
  phone?: string | null;
  balance: number; // Dr - Cr: >0 Receivable (You will Get), <0 Payable (You will Give)
  lastTransactionDate?: string | null;
  lastTransactionAmount?: number | null;
  lastTransactionType?: 'IN' | 'OUT' | 'OTHER' | string | null;
  lastTransactionNote?: string | null;
}

export interface KhataSummaryResponse {
  totalReceivable: number;
  totalPayable: number;
  netBalance: number;
  parties: KhataPartyDto[];
}

export interface KhataLedgerEntryDto {
  vDate: string;
  vType: string;
  voucherNo: string;
  vSeq: number;
  counterpartAccountId?: string | null;
  counterpartTitle: string;
  remarks?: string | null;
  narration?: string | null;
  dr: number;
  cr: number;
  runningBalance: number;
  isEditable: boolean;
  isMultiLineVoucher: boolean;
}

export interface KhataLedgerResponse {
  accountId: string;
  title: string;
  partyType: 'Customer' | 'Vendor' | string;
  phone?: string | null;
  openingBalance: number;
  currentBalance: number;
  totalIn: number;
  totalOut: number;
  entries: KhataLedgerEntryDto[];
}

export const khataService = {
  async getParties(params?: { partyType?: string; search?: string }): Promise<KhataSummaryResponse> {
    const response = await api.get('/api/khata/parties', { params });
    const body = response.data?.body;
    return {
      totalReceivable: body?.totalReceivable ?? 0,
      totalPayable: body?.totalPayable ?? 0,
      netBalance: body?.netBalance ?? 0,
      parties: (body?.parties ?? []) as KhataPartyDto[],
    };
  },

  async getPartyLedger(
    accountId: string,
    params?: { fromDate?: string; toDate?: string }
  ): Promise<KhataLedgerResponse> {
    const response = await api.get(`/api/khata/parties/${encodeURIComponent(accountId)}/ledger`, {
      params,
    });
    const body = response.data?.body;
    return {
      accountId: body?.accountId ?? accountId,
      title: body?.title ?? '',
      partyType: body?.partyType ?? 'Customer',
      phone: body?.phone ?? null,
      openingBalance: body?.openingBalance ?? 0,
      currentBalance: body?.currentBalance ?? 0,
      totalIn: body?.totalIn ?? 0,
      totalOut: body?.totalOut ?? 0,
      entries: (body?.entries ?? []) as KhataLedgerEntryDto[],
    };
  },

  async getSavedCashBankAccount(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(DEFAULT_CASH_BANK_KEY);
    } catch {
      return null;
    }
  },

  async setSavedCashBankAccount(accountId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(DEFAULT_CASH_BANK_KEY, accountId);
    } catch {
      // ignore storage errors
    }
  },
};

export function formatKhataAmount(amount: number): string {
  const abs = Math.abs(amount || 0);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `Rs ${formatted}`;
}
