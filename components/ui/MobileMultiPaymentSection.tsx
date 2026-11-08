import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';
import {
  chartOfAccountService,
  ChartOfAccountHeadDto,
} from '../../services/chartOfAccountService';

export interface PaymentSplitRow {
  accountId: string;
  amount: number;
  reference?: string;
  checkNum?: string;
  checkDate?: string;
}

interface MobileMultiPaymentSectionProps {
  mode: 'sale' | 'purchase';
  netTotal: number;
  payments: PaymentSplitRow[];
  onChange: (payments: PaymentSplitRow[]) => void;
  legacyCashAmount?: number;
  disabled?: boolean;
}

export const MobileMultiPaymentSection: React.FC<MobileMultiPaymentSectionProps> = ({
  mode,
  netTotal,
  payments,
  onChange,
  legacyCashAmount,
  disabled = false,
}) => {
  const [cashBankAccounts, setCashBankAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [defaultCashId, setDefaultCashId] = useState<string>('');
  const [hydrated, setHydrated] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  const isSale = mode === 'sale';

  useEffect(() => {
    let mounted = true;
    chartOfAccountService
      .getCashBankAccounts()
      .then((list) => {
        if (!mounted) return;
        const safeList = list || [];
        setCashBankAccounts(safeList);
        const cashAcc =
          safeList.find((a) => a.title.toLowerCase().includes('cash in hand')) ||
          safeList.find((a) => a.title.toLowerCase().includes('cash')) ||
          safeList[0];
        if (cashAcc) {
          setDefaultCashId(cashAcc.account);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!defaultCashId) return;
    if (!hydrated) {
      setHydrated(true);
      if (payments.length === 0) {
        onChange([
          {
            accountId: defaultCashId,
            amount: legacyCashAmount && legacyCashAmount > 0 ? legacyCashAmount : 0,
          },
        ]);
        return;
      }
    }
    if (payments.length === 1 && !payments[0].accountId) {
      onChange([{ ...payments[0], accountId: defaultCashId }]);
    }
  }, [defaultCashId, hydrated, legacyCashAmount, payments, onChange]);

  const isBankAccount = (accountId: string): boolean => {
    const acc = cashBankAccounts.find((a) => a.account === accountId);
    if (!acc) return false;
    return !acc.title.toLowerCase().includes('cash in hand');
  };

  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const difference = Math.round((netTotal - totalPaid) * 100) / 100;

  const updateRow = (idx: number, patch: Partial<PaymentSplitRow>) => {
    const next = [...payments];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const removeRow = (idx: number) => {
    if (payments.length <= 1) {
      onChange([{ accountId: defaultCashId, amount: 0 }]);
      return;
    }
    onChange(payments.filter((_, i) => i !== idx));
  };

  const addSplitRow = () => {
    const usedIds = new Set(payments.map((p) => p.accountId));
    const nextAcc =
      cashBankAccounts.find((a) => !usedIds.has(a.account))?.account ||
      defaultCashId ||
      cashBankAccounts[0]?.account ||
      '';
    const rem = Math.max(0, Math.round((netTotal - totalPaid) * 100) / 100);
    onChange([...payments, { accountId: nextAcc, amount: rem }]);
  };

  const handleFullCash = () => {
    const targetAcc = payments[0]?.accountId || defaultCashId;
    onChange([{ accountId: targetAcc, amount: Math.max(0, Math.round(netTotal * 100) / 100) }]);
  };

  const handleSetCredit = () => {
    onChange([
      {
        accountId: payments[0]?.accountId || defaultCashId,
        amount: 0,
      },
    ]);
  };

  const rowsToRender: PaymentSplitRow[] =
    payments.length > 0 ? payments : [{ accountId: defaultCashId, amount: 0 }];

  return (
    <View style={styles.container}>
      {/* Header + Quick Action Pills */}
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Ionicons
            name="wallet-outline"
            size={16}
            color={isSale ? '#16A34A' : '#2563EB'}
          />
          <Text style={styles.titleText}>
            {isSale ? 'Receipt / Settlement' : 'Payment / Settlement'}
          </Text>
        </View>

        {!disabled && (
          <View style={styles.quickBtnsRow}>
            <TouchableOpacity style={styles.quickPillCash} onPress={handleFullCash}>
              <Text style={styles.quickPillCashText}>Full Cash</Text>
            </TouchableOpacity>
            {totalPaid > 0 && (
              <TouchableOpacity style={styles.quickPillCredit} onPress={handleSetCredit}>
                <Text style={styles.quickPillCreditText}>Credit (0)</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.quickPillSplit} onPress={addSplitRow}>
              <Ionicons name="add" size={13} color={Theme.colors.primary} />
              <Text style={styles.quickPillSplitText}>Split / Bank</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Payment Rows */}
      {rowsToRender.map((row, idx) => {
        const isExpanded = Boolean(
          expandedRows[idx] !== undefined
            ? expandedRows[idx]
            : (row.checkNum && row.checkNum.trim()) || (row.reference && row.reference.trim())
        );
        const otherPaid = rowsToRender.reduce(
          (s, r, i) => (i === idx ? s : s + (Number(r.amount) || 0)),
          0
        );
        const rowRemainder = Math.max(0, Math.round((netTotal - otherPaid) * 100) / 100);

        return (
          <View key={idx} style={styles.paymentRowCard}>
            {/* Account Horizontal Selector Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.accountsScroll}
              contentContainerStyle={styles.accountsScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {cashBankAccounts.map((acc) => {
                const selected = acc.account === row.accountId;
                return (
                  <TouchableOpacity
                    key={acc.account}
                    style={[
                      styles.accountChip,
                      selected && styles.accountChipSelected,
                    ]}
                    onPress={() => !disabled && updateRow(idx, { accountId: acc.account })}
                    disabled={disabled}
                  >
                    <Ionicons
                      name={
                        acc.title.toLowerCase().includes('cash')
                          ? 'cash-outline'
                          : 'business-outline'
                      }
                      size={12}
                      color={selected ? '#FFFFFF' : Theme.colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.accountChipText,
                        selected && styles.accountChipTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {acc.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Amount Input + Fill Remainder + Expand / Collapse Cheque/Notes + Remove */}
            <View style={styles.amountInputRow}>
              <View style={styles.amountInputBox}>
                <Text style={styles.currencyPrefix}>Rs.</Text>
                <TextInput
                  style={styles.amountInput}
                  keyboardType="numeric"
                  placeholder="0 (Credit / Unpaid)"
                  placeholderTextColor={Theme.colors.textSecondary}
                  value={row.amount === 0 ? '' : String(row.amount)}
                  editable={!disabled}
                  onChangeText={(txt) => {
                    const num = parseFloat(txt);
                    updateRow(idx, { amount: isNaN(num) ? 0 : num });
                  }}
                />
                {row.amount > 0 && !disabled && (
                  <TouchableOpacity
                    onPress={() => updateRow(idx, { amount: 0 })}
                    style={styles.clearAmtBtn}
                  >
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={Theme.colors.textSecondary}
                    />
                  </TouchableOpacity>
                )}
              </View>

              {!disabled && rowRemainder > 0 && Math.abs(row.amount - rowRemainder) > 0.01 && (
                <TouchableOpacity
                  style={styles.fillBtn}
                  onPress={() => updateRow(idx, { amount: rowRemainder })}
                >
                  <Ionicons name="flash" size={12} color="#16A34A" />
                  <Text style={styles.fillBtnText}>
                    {rowRemainder.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Chevron Down/Up button to expand Cheque & Notes */}
              <TouchableOpacity
                style={[
                  styles.detailsToggleBtn,
                  isExpanded && styles.detailsToggleBtnActive,
                ]}
                onPress={() =>
                  setExpandedRows((prev) => ({
                    ...prev,
                    [idx]: !isExpanded,
                  }))
                }
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={isExpanded ? Theme.colors.primary : Theme.colors.textSecondary}
                />
              </TouchableOpacity>

              {!disabled && rowsToRender.length > 1 && (
                <TouchableOpacity
                  style={styles.removeRowBtn}
                  onPress={() => removeRow(idx)}
                >
                  <Ionicons name="trash-outline" size={16} color={Theme.colors.danger} />
                </TouchableOpacity>
              )}
            </View>

            {/* Extra Bank / Check / Reference Fields (Default Collapsed) */}
            {isExpanded && (
              <View style={styles.bankExtraRow}>
                <TextInput
                  style={styles.bankExtraInput}
                  placeholder="Cheque / Instrument #"
                  placeholderTextColor={Theme.colors.textSecondary}
                  value={row.checkNum || ''}
                  editable={!disabled}
                  onChangeText={(txt) => updateRow(idx, { checkNum: txt })}
                />
                <TextInput
                  style={styles.bankExtraInput}
                  placeholder="Ref / Txn ID / Notes"
                  placeholderTextColor={Theme.colors.textSecondary}
                  value={row.reference || ''}
                  editable={!disabled}
                  onChangeText={(txt) => updateRow(idx, { reference: txt })}
                />
              </View>
            )}
          </View>
        );
      })}

      {/* Settlement Summary Footer */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>
            {isSale ? 'Received' : 'Paid'}
          </Text>
          <Text style={[styles.summaryValue, { color: '#16A34A' }]}>
            Rs. {totalPaid.toLocaleString()}
          </Text>
        </View>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Net Bill</Text>
          <Text style={styles.summaryValue}>
            Rs. {netTotal.toLocaleString()}
          </Text>
        </View>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>
            {difference > 0.01
              ? 'On Credit / Due'
              : difference < -0.01
              ? 'Change Back'
              : 'Status'}
          </Text>
          <Text
            style={[
              styles.summaryValue,
              difference > 0.01
                ? { color: '#D97706' }
                : difference < -0.01
                ? { color: '#DC2626' }
                : { color: '#16A34A' },
            ]}
          >
            {difference > 0.01
              ? `Rs. ${difference.toLocaleString()}`
              : difference < -0.01
              ? `Rs. ${Math.abs(difference).toLocaleString()}`
              : 'Settled'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 10,
    marginTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  titleText: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  quickBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickPillCash: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quickPillCashText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  quickPillCredit: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quickPillCreditText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  quickPillSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quickPillSplitText: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  paymentRowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    marginBottom: 8,
  },
  accountsScroll: {
    marginBottom: 7,
  },
  accountsScrollContent: {
    gap: 6,
  },
  accountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  accountChipSelected: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  accountChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Theme.colors.text,
    maxWidth: 150,
  },
  accountChipTextSelected: {
    color: '#FFFFFF',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  amountInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 9,
    height: 36,
  },
  currencyPrefix: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.textSecondary,
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.text,
    paddingVertical: 2,
  },
  clearAmtBtn: {
    padding: 2,
  },
  fillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 8,
    height: 36,
    borderRadius: 8,
  },
  fillBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#15803D',
  },
  removeRowBtn: {
    width: 34,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsToggleBtn: {
    width: 34,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsToggleBtnActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  bankExtraRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  bankExtraInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
    height: 35,
    fontSize: 12,
    color: Theme.colors.text,
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.text,
    marginTop: 1,
  },
});
