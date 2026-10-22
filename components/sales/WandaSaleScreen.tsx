import React, { useEffect, useState, useMemo, useRef } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeInDown } from 'react-native-reanimated';
import dayjs from 'dayjs';
import { Theme } from '../../constants/theme';
import { extractErrorMessage } from '../../services/api';
import { saleService, SaleLineRequest } from '../../services/saleService';
import { chartOfAccountService, ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { narrationService, NarrationDto } from '../../services/narrationService';
import { inventoryService, Item, Unit } from '../../services/inventoryService';
import { useAppStore } from '../../store/appStore';
import {
  MobileSaleReceiptModal,
  type MobileSaleReceiptData,
  type MobileSaleReceiptLine
} from './MobileSaleReceiptModal';
import { round } from '../../utils/numberUtils';

export function WandaSaleScreen() {
  const { voucherNo, mode } = useLocalSearchParams<{ voucherNo: string; mode?: string }>();
  const router = useRouter();
  const isEdit = voucherNo && voucherNo !== 'new' && mode !== 'copy';

  const { currentTenantIdentifier, licenses } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Lookups
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // Form State
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customerAccount, setCustomerAccount] = useState('');
  const [narration, setNarration] = useState('');
  const [description, setDescription] = useState('');
  const [cashReceipt, setCashReceipt] = useState<string>('');
  const [cashBack, setCashBack] = useState<string>('0');
  const prevTotalRef = useRef<number>(0);
  
  // Lines State
  const [lines, setLines] = useState<SaleLineRequest[]>([]);

  // Receipt Modal State
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [activeReceiptData, setActiveReceiptData] = useState<MobileSaleReceiptData | null>(null);
  const justSavedRef = useRef(false);
  
  // Line Modal State
  const [lineModalVisible, setLineModalVisible] = useState(false);
  const [currentLine, setCurrentLine] = useState<Partial<SaleLineRequest>>({});

  // Searchable Selection Modal State
  const [selectModalVisible, setSelectModalVisible] = useState(false);
  const [selectModalType, setSelectModalType] = useState<'customer' | 'narration' | 'item'>('customer');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLookups();
  }, []);

  const fetchLookups = async () => {
    try {
      const [custs, narrs, itms, unts] = await Promise.all([
        chartOfAccountService.getCustomerAccounts(),
        narrationService.getActiveNarrationsLookup(),
        inventoryService.getItemsLookup(),
        inventoryService.getUnitsLookup()
      ]);
      setCustomers(custs || []);
      setNarrations(narrs || []);
      setItems(itms || []);
      setUnits(unts || []);
      
      if (voucherNo && voucherNo !== 'new') {
        await loadVoucherDetails();
      } else {
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
      const details = await saleService.getDetail(voucherNo!);
      if (details && details.length > 0) {
        const first = details[0];
        setDate(mode === 'copy' ? new Date() : new Date(first.date));
        setCustomerAccount(first.accountId);
        setNarration(first.narrationId || '');
        setDescription(first.description || '');
        if (first.cashReceipt !== undefined && first.cashReceipt !== null) {
          setCashReceipt(String(first.cashReceipt));
          setCashBack(String(first.cashBack || 0));
        }
        
        const mappedLines: SaleLineRequest[] = details.map(d => ({
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
          packQty: (d as any).qtyInPack || ((d.qty > 0 && d.secQty && d.secQty > 0) ? round(d.qty / d.secQty, 2) : 0),
          packing: (d as any).packing || 0
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

  const openSelectModal = (type: 'customer' | 'narration' | 'item') => {
    setSelectModalType(type);
    setSearchQuery('');
    setSelectModalVisible(true);
  };

  const handleSelect = (val: string) => {
    if (selectModalType === 'customer') {
      setCustomerAccount(val);
    } else if (selectModalType === 'narration') {
      setNarration(val);
    } else if (selectModalType === 'item') {
      const selectedItem = items.find(i => i.id === val);
      let defaultRate = 0;
      let secRate = 0;
      let packQty = 0;
      let packing = 0;
      if (selectedItem) {
        const pSize = Number(selectedItem.qtyInPack || (selectedItem as any).QtyInPack || (selectedItem as any).qty_in_pack || 0);
        packQty = pSize;
        packing = pSize;
        secRate = selectedItem.secRate || ((selectedItem.priRate || 0) * (pSize > 0 ? pSize : 1));
        defaultRate = (pSize > 0 && secRate > 0) ? round(secRate / pSize, 8) : (selectedItem.priRate || 0);
      }
      setCurrentLine(prev => ({
        ...prev,
        itemId: val,
        unit: selectedItem?.defaultUnit || selectedItem?.primaryUnit || undefined,
        rate: defaultRate,
        discount: prev.discount || 0,
        secUnit: selectedItem?.secondaryUnit || undefined,
        secRate,
        secQty: 0,
        packQty,
        packing
      }));
    }
    setSelectModalVisible(false);
  };

  const updateCurrentLineField = (field: string, val: string | number) => {
    setCurrentLine(prev => {
      const updated = { ...prev };
      const cleanVal = typeof val === 'string' ? val.replace(/,/g, '') : val;
      const numVal = (cleanVal !== null && cleanVal !== undefined && cleanVal !== '' && !isNaN(Number(cleanVal))) ? Number(cleanVal) : 0;

      let kgQty = updated.qty || 0;
      let bagQty = updated.secQty || 0;
      let packQty = updated.packQty || 0;
      let packing = updated.packing || 0;
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
            kgRate = round(bagRate / packing, 8);
          } else if (kgRate > 0) {
            bagRate = round(kgRate * packing, 2);
          }
        }
      } else if (field === 'rate') {
        if (updated.rate && round(numVal, 2) === round(updated.rate, 2)) {
          kgRate = updated.rate;
        } else {
          kgRate = numVal;
          if (packing > 0) {
            bagRate = round(kgRate * packing, 2);
          }
        }
      } else if (field === 'secRate') {
        if (updated.secRate && round(numVal, 2) === round(updated.secRate, 2)) {
          bagRate = updated.secRate;
        } else {
          bagRate = numVal;
          if (packing > 0) {
            kgRate = round(bagRate / packing, 8);
          }
        }
      } else if (field === 'discount') {
        updated.discount = numVal;
      }

      updated.qty = round(kgQty, 2);
      updated.secQty = round(bagQty, 2);
      updated.packQty = round(packQty, 2);
      updated.packing = round(packing, 2);
      updated.rate = round(kgRate, 8);
      updated.secRate = round(bagRate, 2);
      return updated;
    });
  };

  const openLineModal = (line?: SaleLineRequest) => {
    if (line) {
      setCurrentLine({ ...line });
    } else {
      const maxSeq = lines.reduce((max, l) => Math.max(max, l.seq), 0);
      setCurrentLine({
        seq: maxSeq + 1,
        itemId: '',
        unit: 'Kg',
        qty: 1,
        rate: 0,
        discount: 0,
        secQty: 0,
        secRate: 0,
        secUnit: 'Bag',
        packQty: 0,
        packing: 0
      });
    }
    setLineModalVisible(true);
  };

  const saveLine = () => {
    if (!currentLine.itemId || !currentLine.qty || currentLine.qty <= 0) {
      Alert.alert('Validation Error', 'Item and a valid quantity are required.');
      return;
    }
    
    setLines(prev => {
      const exists = prev.findIndex(l => l.seq === currentLine.seq);
      if (exists >= 0) {
        const newLines = [...prev];
        newLines[exists] = currentLine as SaleLineRequest;
        return newLines;
      }
      return [...prev, currentLine as SaleLineRequest];
    });
    setLineModalVisible(false);
  };

  const removeLine = async (seq: number) => {
    if (isEdit) {
      try {
        await saleService.deleteLine(voucherNo!, seq);
      } catch (error) {
        Alert.alert('Error', 'Failed to delete line from database.');
        return;
      }
    }
    setLines(prev => prev.filter(l => l.seq !== seq));
  };

  // Dual-unit Totals calculations
  const totalQty = useMemo(() => {
    return lines.reduce((sum, l) => sum + (l.qty || 0), 0);
  }, [lines]);

  const totalBags = useMemo(() => {
    return lines.reduce((sum, l) => sum + (l.secQty || 0), 0);
  }, [lines]);

  const grossAmount = useMemo(() => {
    return lines.reduce((sum, l) => {
      return sum + ((l.qty || 0) * (l.rate || 0));
    }, 0);
  }, [lines]);

  const totalDiscount = useMemo(() => {
    return lines.reduce((sum, l) => sum + (l.discount || 0), 0);
  }, [lines]);

  const netAmount = useMemo(() => {
    return lines.reduce((sum, l) => {
      const carriageAmt = ((l.secQty || 0) * (l.carriage || 0));
      return sum + (((l.qty || 0) * (l.rate || 0)) - (l.discount || 0) + carriageAmt);
    }, 0);
  }, [lines]);

  const numCashReceipt = parseFloat(cashReceipt) || 0;
  const numCashBack = parseFloat(cashBack) || 0;
  const balanceDue = netAmount - numCashReceipt + numCashBack;

  const getUnitTitle = (codeOrTitle?: string | null, item?: Item | null) => {
    if (!codeOrTitle && !item) return '';
    const clean = String(codeOrTitle || '').trim();
    if (clean) {
      const u = units.find(x => 
        x.code?.toLowerCase() === clean.toLowerCase() || 
        x.title?.toLowerCase() === clean.toLowerCase()
      );
      if (u) return (u.shortTitle && u.shortTitle.trim()) || u.title;
    }
    if (item) {
      if (clean && item.primaryUnit?.toLowerCase() === clean.toLowerCase() && item.primaryUnitTitle) {
        return item.primaryUnitTitle;
      }
      if (clean && (item as any).defaultUnit?.toLowerCase() === clean.toLowerCase() && (item as any).defaultUnitTitle) {
        return (item as any).defaultUnitTitle;
      }
      if (clean && item.secondaryUnit?.toLowerCase() === clean.toLowerCase() && item.secondaryUnitTitle) {
        return item.secondaryUnitTitle;
      }
      if (!clean && (item.primaryUnitTitle || (item as any).defaultUnitTitle)) {
        return item.primaryUnitTitle || (item as any).defaultUnitTitle;
      }
    }
    if (/^\d+$/.test(clean)) return '';
    return clean;
  };

  const buildReceiptData = (voucherNum?: string, isReprint: boolean = false): MobileSaleReceiptData | null => {
    if (lines.length === 0) return null;
    const customer = customers.find(c => c.account === customerAccount);
    const narr = narrations.find(n => n.code === narration);

    const receiptLines: MobileSaleReceiptLine[] = lines.map((l, idx) => {
      const itm = items.find(i => String(i.id) === String(l.itemId));
      const q = Number(l.qty) || 0;
      const r = Number(l.rate) || 0;
      const d = Number(l.discount) || 0;
      const resolvedUnit = itm?.itemType === 'Service' ? '' : (getUnitTitle(l.unit, itm) || '');
      return {
        seq: l.seq || idx + 1,
        itemTitle: itm?.title || `Item #${l.itemId}`,
        qty: q,
        unit: resolvedUnit,
        rate: r,
        discount: d,
        amount: (q * r) - d
      };
    });

    const received = parseFloat(cashReceipt) || 0;
    const change = parseFloat(cashBack) || 0;

    return {
      voucherNo: voucherNum || (isEdit ? `SL-${voucherNo}` : 'DRAFT'),
      date: date || new Date(),
      customerName: customer?.title || customerAccount || 'Walk-in Customer',
      customerPhone: (customer as any)?.phone,
      narration: narr?.title,
      description,
      lines: receiptLines,
      grossTotal: grossAmount,
      totalDiscount,
      netAmount,
      cashReceived: received,
      cashBack: change,
      balance: Math.max(0, netAmount - received),
      orgName: currentOrg?.name,
      isDuplicate: Boolean(isReprint || isEdit)
    };
  };

  // Auto sync cash receipt with net amount for rapid checkout
  useEffect(() => {
    if (!isEdit || mode === 'copy') {
      const isAutoSynced = !cashReceipt || parseFloat(cashReceipt) === 0 || parseFloat(cashReceipt) === prevTotalRef.current;
      if (isAutoSynced) {
        setCashReceipt(netAmount > 0 ? netAmount.toString() : '');
        setCashBack('0');
      } else {
        const excess = Math.max(0, numCashReceipt - netAmount);
        setCashBack(excess > 0 ? excess.toFixed(2) : '0');
      }
      prevTotalRef.current = netAmount;
    } else if (isEdit && !loading) {
      const excess = Math.max(0, numCashReceipt - netAmount);
      setCashBack(excess > 0 ? excess.toFixed(2) : '0');
    }
  }, [netAmount, isEdit, mode, loading]);

  const handleCashReceiptChange = (text: string) => {
    setCashReceipt(text);
    const received = parseFloat(text) || 0;
    if (received > netAmount) {
      setCashBack((received - netAmount).toFixed(2));
    } else {
      setCashBack('0');
    }
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
        seq: l.seq || (idx + 1),
        itemId: l.itemId,
        unit: l.unit || undefined,
        qty: Number(l.qty) || 0,
        rate: Number(l.rate) || 0,
        discount: Number(l.discount) || 0,
        carriage: Number(l.carriage) || 0,
        secQty: Number(l.secQty) || 0,
        secRate: Number(l.secRate) || 0,
        secUnit: (Number(l.secQty) > 0 && l.secUnit) ? l.secUnit : undefined,
        qtyInPack: (l as any).packQty || (l as any).qtyInPack || null,
        packing: (l as any).packing || null
      }));

      const request = {
        date: dayjs(date).format('YYYY-MM-DD'),
        account: customerAccount,
        narration: narration || undefined,
        description: description || undefined,
        cashReceipt: parseFloat(cashReceipt) || 0,
        cashBack: parseFloat(cashBack) || 0,
        lines: cleanedLines
      };

      if (isEdit) {
        await saleService.update(voucherNo!, request);
        if (shouldShowReceipt) {
          const receipt = buildReceiptData(`SL-${voucherNo}`, true);
          justSavedRef.current = true;
          setActiveReceiptData(receipt);
          setReceiptModalVisible(true);
        } else {
          Alert.alert('Success', 'Sale voucher updated successfully.', [{ text: 'OK', onPress: () => router.back() }]);
        }
      } else {
        const createdVoucher = await saleService.create(request);
        if (shouldShowReceipt) {
          const receipt = buildReceiptData(`SL-${createdVoucher}`, false);
          justSavedRef.current = true;
          setActiveReceiptData(receipt);
          setReceiptModalVisible(true);
        } else {
          Alert.alert('Success', 'Sale voucher created successfully.', [{ text: 'OK', onPress: () => router.back() }]);
        }
      }
    } catch (error: any) {
      console.error('Failed to save sale:', error?.response?.data || error);
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
            Alert.alert('Success', 'Sale deleted.', [{ text: 'OK', onPress: () => router.back() }]);
          } catch (error) {
            Alert.alert('Error', 'Failed to delete sale.');
            setSaving(false);
          }
        }
      }
    ]);
  };

  const handleCopyAsNew = () => {
    Alert.alert('Copy as New', 'Are you sure you want to duplicate this sale voucher?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Copy', 
        onPress: () => {
          setDate(new Date());
          router.replace({ pathname: '/sales/[voucherNo]' as any, params: { voucherNo: voucherNo, mode: 'copy' } });
        } 
      }
    ]);
  };

  // Filter items for searchable select modal
  const filteredModalList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (selectModalType === 'customer') {
      return customers.filter(c => 
        c.title.toLowerCase().includes(q) || c.account.toLowerCase().includes(q)
      );
    } else if (selectModalType === 'narration') {
      return narrations.filter(n => 
        n.title.toLowerCase().includes(q) || n.code.toLowerCase().includes(q)
      );
    } else if (selectModalType === 'item') {
      return items.filter(i => 
        i.title.toLowerCase().includes(q) || 
        (i.itemKey && i.itemKey.toLowerCase().includes(q)) ||
        (i.barcode && i.barcode.toLowerCase().includes(q))
      );
    }
    return [];
  }, [selectModalType, searchQuery, customers, narrations, items]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  const selectedCustomerObj = customers.find(c => c.account === customerAccount);
  const selectedNarrationObj = narrations.find(n => n.code === narration);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          
          {/* Master Details Section */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Master Details</Text>
              {isEdit ? (
                <View style={styles.voucherBadge}>
                  <Text style={styles.voucherBadgeText}>
                    SL-{String(voucherNo).padStart(5, '0')}
                  </Text>
                </View>
              ) : (
                <View style={[styles.voucherBadge, { backgroundColor: '#ecfdf5' }]}>
                  <Text style={[styles.voucherBadgeText, { color: '#059669' }]}>
                    {mode === 'copy' ? 'Duplicate Sale' : 'New Sale'}
                  </Text>
                </View>
              )}
            </View>

            {/* Date Picker */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Date *</Text>
              <TouchableOpacity 
                style={styles.dateSelector}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={Theme.colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.selectorText}>{dayjs(date).format('DD-MMM-YYYY')}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) setDate(selectedDate);
                  }}
                />
              )}
            </View>

            {/* Customer Selector */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Customer *</Text>
              <TouchableOpacity 
                style={styles.selector}
                onPress={() => openSelectModal('customer')}
              >
                <Text style={[styles.selectorText, !customerAccount && { color: Theme.colors.textSecondary }]}>
                  {selectedCustomerObj ? `${selectedCustomerObj.title} (${selectedCustomerObj.account})` : 'Select Customer'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={Theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Narration Selector */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Narration</Text>
              <TouchableOpacity 
                style={styles.selector}
                onPress={() => openSelectModal('narration')}
              >
                <Text style={[styles.selectorText, !narration && { color: Theme.colors.textSecondary }]}>
                  {selectedNarrationObj ? selectedNarrationObj.title : 'Select Narration (Optional)'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={Theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Description / Notes</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Optional comments or delivery notes"
                placeholderTextColor={Theme.colors.textSecondary}
                value={description}
                onChangeText={setDescription}
              />
            </View>
          </Animated.View>

          {/* Line Items Section */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.section}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.sectionTitle}>Sale Items ({lines.length})</Text>
                <Text style={styles.sectionSubtitle}>Dual-unit feed billing</Text>
              </View>
              <TouchableOpacity 
                style={styles.addBtn}
                onPress={() => openLineModal()}
              >
                <Ionicons name="add" size={18} color={Theme.colors.white} />
                <Text style={styles.addBtnText}>Add Item</Text>
              </TouchableOpacity>
            </View>

            {lines.length === 0 ? (
              <View style={styles.emptyLinesContainer}>
                <Ionicons name="cart-outline" size={40} color={Theme.colors.border} />
                <Text style={styles.emptyLinesText}>No items added yet. Tap "Add Item" above.</Text>
              </View>
            ) : (
              lines.map((line, index) => {
                const itemObj = items.find(i => i.id === line.itemId);
                const carriageAmt = ((line.secQty || 0) * (line.carriage || 0));
                const lineTotal = ((line.qty || 0) * (line.rate || 0)) - (line.discount || 0) + carriageAmt;

                return (
                  <View key={line.seq || index} style={styles.lineCard}>
                    <View style={styles.lineInfo}>
                      <Text style={styles.lineAccount} numberOfLines={1}>
                        {itemObj?.title || `Item #${line.itemId}`}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                        <Text style={styles.lineDetail}>
                          {line.qty} {getUnitTitle(line.unit, itemObj) || 'Kg'} ({line.secQty || 0} {getUnitTitle(line.secUnit) || 'Bags'}) @ Rs. {Number(line.rate || 0).toFixed(2)}/{getUnitTitle(line.unit, itemObj) || 'Kg'}
                          {line.discount > 0 ? ` (Disc: -Rs. ${line.discount})` : ''}
                        </Text>
                        {!!itemObj?.minSalePrice && Number(itemObj.minSalePrice) > 0 && Number(line.rate || 0) <= Number(itemObj.minSalePrice) && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <Ionicons name="warning" size={12} color="#D97706" style={{ marginRight: 2 }} />
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#B45309' }}>Min Cap (Rs. {itemObj.minSalePrice})</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.lineDetailSub}>
                        Bag Rate: Rs. {Number(line.secRate || 0).toFixed(2)} | Pack: {line.packQty || 0} | Packing: {line.packing || 0}
                      </Text>
                      <Text style={styles.lineAmount}>
                        Rs. {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </View>
                    <View style={styles.lineActions}>
                      <TouchableOpacity 
                        style={styles.actionBtn}
                        onPress={() => openLineModal(line)}
                      >
                        <Ionicons name="create-outline" size={20} color={Theme.colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.actionBtn}
                        onPress={() => removeLine(line.seq)}
                      >
                        <Ionicons name="trash-outline" size={20} color={Theme.colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}

            {/* Sub-totals bar */}
            {lines.length > 0 && (
              <View style={styles.subtotalsBar}>
                <View style={styles.subtotalCol}>
                  <Text style={styles.subtotalLabel}>Total Qty (Kg)</Text>
                  <Text style={styles.subtotalValue}>{totalQty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</Text>
                </View>
                <View style={styles.subtotalCol}>
                  <Text style={styles.subtotalLabel}>Total Bags</Text>
                  <Text style={styles.subtotalValue}>{totalBags.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</Text>
                </View>
                <View style={styles.subtotalCol}>
                  <Text style={styles.subtotalLabel}>Gross Amt</Text>
                  <Text style={styles.subtotalValue}>Rs. {grossAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</Text>
                </View>
                {totalDiscount > 0 && (
                  <View style={styles.subtotalCol}>
                    <Text style={[styles.subtotalLabel, { color: Theme.colors.danger }]}>Discount</Text>
                    <Text style={[styles.subtotalValue, { color: Theme.colors.danger }]}>-Rs. {totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</Text>
                  </View>
                )}
              </View>
            )}
          </Animated.View>

          {/* Settlement & Totals Section */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Settlement & Payment</Text>
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Net Payable</Text>
              <Text style={styles.totalValue}>
                Rs. {netAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={[styles.formGroup, { marginTop: Theme.spacing.md }]}>
              <Text style={styles.label}>Cash Received (Rs.)</Text>
              <TextInput
                style={[styles.textInput, styles.cashInput]}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Theme.colors.textSecondary}
                value={cashReceipt}
                onChangeText={handleCashReceiptChange}
              />
            </View>

            {/* Balance / Change Info Box */}
            <View style={styles.balanceContainer}>
              <View>
                <Text style={styles.balanceLabel}>SETTLEMENT STATUS</Text>
                {balanceDue === 0 ? (
                  <View style={[styles.statusBadge, styles.badgeSettled]}>
                    <Text style={[styles.statusBadgeText, styles.textSettled]}>Full Paid / Settled</Text>
                  </View>
                ) : balanceDue > 0 ? (
                  <View style={[styles.statusBadge, styles.badgePayable]}>
                    <Text style={[styles.statusBadgeText, styles.textPayable]}>Customer Balance Due</Text>
                  </View>
                ) : (
                  <View style={[styles.statusBadge, styles.badgeChange]}>
                    <Text style={[styles.statusBadgeText, styles.textChange]}>Change / Cash Back</Text>
                  </View>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[
                  styles.balanceAmount, 
                  balanceDue > 0 ? styles.amountPayable : styles.amountSettled
                ]}>
                  Rs. {Math.abs(balanceDue > 0 ? balanceDue : numCashBack).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                {numCashBack > 0 && (
                  <Text style={styles.changeSubtext}>
                    Change Returned: Rs. {numCashBack.toFixed(2)}
                  </Text>
                )}
              </View>
            </View>
          </Animated.View>

        </ScrollView>

        {/* Bottom Action Footer */}
        <View style={styles.footer}>
          {isEdit && (
            <>
              <TouchableOpacity 
                style={styles.deleteBtn}
                onPress={handleDeleteVoucher}
                disabled={saving}
              >
                <Ionicons name="trash-outline" size={22} color={Theme.colors.danger} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.copyBtn}
                onPress={handleCopyAsNew}
                disabled={saving}
              >
                <Ionicons name="copy-outline" size={22} color={Theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.copyBtn}
                onPress={() => {
                  const receipt = buildReceiptData(`SL-${voucherNo}`, true);
                  if (receipt) {
                    setActiveReceiptData(receipt);
                    setReceiptModalVisible(true);
                  }
                }}
                disabled={saving}
              >
                <Ionicons name="receipt-outline" size={22} color="#0284c7" />
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity 
            style={styles.saveOnlyBtn}
            onPress={() => handleSaveVoucher(false)}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#0284c7" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#0284c7" style={{ marginRight: 4 }} />
                <Text style={styles.saveOnlyBtnText}>Save Only</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.saveBtn, { flex: 1.3 }]}
            onPress={() => handleSaveVoucher(true)}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Theme.colors.white} />
            ) : (
              <>
                <Ionicons name="print-outline" size={18} color={Theme.colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.saveBtnText}>
                  {isEdit ? 'Update & Print' : 'Save & Print'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Add/Edit Line Modal */}
        <Modal
          visible={lineModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setLineModalVisible(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {currentLine.seq ? `Edit Line #${currentLine.seq}` : 'Add Sale Item'}
                </Text>
                <TouchableOpacity onPress={() => setLineModalVisible(false)}>
                  <Ionicons name="close" size={24} color={Theme.colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {/* Item Selector */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Product Item *</Text>
                  <TouchableOpacity 
                    style={styles.selector}
                    onPress={() => openSelectModal('item')}
                  >
                    <Text style={[styles.selectorText, !currentLine.itemId && { color: Theme.colors.textSecondary }]}>
                      {items.find(i => i.id === currentLine.itemId)?.title || 'Select Product Item'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={Theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Qty (Kg) and Bags */}
                <View style={styles.row}>
                  <View style={[styles.formGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                    <Text style={styles.label}>Qty (Kg) *</Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      value={currentLine.qty !== undefined ? String(currentLine.qty) : '1'}
                      onChangeText={(val) => updateCurrentLineField('qty', val)}
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Bags</Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      value={currentLine.secQty !== undefined ? String(currentLine.secQty) : '0'}
                      onChangeText={(val) => updateCurrentLineField('secQty', val)}
                    />
                  </View>
                </View>

                {/* Pack Qty and Packing */}
                <View style={styles.row}>
                  <View style={[styles.formGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                    <Text style={styles.label}>Pack Qty (Bag Size)</Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      value={currentLine.packQty !== undefined ? String(currentLine.packQty) : '0'}
                      onChangeText={(val) => updateCurrentLineField('packQty', val)}
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Packing</Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      value={currentLine.packing !== undefined ? String(currentLine.packing) : '0'}
                      onChangeText={(val) => updateCurrentLineField('packing', val)}
                    />
                  </View>
                </View>

                {/* Rates */}
                <View style={styles.row}>
                  <View style={[styles.formGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                    {(() => {
                      const selItem = items.find(i => i.id === currentLine.itemId);
                      const minPrice = Number(selItem?.minSalePrice || 0);
                      const isAtMin = minPrice > 0 && Number(currentLine.rate || 0) <= minPrice;
                      return (
                        <>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={styles.label}>Rate (Rs./Kg) *</Text>
                            {isAtMin && (
                              <Text style={{ fontSize: 10, fontWeight: '700', color: '#D97706' }}>
                                ⚠️ Min Cap: Rs. {minPrice}
                              </Text>
                            )}
                          </View>
                          <TextInput
                            style={[styles.textInput, isAtMin && { borderColor: '#F59E0B', borderWidth: 1.5, backgroundColor: '#FFFBEB' }]}
                            keyboardType="numeric"
                            value={currentLine.rate !== undefined ? String(round(currentLine.rate, 2)) : '0'}
                            onChangeText={(val) => updateCurrentLineField('rate', val)}
                          />
                        </>
                      );
                    })()}
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Bag Rate (Rs./Bag)</Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      value={currentLine.secRate !== undefined ? String(round(currentLine.secRate, 2)) : '0'}
                      onChangeText={(val) => updateCurrentLineField('secRate', val)}
                    />
                  </View>
                </View>

                {/* Discount */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Discount (Rs.)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={Theme.colors.textSecondary}
                    value={currentLine.discount !== undefined ? String(currentLine.discount) : '0'}
                    onChangeText={(val) => updateCurrentLineField('discount', val)}
                  />
                </View>

                {/* Line Amount Preview */}
                <View style={styles.linePreviewBox}>
                  <Text style={styles.linePreviewLabel}>Line Amount</Text>
                  <Text style={styles.linePreviewAmount}>
                    Rs. {(
                      ((currentLine.qty || 0) * (currentLine.rate || 0)) - (currentLine.discount || 0) + ((currentLine.secQty || 0) * (currentLine.carriage || 0))
                    ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>

                <TouchableOpacity 
                  style={styles.modalSaveBtn}
                  onPress={saveLine}
                >
                  <Text style={styles.modalSaveBtnText}>Save Line Item</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Searchable Selection Modal */}
        <Modal
          visible={selectModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setSelectModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '80%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {selectModalType === 'customer' && 'Select Customer'}
                  {selectModalType === 'narration' && 'Select Narration'}
                  {selectModalType === 'item' && 'Select Product Item'}
                </Text>
                <TouchableOpacity onPress={() => setSelectModalVisible(false)}>
                  <Ionicons name="close" size={24} color={Theme.colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color={Theme.colors.textSecondary} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Type to filter..."
                  placeholderTextColor={Theme.colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
              </View>

              <ScrollView keyboardShouldPersistTaps="handled">
                {filteredModalList.map((item: any, idx: number) => {
                  let val = '';
                  let title = '';
                  let subtitle = '';

                  if (selectModalType === 'customer') {
                    val = item.account;
                    title = item.title;
                    subtitle = `Account: ${item.account}`;
                  } else if (selectModalType === 'narration') {
                    val = item.code;
                    title = item.title;
                  } else if (selectModalType === 'item') {
                    val = item.id;
                    title = item.title;
                    subtitle = `Rate: Rs. ${item.priRate || 0}${item.barcode ? ` | Barcode: ${item.barcode}` : ''}`;
                  }

                  return (
                    <TouchableOpacity 
                      key={idx}
                      style={styles.modalListItem}
                      onPress={() => handleSelect(val)}
                    >
                      <Text style={styles.modalListItemText}>{title}</Text>
                      {!!subtitle && <Text style={styles.modalListItemSub}>{subtitle}</Text>}
                    </TouchableOpacity>
                  );
                })}
                {filteredModalList.length === 0 && (
                  <Text style={styles.emptyLinesText}>No matching records found.</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

      </KeyboardAvoidingView>

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
    padding: Theme.spacing.md,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radii.lg,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    ...Theme.shadows.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  sectionTitle: {
    ...Theme.typography.h3,
    color: Theme.colors.text,
  },
  sectionSubtitle: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  voucherBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.radii.sm,
  },
  voucherBadgeText: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.primary,
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: Theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    marginBottom: 4,
    fontWeight: '600',
  },
  selector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 12,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 12,
  },
  selectorText: {
    ...Theme.typography.body,
    color: Theme.colors.text,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 10,
    ...Theme.typography.body,
    color: Theme.colors.text,
  },
  cashInput: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.radii.sm,
  },
  addBtnText: {
    ...Theme.typography.caption,
    color: Theme.colors.white,
    marginLeft: 4,
    fontWeight: '600',
  },
  emptyLinesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.xl,
  },
  emptyLinesText: {
    ...Theme.typography.body,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    marginVertical: Theme.spacing.md,
  },
  lineCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
    padding: Theme.spacing.md,
    borderRadius: Theme.radii.md,
    marginBottom: Theme.spacing.sm,
  },
  lineInfo: {
    flex: 1,
    marginRight: Theme.spacing.sm,
  },
  lineAccount: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.text,
    fontWeight: '600',
  },
  lineAmount: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.primary,
    fontWeight: '700',
    marginTop: 3,
  },
  lineDetail: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  lineDetailSub: {
    ...Theme.typography.caption,
    color: '#6b7280',
    fontSize: 11,
    marginTop: 1,
  },
  lineActions: {
    flexDirection: 'row',
  },
  actionBtn: {
    padding: 8,
    marginLeft: 4,
  },
  subtotalsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.radii.md,
    padding: Theme.spacing.sm,
    marginTop: Theme.spacing.xs,
  },
  subtotalCol: {
    alignItems: 'center',
  },
  subtotalLabel: {
    ...Theme.typography.caption,
    fontSize: 11,
    color: Theme.colors.textSecondary,
  },
  subtotalValue: {
    ...Theme.typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.text,
    marginTop: 2,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    paddingTop: Theme.spacing.md,
    marginTop: Theme.spacing.xs,
  },
  totalLabel: {
    ...Theme.typography.h3,
    color: Theme.colors.text,
  },
  totalValue: {
    ...Theme.typography.h2,
    color: Theme.colors.primary,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    padding: Theme.spacing.md,
    backgroundColor: Theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
  },
  deleteBtn: {
    width: 50,
    height: 50,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.sm,
  },
  copyBtn: {
    width: 50,
    height: 50,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.sm,
  },
  saveOnlyBtn: {
    height: 50,
    borderRadius: Theme.radii.md,
    borderWidth: 1.5,
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginRight: Theme.spacing.sm,
  },
  saveOnlyBtnText: {
    ...Theme.typography.bodyMedium,
    color: '#0284c7',
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: Theme.colors.primary,
    height: 50,
    borderRadius: Theme.radii.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
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
    padding: Theme.spacing.md,
    maxHeight: '90%',
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
  modalBody: {
    marginBottom: Theme.spacing.lg,
  },
  linePreviewBox: {
    backgroundColor: '#eff6ff',
    padding: Theme.spacing.md,
    borderRadius: Theme.radii.md,
    marginTop: Theme.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linePreviewLabel: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.primary,
    fontWeight: '600',
  },
  linePreviewAmount: {
    ...Theme.typography.h3,
    color: Theme.colors.primary,
    fontWeight: '700',
  },
  modalSaveBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
  },
  modalSaveBtnText: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.white,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    height: 40,
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
  },
  modalListItemSub: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  balanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.radii.md,
    padding: Theme.spacing.md,
    marginTop: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  balanceLabel: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Theme.radii.sm,
    alignSelf: 'flex-start',
  },
  badgeSettled: {
    backgroundColor: 'rgba(72, 187, 120, 0.15)',
  },
  badgePayable: {
    backgroundColor: 'rgba(236, 201, 75, 0.2)',
  },
  badgeChange: {
    backgroundColor: 'rgba(108, 99, 255, 0.15)',
  },
  statusBadgeText: {
    ...Theme.typography.small,
    fontWeight: '700',
  },
  textSettled: {
    color: Theme.colors.success,
  },
  textPayable: {
    color: '#D69E2E',
  },
  textChange: {
    color: Theme.colors.primary,
  },
  balanceAmount: {
    ...Theme.typography.h2,
    fontWeight: '700',
  },
  amountPayable: {
    color: Theme.colors.danger,
  },
  amountSettled: {
    color: Theme.colors.success,
  },
  changeSubtext: {
    ...Theme.typography.caption,
    color: Theme.colors.primary,
    marginTop: 2,
  },
});
