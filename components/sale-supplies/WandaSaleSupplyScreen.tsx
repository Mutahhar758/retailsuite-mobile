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
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import dayjs from 'dayjs';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Theme } from '../../constants/theme';
import { saleSupplyService, SaleSupplyLineRequest } from '../../services/saleSupplyService';
import { chartOfAccountService, ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { narrationService, NarrationDto } from '../../services/narrationService';
import { inventoryService, Item, Unit } from '../../services/inventoryService';
import { supplyOrderService, SupplyOrder } from '../../services/supplyOrderService';
import { customerService } from '../../services/customerService';
import { round } from '../../utils/numberUtils';

export function WandaSaleSupplyScreen() {
  const { voucherNo, mode } = useLocalSearchParams<{ voucherNo: string; mode?: string }>();
  const router = useRouter();
  
  const isEdit = voucherNo !== 'new' && mode !== 'copy';

  const [loading, setLoading] = useState(voucherNo !== 'new');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Lookups
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [supplyOrders, setSupplyOrders] = useState<SupplyOrder[]>([]);

  // Header State
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [itemId, setItemId] = useState('');
  const [narration, setNarration] = useState('');
  const [description, setDescription] = useState('');
  const [supplyOrderId, setSupplyOrderId] = useState<number | null>(null);

  // Lines State
  const [lines, setLines] = useState<SaleSupplyLineRequest[]>([
    { seq: 1, customerId: '', unit: '', qty: 1, rate: 0, discount: 0, addLess: 0, secQty: 0, secRate: 0, packQty: 0, packing: 0 }
  ]);

  // Modal State for Selectors
  const [selectModalVisible, setSelectModalVisible] = useState(false);
  const [selectModalType, setSelectModalType] = useState<'item' | 'customer' | 'narration' | 'supplyOrder'>('item');
  const [activeLineSeq, setActiveLineSeq] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lineSearchQuery, setLineSearchQuery] = useState('');

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
      const [cusData, narData, itemData, unitData, orderData] = await Promise.all([
        chartOfAccountService.getCustomerAccounts(),
        narrationService.getActiveNarrationsLookup(),
        inventoryService.getItemsLookup(),
        inventoryService.getUnitsLookup(),
        supplyOrderService.getList()
      ]);
      setCustomers(cusData);
      setNarrations(narData);
      setItems(itemData);
      setUnits(unitData);
      setSupplyOrders(orderData);
    } catch (error) {
      console.error('Failed to load lookups', error);
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
          secUnit: d.secUnit,
          packQty: (d as any).qtyInPack || ((d.qty > 0 && d.secQty && d.secQty > 0) ? round(d.qty / d.secQty, 2) : 0),
          packing: (d as any).packing || 0
        })));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load sale supply details');
    } finally {
      setLoading(false);
    }
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
      const isSec = selectedItem?.defaultUnit === selectedItem?.secondaryUnit;
      const baseRate = isSec ? (selectedItem?.secRate || 0) : (selectedItem?.priRate || 0);
      const pSize = Number(selectedItem?.qtyInPack || (selectedItem as any)?.QtyInPack || (selectedItem as any)?.qty_in_pack || 0);
      const baseSecRate = selectedItem?.secRate || (baseRate * (pSize > 0 ? pSize : 1));

      if (orderDetail && orderDetail.details) {
        const newLines: SaleSupplyLineRequest[] = orderDetail.details.map((d, index) => {
          const setting = customerQtyMap.get(d.customerId);
          const qty = setting ? setting.qty : 1;
          const secQty = setting ? (setting.secQty || 0) : 0;
          const lineRate = setting?.rate != null ? setting.rate : baseRate;
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
            secRate: baseSecRate,
            secUnit: selectedItem?.secondaryUnit || '',
            packQty: pSize,
            packing: pSize
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
    const pSize = Number(item.qtyInPack || (item as any).QtyInPack || (item as any).qty_in_pack || 0);
    const secRate = item.secRate || (defaultRate * (pSize > 0 ? pSize : 1));

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
            secRate,
            packQty: pSize,
            packing: pSize
          };
        }

        const setting = customerQtyMap.get(line.customerId);
        return {
          ...line,
          unit: item.defaultUnit || item.primaryUnit || '',
          qty: setting ? setting.qty : (line.qty || 1),
          secQty: setting ? (setting.secQty || 0) : (line.secQty || 0),
          rate: setting?.rate != null ? setting.rate : defaultRate,
          discount: setting?.discount != null ? setting.discount : (line.discount || 0),
          carriage: setting?.carriage != null ? setting.carriage : (line.carriage || 0),
          addLess: setting?.addLess != null ? setting.addLess : (line.addLess || 0),
          secRate,
          secUnit: item.secondaryUnit || '',
          packQty: pSize,
          packing: pSize
        };
      }));
    } catch (err) {
      console.error('Failed to fetch item defaults', err);
      setLines(lines.map(line => ({
        ...line,
        unit: item.defaultUnit || item.primaryUnit || '',
        rate: defaultRate,
        secUnit: item.secondaryUnit || '',
        secRate,
        packQty: pSize,
        packing: pSize
      })));
    }
  };

  const addLine = () => {
    const nextSeq = lines.length > 0 ? Math.max(...lines.map(l => l.seq)) + 1 : 1;
    
    let defaultUnit = '';
    let defaultRate = 0;
    let secUnit = '';
    let secRate = 0;
    let packQty = 0;
    let packing = 0;
    const selectedItem = items.find(i => i.id === itemId);
    
    if (selectedItem) {
      defaultUnit = selectedItem.defaultUnit || selectedItem.primaryUnit || '';
      defaultRate = selectedItem.priRate || 0;
      secUnit = selectedItem.secondaryUnit || '';
      const pSize = Number(selectedItem.qtyInPack || (selectedItem as any).QtyInPack || (selectedItem as any).qty_in_pack || 0);
      packQty = pSize;
      packing = pSize;
      secRate = selectedItem.secRate || (defaultRate * (pSize > 0 ? pSize : 1));
    }
    
    setLines([...lines, { seq: nextSeq, customerId: '', unit: defaultUnit, qty: 1, rate: defaultRate, discount: 0, addLess: 0, secQty: 0, secRate, secUnit, packQty, packing }]);
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

        let kgQty = updated.qty || 0;
        let bagQty = updated.secQty || 0;
        let packQty = (updated as any).packQty || 0;
        let packing = (updated as any).packing || 0;
        let kgRate = updated.rate || 0;
        let bagRate = updated.secRate || 0;

        if (field === 'qty') {
          kgQty = numVal;
          if (bagQty > 0) {
            packQty = round(kgQty / bagQty, 2);
          } else if (packQty > 0) {
            bagQty = round(kgQty / packQty, 2);
          }
        } else if (field === 'secQty') {
          bagQty = numVal;
          if (packQty > 0) {
            kgQty = round(bagQty * packQty, 2);
          } else if (kgQty > 0) {
            packQty = round(kgQty / bagQty, 2);
          }
        } else if (field === 'packQty') {
          packQty = numVal;
          if (bagQty > 0) {
            kgQty = round(bagQty * packQty, 2);
          } else if (kgQty > 0) {
            bagQty = round(kgQty / packQty, 2);
          }
        } else if (field === 'packing') {
          packing = numVal;
          if (packing > 0) {
            if (bagRate > 0) {
              kgRate = round(bagRate / packing, 4);
            } else if (kgRate > 0) {
              bagRate = round(kgRate * packing, 4);
            }
          }
        } else if (field === 'rate') {
          kgRate = numVal;
          if (packing > 0) {
            bagRate = round(kgRate * packing, 4);
          }
        } else if (field === 'secRate') {
          bagRate = numVal;
          if (packing > 0) {
            kgRate = round(bagRate / packing, 4);
          }
        }

        updated.qty = round(kgQty, 2);
        updated.secQty = round(bagQty, 2);
        (updated as any).packQty = round(packQty, 2);
        (updated as any).packing = round(packing, 2);
        updated.rate = round(kgRate, 4);
        updated.secRate = round(bagRate, 4);

        if (field === 'discount') updated.discount = numVal;
        if (field === 'addLess') updated.addLess = numVal;

        return updated;
      }
      return l;
    }));
  };

  const handleCustomerSelect = async (seq: number, customerId: string) => {
    const selectedItem = items.find(i => i.id === itemId);
    const isSec = selectedItem?.defaultUnit === selectedItem?.secondaryUnit;
    const baseRate = isSec ? (selectedItem?.secRate || 0) : (selectedItem?.priRate || 0);
    const pSize = Number(selectedItem?.qtyInPack || (selectedItem as any)?.QtyInPack || (selectedItem as any)?.qty_in_pack || 0);
    const secRate = selectedItem?.secRate || (baseRate * (pSize > 0 ? pSize : 1));

    let defQty = 1;
    let defSecQty = 0;
    let defRate = baseRate;
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

    updateLine(seq, {
      customerId,
      qty: defQty,
      secQty: defSecQty,
      rate: defRate,
      discount: defDiscount,
      addLess: defAddLess,
      secRate,
      unit: selectedItem?.defaultUnit || selectedItem?.primaryUnit || '',
      secUnit: selectedItem?.secondaryUnit || '',
      packQty: pSize,
      packing: pSize
    });
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
          secRate: Number(l.secRate) || 0,
          qtyInPack: (l as any).packQty || null,
          packing: (l as any).packing || null
        }))
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
      const d = Number(l.discount) || 0;
      const c = Number(l.carriage) || 0;
      const al = Number(l.addLess) || 0;

      totalQty += q;
      totalSecQty += sq;
      totalDiscount += (d * q);
      totalAddLess += al;
      const amt = (q * (r - d)) + c + al;
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

  const openSelector = (type: 'item' | 'customer' | 'narration' | 'supplyOrder', lineSeq?: number) => {
    setSelectModalType(type);
    if (lineSeq !== undefined) setActiveLineSeq(lineSeq);
    setSearchQuery('');
    setSelectModalVisible(true);
  };

  const filteredItems = items.filter(i => 
    i.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    i.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCustomers = customers.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.account.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredNarrations = narrations.filter(n => 
    n.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSupplyOrders = supplyOrders.filter(o => 
    o.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const getCustomerName = (accId: string) => {
    const c = customers.find(item => item.account === accId);
    return c ? `${c.title} (${c.account})` : 'Select Customer';
  };

  const getItemName = (id: string) => {
    const i = items.find(item => item.id === id);
    return i ? `${i.title} (${i.id})` : 'Select Item';
  };

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
          title: isEdit ? `Edit Sale Supply: ${voucherNo}` : 'New Sale Supply',
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

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.duration(400)} style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text-outline" size={20} color={Theme.colors.primary} />
              <Text style={styles.cardTitle}>Sheet Information</Text>
            </View>

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

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Master Item *</Text>
              <TouchableOpacity style={styles.selector} onPress={() => openSelector('item')}>
                <Text style={[styles.selectorText, !itemId && styles.placeholder]}>{getItemName(itemId)}</Text>
                <Ionicons name="chevron-down" size={16} color={Theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Supply Order (Optional Pre-fill)</Text>
              <TouchableOpacity 
                style={[styles.selector, isEdit && styles.readOnlyInput]} 
                onPress={() => !isEdit && openSelector('supplyOrder')}
                disabled={isEdit}
              >
                <Text style={[styles.selectorText, !supplyOrderId && styles.placeholder]}>
                  {supplyOrderId ? supplyOrders.find(o => o.id === supplyOrderId)?.title || `Order #${supplyOrderId}` : 'Select Order to Pre-fill'}
                </Text>
                {!isEdit && <Ionicons name="chevron-down" size={16} color={Theme.colors.textSecondary} />}
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Narration</Text>
              <TouchableOpacity style={styles.selector} onPress={() => openSelector('narration')}>
                <Text style={[styles.selectorText, !narration && styles.placeholder]}>
                  {narration ? narrations.find(n => n.code === narration)?.title || narration : 'Select Narration'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Theme.colors.textSecondary} />
              </TouchableOpacity>
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
          </Animated.View>

          <View style={styles.linesHeader}>
            <View>
              <Text style={styles.linesTitle}>Customer Deliveries</Text>
              <Text style={styles.linesSubtitle}>{lines.length} {lines.length === 1 ? 'Customer' : 'Customers'}</Text>
            </View>
            <TouchableOpacity style={styles.addLineBtn} onPress={addLine}>
              <Ionicons name="add" size={16} color={Theme.colors.white} />
              <Text style={styles.addLineText}>Add Line</Text>
            </TouchableOpacity>
          </View>

          {lines.length > 5 && (
            <View style={styles.searchBarContainer}>
              <Ionicons name="search" size={18} color={Theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchBarInput}
                placeholder="Search customers in lines..."
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
            const lineAmount = (line.qty * (line.rate - line.discount)) + (line.carriage || 0) + line.addLess;
            return (
              <Animated.View key={line.seq} entering={FadeInUp.delay(index * 50).duration(400)} style={styles.lineCard}>
                <View style={styles.lineCardHeader}>
                  <Text style={styles.lineSeq}>#{index + 1}</Text>
                  <TouchableOpacity onPress={() => removeLine(line.seq)} disabled={lines.length === 1}>
                    <Ionicons name="trash-outline" size={20} color={lines.length === 1 ? Theme.colors.border : Theme.colors.danger} />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Customer *</Text>
                  <TouchableOpacity style={styles.selector} onPress={() => openSelector('customer', line.seq)}>
                    <Text style={[styles.selectorText, !line.customerId && styles.placeholder]}>{getCustomerName(line.customerId)}</Text>
                    <Ionicons name="chevron-down" size={16} color={Theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                    <Text style={styles.label}>Qty (Kg) *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0"
                      placeholderTextColor={Theme.colors.textSecondary}
                      value={String(line.qty)}
                      onChangeText={(val) => updateLineField(line.seq, 'qty', val)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Bag Qty</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0"
                      placeholderTextColor={Theme.colors.textSecondary}
                      value={String(line.secQty ?? 0)}
                      onChangeText={(val) => updateLineField(line.seq, 'secQty', val)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                    <Text style={styles.label}>Pack Qty</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0"
                      placeholderTextColor={Theme.colors.textSecondary}
                      value={String((line as any).packQty ?? 0)}
                      onChangeText={(val) => updateLineField(line.seq, 'packQty', val)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Packing</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0"
                      placeholderTextColor={Theme.colors.textSecondary}
                      value={String((line as any).packing ?? 0)}
                      onChangeText={(val) => updateLineField(line.seq, 'packing', val)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                    <Text style={styles.label}>Rate (/Kg) *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0.00"
                      placeholderTextColor={Theme.colors.textSecondary}
                      value={String(line.rate)}
                      onChangeText={(val) => updateLineField(line.seq, 'rate', val)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Bag Rate</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0.00"
                      placeholderTextColor={Theme.colors.textSecondary}
                      value={String(line.secRate ?? 0)}
                      onChangeText={(val) => updateLineField(line.seq, 'secRate', val)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                    <Text style={styles.label}>Disc (/Kg)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0.00"
                      placeholderTextColor={Theme.colors.textSecondary}
                      value={String(line.discount)}
                      onChangeText={(val) => updateLineField(line.seq, 'discount', val)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Add / Less</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0.00"
                      placeholderTextColor={Theme.colors.textSecondary}
                      value={String(line.addLess)}
                      onChangeText={(val) => updateLineField(line.seq, 'addLess', val)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.lineFooter}>
                  <Text style={styles.lineFooterLabel}>Line Total</Text>
                  <Text style={styles.lineFooterAmount}>Rs. {lineAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
              </Animated.View>
            );
          })}
          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <View style={styles.totalsSummary}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Qty:</Text>
            <Text style={styles.totalValue}>{totals.qty.toLocaleString()} Kg</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Bags:</Text>
            <Text style={styles.totalValue}>{totals.secQty.toLocaleString()}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount:</Text>
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

      <Modal
        visible={selectModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectModalVisible(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectModalType === 'item' && 'Select Master Item'}
                {selectModalType === 'customer' && 'Select Customer'}
                {selectModalType === 'narration' && 'Select Narration'}
                {selectModalType === 'supplyOrder' && 'Select Supply Order Profile'}
              </Text>
              <TouchableOpacity onPress={() => setSelectModalVisible(false)}>
                <Ionicons name="close" size={24} color={Theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchBox}>
              <Ionicons name="search" size={18} color={Theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search..."
                placeholderTextColor={Theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
            </View>

            <ScrollView style={styles.modalList}>
              {selectModalType === 'item' && filteredItems.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.modalListItem}
                  onPress={() => {
                    handleItemSelect(item);
                    setSelectModalVisible(false);
                  }}
                >
                  <View>
                    <Text style={styles.modalItemTitle}>{item.title}</Text>
                    <Text style={styles.modalItemSubtitle}>Code: {item.id} • Rate: Rs. {item.priRate || 0}/Kg</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Theme.colors.border} />
                </TouchableOpacity>
              ))}

              {selectModalType === 'customer' && filteredCustomers.map(cust => (
                <TouchableOpacity
                  key={cust.account}
                  style={styles.modalListItem}
                  onPress={() => {
                    if (activeLineSeq !== null) {
                      handleCustomerSelect(activeLineSeq, cust.account);
                    }
                    setSelectModalVisible(false);
                  }}
                >
                  <View>
                    <Text style={styles.modalItemTitle}>{cust.title}</Text>
                    <Text style={styles.modalItemSubtitle}>Account: {cust.account}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Theme.colors.border} />
                </TouchableOpacity>
              ))}

              {selectModalType === 'narration' && filteredNarrations.map(narr => (
                <TouchableOpacity
                  key={narr.code}
                  style={styles.modalListItem}
                  onPress={() => {
                    setNarration(narr.code);
                    setSelectModalVisible(false);
                  }}
                >
                  <Text style={styles.modalItemTitle}>{narr.title}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Theme.colors.border} />
                </TouchableOpacity>
              ))}

              {selectModalType === 'supplyOrder' && filteredSupplyOrders.map(order => (
                <TouchableOpacity
                  key={order.id}
                  style={styles.modalListItem}
                  onPress={() => {
                    handleSupplyOrderSelect(order);
                    setSelectModalVisible(false);
                  }}
                >
                  <View>
                    <Text style={styles.modalItemTitle}>{order.title}</Text>
                    <Text style={styles.modalItemSubtitle}>ID: #{order.id}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Theme.colors.border} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
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
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.border
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    gap: Theme.spacing.xs
  },
  cardTitle: {
    fontSize: Theme.typography.sizes.h3,
    fontWeight: 'bold',
    color: Theme.colors.text
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  inputGroup: {
    marginBottom: Theme.spacing.sm
  },
  label: {
    fontSize: Theme.typography.sizes.caption,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
    marginBottom: 4
  },
  textInput: {
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: Theme.spacing.sm,
    height: 40,
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
    height: 40,
    gap: Theme.spacing.xs
  },
  dateText: {
    fontSize: Theme.typography.sizes.body,
    color: Theme.colors.text
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: Theme.spacing.sm,
    height: 40
  },
  selectorText: {
    fontSize: Theme.typography.sizes.body,
    color: Theme.colors.text,
    flex: 1
  },
  placeholder: {
    color: Theme.colors.textSecondary
  },
  linesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm
  },
  linesTitle: {
    fontSize: Theme.typography.sizes.h3,
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
    paddingVertical: Theme.spacing.xs,
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
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.colors.border
  },
  lineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.xs
  },
  lineSeq: {
    fontSize: Theme.typography.sizes.caption,
    fontWeight: 'bold',
    color: Theme.colors.primary
  },
  lineFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Theme.spacing.xs,
    paddingTop: Theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border
  },
  lineFooterLabel: {
    fontSize: Theme.typography.sizes.caption,
    fontWeight: 'bold',
    color: Theme.colors.textSecondary
  },
  lineFooterAmount: {
    fontSize: Theme.typography.sizes.body,
    fontWeight: 'bold',
    color: Theme.colors.primary
  },
  footer: {
    backgroundColor: Theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    padding: Theme.spacing.md,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0
  },
  totalsSummary: {
    marginBottom: Theme.spacing.sm
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2
  },
  totalLabel: {
    fontSize: Theme.typography.sizes.caption,
    color: Theme.colors.textSecondary
  },
  totalValue: {
    fontSize: Theme.typography.sizes.caption,
    fontWeight: '600',
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
    height: 48,
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: Theme.colors.surface,
    borderTopLeftRadius: Theme.borderRadius.lg,
    borderTopRightRadius: Theme.borderRadius.lg,
    maxHeight: '80%',
    padding: Theme.spacing.md
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md
  },
  modalTitle: {
    fontSize: Theme.typography.sizes.h3,
    fontWeight: 'bold',
    color: Theme.colors.text
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: Theme.spacing.sm,
    height: 40,
    marginBottom: Theme.spacing.md
  },
  modalSearchInput: {
    flex: 1,
    fontSize: Theme.typography.sizes.body,
    color: Theme.colors.text
  },
  modalList: {
    maxHeight: 400
  },
  modalListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border
  },
  modalItemTitle: {
    fontSize: Theme.typography.sizes.body,
    fontWeight: '600',
    color: Theme.colors.text
  },
  modalItemSubtitle: {
    fontSize: Theme.typography.sizes.caption,
    color: Theme.colors.textSecondary,
    marginTop: 2
  }
});
