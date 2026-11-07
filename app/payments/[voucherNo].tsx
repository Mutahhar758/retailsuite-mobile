import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { Theme } from '../../constants/theme';
import { extractErrorMessage } from '../../services/api';
import { paymentService, PaymentLineRequest } from '../../services/paymentService';
import {
  chartOfAccountService,
  ChartOfAccountHeadDto,
} from '../../services/chartOfAccountService';
import { narrationService, NarrationDto } from '../../services/narrationService';
import { InlineSearchSelect, InlineSelectOption } from '../../components/ui/InlineSearchSelect';
import { useKeyboard } from '../../hooks/useKeyboard';

interface EditablePaymentLine extends PaymentLineRequest {
  showCheque?: boolean;
}

export default function PaymentFormScreen() {
  const { voucherNo, mode, draftData } = useLocalSearchParams<{
    voucherNo: string;
    mode?: string;
    draftData?: string;
  }>();
  const router = useRouter();
  const isEdit = Boolean(voucherNo && voucherNo !== 'new' && mode !== 'copy');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Lookups
  const [cashBankAccounts, setCashBankAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [detailAccounts, setDetailAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});

  // Form State
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [clearingDate, setClearingDate] = useState<Date | null>(null);
  const [showClearingDatePicker, setShowClearingDatePicker] = useState(false);
  const [cashBankAccount, setCashBankAccount] = useState('');
  const [narration, setNarration] = useState('');
  const [narrationExpanded, setNarrationExpanded] = useState(false);
  const { keyboardHeight, isKeyboardVisible } = useKeyboard();

  // Lines State
  const [lines, setLines] = useState<EditablePaymentLine[]>([]);
  const [activeCheckDateSeq, setActiveCheckDateSeq] = useState<number | null>(null);

  useEffect(() => {
    fetchLookups();
  }, []);

  const fetchBalance = async (accountId: string) => {
    if (!accountId || balances[accountId] !== undefined) return;
    try {
      const bal = await paymentService.getAccountBalance(accountId);
      setBalances((prev) => ({ ...prev, [accountId]: bal }));
    } catch {
      // ignore balance error
    }
  };

  const fetchLookups = async () => {
    try {
      const [cbAccs, detAccs, narrs] = await Promise.all([
        chartOfAccountService.getCashBankAccounts(),
        chartOfAccountService.getDetailAccounts(),
        narrationService.getActiveNarrationsLookup(),
      ]);
      const safeCb = cbAccs || [];
      setCashBankAccounts(safeCb);
      setDetailAccounts(detAccs || []);
      setNarrations(narrs || []);

      if (isEdit) {
        await loadVoucherDetails();
      } else {
        const defaultCash =
          safeCb.find((a) => a.title.toLowerCase().includes('cash in hand')) ||
          safeCb.find((a) => a.title.toLowerCase().includes('cash')) ||
          safeCb[0];
        if (defaultCash) {
          setCashBankAccount(defaultCash.account);
          fetchBalance(defaultCash.account);
        }

        if (draftData) {
          try {
            const parsed = typeof draftData === 'string' ? JSON.parse(draftData) : draftData;
            if (parsed.cashBankAccountId || parsed.cashAccount) {
              const cbId = parsed.cashBankAccountId || parsed.cashAccount;
              setCashBankAccount(cbId);
              fetchBalance(cbId);
            }
            if (parsed.date) {
              const d = new Date(parsed.date);
              if (!isNaN(d.getTime())) setDate(d);
            }
            if (parsed.amount || parsed.accountId || parsed.vendorId || parsed.account) {
              const accId =
                parsed.accountId || parsed.vendorId || parsed.account || '';
              const amt = Number(parsed.amount) || 0;
              if (accId) fetchBalance(accId);
              setLines([
                {
                  seq: 1,
                  account: accId,
                  amount: amt,
                  checkNum: '',
                  checkDate: '',
                  remarks: parsed.remarks || '',
                },
              ]);
            }
          } catch (e) {
            console.warn('Failed to parse draftData', e);
          }
        }
        setLoading(false);
      }
    } catch {
      Alert.alert('Error', 'Failed to load form data.');
      setLoading(false);
    }
  };

  const loadVoucherDetails = async () => {
    try {
      const details = await paymentService.getDetail(voucherNo!);
      if (details && details.length > 0) {
        const first = details[0];
        setDate(new Date(first.date));
        setClearingDate(first.clearingDate ? new Date(first.clearingDate) : null);
        setCashBankAccount(first.cashBankAccountId);
        setNarration(first.narrationId || '');

        const mappedLines: EditablePaymentLine[] = details.map((d) => ({
          seq: d.seq,
          account: d.accountId,
          amount: d.amount,
          checkNum: d.checkNum || '',
          checkDate: d.checkDate || '',
          remarks: d.remarks || '',
          showCheque: Boolean(d.checkNum || d.checkDate),
        }));
        setLines(mappedLines);

        fetchBalance(first.cashBankAccountId);
        mappedLines.forEach((l) => fetchBalance(l.account));
      }
    } catch {
      Alert.alert('Error', 'Failed to load payment details.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAddAccount = (accountId: string) => {
    if (!accountId) return;
    fetchBalance(accountId);
    setLines((prev) => {
      const maxSeq = prev.reduce((max, l) => Math.max(max, l.seq || 0), 0);
      return [
        ...prev,
        {
          seq: maxSeq + 1,
          account: accountId,
          amount: 0,
          checkNum: '',
          checkDate: '',
          remarks: '',
          showCheque: false,
        },
      ];
    });
  };

  const updateLine = (seq: number, patch: Partial<EditablePaymentLine>) => {
    setLines((prev) =>
      prev.map((l) => (l.seq === seq ? { ...l, ...patch } : l))
    );
  };

  const removeLine = async (seq: number) => {
    if (isEdit) {
      try {
        await paymentService.deleteLine(voucherNo!, seq);
      } catch {
        Alert.alert('Error', 'Failed to delete line from database.');
        return;
      }
    }
    setLines((prev) => prev.filter((l) => l.seq !== seq));
  };

  const handleSaveVoucher = async () => {
    if (!cashBankAccount || !date) {
      Alert.alert('Validation Error', 'Date and Cash/Bank Account are required.');
      return;
    }
    const validLines = lines.filter((l) => l.account && (Number(l.amount) || 0) > 0);
    if (validLines.length === 0) {
      Alert.alert(
        'Validation Error',
        'Please add at least one account with an amount greater than 0.'
      );
      return;
    }

    setSaving(true);
    try {
      const cleanedLines = validLines.map((l, idx) => ({
        seq: idx + 1,
        account: l.account,
        amount: Number(l.amount) || 0,
        checkNum: l.checkNum || undefined,
        checkDate: l.checkDate || undefined,
        remarks: l.remarks || undefined,
      }));

      const request = {
        date: dayjs(date).format('YYYY-MM-DD'),
        clearingDate: clearingDate ? dayjs(clearingDate).format('YYYY-MM-DD') : undefined,
        cashBankAccount,
        narration: narration || undefined,
        lines: cleanedLines,
      };

      if (isEdit) {
        await paymentService.update(voucherNo!, request);
        Alert.alert('Success', 'Payment updated successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        await paymentService.create(request);
        Alert.alert('Success', 'Payment created successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', extractErrorMessage(error, 'Failed to save payment.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVoucher = () => {
    Alert.alert('Delete Payment', 'Are you sure you want to delete this payment voucher?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await paymentService.delete(voucherNo!);
            Alert.alert('Success', 'Payment deleted.', [
              { text: 'OK', onPress: () => router.back() },
            ]);
          } catch {
            Alert.alert('Error', 'Failed to delete payment.');
            setSaving(false);
          }
        },
      },
    ]);
  };

  const cashBankOptions: InlineSelectOption[] = useMemo(
    () =>
      cashBankAccounts.map((a) => ({
        id: a.account,
        title: a.title,
        subtitle: `Acc: ${a.account}`,
      })),
    [cashBankAccounts]
  );

  const detailAccountOptions: InlineSelectOption[] = useMemo(
    () =>
      detailAccounts.map((a) => ({
        id: a.account,
        title: a.title,
        subtitle: `Acc: ${a.account}`,
      })),
    [detailAccounts]
  );

  const narrationOptions: InlineSelectOption[] = useMemo(
    () => narrations.map((n) => ({ id: n.code, title: n.title })),
    [narrations]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  const totalAmount = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const cbBal = cashBankAccount ? balances[cashBankAccount] : undefined;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        style={styles.container}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: isKeyboardVisible ? Math.max(keyboardHeight, 280) + 24 : 40 },
          ]}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Master Details Card */}
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.cardTitle}>Payment Voucher</Text>
              <View style={styles.voucherBadge}>
                <Text style={styles.voucherBadgeText}>
                  {isEdit ? `PV-${String(voucherNo).padStart(5, '0')}` : 'NEW PV'}
                </Text>
              </View>
            </View>

            <View style={styles.dateRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Voucher Date *</Text>
                <TouchableOpacity
                  style={styles.dateBtn}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={15} color={Theme.colors.primary} />
                  <Text style={styles.dateText}>{dayjs(date).format('DD MMM YYYY')}</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.labelWithAction}>
                  <Text style={styles.label}>Clearing Date</Text>
                  {clearingDate && (
                    <TouchableOpacity onPress={() => setClearingDate(null)}>
                      <Text style={styles.clearDateText}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.dateBtn}
                  onPress={() => setShowClearingDatePicker(true)}
                >
                  <Ionicons
                    name="calendar-clear-outline"
                    size={15}
                    color={Theme.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.dateText,
                      !clearingDate && { color: Theme.colors.textSecondary },
                    ]}
                  >
                    {clearingDate ? dayjs(clearingDate).format('DD MMM YYYY') : 'Optional'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                onChange={(_, d) => {
                  setShowDatePicker(false);
                  if (d) setDate(d);
                }}
              />
            )}

            {showClearingDatePicker && (
              <DateTimePicker
                value={clearingDate || new Date()}
                mode="date"
                display="default"
                onChange={(_, d) => {
                  setShowClearingDatePicker(false);
                  if (d) setClearingDate(d);
                }}
              />
            )}

            <InlineSearchSelect
              label="Paying Cash / Bank Account *"
              placeholder="Select Cash or Bank Account..."
              value={cashBankAccount}
              options={cashBankOptions}
              onSelect={(id) => {
                setCashBankAccount(id);
                fetchBalance(id);
              }}
              compact
              rightAccessory={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {cbBal !== undefined && (
                    <Text
                      style={[
                        styles.balancePillText,
                        cbBal >= 0 ? { color: '#16A34A' } : { color: '#DC2626' },
                      ]}
                    >
                      Bal: Rs. {Math.abs(cbBal).toLocaleString()} {cbBal >= 0 ? 'Dr' : 'Cr'}
                    </Text>
                  )}
                  <TouchableOpacity
                    style={styles.notesToggleLink}
                    onPress={() => setNarrationExpanded((prev) => !prev)}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  >
                    <Text
                      style={[
                        styles.notesToggleLinkText,
                        (narrationExpanded || Boolean(narration)) && styles.notesToggleLinkTextActive,
                      ]}
                    >
                      {narrationExpanded || Boolean(narration) ? 'Narration' : '+ Narration'}
                    </Text>
                    <Ionicons
                      name={
                        narrationExpanded || Boolean(narration)
                          ? 'chevron-up'
                          : 'chevron-down'
                      }
                      size={14}
                      color={Theme.colors.primary}
                    />
                  </TouchableOpacity>
                </View>
              }
            />

            {(narrationExpanded || Boolean(narration)) && (
              <InlineSearchSelect
                label="Narration"
                placeholder="Select or type narration..."
                value={narration}
                options={narrationOptions}
                onSelect={setNarration}
                allowClear
                allowCustomText
                compact
              />
            )}
          </View>

          {/* Fast Inline Account Entry + Editable Lines */}
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.cardTitle}>
                Paid To Accounts ({lines.length})
              </Text>
              <Text style={styles.totalBadge}>
                Total: Rs. {totalAmount.toLocaleString()}
              </Text>
            </View>

            <InlineSearchSelect
              placeholder="+ Search & tap Vendor / Expense / Account to add row..."
              value=""
              options={detailAccountOptions}
              onSelect={(accId) => handleQuickAddAccount(accId)}
              compact
            />

            {lines.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="wallet-outline" size={30} color={Theme.colors.border} />
                <Text style={styles.emptyText}>
                  Tap above to select an account and enter paid amount directly.
                </Text>
              </View>
            ) : (
              lines.map((line, index) => {
                const accObj = detailAccounts.find((a) => a.account === line.account);
                const accBal = line.account ? balances[line.account] : undefined;

                return (
                  <View key={line.seq || index} style={styles.lineCard}>
                    <View style={styles.lineHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.lineAccountTitle} numberOfLines={1}>
                          {accObj?.title || line.account || 'Select Account'}
                        </Text>
                        <View style={styles.lineMetaRow}>
                          <Text style={styles.lineAccountCode}>{line.account}</Text>
                          {accBal !== undefined && (
                            <TouchableOpacity
                              style={[
                                styles.balChip,
                                accBal >= 0 ? styles.balChipDr : styles.balChipCr,
                              ]}
                              onPress={() => {
                                if (Math.abs(accBal) > 0) {
                                  updateLine(line.seq, { amount: Math.abs(accBal) });
                                }
                              }}
                            >
                              <Text
                                style={[
                                  styles.balChipText,
                                  accBal >= 0 ? { color: '#15803D' } : { color: '#B91C1C' },
                                ]}
                              >
                                Bal: Rs. {Math.abs(accBal).toLocaleString()}{' '}
                                {accBal >= 0 ? 'Dr' : 'Cr (Tap to Fill)'}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>

                      <View style={styles.lineTopBtns}>
                        <TouchableOpacity
                          style={[
                            styles.chequeToggleBtn,
                            line.showCheque && styles.chequeToggleBtnActive,
                          ]}
                          onPress={() =>
                            updateLine(line.seq, { showCheque: !line.showCheque })
                          }
                        >
                          <Text
                            style={[
                              styles.chequeToggleText,
                              line.showCheque && { color: '#FFF' },
                            ]}
                          >
                            Cheque
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => removeLine(line.seq)}
                          style={{ padding: 4 }}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={16}
                            color={Theme.colors.danger}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.inlineFieldsRow}>
                      <View style={styles.amountFieldWrap}>
                        <Text style={styles.miniLabel}>Amount (Rs.) *</Text>
                        <TextInput
                          style={styles.amountInput}
                          keyboardType="numeric"
                          selectTextOnFocus
                          placeholder="0"
                          value={line.amount === 0 ? '' : String(line.amount)}
                          onChangeText={(txt) =>
                            updateLine(line.seq, { amount: parseFloat(txt) || 0 })
                          }
                        />
                      </View>

                      <View style={styles.remarksFieldWrap}>
                        <Text style={styles.miniLabel}>Remarks / Particulars</Text>
                        <TextInput
                          style={styles.remarksInput}
                          placeholder="Optional remarks..."
                          placeholderTextColor={Theme.colors.textSecondary}
                          value={line.remarks || ''}
                          onChangeText={(txt) => updateLine(line.seq, { remarks: txt })}
                        />
                      </View>
                    </View>

                    {line.showCheque && (
                      <View style={[styles.inlineFieldsRow, { marginTop: 6 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.miniLabel}>Cheque #</Text>
                          <TextInput
                            style={styles.remarksInput}
                            placeholder="Cheque number"
                            value={line.checkNum || ''}
                            onChangeText={(txt) => updateLine(line.seq, { checkNum: txt })}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.miniLabel}>Cheque Date</Text>
                          <TouchableOpacity
                            style={styles.chequeDateBtn}
                            onPress={() => setActiveCheckDateSeq(line.seq)}
                          >
                            <Text style={styles.chequeDateText}>
                              {line.checkDate
                                ? dayjs(line.checkDate).format('DD MMM YYYY')
                                : 'Select Date'}
                            </Text>
                            <Ionicons
                              name="calendar-outline"
                              size={14}
                              color={Theme.colors.textSecondary}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            )}

            {activeCheckDateSeq !== null && (
              <DateTimePicker
                value={new Date()}
                mode="date"
                display="default"
                onChange={(_, selDate) => {
                  const targetSeq = activeCheckDateSeq;
                  setActiveCheckDateSeq(null);
                  if (selDate && targetSeq !== null) {
                    updateLine(targetSeq, {
                      checkDate: dayjs(selDate).format('YYYY-MM-DD'),
                    });
                  }
                }}
              />
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {isEdit && (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={handleDeleteVoucher}
              disabled={saving}
            >
              <Ionicons name="trash-outline" size={20} color={Theme.colors.danger} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSaveVoucher}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>
                  {isEdit
                    ? 'Update Payment'
                    : `Save Payment (Rs. ${totalAmount.toLocaleString()})`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Theme.colors.background },
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  content: { padding: 12, paddingBottom: 32 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 12,
    ...Theme.shadows.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  voucherBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  voucherBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  totalBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.danger,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
    marginBottom: 4,
  },
  labelWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearDateText: {
    fontSize: 11,
    fontWeight: '600',
    color: Theme.colors.danger,
    marginBottom: 4,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
  },
  dateText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  balancePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  notesToggleLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  notesToggleLinkText: {
    fontSize: 11,
    fontWeight: '600',
    color: Theme.colors.primary,
  },
  notesToggleLinkTextActive: {
    fontWeight: '700',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  emptyText: {
    fontSize: 12.5,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
  },
  lineCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginTop: 8,
  },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  lineAccountTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  lineMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  lineAccountCode: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
  },
  balChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  balChipDr: {
    backgroundColor: '#DCFCE7',
  },
  balChipCr: {
    backgroundColor: '#FEE2E2',
  },
  balChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  lineTopBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chequeToggleBtn: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chequeToggleBtnActive: {
    backgroundColor: Theme.colors.primary,
  },
  chequeToggleText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  inlineFieldsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  amountFieldWrap: {
    flex: 0.9,
  },
  remarksFieldWrap: {
    flex: 1.3,
  },
  miniLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
    marginBottom: 2,
  },
  amountInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    paddingHorizontal: 9,
    height: 36,
    fontSize: 14,
    fontWeight: '700',
    color: '#B91C1C',
  },
  remarksInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 9,
    height: 36,
    fontSize: 13,
    color: Theme.colors.text,
  },
  chequeDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 9,
    height: 36,
  },
  chequeDateText: {
    fontSize: 12,
    color: Theme.colors.text,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
  },
  deleteBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 10,
    backgroundColor: Theme.colors.primary,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
