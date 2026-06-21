import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, Alert, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import dayjs from 'dayjs';
import { Theme } from '../../constants/theme';
import { paymentService } from '../../services/paymentService';
import { chartOfAccountService, ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { narrationService, NarrationDto } from '../../services/narrationService';
import { reportService } from '../../services/reportService';

interface SupplierBalanceItem {
  accountId: string;
  name: string;
  balance: number;
  paymentAmount: number;
  selected: boolean;
}

export default function BulkPaymentScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fetchingBalances, setFetchingBalances] = useState(false);
  const [saving, setSaving] = useState(false);

  // Lookups
  const [cashBankAccounts, setCashBankAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [supplierAccounts, setSupplierAccounts] = useState<ChartOfAccountHeadDto[]>([]);

  // Form State
  const [date, setDate] = useState(new Date());
  const [billingDate, setBillingDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [monthModalVisible, setMonthModalVisible] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [cashBankAccount, setCashBankAccount] = useState('');
  const [narration, setNarration] = useState('');
  const [remarks, setRemarks] = useState('');

  // Supplier Balances State
  const [suppliers, setSuppliers] = useState<SupplierBalanceItem[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // Searchable Modal State
  const [selectModalVisible, setSelectModalVisible] = useState(false);
  const [selectModalType, setSelectModalType] = useState<'cashBank' | 'narration'>('cashBank');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLookups();
  }, []);

  const fetchLookups = async () => {
    try {
      const [cbAccs, narrs, suppAccs] = await Promise.all([
        chartOfAccountService.getCashBankAccounts(),
        narrationService.getActiveNarrations(),
        chartOfAccountService.getSupplierAccounts()
      ]);
      setCashBankAccounts(cbAccs);
      setNarrations(narrs);
      setSupplierAccounts(suppAccs);
      
      // Default cash/bank if available
      if (cbAccs.length > 0) {
        setCashBankAccount(cbAccs[0].account);
      }
      
      setLoading(false);
      // Fetch balances for initial billingDate
      fetchBalances(billingDate, suppAccs);
    } catch (error) {
      Alert.alert('Error', 'Failed to load form lookup data.');
      setLoading(false);
    }
  };

  const fetchBalances = async (targetDate: Date, accountsList: ChartOfAccountHeadDto[]) => {
    setFetchingBalances(true);
    try {
      // Dynamically derive supplier parent account prefix
      let parentAccount = '001002001002'; // fallback default
      if (accountsList.length > 0) {
        const firstAccount = accountsList[0].account;
        if (firstAccount.length >= 12) {
          parentAccount = firstAccount.substring(0, 12);
        }
      }

      const toDateStr = dayjs(targetDate).endOf('month').format('YYYY-MM-DD');
      const balanceData = await reportService.getBalanceDetail({
        account: parentAccount,
        toDate: toDateStr
      });

      // Match balances with supplier accounts to get account IDs
      const mappedSuppliers: SupplierBalanceItem[] = [];
      
      balanceData.forEach(b => {
        const match = accountsList.find(a => a.title.trim().toLowerCase() === b.account.trim().toLowerCase());
        // For suppliers, a credit balance (negative in standard DB representation or positive pending payable) is common.
        // Usually, standard ledger reports represent payables as Credit. Check balance absolute value or positive balance.
        const balanceVal = Math.abs(b.balance);
        if (match && balanceVal > 0) {
          mappedSuppliers.push({
            accountId: match.account,
            name: match.title,
            balance: balanceVal,
            paymentAmount: balanceVal,
            selected: false
          });
        }
      });

      // Sort by supplier name
      mappedSuppliers.sort((a, b) => a.name.localeCompare(b.name));
      setSuppliers(mappedSuppliers);
      setSelectAll(false);
    } catch (error) {
      console.error('Failed to fetch supplier balances', error);
      Alert.alert('Error', 'Failed to fetch supplier balances for the selected month.');
    } finally {
      setFetchingBalances(false);
    }
  };

  const handleBillingDateChange = (newDate: Date) => {
    setBillingDate(newDate);
    fetchBalances(newDate, supplierAccounts);
  };

  const toggleSelectSupplier = (index: number) => {
    setSuppliers(prev => {
      const updated = [...prev];
      updated[index].selected = !updated[index].selected;
      
      const allSelected = updated.length > 0 && updated.every(s => s.selected);
      setSelectAll(allSelected);
      
      return updated;
    });
  };

  const handlePaymentAmountChange = (index: number, val: string) => {
    const num = parseFloat(val) || 0;
    setSuppliers(prev => {
      const updated = [...prev];
      updated[index].paymentAmount = num;
      return updated;
    });
  };

  const handleSelectAll = () => {
    const nextState = !selectAll;
    setSelectAll(nextState);
    setSuppliers(prev => prev.map(s => ({ ...s, selected: nextState })));
  };

  const openSelectModal = (type: 'cashBank' | 'narration') => {
    setSelectModalType(type);
    setSearchQuery('');
    setSelectModalVisible(true);
  };

  const handleSelect = (val: string) => {
    if (selectModalType === 'cashBank') {
      setCashBankAccount(val);
    } else if (selectModalType === 'narration') {
      setNarration(val);
    }
    setSelectModalVisible(false);
  };

  const handleSaveBulkPayment = async () => {
    if (!cashBankAccount) {
      Alert.alert('Validation Error', 'Cash/Bank Account is required.');
      return;
    }

    const selectedSuppliers = suppliers.filter(s => s.selected && s.paymentAmount > 0);
    if (selectedSuppliers.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one supplier with a valid payment amount.');
      return;
    }

    setSaving(true);
    try {
      const billingMonthStr = dayjs(billingDate).format('MMM-YYYY');
      
      // Map selected suppliers to multi-line voucher lines
      const lines = selectedSuppliers.map((s, i) => ({
        seq: i + 1,
        account: s.accountId,
        amount: s.paymentAmount,
        remarks: `Payment as of billing month ${billingMonthStr}`
      }));

      const request = {
        date: dayjs(date).format('YYYY-MM-DD'),
        cashBankAccount,
        narration: narration || undefined,
        lines: lines
      };

      // Create Payment Voucher
      await paymentService.create(request);

      Alert.alert(
        'Success', 
        `Payment Voucher created successfully for ${selectedSuppliers.length} suppliers.`, 
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to save bulk payment voucher.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  const selectedSuppliersCount = suppliers.filter(s => s.selected).length;
  const totalPaymentAmount = suppliers
    .filter(s => s.selected)
    .reduce((sum, s) => sum + (s.paymentAmount || 0), 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
        style={styles.container}
      >
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={[styles.content, { paddingBottom: 120 }]}
          keyboardShouldPersistTaps="handled"
        >
          
          {/* Master Details Section */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Bulk Details</Text>
            
            <View style={styles.row}>
              {/* Payment Date Picker */}
              <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.xs }]}>
                <Text style={styles.label}>Payment Date *</Text>
                <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.dateText}>{dayjs(date).format('DD-MMM-YYYY')}</Text>
                  <Ionicons name="calendar-outline" size={18} color={Theme.colors.textSecondary} />
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

              {/* Billing Month Picker */}
              <View style={[styles.inputGroup, { flex: 1, marginLeft: Theme.spacing.xs }]}>
                <Text style={styles.label}>Bill Month *</Text>
                <TouchableOpacity 
                  style={styles.datePickerBtn} 
                  onPress={() => {
                    setSelectedYear(billingDate.getFullYear());
                    setMonthModalVisible(true);
                  }}
                >
                  <Text style={styles.dateText}>{dayjs(billingDate).format('MMMM-YYYY')}</Text>
                  <Ionicons name="calendar-outline" size={18} color={Theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Cash/Bank Account Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Credit Cash/Bank Account *</Text>
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

            {/* Narration Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Narration Template</Text>
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

            {/* Custom Remarks */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Voucher Remarks / Narration</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Defaults to: Monthly Bill Payment for [Month]"
                value={remarks}
                onChangeText={setRemarks}
              />
            </View>
          </Animated.View>

          {/* Suppliers List Section */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={[styles.section, { paddingBottom: 0 }]}>
            <View style={styles.listHeaderRow}>
              <Text style={styles.sectionTitle}>Supplier Balances</Text>
              {fetchingBalances ? (
                <ActivityIndicator size="small" color={Theme.colors.primary} />
              ) : (
                <TouchableOpacity style={styles.selectAllBtn} onPress={handleSelectAll}>
                  <Ionicons 
                    name={selectAll ? "checkbox" : "square-outline"} 
                    size={20} 
                    color={selectAll ? Theme.colors.primary : Theme.colors.textSecondary} 
                  />
                  <Text style={[styles.selectAllText, selectAll && { color: Theme.colors.primary }]}>Select All</Text>
                </TouchableOpacity>
              )}
            </View>

            {fetchingBalances ? (
              <View style={styles.innerLoading}>
                <ActivityIndicator size="large" color={Theme.colors.primary} />
                <Text style={styles.loadingText}>Fetching supplier balances...</Text>
              </View>
            ) : suppliers.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-circle-outline" size={48} color={Theme.colors.success} />
                <Text style={styles.emptyText}>All supplier balances are clear for this month!</Text>
              </View>
            ) : (
              <View style={styles.customerList}>
                {suppliers.map((item, index) => (
                  <View key={item.accountId} style={[styles.customerCard, item.selected && styles.customerCardSelected]}>
                    <TouchableOpacity 
                      style={styles.checkboxContainer} 
                      onPress={() => toggleSelectSupplier(index)}
                    >
                      <Ionicons 
                        name={item.selected ? "checkbox" : "square-outline"} 
                        size={24} 
                        color={item.selected ? Theme.colors.primary : Theme.colors.border} 
                      />
                    </TouchableOpacity>

                    <View style={styles.customerInfo}>
                      <Text style={styles.customerName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.customerCode}>{item.accountId}</Text>
                      <Text style={styles.customerBalance}>Owes: Rs. {item.balance.toLocaleString()}</Text>
                    </View>

                    <View style={styles.amountInputContainer}>
                      <Text style={styles.amountInputLabel}>Paid Amount</Text>
                      <TextInput
                        style={[styles.amountInput, !item.selected && styles.amountInputDisabled]}
                        keyboardType="numeric"
                        editable={item.selected}
                        placeholder={item.balance.toString()}
                        value={item.paymentAmount.toString()}
                        onChangeText={(val) => handlePaymentAmountChange(index, val)}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        </ScrollView>

        {/* Premium Total & Save Footer */}
        <View style={styles.footer}>
          <View style={styles.footerDetails}>
            <Text style={styles.footerLabel}>Selected Suppliers</Text>
            <Text style={styles.footerValue}>{selectedSuppliersCount} selected</Text>
          </View>
          <View style={styles.footerDetails}>
            <Text style={styles.footerLabel}>Total Payment</Text>
            <Text style={[styles.footerValue, { color: Theme.colors.danger }]}>
              Rs. {totalPaymentAmount.toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.saveBtn, (!cashBankAccount || selectedSuppliersCount === 0) && styles.saveBtnDisabled]} 
            onPress={handleSaveBulkPayment} 
            disabled={saving || !cashBankAccount || selectedSuppliersCount === 0}
          >
            {saving ? <ActivityIndicator color={Theme.colors.white} /> : (
              <>
                <Ionicons name="save-outline" size={20} color={Theme.colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.saveBtnText}>Save Bulk</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Searchable Modals */}
        <Modal visible={selectModalVisible} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '50%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {selectModalType === 'cashBank' ? 'Select Cash/Bank' : 'Select Narration'}
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

              <ScrollView keyboardShouldPersistTaps="handled">
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
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Premium Custom Month & Year Picker Modal */}
        <Modal visible={monthModalVisible} animationType="fade" transparent={true}>
          <View style={styles.monthModalOverlay}>
            <View style={styles.monthModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Billing Month</Text>
                <TouchableOpacity onPress={() => setMonthModalVisible(false)}>
                  <Ionicons name="close" size={24} color={Theme.colors.text} />
                </TouchableOpacity>
              </View>

              {/* Year Selection Row */}
              <View style={styles.yearSelectorRow}>
                <TouchableOpacity onPress={() => setSelectedYear(y => y - 1)} style={styles.yearArrow}>
                  <Ionicons name="chevron-back" size={24} color={Theme.colors.primary} />
                </TouchableOpacity>
                <Text style={styles.yearText}>{selectedYear}</Text>
                <TouchableOpacity onPress={() => setSelectedYear(y => y + 1)} style={styles.yearArrow}>
                  <Ionicons name="chevron-forward" size={24} color={Theme.colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Month Grid */}
              <View style={styles.monthGrid}>
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, index) => {
                  const isSelected = billingDate.getMonth() === index && billingDate.getFullYear() === selectedYear;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[styles.monthBox, isSelected && styles.monthBoxSelected]}
                      onPress={() => {
                        const newDate = new Date(selectedYear, index, 1);
                        handleBillingDateChange(newDate);
                        setMonthModalVisible(false);
                      }}
                    >
                      <Text style={[styles.monthBoxText, isSelected && styles.monthBoxTextSelected]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity 
                style={styles.closeMonthBtn} 
                onPress={() => setMonthModalVisible(false)}
              >
                <Text style={styles.closeMonthBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  selectorText: {
    ...Theme.typography.body,
    color: Theme.colors.text,
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
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  selectAllText: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.textSecondary,
    marginLeft: 6,
    fontWeight: '600',
  },
  innerLoading: {
    paddingVertical: Theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    marginTop: Theme.spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.xxl,
  },
  emptyText: {
    ...Theme.typography.body,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.xl,
  },
  customerList: {
    paddingBottom: Theme.spacing.md,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radii.md,
    padding: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
    backgroundColor: Theme.colors.background,
  },
  customerCardSelected: {
    borderColor: Theme.colors.primary + '60',
    backgroundColor: Theme.colors.primary + '05',
  },
  checkboxContainer: {
    padding: 4,
    marginRight: 6,
  },
  customerInfo: {
    flex: 1,
    marginRight: 6,
  },
  customerName: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.text,
    fontWeight: '600',
  },
  customerCode: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    marginTop: 1,
  },
  customerBalance: {
    ...Theme.typography.caption,
    color: Theme.colors.danger,
    fontWeight: '600',
    marginTop: 2,
  },
  amountInputContainer: {
    width: 100,
    alignItems: 'flex-end',
  },
  amountInputLabel: {
    fontSize: 10,
    color: Theme.colors.textSecondary,
    marginBottom: 4,
  },
  amountInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontSize: 13,
    color: Theme.colors.text,
    backgroundColor: Theme.colors.white,
    textAlign: 'right',
  },
  amountInputDisabled: {
    backgroundColor: Theme.colors.border + '30',
    color: Theme.colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: Theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerDetails: {
    alignItems: 'flex-start',
  },
  footerLabel: {
    fontSize: 10,
    color: Theme.colors.textSecondary,
  },
  footerValue: {
    ...Theme.typography.bodyMedium,
    fontWeight: '700',
    marginTop: 2,
  },
  saveBtn: {
    backgroundColor: Theme.colors.danger, // red for payment button
    paddingHorizontal: Theme.spacing.lg,
    height: 48,
    borderRadius: Theme.radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    minWidth: 120,
    ...Theme.shadows.sm,
  },
  saveBtnDisabled: {
    backgroundColor: Theme.colors.border,
    opacity: 0.6,
  },
  saveBtnText: {
    color: Theme.colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Theme.colors.white,
    borderTopLeftRadius: Theme.radii.lg,
    borderTopRightRadius: Theme.radii.lg,
    padding: Theme.spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    paddingBottom: Theme.spacing.sm,
  },
  modalTitle: {
    ...Theme.typography.h3,
    color: Theme.colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.radii.sm,
    paddingHorizontal: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    ...Theme.typography.body,
    color: Theme.colors.text,
  },
  modalListItem: {
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.background,
  },
  modalListItemText: {
    ...Theme.typography.body,
    color: Theme.colors.text,
    fontWeight: '600',
  },
  modalListItemSub: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  monthModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.lg,
  },
  monthModalContent: {
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radii.lg,
    width: '100%',
    maxWidth: 320,
    padding: Theme.spacing.md,
    ...Theme.shadows.md,
  },
  yearSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: Theme.spacing.md,
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.radii.sm,
    padding: Theme.spacing.xs,
  },
  yearArrow: {
    padding: Theme.spacing.sm,
  },
  yearText: {
    ...Theme.typography.h3,
    color: Theme.colors.text,
    fontWeight: '700',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.md,
  },
  monthBox: {
    width: '30%',
    aspectRatio: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Theme.radii.sm,
    backgroundColor: Theme.colors.background,
    marginBottom: '4%',
  },
  monthBoxSelected: {
    backgroundColor: Theme.colors.primary,
  },
  monthBoxText: {
    ...Theme.typography.body,
    color: Theme.colors.text,
    fontWeight: '600',
  },
  monthBoxTextSelected: {
    color: Theme.colors.white,
  },
  closeMonthBtn: {
    backgroundColor: Theme.colors.border + '50',
    padding: Theme.spacing.sm,
    borderRadius: Theme.radii.sm,
    alignItems: 'center',
    marginTop: Theme.spacing.xs,
  },
  closeMonthBtnText: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.text,
    fontWeight: '600',
  },
});
