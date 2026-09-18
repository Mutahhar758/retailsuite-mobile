import React, { useEffect, useState, useMemo, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, Alert, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, Modal
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import dayjs from 'dayjs';
import { Theme } from '../../constants/theme';
import { purchaseService, PurchaseLineRequest } from '../../services/purchaseService';
import { chartOfAccountService, ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { narrationService, NarrationDto } from '../../services/narrationService';
import { inventoryService, Item, Unit } from '../../services/inventoryService';
import { useAppStore } from '../../store/appStore';
import { round } from '../../utils/numberUtils';

export default function PurchaseFormScreen() {
  const { voucherNo, mode } = useLocalSearchParams<{ voucherNo: string; mode?: string }>();
  const router = useRouter();
  const isEdit = voucherNo && voucherNo !== 'new' && mode !== 'copy';

  const { currentTenantIdentifier, licenses } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const hasSecondaryQty = currentOrg?.hasSecondaryQty ?? false;
  const hasVariablePackFeature = currentOrg?.hasVariablePackFeature ?? false;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Lookups
  const [suppliers, setSuppliers] = useState<ChartOfAccountHeadDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // Form State
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [supplierAccount, setSupplierAccount] = useState('');
  const [narration, setNarration] = useState('');
  const [description, setDescription] = useState('');
  const [cashPaid, setCashPaid] = useState<string>('');
  const [cashBack, setCashBack] = useState<string>('0');
  const prevTotalRef = useRef<number>(0);
  
  // Lines State
  const [lines, setLines] = useState<PurchaseLineRequest[]>([]);
  
  // Line Modal State
  const [lineModalVisible, setLineModalVisible] = useState(false);
  const [currentLine, setCurrentLine] = useState<Partial<PurchaseLineRequest>>({});

  // Searchable Selection Modal State
  const [selectModalVisible, setSelectModalVisible] = useState(false);
  const [selectModalType, setSelectModalType] = useState<'supplier' | 'narration' | 'item' | 'unit'>('supplier');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLookups();
  }, []);

  const fetchLookups = async () => {
    try {
      const [sups, narrs, itms, unts] = await Promise.all([
        chartOfAccountService.getSupplierAccounts(),
        narrationService.getActiveNarrationsLookup(),
        inventoryService.getItemsLookup(),
        inventoryService.getUnitsLookup()
      ]);
      setSuppliers(sups);
      setNarrations(narrs);
      setItems(itms);
      setUnits(unts);
      
      if (voucherNo && voucherNo !== 'new') {
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
      const details = await purchaseService.getDetail(voucherNo!);
      if (details && details.length > 0) {
        const first = details[0];
        setDate(mode === 'copy' ? new Date() : new Date(first.date));
        setSupplierAccount(first.accountId);
        setNarration(first.narrationId || '');
        setDescription(first.description || '');
        if ((first as any).cashPaid !== undefined && (first as any).cashPaid !== null) {
          setCashPaid(String((first as any).cashPaid));
          setCashBack(String((first as any).cashBack || 0));
        }
        
        const mappedLines = details.map(d => ({
          seq: d.seq,
          itemId: d.itemId,
          unit: d.unit || '',
          qty: d.qty,
          rate: d.rate,
          addLess: d.addLess,
          secQty: d.secQty || 0,
          secRate: d.secRate || 0,
          secUnit: d.secUnit,
          packQty: (d as any).qtyInPack || ((d.qty > 0 && d.secQty && d.secQty > 0) ? round(d.qty / d.secQty, 2) : 0),
          packing: (d as any).packing || 0
        }));
        setLines(mappedLines);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load purchase details.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const openSelectModal = (type: 'supplier' | 'narration' | 'item' | 'unit') => {
    setSelectModalType(type);
    setSearchQuery('');
    setSelectModalVisible(true);
  };

  const handleSelect = (val: string) => {
    if (selectModalType === 'supplier') {
      setSupplierAccount(val);
    } else if (selectModalType === 'narration') {
      setNarration(val);
    } else if (selectModalType === 'item') {
      const selectedItem = items.find(i => i.id === val);
      let defaultUnit = '';
      let defaultRate = 0;
      let secUnit = '';
      let secRate = 0;
      let packQty = 0;
      let packing = 0;
      if (selectedItem) {
        defaultUnit = selectedItem.defaultUnit || selectedItem.primaryUnit || '';
        defaultRate = selectedItem.priRate || 0;
        secUnit = selectedItem.secondaryUnit || '';
        const pSize = Number(selectedItem.qtyInPack || (selectedItem as any).QtyInPack || (selectedItem as any).qty_in_pack || 0);
        packQty = pSize;
        packing = pSize;
        secRate = selectedItem.secRate || ((selectedItem.priRate || 0) * (pSize > 0 ? pSize : 1));
      }
      setCurrentLine(prev => ({
        ...prev,
        itemId: val,
        unit: defaultUnit,
        rate: defaultRate,
        secUnit,
        secRate,
        secQty: 0,
        packQty,
        packing
      }));
    } else if (selectModalType === 'unit') {
      const selectedItem = items.find(i => i.id === currentLine.itemId);
      let rate = currentLine.rate || 0;
      if (selectedItem) {
        if (val === selectedItem.primaryUnit) {
          rate = selectedItem.priRate || 0;
        } else if (val === selectedItem.secondaryUnit) {
          rate = selectedItem.secRate || 0;
        }
      }
      setCurrentLine(prev => ({
        ...prev,
        unit: val,
        rate: rate
      }));
    }
    setSelectModalVisible(false);
  };

  const updateCurrentLineField = (field: string, val: string | number) => {
    setCurrentLine(prev => {
      const updated = { ...prev };
      const cleanVal = typeof val === 'string' ? val.replace(/,/g, '') : val;
      const numVal = (cleanVal !== null && cleanVal !== undefined && cleanVal !== '' && !isNaN(Number(cleanVal))) ? Number(cleanVal) : 0;

      if (hasVariablePackFeature) {
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
        } else if (field === 'addLess') {
          updated.addLess = numVal;
        }

        updated.qty = round(kgQty, 2);
        updated.secQty = round(bagQty, 2);
        updated.packQty = round(packQty, 2);
        updated.packing = round(packing, 2);
        updated.rate = round(kgRate, 4);
        updated.secRate = round(bagRate, 4);
      } else {
        (updated as any)[field] = numVal;
      }
      return updated;
    });
  };

  const openLineModal = (line?: PurchaseLineRequest) => {
    if (line) {
      setCurrentLine({ ...line });
    } else {
      const maxSeq = lines.reduce((max, l) => Math.max(max, l.seq), 0);
      setCurrentLine({
        seq: maxSeq + 1,
        itemId: '',
        unit: '',
        qty: 1,
        rate: 0,
        addLess: 0,
        secQty: 0,
        secRate: 0,
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
        newLines[exists] = currentLine as PurchaseLineRequest;
        return newLines;
      }
      return [...prev, currentLine as PurchaseLineRequest];
    });
    setLineModalVisible(false);
  };

  const removeLine = async (seq: number) => {
    if (isEdit) {
      try {
        await purchaseService.deleteLine(voucherNo!, seq);
      } catch (error) {
        Alert.alert('Error', 'Failed to delete line from database.');
        return;
      }
    }
    setLines(prev => prev.filter(l => l.seq !== seq));
  };

  const handleSaveVoucher = async () => {
    if (!supplierAccount || !date) {
      Alert.alert('Validation Error', 'Date and Supplier Account are required.');
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
        itemId: l.itemId,
        unit: l.unit || undefined,
        qty: l.qty,
        rate: l.rate,
        addLess: l.addLess,
        secQty: l.secQty || 0,
        secRate: l.secRate || 0,
        secUnit: l.secUnit || undefined,
        qtyInPack: (l as any).packQty || (l as any).qtyInPack || null,
        packing: (l as any).packing || null
      }));

      const request = {
        date: dayjs(date).format('YYYY-MM-DD'),
        account: supplierAccount,
        narration: narration || undefined,
        description: description || undefined,
        cashPaid: parseFloat(cashPaid) || 0,
        cashBack: parseFloat(cashBack) || 0,
        lines: cleanedLines
      };

      if (isEdit) {
        await purchaseService.update(voucherNo!, request);
        Alert.alert('Success', 'Purchase updated successfully.', [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        await purchaseService.create(request);
        Alert.alert('Success', 'Purchase created successfully.', [{ text: 'OK', onPress: () => router.back() }]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to save purchase.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVoucher = () => {
    Alert.alert('Delete Purchase', 'Are you sure you want to delete this purchase voucher?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await purchaseService.delete(voucherNo!);
            Alert.alert('Success', 'Purchase deleted.', [{ text: 'OK', onPress: () => router.back() }]);
          } catch (error) {
            Alert.alert('Error', 'Failed to delete purchase.');
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
          setDate(new Date());
          router.replace({ pathname: '/purchases/[voucherNo]' as any, params: { voucherNo: voucherNo, mode: 'copy' } });
        } 
      }
    ]);
  };

  const totalAmount = useMemo(() => {
    return lines.reduce((sum, l) => {
      if (hasVariablePackFeature) {
        return sum + (l.qty * l.rate + l.addLess);
      }
      return sum + (l.qty * l.rate + l.addLess + ((l.secQty ?? 0) * (l.secRate ?? 0)));
    }, 0);
  }, [lines, hasVariablePackFeature]);

  const numCashPaid = parseFloat(cashPaid) || 0;
  const numCashBack = parseFloat(cashBack) || 0;
  const balance = totalAmount - numCashPaid + numCashBack;

  useEffect(() => {
    if (!isEdit || mode === 'copy') {
      const isAutoSynced = !cashPaid || parseFloat(cashPaid) === 0 || parseFloat(cashPaid) === prevTotalRef.current;
      if (isAutoSynced) {
        setCashPaid(totalAmount > 0 ? totalAmount.toString() : '');
        setCashBack('0');
      } else {
        const excess = Math.max(0, numCashPaid - totalAmount);
        setCashBack(excess > 0 ? excess.toFixed(2) : '0');
      }
      prevTotalRef.current = totalAmount;
    } else if (isEdit && !loading) {
      const excess = Math.max(0, numCashPaid - totalAmount);
      setCashBack(excess > 0 ? excess.toFixed(2) : '0');
    }
  }, [totalAmount, isEdit, mode, loading]);

  const handleCashPaidChange = (text: string) => {
    setCashPaid(text);
    const paid = parseFloat(text) || 0;
    if (paid > totalAmount) {
      setCashBack((paid - totalAmount).toFixed(2));
    } else {
      setCashBack('0');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

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
                    PU-{String(voucherNo).padStart(5, '0')}
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
              <Text style={styles.label}>Supplier Account *</Text>
              <TouchableOpacity 
                style={styles.pickerContainer}
                onPress={() => openSelectModal('supplier')}
              >
                <Text style={[styles.selectorText, !supplierAccount && { color: Theme.colors.textSecondary }]}>
                  {supplierAccount ? suppliers.find(s => s.account === supplierAccount)?.title || supplierAccount : 'Select Supplier'}
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

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter description"
                placeholderTextColor={Theme.colors.textSecondary}
                value={description}
                onChangeText={setDescription}
              />
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
              lines.map((line) => {
                const itemTitle = items.find(i => i.id === line.itemId)?.title || line.itemId;
                const unitTitle = units.find(u => u.code === line.unit)?.title || line.unit || '';
                const lineTotal = hasVariablePackFeature
                  ? line.qty * line.rate + line.addLess
                  : line.qty * line.rate + line.addLess + ((line.secQty ?? 0) * (line.secRate ?? 0));
                return (
                  <View key={line.seq} style={styles.lineCard}>
                    <View style={styles.lineInfo}>
                      <Text style={styles.lineAccount} numberOfLines={1}>{itemTitle}</Text>
                      <Text style={styles.lineAmount}>Rs. {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                      <Text style={styles.lineDetail}>
                        {hasVariablePackFeature ? (
                          `Qty: ${line.qty} Kg | Bags: ${line.secQty ?? 0} | Rate: Rs. ${line.rate}/Kg | Bag Rate: Rs. ${line.secRate ?? 0}`
                        ) : hasSecondaryQty ? (
                          `Single Qty: ${line.qty} | Pack Qty: ${line.secQty ?? 0} @ Rs. ${(line.secRate ?? 0).toLocaleString()}`
                        ) : (
                          `Qty: ${line.qty} ${unitTitle} @ Rs. ${line.rate.toLocaleString()}`
                        )}
                        {hasVariablePackFeature && (line as any).packQty ? ` | Pack: ${(line as any).packQty}` : ''}
                        {line.addLess !== 0 ? ` | Add/Less: Rs. ${line.addLess.toLocaleString()}` : ''}
                      </Text>
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

          {/* Cash Payment Details Section */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Details</Text>

            <View style={[styles.row, { marginTop: Theme.spacing.sm }]}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                <Text style={styles.label}>Cash Paid</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={Theme.colors.textSecondary}
                  value={cashPaid}
                  onChangeText={handleCashPaidChange}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Cash Back</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={Theme.colors.textSecondary}
                  value={cashBack}
                  onChangeText={setCashBack}
                />
              </View>
            </View>

            <View style={styles.balanceContainer}>
              <View>
                <Text style={styles.balanceLabel}>NET BALANCE</Text>
                <View style={[
                  styles.statusBadge, 
                  balance === 0 ? styles.badgeSettled : balance > 0 ? styles.badgePayable : styles.badgeChange
                ]}>
                  <Text style={[
                    styles.statusBadgeText,
                    balance === 0 ? styles.textSettled : balance > 0 ? styles.textPayable : styles.textChange
                  ]}>
                    {balance === 0 ? 'SETTLED' : balance > 0 ? 'PAYABLE' : 'CHANGE'}
                  </Text>
                </View>
              </View>
              <Text style={[
                styles.balanceAmount,
                balance > 0 ? styles.amountPayable : styles.amountSettled
              ]}>
                Rs. {Math.abs(balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </Animated.View>

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
                <Text style={styles.saveBtnText}>Save Purchase</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Line Item Modal */}
        <Modal visible={lineModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{currentLine.itemId ? 'Edit Line' : 'Add Line'}</Text>
                <TouchableOpacity onPress={() => setLineModalVisible(false)}>
                  <Ionicons name="close" size={24} color={Theme.colors.text} />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalBody}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Item *</Text>
                  <TouchableOpacity 
                    style={styles.pickerContainer}
                    onPress={() => openSelectModal('item')}
                  >
                    <Text style={[styles.selectorText, !currentLine.itemId && { color: Theme.colors.textSecondary }]}>
                      {currentLine.itemId ? items.find(i => i.id === currentLine.itemId)?.title || currentLine.itemId : 'Select Item'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={Theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {!hasSecondaryQty && !hasVariablePackFeature && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Unit</Text>
                    <TouchableOpacity 
                      style={styles.pickerContainer}
                      onPress={() => openSelectModal('unit')}
                      disabled={!currentLine.itemId}
                    >
                      <Text style={[styles.selectorText, !currentLine.unit && { color: Theme.colors.textSecondary }]}>
                        {currentLine.unit ? units.find(u => u.code === currentLine.unit)?.title || currentLine.unit : 'Select Unit'}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color={Theme.colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                )}

                {hasVariablePackFeature ? (
                  <>
                    <View style={styles.row}>
                      <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                        <Text style={styles.label}>Qty (Kg) *</Text>
                        <TextInput
                          style={styles.textInput}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={Theme.colors.textSecondary}
                          value={currentLine.qty !== undefined ? currentLine.qty.toString() : ''}
                          onChangeText={(val) => updateCurrentLineField('qty', val)}
                        />
                      </View>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Bag Qty</Text>
                        <TextInput
                          style={styles.textInput}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={Theme.colors.textSecondary}
                          value={currentLine.secQty !== undefined ? currentLine.secQty.toString() : ''}
                          onChangeText={(val) => updateCurrentLineField('secQty', val)}
                        />
                      </View>
                    </View>

                    <View style={styles.row}>
                      <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                        <Text style={styles.label}>Pack Qty</Text>
                        <TextInput
                          style={styles.textInput}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={Theme.colors.textSecondary}
                          value={(currentLine as any).packQty !== undefined ? (currentLine as any).packQty.toString() : ''}
                          onChangeText={(val) => updateCurrentLineField('packQty', val)}
                        />
                      </View>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Packing</Text>
                        <TextInput
                          style={styles.textInput}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={Theme.colors.textSecondary}
                          value={(currentLine as any).packing !== undefined ? (currentLine as any).packing.toString() : ''}
                          onChangeText={(val) => updateCurrentLineField('packing', val)}
                        />
                      </View>
                    </View>

                    <View style={styles.row}>
                      <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                        <Text style={styles.label}>Rate (/Kg) *</Text>
                        <TextInput
                          style={styles.textInput}
                          keyboardType="numeric"
                          placeholder="0.00"
                          placeholderTextColor={Theme.colors.textSecondary}
                          value={currentLine.rate !== undefined ? currentLine.rate.toString() : ''}
                          onChangeText={(val) => updateCurrentLineField('rate', val)}
                        />
                      </View>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Bag Rate</Text>
                        <TextInput
                          style={styles.textInput}
                          keyboardType="numeric"
                          placeholder="0.00"
                          placeholderTextColor={Theme.colors.textSecondary}
                          value={currentLine.secRate !== undefined ? currentLine.secRate.toString() : ''}
                          onChangeText={(val) => updateCurrentLineField('secRate', val)}
                        />
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>{hasSecondaryQty ? 'Single Quantity *' : 'Quantity *'}</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        placeholder="Enter quantity"
                        placeholderTextColor={Theme.colors.textSecondary}
                        value={currentLine.qty !== undefined ? currentLine.qty.toString() : ''}
                        onChangeText={(val) => updateCurrentLineField('qty', val)}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>{hasSecondaryQty ? 'Single Rate *' : 'Rate *'}</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        placeholder="Enter rate"
                        placeholderTextColor={Theme.colors.textSecondary}
                        value={currentLine.rate !== undefined ? currentLine.rate.toString() : ''}
                        onChangeText={(val) => updateCurrentLineField('rate', val)}
                      />
                    </View>

                    {hasSecondaryQty && (
                      <>
                        <View style={styles.inputGroup}>
                          <Text style={styles.label}>Pack Quantity</Text>
                          <TextInput
                            style={styles.textInput}
                            keyboardType="numeric"
                            placeholder="Enter pack quantity"
                            placeholderTextColor={Theme.colors.textSecondary}
                            value={currentLine.secQty !== undefined ? currentLine.secQty.toString() : '0'}
                            onChangeText={(val) => updateCurrentLineField('secQty', val)}
                          />
                        </View>

                        <View style={styles.inputGroup}>
                          <Text style={styles.label}>Pack Rate</Text>
                          <TextInput
                            style={styles.textInput}
                            keyboardType="numeric"
                            placeholder="Enter pack rate"
                            placeholderTextColor={Theme.colors.textSecondary}
                            value={currentLine.secRate !== undefined ? currentLine.secRate.toString() : '0'}
                            onChangeText={(val) => updateCurrentLineField('secRate', val)}
                          />
                        </View>
                      </>
                    )}
                  </>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Add / Less Amount</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    placeholder="Enter adjustment"
                    placeholderTextColor={Theme.colors.textSecondary}
                    value={currentLine.addLess !== undefined ? currentLine.addLess.toString() : ''}
                    onChangeText={(val) => updateCurrentLineField('addLess', val)}
                  />
                </View>
                
                <TouchableOpacity style={styles.modalSaveBtn} onPress={saveLine}>
                  <Text style={styles.modalSaveBtnText}>Confirm Line</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Searchable Selection Modal */}
        <Modal visible={selectModalVisible} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '50%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {selectModalType === 'supplier' ? 'Select Supplier' :
                   selectModalType === 'narration' ? 'Select Narration' :
                   selectModalType === 'item' ? 'Select Item' : 'Select Unit'}
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
                  placeholderTextColor={Theme.colors.textSecondary}
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
                {selectModalType === 'supplier' && suppliers
                  .filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.account.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(s => (
                  <TouchableOpacity key={s.account} style={styles.modalListItem} onPress={() => handleSelect(s.account)}>
                    <Text style={styles.modalListItemText}>{s.title}</Text>
                    <Text style={styles.modalListItemSub}>{s.account}</Text>
                  </TouchableOpacity>
                ))}
                
                {selectModalType === 'narration' && narrations
                  .filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(n => (
                  <TouchableOpacity key={n.code} style={styles.modalListItem} onPress={() => handleSelect(n.code)}>
                    <Text style={styles.modalListItemText}>{n.title}</Text>
                  </TouchableOpacity>
                ))}

                {selectModalType === 'item' && items
                  .filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase()) || i.id.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(i => (
                  <TouchableOpacity key={i.id} style={styles.modalListItem} onPress={() => handleSelect(i.id)}>
                    <Text style={styles.modalListItemText}>{i.title}</Text>
                    <Text style={styles.modalListItemSub}>{i.id}</Text>
                  </TouchableOpacity>
                ))}

                {selectModalType === 'unit' && (() => {
                  const selectedItem = items.find(i => i.id === currentLine.itemId);
                  const allowedUnits = selectedItem 
                    ? units.filter(u => u.code === selectedItem.primaryUnit || u.code === selectedItem.secondaryUnit)
                    : units;
                  
                  return allowedUnits
                    .filter(u => u.title.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(u => (
                      <TouchableOpacity key={u.code} style={styles.modalListItem} onPress={() => handleSelect(u.code)}>
                        <Text style={styles.modalListItemText}>{u.title}</Text>
                      </TouchableOpacity>
                    ));
                })()}
              </ScrollView>
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
  row: {
    flexDirection: 'row',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  sectionTitle: {
    ...Theme.typography.h3,
    color: Theme.colors.text,
  },
  voucherBadge: {
    backgroundColor: Theme.colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.radii.sm,
  },
  voucherBadgeText: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.primary,
    fontWeight: '700',
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
  datePickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 12,
  },
  dateText: {
    ...Theme.typography.body,
    color: Theme.colors.text,
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    marginTop: 2,
  },
  lineDetail: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  lineActions: {
    flexDirection: 'row',
  },
  actionBtn: {
    padding: 8,
    marginLeft: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    paddingTop: Theme.spacing.md,
    marginTop: Theme.spacing.md,
  },
  totalLabel: {
    ...Theme.typography.h3,
    color: Theme.colors.text,
  },
  totalValue: {
    ...Theme.typography.h3,
    color: Theme.colors.primary,
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
  modalSaveBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Theme.spacing.md,
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
    paddingVertical: 2,
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
});
