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
import { round } from '../../utils/numberUtils';
import { InlineSearchSelect, InlineSelectOption } from '../ui/InlineSearchSelect';
import { FastItemEntryBar } from '../ui/FastItemEntryBar';
import { useKeyboard } from '../../hooks/useKeyboard';
import {
  MobileMultiPaymentSection,
  PaymentSplitRow,
} from '../ui/MobileMultiPaymentSection';
import { CustomerPriceHistorySheet } from './CustomerPriceHistorySheet';

interface EditableWandaSaleLine extends SaleLineRequest {
  showHistory?: boolean;
}

export function WandaSaleScreen() {
  const { voucherNo, mode } = useLocalSearchParams<{ voucherNo: string; mode?: string }>();
  const router = useRouter();
  const isEdit = Boolean(voucherNo && voucherNo !== 'new' && mode !== 'copy');

  const { currentTenantIdentifier, licenses } = useAppStore();
  const currentOrg = licenses.find((l) => l.tenantIdentifier === currentTenantIdentifier);

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

  // UI Mode
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

  // Lines & Payments State
  const [lines, setLines] = useState<EditableWandaSaleLine[]>([]);
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
        inventoryService.getUnitsLookup(),
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
      setCustomers(safeCusts);
      setNarrations(narrs || []);
      setItems(safeItems);
      setUnits(unts || []);
      setCategoryPrices(catPrices || []);
      setCustomerCategories(custCats || []);
      setItemCategories(itmCats || []);

      if (voucherNo && voucherNo !== 'new') {
        await loadVoucherDetails();
      } else {
        const walkIn =
          safeCusts.find((c) => c.title.toLowerCase().includes('walk')) ||
          safeCusts.find((c) => c.title.toLowerCase().includes('cash')) ||
          safeCusts[0];
        if (walkIn) setCustomerAccount(walkIn.account);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching lookups', error);
      Alert.alert('Error', 'Failed to load form data.');
      setLoading(false);
    }
  };

  const loadVoucherDetails = async () => {
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

        const mappedLines: EditableWandaSaleLine[] = details.map((d) => ({
          seq: d.seq,
          itemId: d.itemId,
          unit: d.unit || 'Kg',
          qty: d.qty,
          rate: d.rate,
          discount: d.discount || 0,
          carriage: d.carriage || 0,
          secQty: d.secQty || 0,
          secRate: d.secRate || 0,
          secUnit: d.secUnit || 'Bag',
          packQty:
            (d as any).qtyInPack ||
            (d.qty > 0 && d.secQty && d.secQty > 0 ? round(d.qty / d.secQty, 2) : 0),
          packing: (d as any).packing || (d as any).qtyInPack || 0,
        }));
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

  const resolveWandaRates = useCallback(
    (
      item: Item,
      targetCustomerAccount?: string
    ): { kgRate: number; bagRate: number; packSize: number } => {
      const accId = targetCustomerAccount ?? customerAccount;
      const cust = customers.find((c) => c.account === accId);
      const custCatId = cust?.customerCategoryId;
      const pSize = Number(item.qtyInPack || 0);

      if (custCatId && categoryPrices.length > 0) {
        const match = categoryPrices.find(
          (cp) =>
            String(cp.itemId) === String(item.id) &&
            String(cp.customerCategoryId) === String(custCatId)
        );
        if (match) {
          const bagRate =
            match.secRate > 0
              ? match.secRate
              : item.secRate || (match.priRate || item.priRate || 0) * (pSize > 0 ? pSize : 1);
          const kgRate =
            pSize > 0 && bagRate > 0
              ? round(bagRate / pSize, 8)
              : match.priRate || item.priRate || 0;
          return { kgRate, bagRate, packSize: pSize };
        }
      }

      const bagRate = item.secRate || (item.priRate || 0) * (pSize > 0 ? pSize : 1);
      const kgRate =
        pSize > 0 && bagRate > 0 ? round(bagRate / pSize, 8) : item.priRate || 0;
      return { kgRate, bagRate, packSize: pSize };
    },
    [customerAccount, customers, categoryPrices]
  );

  const handleSelectCustomer = (newAccount: string) => {
    setCustomerAccount(newAccount);
    if (lines.length > 0) {
      setLines((prev) =>
        prev.map((line) => {
          const itemObj = items.find((i) => String(i.id) === String(line.itemId));
          if (!itemObj) return line;
          const { kgRate, bagRate } = resolveWandaRates(itemObj, newAccount);
          return { ...line, rate: kgRate, secRate: bagRate };
        })
      );
    }
  };

  const handleFastAddItem = (item: Item, addedBagsOrKg: number = 1) => {
    const { kgRate, bagRate, packSize } = resolveWandaRates(item);
    setLines((prev) => {
      const existingIdx = prev.findIndex(
        (l) => String(l.itemId).trim().toLowerCase() === String(item.id).trim().toLowerCase()
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        const cur = next[existingIdx];
        const effectivePack = cur.packQty || cur.packing || packSize || 0;
        const newBags = round((cur.secQty || 0) + addedBagsOrKg, 2);
        const newKg = effectivePack > 0 ? round(newBags * effectivePack, 2) : round((cur.qty || 0) + addedBagsOrKg, 2);
        next[existingIdx] = {
          ...cur,
          secQty: effectivePack > 0 ? newBags : cur.secQty,
          qty: newKg,
        };
        return next;
      }

      const maxSeq = prev.reduce((max, l) => Math.max(max, l.seq || 0), 0);
      const initialBags = packSize > 0 ? addedBagsOrKg : 0;
      const initialKg = packSize > 0 ? round(initialBags * packSize, 2) : addedBagsOrKg;

      return [
        {
          seq: maxSeq + 1,
          itemId: item.id,
          unit: item.defaultUnit || item.primaryUnit || 'Kg',
          qty: initialKg,
          rate: kgRate,
          discount: 0,
          carriage: 0,
          secUnit: item.secondaryUnit || 'Bag',
          secQty: initialBags,
          secRate: bagRate,
          packQty: packSize,
          packing: packSize,
        },
        ...prev,
      ];
    });
  };

  const updateWandaLineField = (seq: number, field: string, rawVal: string | number) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.seq !== seq) return line;
        const updated = { ...line };
        const numVal =
          typeof rawVal === 'string'
            ? parseFloat(rawVal.replace(/,/g, '')) || 0
            : Number(rawVal) || 0;

        let kgQty = updated.qty || 0;
        let bagQty = updated.secQty || 0;
        let packQty = updated.packQty || 0;
        let packing = updated.packing || 0;
        let kgRate = updated.rate || 0;
        let bagRate = updated.secRate || 0;

        if (field === 'qty') {
          kgQty = numVal;
          const effPack = packQty > 0 ? packQty : packing > 0 ? packing : 0;
          bagQty = effPack > 0 ? round(kgQty / effPack, 2) : 0;
        } else if (field === 'secQty') {
          bagQty = numVal;
          const effPack = packQty > 0 ? packQty : packing > 0 ? packing : 0;
          kgQty = effPack > 0 ? round(bagQty * effPack, 2) : kgQty;
        } else if (field === 'packQty') {
          packQty = numVal;
          bagQty = packQty > 0 ? round(kgQty / packQty, 2) : 0;
        } else if (field === 'packing') {
          packing = numVal;
          if (packing > 0) {
            if (bagRate > 0) kgRate = round(bagRate / packing, 8);
            else if (kgRate > 0) bagRate = round(kgRate * packing, 2);
          }
        } else if (field === 'rate') {
          kgRate = numVal;
          if (packing > 0) bagRate = round(kgRate * packing, 2);
        } else if (field === 'secRate') {
          bagRate = numVal;
          if (packing > 0) kgRate = round(bagRate / packing, 8);
        } else if (field === 'discount') {
          updated.discount = numVal;
        } else if (field === 'carriage') {
          updated.carriage = numVal;
        }

        updated.qty = round(kgQty, 2);
        updated.secQty = round(bagQty, 2);
        updated.packQty = round(packQty, 2);
        updated.packing = round(packing, 2);
        updated.rate = round(kgRate, 8);
        updated.secRate = round(bagRate, 2);
        return updated;
      })
    );
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

  // Totals
  const totalQty = useMemo(() => lines.reduce((s, l) => s + (l.qty || 0), 0), [lines]);
  const totalBags = useMemo(() => lines.reduce((s, l) => s + (l.secQty || 0), 0), [lines]);
  const grossAmount = useMemo(
    () => lines.reduce((s, l) => s + (l.qty || 0) * (l.rate || 0), 0),
    [lines]
  );
  const totalDiscount = useMemo(
    () => lines.reduce((s, l) => s + (l.discount || 0), 0),
    [lines]
  );
  const netAmount = useMemo(
    () =>
      round(
        lines.reduce((s, l) => {
          const carriageAmt = (l.secQty || 0) * (l.carriage || 0);
          return s + ((l.qty || 0) * (l.rate || 0) - (l.discount || 0) + carriageAmt);
        }, 0),
        2
      ),
    [lines]
  );

  const totalReceived = useMemo(
    () => payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [payments]
  );
  const cashBackAmount = Math.max(0, round(totalReceived - netAmount, 2));

  const cartQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of lines) {
      map[l.itemId] = round((map[l.itemId] || 0) + (l.secQty || l.qty || 0), 2);
    }
    return map;
  }, [lines]);

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
    if (item?.primaryUnitTitle) return item.primaryUnitTitle;
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
      return {
        seq: l.seq || idx + 1,
        itemTitle: itm?.title || `Item #${l.itemId}`,
        qty: q,
        unit: getUnitTitle(l.unit, itm) || 'Kg',
        rate: r,
        discount: d,
        amount: round(q * r - d + (l.secQty || 0) * (l.carriage || 0), 2),
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
      Alert.alert('Validation Error', 'At least one line item is required.');
      return;
    }

    setSaving(true);
    try {
      const cleanedLines: SaleLineRequest[] = lines.map((l, idx) => ({
        seq: idx + 1,
        itemId: l.itemId,
        unit: l.unit || undefined,
        qty: Number(l.qty) || 0,
        rate: Number(l.rate) || 0,
        discount: Number(l.discount) || 0,
        carriage: Number(l.carriage) || 0,
        secQty: Number(l.secQty) || 0,
        secRate: Number(l.secRate) || 0,
        secUnit: Number(l.secQty) > 0 && l.secUnit ? l.secUnit : undefined,
        qtyInPack: l.packQty || l.qtyInPack || null,
        packing: l.packing || null,
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
          Alert.alert('Success', 'Sale updated.', [
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
          Alert.alert('Success', 'Sale created.', [
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
          {/* Compact Master Header */}
          <View style={styles.masterCard}>
            <TouchableOpacity
              style={styles.masterSummaryBar}
              onPress={() => setHeaderExpanded((p) => !p)}
            >
              <View style={styles.masterSummaryLeft}>
                <View style={styles.voucherBadge}>
                  <Text style={styles.voucherBadgeText}>
                    {isEdit ? `SL-${String(voucherNo).padStart(5, '0')}` : 'WANDA SALE'}
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
                onChange={(_, d) => {
                  setShowDatePicker(false);
                  if (d) setDate(d);
                }}
              />
            )}

            {headerExpanded && (
              <View style={styles.masterExpandedBody}>
                <InlineSearchSelect
                  label="Customer Account *"
                  placeholder="Search Customer..."
                  value={customerAccount}
                  options={customerOptions}
                  onSelect={handleSelectCustomer}
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
                        placeholder="Select narration..."
                        value={narration}
                        options={narrationOptions}
                        onSelect={setNarration}
                        allowClear
                        allowCustomText
                        compact
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.compactLabel}>Notes</Text>
                      <TextInput
                        style={styles.compactTextInput}
                        placeholder="Notes..."
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

          {/* Fast Item Entry Bar */}
          <FastItemEntryBar
            items={items}
            categoryMap={itemCategoryMap}
            mode={entryMode}
            onModeChange={setEntryMode}
            onAddItem={(itm, q) => handleFastAddItem(itm, q)}
            resolveItemRate={(itm) => resolveWandaRates(itm).bagRate}
            cartQtyMap={cartQtyMap}
            placeholder="Scan or search feed item..."
          />

          {/* Inline Wanda Dual-Unit Line Cards */}
          <View style={styles.linesSection}>
            <View style={styles.linesHeaderRow}>
              <Text style={styles.linesSectionTitle}>
                Feed Items ({lines.length})
              </Text>
              {lines.length > 0 && (
                <Text style={styles.linesTotalBadge}>
                  Bags: {totalBags} • Kg: {totalQty} • Rs. {netAmount.toLocaleString()}
                </Text>
              )}
            </View>

            {lines.length === 0 ? (
              <View style={styles.emptyCartBox}>
                <Ionicons name="nutrition-outline" size={32} color={Theme.colors.border} />
                <Text style={styles.emptyCartText}>
                  Search or tap a feed product above to add inline.
                </Text>
              </View>
            ) : (
              lines.map((line) => {
                const itemObj = items.find((i) => String(i.id) === String(line.itemId));
                const carriageAmt = (line.secQty || 0) * (line.carriage || 0);
                const lineTotal = round(
                  (line.qty || 0) * (line.rate || 0) - (line.discount || 0) + carriageAmt,
                  2
                );

                return (
                  <View key={line.seq} style={styles.lineCard}>
                    <View style={styles.lineTopRow}>
                      <Text style={styles.lineItemTitle} numberOfLines={1}>
                        {itemObj?.title || `Item #${line.itemId}`}
                      </Text>
                      <View style={styles.lineTopIcons}>
                        {!!customerAccount && (
                          <TouchableOpacity
                            style={[
                              styles.iconPillBtn,
                              line.showHistory && styles.iconPillBtnActive,
                            ]}
                            onPress={() =>
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.seq === line.seq
                                    ? { ...l, showHistory: !l.showHistory }
                                    : l
                                )
                              )
                            }
                          >
                            <Ionicons
                              name="time-outline"
                              size={15}
                              color={line.showHistory ? '#FFF' : Theme.colors.primary}
                            />
                          </TouchableOpacity>
                        )}
                        <Text style={styles.lineAmountBadge}>
                          Rs. {lineTotal.toLocaleString()}
                        </Text>
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

                    {/* Row 1 of Wanda Inputs: Bags | Pack Size | Total Kg | Bag Rate */}
                    <View style={styles.wandaGridRow}>
                      <View style={styles.wandaField}>
                        <Text style={styles.miniLabel}>Bags</Text>
                        <TextInput
                          style={styles.wandaInput}
                          keyboardType="numeric"
                          selectTextOnFocus
                          value={line.secQty ? String(line.secQty) : ''}
                          placeholder="0"
                          onChangeText={(v) => updateWandaLineField(line.seq, 'secQty', v)}
                        />
                      </View>

                      <View style={styles.wandaField}>
                        <Text style={styles.miniLabel}>Pack (Kg)</Text>
                        <TextInput
                          style={styles.wandaInput}
                          keyboardType="numeric"
                          selectTextOnFocus
                          value={line.packQty ? String(line.packQty) : ''}
                          placeholder="0"
                          onChangeText={(v) => updateWandaLineField(line.seq, 'packQty', v)}
                        />
                      </View>

                      <View style={styles.wandaField}>
                        <Text style={styles.miniLabel}>Qty (Kg)</Text>
                        <TextInput
                          style={styles.wandaInput}
                          keyboardType="numeric"
                          selectTextOnFocus
                          value={line.qty ? String(line.qty) : ''}
                          placeholder="0"
                          onChangeText={(v) => updateWandaLineField(line.seq, 'qty', v)}
                        />
                      </View>

                      <View style={styles.wandaField}>
                        <Text style={styles.miniLabel}>Bag Rate</Text>
                        <TextInput
                          style={styles.wandaInput}
                          keyboardType="numeric"
                          selectTextOnFocus
                          value={line.secRate ? String(round(line.secRate, 2)) : ''}
                          placeholder="0"
                          onChangeText={(v) => updateWandaLineField(line.seq, 'secRate', v)}
                        />
                      </View>
                    </View>

                    {/* Row 2 of Wanda Inputs: Rate/Kg | Packing | Discount | Carriage/Bag */}
                    <View style={[styles.wandaGridRow, { marginTop: 6 }]}>
                      <View style={styles.wandaField}>
                        <Text style={styles.miniLabel}>Rate/Kg</Text>
                        <TextInput
                          style={styles.wandaInput}
                          keyboardType="numeric"
                          selectTextOnFocus
                          value={line.rate ? String(round(line.rate, 2)) : ''}
                          placeholder="0"
                          onChangeText={(v) => updateWandaLineField(line.seq, 'rate', v)}
                        />
                      </View>

                      <View style={styles.wandaField}>
                        <Text style={styles.miniLabel}>Packing</Text>
                        <TextInput
                          style={styles.wandaInput}
                          keyboardType="numeric"
                          selectTextOnFocus
                          value={line.packing ? String(line.packing) : ''}
                          placeholder="0"
                          onChangeText={(v) => updateWandaLineField(line.seq, 'packing', v)}
                        />
                      </View>

                      <View style={styles.wandaField}>
                        <Text style={styles.miniLabel}>Discount</Text>
                        <TextInput
                          style={styles.wandaInput}
                          keyboardType="numeric"
                          selectTextOnFocus
                          value={line.discount ? String(line.discount) : ''}
                          placeholder="0"
                          onChangeText={(v) => updateWandaLineField(line.seq, 'discount', v)}
                        />
                      </View>

                      <View style={styles.wandaField}>
                        <Text style={styles.miniLabel}>Rent/Bag</Text>
                        <TextInput
                          style={styles.wandaInput}
                          keyboardType="numeric"
                          selectTextOnFocus
                          value={line.carriage ? String(line.carriage) : ''}
                          placeholder="0"
                          onChangeText={(v) => updateWandaLineField(line.seq, 'carriage', v)}
                        />
                      </View>
                    </View>

                    {line.showHistory && !!customerAccount && (
                      <CustomerPriceHistorySheet
                        accountId={customerAccount}
                        customerTitle={selectedCustomerObj?.title}
                        itemId={line.itemId}
                        itemTitle={itemObj?.title}
                        onApplyRate={(rate, secRate) => {
                          if (secRate && secRate > 0) {
                            updateWandaLineField(line.seq, 'secRate', secRate);
                          } else {
                            updateWandaLineField(line.seq, 'rate', rate);
                          }
                        }}
                        onClose={() =>
                          setLines((prev) =>
                            prev.map((l) =>
                              l.seq === line.seq ? { ...l, showHistory: false } : l
                            )
                          )
                        }
                      />
                    )}
                  </View>
                );
              })
            )}
          </View>

          {/* Multi-Payment Section */}
          <MobileMultiPaymentSection
            mode="sale"
            netTotal={netAmount}
            payments={payments}
            onChange={setPayments}
            legacyCashAmount={legacyCashReceipt}
          />
        </ScrollView>

        {/* Bottom Sticky Footer */}
        <View style={styles.footer}>
          {isEdit && (
            <TouchableOpacity
              style={styles.iconFooterBtn}
              onPress={handleDeleteVoucher}
              disabled={saving}
            >
              <Ionicons name="trash-outline" size={20} color={Theme.colors.danger} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.saveOnlyBtn}
            onPress={() => handleSaveVoucher(false)}
            disabled={saving}
          >
            <Ionicons name="save-outline" size={17} color="#0284c7" />
            <Text style={styles.saveOnlyBtnText}>Save</Text>
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
          if (justSavedRef.current) router.back();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Theme.colors.background },
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 12, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  rowGap: { flexDirection: 'row', gap: 8 },
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
    height: 34,
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
    fontSize: 11.5,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  emptyCartBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  emptyCartText: {
    fontSize: 12.5,
    color: Theme.colors.textSecondary,
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
    flex: 1,
    marginRight: 8,
  },
  lineTopIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconPillBtn: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  iconPillBtnActive: {
    backgroundColor: Theme.colors.primary,
  },
  lineAmountBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  wandaGridRow: {
    flexDirection: 'row',
    gap: 6,
  },
  wandaField: {
    flex: 1,
  },
  miniLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
    marginBottom: 2,
  },
  wandaInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 7,
    paddingHorizontal: 7,
    height: 33,
    fontSize: 12.5,
    fontWeight: '700',
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
