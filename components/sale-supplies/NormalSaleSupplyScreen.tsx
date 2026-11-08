import React, { useEffect, useState, useMemo } from 'react';
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
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import dayjs from 'dayjs';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Theme } from '../../constants/theme';
import { saleSupplyService, SaleSupplyLineRequest, SaleSupplyAttachment } from '../../services/saleSupplyService';
import { chartOfAccountService, ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { narrationService, NarrationDto } from '../../services/narrationService';
import { inventoryService, Item, Unit, ItemCustomerCategoryPriceDto } from '../../services/inventoryService';
import { customerCategoryService, CustomerCategoryLookupResponse } from '../../services/customerCategoryService';
import { supplyOrderService, SupplyOrder } from '../../services/supplyOrderService';
import { customerService } from '../../services/customerService';
import { useAppStore } from '../../store/appStore';
import { round } from '../../utils/numberUtils';
import { InlineSearchSelect } from '../ui/InlineSearchSelect';
import { ScanSupplySheetModal, type MobileScannedAttachmentMeta } from './ScanSupplySheetModal';
import { useKeyboard } from '../../hooks/useKeyboard';

export function NormalSaleSupplyScreen() {
  const { voucherNo, mode } = useLocalSearchParams<{ voucherNo: string; mode?: string }>();
  const router = useRouter();
  
  const isEdit = voucherNo !== 'new' && mode !== 'copy';

  const { currentTenantIdentifier, licenses } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const hasSecondaryQty = currentOrg?.hasSecondaryQty ?? false;

  const [loading, setLoading] = useState(voucherNo !== 'new');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Lookups
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [supplyOrders, setSupplyOrders] = useState<SupplyOrder[]>([]);
  const [categoryPrices, setCategoryPrices] = useState<ItemCustomerCategoryPriceDto[]>([]);
  const [customerCategories, setCustomerCategories] = useState<CustomerCategoryLookupResponse[]>([]);

  // Header State
  const [headerExpanded, setHeaderExpanded] = useState(voucherNo === 'new');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const { keyboardHeight, isKeyboardVisible } = useKeyboard();
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [itemId, setItemId] = useState('');
  const [narration, setNarration] = useState('');
  const [description, setDescription] = useState('');
  const [supplyOrderId, setSupplyOrderId] = useState<number | null>(null);

  // Master Item & Secondary Qty Visibility
  const selectedMasterItem = useMemo(
    () => items.find((i) => String(i.id).trim().toLowerCase() === String(itemId).trim().toLowerCase()),
    [items, itemId]
  );

  // Lines State
  const [lines, setLines] = useState<SaleSupplyLineRequest[]>([
    { seq: 1, customerId: '', unit: '', qty: 1, rate: 0, discount: 0, addLess: 0, secQty: 0, secRate: 0 }
  ]);
  const [lineSearchQuery, setLineSearchQuery] = useState('');

  const showPackQty = useMemo(
    () =>
      Boolean(
        hasSecondaryQty ||
        selectedMasterItem?.secondaryUnit ||
        lines.some((l) => Number(l.secQty || 0) > 0 || Boolean(l.secUnit))
      ),
    [hasSecondaryQty, selectedMasterItem, lines]
  );

  // AI Sheet Scan & Attachments
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [stagedMediaIds, setStagedMediaIds] = useState<string[]>([]);
  const [savedAttachments, setSavedAttachments] = useState<SaleSupplyAttachment[]>([]);

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    if (voucherNo !== 'new') {
      loadDetails();
    }
  }, [voucherNo]);

  const loadLookups = async () => {
    try {
      const [cusData, narData, itemData, unitData, orderData, catPrices, custCats] = await Promise.all([
        chartOfAccountService.getCustomerAccounts(),
        narrationService.getActiveNarrationsLookup(),
        inventoryService.getItemsLookup(),
        inventoryService.getUnitsLookup(),
        supplyOrderService.getList(),
        inventoryService.getCustomerCategoryPrices().catch(() => []),
        customerCategoryService.getLookup().catch(() => []),
      ]);
      setCustomers(cusData);
      setNarrations(narData);
      setItems(itemData);
      setUnits(unitData);
      setSupplyOrders(orderData);
      setCategoryPrices(catPrices);
      setCustomerCategories(custCats || []);
    } catch (error) {
      console.error('Failed to load lookups', error);
    }
  };

  const loadAttachments = async (vNo: string) => {
    try {
      const list = await saleSupplyService.getAttachments(vNo);
      setSavedAttachments(list || []);
    } catch (err) {
      console.warn('Failed to load attachments', err);
    }
  };

  const loadDetails = async () => {
    setLoading(true);
    try {
      const details = await saleSupplyService.getDetail(voucherNo!);
      if (details.length > 0) {
        const first = details[0];
        setDate(dayjs(first.date).toDate());
        setItemId(first.itemId);
        setNarration(first.narrationId || '');
        setDescription(first.description || '');
        setSupplyOrderId(first.supplyOrderMasterId ?? null);

        setLines(details.map(d => ({
          seq: d.seq,
          customerId: d.customerId,
          unit: d.unit || '',
          qty: d.qty,
          rate: d.rate,
          discount: d.discount,
          carriage: d.carriage,
          addLess: d.addLess,
          secQty: d.secQty,
          secRate: d.secRate,
          secUnit: d.secUnit
        })));
      }
      if (isEdit && voucherNo) {
        await loadAttachments(voucherNo);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load sale supply details');
    } finally {
      setLoading(false);
    }
  };

  const resolveCustomerCategoryRate = (selectedItem: Item | undefined, customerId: string) => {
    if (!selectedItem) return { priRate: 0, secRate: 0 };
    const isSec = selectedItem.defaultUnit === selectedItem.secondaryUnit;
    let baseRate = isSec ? (selectedItem.secRate || 0) : (selectedItem.priRate || 0);
    let secRate = selectedItem.secRate || 0;

    if (customerId) {
      const cust = customers.find(c => c.account === customerId);
      if (cust?.customerCategoryId) {
        const catMatch = categoryPrices.find(
          cp => cp.itemId === selectedItem.id && cp.customerCategoryId === cust.customerCategoryId
        );
        if (catMatch) {
          if (isSec && catMatch.secRate != null && catMatch.secRate > 0) {
            baseRate = catMatch.secRate;
          } else if (!isSec && catMatch.priRate != null && catMatch.priRate > 0) {
            baseRate = catMatch.priRate;
          }
          if (catMatch.secRate != null && catMatch.secRate > 0) {
            secRate = catMatch.secRate;
          }
        }
      }
    }
    return { priRate: baseRate, secRate };
  };

  const handleSupplyOrderSelect = async (order: SupplyOrder) => {
    setSupplyOrderId(order.id);
    if (!itemId) {
      Alert.alert('Notice', 'Please select an item first to apply pricing accurately.');
      return;
    }

    try {
      setLoading(true);
      const [orderDetail, customSupplyItems] = await Promise.all([
        supplyOrderService.getById(order.id),
        customerService.getSupplyItems({ itemId })
      ]);

      const customerQtyMap = new Map<string, { qty: number; secQty?: number; rate?: number; carriage?: number; addLess?: number; discount?: number }>();
      if (customSupplyItems && Array.isArray(customSupplyItems)) {
        customSupplyItems.forEach(ci => {
          if (ci.customerAccountId) {
            customerQtyMap.set(ci.customerAccountId, {
              qty: ci.qty,
              secQty: ci.secQty,
              rate: ci.rate,
              carriage: ci.carriage,
              addLess: ci.addLess,
              discount: ci.discount
            });
          }
        });
      }

      const selectedItem = items.find(i => i.id === itemId);

      if (orderDetail && orderDetail.details) {
        const newLines: SaleSupplyLineRequest[] = orderDetail.details.map((d, index) => {
          const setting = customerQtyMap.get(d.customerId);
          const { priRate: catBaseRate, secRate: catSecRate } = resolveCustomerCategoryRate(selectedItem, d.customerId);
          const qty = setting ? setting.qty : 1;
          const secQty = setting ? (setting.secQty || 0) : 0;
          const lineRate = setting?.rate != null ? setting.rate : catBaseRate;
          const lineDiscount = setting?.discount != null ? setting.discount : 0;
          const lineCarriage = setting?.carriage != null ? setting.carriage : 0;
          const lineAddLess = setting?.addLess != null ? setting.addLess : 0;

          return {
            seq: index + 1,
            customerId: d.customerId,
            unit: selectedItem?.defaultUnit || selectedItem?.primaryUnit || '',
            qty,
            rate: lineRate,
            discount: lineDiscount,
            carriage: lineCarriage,
            addLess: lineAddLess,
            secQty,
            secRate: catSecRate,
            secUnit: selectedItem?.secondaryUnit || ''
          };
        });

        setLines(newLines);
        Alert.alert('Success', `Loaded ${newLines.length} customers from ${order.title}`);
      }
    } catch (err) {
      console.error('Failed to load supply order detail', err);
      Alert.alert('Error', 'Failed to load supply order customers');
    } finally {
      setLoading(false);
    }
  };

  const handleItemSelect = async (item: Item) => {
    setItemId(item.id);
    const isSec = item.defaultUnit === item.secondaryUnit;
    const defaultRate = isSec ? (item.secRate || 0) : (item.priRate || 0);
    const secRate = item.secRate || 0;

    try {
      const customSupplyItems = await customerService.getSupplyItems({ itemId: item.id });
      const customerQtyMap = new Map<string, { qty: number; secQty?: number; rate?: number; carriage?: number; addLess?: number; discount?: number }>();
      if (customSupplyItems && Array.isArray(customSupplyItems)) {
        customSupplyItems.forEach(ci => {
          if (ci.customerAccountId) {
            customerQtyMap.set(ci.customerAccountId, {
              qty: ci.qty,
              secQty: ci.secQty,
              rate: ci.rate,
              carriage: ci.carriage,
              addLess: ci.addLess,
              discount: ci.discount
            });
          }
        });
      }

      setLines(lines.map(line => {
        if (!line.customerId) {
          return {
            ...line,
            unit: item.defaultUnit || item.primaryUnit || '',
            rate: defaultRate,
            secUnit: item.secondaryUnit || '',
            secRate
          };
        }

        const setting = customerQtyMap.get(line.customerId);
        const { priRate: catBaseRate, secRate: catSecRate } = resolveCustomerCategoryRate(item, line.customerId);
        return {
          ...line,
          unit: item.defaultUnit || item.primaryUnit || '',
          qty: setting ? setting.qty : (line.qty || 1),
          secQty: setting ? (setting.secQty || 0) : (line.secQty || 0),
          rate: setting?.rate != null ? setting.rate : catBaseRate,
          discount: setting?.discount != null ? setting.discount : (line.discount || 0),
          carriage: setting?.carriage != null ? setting.carriage : (line.carriage || 0),
          addLess: setting?.addLess != null ? setting.addLess : (line.addLess || 0),
          secRate: catSecRate,
          secUnit: item.secondaryUnit || ''
        };
      }));
    } catch (err) {
      console.error('Failed to fetch item defaults', err);
      setLines(lines.map(line => ({
        ...line,
        unit: item.defaultUnit || item.primaryUnit || '',
        rate: defaultRate,
        secUnit: item.secondaryUnit || '',
        secRate
      })));
    }
  };

  const addLine = () => {
    const nextSeq = lines.length > 0 ? Math.max(...lines.map(l => l.seq)) + 1 : 1;
    let defaultUnit = '';
    let defaultRate = 0;
    let secUnit = '';
    let secRate = 0;
    const selectedItem = items.find(i => i.id === itemId);
    
    if (selectedItem) {
      defaultUnit = selectedItem.defaultUnit || selectedItem.primaryUnit || '';
      defaultRate = selectedItem.priRate || 0;
      secUnit = selectedItem.secondaryUnit || '';
      secRate = selectedItem.secRate || 0;
    }
    
    setLines([...lines, { seq: nextSeq, customerId: '', unit: defaultUnit, qty: 1, rate: defaultRate, discount: 0, addLess: 0, secQty: 0, secRate, secUnit }]);
  };

  const removeLine = (seq: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter(l => l.seq !== seq));
  };

  const updateLine = (seq: number, updates: Partial<SaleSupplyLineRequest>) => {
    setLines(lines.map(l => {
      if (l.seq === seq) {
        return { ...l, ...updates };
      }
      return l;
    }));
  };

  const updateLineField = (seq: number, field: string, value: any) => {
    setLines(prev => prev.map(l => {
      if (l.seq === seq) {
        const updated = { ...l, [field]: value };
        const cleanVal = typeof value === 'string' ? value.replace(/,/g, '') : value;
        const numVal = (cleanVal !== null && cleanVal !== undefined && cleanVal !== '' && !isNaN(Number(cleanVal))) ? Number(cleanVal) : 0;

        if (field === 'qty') updated.qty = numVal;
        if (field === 'rate') updated.rate = numVal;
        if (field === 'secQty') updated.secQty = numVal;
        if (field === 'secRate') updated.secRate = numVal;
        if (field === 'discount') updated.discount = numVal;
        if (field === 'addLess') updated.addLess = numVal;

        return updated;
      }
      return l;
    }));
  };

  const buildCustomerLineDefaults = async (customerId: string) => {
    const selectedItem = items.find(i => i.id === itemId);
    const { priRate: catBaseRate, secRate: catSecRate } = resolveCustomerCategoryRate(selectedItem, customerId);

    let defQty = 1;
    let defSecQty = 0;
    let defRate = catBaseRate;
    let defDiscount = 0;
    let defAddLess = 0;

    if (itemId && customerId) {
      try {
        const customItems = await customerService.getSupplyItems({ customerId, itemId });
        if (customItems && customItems.length > 0) {
          defQty = customItems[0].qty > 0 ? customItems[0].qty : 1;
          defSecQty = customItems[0].secQty || 0;
          if (customItems[0].rate != null) defRate = customItems[0].rate;
          if (customItems[0].discount != null) defDiscount = customItems[0].discount;
          if (customItems[0].addLess != null) defAddLess = customItems[0].addLess;
        }
      } catch (err) {
        console.error('Failed to get customer supply defaults', err);
      }
    }

    return {
      customerId,
      qty: defQty,
      secQty: defSecQty,
      rate: defRate,
      discount: defDiscount,
      addLess: defAddLess,
      secRate: catSecRate,
      unit: selectedItem?.defaultUnit || selectedItem?.primaryUnit || '',
      secUnit: selectedItem?.secondaryUnit || ''
    };
  };

  const handleCustomerSelect = async (seq: number, customerId: string) => {
    const defaults = await buildCustomerLineDefaults(customerId);
    updateLine(seq, defaults);
  };

  const handleQuickAddCustomer = async (customerId: string) => {
    const defaults = await buildCustomerLineDefaults(customerId);
    setLines(prev => {
      const isBlankOnly = prev.length === 1 && !prev[0].customerId;
      if (isBlankOnly) {
        return [{ seq: 1, ...defaults }];
      }
      const existingIdx = prev.findIndex(
        l => String(l.customerId).trim().toLowerCase() === String(customerId).trim().toLowerCase()
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        const cur = next[existingIdx];
        next[existingIdx] = {
          ...cur,
          qty: (Number(cur.qty) || 0) + 1,
        };
        return next;
      }
      const nextSeq = prev.length > 0 ? Math.max(...prev.map(l => l.seq)) + 1 : 1;
      return [{ seq: nextSeq, ...defaults }, ...prev];
    });
  };

  const handleDeleteAttachment = (att: SaleSupplyAttachment) => {
    if (!voucherNo || voucherNo === 'new') return;
    Alert.alert('Remove Attachment', `Delete "${att.fileName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await saleSupplyService.deleteAttachment(voucherNo, att.id);
            setSavedAttachments(prev => prev.filter(a => a.id !== att.id));
          } catch (err) {
            Alert.alert('Error', 'Failed to delete attachment');
          }
        }
      }
    ]);
  };

  const handleImportScannedLines = (
    importedLines: any[],
    attachments?: MobileScannedAttachmentMeta[]
  ) => {
    if (attachments && attachments.length > 0) {
      const newMediaIds = attachments.map(a => a.mediaId);
      setStagedMediaIds(prev => Array.from(new Set([...prev, ...newMediaIds])));
      if (isEdit && voucherNo && voucherNo !== 'new') {
        Promise.all(
          attachments.map(att =>
            saleSupplyService.addAttachment(voucherNo!, {
              mediaId: att.mediaId,
              fileName: att.fileName,
              description: 'Scanned paper slip'
            })
          )
        )
          .then(() => loadAttachments(voucherNo!))
          .catch(err => console.warn('Failed to add attachment to existing voucher:', err));
      }
    }

    setLines(prev => {
      const isBlankOnly = prev.length === 1 && !prev[0].customerId && (Number(prev[0].qty) || 0) <= 1 && (Number(prev[0].rate) || 0) === 0;
      const baseSeq = isBlankOnly ? 0 : (prev.length > 0 ? Math.max(...prev.map(l => l.seq)) : 0);
      const mapped = importedLines.map((line, idx) => ({
        seq: baseSeq + idx + 1,
        customerId: line.customerId || '',
        unit: '',
        qty: Number(line.qty) || 1,
        rate: Number(line.rate) || 0,
        discount: Number(line.discount) || 0,
        addLess: Number(line.addLess) || 0,
        carriage: Number(line.carriage) || 0,
        secQty: 0,
        secRate: 0
      }));
      return isBlankOnly ? mapped : [...prev, ...mapped];
    });

    Alert.alert('Import Complete', `Imported ${importedLines.length} lines from sheet.`);
  };

  const handleSave = async () => {
    if (!itemId) {
      Alert.alert('Validation Error', 'Please select an item for the supply sheet');
      return;
    }

    const validLines = lines.filter(l => l.customerId && l.qty > 0);
    if (validLines.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one customer with a valid quantity');
      return;
    }

    setSaving(true);
    try {
      const selectedItem = items.find(i => i.id === itemId);
      const isService = selectedItem?.itemType === 'Service';

      const payload = {
        date: dayjs(date).format('YYYY-MM-DD'),
        itemId,
        narration: narration || undefined,
        description: description || undefined,
        supplyOrderMasterId: supplyOrderId || undefined,
        lines: validLines.map(l => ({
          seq: l.seq,
          customerId: l.customerId,
          unit: isService ? undefined : (l.unit || undefined),
          qty: Number(l.qty) || 0,
          rate: Number(l.rate) || 0,
          discount: Number(l.discount) || 0,
          carriage: Number(l.carriage) || 0,
          addLess: Number(l.addLess) || 0,
          secUnit: l.secUnit || undefined,
          secQty: Number(l.secQty) || 0,
          secRate: Number(l.secRate) || 0
        })),
        attachmentMediaIds: stagedMediaIds.length > 0 ? stagedMediaIds : undefined
      };

      if (isEdit) {
        await saleSupplyService.update(voucherNo!, payload);
        Alert.alert('Success', 'Sale supply updated successfully', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        const newVoucher = await saleSupplyService.create(payload);
        Alert.alert('Success', `Sale supply ${newVoucher} created successfully`, [
          { text: 'OK', onPress: () => router.replace(`/sale-supplies/${newVoucher}`) }
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to save sale supply');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete Sale Supply voucher ${voucherNo}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await saleSupplyService.delete(voucherNo!);
              Alert.alert('Deleted', 'Sale supply deleted successfully', [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete sale supply');
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  const handleCopy = () => {
    router.push({
      pathname: '/sale-supplies/[voucherNo]' as any,
      params: { voucherNo: 'new', mode: 'copy' }
    });
  };

  // Totals calculations
  const totals = useMemo(() => {
    let totalQty = 0;
    let totalSecQty = 0;
    let totalDiscount = 0;
    let totalAddLess = 0;
    let totalAmount = 0;
    let customerCount = 0;

    lines.forEach(l => {
      const q = Number(l.qty) || 0;
      const sq = Number(l.secQty) || 0;
      const r = Number(l.rate) || 0;
      const sr = Number(l.secRate) || 0;
      const d = Number(l.discount) || 0;
      const c = Number((l as any).carriage) || 0;
      const al = Number(l.addLess) || 0;

      totalQty += q;
      totalSecQty += sq;
      totalDiscount += d;
      totalAddLess += al;
      const amt = ((q * r) + (sq * sr)) - d + c + al;
      totalAmount += amt;

      if (l.customerId) customerCount += 1;
    });

    return {
      qty: round(totalQty, 2),
      secQty: round(totalSecQty, 2),
      discount: round(totalDiscount, 2),
      addLess: round(totalAddLess, 2),
      amount: round(totalAmount, 2),
      customers: customerCount
    };
  }, [lines]);

  const itemOptions = useMemo(() => items.map(i => ({
    value: i.id,
    label: i.title,
    subtitle: `Code: ${i.id} • Rate: Rs. ${i.priRate || 0}`
  })), [items]);

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

  const customerOptions = useMemo(() => customers.map(c => {
    const catTitle = c.customerCategoryTitle || (c.customerCategoryId ? customerCategoryMap.get(c.customerCategoryId) : undefined);
    return {
      value: c.account,
      label: c.title,
      subtitle: `Acc: ${c.account}${c.parentCustomerTitle ? ` • Main: ${c.parentCustomerTitle}` : ''}`,
      badge: catTitle ? `Cat: ${catTitle}` : c.customerCategoryId ? `Cat: ${c.customerCategoryId}` : undefined,
    };
  }), [customers, customerCategoryMap]);

  const supplyOrderOptions = useMemo(() => supplyOrders.map(o => ({
    value: String(o.id),
    label: o.title,
    subtitle: `Order #${o.id}`
  })), [supplyOrders]);

  const narrationOptions = useMemo(() => narrations.map(n => ({
    value: n.code,
    label: n.title
  })), [narrations]);

  const filteredLines = useMemo(() => {
    if (!lineSearchQuery.trim()) return lines;
    const q = lineSearchQuery.toLowerCase();
    return lines.filter(line => {
      const customer = customers.find(c => c.account === line.customerId);
      const name = customer ? customer.title.toLowerCase() : '';
      const acc = line.customerId.toLowerCase();
      return name.includes(q) || acc.includes(q);
    });
  }, [lines, lineSearchQuery, customers]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>Loading Supply Sheet...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: isEdit ? `Supply #${voucherNo}` : 'New Sale Supply',
          headerBackTitle: 'Back',
          headerRight: () => (
            <View style={styles.headerRightActions}>
              {isEdit && (
                <>
                  <TouchableOpacity onPress={handleCopy} style={styles.headerIconBtn}>
                    <Ionicons name="copy-outline" size={20} color={Theme.colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDelete} disabled={deleting} style={styles.headerIconBtn}>
                    <Ionicons name="trash-outline" size={20} color={Theme.colors.danger} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          )
        }}
      />

      <KeyboardAwareContainer 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: isKeyboardVisible ? 24 : 40 }}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Animated.View entering={FadeInDown.duration(300)} style={styles.card}>
            <TouchableOpacity
              style={styles.cardHeaderToggle}
              onPress={() => setHeaderExpanded(prev => !prev)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Ionicons name="document-text-outline" size={20} color={Theme.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Sheet Information</Text>
                  <Text style={styles.cardSubtitle} numberOfLines={1}>
                    {dayjs(date).format('DD-MMM-YYYY')} • {selectedMasterItem ? selectedMasterItem.title : 'Select Master Item'}
                  </Text>
                </View>
              </View>
              <Ionicons
                name={headerExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={Theme.colors.textSecondary}
              />
            </TouchableOpacity>

            <View style={{ marginTop: Theme.spacing.sm }}>
              <InlineSearchSelect
                label="Master Item *"
                options={itemOptions}
                value={itemId}
                onSelect={(val) => {
                  const found = items.find(i => i.id === val);
                  if (found) handleItemSelect(found);
                }}
                placeholder="Search & select master item..."
                icon="cube-outline"
              />
            </View>

            {headerExpanded && (
              <View style={{ marginTop: Theme.spacing.xs }}>
                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                    <Text style={styles.label}>Voucher #</Text>
                    <TextInput
                      style={[styles.textInput, styles.readOnlyInput]}
                      value={voucherNo !== 'new' ? voucherNo : 'AUTO'}
                      editable={false}
                    />
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Date *</Text>
                    <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDatePicker(true)}>
                      <Ionicons name="calendar-outline" size={16} color={Theme.colors.textSecondary} />
                      <Text style={styles.dateText}>{dayjs(date).format('DD-MMM-YYYY')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

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

                {!isEdit && (
                  <View style={styles.inputGroup}>
                    <InlineSearchSelect
                      label="Supply Order (Optional Pre-fill)"
                      options={supplyOrderOptions}
                      value={supplyOrderId ? String(supplyOrderId) : ''}
                      onSelect={(val) => {
                        const found = supplyOrders.find(o => String(o.id) === val);
                        if (found) handleSupplyOrderSelect(found);
                      }}
                      placeholder="Select Supply Order profile to pre-fill..."
                      icon="list-outline"
                      clearable
                    />
                  </View>
                )}

                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 4,
                    paddingVertical: 6,
                  }}
                  onPress={() => setNotesExpanded((p) => !p)}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: Theme.colors.primary }}>
                    {notesExpanded || Boolean(narration || description)
                      ? 'Hide Notes / Narration'
                      : '+ Narration & Notes'}
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

                {(notesExpanded || Boolean(narration || description)) && (
                  <>
                    <View style={styles.inputGroup}>
                      <InlineSearchSelect
                        label="Narration"
                        options={narrationOptions}
                        value={narration}
                        onSelect={setNarration}
                        placeholder="Select Narration..."
                        clearable
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Remarks / Description</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="Optional vehicle or delivery notes"
                        placeholderTextColor={Theme.colors.textSecondary}
                        value={description}
                        onChangeText={setDescription}
                      />
                    </View>
                  </>
                )}
              </View>
            )}
          </Animated.View>

          {savedAttachments.length > 0 && (
            <View style={styles.attachmentsCard}>
              <View style={styles.attachmentsHeader}>
                <Ionicons name="attach-outline" size={18} color={Theme.colors.primary} />
                <Text style={styles.attachmentsTitle}>Saved Attachments ({savedAttachments.length})</Text>
              </View>
              {savedAttachments.map(att => (
                <View key={att.id} style={styles.attachmentRow}>
                  <TouchableOpacity
                    style={styles.attachmentInfo}
                    onPress={() => {
                      const url = att.fileUrl || att.downloadUrl;
                      if (url) Linking.openURL(url);
                    }}
                  >
                    <Ionicons name="document-attach-outline" size={16} color={Theme.colors.primary} />
                    <Text style={styles.attachmentName} numberOfLines={1}>
                      {att.fileName || att.description || `Attachment #${att.id}`}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteAttachment(att)} style={{ padding: 4 }}>
                    <Ionicons name="trash-outline" size={16} color={Theme.colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Fast Inline Customer Add Bar */}
          <View style={styles.quickAddCustomerCard}>
            <InlineSearchSelect
              label="Quick Add Customer Delivery"
              options={customerOptions}
              value=""
              onSelect={handleQuickAddCustomer}
              placeholder="Tap to search & append customer row..."
              icon="person-add-outline"
            />
          </View>

          <View style={styles.linesHeader}>
            <View>
              <Text style={styles.linesTitle}>Customer Deliveries</Text>
              <Text style={styles.linesSubtitle}>{totals.customers} Active • {lines.length} Total Rows</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.addLineBtn, { backgroundColor: '#7c3aed' }]}
                onPress={() => setScanModalVisible(true)}
              >
                <Ionicons name="camera-outline" size={16} color={Theme.colors.white} />
                <Text style={styles.addLineText}>AI Scan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addLineBtn} onPress={addLine}>
                <Ionicons name="add" size={16} color={Theme.colors.white} />
                <Text style={styles.addLineText}>Blank Row</Text>
              </TouchableOpacity>
            </View>
          </View>

          {lines.length > 4 && (
            <View style={styles.searchBarContainer}>
              <Ionicons name="search" size={18} color={Theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchBarInput}
                placeholder="Filter customers in sheet..."
                placeholderTextColor={Theme.colors.textSecondary}
                value={lineSearchQuery}
                onChangeText={setLineSearchQuery}
              />
              {lineSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setLineSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={Theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {filteredLines.map((line, index) => {
            const lineAmount = (((line.qty * line.rate) + ((line.secQty ?? 0) * (line.secRate ?? 0))) - line.discount) + (line.carriage || 0) + line.addLess;
            return (
              <Animated.View key={line.seq} entering={FadeInUp.delay(Math.min(index * 25, 250)).duration(300)} style={styles.lineCard}>
                <View style={styles.lineCardHeader}>
                  <Text style={styles.lineSeq}>#{index + 1}</Text>
                  <Text style={styles.lineInlineTotal}>
                    Rs. {lineAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  <TouchableOpacity onPress={() => removeLine(line.seq)} disabled={lines.length === 1}>
                    <Ionicons name="trash-outline" size={18} color={lines.length === 1 ? Theme.colors.border : Theme.colors.danger} />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <InlineSearchSelect
                    options={customerOptions}
                    value={line.customerId}
                    onSelect={(val) => handleCustomerSelect(line.seq, val)}
                    placeholder="Select Customer..."
                    icon="person-outline"
                    compact
                  />
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 6 }]}>
                    <Text style={styles.label}>{showPackQty ? 'Single Qty' : 'Qty *'}</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0"
                      placeholderTextColor={Theme.colors.textSecondary}
                      value={String(line.qty)}
                      onChangeText={(val) => updateLineField(line.seq, 'qty', val)}
                      keyboardType="numeric"
                      selectTextOnFocus
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 6 }]}>
                    <Text style={styles.label}>{showPackQty ? 'Single Rate' : 'Rate *'}</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0.00"
                      placeholderTextColor={Theme.colors.textSecondary}
                      value={String(line.rate)}
                      onChangeText={(val) => updateLineField(line.seq, 'rate', val)}
                      keyboardType="numeric"
                      selectTextOnFocus
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 0.8, marginRight: 6 }]}>
                    <Text style={styles.label}>Disc</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0"
                      placeholderTextColor={Theme.colors.textSecondary}
                      value={String(line.discount)}
                      onChangeText={(val) => updateLineField(line.seq, 'discount', val)}
                      keyboardType="numeric"
                      selectTextOnFocus
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 0.8 }]}>
                    <Text style={styles.label}>Add/Less</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0"
                      placeholderTextColor={Theme.colors.textSecondary}
                      value={String(line.addLess)}
                      onChangeText={(val) => updateLineField(line.seq, 'addLess', val)}
                      keyboardType="numeric"
                      selectTextOnFocus
                    />
                  </View>
                </View>

                {showPackQty && (
                  <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                      <Text style={styles.label}>
                        Pack Qty{line.secUnit || selectedMasterItem?.secondaryUnit ? ` (${line.secUnit || selectedMasterItem?.secondaryUnit})` : ''}
                      </Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="0"
                        placeholderTextColor={Theme.colors.textSecondary}
                        value={String(line.secQty ?? 0)}
                        onChangeText={(val) => updateLineField(line.seq, 'secQty', val)}
                        keyboardType="numeric"
                        selectTextOnFocus
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Pack Rate</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="0.00"
                        placeholderTextColor={Theme.colors.textSecondary}
                        value={String(line.secRate ?? 0)}
                        onChangeText={(val) => updateLineField(line.seq, 'secRate', val)}
                        keyboardType="numeric"
                        selectTextOnFocus
                      />
                    </View>
                  </View>
                )}
              </Animated.View>
            );
          })}
          <View style={{ height: 130 }} />
        </ScrollView>
      </KeyboardAwareContainer>

      <View style={styles.footer}>
        <View style={styles.totalsSummary}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Qty: <Text style={styles.totalValue}>{totals.qty.toLocaleString()}</Text></Text>
            {showPackQty && (
              <Text style={styles.totalLabel}>Pack Qty: <Text style={styles.totalValue}>{totals.secQty.toLocaleString()}</Text></Text>
            )}
            <Text style={styles.grandTotalValue}>Rs. {totals.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.saveBtn, saving && styles.btnDisabled]} 
          onPress={handleSave} 
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Theme.colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color={Theme.colors.white} />
              <Text style={styles.saveBtnText}>{isEdit ? 'Update Supply' : 'Save Supply'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScanSupplySheetModal
        visible={scanModalVisible}
        onClose={() => setScanModalVisible(false)}
        customers={customers}
        initialDate={dayjs(date).format('YYYY-MM-DD')}
        onImportLines={handleImportScannedLines}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.background
  },
  loadingText: {
    marginTop: Theme.spacing.md,
    fontSize: Theme.typography.sizes.body,
    color: Theme.colors.textSecondary
  },
  content: {
    flex: 1,
    padding: Theme.spacing.md
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm
  },
  headerIconBtn: {
    padding: Theme.spacing.xs
  },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.colors.border
  },
  cardHeaderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  cardTitle: {
    fontSize: Theme.typography.sizes.body,
    fontWeight: 'bold',
    color: Theme.colors.text
  },
  cardSubtitle: {
    fontSize: Theme.typography.sizes.caption,
    color: Theme.colors.textSecondary,
    marginTop: 2
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  inputGroup: {
    marginBottom: Theme.spacing.xs
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
    marginBottom: 3
  },
  textInput: {
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: Theme.spacing.sm,
    height: 38,
    fontSize: Theme.typography.sizes.body,
    color: Theme.colors.text
  },
  readOnlyInput: {
    backgroundColor: Theme.colors.background,
    color: Theme.colors.textSecondary
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: Theme.spacing.sm,
    height: 38,
    gap: Theme.spacing.xs
  },
  dateText: {
    fontSize: Theme.typography.sizes.body,
    color: Theme.colors.text
  },
  attachmentsCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.colors.border
  },
  attachmentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6
  },
  attachmentsTitle: {
    fontSize: Theme.typography.sizes.caption,
    fontWeight: '700',
    color: Theme.colors.text
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border
  },
  attachmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1
  },
  attachmentName: {
    fontSize: Theme.typography.sizes.caption,
    color: Theme.colors.primary,
    textDecorationLine: 'underline',
    flex: 1
  },
  quickAddCustomerCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.colors.primary + '40'
  },
  linesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Theme.spacing.xs,
    marginBottom: Theme.spacing.sm
  },
  linesTitle: {
    fontSize: Theme.typography.sizes.body,
    fontWeight: 'bold',
    color: Theme.colors.text
  },
  linesSubtitle: {
    fontSize: Theme.typography.sizes.caption,
    color: Theme.colors.textSecondary
  },
  addLineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.primary,
    paddingVertical: 6,
    paddingHorizontal: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.sm,
    gap: 4
  },
  addLineText: {
    color: Theme.colors.white,
    fontWeight: '600',
    fontSize: Theme.typography.sizes.caption
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: Theme.spacing.sm,
    height: 38,
    marginBottom: Theme.spacing.sm
  },
  searchBarInput: {
    flex: 1,
    fontSize: Theme.typography.sizes.body,
    color: Theme.colors.text
  },
  lineCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.colors.border
  },
  lineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  lineSeq: {
    fontSize: Theme.typography.sizes.caption,
    fontWeight: 'bold',
    color: Theme.colors.primary
  },
  lineInlineTotal: {
    fontSize: Theme.typography.sizes.body,
    fontWeight: 'bold',
    color: Theme.colors.primary
  },
  footer: {
    backgroundColor: Theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0
  },
  totalsSummary: {
    marginBottom: 6
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  totalLabel: {
    fontSize: Theme.typography.sizes.caption,
    color: Theme.colors.textSecondary
  },
  totalValue: {
    fontSize: Theme.typography.sizes.caption,
    fontWeight: '700',
    color: Theme.colors.text
  },
  grandTotalValue: {
    fontSize: Theme.typography.sizes.h3,
    fontWeight: 'bold',
    color: Theme.colors.primary
  },
  saveBtn: {
    backgroundColor: Theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: Theme.borderRadius.md,
    gap: Theme.spacing.xs
  },
  btnDisabled: {
    opacity: 0.6
  },
  saveBtnText: {
    color: Theme.colors.white,
    fontSize: Theme.typography.sizes.body,
    fontWeight: 'bold'
  }
});
