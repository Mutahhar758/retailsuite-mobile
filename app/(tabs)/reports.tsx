import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, Platform } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Theme } from '../../constants/theme';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { reportService, AccountStatementLine, CustomerBillResponse } from '../../services/reportService';
import { chartOfAccountService, ChartOfAccountDto, ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { LinearGradient } from 'expo-linear-gradient';

export default function ReportsScreen() {
  const ledgerRef = useRef<any>(null);
  const receiptRef = useRef<any>(null);
  const [activeTab, setActiveTab] = useState<'account' | 'customer'>('account');

  // Common State
  const [fromDate, setFromDate] = useState(dayjs().startOf('month').toDate());
  const [toDate, setToDate] = useState(dayjs().toDate());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Account Statement State
  const [accounts, setAccounts] = useState<ChartOfAccountDto[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [accountData, setAccountData] = useState<(AccountStatementLine & { balance: number })[]>([]);

  // Customer Bill State
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [customerBill, setCustomerBill] = useState<CustomerBillResponse | null>(null);

  // Snapshot of filters used for the currently displayed report
  const [reportSnapshot, setReportSnapshot] = useState<{
    accountTitle?: string,
    customerTitle?: string,
    fromDate: Date,
    toDate: Date
  } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accRes, custRes] = await Promise.all([
          chartOfAccountService.getActiveAccounts(),
          chartOfAccountService.getCustomerAccounts()
        ]);
        
        const detailAccounts = accRes.filter(a => a.accType === 'Detail');
        setAccounts(detailAccounts);
        if (detailAccounts.length > 0) setSelectedAccount(detailAccounts[0].account);

        setCustomers(custRes);
        if (custRes.length > 0) setSelectedCustomer(custRes[0].account);
        
      } catch (error) {
        Alert.alert('Error', 'Failed to load accounts');
      } finally {
        setInitialLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSearchAccount = async () => {
    if (!selectedAccount) return Alert.alert('Validation', 'Please select an account.');
    setLoading(true);
    try {
      const res = await reportService.getAccountStatement({
        fromDate: dayjs(fromDate).format('YYYY-MM-DD'),
        toDate: dayjs(toDate).format('YYYY-MM-DD'),
        account: selectedAccount
      });
      let currentBalance = 0;
      setAccountData(res.map(row => {
        currentBalance += (row.dr - row.cr);
        return { ...row, balance: currentBalance };
      }));
      setReportSnapshot({
        accountTitle: accounts.find(a => a.account === selectedAccount)?.title,
        fromDate,
        toDate
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to load account statement');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchCustomer = async () => {
    if (!selectedCustomer) return Alert.alert('Validation', 'Please select a customer.');
    setLoading(true);
    try {
      const res = await reportService.getCustomerBill({
        fromDate: dayjs(fromDate).format('YYYY-MM-DD'),
        toDate: dayjs(toDate).format('YYYY-MM-DD'),
        account: selectedCustomer
      });
      setCustomerBill(res);
      setReportSnapshot({
        customerTitle: customers.find(c => c.account === selectedCustomer)?.title,
        fromDate,
        toDate
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to load customer bill');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (activeTab === 'account') handleSearchAccount();
    else handleSearchCustomer();
  };

  const handleShareLedger = async () => {
    if (!ledgerRef.current) return;
    try {
      const uri = await ledgerRef.current.capture();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error sharing ledger:', error);
      Alert.alert('Error', 'Failed to share image');
    }
  };

  const handleShareReceipt = async () => {
    if (!receiptRef.current) return;
    try {
      const uri = await receiptRef.current.capture();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error sharing receipt:', error);
      Alert.alert('Error', 'Failed to share image');
    }
  };

  const setDateShortcut = (type: 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth') => {
    const today = dayjs();
    let from = today;
    let to = today;

    switch (type) {
      case 'today':
        from = today.startOf('day');
        to = today.endOf('day');
        break;
      case 'yesterday':
        from = today.subtract(1, 'day').startOf('day');
        to = today.subtract(1, 'day').endOf('day');
        break;
      case 'thisWeek':
        from = today.startOf('week');
        to = today.endOf('week');
        break;
      case 'lastWeek':
        from = today.subtract(1, 'week').startOf('week');
        to = today.subtract(1, 'week').endOf('week');
        break;
      case 'thisMonth':
        from = today.startOf('month');
        to = today.endOf('month');
        break;
      case 'lastMonth':
        from = today.subtract(1, 'month').startOf('month');
        to = today.subtract(1, 'month').endOf('month');
        break;
    }

    setFromDate(from.toDate());
    setToDate(to.toDate());
  };

  if (initialLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.background }}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  // Calculate Account Statement Totals
  let accTotalDr = 0;
  let accTotalCr = 0;
  accountData.forEach(item => { accTotalDr += item.dr; accTotalCr += item.cr; });
  const accFinalBalance = accTotalDr - accTotalCr;

  const TabButton = ({ title, value, icon }: { title: string, value: 'account' | 'customer', icon: any }) => (
    <TouchableOpacity 
      style={[styles.tabButton, activeTab === value && styles.tabButtonActive]}
      onPress={() => setActiveTab(value)}
      activeOpacity={0.8}
    >
      <Ionicons name={icon} size={18} color={activeTab === value ? Theme.colors.white : Theme.colors.textSecondary} />
      <Text style={[styles.tabButtonText, activeTab === value && styles.tabButtonTextActive]}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
        <Text style={styles.title}>Reports</Text>
        <Text style={styles.subtitle}>Financial statements & bills</Text>

        <View style={styles.tabContainer}>
          <TabButton title="Ledger" value="account" icon="book-outline" />
          <TabButton title="Customer Bill" value="customer" icon="receipt-outline" />
        </View>
      </Animated.View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Filters Section */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.filterCard}>
          <Text style={styles.label}>{activeTab === 'account' ? 'Select Account' : 'Select Customer'}</Text>
          <View style={[styles.pickerWrapper, { backgroundColor: '#ffffff' }]}>
            <Picker
              selectedValue={activeTab === 'account' ? selectedAccount : selectedCustomer}
              onValueChange={(val) => activeTab === 'account' ? setSelectedAccount(val) : setSelectedCustomer(val)}
              style={[styles.picker, { color: Theme.colors.text }]}
              dropdownIconColor={Theme.colors.primary}
            >
              {activeTab === 'account' 
                ? accounts.map(acc => <Picker.Item key={acc.account} label={acc.title} value={acc.account} />)
                : customers.map(cust => <Picker.Item key={cust.account} label={cust.title} value={cust.account} />)
              }
            </Picker>
          </View>

          <Text style={styles.label}>Quick Select</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shortcutScroll} contentContainerStyle={styles.shortcutContent}>
            <TouchableOpacity style={styles.shortcutChip} onPress={() => setDateShortcut('lastMonth')}>
              <Text style={styles.shortcutText}>Last Month</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutChip} onPress={() => setDateShortcut('thisMonth')}>
              <Text style={styles.shortcutText}>This Month</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutChip} onPress={() => setDateShortcut('thisWeek')}>
              <Text style={styles.shortcutText}>This Week</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutChip} onPress={() => setDateShortcut('lastWeek')}>
              <Text style={styles.shortcutText}>Last Week</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutChip} onPress={() => setDateShortcut('today')}>
              <Text style={styles.shortcutText}>Today</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.label}>From Date</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowFromPicker(true)} activeOpacity={0.7}>
                <Ionicons name="calendar-outline" size={18} color={Theme.colors.primary} />
                <Text style={styles.dateText}>{dayjs(fromDate).format('DD MMM YYYY')}</Text>
              </TouchableOpacity>
              {showFromPicker && (
                <DateTimePicker
                  value={fromDate}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowFromPicker(false);
                    if (selectedDate) setFromDate(selectedDate);
                  }}
                />
              )}
            </View>

            <View style={styles.dateField}>
              <Text style={styles.label}>To Date</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowToPicker(true)} activeOpacity={0.7}>
                <Ionicons name="calendar-outline" size={18} color={Theme.colors.primary} />
                <Text style={styles.dateText}>{dayjs(toDate).format('DD MMM YYYY')}</Text>
              </TouchableOpacity>
              {showToPicker && (
                <DateTimePicker
                  value={toDate}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowToPicker(false);
                    if (selectedDate) setToDate(selectedDate);
                  }}
                />
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color={Theme.colors.white} /> : (
              <>
                <Ionicons name="search" size={20} color={Theme.colors.white} style={{ marginRight: 8 }} />
                <Text style={styles.searchBtnText}>Generate Report</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* ACCOUNT STATEMENT RESULTS */}
        {activeTab === 'account' && accountData.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).duration(600)}>
            
            <View style={{ alignItems: 'flex-end', marginBottom: 8, paddingHorizontal: 4 }}>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShareLedger}>
                <Ionicons name="share-outline" size={24} color={Theme.colors.primary} />
              </TouchableOpacity>
            </View>

            <ViewShot ref={ledgerRef} style={{ backgroundColor: Theme.colors.background, padding: 8, paddingBottom: 16 }} options={{ format: 'png', quality: 1.0, result: 'tmpfile' }}>
              <View style={[styles.transparentHeader, { marginTop: 0, justifyContent: 'center' }]}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.resultsTitle}>{reportSnapshot?.accountTitle}</Text>
                  <Text style={styles.dateRangeText}>{dayjs(reportSnapshot?.fromDate).format('DD MMM')} — {dayjs(reportSnapshot?.toDate).format('DD MMM YYYY')}</Text>
                </View>
              </View>

            <LinearGradient
              colors={[Theme.colors.primary, Theme.colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.summaryGradientBox, { marginTop: 0, marginBottom: Theme.spacing.xl }]}
            >
              <Text style={styles.summaryTitleWhite}>Ledger Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelWhite}>Total Debit</Text>
                <Text style={styles.summaryValueWhite}>Rs. {accTotalDr.toLocaleString()}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelWhite}>Total Credit</Text>
                <Text style={styles.summaryValueWhite}>Rs. {accTotalCr.toLocaleString()}</Text>
              </View>
              <View style={styles.dividerWhite} />
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabelWhite, { fontWeight: 'bold', fontSize: 16 }]}>Closing Balance</Text>
                <Text style={[styles.summaryValueWhite, { fontWeight: 'bold', fontSize: 18, color: accFinalBalance >= 0 ? '#A7F3D0' : '#FECACA' }]}>
                  {Math.abs(accFinalBalance).toLocaleString()} {accFinalBalance >= 0 ? 'Dr' : 'Cr'}
                </Text>
              </View>
            </LinearGradient>

            {[...accountData].reverse().map((item, index) => (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 50).duration(400)} key={index} style={[styles.compactRowBox, { borderLeftColor: item.balance >= 0 ? Theme.colors.success : Theme.colors.danger }]}>
                <View style={styles.compactHeader}>
                  <Text style={styles.compactDate}>{dayjs(item.vDate).format('DD MMM YYYY')}</Text>
                  <Text style={styles.compactVoucher}>{item.vNo}</Text>
                </View>
                
                <Text style={styles.compactParticular}>{item.particular}</Text>
                
                <View style={styles.compactAmountContainer}>
                  <View style={styles.compactAmountCol}>
                    <Text style={styles.compactAmountLabel}>Debit</Text>
                    <Text style={[styles.compactAmountValue, item.dr > 0 && { color: Theme.colors.text }]}>
                      {item.dr > 0 ? item.dr.toLocaleString() : '-'}
                    </Text>
                  </View>
                  <View style={styles.compactAmountCol}>
                    <Text style={styles.compactAmountLabel}>Credit</Text>
                    <Text style={[styles.compactAmountValue, item.cr > 0 && { color: Theme.colors.text }]}>
                      {item.cr > 0 ? item.cr.toLocaleString() : '-'}
                    </Text>
                  </View>
                  <View style={[styles.compactAmountCol, { alignItems: 'flex-end' }]}>
                    <Text style={styles.compactAmountLabel}>Balance</Text>
                    <Text style={[styles.compactAmountValue, { color: item.balance >= 0 ? Theme.colors.success : Theme.colors.danger, fontWeight: '700' }]}>
                      {Math.abs(item.balance).toLocaleString()} {item.balance >= 0 ? 'Dr' : 'Cr'}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            ))}
            </ViewShot>
          </Animated.View>
        )}

        {/* CUSTOMER BILL RESULTS - RECEIPT STYLE */}
        {activeTab === 'customer' && customerBill && (
          <Animated.View entering={FadeInDown.delay(200).duration(600)} style={{ position: 'relative' }}>
            
            {/* Share Button Overlay */}
            <TouchableOpacity style={styles.receiptShareBtn} onPress={handleShareReceipt}>
              <Ionicons name="share-outline" size={22} color={Theme.colors.primary} />
            </TouchableOpacity>

            <ViewShot ref={receiptRef} style={styles.receiptContainer} options={{ format: 'png', quality: 1.0, result: 'tmpfile' }}>
              {/* Receipt Header */}
              <View style={styles.receiptHeader}>
                <Text style={styles.receiptStoreName}>CUSTOMER BILL</Text>
                <Text style={styles.receiptCustomerName}>{reportSnapshot?.customerTitle}</Text>
                <Text style={styles.receiptDate}>{dayjs(reportSnapshot?.fromDate).format('DD/MM/YYYY')} - {dayjs(reportSnapshot?.toDate).format('DD/MM/YYYY')}</Text>
              </View>

            <View style={styles.receiptDivider} />

            {/* Receipt Table Header */}
            <View style={styles.receiptRow}>
              <Text style={[styles.receiptColHeader, { flex: 1.5 }]}>ITEM</Text>
              <Text style={[styles.receiptColHeader, { flex: 1.2, textAlign: 'center' }]}>QTY/RT</Text>
              <Text style={[styles.receiptColHeader, { flex: 1.3, textAlign: 'right' }]}>AMOUNT</Text>
            </View>
            
            <View style={styles.receiptDivider} />

            {/* Receipt Items */}
            {customerBill.lines.map((item, index) => (
              <View key={index} style={styles.receiptItemRow}>
                <View style={{ flex: 1.5, paddingRight: 4 }}>
                  <Text style={styles.receiptItemName} numberOfLines={2}>{item.item}</Text>
                  <Text style={styles.receiptItemSub}>{dayjs(item.date).format('DD-MMM')} | {item.vNo}</Text>
                </View>
                <View style={{ flex: 1.2, alignItems: 'center' }}>
                  <Text style={styles.receiptItemText}>{item.qty}</Text>
                  <Text style={styles.receiptItemSub} numberOfLines={1} adjustsFontSizeToFit>@ {item.rate}</Text>
                </View>
                <View style={{ flex: 1.3, alignItems: 'flex-end' }}>
                  <Text style={styles.receiptItemText}>{item.amount.toLocaleString()}</Text>
                  {item.addLess !== 0 && (
                    <Text style={styles.receiptItemSub}>{item.addLess > 0 ? '+' : ''}{item.addLess}</Text>
                  )}
                </View>
              </View>
            ))}

            <View style={styles.receiptDivider} />

            {/* Receipt Summary */}
            <View style={styles.receiptSummaryRow}>
              <Text style={styles.receiptSummaryLabel}>THIS BILL TOTAL</Text>
              <Text style={styles.receiptSummaryValue}>{customerBill.lines.reduce((s, i) => s + i.amount, 0).toLocaleString()}</Text>
            </View>
            <View style={styles.receiptSummaryRow}>
              <Text style={styles.receiptSummaryLabel}>PREVIOUS BALANCE</Text>
              <Text style={styles.receiptSummaryValue}>{customerBill.summary.previousBalance.toLocaleString()}</Text>
            </View>
            <View style={styles.receiptSummaryRow}>
              <Text style={styles.receiptSummaryLabel}>TOTAL PAYMENTS</Text>
              <Text style={styles.receiptSummaryValue}>{customerBill.summary.payment.toLocaleString()}</Text>
            </View>
            
            <View style={styles.receiptDividerBold} />

            <View style={styles.receiptSummaryRow}>
              <Text style={styles.receiptTotalLabel}>CURRENT BALANCE</Text>
              <Text style={styles.receiptTotalValue}>{customerBill.summary.balance.toLocaleString()}</Text>
            </View>
            
            <View style={styles.receiptFooter}>
              <Text style={styles.receiptFooterText}>Generated on {dayjs().format('DD/MM/YYYY HH:mm')}</Text>
            </View>

            </ViewShot>
          </Animated.View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Theme.colors.background },
  header: { padding: Theme.spacing.lg, paddingBottom: Theme.spacing.md, backgroundColor: Theme.colors.white },
  title: { ...Theme.typography.h1, color: Theme.colors.text, marginBottom: 4 },
  subtitle: { ...Theme.typography.body, color: Theme.colors.textSecondary },
  
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.radii.lg,
    padding: 6,
    marginTop: Theme.spacing.lg,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Theme.radii.md,
  },
  tabButtonActive: {
    backgroundColor: Theme.colors.primary,
    ...Theme.shadows.sm,
  },
  tabButtonText: {
    ...Theme.typography.bodyMedium,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
    marginLeft: 8,
  },
  tabButtonTextActive: { color: Theme.colors.white },

  container: { flex: 1 },
  content: {
    padding: Theme.spacing.md,
    paddingBottom: 40,
  },
  filterCard: {
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radii.xl,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
    ...Theme.shadows.md,
  },
  label: { ...Theme.typography.small, color: Theme.colors.textSecondary, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  pickerWrapper: {
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.colors.border + '80',
    overflow: 'hidden',
    marginBottom: Theme.spacing.lg,
  },
  picker: { height: Platform.OS === 'ios' ? 120 : 50, width: '100%' },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Theme.spacing.xl },
  dateField: { width: '48%' },
  shortcutScroll: { marginBottom: Theme.spacing.lg, marginHorizontal: -Theme.spacing.md },
  shortcutContent: { paddingHorizontal: Theme.spacing.md, gap: 8 },
  shortcutChip: {
    backgroundColor: Theme.colors.background,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Theme.radii.round,
    borderWidth: 1,
    borderColor: Theme.colors.border + '50',
  },
  shortcutText: { ...Theme.typography.caption, color: Theme.colors.text, fontWeight: '600' },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.border + '80',
    padding: 12,
    borderRadius: Theme.radii.md,
  },
  dateText: { ...Theme.typography.bodyMedium, color: Theme.colors.text, marginLeft: 8, fontWeight: '500' },
  searchBtn: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.primary,
    padding: 16,
    borderRadius: Theme.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.sm,
  },
  searchBtnText: { ...Theme.typography.h3, color: Theme.colors.white },

  transparentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.lg, marginTop: Theme.spacing.sm, paddingHorizontal: 4 },
  resultsTitle: { ...Theme.typography.h2, color: Theme.colors.text, marginBottom: 4 },
  dateRangeText: { ...Theme.typography.body, color: Theme.colors.primary, fontWeight: '500' },
  shareBtn: { backgroundColor: Theme.colors.primary + '15', padding: 10, borderRadius: Theme.radii.round },
  
  compactRowBox: {
    backgroundColor: Theme.colors.white,
    padding: 14,
    marginBottom: 12,
    borderRadius: Theme.radii.md,
    borderLeftWidth: 4,
    ...Theme.shadows.sm,
  },
  compactHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  compactDate: { ...Theme.typography.small, color: Theme.colors.textSecondary, fontWeight: '600' },
  compactVoucher: { ...Theme.typography.caption, color: Theme.colors.primary, fontWeight: '700', backgroundColor: Theme.colors.primary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  compactParticular: { ...Theme.typography.bodyMedium, color: Theme.colors.text, marginBottom: 12, lineHeight: 20 },
  
  compactAmountContainer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Theme.colors.border + '40', paddingTop: 10 },
  compactAmountCol: { flex: 1, justifyContent: 'flex-start' },
  compactAmountLabel: { ...Theme.typography.caption, color: Theme.colors.textSecondary, fontSize: 10, textTransform: 'uppercase', marginBottom: 2 },
  compactAmountValue: { ...Theme.typography.small, color: Theme.colors.textSecondary, fontWeight: '600' },

  summaryGradientBox: {
    marginTop: Theme.spacing.xl,
    padding: Theme.spacing.xl,
    borderRadius: Theme.radii.lg,
    ...Theme.shadows.lg,
  },
  summaryTitleWhite: { ...Theme.typography.h2, color: Theme.colors.white, marginBottom: Theme.spacing.lg },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' },
  summaryLabelWhite: { ...Theme.typography.bodyMedium, color: Theme.colors.white, opacity: 0.8 },
  summaryValueWhite: { ...Theme.typography.bodyMedium, color: Theme.colors.white, fontWeight: '600' },
  dividerWhite: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 14 },

  // Receipt Styles
  receiptContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 4,
    padding: 20,
    paddingTop: 30,
    borderRadius: 8,
    ...Theme.shadows.md,
    borderTopWidth: 12,
    borderTopColor: Theme.colors.primary,
    position: 'relative',
  },
  receiptShareBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: Theme.colors.primary + '15',
    padding: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  receiptHeader: { alignItems: 'center', marginBottom: 16, marginTop: 8 },
  receiptStoreName: { fontSize: 18, fontWeight: '800', color: '#000', letterSpacing: 1.5, marginBottom: 4 },
  receiptCustomerName: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 4 },
  receiptDate: { fontSize: 12, color: '#666', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  
  receiptDivider: { height: 1, borderWidth: 1, borderColor: '#ccc', borderStyle: 'dashed', marginVertical: 12, borderRadius: 1 },
  receiptDividerBold: { height: 2, backgroundColor: '#000', marginVertical: 12 },
  
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between' },
  receiptColHeader: { fontSize: 11, fontWeight: '700', color: '#000', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  
  receiptItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  receiptItemName: { fontSize: 13, fontWeight: '600', color: '#000' },
  receiptItemSub: { fontSize: 11, color: '#666', marginTop: 2 },
  receiptItemText: { fontSize: 13, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  
  receiptSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  receiptSummaryLabel: { fontSize: 12, color: '#333', fontWeight: '600' },
  receiptSummaryValue: { fontSize: 13, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  
  receiptTotalLabel: { fontSize: 14, fontWeight: '800', color: '#000' },
  receiptTotalValue: { fontSize: 16, fontWeight: '800', color: '#000', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  
  receiptFooter: { alignItems: 'center', marginTop: 20 },
  receiptFooterText: { fontSize: 11, fontStyle: 'italic', color: '#888' },
});
