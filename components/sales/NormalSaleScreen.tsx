import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { KeyboardAwareContainer } from '../ui/KeyboardAwareContainer';
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
import { saleService, SaleLineRequest } from '../../services/saleService';
import {
  chartOfAccountService,
  ChartOfAccountHeadDto,
} from '../../services/chartOfAccountService';
import { narrationService, NarrationDto } from '../../services/narrationService';
import {
  inventoryService,
  Item,
  Unit,
  ItemCustomerCategoryPriceDto,
} from '../../services/inventoryService';
import {
  customerCategoryService,
  CustomerCategoryLookupResponse,
} from '../../services/customerCategoryService';
import {
  itemCategoryService,
  ItemCategoryDto,
} from '../../services/itemCategoryService';
import { useAppStore } from '../../store/appStore';
import {
  MobileSaleReceiptModal,
  type MobileSaleReceiptData,
  type MobileSaleReceiptLine,
} from './MobileSaleReceiptModal';
import { InlineSearchSelect, InlineSelectOption } from '../ui/InlineSearchSelect';
import { FastItemEntryBar } from '../ui/FastItemEntryBar';
import {
  MobileMultiPaymentSection,
  PaymentSplitRow,
} from '../ui/MobileMultiPaymentSection';
import { CustomerPriceHistorySheet } from './CustomerPriceHistorySheet';
import { useKeyboard } from '../../hooks/useKeyboard';
import {
  getSelectablePrimaryUnits,
  resolveDisplayQtyAndUnit,
  toBasePrimaryQty,
} from '../../utils/unitConversion';

interface EditableSaleLine extends SaleLineRequest {
  displayQty?: number;
  selectedUnitId?: string;
  unitFactor?: number;
  discPct?: number;
  showExtras?: boolean;
  showHistory?: boolean;
}

export function NormalSaleScreen() {
  const { voucherNo, mode } = useLocalSearchParams<{ voucherNo: string; mode?: string }>();
  const router = useRouter();
  const isEdit = Boolean(voucherNo && voucherNo !== 'new' && mode !== 'copy');

  const { currentTenantIdentifier, licenses } = useAppStore();
  const currentOrg = licenses.find((l) => l.tenantIdentifier === currentTenantIdentifier);
  const hasSecondaryQty = currentOrg?.hasSecondaryQty ?? false;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Lookups
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [categoryPrices, setCategoryPrices] = useState<ItemCustomerCategoryPriceDto[]>([]);
  const [customerCategories, setCustomerCategories] = useState<CustomerCategoryLookupResponse[]>([]);
  const [itemCategories, setItemCategories] = useState<ItemCategoryDto[]>([]);

  // Header & Mode State
  const [headerExpanded, setHeaderExpanded] = useState(true);
  const [entryMode, setEntryMode] = useState<'list' | 'grid'>('list');

  // Form State
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customerAccount, setCustomerAccount] = useState('');
  const [narration, setNarration] = useState('');
  const [description, setDescription] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const { keyboardHeight, isKeyboardVisible } = useKeyboard();

  // Lines & Multi-Payment State
  const [lines, setLines] = useState<EditableSaleLine[]>([]);
  const [payments, setPayments] = useState<PaymentSplitRow[]>([]);
  const [legacyCashReceipt, setLegacyCashReceipt] = useState<number>(0);

  // Receipt Modal State
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [activeReceiptData, setActiveReceiptData] = useState<MobileSaleReceiptData | null>(null);
  const justSavedRef = useRef(false);

  useEffect(() => {
    fetchLookups();
  }, []);

  const fetchLookups = async () => {
    try {
      const [custs, narrs, itms, unts, catPrices, custCats, itmCats] = await Promise.all([
        chartOfAccountService.getCustomerAccounts(),
        narrationService.getActiveNarrationsLookup(),
        inventoryService.getItemsLookup(),
        inventoryService.getUnits(),
        inventoryService.getCustomerCategoryPrices().catch(() => []),
        customerCategoryService.getLookup().catch(() => []),
        itemCategoryService.getActiveItemCategoriesLookup().catch(() => []),
      ]);
      const safeCusts = custs || [];
      const itmCatMap = new Map<string, string>((itmCats || []).map((c) => [c.code, c.title]));
      const safeItems = (itms || []).map((i) => ({
        ...i,
        itemCategoryTitle: i.itemCategoryTitle || itmCatMap.get(i.itemCategoryCode) || i.itemCategoryCode,
      }));
      const safeUnits = unts || [];
      setCustomers(safeCusts);
      setNarrations(narrs || []);
      setItems(safeItems);
      setUnits(safeUnits);
      setCategoryPrices(catPrices || []);
      setCustomerCategories(custCats || []);
      setItemCategories(itmCats || []);

      if (voucherNo && voucherNo !== 'new') {
        await loadVoucherDetails(safeItems, safeUnits);
      } else {
        // Default walk-in customer if available
        const walkIn =
          safeCusts.find((c) => c.title.toLowerCase().includes('walk')) ||
          safeCusts.find((c) => c.title.toLowerCase().includes('cash')) ||
          safeCusts[0];
        if (walkIn) {
          setCustomerAccount(walkIn.account);
        }
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching lookups', error);
      Alert.alert('Error', 'Failed to load form data.');
      setLoading(false);
    }
  };

  const loadVoucherDetails = async (loadedItems: Item[], loadedUnits: Unit[]) => {
    try {
      const [details, savedPayments] = await Promise.all([
        saleService.getDetail(voucherNo!),
        mode === 'copy' ? Promise.resolve([]) : saleService.getPayments(voucherNo!).catch(() => []),
      ]);
      if (details && details.length > 0) {
        const first = details[0];
        setDate(mode === 'copy' ? new Date() : new Date(first.date));
        setCustomerAccount(first.accountId);
        setNarration(first.narrationId || first.narration || '');
        setDescription(first.description || '');
        setHeaderExpanded(false);

        if (savedPayments && savedPayments.length > 0) {
          setPayments(
            savedPayments.map((p) => ({
              accountId: p.accountId,
              amount: p.amount,
              reference: p.reference,
              checkNum: p.checkNum,
              checkDate: p.checkDate,
            }))
          );
        } else if (first.cashReceipt !== undefined && first.cashReceipt !== null) {
          setLegacyCashReceipt(Number(first.cashReceipt) || 0);
        }

        const mappedLines: EditableSaleLine[] = details.map((d) => {
          const itemObj = loadedItems.find(
            (i) => String(i.id).trim().toLowerCase() === String(d.itemId).trim().toLowerCase()
          );
          const resolved = resolveDisplayQtyAndUnit(d.qty, itemObj, loadedUnits, d.unit);
          const hasSec = Boolean(Number(d.secQty || 0) > 0 || d.secUnit || itemObj?.secondaryUnit);
          return {
            seq: d.seq,
            itemId: d.itemId,
            unit: resolved.unitId || d.unit || itemObj?.primaryUnit || '',
            qty: d.qty,
            displayQty: resolved.displayQty,
            selectedUnitId: resolved.selectedUnitId,
            unitFactor: resolved.factor,
            rate: d.rate,
            discount: d.discount || 0,
            carriage: d.carriage || 0,
            secQty: d.secQty || 0,
            secRate: d.secRate || 0,
            secUnit: d.secUnit || itemObj?.secondaryUnit || '',
            showExtras: Boolean((d.discount || 0) > 0 || (d.carriage || 0) > 0 || hasSec),
          };
        });
        setLines(mappedLines);
      }
    } catch (error) {
      console.error('Failed to load sale details', error);
      Alert.alert('Error', 'Failed to load sale details.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  // Resolve Customer Category Custom Price -> Item Default Price
  const resolveItemRates = useCallback(
    (item: Item, targetCustomerAccount?: string): { priRate: number; secRate: number } => {
      const accId = targetCustomerAccount ?? customerAccount;
      const cust = customers.find((c) => c.account === accId);
      const custCatId = cust?.customerCategoryId;

      if (custCatId && categoryPrices.length > 0) {
        const match = categoryPrices.find(
          (cp) =>
            String(cp.itemId) === String(item.id) &&
            String(cp.customerCategoryId) === String(custCatId)
        );
        if (match) {
          const pri = match.priRate > 0 ? match.priRate : item.priRate || 0;
          const pSize = Number(item.qtyInPack || 0);
          const sec =
            match.secRate > 0
              ? match.secRate
              : item.secRate || pri * (pSize > 0 ? pSize : 1);
          return { priRate: pri, secRate: sec };
        }
      }

      const pri = item.priRate || 0;
      const pSize = Number(item.qtyInPack || 0);
      const sec = item.secRate || pri * (pSize > 0 ? pSize : 1);
      return { priRate: pri, secRate: sec };
    },
    [customerAccount, customers, categoryPrices]
  );

  // When customer changes, re-evaluate category rates on existing lines
  const handleSelectCustomer = (newAccount: string) => {
    setCustomerAccount(newAccount);
    if (lines.length > 0) {
      setLines((prev) =>
        prev.map((line) => {
          const itemObj = items.find((i) => String(i.id) === String(line.itemId));
          if (!itemObj) return line;
          const { priRate, secRate } = resolveItemRates(itemObj, newAccount);
          return {
            ...line,
            rate: priRate,
            secRate,
          };
        })
      );
    }
  };

  // Add or increment item directly inline (Zero Modal!)
  const handleFastAddItem = (
    item: Item,
    addedQty: number = 1,
    customRate?: number,
    customAmount?: number
  ) => {
    const { priRate, secRate } = resolveItemRates(item);
    const effectiveRate = customRate !== undefined ? customRate : priRate;

    setLines((prev) => {
      const existingIndex = prev.findIndex(
        (l) => String(l.itemId).trim().toLowerCase() === String(item.id).trim().toLowerCase()
      );
      if (existingIndex >= 0) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const factor = existing.unitFactor || 1;
        const newBaseQty = Number((Number(existing.qty || 0) + Number(addedQty || 1)).toFixed(4));
        const newDisplayQty =
          factor > 1 ? Number((newBaseQty * factor).toFixed(3)) : newBaseQty;
        updated[existingIndex] = {
          ...existing,
          qty: newBaseQty,
          displayQty: newDisplayQty,
        };
        return updated;
      }

      const maxSeq = prev.reduce((max, l) => Math.max(max, l.seq || 0), 0);
      const resolved = resolveDisplayQtyAndUnit(addedQty, item, units);
      return [
        {
          seq: maxSeq + 1,
          itemId: item.id,
          unit: item.defaultUnit || item.primaryUnit || '',
          qty: addedQty,
          displayQty: resolved.displayQty,
          selectedUnitId: resolved.selectedUnitId,
          unitFactor: resolved.factor,
          rate: effectiveRate,
          discount: 0,
          carriage: 0,
          secUnit: item.secondaryUnit || '',
          secQty: 0,
          secRate,
          showExtras: false,
        },
        ...prev,
      ];
    });
  };

  const handleDecrementItemFromGrid = (itemId: string) => {
    setLines((prev) => {
      const idx = prev.findIndex((l) => String(l.itemId) === String(itemId));
      if (idx < 0) return prev;
      const line = prev[idx];
      if (line.qty <= 1) {
        return prev.filter((_, i) => i !== idx);
      }
      const next = [...prev];
      const newQty = Number((line.qty - 1).toFixed(4));
      const factor = line.unitFactor || 1;
      next[idx] = {
        ...line,
        qty: newQty,
        displayQty: factor > 1 ? Number((newQty * factor).toFixed(3)) : newQty,
      };
      return next;
    });
  };

  const updateLine = (seq: number, patch: Partial<EditableSaleLine>) => {
    setLines((prev) =>
      prev.map((l) => (l.seq === seq ? { ...l, ...patch } : l))
    );
  };

  // Handle display quantity change (converting sub-unit -> base primary unit)
  const handleLineQtyChange = (line: EditableSaleLine, rawText: string) => {
    const entered = parseFloat(rawText);
    const num = isNaN(entered) ? 0 : entered;
    const factor = line.unitFactor || 1;
    const baseQty = toBasePrimaryQty(num, factor);
    updateLine(line.seq, {
      displayQty: num,
      qty: baseQty,
    });
  };

  // Stepper +/- on line card
  const handleStepLineQty = (line: EditableSaleLine, delta: number) => {
    const factor = line.unitFactor || 1;
    const step = factor > 1 ? 50 : 1; // e.g., +50g when in grams, +1 when in primary unit
    const currentDisp = line.displayQty ?? line.qty ?? 0;
    const nextDisp = Math.max(0, Number((currentDisp + delta * step).toFixed(3)));
    const nextBase = toBasePrimaryQty(nextDisp, factor);
    updateLine(line.seq, {
      displayQty: nextDisp,
      qty: nextBase,
    });
  };

  // Switch between Primary Unit (e.g. kg) and Sub-Unit (e.g. g) inline
  const handleSwitchLineUnit = (line: EditableSaleLine, item?: Item) => {
    const selectable = getSelectablePrimaryUnits(item, units);
    if (selectable.length <= 1) return;
    const currentIdx = selectable.findIndex((u) => u.unitId === line.selectedUnitId);
    const nextOpt = selectable[(currentIdx + 1) % selectable.length];
    const currentDisp = line.displayQty ?? line.qty ?? 0;
    // Keep the entered number or convert baseQty cleanly:
    const newBaseQty = toBasePrimaryQty(currentDisp, nextOpt.factor);
    updateLine(line.seq, {
      unit: nextOpt.unitId,
      selectedUnitId: nextOpt.unitId,
      unitFactor: nextOpt.factor,
      qty: newBaseQty,
      displayQty: currentDisp,
    });
  };

  // Bidirectional Amount -> Qty calculation (e.g. user enters Rs. 200 -> calculates Qty = 200 / rate)
  const handleLineAmountChange = (line: EditableSaleLine, rawAmountText: string, item?: Item) => {
    const targetNet = parseFloat(rawAmountText);
    if (isNaN(targetNet) || targetNet < 0) return;
    const rate = Number(line.rate) || 0;
    if (rate <= 0) return;

    const secAmt = (line.secQty || 0) * (line.secRate || 0);
    const targetPrimaryGross = Math.max(
      0,
      targetNet + (line.discount || 0) - (line.carriage || 0) - secAmt
    );
    const newBaseQty = Number((targetPrimaryGross / rate).toFixed(4));
    const resolved = resolveDisplayQtyAndUnit(newBaseQty, item, units, line.unit);
    updateLine(line.seq, {
      qty: newBaseQty,
      displayQty: resolved.displayQty,
      selectedUnitId: resolved.selectedUnitId,
      unitFactor: resolved.factor,
    });
  };

  const removeLine = async (seq: number) => {
    if (isEdit) {
      try {
        await saleService.deleteLine(voucherNo!, seq);
      } catch {
        Alert.alert('Error', 'Failed to delete line from database.');
        return;
      }
    }
    setLines((prev) => prev.filter((l) => l.seq !== seq));
  };

  // Cart Qty Map for POS Grid badge
  const cartQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of lines) {
      map[l.itemId] = Number(((map[l.itemId] || 0) + (l.qty || 0)).toFixed(3));
    }
    return map;
  }, [lines]);

  // Totals calculations
  const totalQty = useMemo(
    () => lines.reduce((sum, l) => sum + (l.qty || 0), 0),
    [lines]
  );

  const grossAmount = useMemo(
    () =>
      lines.reduce(
        (sum, l) =>
          sum + ((l.qty || 0) * (l.rate || 0) + (l.secQty || 0) * (l.secRate || 0)),
        0
      ),
    [lines]
  );

  const totalDiscount = useMemo(
    () => lines.reduce((sum, l) => sum + (l.discount || 0), 0),
    [lines]
  );

  const totalCarriage = useMemo(
    () => lines.reduce((sum, l) => sum + (l.carriage || 0), 0),
    [lines]
  );

  const netAmount = useMemo(
    () =>
      Math.round(
        lines.reduce((sum, l) => {
          const lineGross =
            (l.qty || 0) * (l.rate || 0) + (l.secQty || 0) * (l.secRate || 0);
          return sum + (lineGross - (l.discount || 0) + (l.carriage || 0));
        }, 0) * 100
      ) / 100,
    [lines]
  );

  const totalReceived = useMemo(
    () => payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [payments]
  );
  const cashBackAmount = Math.max(0, Math.round((totalReceived - netAmount) * 100) / 100);

  const getUnitTitle = (codeOrTitle?: string | null, item?: Item | null) => {
    if (!codeOrTitle && !item) return '';
    const clean = String(codeOrTitle || '').trim();
    if (clean) {
      const u = units.find(
        (x) =>
          x.code?.toLowerCase() === clean.toLowerCase() ||
          x.title?.toLowerCase() === clean.toLowerCase()
      );
      if (u) return (u.shortTitle && u.shortTitle.trim()) || u.title;
    }
    if (item) {
      if (item.primaryUnitTitle) return item.primaryUnitTitle;
      if (item.defaultUnitTitle) return item.defaultUnitTitle;
    }
    if (/^\d+$/.test(clean)) return '';
    return clean;
  };

  const buildReceiptData = (
    voucherNum?: string,
    isReprint: boolean = false
  ): MobileSaleReceiptData | null => {
    if (lines.length === 0) return null;
    const customer = customers.find((c) => c.account === customerAccount);
    const narr = narrations.find((n) => n.code === narration);

    const receiptLines: MobileSaleReceiptLine[] = lines.map((l, idx) => {
      const itm = items.find((i) => String(i.id) === String(l.itemId));
      const q = Number(l.qty) || 0;
      const r = Number(l.rate) || 0;
      const d = Number(l.discount) || 0;
      const resolvedUnit =
        itm?.itemType === 'Service' ? '' : getUnitTitle(l.unit, itm) || '';
      return {
        seq: l.seq || idx + 1,
        itemTitle: itm?.title || `Item #${l.itemId}`,
        qty: q,
        unit: resolvedUnit,
        rate: r,
        discount: d,
        amount: q * r - d + (Number(l.carriage) || 0),
      };
    });

    return {
      voucherNo: voucherNum || (isEdit ? `SL-${voucherNo}` : 'DRAFT'),
      date: date || new Date(),
      customerName: customer?.title || customerAccount || 'Walk-in Customer',
      customerPhone: (customer as any)?.phone,
      narration: narr?.title || narration,
      description,
      lines: receiptLines,
      grossTotal: grossAmount,
      totalDiscount,
      netAmount,
      cashReceived: totalReceived,
      cashBack: cashBackAmount,
      balance: Math.max(0, netAmount - totalReceived),
      orgName: currentOrg?.name,
      isDuplicate: Boolean(isReprint || isEdit),
    };
  };

  const handleSaveVoucher = async (shouldShowReceipt: boolean = true) => {
    if (!customerAccount || !date) {
      Alert.alert('Validation Error', 'Date and Customer Account are required.');
      return;
    }
    if (lines.length === 0) {
      Alert.alert('Validation Error', 'At least one item is required.');
      return;
    }
    const invalidLine = lines.find((l) => !l.itemId || (l.qty || 0) <= 0);
    if (invalidLine) {
      Alert.alert('Validation Error', 'All items must have a quantity greater than 0.');
      return;
    }

    setSaving(true);
    try {
      const cleanedLines: SaleLineRequest[] = lines.map((l, idx) => ({
        seq: idx + 1,
        itemId: l.itemId,
        unit: l.selectedUnitId || l.unit || undefined,
        qty: Number(l.qty) || 0,
        rate: Number(l.rate) || 0,
        discount: Number(l.discount) || 0,
        carriage: Number(l.carriage) || 0,
        secQty: Number(l.secQty) || 0,
        secRate: Number(l.secRate) || 0,
        secUnit: Number(l.secQty) > 0 && l.secUnit ? l.secUnit : undefined,
      }));

      const validPayments = payments
        .filter((p) => p.accountId && Number(p.amount) > 0)
        .map((p, idx) => ({
          seq: idx + 1,
          accountId: p.accountId,
          amount: Number(p.amount),
          reference: p.reference || undefined,
          checkNum: p.checkNum || undefined,
          checkDate: p.checkDate || undefined,
        }));

      const request = {
        date: dayjs(date).format('YYYY-MM-DD'),
        account: customerAccount,
        narration: narration || undefined,
        description: description || undefined,
        cashReceipt: totalReceived,
        cashBack: cashBackAmount,
        lines: cleanedLines,
        payments: validPayments,
      };

      if (isEdit) {
        await saleService.update(voucherNo!, request);
        if (shouldShowReceipt) {
          const receipt = buildReceiptData(`SL-${voucherNo}`, true);
          justSavedRef.current = true;
          setActiveReceiptData(receipt);
          setReceiptModalVisible(true);
        } else {
          Alert.alert('Success', 'Sale voucher updated.', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        }
      } else {
        const createdVoucher = await saleService.create(request);
        if (shouldShowReceipt) {
          const receipt = buildReceiptData(`SL-${createdVoucher}`, false);
          justSavedRef.current = true;
          setActiveReceiptData(receipt);
          setReceiptModalVisible(true);
        } else {
          Alert.alert('Success', 'Sale voucher created.', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        }
      }
    } catch (error: any) {
      Alert.alert('Error', extractErrorMessage(error, 'Failed to save sale.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVoucher = () => {
    Alert.alert('Delete Sale', 'Are you sure you want to delete this sale voucher?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await saleService.delete(voucherNo!);
            Alert.alert('Success', 'Sale deleted.', [
              { text: 'OK', onPress: () => router.back() },
            ]);
          } catch {
            Alert.alert('Error', 'Failed to delete sale.');
            setSaving(false);
          }
        },
      },
    ]);
  };

  const handleCopyAsNew = () => {
    Alert.alert('Copy as New', 'Duplicate this sale voucher as a new entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Copy',
        onPress: () => {
          setDate(new Date());
          router.replace({
            pathname: '/sales/[voucherNo]' as any,
            params: { voucherNo, mode: 'copy' },
          });
        },
      },
    ]);
  };

  const customerCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of customerCategories) {
      map.set(c.code, c.title);
    }
    for (const cp of categoryPrices) {
      if (cp.customerCategoryId && cp.customerCategoryTitle && !map.has(cp.customerCategoryId)) {
        map.set(cp.customerCategoryId, cp.customerCategoryTitle);
      }
    }
    return map;
  }, [customerCategories, categoryPrices]);

  const itemCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of itemCategories) {
      map.set(c.code, c.title);
    }
    return map;
  }, [itemCategories]);

  const customerOptions: InlineSelectOption[] = useMemo(
    () =>
      customers.map((c) => {
        const catTitle = c.customerCategoryTitle || (c.customerCategoryId ? customerCategoryMap.get(c.customerCategoryId) : undefined);
        return {
          id: c.account,
          title: c.title,
          subtitle: `Acc: ${c.account}${c.parentCustomerTitle ? ` • Main: ${c.parentCustomerTitle}` : ''}`,
          badge: catTitle ? `Cat: ${catTitle}` : c.customerCategoryId ? `Cat: ${c.customerCategoryId}` : undefined,
        };
      }),
    [customers, customerCategoryMap]
  );

  const narrationOptions: InlineSelectOption[] = useMemo(
    () =>
      narrations.map((n) => ({
        id: n.code,
        title: n.title,
      })),
    [narrations]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  const selectedCustomerObj = customers.find((c) => c.account === customerAccount);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAwareContainer
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        style={styles.container}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: isKeyboardVisible ? 24 : 40 },
          ]}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Compact Collapsible Master Header */}
          <View style={styles.masterCard}>
            <TouchableOpacity
              style={styles.masterSummaryBar}
              onPress={() => setHeaderExpanded((prev) => !prev)}
              activeOpacity={0.75}
            >
              <View style={styles.masterSummaryLeft}>
                <View style={styles.voucherBadge}>
                  <Text style={styles.voucherBadgeText}>
                    {isEdit
                      ? `SL-${String(voucherNo).padStart(5, '0')}`
                      : mode === 'copy'
                      ? 'COPY'
                      : 'NEW SALE'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.dateChip}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={13} color={Theme.colors.primary} />
                  <Text style={styles.dateChipText}>{dayjs(date).format('DD MMM YY')}</Text>
                </TouchableOpacity>
                <Text style={styles.customerSummaryTitle} numberOfLines={1}>
                  {selectedCustomerObj?.title || 'Select Customer *'}
                </Text>
              </View>
              <Ionicons
                name={headerExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={Theme.colors.textSecondary}
              />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) setDate(selectedDate);
                }}
              />
            )}

            {headerExpanded && (
              <View style={styles.masterExpandedBody}>
                <InlineSearchSelect
                  label="Customer Account *"
                  placeholder="Search Customer by name or code..."
                  value={customerAccount}
                  options={customerOptions}
                  onSelect={(id) => handleSelectCustomer(id)}
                  compact
                  rightAccessory={
                    <TouchableOpacity
                      style={styles.notesToggleLink}
                      onPress={() => setNotesExpanded((prev) => !prev)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text
                        style={[
                          styles.notesToggleLinkText,
                          (notesExpanded || Boolean(narration || description)) &&
                            styles.notesToggleLinkTextActive,
                        ]}
                      >
                        {notesExpanded || Boolean(narration || description)
                          ? 'Notes / Ref'
                          : '+ Notes & Narration'}
                      </Text>
                      <Ionicons
                        name={
                          notesExpanded || Boolean(narration || description)
                            ? 'chevron-up'
                            : 'chevron-down'
                        }
                        size={14}
                        color={Theme.colors.primary}
                      />
                    </TouchableOpacity>
                  }
                />

                {(notesExpanded || Boolean(narration || description)) && (
                  <View style={styles.rowGap}>
                    <View style={{ flex: 1 }}>
                      <InlineSearchSelect
                        label="Narration"
                        placeholder="Select or type narration..."
                        value={narration}
                        options={narrationOptions}
                        onSelect={(id) => setNarration(id)}
                        allowClear
                        allowCustomText
                        compact
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.compactLabel}>Notes / Ref</Text>
                      <TextInput
                        style={styles.compactTextInput}
                        placeholder="Delivery notes..."
                        placeholderTextColor={Theme.colors.textSecondary}
                        value={description}
                        onChangeText={setDescription}
                      />
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Fast Item Search / Barcode / POS Grid Entry Bar */}
          <FastItemEntryBar
            items={items}
            categoryMap={itemCategoryMap}
            mode={entryMode}
            onModeChange={setEntryMode}
            onAddItem={handleFastAddItem}
            onDecrementItem={handleDecrementItemFromGrid}
            resolveItemRate={(itm) => resolveItemRates(itm).priRate}
            cartQtyMap={cartQtyMap}
          />

          {/* Inline Editable Line Cards (Zero Modals!) */}
          <View style={styles.linesSection}>
            <View style={styles.linesHeaderRow}>
              <Text style={styles.linesSectionTitle}>
                Bill Items ({lines.length})
              </Text>
              {lines.length > 0 && (
                <Text style={styles.linesTotalBadge}>
                  Qty: {totalQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}  •  Net: Rs.{' '}
                  {netAmount.toLocaleString()}
                </Text>
              )}
            </View>

            {lines.length === 0 ? (
              <View style={styles.emptyCartBox}>
                <Ionicons name="cart-outline" size={32} color={Theme.colors.border} />
                <Text style={styles.emptyCartText}>
                  Type or scan above, or switch to Grid view to tap products.
                </Text>
              </View>
            ) : (
              lines.map((line) => {
                const itemObj = items.find((i) => String(i.id) === String(line.itemId));
                const selectableUnits = getSelectablePrimaryUnits(itemObj, units);
                const activeUnitOpt =
                  selectableUnits.find((u) => u.unitId === line.selectedUnitId) ||
                  selectableUnits[0];
                const unitLabel =
                  activeUnitOpt?.shortLabel || getUnitTitle(line.unit, itemObj) || 'Unit';

                const lineGross =
                  (line.qty || 0) * (line.rate || 0) +
                  (line.secQty || 0) * (line.secRate || 0);
                const lineNet =
                  Math.round(
                    (lineGross - (line.discount || 0) + (line.carriage || 0)) * 100
                  ) / 100;

                const minPrice = Number(itemObj?.minSalePrice || 0);
                const isBelowMin = minPrice > 0 && Number(line.rate || 0) < minPrice;

                const dispQty = line.displayQty ?? line.qty ?? 0;
                const showSecQty = Boolean(
                  hasSecondaryQty ||
                  line.secUnit ||
                  itemObj?.secondaryUnit ||
                  Number(line.secQty || 0) > 0
                );

                return (
                  <View key={line.seq} style={styles.lineCard}>
                    {/* Row 1: Item Title + Price History + Extras Toggle + Delete */}
                    <View style={styles.lineTopRow}>
                      <View style={{ flex: 1, marginRight: 6 }}>
                        <Text style={styles.lineItemTitle} numberOfLines={1}>
                          {itemObj?.title || `Item #${line.itemId}`}
                        </Text>
                        {(line.unitFactor || 1) > 1 && (
                          <Text style={styles.subUnitConversionHint}>
                            = {line.qty} {getUnitTitle(itemObj?.primaryUnit, itemObj)}
                          </Text>
                        )}
                      </View>

                      <View style={styles.lineTopIcons}>
                        {!!customerAccount && (
                          <TouchableOpacity
                            style={[
                              styles.iconPillBtn,
                              line.showHistory && styles.iconPillBtnActive,
                            ]}
                            onPress={() =>
                              updateLine(line.seq, { showHistory: !line.showHistory })
                            }
                          >
                            <Ionicons
                              name="time-outline"
                              size={15}
                              color={
                                line.showHistory
                                  ? '#FFFFFF'
                                  : Theme.colors.primary
                              }
                            />
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          style={[
                            styles.iconPillBtn,
                            line.showExtras && styles.iconPillBtnActive,
                          ]}
                          onPress={() =>
                            updateLine(line.seq, { showExtras: !line.showExtras })
                          }
                        >
                          <Text
                            style={[
                              styles.discToggleText,
                              line.showExtras && { color: '#FFFFFF' },
                            ]}
                          >
                            {line.showExtras ? 'Close' : showSecQty ? '% Disc / Sec' : '% Disc'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.deleteLineBtn}
                          onPress={() => removeLine(line.seq)}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={16}
                            color={Theme.colors.danger}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Row 2: Direct Inline Controls: [- Qty +] [Unit Pill] × [Rate] = [Amount] */}
                    <View style={styles.inlineInputsRow}>
                      {/* Stepper + Qty Input */}
                      <View style={styles.qtyStepperBox}>
                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => handleStepLineQty(line, -1)}
                        >
                          <Ionicons name="remove" size={14} color={Theme.colors.text} />
                        </TouchableOpacity>

                        <TextInput
                          style={styles.qtyInput}
                          keyboardType="numeric"
                          selectTextOnFocus
                          value={dispQty === 0 ? '' : String(dispQty)}
                          placeholder="0"
                          onChangeText={(txt) => handleLineQtyChange(line, txt)}
                        />

                        <TouchableOpacity
                          style={styles.stepBtn}
                          onPress={() => handleStepLineQty(line, 1)}
                        >
                          <Ionicons name="add" size={14} color={Theme.colors.primary} />
                        </TouchableOpacity>
                      </View>

                      {/* Unit / Sub-Unit Switcher Pill */}
                      <TouchableOpacity
                        style={[
                          styles.unitPill,
                          selectableUnits.length > 1 && styles.unitPillSwitchable,
                        ]}
                        disabled={selectableUnits.length <= 1}
                        onPress={() => handleSwitchLineUnit(line, itemObj)}
                      >
                        <Text style={styles.unitPillText}>{unitLabel}</Text>
                        {selectableUnits.length > 1 && (
                          <Ionicons
                            name="swap-vertical"
                            size={11}
                            color={Theme.colors.primary}
                          />
                        )}
                      </TouchableOpacity>

                      {/* Rate Input */}
                      <View
                        style={[
                          styles.inlineFieldBox,
                          isBelowMin && styles.inlineFieldWarning,
                        ]}
                      >
                        <Text style={styles.miniFieldLabel}>Rate</Text>
                        <TextInput
                          style={styles.inlineNumericInput}
                          keyboardType="numeric"
                          selectTextOnFocus
                          value={line.rate === 0 ? '' : String(line.rate)}
                          placeholder="0"
                          onChangeText={(txt) => {
                            const r = parseFloat(txt);
                            updateLine(line.seq, { rate: isNaN(r) ? 0 : r });
                          }}
                        />
                      </View>

                      {/* Bidirectional Net Amount Input */}
                      <View style={styles.inlineAmountBox}>
                        <Text style={styles.miniFieldLabel}>Amount</Text>
                        <TextInput
                          style={styles.inlineAmountInput}
                          keyboardType="numeric"
                          selectTextOnFocus
                          value={lineNet === 0 ? '' : String(lineNet)}
                          placeholder="0"
                          onChangeText={(txt) =>
                            handleLineAmountChange(line, txt, itemObj)
                          }
                        />
                      </View>
                    </View>

                    {isBelowMin && (
                      <Text style={styles.minPriceWarningText}>
                        ⚠️ Below Min Sale Price (Rs. {minPrice})
                      </Text>
                    )}

                    {/* Expandable Extras: Discount Rs, Discount %, Carriage, Secondary Qty */}
                    {line.showExtras && (
                      <View style={styles.extrasRow}>
                        <View style={styles.extraField}>
                          <Text style={styles.extraLabel}>Disc (Rs.)</Text>
                          <TextInput
                            style={styles.extraInput}
                            keyboardType="numeric"
                            placeholder="0"
                            value={line.discount ? String(line.discount) : ''}
                            onChangeText={(txt) => {
                              const d = parseFloat(txt) || 0;
                              const pct =
                                lineGross > 0
                                  ? Number(((d / lineGross) * 100).toFixed(2))
                                  : 0;
                              updateLine(line.seq, { discount: d, discPct: pct });
                            }}
                          />
                        </View>

                        <View style={styles.extraField}>
                          <Text style={styles.extraLabel}>Disc %</Text>
                          <TextInput
                            style={styles.extraInput}
                            keyboardType="numeric"
                            placeholder="0%"
                            value={line.discPct ? String(line.discPct) : ''}
                            onChangeText={(txt) => {
                              const pct = parseFloat(txt) || 0;
                              const d = Number(((lineGross * pct) / 100).toFixed(2));
                              updateLine(line.seq, { discPct: pct, discount: d });
                            }}
                          />
                        </View>

                        <View style={styles.extraField}>
                          <Text style={styles.extraLabel}>Carriage</Text>
                          <TextInput
                            style={styles.extraInput}
                            keyboardType="numeric"
                            placeholder="0"
                            value={line.carriage ? String(line.carriage) : ''}
                            onChangeText={(txt) =>
                              updateLine(line.seq, {
                                carriage: parseFloat(txt) || 0,
                              })
                            }
                          />
                        </View>

                        {showSecQty && (
                          <>
                            <View style={styles.extraField}>
                              <Text style={styles.extraLabel}>
                                Sec Qty ({getUnitTitle(line.secUnit || itemObj?.secondaryUnit, itemObj) || 'Pack'})
                              </Text>
                              <TextInput
                                style={styles.extraInput}
                                keyboardType="numeric"
                                placeholder="0"
                                value={line.secQty ? String(line.secQty) : ''}
                                onChangeText={(txt) =>
                                  updateLine(line.seq, {
                                    secQty: parseFloat(txt) || 0,
                                  })
                                }
                              />
                            </View>
                            <View style={styles.extraField}>
                              <Text style={styles.extraLabel}>Sec Rate</Text>
                              <TextInput
                                style={styles.extraInput}
                                keyboardType="numeric"
                                placeholder="0"
                                value={line.secRate ? String(line.secRate) : ''}
                                onChangeText={(txt) =>
                                  updateLine(line.seq, {
                                    secRate: parseFloat(txt) || 0,
                                  })
                                }
                              />
                            </View>
                          </>
                        )}
                      </View>
                    )}

                    {/* Inline Customer Price History Lookup */}
                    {line.showHistory && !!customerAccount && (
                      <CustomerPriceHistorySheet
                        accountId={customerAccount}
                        customerTitle={selectedCustomerObj?.title}
                        itemId={line.itemId}
                        itemTitle={itemObj?.title}
                        onApplyRate={(rate, secRate) =>
                          updateLine(line.seq, {
                            rate,
                            ...(secRate !== undefined ? { secRate } : {}),
                          })
                        }
                        onClose={() => updateLine(line.seq, { showHistory: false })}
                      />
                    )}
                  </View>
                );
              })
            )}

            {/* Subtotals Bar */}
            {lines.length > 0 && (
              <View style={styles.subtotalsBar}>
                <View style={styles.subtotalCol}>
                  <Text style={styles.subtotalLabel}>Gross</Text>
                  <Text style={styles.subtotalValue}>
                    Rs. {grossAmount.toLocaleString()}
                  </Text>
                </View>
                {totalDiscount > 0 && (
                  <View style={styles.subtotalCol}>
                    <Text style={[styles.subtotalLabel, { color: Theme.colors.danger }]}>
                      Discount
                    </Text>
                    <Text style={[styles.subtotalValue, { color: Theme.colors.danger }]}>
                      -Rs. {totalDiscount.toLocaleString()}
                    </Text>
                  </View>
                )}
                {totalCarriage > 0 && (
                  <View style={styles.subtotalCol}>
                    <Text style={styles.subtotalLabel}>Carriage</Text>
                    <Text style={styles.subtotalValue}>
                      +Rs. {totalCarriage.toLocaleString()}
                    </Text>
                  </View>
                )}
                <View style={styles.subtotalCol}>
                  <Text style={styles.subtotalLabel}>Net Payable</Text>
                  <Text style={[styles.subtotalValue, { color: Theme.colors.primary }]}>
                    Rs. {netAmount.toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Multi-Payment / Split Settlement Section */}
          <MobileMultiPaymentSection
            mode="sale"
            netTotal={netAmount}
            payments={payments}
            onChange={setPayments}
            legacyCashAmount={legacyCashReceipt}
          />
        </ScrollView>

        {/* Bottom Sticky Action Footer */}
        <View style={styles.footer}>
          {isEdit && (
            <>
              <TouchableOpacity
                style={styles.iconFooterBtn}
                onPress={handleDeleteVoucher}
                disabled={saving}
              >
                <Ionicons name="trash-outline" size={20} color={Theme.colors.danger} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconFooterBtn}
                onPress={handleCopyAsNew}
                disabled={saving}
              >
                <Ionicons name="copy-outline" size={20} color={Theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconFooterBtn}
                onPress={() => {
                  const receipt = buildReceiptData(`SL-${voucherNo}`, true);
                  if (receipt) {
                    setActiveReceiptData(receipt);
                    setReceiptModalVisible(true);
                  }
                }}
                disabled={saving}
              >
                <Ionicons name="receipt-outline" size={20} color="#0284c7" />
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={styles.saveOnlyBtn}
            onPress={() => handleSaveVoucher(false)}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#0284c7" />
            ) : (
              <>
                <Ionicons name="save-outline" size={17} color="#0284c7" />
                <Text style={styles.saveOnlyBtnText}>Save</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.savePrintBtn}
            onPress={() => handleSaveVoucher(true)}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="print-outline" size={17} color="#FFFFFF" />
                <Text style={styles.savePrintBtnText}>
                  {isEdit ? 'Update & Print' : 'Save & Print'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAwareContainer>

      <MobileSaleReceiptModal
        visible={receiptModalVisible}
        receiptData={activeReceiptData}
        onClose={() => {
          setReceiptModalVisible(false);
          if (justSavedRef.current) {
            router.back();
          }
        }}
      />
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 12,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  masterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginBottom: 10,
    ...Theme.shadows.sm,
  },
  masterSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  masterSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 6,
  },
  voucherBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  voucherBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dateChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  customerSummaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.text,
    flex: 1,
  },
  masterExpandedBody: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
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
  rowGap: {
    flexDirection: 'row',
    gap: 8,
  },
  compactLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
    marginBottom: 4,
  },
  compactTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
    height: 35,
    fontSize: 13,
    color: Theme.colors.text,
  },
  linesSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    ...Theme.shadows.sm,
  },
  linesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  linesSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  linesTotalBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  emptyCartBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
    gap: 6,
  },
  emptyCartText: {
    fontSize: 12.5,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
  },
  lineCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 9,
    marginBottom: 8,
  },
  lineTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  lineItemTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  subUnitConversionHint: {
    fontSize: 10.5,
    fontWeight: '600',
    color: Theme.colors.primary,
  },
  lineTopIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  iconPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  iconPillBtnActive: {
    backgroundColor: Theme.colors.primary,
  },
  discToggleText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  deleteLineBtn: {
    padding: 4,
  },
  inlineInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  qtyStepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    height: 36,
  },
  stepBtn: {
    paddingHorizontal: 7,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyInput: {
    minWidth: 42,
    maxWidth: 62,
    textAlign: 'center',
    fontSize: 13.5,
    fontWeight: '700',
    color: Theme.colors.text,
    paddingVertical: 0,
  },
  unitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 7,
    height: 36,
    borderRadius: 8,
  },
  unitPillSwitchable: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  unitPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  inlineFieldBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 7,
    height: 36,
    justifyContent: 'center',
  },
  inlineFieldWarning: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  miniFieldLabel: {
    fontSize: 8.5,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
    marginBottom: -2,
  },
  inlineNumericInput: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.text,
    paddingVertical: 0,
  },
  inlineAmountBox: {
    flex: 1.15,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 8,
    paddingHorizontal: 7,
    height: 36,
    justifyContent: 'center',
  },
  inlineAmountInput: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.primary,
    paddingVertical: 0,
  },
  minPriceWarningText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#B45309',
    marginTop: 4,
  },
  extrasRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 7,
    paddingTop: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CBD5E1',
  },
  extraField: {
    flex: 1,
    minWidth: 75,
  },
  extraLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
    marginBottom: 2,
  },
  extraInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
    height: 35,
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  subtotalsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
  },
  subtotalCol: {
    alignItems: 'center',
    flex: 1,
  },
  subtotalLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  subtotalValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Theme.colors.text,
    marginTop: 1,
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
  iconFooterBtn: {
    width: 40,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveOnlyBtn: {
    flex: 0.85,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 42,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#0284c7',
    backgroundColor: '#F0F9FF',
  },
  saveOnlyBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0284c7',
  },
  savePrintBtn: {
    flex: 1.35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 10,
    backgroundColor: Theme.colors.primary,
  },
  savePrintBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
