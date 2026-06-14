import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, Alert, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, Modal
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Theme } from '../../constants/theme';
import { receiptService, ReceiptLineRequest } from '../../services/receiptService';
import { chartOfAccountService, ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { narrationService, NarrationDto } from '../../services/narrationService';
import dayjs from 'dayjs';

export default function ReceiptFormScreen() {
  const { voucherNo, mode } = useLocalSearchParams<{ voucherNo: string; mode?: string }>();
  const router = useRouter();
  const isEdit = voucherNo && voucherNo !== 'new' && mode !== 'copy';

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
  const [cashBankAccount, setCashBankAccount] = useState('');
  const [narration, setNarration] = useState('');
  
  // Lines State
  const [lines, setLines] = useState<ReceiptLineRequest[]>([]);
  
  // Line Modal State
  const [lineModalVisible, setLineModalVisible] = useState(false);
  const [currentLine, setCurrentLine] = useState<Partial<ReceiptLineRequest>>({});
  const [showCheckDatePicker, setShowCheckDatePicker] = useState(false);
  const [currentCheckDate, setCurrentCheckDate] = useState(new Date());

  // Searchable Modal State
  const [selectModalVisible, setSelectModalVisible] = useState(false);
  const [selectModalType, setSelectModalType] = useState<'cashBank' | 'narration' | 'account'>('cashBank');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLookups();
  }, []);

  const fetchLookups = async () => {
    try {
      const [cbAccs, detAccs, narrs] = await Promise.all([
        chartOfAccountService.getCashBankAccounts(),
        chartOfAccountService.getDetailAccounts(),
        narrationService.getActiveNarrations()
      ]);
      setCashBankAccounts(cbAccs);
      setDetailAccounts(detAccs);
      setNarrations(narrs);
      
      if (isEdit) {
        await loadVoucherDetails();
      } else {
        setLoading(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load form data.');
      setLoading(false);
    }
  };

  const loadVoucherDetails = async () => {
    try {
      const details = await receiptService.getDetail(voucherNo!);
      if (details && details.length > 0) {
        const first = details[0];
        setDate(new Date(first.date));
        setCashBankAccount(first.cashBankAccountId);
        setNarration(first.narrationId || '');
        
        const mappedLines = details.map(d => ({
          seq: d.seq,
          account: d.accountId,
          amount: d.amount,
          checkNum: d.checkNum || '',
          checkDate: d.checkDate || '',
          remarks: d.remarks || ''
        }));
        setLines(mappedLines);
        
        // Fetch balances for loaded accounts
        fetchBalance(first.cashBankAccountId);
        mappedLines.forEach(l => fetchBalance(l.account));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load receipt details.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async (accountId: string) => {
    if (!accountId || balances[accountId] !== undefined) return;
    try {
      const bal = await receiptService.getAccountBalance(accountId);
      setBalances(prev => ({ ...prev, [accountId]: bal }));
    } catch (error) {
      console.log('Balance fetch failed for', accountId);
    }
  };

  const handleCashBankAccountChange = (val: string) => {
    setCashBankAccount(val);
    fetchBalance(val);
  };

  const openSelectModal = (type: 'cashBank' | 'narration' | 'account') => {
    setSelectModalType(type);
    setSearchQuery('');
    setSelectModalVisible(true);
  };

  const handleSelect = (val: string) => {
    if (selectModalType === 'cashBank') {
      handleCashBankAccountChange(val);
    } else if (selectModalType === 'narration') {
      setNarration(val);
    } else if (selectModalType === 'account') {
      setCurrentLine({ ...currentLine, account: val });
    }
    setSelectModalVisible(false);
  };

  const openLineModal = (line?: ReceiptLineRequest) => {
    if (line) {
      setCurrentLine({ ...line });
      if (line.checkDate) {
        setCurrentCheckDate(new Date(line.checkDate));
      }
    } else {
      const maxSeq = lines.reduce((max, l) => Math.max(max, l.seq), 0);
      setCurrentLine({
        seq: maxSeq + 1,
        account: '',
        amount: 0,
        checkNum: '',
        checkDate: '',
        remarks: ''
      });
      setCurrentCheckDate(new Date());
    }
    setLineModalVisible(true);
  };

  const saveLine = () => {
    if (!currentLine.account || !currentLine.amount || currentLine.amount <= 0) {
      Alert.alert('Validation Error', 'Account and a valid amount are required.');
      return;
    }
    
    fetchBalance(currentLine.account);
    
    setLines(prev => {
      const exists = prev.findIndex(l => l.seq === currentLine.seq);
      if (exists >= 0) {
        const newLines = [...prev];
        newLines[exists] = currentLine as ReceiptLineRequest;
        return newLines;
      }
      return [...prev, currentLine as ReceiptLineRequest];
    });
    setLineModalVisible(false);
  };

  const removeLine = async (seq: number) => {
    if (isEdit) {
      try {
        await receiptService.deleteLine(voucherNo!, seq);
      } catch (error) {
        Alert.alert('Error', 'Failed to delete line from database.');
        return;
      }
    }
    setLines(prev => prev.filter(l => l.seq !== seq));
  };

  const handleSaveVoucher = async () => {
    if (!cashBankAccount || !date) {
      Alert.alert('Validation Error', 'Date and Cash/Bank Account are required.');
      return;
    }
    if (lines.length === 0) {
      Alert.alert('Validation Error', 'At least one line item is required.');
      return;
    }

    setSaving(true);
    try {
      const cleanedLines = lines.map(l => ({
        seq: l.seq,
        account: l.account,
        amount: l.amount,
        checkNum: l.checkNum || undefined,
        checkDate: l.checkDate || undefined,
        remarks: l.remarks || undefined
      }));

      const request = {
        date: dayjs(date).format('YYYY-MM-DD'),
        cashBankAccount,
        narration: narration || undefined,
        lines: cleanedLines
      };

      if (isEdit) {
        await receiptService.update(voucherNo!, request);
        Alert.alert('Success', 'Receipt updated successfully.', [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        await receiptService.create(request);
        Alert.alert('Success', 'Receipt created successfully.', [{ text: 'OK', onPress: () => router.back() }]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to save receipt.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVoucher = () => {
    Alert.alert('Delete Receipt', 'Are you sure you want to delete this receipt?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await receiptService.delete(voucherNo!);
            Alert.alert('Success', 'Receipt deleted.', [{ text: 'OK', onPress: () => router.back() }]);
          } catch (error) {
            Alert.alert('Error', 'Failed to delete receipt.');
            setSaving(false);
          }
        }
      }
    ]);
  };

  const handleCopyAsNew = () => {
    Alert.alert('Copy as New', 'Are you sure you want to duplicate this voucher?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Copy', 
        onPress: () => {
          router.replace({ pathname: '/receipts/[voucherNo]', params: { voucherNo: voucherNo, mode: 'copy' } });
        }
      }
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  const totalAmount = lines.reduce((sum, l) => sum + (l.amount || 0), 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          
          <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Master Details</Text>
              {isEdit && (
                <View style={styles.voucherBadge}>
                  <Text style={styles.voucherBadgeText}>
                    RV-{String(voucherNo).padStart(5, '0')}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date *</Text>
              <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateText}>{dayjs(date).format('DD-MMM-YYYY')}</Text>
                <Ionicons name="calendar-outline" size={20} color={Theme.colors.textSecondary} />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) setDate(selectedDate);
                  }}
                />
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Cash/Bank Account *</Text>
              <TouchableOpacity 
                style={styles.pickerContainer}
                onPress={() => openSelectModal('cashBank')}
              >
                <Text style={[styles.selectorText, !cashBankAccount && { color: Theme.colors.textSecondary }]}>
                  {cashBankAccount ? cashBankAccounts.find(a => a.account === cashBankAccount)?.title || cashBankAccount : 'Select Account'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={Theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Narration</Text>
              <TouchableOpacity 
                style={styles.pickerContainer}
                onPress={() => openSelectModal('narration')}
              >
                <Text style={[styles.selectorText, !narration && { color: Theme.colors.textSecondary }]}>
                  {narration ? narrations.find(n => n.code === narration)?.title || narration : 'Select Narration'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={Theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Line Items</Text>
              <TouchableOpacity style={styles.addBtn} onPress={() => openLineModal()}>
                <Ionicons name="add" size={16} color={Theme.colors.white} />
                <Text style={styles.addBtnText}>Add Line</Text>
              </TouchableOpacity>
            </View>

            {lines.length === 0 ? (
              <Text style={styles.emptyLinesText}>No lines added yet.</Text>
            ) : (
              lines.map((line, index) => {
                const accTitle = detailAccounts.find(a => a.account === line.account)?.title || line.account;
                return (
                  <View key={line.seq} style={styles.lineCard}>
                    <View style={styles.lineInfo}>
                      <Text style={styles.lineAccount} numberOfLines={1}>{accTitle}</Text>
                      <Text style={styles.lineAmount}>Rs. {line.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                      {line.checkNum ? <Text style={styles.lineDetail}>Chk: {line.checkNum} {line.checkDate ? `(${line.checkDate})` : ''}</Text> : null}
                      {line.remarks ? <Text style={styles.lineDetail} numberOfLines={1}>Remarks: {line.remarks}</Text> : null}
                    </View>
                    <View style={styles.lineActions}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => openLineModal(line)}>
                        <Ionicons name="pencil" size={20} color={Theme.colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => removeLine(line.seq)}>
                        <Ionicons name="trash" size={20} color={Theme.colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>Rs. {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
            </View>
          </Animated.View>

          {/* Balances Preview */}
          {Object.keys(balances).length > 0 && (
            <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.section}>
              <Text style={styles.sectionTitle}>Current Balances</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.balancesContainer}>
                {Object.entries(balances).map(([acc, bal]) => {
                  const title = cashBankAccounts.find(a => a.account === acc)?.title || detailAccounts.find(a => a.account === acc)?.title || acc;
                  const isPositive = bal >= 0;
                  return (
                    <View key={acc} style={[styles.balanceCard, isPositive ? styles.balancePositive : styles.balanceNegative]}>
                      <Text style={styles.balanceTitle} numberOfLines={1}>{title}</Text>
                      <Text style={[styles.balanceValue, isPositive ? styles.textPositive : styles.textNegative]}>
                        Rs. {Math.abs(bal).toLocaleString(undefined, { minimumFractionDigits: 2 })} {isPositive ? 'Dr' : 'Cr'}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </Animated.View>
          )}

        </ScrollView>

        <View style={styles.footer}>
          {isEdit && (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteVoucher} disabled={saving}>
              <Ionicons name="trash-outline" size={24} color={Theme.colors.danger} />
            </TouchableOpacity>
          )}
          {(isEdit || mode === 'copy') && (
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopyAsNew} disabled={saving || mode === 'copy'}>
              <Ionicons name="copy-outline" size={24} color={Theme.colors.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.saveBtn, { flex: 1 }]} onPress={handleSaveVoucher} disabled={saving}>
            {saving ? <ActivityIndicator color={Theme.colors.white} /> : (
              <>
                <Ionicons name="save-outline" size={20} color={Theme.colors.white} style={{ marginRight: 8 }} />
                <Text style={styles.saveBtnText}>Save Receipt</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Line Item Modal */}
        <Modal visible={lineModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{currentLine.account ? 'Edit Line' : 'Add Line'}</Text>
                <TouchableOpacity onPress={() => setLineModalVisible(false)}>
                  <Ionicons name="close" size={24} color={Theme.colors.text} />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalBody}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Account *</Text>
                  <TouchableOpacity 
                    style={styles.pickerContainer}
                    onPress={() => openSelectModal('account')}
                  >
                    <Text style={[styles.selectorText, !currentLine.account && { color: Theme.colors.textSecondary }]}>
                      {currentLine.account ? detailAccounts.find(a => a.account === currentLine.account)?.title || currentLine.account : 'Select Account'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={Theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Amount *</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    placeholder="Enter amount"
                    value={currentLine.amount ? currentLine.amount.toString() : ''}
                    onChangeText={(val) => setCurrentLine({ ...currentLine, amount: parseFloat(val) || 0 })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Check #</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Optional check number"
                    value={currentLine.checkNum}
                    onChangeText={(val) => setCurrentLine({ ...currentLine, checkNum: val })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Check Date</Text>
                  <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowCheckDatePicker(true)}>
                    <Text style={styles.dateText}>
                      {currentLine.checkDate ? dayjs(currentLine.checkDate).format('DD-MMM-YYYY') : 'Select Date'}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color={Theme.colors.textSecondary} />
                  </TouchableOpacity>
                  {showCheckDatePicker && (
                    <DateTimePicker
                      value={currentCheckDate}
                      mode="date"
                      display="default"
                      onChange={(event, selDate) => {
                        setShowCheckDatePicker(false);
                        if (selDate) {
                          setCurrentCheckDate(selDate);
                          setCurrentLine({ ...currentLine, checkDate: dayjs(selDate).format('YYYY-MM-DD') });
                        }
                      }}
                    />
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Remarks</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Optional remarks"
                    value={currentLine.remarks}
                    onChangeText={(val) => setCurrentLine({ ...currentLine, remarks: val })}
                  />
                </View>
                
                <TouchableOpacity style={styles.modalSaveBtn} onPress={saveLine}>
                  <Text style={styles.modalSaveBtnText}>Confirm Line</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

      </KeyboardAvoidingView>

      {/* Shared Selection Modal */}
      <Modal visible={selectModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '50%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectModalType === 'cashBank' ? 'Select Cash/Bank' :
                 selectModalType === 'narration' ? 'Select Narration' : 'Select Account'}
              </Text>
              <TouchableOpacity onPress={() => setSelectModalVisible(false)}>
                <Ionicons name="close" size={24} color={Theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={Theme.colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={Theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView>
              {selectModalType === 'cashBank' && cashBankAccounts
                .filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.account.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(a => (
                <TouchableOpacity key={a.account} style={styles.modalListItem} onPress={() => handleSelect(a.account)}>
                  <Text style={styles.modalListItemText}>{a.title}</Text>
                  <Text style={styles.modalListItemSub}>{a.account}</Text>
                </TouchableOpacity>
              ))}
              {selectModalType === 'narration' && narrations
                .filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(n => (
                <TouchableOpacity key={n.code} style={styles.modalListItem} onPress={() => handleSelect(n.code)}>
                  <Text style={styles.modalListItemText}>{n.title}</Text>
                </TouchableOpacity>
              ))}
              {selectModalType === 'account' && detailAccounts
                .filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.account.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(a => (
                <TouchableOpacity key={a.account} style={styles.modalListItem} onPress={() => handleSelect(a.account)}>
                  <Text style={styles.modalListItemText}>{a.title}</Text>
                  <Text style={styles.modalListItemSub}>{a.account}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Theme.spacing.md,
    paddingBottom: Theme.spacing.xxl,
  },
  section: {
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radii.lg,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    ...Theme.shadows.sm,
  },
  sectionTitle: {
    ...Theme.typography.h3,
    color: Theme.colors.text,
  },
  voucherBadge: {
    backgroundColor: Theme.colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Theme.radii.sm,
  },
  voucherBadgeText: {
    ...Theme.typography.small,
    color: Theme.colors.primary,
    fontWeight: '700',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  inputGroup: {
    marginBottom: Theme.spacing.md,
  },
  label: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    marginBottom: 6,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radii.sm,
    padding: Theme.spacing.sm,
    ...Theme.typography.body,
    backgroundColor: Theme.colors.background,
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radii.sm,
    backgroundColor: Theme.colors.background,
    padding: Theme.spacing.sm,
    height: 50,
  },
  datePickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radii.sm,
    padding: Theme.spacing.sm,
    backgroundColor: Theme.colors.background,
    height: 50,
  },
  dateText: {
    ...Theme.typography.body,
    color: Theme.colors.text,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 8,
    borderRadius: Theme.radii.round,
  },
  addBtnText: {
    color: Theme.colors.white,
    fontWeight: '600',
    marginLeft: 4,
    fontSize: 14,
  },
  emptyLinesText: {
    ...Theme.typography.body,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: Theme.spacing.md,
  },
  lineCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radii.md,
    padding: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
    backgroundColor: Theme.colors.background,
  },
  lineInfo: {
    flex: 1,
  },
  lineAccount: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.text,
  },
  lineAmount: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.success,
    fontWeight: '700',
    marginTop: 2,
  },
  lineDetail: {
    ...Theme.typography.small,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  lineActions: {
    justifyContent: 'space-around',
    paddingLeft: Theme.spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: Theme.colors.border,
  },
  actionBtn: {
    padding: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Theme.spacing.md,
    paddingTop: Theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
  },
  totalLabel: {
    ...Theme.typography.h3,
    color: Theme.colors.text,
  },
  totalValue: {
    ...Theme.typography.h2,
    color: Theme.colors.primary,
  },
  balancesContainer: {
    flexDirection: 'row',
  },
  balanceCard: {
    padding: Theme.spacing.md,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    marginRight: Theme.spacing.sm,
    minWidth: 150,
  },
  balancePositive: {
    backgroundColor: Theme.colors.success + '10',
    borderColor: Theme.colors.success + '30',
  },
  balanceNegative: {
    backgroundColor: Theme.colors.danger + '10',
    borderColor: Theme.colors.danger + '30',
  },
  balanceTitle: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    marginBottom: 4,
  },
  balanceValue: {
    ...Theme.typography.bodyMedium,
    fontWeight: '700',
  },
  textPositive: {
    color: Theme.colors.success,
  },
  textNegative: {
    color: Theme.colors.danger,
  },
  footer: {
    flexDirection: 'row',
    padding: Theme.spacing.md,
    backgroundColor: Theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    alignItems: 'center',
  },
  deleteBtn: {
    width: 50,
    height: 50,
    backgroundColor: Theme.colors.danger + '15',
    borderRadius: Theme.radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.sm,
  },
  copyBtn: {
    width: 50,
    height: 50,
    backgroundColor: Theme.colors.primary + '15',
    borderRadius: Theme.radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.sm,
  },
  saveBtn: {
    height: 50,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radii.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  saveBtnText: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.white,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Theme.colors.white,
    borderTopLeftRadius: Theme.radii.xl,
    borderTopRightRadius: Theme.radii.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  modalTitle: {
    ...Theme.typography.h3,
    color: Theme.colors.text,
  },
  modalBody: {
    padding: Theme.spacing.md,
  },
  modalSaveBtn: {
    backgroundColor: Theme.colors.primary,
    height: 50,
    borderRadius: Theme.radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Theme.spacing.md,
    marginBottom: Theme.spacing.xxl,
  },
  modalSaveBtnText: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.white,
    fontWeight: '700',
  },
  selectorText: {
    ...Theme.typography.body,
    color: Theme.colors.text,
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    backgroundColor: Theme.colors.background,
  },
  searchIcon: {
    marginRight: Theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Theme.typography.body,
    color: Theme.colors.text,
    paddingVertical: 8,
  },
  modalListItem: {
    padding: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  modalListItemText: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.text,
    fontWeight: '500',
  },
  modalListItemSub: {
    ...Theme.typography.small,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
});
