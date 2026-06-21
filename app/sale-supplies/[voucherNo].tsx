import React, { useEffect, useState, useMemo } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, Alert, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, Modal
} from 'react-native';
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

export default function SaleSupplyFormScreen() {
  const { voucherNo, mode } = useLocalSearchParams<{ voucherNo: string; mode?: string }>();
  const router = useRouter();
  
  const isEdit = voucherNo !== 'new' && mode !== 'copy';

  const [loading, setLoading] = useState(voucherNo !== 'new');
  const [saving, setSaving] = useState(false);
  
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
    { seq: 1, customerId: '', unit: '', qty: 1, rate: 0, discount: 0, addLess: 0 }
  ]);

  // Modal State for Selectors
  const [selectModalVisible, setSelectModalVisible] = useState(false);
  const [selectModalType, setSelectModalType] = useState<'item' | 'customer' | 'narration' | 'unit' | 'supplyOrder'>('item');
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
        narrationService.getActiveNarrations(),
        inventoryService.getItems(),
        inventoryService.getUnits(),
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
    try {
      const details = await saleSupplyService.getDetail(voucherNo!);
      if (details && details.length > 0) {
        const first = details[0];
        setDate(dayjs(first.date).toDate());
        setItemId(first.itemId || '');
        setNarration(first.narrationId || '');
        setDescription(first.description || '');
        setSupplyOrderId(first.supplyOrderMasterId ?? null);
        
        const mappedLines = details.map(d => ({
          seq: d.seq,
          customerId: d.customerId,
          unit: d.unit || '',
          qty: d.qty,
          rate: d.rate,
          discount: d.discount,
          addLess: d.addLess
        }));
        setLines(mappedLines);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load sale supply details.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const loadFromSupplyOrder = async (orderId: number) => {
    if (isEdit) return;
    const selectedItem = items.find(i => i.id === itemId);
    
    setLoading(true);
    try {
      const order = await supplyOrderService.getById(orderId);
      if (order && order.details) {
        const defaultRate = (selectedItem?.defaultUnit === selectedItem?.secondaryUnit 
          ? selectedItem?.secRate : selectedItem?.priRate) ?? 0;
          
        const newLines = order.details.map((d, index) => ({
          seq: index + 1,
          customerId: d.customerId,
          unit: selectedItem?.defaultUnit || '',
          qty: 1,
          rate: defaultRate,
          discount: 0,
          addLess: 0
        }));
        setLines(newLines);
        Alert.alert('Success', `Loaded ${newLines.length} customers from ${order.title}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load supply order.');
    } finally {
      setLoading(false);
    }
  };

  const addLine = () => {
    const nextSeq = lines.length > 0 ? Math.max(...lines.map(l => l.seq)) + 1 : 1;
    
    let defaultUnit = '';
    let defaultRate = 0;
    const selectedItem = items.find(i => i.id === itemId);
    
    if (selectedItem) {
      defaultUnit = selectedItem.defaultUnit || selectedItem.primaryUnit || '';
      if (defaultUnit === selectedItem.primaryUnit) {
        defaultRate = selectedItem.priRate || 0;
      } else if (defaultUnit === selectedItem.secondaryUnit) {
        defaultRate = selectedItem.secRate || 0;
      }
    }
    
    setLines([...lines, { seq: nextSeq, customerId: '', unit: defaultUnit, qty: 1, rate: defaultRate, discount: 0, addLess: 0 }]);
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

  const openSelector = (type: 'item' | 'customer' | 'narration' | 'unit' | 'supplyOrder', seq?: number) => {
    setSelectModalType(type);
    if (seq) setActiveLineSeq(seq);
    setSearchQuery('');
    setSelectModalVisible(true);
  };

  const handleSelect = (value: any) => {
    if (selectModalType === 'item') {
      setItemId(value);
    } else if (selectModalType === 'narration') {
      setNarration(value);
    } else if (selectModalType === 'supplyOrder') {
      setSupplyOrderId(value);
      if (!isEdit) {
        loadFromSupplyOrder(value);
      }
    } else if (selectModalType === 'customer' && activeLineSeq) {
      updateLine(activeLineSeq, { customerId: value });
    } else if (selectModalType === 'unit' && activeLineSeq) {
      const selectedItem = items.find(i => i.id === itemId);
      let newRate = undefined;
      
      if (selectedItem) {
        if (value === selectedItem.primaryUnit) newRate = selectedItem.priRate || 0;
        else if (value === selectedItem.secondaryUnit) newRate = selectedItem.secRate || 0;
      }
      
      const updates: Partial<SaleSupplyLineRequest> = { unit: value };
      if (newRate !== undefined) updates.rate = newRate;
      
      updateLine(activeLineSeq, updates);
    }
    setSelectModalVisible(false);
  };

  const getSelectedItemName = () => items.find(i => i.id === itemId)?.title || 'Select Item';
  const getSelectedNarrationName = () => narrations.find(n => n.code === narration)?.title || 'Select Narration';
  const getCustomerName = (id: string) => customers.find(c => c.account === id)?.title || 'Select Customer';
  const getUnitName = (code: string) => units.find(u => u.code === code)?.title || 'Select Unit';

  const filteredLines = useMemo(() => {
    if (!lineSearchQuery.trim()) {
      return lines;
    }
    const query = lineSearchQuery.toLowerCase().trim();
    return lines.filter(line => {
      const customerName = getCustomerName(line.customerId).toLowerCase();
      const customerId = line.customerId.toLowerCase();
      return customerName.includes(query) || customerId.includes(query);
    });
  }, [lines, lineSearchQuery, customers]);

  const totalAmount = useMemo(() => {
    return lines.reduce((sum, l) => {
      const amt = (l.qty * (l.rate - l.discount)) + l.addLess;
      return sum + amt;
    }, 0);
  }, [lines]);

  const handleSave = async () => {
    if (!itemId) {
      Alert.alert('Validation Error', 'Item to supply is required.');
      return;
    }

    const validLines = lines.filter(l => l.customerId && l.qty > 0);
    if (validLines.length === 0) {
      Alert.alert('Validation Error', 'At least one line item with customer is required.');
      return;
    }

    setSaving(true);
    try {
      const cleanedLines = validLines.map(l => ({
        seq: l.seq,
        customerId: l.customerId,
        unit: l.unit || undefined as any,
        qty: l.qty,
        rate: l.rate,
        discount: l.discount,
        addLess: l.addLess
      }));

      const request = {
        date: dayjs(date).format('YYYY-MM-DD'),
        itemId,
        supplyOrderMasterId: supplyOrderId ?? undefined,
        narration: narration || undefined,
        description: description || undefined,
        lines: cleanedLines
      };

      if (isEdit) {
        await saleSupplyService.update(voucherNo!, request);
        Alert.alert('Success', 'Sale supply updated successfully.', [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        await saleSupplyService.create(request);
        Alert.alert('Success', 'Sale supply created successfully.', [{ text: 'OK', onPress: () => router.back() }]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to save sale supply.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyAsNew = () => {
    Alert.alert('Copy as New', 'Are you sure you want to duplicate this voucher?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Copy', 
        onPress: () => {
          router.replace({ pathname: '/sale-supplies/[voucherNo]', params: { voucherNo: voucherNo, mode: 'copy' } });
        }
      }
    ]);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Voucher',
      `Are you sure you want to delete sale supply voucher SP-${String(voucherNo).padStart(5, '0')}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await saleSupplyService.delete(voucherNo!);
              Alert.alert('Success', 'Voucher deleted successfully.', [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to delete sale supply.');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
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
      <Stack.Screen
        options={{
          headerRight: () => isEdit ? (
            <TouchableOpacity onPress={handleDelete} style={{ padding: 8 }}>
              <Ionicons name="trash-outline" size={22} color={Theme.colors.danger} />
            </TouchableOpacity>
          ) : null
        }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          
          {/* Header Info */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Master Details</Text>
              {isEdit && (
                <View style={styles.voucherBadge}>
                  <Text style={styles.voucherBadgeText}>
                    SP-{String(voucherNo).padStart(5, '0')}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date *</Text>
              <TouchableOpacity style={styles.selector} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.selectorText}>{dayjs(date).format('DD MMM YYYY')}</Text>
                <Ionicons name="calendar-outline" size={16} color={Theme.colors.textSecondary} />
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
              <Text style={styles.label}>Item to Supply *</Text>
              <TouchableOpacity style={styles.selector} onPress={() => openSelector('item')}>
                <Text style={[styles.selectorText, !itemId && styles.placeholder]}>{getSelectedItemName()}</Text>
                <Ionicons name="chevron-down" size={16} color={Theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Supply Order Profile</Text>
              <TouchableOpacity style={styles.selector} onPress={() => openSelector('supplyOrder')}>
                <Text style={[styles.selectorText, !supplyOrderId && styles.placeholder]}>
                  {supplyOrderId
                    ? supplyOrders.find(o => o.id === supplyOrderId)?.title || 'Select Profile'
                    : 'Select Supply Order Profile...'}
                </Text>
                <Ionicons name="download-outline" size={16} color={Theme.colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Narration</Text>
              <TouchableOpacity style={styles.selector} onPress={() => openSelector('narration')}>
                <Text style={[styles.selectorText, !narration && styles.placeholder]}>{getSelectedNarrationName()}</Text>
                <Ionicons name="chevron-down" size={16} color={Theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Additional remarks..."
                value={description}
                onChangeText={setDescription}
              />
            </View>
          </Animated.View>

          {/* Lines */}
          <View style={styles.linesHeader}>
            <Text style={styles.sectionTitle}>Customers</Text>
            <TouchableOpacity onPress={addLine} style={styles.addBtn}>
              <Ionicons name="add" size={16} color={Theme.colors.primary} />
              <Text style={styles.addBtnText}>Add Row</Text>
            </TouchableOpacity>
          </View>

          {/* Keyword Search Input */}
          {lines.length > 0 && (
            <View style={styles.linesSearchContainer}>
              <Ionicons name="search" size={18} color={Theme.colors.textSecondary} style={{ marginRight: 6 }} />
              <TextInput
                style={styles.linesSearchInput}
                placeholder="Search line items by customer name or code..."
                value={lineSearchQuery}
                onChangeText={setLineSearchQuery}
                autoCapitalize="none"
              />
              {lineSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setLineSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={Theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {filteredLines.map((line, index) => {
            const lineAmount = (line.qty * (line.rate - line.discount)) + line.addLess;
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
                    <Text style={styles.label}>Unit</Text>
                    <TouchableOpacity style={[styles.selector, { paddingHorizontal: 6 }]} onPress={() => openSelector('unit', line.seq)}>
                      <Text style={[styles.selectorText, !line.unit && styles.placeholder]} numberOfLines={1}>{getUnitName(line.unit)}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                    <Text style={styles.label}>Qty</Text>
                    <TextInput
                      style={styles.textInput}
                      value={String(line.qty)}
                      onChangeText={(val) => updateLine(line.seq, { qty: Number(val) || 0 })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Rate</Text>
                    <TextInput
                      style={styles.textInput}
                      value={String(line.rate)}
                      onChangeText={(val) => updateLine(line.seq, { rate: Number(val) || 0 })}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                    <Text style={styles.label}>Disc</Text>
                    <TextInput
                      style={styles.textInput}
                      value={String(line.discount)}
                      onChangeText={(val) => updateLine(line.seq, { discount: Number(val) || 0 })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                    <Text style={styles.label}>Add/Less</Text>
                    <TextInput
                      style={styles.textInput}
                      value={String(line.addLess)}
                      onChangeText={(val) => updateLine(line.seq, { addLess: Number(val) || 0 })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1.2, justifyContent: 'flex-end', paddingBottom: 10 }]}>
                    <Text style={[styles.label, { textAlign: 'right' }]}>Amount</Text>
                    <Text style={[styles.selectorText, { textAlign: 'right', fontWeight: 'bold' }]} numberOfLines={1}>
                      {lineAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>

              </Animated.View>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Net Total:</Text>
            <Text style={styles.totalValue}>Rs {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
          </View>
          
          <View style={styles.actionRow}>
            {(isEdit || mode === 'copy') && (
              <TouchableOpacity style={styles.copyBtn} onPress={handleCopyAsNew} disabled={saving || mode === 'copy'}>
                <Ionicons name="copy-outline" size={20} color={Theme.colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.copyBtnText}>Copy as New</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.saveBtn, (!isEdit && mode !== 'copy') && { flex: 1 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color={Theme.colors.white} /> : (
                <>
                  <Ionicons name="save-outline" size={20} color={Theme.colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.saveBtnText}>Save Supply</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

      </KeyboardAvoidingView>

      {/* Selection Modal */}
      <Modal visible={selectModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '50%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectModalType === 'item' ? 'Select Item' :
                 selectModalType === 'customer' ? 'Select Customer' :
                 selectModalType === 'narration' ? 'Select Narration' : 
                 selectModalType === 'supplyOrder' ? 'Select Supply Order' : 'Select Unit'}
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
              {selectModalType === 'item' && items
                .filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(i => (
                <TouchableOpacity key={i.id} style={styles.modalItem} onPress={() => handleSelect(i.id)}>
                  <Text style={styles.modalItemText}>{i.title}</Text>
                </TouchableOpacity>
              ))}
              {selectModalType === 'customer' && customers
                .filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()) || c.account.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(c => (
                <TouchableOpacity key={c.account} style={styles.modalItem} onPress={() => handleSelect(c.account)}>
                  <Text style={styles.modalItemText}>{c.title}</Text>
                </TouchableOpacity>
              ))}
              {selectModalType === 'narration' && narrations
                .filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(n => (
                <TouchableOpacity key={n.code} style={styles.modalItem} onPress={() => handleSelect(n.code)}>
                  <Text style={styles.modalItemText}>{n.title}</Text>
                </TouchableOpacity>
              ))}
              {selectModalType === 'unit' && units
                .filter(u => {
                  const selectedItem = items.find(i => i.id === itemId);
                  return !selectedItem || u.code === selectedItem.primaryUnit || u.code === selectedItem.secondaryUnit;
                })
                .filter(u => u.title.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(u => (
                <TouchableOpacity key={u.code} style={styles.modalItem} onPress={() => handleSelect(u.code)}>
                  <Text style={styles.modalItemText}>{u.title}</Text>
                </TouchableOpacity>
              ))}
              {selectModalType === 'supplyOrder' && supplyOrders
                .filter(o => o.title.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(o => (
                <TouchableOpacity key={o.id} style={styles.modalItem} onPress={() => handleSelect(o.id)}>
                  <Text style={styles.modalItemText}>{o.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
  linesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    marginTop: Theme.spacing.sm,
  },
  sectionTitle: {
    ...Theme.typography.h3,
    color: Theme.colors.text,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  voucherBadge: {
    backgroundColor: Theme.colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Theme.radii.sm,
  },
  voucherBadgeText: {
    ...Theme.typography.small,
    color: Theme.colors.primary,
    fontWeight: '700',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.radii.sm,
  },
  addBtnText: {
    ...Theme.typography.small,
    color: Theme.colors.primary,
    fontWeight: '600',
    marginLeft: 4,
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
  selector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radii.sm,
    padding: Theme.spacing.sm,
    backgroundColor: Theme.colors.background,
    minHeight: 46,
  },
  selectorText: {
    ...Theme.typography.body,
    color: Theme.colors.text,
  },
  placeholder: {
    color: Theme.colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lineCard: {
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radii.lg,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Theme.colors.warning,
    ...Theme.shadows.sm,
  },
  lineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.background,
    paddingBottom: Theme.spacing.sm,
  },
  lineSeq: {
    ...Theme.typography.small,
    fontWeight: '700',
    color: Theme.colors.textSecondary,
  },
  footer: {
    backgroundColor: Theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    padding: Theme.spacing.md,
    ...Theme.shadows.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  totalLabel: {
    ...Theme.typography.h3,
    color: Theme.colors.textSecondary,
  },
  totalValue: {
    ...Theme.typography.h2,
    color: Theme.colors.warning,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  copyBtn: {
    flex: 1,
    height: 50,
    backgroundColor: Theme.colors.white,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    borderRadius: Theme.radii.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.sm,
  },
  copyBtnText: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.primary,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    height: 50,
    backgroundColor: Theme.colors.warning,
    borderRadius: Theme.radii.sm,
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
    borderTopLeftRadius: Theme.radii.lg,
    borderTopRightRadius: Theme.radii.lg,
    maxHeight: '80%',
    padding: Theme.spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  modalTitle: {
    ...Theme.typography.h3,
  },
  modalItem: {
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.background,
  },
  modalItemText: {
    ...Theme.typography.body,
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
  linesSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    ...Theme.shadows.sm,
  },
  linesSearchInput: {
    flex: 1,
    height: '100%',
    ...Theme.typography.body,
    color: Theme.colors.text,
  },
});
