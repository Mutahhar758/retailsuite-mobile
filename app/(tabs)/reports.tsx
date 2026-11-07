import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Theme } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import {
  reportService,
  AccountStatementLine,
  TrialBalanceLine,
  StockBalanceLine,
  ProfitByCustomerLine,
  ProfitByItemLine,
} from '../../services/reportService';
import { chartOfAccountService, ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { inventoryService, Item } from '../../services/inventoryService';
import { itemCategoryService, ItemCategoryDto } from '../../services/itemCategoryService';
import { PdfViewerModal } from '../../components/reports/PdfViewerModal';
import { InlineSearchSelect } from '../../components/ui/InlineSearchSelect';

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
  | 'milk_comparison'
  | 'profit_by_customer'
  | 'profit_by_item';

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
    id: 'profit_by_customer',
    title: 'Profit by Customer',
    shortTitle: 'Customer Profit',
    tagline: 'Sales, cost & margin',
    category: 'financial',
    icon: 'stats-chart-outline',
    color: '#059669',
    permission: 'Permissions.ProfitByCustomer.View',
  },
  {
    id: 'profit_by_item',
    title: 'Profit by Item',
    shortTitle: 'Item Profit',
    tagline: 'Product margin analysis',
    category: 'financial',
    icon: 'pie-chart-outline',
    color: '#0d9488',
    permission: 'Permissions.ProfitByItem.View',
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
    title: 'Purchase vs Supply',
    shortTitle: 'Purchase vs Supply',
    tagline: 'Purchase vs dispatch comparison',
    category: 'commercial',
    icon: 'swap-horizontal-outline',
    color: '#0ea5e9',
    permission: 'Permissions.PurchaseSupplyComparison.View',
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
    if (permissions.includes(permission)) return true;
    if (permission === 'Permissions.PurchaseSupplyComparison.View' && permissions.includes('Permissions.MilkComparison.View')) return true;
    if (
      (permission === 'Permissions.ProfitByCustomer.View' || permission === 'Permissions.ProfitByItem.View') &&
      permissions.includes('Permissions.IncomeSummary.View')
    ) {
      return true;
    }
    return false;
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
            tagline: IsWandaFeature ? 'Feed & bags statement' : 'Customer sales statement',
          };
        }
        return r;
      });
  }, [permissions, user, IsWandaFeature]);

  // Active Category & Report Selection
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('accounts');
  const [selectedReportId, setSelectedReportId] = useState<ReportType>('account_statement');

  const routeParams = useLocalSearchParams<{
    reportType?: string;
    report?: string;
    autoViewPdf?: string;
    fromDate?: string;
    toDate?: string;
    account?: string;
    accountId?: string;
    controlAccountId?: string;
    customer?: string;
    customerId?: string;
    item?: string;
    itemId?: string;
    t?: string;
  }>();

  const handledAutoPdfKeyRef = useRef<string>('');

  useEffect(() => {
    const incomingReportParam = routeParams.reportType || routeParams.report;
    if (incomingReportParam) {
      const raw = String(incomingReportParam).toLowerCase().replace(/-/g, '_').trim();
      const reportMap: Record<string, ReportType> = {
        balance_sheet: 'balance_sheet',
        trial_balance: 'trial_balance',
        stock_balance: 'stock_balance',
        item_ledger: 'item_ledger',
        account_statement: 'account_statement',
        account_statement_due: 'account_statement_due',
        account_statement_with_due: 'account_statement_due',
        account_balance: 'account_balance',
        income_summary: 'income_summary',
        profit_by_customer: 'profit_by_customer',
        profit_by_item: 'profit_by_item',
        customer_bill: 'customer_bill',
        customer_recovery: 'customer_recovery',
        customer_balance_recovery: 'customer_recovery',
        milk_comparison: 'milk_comparison',
        purchase_supply_comparison: 'milk_comparison',
      };

      const matchedId = reportMap[raw] || ALL_REPORTS.find(r => r.id === raw)?.id;
      if (matchedId) {
        const found = ALL_REPORTS.find(r => r.id === matchedId);
        if (found) {
          setSelectedReportId(found.id);
          setSelectedCategory(found.category);
        }
      }
    }

    if (routeParams.fromDate) {
      const parsed = dayjs(routeParams.fromDate);
      if (parsed.isValid()) setFromDate(parsed.toDate());
    }
    if (routeParams.toDate) {
      const parsed = dayjs(routeParams.toDate);
      if (parsed.isValid()) setToDate(parsed.toDate());
    }
    if (routeParams.accountId || routeParams.account) {
      const acc = routeParams.accountId || routeParams.account || '';
      setSelectedAccountId(acc);
      setSelectedCustomerId(acc);
    }
    if (routeParams.customerId || routeParams.customer) {
      setSelectedCustomerId(routeParams.customerId || routeParams.customer || '');
    }
    if (routeParams.itemId || routeParams.item) {
      setSelectedItemId(routeParams.itemId || routeParams.item || '');
    }
  }, [
    routeParams.reportType,
    routeParams.report,
    routeParams.fromDate,
    routeParams.toDate,
    routeParams.account,
    routeParams.accountId,
    routeParams.customer,
    routeParams.customerId,
    routeParams.item,
    routeParams.itemId,
  ]);

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
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showCostPrice, setShowCostPrice] = useState(false);
  const [customerBillLayout, setCustomerBillLayout] = useState<'Thermal' | 'A4'>('Thermal');
  const [balanceFilter, setBalanceFilter] = useState<'All' | 'OutstandingOnly' | 'ClearedOnly' | 'UnpaidOnly'>('All');

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
          setSelectedItemId(itemsRes[0].id);
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

  const handleOpenPdfReport = async (override?: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const isOverrideObj = override && typeof override === 'object' && !('nativeEvent' in override);

    const activeReportId: ReportType = (isOverrideObj && override.reportId) || selectedReportId;
    const activeFrom: Date = (isOverrideObj && override.from) || fromDate;
    const activeTo: Date = (isOverrideObj && override.to) || toDate;

    const activeAccountId: string =
      (isOverrideObj && override.accountId) ||
      selectedAccountId ||
      (detailAccounts.length > 0 ? detailAccounts[0].account : '');

    const activeControlAccountId: string =
      (isOverrideObj && override.controlAccountId) ||
      selectedControlAccountId ||
      (controlAccounts.length > 0 ? controlAccounts[0].account : '');

    const activeCustomerId: string =
      (isOverrideObj && override.customerId) ||
      selectedCustomerId;

    const activeItemId: string =
      (isOverrideObj && override.itemId) ||
      selectedItemId;

    const activeCategoryCode: string =
      (isOverrideObj && override.categoryCode) || selectedCategoryCode;

    const fromStr = dayjs(activeFrom).format('YYYY-MM-DD');
    const toStr = dayjs(activeTo).format('YYYY-MM-DD');

    setPdfLoading(true);
    setPdfBase64(null);
    setPdfModalVisible(true);

    try {
      let base64 = '';
      const repMeta = ALL_REPORTS.find((r) => r.id === activeReportId) || currentReport;
      let filename = `${repMeta.shortTitle.replace(/\s+/g, '_')}_${dayjs().format('YYYYMMDD')}.pdf`;

      switch (activeReportId) {
        case 'account_statement':
          if (!activeAccountId) throw new Error('Please select an account.');
          filename = `AccountStatement_${activeAccountId}_${fromStr}_${toStr}.pdf`;
          base64 = await reportService.getAccountStatementPdf({
            fromDate: fromStr,
            toDate: toStr,
            account: activeAccountId,
            dateBasis,
          });
          break;

        case 'account_statement_due':
          if (!activeAccountId) throw new Error('Please select an account.');
          filename = `AccountStatementWithDue_${activeAccountId}_${fromStr}_${toStr}.pdf`;
          base64 = await reportService.getAccountStatementWithDuePdf({
            fromDate: fromStr,
            toDate: toStr,
            account: activeAccountId,
            dateBasis,
          });
          break;

        case 'account_balance':
          if (!activeControlAccountId) throw new Error('Please select a control head account.');
          filename = `AccountBalance_${activeControlAccountId}_${toStr}.pdf`;
          base64 = await reportService.getBalanceDetailPdf({
            toDate: toStr,
            account: activeControlAccountId,
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

        case 'profit_by_customer':
          filename = `ProfitByCustomer_${fromStr}_${toStr}.pdf`;
          base64 = await reportService.getProfitByCustomerPdf({
            fromDate: fromStr,
            toDate: toStr,
            customerAccount: activeCustomerId || undefined,
          });
          break;

        case 'profit_by_item':
          filename = `ProfitByItem_${fromStr}_${toStr}.pdf`;
          base64 = await reportService.getProfitByItemPdf({
            fromDate: fromStr,
            toDate: toStr,
            itemId: activeItemId || undefined,
            categoryId: activeCategoryCode || undefined,
          });
          break;

        case 'stock_balance':
          filename = `StockBalance_${fromStr}_${toStr}.pdf`;
          base64 = await reportService.getStockBalancePdf({
            fromDate: fromStr,
            toDate: toStr,
            catagory: activeCategoryCode || undefined,
            showStockValue,
          });
          break;

        case 'item_ledger':
          if (!activeItemId) throw new Error('Please select a product item.');
          filename = `StockLedger_${activeItemId}_${fromStr}_${toStr}.pdf`;
          base64 = await reportService.getStockLedgerPdf({
            fromDate: fromStr,
            toDate: toStr,
            fkItem: activeItemId,
            showCostPrice,
          });
          break;

        case 'customer_bill': {
          const billCust = activeCustomerId || (customerAccounts.length > 0 ? customerAccounts[0].account : '');
          if (!billCust) throw new Error('Please select a customer.');
          filename = `CustomerBill_${billCust}_${fromStr}_${toStr}.pdf`;
          base64 = await reportService.getCustomerBillPdf({
            fromDate: fromStr,
            toDate: toStr,
            account: billCust,
            dateBasis,
            layout: customerBillLayout,
          });
          break;
        }

        case 'customer_recovery':
          filename = `CustomerBalanceRecovery_${fromStr}_${toStr}.pdf`;
          base64 = await reportService.getCustomerBalanceRecoveryPdf({
            fromDate: fromStr,
            toDate: toStr,
            customerAccountId: activeCustomerId || undefined,
            dateBasis,
            balanceFilter,
          });
          break;

        case 'milk_comparison':
          filename = `PurchaseSupplyComparison_${fromStr}_${toStr}.pdf`;
          base64 = await reportService.getPurchaseSupplyComparisonPdf({
            fromDate: fromStr,
            toDate: toStr,
            itemId: activeItemId || undefined,
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

  useEffect(() => {
    if (initialLoading) return;
    const incomingReportParam = routeParams.reportType || routeParams.report;

    if (routeParams.autoViewPdf === 'true' || incomingReportParam) {
      const autoKey = `${incomingReportParam}_${routeParams.fromDate}_${routeParams.toDate}_${routeParams.account || routeParams.accountId}_${routeParams.autoViewPdf}_${routeParams.t || ''}`;
      if (handledAutoPdfKeyRef.current !== autoKey) {
        handledAutoPdfKeyRef.current = autoKey;

        const raw = String(incomingReportParam || '').toLowerCase().replace(/-/g, '_').trim();
        const repMap: Record<string, ReportType> = {
          balance_sheet: 'balance_sheet',
          trial_balance: 'trial_balance',
          stock_balance: 'stock_balance',
          item_ledger: 'item_ledger',
          account_statement: 'account_statement',
          account_statement_due: 'account_statement_due',
          account_statement_with_due: 'account_statement_due',
          account_balance: 'account_balance',
          income_summary: 'income_summary',
          profit_by_customer: 'profit_by_customer',
          profit_by_item: 'profit_by_item',
          customer_bill: 'customer_bill',
          customer_recovery: 'customer_recovery',
          customer_balance_recovery: 'customer_recovery',
          milk_comparison: 'milk_comparison',
          purchase_supply_comparison: 'milk_comparison',
        };

        const targetReportId = repMap[raw] || selectedReportId;
        const targetFrom = routeParams.fromDate && dayjs(routeParams.fromDate).isValid() ? dayjs(routeParams.fromDate).toDate() : fromDate;
        const targetTo = routeParams.toDate && dayjs(routeParams.toDate).isValid() ? dayjs(routeParams.toDate).toDate() : toDate;
        const targetAcc = routeParams.accountId || routeParams.account || selectedAccountId;
        const targetControlAcc = routeParams.controlAccountId || selectedControlAccountId;
        const targetCust = routeParams.customerId || routeParams.customer || routeParams.account || selectedCustomerId;
        const targetItem = routeParams.itemId || routeParams.item || selectedItemId;

        setSelectedReportId(targetReportId);
        const timer = setTimeout(() => {
          handleOpenPdfReport({
            reportId: targetReportId,
            from: targetFrom,
            to: targetTo,
            accountId: targetAcc,
            controlAccountId: targetControlAcc,
            customerId: targetCust,
            itemId: targetItem,
          });
        }, 150);

        return () => clearTimeout(timer);
      }
    }
  }, [
    initialLoading,
    routeParams.autoViewPdf,
    routeParams.reportType,
    routeParams.report,
    routeParams.fromDate,
    routeParams.toDate,
    routeParams.account,
    routeParams.accountId,
    routeParams.controlAccountId,
    routeParams.customer,
    routeParams.customerId,
    routeParams.item,
    routeParams.itemId,
    routeParams.t,
    selectedAccountId,
    selectedControlAccountId,
    selectedCustomerId,
    selectedItemId,
    detailAccounts,
  ]);

  const handleLoadDataBreakdown = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const fromStr = dayjs(fromDate).format('YYYY-MM-DD');
    const toStr = dayjs(toDate).format('YYYY-MM-DD');

    const activeAccountId = selectedAccountId || (detailAccounts.length > 0 ? detailAccounts[0].account : '');
    const activeControlAccountId = selectedControlAccountId || (controlAccounts.length > 0 ? controlAccounts[0].account : '');
    const activeCustomerId = selectedCustomerId;
    const activeItemId = selectedItemId;
    const activeCategoryCode = selectedCategoryCode;

    setDataLoading(true);
    setReportData(null);
    setActiveDataView(null);

    try {
      let data: any = null;

      switch (selectedReportId) {
        case 'account_statement':
          if (!activeAccountId) throw new Error('Please select an account.');
          data = await reportService.getAccountStatement({
            fromDate: fromStr,
            toDate: toStr,
            account: activeAccountId,
            dateBasis,
          });
          break;

        case 'account_statement_due':
          if (!activeAccountId) throw new Error('Please select an account.');
          data = await reportService.getAccountStatementWithDue({
            fromDate: fromStr,
            toDate: toStr,
            account: activeAccountId,
            dateBasis,
          });
          break;

        case 'account_balance':
          if (!activeControlAccountId) throw new Error('Please select a control head account.');
          data = await reportService.getBalanceDetail({
            toDate: toStr,
            account: activeControlAccountId,
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

        case 'profit_by_customer':
          data = await reportService.getProfitByCustomer({
            fromDate: fromStr,
            toDate: toStr,
            customerAccount: activeCustomerId || undefined,
          });
          break;

        case 'profit_by_item':
          data = await reportService.getProfitByItem({
            fromDate: fromStr,
            toDate: toStr,
            itemId: activeItemId || undefined,
            categoryId: activeCategoryCode || undefined,
          });
          break;

        case 'stock_balance':
          data = await reportService.getStockBalance({
            fromDate: fromStr,
            toDate: toStr,
            catagory: activeCategoryCode || undefined,
            showStockValue,
            filter: lowStockOnly ? 'LowStock' : 'All',
          });
          break;

        case 'item_ledger': {
          const itemTarget = activeItemId || (items.length > 0 ? items[0].id : '');
          if (!itemTarget) throw new Error('Please select a product item.');
          data = await reportService.getStockLedger({
            fromDate: fromStr,
            toDate: toStr,
            fkItem: itemTarget,
            showCostPrice,
          });
          break;
        }

        case 'customer_bill': {
          const custTarget = activeCustomerId || (customerAccounts.length > 0 ? customerAccounts[0].account : '');
          if (!custTarget) throw new Error('Please select a customer.');
          data = await reportService.getCustomerBill({
            fromDate: fromStr,
            toDate: toStr,
            account: custTarget,
            dateBasis,
          });
          break;
        }

        case 'customer_recovery':
          data = await reportService.getCustomerBalanceRecovery({
            fromDate: fromStr,
            toDate: toStr,
            customerAccountId: activeCustomerId || undefined,
            dateBasis,
            balanceFilter,
          });
          break;

        case 'milk_comparison':
          data = await reportService.getPurchaseSupplyComparison({
            fromDate: fromStr,
            toDate: toStr,
            itemId: activeItemId || undefined,
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

  const detailAccountOptions = useMemo(() => detailAccounts.map(a => ({
    value: a.account,
    label: a.title,
    subtitle: a.account
  })), [detailAccounts]);

  const controlAccountOptions = useMemo(() => controlAccounts.map(a => ({
    value: a.account,
    label: a.title,
    subtitle: a.account
  })), [controlAccounts]);

  const customerAccountOptions = useMemo(() => customerAccounts.map(c => ({
    value: c.account,
    label: c.title,
    subtitle: c.account
  })), [customerAccounts]);

  const itemOptions = useMemo(() => items.map(i => ({
    value: i.id,
    label: i.title,
    subtitle: i.id
  })), [items]);

  const categoryOptions = useMemo(() => categories.map(c => ({
    value: c.code,
    label: c.title,
    subtitle: c.code
  })), [categories]);

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

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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

          {/* Quick Date Shortcuts */}
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

          {/* Inline Account Statement Detail Account Picker */}
          {(selectedReportId === 'account_statement' || selectedReportId === 'account_statement_due') && (
            <View style={styles.inputGroup}>
              <InlineSearchSelect
                label="Account"
                options={detailAccountOptions}
                value={selectedAccountId}
                onSelect={setSelectedAccountId}
                placeholder="Search & Select Account..."
                icon="wallet-outline"
              />
            </View>
          )}

          {/* Inline Account Balance Report Control Head Picker */}
          {selectedReportId === 'account_balance' && (
            <View style={styles.inputGroup}>
              <InlineSearchSelect
                label="Control Head Account"
                options={controlAccountOptions}
                value={selectedControlAccountId}
                onSelect={setSelectedControlAccountId}
                placeholder="Search & Select Control Head..."
                icon="briefcase-outline"
              />
            </View>
          )}

          {/* Inline Customer Picker */}
          {(selectedReportId === 'customer_bill' ||
            selectedReportId === 'customer_recovery' ||
            selectedReportId === 'profit_by_customer') && (
            <View style={styles.inputGroup}>
              <InlineSearchSelect
                label={selectedReportId === 'customer_bill' ? 'Customer *' : 'Customer (Leave empty for All)'}
                options={customerAccountOptions}
                value={selectedCustomerId}
                onSelect={setSelectedCustomerId}
                placeholder={selectedReportId === 'customer_bill' ? 'Select Customer...' : 'All Customers (Combined)...'}
                icon="person-outline"
                clearable={selectedReportId !== 'customer_bill'}
              />
            </View>
          )}

          {/* Customer Bill Layout */}
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

          {/* Inline Stock Balance / Profit by Item Category Picker */}
          {(selectedReportId === 'stock_balance' || selectedReportId === 'profit_by_item') && (
            <View style={styles.inputGroup}>
              <InlineSearchSelect
                label="Category (Optional)"
                options={categoryOptions}
                value={selectedCategoryCode}
                onSelect={setSelectedCategoryCode}
                placeholder="All Categories..."
                icon="grid-outline"
                clearable
              />
            </View>
          )}

          {/* Inline Item Picker */}
          {(selectedReportId === 'item_ledger' ||
            selectedReportId === 'milk_comparison' ||
            selectedReportId === 'profit_by_item') && (
            <View style={styles.inputGroup}>
              <InlineSearchSelect
                label={selectedReportId === 'item_ledger' ? 'Product Item *' : 'Product Item (Optional)'}
                options={itemOptions}
                value={selectedItemId}
                onSelect={setSelectedItemId}
                placeholder={selectedReportId === 'item_ledger' ? 'Select Product Item...' : 'All Items...'}
                icon="cube-outline"
                clearable={selectedReportId !== 'item_ledger'}
              />
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
            <>
              <View style={styles.switchRow}>
                <Text style={styles.switchTitle}>Show Stock Value</Text>
                <Switch
                  value={showStockValue}
                  onValueChange={setShowStockValue}
                  trackColor={{ false: '#cbd5e1', true: '#818cf8' }}
                  thumbColor={showStockValue ? '#4f46e5' : '#f8fafc'}
                />
              </View>
              <View style={[styles.switchRow, { marginTop: 10 }]}>
                <Text style={styles.switchTitle}>Low Stock Only</Text>
                <Switch
                  value={lowStockOnly}
                  onValueChange={setLowStockOnly}
                  trackColor={{ false: '#cbd5e1', true: '#f59e0b' }}
                  thumbColor={lowStockOnly ? '#d97706' : '#f8fafc'}
                />
              </View>
            </>
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

            {(activeDataView === 'profit_by_customer' || activeDataView === 'profit_by_item') && reportData && (
              <View>
                <View style={styles.metricGrid}>
                  <View style={[styles.metricBox, { backgroundColor: '#eef2ff' }]}>
                    <Text style={styles.metricLabel}>Total Sales</Text>
                    <Text style={[styles.metricValue, { color: '#4338ca' }]}>
                      Rs. {(reportData.totalSales || 0).toLocaleString()}
                    </Text>
                  </View>
                  <View style={[styles.metricBox, { backgroundColor: '#fef2f2' }]}>
                    <Text style={styles.metricLabel}>Total Cost</Text>
                    <Text style={[styles.metricValue, { color: '#b91c1c' }]}>
                      Rs. {(reportData.totalCost || 0).toLocaleString()}
                    </Text>
                  </View>
                  <View style={[styles.metricBox, { backgroundColor: '#ecfdf5' }]}>
                    <Text style={styles.metricLabel}>Gross Profit</Text>
                    <Text style={[styles.metricValue, { color: '#047857' }]}>
                      Rs. {(reportData.grossProfit || 0).toLocaleString()}
                    </Text>
                  </View>
                  <View style={[styles.metricBox, { backgroundColor: '#f0fdf4' }]}>
                    <Text style={styles.metricLabel}>Gross Margin</Text>
                    <Text style={[styles.metricValue, { color: '#15803d' }]}>
                      {(reportData.grossMarginPct || 0).toFixed(1)}%
                    </Text>
                  </View>
                </View>

                {Array.isArray(reportData.lines) && reportData.lines.length > 0 && (
                  <>
                    <Text style={[styles.inputLabel, { marginTop: 12, marginBottom: 6 }]}>
                      Top Breakdown ({reportData.lines.length} rows)
                    </Text>
                    {reportData.lines.slice(0, 10).map((row: ProfitByCustomerLine & ProfitByItemLine, idx: number) => (
                      <View key={idx} style={styles.lineItemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.lineParticular} numberOfLines={1}>
                            {row.accountTitle || row.itemTitle}
                          </Text>
                          <Text style={styles.lineSub}>
                            Sales: Rs. {(row.totalSales || 0).toLocaleString()} • Cost: Rs. {(row.totalCost || 0).toLocaleString()}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: (row.grossProfit || 0) >= 0 ? '#047857' : '#b91c1c', fontWeight: '700', fontSize: 13 }}>
                            Rs. {(row.grossProfit || 0).toLocaleString()}
                          </Text>
                          <Text style={styles.lineSub}>{(row.grossMarginPct || 0).toFixed(1)}%</Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}
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
                      {reportData.summary.totalPurchaseQty.toLocaleString()}
                    </Text>
                  </View>
                  <View style={[styles.metricBox, { backgroundColor: '#f0fdf4' }]}>
                    <Text style={styles.metricLabel}>Dispatched</Text>
                    <Text style={[styles.metricValue, { color: '#15803d' }]}>
                      {reportData.summary.totalDispatchedQty.toLocaleString()}
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
});
