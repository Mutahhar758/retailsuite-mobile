import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { Theme } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import {
  reportService,
  AccountStatementLine,
  TrialBalanceLine,
  StockBalanceLine,
} from '../../services/reportService';
import { chartOfAccountService, ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { inventoryService, Item } from '../../services/inventoryService';
import { itemCategoryService, ItemCategoryDto } from '../../services/itemCategoryService';
import { PdfViewerModal } from '../../components/reports/PdfViewerModal';

export type ReportCategory = 'accounts' | 'financial' | 'inventory' | 'commercial';

export type ReportType =
  | 'account_statement'
  | 'account_statement_due'
  | 'account_balance'
  | 'trial_balance'
  | 'balance_sheet'
  | 'income_summary'
  | 'stock_balance'
  | 'item_ledger'
  | 'customer_bill'
  | 'customer_recovery'
  | 'milk_comparison';

interface ReportMeta {
  id: ReportType;
  title: string;
  shortTitle: string;
  tagline: string;
  category: ReportCategory;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  permission: string;
}

const ALL_REPORTS: ReportMeta[] = [
  {
    id: 'account_statement',
    title: 'Account Statement',
    shortTitle: 'Account Ledger',
    tagline: 'Debits & credits',
    category: 'accounts',
    icon: 'book-outline',
    color: '#6366f1',
    permission: 'Permissions.AccountStatement.View',
  },
  {
    id: 'account_statement_due',
    title: 'Account Statement with Due',
    shortTitle: 'Statement w/ Due',
    tagline: 'Aging & due days',
    category: 'accounts',
    icon: 'time-outline',
    color: '#8b5cf6',
    permission: 'Permissions.AccountStatementWithDue.View',
  },
  {
    id: 'account_balance',
    title: 'Account Balance Report',
    shortTitle: 'Account Balance',
    tagline: 'Control head balances',
    category: 'accounts',
    icon: 'wallet-outline',
    color: '#3b82f6',
    permission: 'Permissions.AccountBalance.View',
  },
  {
    id: 'trial_balance',
    title: 'Trial Balance Report',
    shortTitle: 'Trial Balance',
    tagline: 'All account totals',
    category: 'accounts',
    icon: 'bar-chart-outline',
    color: '#06b6d4',
    permission: 'Permissions.TrialBalance.View',
  },
  {
    id: 'balance_sheet',
    title: 'Balance Sheet',
    shortTitle: 'Balance Sheet',
    tagline: 'Assets & liabilities',
    category: 'financial',
    icon: 'business-outline',
    color: '#10b981',
    permission: 'Permissions.BalanceSheet.View',
  },
  {
    id: 'income_summary',
    title: 'Income Summary',
    shortTitle: 'Income Summary',
    tagline: 'Profit & loss',
    category: 'financial',
    icon: 'trending-up-outline',
    color: '#14b8a6',
    permission: 'Permissions.IncomeSummary.View',
  },
  {
    id: 'stock_balance',
    title: 'Stock Balance Report',
    shortTitle: 'Stock Balance',
    tagline: 'Quantities & rates',
    category: 'inventory',
    icon: 'cube-outline',
    color: '#f59e0b',
    permission: 'Permissions.StockBalance.View',
  },
  {
    id: 'item_ledger',
    title: 'Product Ledger',
    shortTitle: 'Product Ledger',
    tagline: 'Inventory movement',
    category: 'inventory',
    icon: 'layers-outline',
    color: '#f97316',
    permission: 'Permissions.StockLedger.View',
  },
  {
    id: 'customer_bill',
    title: 'Customer Bill',
    shortTitle: 'Customer Bill',
    tagline: 'Thermal statement',
    category: 'commercial',
    icon: 'receipt-outline',
    color: '#ec4899',
    permission: 'Permissions.CustomerBill.View',
  },
  {
    id: 'customer_recovery',
    title: 'Customer Balance & Recovery',
    shortTitle: 'Balance Recovery',
    tagline: 'Receivables & recovery',
    category: 'commercial',
    icon: 'people-outline',
    color: '#a855f7',
    permission: 'Permissions.CustomerBalanceRecovery.View',
  },
  {
    id: 'milk_comparison',
    title: 'Milk Purchase vs Supply',
    shortTitle: 'Milk Comparison',
    tagline: 'Intake vs dispatch',
    category: 'commercial',
    icon: 'water-outline',
    color: '#0ea5e9',
    permission: 'Permissions.MilkComparison.View',
  },
];

export default function ReportsScreen() {
  const { user, permissions } = useAuthStore();
  const { licenses, currentTenantIdentifier } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const IsWandaFeature = currentOrg?.hasVariablePackFeature ?? false;

  const hasPermission = (permission: string) => {
    if (user?.isOwner) return true;
    if (permissions.includes('Permissions.Reports.View')) return true;
    return permissions.includes(permission);
  };

  const allowedReports = useMemo(() => {
    return ALL_REPORTS
      .filter((r) => hasPermission(r.permission))
      .map((r) => {
        if (r.id === 'customer_bill') {
          return {
            ...r,
            title: 'Customer Bill',
            shortTitle: 'Customer Bill',
            tagline: IsWandaFeature ? 'Feed & bags statement' : 'Milk & retail statement',
          };
        }
        return r;
      });
  }, [permissions, user, IsWandaFeature]);

  // Active Category & Report Selection
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('accounts');
  const [selectedReportId, setSelectedReportId] = useState<ReportType>('account_statement');

  const currentReport = useMemo(
    () => allowedReports.find((r) => r.id === selectedReportId) || ALL_REPORTS[0],
    [allowedReports, selectedReportId]
  );

  // Common Filter State
  const [fromDate, setFromDate] = useState<Date>(dayjs().startOf('month').toDate());
  const [toDate, setToDate] = useState<Date>(dayjs().toDate());
  const [dateBasis, setDateBasis] = useState<'VoucherDate' | 'ClearingDate'>('VoucherDate');
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  // Entity Selectors State
  const [detailAccounts, setDetailAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [controlAccounts, setControlAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [customerAccounts, setCustomerAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<ItemCategoryDto[]>([]);

  // Selected values
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedControlAccountId, setSelectedControlAccountId] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedCategoryCode, setSelectedCategoryCode] = useState<string>('');

  // Toggles & Filters
  const [showStockValue, setShowStockValue] = useState(true);
  const [showCostPrice, setShowCostPrice] = useState(false);
  const [customerBillLayout, setCustomerBillLayout] = useState<'Thermal' | 'A4'>('Thermal');
  const [balanceFilter, setBalanceFilter] = useState<'All' | 'OutstandingOnly' | 'ClearedOnly' | 'UnpaidOnly'>('All');

  // Search Picker Modal State
  const [modalType, setModalType] = useState<'account' | 'controlAccount' | 'customer' | 'item' | 'category' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Execution & In-Memory PDF State
  const [pdfModalVisible, setPdfModalVisible] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState('Report.pdf');

  // Data Breakdown State
  const [dataLoading, setDataLoading] = useState(false);
  const [reportData, setReportData] = useState<any | null>(null);
  const [activeDataView, setActiveDataView] = useState<ReportType | null>(null);

  // Initial Data Lookups Loading
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [allAccounts, customersRes, itemsRes, categoriesRes] = await Promise.all([
          chartOfAccountService.getActiveAccounts(),
          chartOfAccountService.getCustomerAccounts(),
          inventoryService.getItemsLookup(),
          itemCategoryService.getActiveItemCategoriesLookup(),
        ]);

        const details = allAccounts
          .filter((a: any) => a.accType === 'Detail' || a.accLevel === 5)
          .map((a: any) => ({ account: a.account, title: a.title }));
        const controls = allAccounts
          .filter((a: any) => a.accLevel === 4)
          .map((a: any) => ({ account: a.account, title: a.title }));

        setDetailAccounts(details);
        setControlAccounts(controls);
        setCustomerAccounts(customersRes || []);
        setItems(itemsRes || []);
        setCategories(categoriesRes || []);

        if (details.length > 0) setSelectedAccountId(details[0].account);
        if (controls.length > 0) setSelectedControlAccountId(controls[0].account);
        if (customersRes && customersRes.length > 0) setSelectedCustomerId(customersRes[0].account);

        if (itemsRes && itemsRes.length > 0) {
          const milkItem = itemsRes.find(
            (i) =>
              i.title.toLowerCase().includes('milk') ||
              i.title.toLowerCase().includes('dodh') ||
              i.title.includes('دودھ')
          );
          setSelectedItemId(milkItem ? milkItem.id : itemsRes[0].id);
        }
      } catch (err) {
        console.error('Failed to load report lookup lists:', err);
      } finally {
        setInitialLoading(false);
      }
    };
    loadLookups();
  }, []);

  const handleSelectReport = (report: ReportMeta) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedReportId(report.id);
    setReportData(null);
    setActiveDataView(null);
  };

  const setDateShortcut = (type: 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  /**
   * Generates and opens the PDF directly into in-memory WebView modal
   */
  const handleOpenPdfReport = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const fromStr = dayjs(fromDate).format('YYYY-MM-DD');
    const toStr = dayjs(toDate).format('YYYY-MM-DD');

    setPdfLoading(true);
    setPdfBase64(null);
    setPdfModalVisible(true);

    try {
      let base64 = '';
      let filename = `${currentReport.shortTitle.replace(/\s+/g, '_')}_${dayjs().format('YYYYMMDD')}.pdf`;

      switch (selectedReportId) {
        case 'account_statement':
          if (!selectedAccountId) throw new Error('Please select an account.');
          filename = `AccountStatement_${selectedAccountId}_${fromStr}_${toStr}.pdf`;
          base64 = await reportService.getAccountStatementPdf({
            fromDate: fromStr,
            toDate: toStr,
            account: selectedAccountId,
            dateBasis,
          });
          break;

        case 'account_statement_due':
          if (!selectedAccountId) throw new Error('Please select an account.');
          filename = `AccountStatementWithDue_${selectedAccountId}_${fromStr}_${toStr}.pdf`;
          base64 = await reportService.getAccountStatementWithDuePdf({
            fromDate: fromStr,
            toDate: toStr,
            account: selectedAccountId,
            dateBasis,
          });
          break;

        case 'account_balance':
          if (!selectedControlAccountId) throw new Error('Please select a control head account.');
          filename = `AccountBalance_${selectedControlAccountId}_${toStr}.pdf`;
          base64 = await reportService.getBalanceDetailPdf({
            toDate: toStr,
            account: selectedControlAccountId,
          });
          break;

        case 'trial_balance':
          filename = `TrialBalance_${fromStr}_${toStr}.pdf`;
          base64 = await reportService.getTrialBalancePdf({
            fromDate: fromStr,
            toDate: toStr,
          });
          break;

        case 'balance_sheet':
          filename = `BalanceSheet_${toStr}.pdf`;
          base64 = await reportService.getBalanceSheetPdf({
            toDate: toStr,
          });
          break;

        case 'income_summary':
          filename = `IncomeSummary_${fromStr}_${toStr}.pdf`;
          base64 = await reportService.getIncomeSummaryPdf({
            fromDate: fromStr,
            toDate: toStr,
          });
          break;

        case 'stock_balance':
          filename = `StockBalance_${fromStr}_${toStr}.pdf`;
          base64 = await reportService.getStockBalancePdf({
            fromDate: fromStr,
            toDate: toStr,
            catagory: selectedCategoryCode || undefined,
            showStockValue,
          });
          break;

        case 'item_ledger':
          if (!selectedItemId) throw new Error('Please select a product item.');
          filename = `StockLedger_${selectedItemId}_${fromStr}_${toStr}.pdf`;
          base64 = await reportService.getStockLedgerPdf({
            fromDate: fromStr,
            toDate: toStr,
            fkItem: selectedItemId,
            showCostPrice,
          });
          break;

        case 'customer_bill':
          if (!selectedCustomerId) throw new Error('Please select a customer.');
          filename = `CustomerBill_${selectedCustomerId}_${fromStr}_${toStr}.pdf`;
          // Thermal View format by default
          base64 = await reportService.getCustomerBillPdf({
            fromDate: fromStr,
            toDate: toStr,
            account: selectedCustomerId,
            dateBasis,
            layout: customerBillLayout,
          });
          break;

        case 'customer_recovery':
          filename = `CustomerBalanceRecovery_${fromStr}_${toStr}.pdf`;
          base64 = await reportService.getCustomerBalanceRecoveryPdf({
            fromDate: fromStr,
            toDate: toStr,
            customerAccountId: selectedCustomerId || undefined,
            dateBasis,
            balanceFilter,
          });
          break;

        case 'milk_comparison':
          filename = `MilkComparison_${fromStr}_${toStr}.pdf`;
          base64 = await reportService.getPurchaseSupplyComparisonPdf({
            fromDate: fromStr,
            toDate: toStr,
            itemId: selectedItemId || undefined,
          });
          break;
      }

      setPdfFileName(filename);
      setPdfBase64(base64);
    } catch (err: any) {
      setPdfModalVisible(false);
      Alert.alert(
        'PDF Failed',
        err?.response?.data?.message || err?.message || 'Could not fetch report PDF from server.'
      );
    } finally {
      setPdfLoading(false);
    }
  };

  /**
   * Fetches raw JSON data and presents instant interactive metrics on screen
   */
  const handleLoadDataBreakdown = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const fromStr = dayjs(fromDate).format('YYYY-MM-DD');
    const toStr = dayjs(toDate).format('YYYY-MM-DD');

    setDataLoading(true);
    setReportData(null);
    setActiveDataView(null);

    try {
      let data: any = null;

      switch (selectedReportId) {
        case 'account_statement':
          if (!selectedAccountId) throw new Error('Please select an account.');
          data = await reportService.getAccountStatement({
            fromDate: fromStr,
            toDate: toStr,
            account: selectedAccountId,
            dateBasis,
          });
          break;

        case 'account_statement_due':
          if (!selectedAccountId) throw new Error('Please select an account.');
          data = await reportService.getAccountStatementWithDue({
            fromDate: fromStr,
            toDate: toStr,
            account: selectedAccountId,
            dateBasis,
          });
          break;

        case 'account_balance':
          if (!selectedControlAccountId) throw new Error('Please select a control head account.');
          data = await reportService.getBalanceDetail({
            toDate: toStr,
            account: selectedControlAccountId,
          });
          break;

        case 'trial_balance':
          data = await reportService.getTrialBalance({
            fromDate: fromStr,
            toDate: toStr,
          });
          break;

        case 'balance_sheet':
          data = await reportService.getBalanceSheet({
            toDate: toStr,
          });
          break;

        case 'income_summary':
          data = await reportService.getIncomeSummary({
            fromDate: fromStr,
            toDate: toStr,
          });
          break;

        case 'stock_balance':
          data = await reportService.getStockBalance({
            fromDate: fromStr,
            toDate: toStr,
            catagory: selectedCategoryCode || undefined,
            showStockValue,
          });
          break;

        case 'item_ledger':
          if (!selectedItemId) throw new Error('Please select a product item.');
          data = await reportService.getStockLedger({
            fromDate: fromStr,
            toDate: toStr,
            fkItem: selectedItemId,
            showCostPrice,
          });
          break;

        case 'customer_bill':
          if (!selectedCustomerId) throw new Error('Please select a customer.');
          data = await reportService.getCustomerBill({
            fromDate: fromStr,
            toDate: toStr,
            account: selectedCustomerId,
            dateBasis,
          });
          break;

        case 'customer_recovery':
          data = await reportService.getCustomerBalanceRecovery({
            fromDate: fromStr,
            toDate: toStr,
            customerAccountId: selectedCustomerId || undefined,
            dateBasis,
            balanceFilter,
          });
          break;

        case 'milk_comparison':
          data = await reportService.getPurchaseSupplyComparison({
            fromDate: fromStr,
            toDate: toStr,
            itemId: selectedItemId || undefined,
          });
          break;
      }

      setReportData(data);
      setActiveDataView(selectedReportId);
    } catch (err: any) {
      Alert.alert(
        'Data Fetch Failed',
        err?.response?.data?.message || err?.message || 'Could not fetch report data.'
      );
    } finally {
      setDataLoading(false);
    }
  };

  // Filter items in modal picker
  const filteredModalItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (modalType === 'account') {
      return detailAccounts.filter(
        (a) => a.title.toLowerCase().includes(q) || a.account.toLowerCase().includes(q)
      );
    }
    if (modalType === 'controlAccount') {
      return controlAccounts.filter(
        (a) => a.title.toLowerCase().includes(q) || a.account.toLowerCase().includes(q)
      );
    }
    if (modalType === 'customer') {
      return customerAccounts.filter(
        (a) => a.title.toLowerCase().includes(q) || a.account.toLowerCase().includes(q)
      );
    }
    if (modalType === 'item') {
      return items.filter(
        (i) => i.title.toLowerCase().includes(q) || (i.barcode && i.barcode.toLowerCase().includes(q))
      );
    }
    if (modalType === 'category') {
      return categories.filter(
        (c) => c.title.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
      );
    }
    return [];
  }, [modalType, searchQuery, detailAccounts, controlAccounts, customerAccounts, items, categories]);

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>Loading Reports...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Sleek Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={styles.headerTitle}>Reports Hub</Text>
            <Text style={styles.headerSubtitle}>Financial & Operational Statements</Text>
          </View>
          <View style={styles.badgeContainer}>
            <Ionicons name="sparkles" size={13} color="#6366f1" />
            <Text style={styles.badgeText}>PDF Reports</Text>
          </View>
        </View>

        {/* Category Navigation Pills */}
        <View style={styles.categoryRow}>
          {[
            { key: 'accounts', label: 'Accounts', icon: 'book-outline' },
            { key: 'financial', label: 'Financial', icon: 'business-outline' },
            { key: 'inventory', label: 'Inventory', icon: 'cube-outline' },
            { key: 'commercial', label: 'Commercial', icon: 'receipt-outline' },
          ].map((cat) => {
            const isSelected = selectedCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedCategory(cat.key as ReportCategory);
                  const firstOfCat = allowedReports.find((r) => r.category === cat.key);
                  if (firstOfCat) {
                    setSelectedReportId(firstOfCat.id);
                    setReportData(null);
                    setActiveDataView(null);
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={13}
                  color={isSelected ? '#ffffff' : Theme.colors.textSecondary}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.categoryPillText, isSelected && styles.categoryPillTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Modern Compact Visual Report Cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.reportScrollContainer}
        >
          {allowedReports
            .filter((r) => r.category === selectedCategory)
            .map((r) => {
              const isSelected = selectedReportId === r.id;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.reportCard, isSelected && styles.reportCardActive]}
                  onPress={() => handleSelectReport(r)}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardTopRow}>
                    <View style={[styles.reportIconBox, { backgroundColor: isSelected ? r.color : 'rgba(99, 102, 241, 0.1)' }]}>
                      <Ionicons name={r.icon} size={18} color={isSelected ? '#ffffff' : r.color} />
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={17} color="#6366f1" />
                    )}
                  </View>
                  <View style={{ marginTop: 8 }}>
                    <Text style={[styles.reportCardTitle, isSelected && styles.reportCardTitleActive]} numberOfLines={1}>
                      {r.shortTitle}
                    </Text>
                    <Text style={styles.reportCardTagline} numberOfLines={1}>
                      {r.tagline}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
        </ScrollView>

        {/* Filter Configuration Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="options-outline" size={16} color={Theme.colors.primary} />
            <Text style={styles.cardHeaderText}>Report Parameters</Text>
          </View>

          {/* Quick Date Shortcuts (single compact row) */}
          {selectedReportId !== 'balance_sheet' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcutContainer}>
              {[
                { key: 'today', label: 'Today' },
                { key: 'yesterday', label: 'Yesterday' },
                { key: 'thisWeek', label: 'This Week' },
                { key: 'lastWeek', label: 'Last Week' },
                { key: 'thisMonth', label: 'This Month' },
                { key: 'lastMonth', label: 'Last Month' },
              ].map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={styles.shortcutChip}
                  onPress={() => setDateShortcut(s.key as any)}
                >
                  <Text style={styles.shortcutText}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Date Pickers */}
          <View style={styles.dateRow}>
            {selectedReportId !== 'balance_sheet' && selectedReportId !== 'account_balance' && (
              <View style={styles.dateCol}>
                <Text style={styles.inputLabel}>From Date</Text>
                <TouchableOpacity
                  style={styles.selectorButton}
                  onPress={() => setShowFromPicker(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar-outline" size={15} color={Theme.colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.selectorValueText}>{dayjs(fromDate).format('DD MMM YYYY')}</Text>
                </TouchableOpacity>
                {showFromPicker && (
                  <DateTimePicker
                    value={fromDate}
                    mode="date"
                    display="default"
                    onChange={(_, date) => {
                      setShowFromPicker(false);
                      if (date) setFromDate(date);
                    }}
                  />
                )}
              </View>
            )}

            <View style={styles.dateCol}>
              <Text style={styles.inputLabel}>
                {selectedReportId === 'balance_sheet' || selectedReportId === 'account_balance' ? 'As of Date' : 'To Date'}
              </Text>
              <TouchableOpacity
                style={styles.selectorButton}
                onPress={() => setShowToPicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={15} color={Theme.colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.selectorValueText}>{dayjs(toDate).format('DD MMM YYYY')}</Text>
              </TouchableOpacity>
              {showToPicker && (
                <DateTimePicker
                  value={toDate}
                  mode="date"
                  display="default"
                  onChange={(_, date) => {
                    setShowToPicker(false);
                    if (date) setToDate(date);
                  }}
                />
              )}
            </View>
          </View>

          {/* Account Statement Detail Account Picker */}
          {(selectedReportId === 'account_statement' || selectedReportId === 'account_statement_due') && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Account</Text>
              <TouchableOpacity
                style={styles.selectorButton}
                onPress={() => {
                  setSearchQuery('');
                  setModalType('account');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="wallet-outline" size={16} color="#6366f1" style={{ marginRight: 6 }} />
                <Text style={styles.selectorValueText} numberOfLines={1}>
                  {detailAccounts.find((a) => a.account === selectedAccountId)?.title ||
                    selectedAccountId ||
                    'Select Account'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Account Balance Report Control Head Picker */}
          {selectedReportId === 'account_balance' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Control Head Account</Text>
              <TouchableOpacity
                style={styles.selectorButton}
                onPress={() => {
                  setSearchQuery('');
                  setModalType('controlAccount');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="briefcase-outline" size={16} color="#3b82f6" style={{ marginRight: 6 }} />
                <Text style={styles.selectorValueText} numberOfLines={1}>
                  {controlAccounts.find((a) => a.account === selectedControlAccountId)?.title ||
                    selectedControlAccountId ||
                    'Select Control Head'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Customer Bill / Recovery Customer Picker */}
          {(selectedReportId === 'customer_bill' || selectedReportId === 'customer_recovery') && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Customer</Text>
              <TouchableOpacity
                style={styles.selectorButton}
                onPress={() => {
                  setSearchQuery('');
                  setModalType('customer');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="person-outline" size={16} color="#ec4899" style={{ marginRight: 6 }} />
                <Text style={styles.selectorValueText} numberOfLines={1}>
                  {selectedCustomerId
                    ? customerAccounts.find((c) => c.account === selectedCustomerId)?.title || selectedCustomerId
                    : 'All Customers (Combined)'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Customer Bill Layout (Thermal view default) */}
          {selectedReportId === 'customer_bill' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Print Format</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, customerBillLayout === 'Thermal' && styles.toggleBtnActive]}
                  onPress={() => setCustomerBillLayout('Thermal')}
                >
                  <Ionicons
                    name="receipt-outline"
                    size={14}
                    color={customerBillLayout === 'Thermal' ? '#ffffff' : '#64748b'}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.toggleBtnText, customerBillLayout === 'Thermal' && styles.toggleBtnTextActive]}>
                    Thermal View
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, customerBillLayout === 'A4' && styles.toggleBtnActive]}
                  onPress={() => setCustomerBillLayout('A4')}
                >
                  <Ionicons
                    name="document-outline"
                    size={14}
                    color={customerBillLayout === 'A4' ? '#ffffff' : '#64748b'}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.toggleBtnText, customerBillLayout === 'A4' && styles.toggleBtnTextActive]}>
                    A4 View
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Stock Balance Category Picker */}
          {selectedReportId === 'stock_balance' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category</Text>
              <TouchableOpacity
                style={styles.selectorButton}
                onPress={() => {
                  setSearchQuery('');
                  setModalType('category');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="grid-outline" size={16} color="#f59e0b" style={{ marginRight: 6 }} />
                <Text style={styles.selectorValueText} numberOfLines={1}>
                  {selectedCategoryCode
                    ? categories.find((c) => c.code === selectedCategoryCode)?.title || selectedCategoryCode
                    : 'All Categories'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Item Ledger / Milk Comparison Item Picker */}
          {(selectedReportId === 'item_ledger' || selectedReportId === 'milk_comparison') && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {selectedReportId === 'item_ledger' ? 'Product Item' : 'Milk Item'}
              </Text>
              <TouchableOpacity
                style={styles.selectorButton}
                onPress={() => {
                  setSearchQuery('');
                  setModalType('item');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="cube-outline" size={16} color="#f97316" style={{ marginRight: 6 }} />
                <Text style={styles.selectorValueText} numberOfLines={1}>
                  {selectedItemId
                    ? items.find((i) => i.id === selectedItemId)?.title || selectedItemId
                    : 'Select Item'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Date Basis Toggle */}
          {(selectedReportId === 'account_statement' ||
            selectedReportId === 'account_statement_due' ||
            selectedReportId === 'customer_bill' ||
            selectedReportId === 'customer_recovery') && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Date Basis</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, dateBasis === 'VoucherDate' && styles.toggleBtnActive]}
                  onPress={() => setDateBasis('VoucherDate')}
                >
                  <Text style={[styles.toggleBtnText, dateBasis === 'VoucherDate' && styles.toggleBtnTextActive]}>
                    Voucher Date
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, dateBasis === 'ClearingDate' && styles.toggleBtnActive]}
                  onPress={() => setDateBasis('ClearingDate')}
                >
                  <Text style={[styles.toggleBtnText, dateBasis === 'ClearingDate' && styles.toggleBtnTextActive]}>
                    Clearing Date
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Customer Recovery Balance Filter */}
          {selectedReportId === 'customer_recovery' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Filter Status</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
                {(['All', 'OutstandingOnly', 'ClearedOnly', 'UnpaidOnly'] as const).map((filter) => (
                  <TouchableOpacity
                    key={filter}
                    style={[styles.filterChip, balanceFilter === filter && styles.filterChipActive]}
                    onPress={() => setBalanceFilter(filter)}
                  >
                    <Text style={[styles.filterChipText, balanceFilter === filter && styles.filterChipTextActive]}>
                      {filter === 'OutstandingOnly'
                        ? 'Outstanding'
                        : filter === 'ClearedOnly'
                        ? 'Cleared'
                        : filter === 'UnpaidOnly'
                        ? 'Unpaid'
                        : 'All'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Switches for Stock & Ledger */}
          {selectedReportId === 'stock_balance' && (
            <View style={styles.switchRow}>
              <Text style={styles.switchTitle}>Show Stock Value</Text>
              <Switch
                value={showStockValue}
                onValueChange={setShowStockValue}
                trackColor={{ false: '#cbd5e1', true: '#818cf8' }}
                thumbColor={showStockValue ? '#4f46e5' : '#f8fafc'}
              />
            </View>
          )}

          {selectedReportId === 'item_ledger' && (
            <View style={styles.switchRow}>
              <Text style={styles.switchTitle}>Show Cost Price</Text>
              <Switch
                value={showCostPrice}
                onValueChange={setShowCostPrice}
                trackColor={{ false: '#cbd5e1', true: '#818cf8' }}
                thumbColor={showCostPrice ? '#4f46e5' : '#f8fafc'}
              />
            </View>
          )}

          {/* Action Buttons Row */}
          <View style={styles.actionRow}>
            {/* Primary Action: VIEW PDF */}
            <TouchableOpacity
              style={styles.primaryPdfBtn}
              onPress={handleOpenPdfReport}
              disabled={pdfLoading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#6366f1', '#4338ca']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryBtnGradient}
              >
                {pdfLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Ionicons name="document-text" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.primaryBtnText}>View PDF</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Secondary Action: VIEW BREAKDOWN */}
            <TouchableOpacity
              style={styles.secondaryDataBtn}
              onPress={handleLoadDataBreakdown}
              disabled={dataLoading}
              activeOpacity={0.8}
            >
              {dataLoading ? (
                <ActivityIndicator color={Theme.colors.primary} size="small" />
              ) : (
                <>
                  <Ionicons name="analytics-outline" size={17} color={Theme.colors.primary} style={{ marginRight: 5 }} />
                  <Text style={styles.secondaryBtnText}>Breakdown</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* DATA BREAKDOWN RESULTS */}
        {reportData && activeDataView && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.resultsCard}>
            <View style={styles.resultsHeader}>
              <View>
                <Text style={styles.resultsTitle}>{currentReport.title}</Text>
                <Text style={styles.resultsDateRange}>
                  {dayjs(fromDate).format('DD MMM')} — {dayjs(toDate).format('DD MMM YYYY')}
                </Text>
              </View>
              <TouchableOpacity style={styles.quickPdfBadge} onPress={handleOpenPdfReport}>
                <Ionicons name="document-text-outline" size={13} color="#4f46e5" style={{ marginRight: 4 }} />
                <Text style={styles.quickPdfBadgeText}>PDF</Text>
              </TouchableOpacity>
            </View>

            {activeDataView === 'account_statement' && Array.isArray(reportData) && (
              <View>
                {(() => {
                  let totalDr = 0;
                  let totalCr = 0;
                  reportData.forEach((row: AccountStatementLine) => {
                    totalDr += row.dr;
                    totalCr += row.cr;
                  });
                  const closingBal = totalDr - totalCr;
                  return (
                    <View style={styles.metricGrid}>
                      <View style={[styles.metricBox, { backgroundColor: '#eef2ff' }]}>
                        <Text style={styles.metricLabel}>Total Debit</Text>
                        <Text style={[styles.metricValue, { color: '#4338ca' }]}>Rs. {totalDr.toLocaleString()}</Text>
                      </View>
                      <View style={[styles.metricBox, { backgroundColor: '#fdf2f8' }]}>
                        <Text style={styles.metricLabel}>Total Credit</Text>
                        <Text style={[styles.metricValue, { color: '#be185d' }]}>Rs. {totalCr.toLocaleString()}</Text>
                      </View>
                      <View style={[styles.metricBox, { backgroundColor: closingBal >= 0 ? '#ecfdf5' : '#fef2f2', width: '100%', marginTop: 6 }]}>
                        <Text style={styles.metricLabel}>Closing Balance</Text>
                        <Text style={[styles.metricValue, { color: closingBal >= 0 ? '#047857' : '#b91c1c' }]}>
                          Rs. {Math.abs(closingBal).toLocaleString()} {closingBal >= 0 ? 'Dr' : 'Cr'}
                        </Text>
                      </View>
                    </View>
                  );
                })()}

                <Text style={[styles.inputLabel, { marginTop: 12, marginBottom: 6 }]}>
                  Recent Activity ({reportData.length} entries)
                </Text>
                {reportData.slice(0, 8).map((line: AccountStatementLine, idx: number) => (
                  <View key={idx} style={styles.lineItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lineParticular} numberOfLines={1}>
                        {line.particular}
                      </Text>
                      <Text style={styles.lineSub}>
                        {dayjs(line.vDate).format('DD MMM YYYY')} • {line.vNo || 'Voucher'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      {line.dr > 0 && <Text style={{ color: '#047857', fontWeight: '700', fontSize: 13 }}>+ {line.dr.toLocaleString()}</Text>}
                      {line.cr > 0 && <Text style={{ color: '#b91c1c', fontWeight: '700', fontSize: 13 }}>- {line.cr.toLocaleString()}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {activeDataView === 'trial_balance' && Array.isArray(reportData) && (
              <View>
                {(() => {
                  let totalDr = 0;
                  let totalCr = 0;
                  reportData.forEach((row: TrialBalanceLine) => {
                    totalDr += row.dr;
                    totalCr += row.cr;
                  });
                  return (
                    <View style={styles.metricGrid}>
                      <View style={[styles.metricBox, { backgroundColor: '#eef2ff' }]}>
                        <Text style={styles.metricLabel}>Total Debit</Text>
                        <Text style={[styles.metricValue, { color: '#4338ca' }]}>Rs. {totalDr.toLocaleString()}</Text>
                      </View>
                      <View style={[styles.metricBox, { backgroundColor: '#fdf2f8' }]}>
                        <Text style={styles.metricLabel}>Total Credit</Text>
                        <Text style={[styles.metricValue, { color: '#be185d' }]}>Rs. {totalCr.toLocaleString()}</Text>
                      </View>
                    </View>
                  );
                })()}
              </View>
            )}

            {activeDataView === 'stock_balance' && Array.isArray(reportData) && (
              <View>
                {(() => {
                  let totalQty = 0;
                  reportData.forEach((row: StockBalanceLine) => {
                    totalQty += row.qtyBal;
                  });
                  return (
                    <View style={[styles.metricBox, { backgroundColor: '#fffbeb', width: '100%' }]}>
                      <Text style={styles.metricLabel}>Stock Balance</Text>
                      <Text style={[styles.metricValue, { color: '#b45309' }]}>
                        {reportData.length} Items • {totalQty.toLocaleString()} Units
                      </Text>
                    </View>
                  );
                })()}
              </View>
            )}

            {activeDataView === 'customer_recovery' && reportData?.summary && (
              <View>
                <View style={styles.metricGrid}>
                  <View style={[styles.metricBox, { backgroundColor: '#eef2ff' }]}>
                    <Text style={styles.metricLabel}>Total Due</Text>
                    <Text style={[styles.metricValue, { color: '#4338ca' }]}>
                      Rs. {reportData.summary.totalDue.toLocaleString()}
                    </Text>
                  </View>
                  <View style={[styles.metricBox, { backgroundColor: '#ecfdf5' }]}>
                    <Text style={styles.metricLabel}>Total Recovered</Text>
                    <Text style={[styles.metricValue, { color: '#047857' }]}>
                      Rs. {reportData.summary.totalRecovery.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {activeDataView === 'milk_comparison' && reportData?.summary && (
              <View>
                <View style={styles.metricGrid}>
                  <View style={[styles.metricBox, { backgroundColor: '#e0f2fe' }]}>
                    <Text style={styles.metricLabel}>Purchase</Text>
                    <Text style={[styles.metricValue, { color: '#0369a1' }]}>
                      {reportData.summary.totalPurchaseQty.toLocaleString()} Ltr
                    </Text>
                  </View>
                  <View style={[styles.metricBox, { backgroundColor: '#f0fdf4' }]}>
                    <Text style={styles.metricLabel}>Dispatched</Text>
                    <Text style={[styles.metricValue, { color: '#15803d' }]}>
                      {reportData.summary.totalDispatchedQty.toLocaleString()} Ltr
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {activeDataView === 'customer_bill' && reportData?.summary && (
              <View>
                <View style={styles.metricGrid}>
                  <View style={[styles.metricBox, { backgroundColor: '#f8fafc' }]}>
                    <Text style={styles.metricLabel}>Previous</Text>
                    <Text style={styles.metricValue}>Rs. {reportData.summary.previousBalance.toLocaleString()}</Text>
                  </View>
                  <View style={[styles.metricBox, { backgroundColor: '#ecfdf5' }]}>
                    <Text style={styles.metricLabel}>Payments</Text>
                    <Text style={[styles.metricValue, { color: '#047857' }]}>Rs. {reportData.summary.payment.toLocaleString()}</Text>
                  </View>
                  <View style={[styles.metricBox, { backgroundColor: '#eef2ff', width: '100%', marginTop: 6 }]}>
                    <Text style={styles.metricLabel}>Net Balance</Text>
                    <Text style={[styles.metricValue, { color: '#4338ca' }]}>Rs. {reportData.summary.balance.toLocaleString()}</Text>
                  </View>
                </View>
                {IsWandaFeature && reportData?.lines?.length > 0 && (
                  <View style={[styles.metricGrid, { marginTop: 6 }]}>
                    <View style={[styles.metricBox, { backgroundColor: '#fffbeb' }]}>
                      <Text style={styles.metricLabel}>Total Weight (Kg)</Text>
                      <Text style={[styles.metricValue, { color: '#b45309' }]}>
                        {reportData.lines.reduce((acc: number, l: any) => acc + (l.qty || 0), 0).toLocaleString()}
                      </Text>
                    </View>
                    <View style={[styles.metricBox, { backgroundColor: '#fef3c7' }]}>
                      <Text style={styles.metricLabel}>Total Bags</Text>
                      <Text style={[styles.metricValue, { color: '#92400e' }]}>
                        {reportData.lines.reduce((acc: number, l: any) => acc + (l.secQty || (l.qtyInPack > 0 ? Math.round(l.qty / l.qtyInPack) : 0)), 0).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.fullReportPdfBanner} onPress={handleOpenPdfReport}>
              <Ionicons name="document-text" size={17} color="#6366f1" style={{ marginRight: 8 }} />
              <Text style={styles.fullReportPdfBannerTitle}>View Full PDF Document</Text>
              <Ionicons name="chevron-forward" size={16} color="#6366f1" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>

      {/* IN-APP MEMORY PDF VIEWER */}
      <PdfViewerModal
        visible={pdfModalVisible}
        title={currentReport.title}
        subtitle={`${dayjs(fromDate).format('DD MMM YYYY')} — ${dayjs(toDate).format('DD MMM YYYY')}`}
        base64Pdf={pdfBase64}
        loading={pdfLoading}
        fileName={pdfFileName}
        onClose={() => {
          setPdfModalVisible(false);
          setPdfBase64(null);
        }}
      />

      {/* SEARCHABLE SELECTION MODAL */}
      <Modal
        visible={modalType !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalType(null)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {modalType === 'account'
                ? 'Select Account'
                : modalType === 'controlAccount'
                ? 'Select Control Head'
                : modalType === 'customer'
                ? 'Select Customer'
                : modalType === 'item'
                ? 'Select Product'
                : 'Select Category'}
            </Text>
            <TouchableOpacity onPress={() => setModalType(null)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={20} color={Theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={Theme.colors.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
            {modalType === 'customer' && selectedReportId === 'customer_recovery' && (
              <TouchableOpacity
                style={[styles.modalItem, !selectedCustomerId && styles.modalItemActive]}
                onPress={() => {
                  setSelectedCustomerId('');
                  setModalType(null);
                }}
              >
                <View>
                  <Text style={[styles.modalItemTitle, !selectedCustomerId && { color: Theme.colors.primary }]}>
                    All Customers (Combined)
                  </Text>
                </View>
                {!selectedCustomerId && <Ionicons name="checkmark" size={18} color={Theme.colors.primary} />}
              </TouchableOpacity>
            )}

            {modalType === 'category' && (
              <TouchableOpacity
                style={[styles.modalItem, !selectedCategoryCode && styles.modalItemActive]}
                onPress={() => {
                  setSelectedCategoryCode('');
                  setModalType(null);
                }}
              >
                <View>
                  <Text style={[styles.modalItemTitle, !selectedCategoryCode && { color: Theme.colors.primary }]}>
                    All Categories
                  </Text>
                </View>
                {!selectedCategoryCode && <Ionicons name="checkmark" size={18} color={Theme.colors.primary} />}
              </TouchableOpacity>
            )}

            {filteredModalItems.map((item: any, idx: number) => {
              const code = item.account || item.id || item.code;
              const title = item.title;
              const isSelected =
                (modalType === 'account' && selectedAccountId === code) ||
                (modalType === 'controlAccount' && selectedControlAccountId === code) ||
                (modalType === 'customer' && selectedCustomerId === code) ||
                (modalType === 'item' && selectedItemId === code) ||
                (modalType === 'category' && selectedCategoryCode === code);

              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.modalItem, isSelected && styles.modalItemActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    if (modalType === 'account') setSelectedAccountId(code);
                    if (modalType === 'controlAccount') setSelectedControlAccountId(code);
                    if (modalType === 'customer') setSelectedCustomerId(code);
                    if (modalType === 'item') setSelectedItemId(code);
                    if (modalType === 'category') setSelectedCategoryCode(code);
                    setModalType(null);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalItemTitle, isSelected && { color: Theme.colors.primary }]}>
                      {title}
                    </Text>
                    <Text style={styles.modalItemSubtitle}>{code}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark" size={18} color={Theme.colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4f46e5',
    marginLeft: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 6,
  },
  categoryPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  categoryPillActive: {
    backgroundColor: '#4f46e5',
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  categoryPillTextActive: {
    color: '#ffffff',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 14,
    paddingBottom: 36,
  },
  reportScrollContainer: {
    gap: 10,
    paddingBottom: 12,
  },
  reportCard: {
    width: 122,
    height: 94,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  reportCardActive: {
    borderColor: '#6366f1',
    backgroundColor: '#ffffff',
    shadowColor: '#6366f1',
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 4,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  reportCardTitleActive: {
    color: '#4f46e5',
  },
  reportCardTagline: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginLeft: 6,
  },
  shortcutContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  shortcutChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  shortcutText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  dateCol: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectorValueText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 6,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  toggleBtnActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  toggleBtnTextActive: {
    color: '#ffffff',
  },
  filterChipRow: {
    gap: 6,
  },
  filterChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#a855f7',
    borderColor: '#a855f7',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  switchTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  primaryPdfBtn: {
    flex: 1.5,
    borderRadius: 10,
    overflow: 'hidden',
  },
  primaryBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryDataBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  secondaryBtnText: {
    color: '#4338ca',
    fontSize: 12,
    fontWeight: '700',
  },
  resultsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 10,
  },
  resultsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  resultsDateRange: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  quickPdfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  quickPdfBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4f46e5',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metricBox: {
    flex: 1,
    minWidth: '47%',
    padding: 10,
    borderRadius: 8,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  lineItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  lineParticular: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  lineSub: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  fullReportPdfBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f3ff',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  fullReportPdfBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4338ca',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    margin: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    padding: 0,
  },
  modalList: {
    flex: 1,
    paddingHorizontal: 10,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  modalItemActive: {
    backgroundColor: '#eef2ff',
  },
  modalItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  modalItemSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
});
