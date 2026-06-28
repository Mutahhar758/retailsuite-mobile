import React, { useEffect, useState, useMemo } from 'react';
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

export default function PurchaseFormScreen() {
  const { voucherNo, mode } = useLocalSearchParams<{ voucherNo: string; mode?: string }>();
  const router = useRouter();
  const isEdit = voucherNo && voucherNo !== 'new' && mode !== 'copy';

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
        narrationService.getActiveNarrations(),
        inventoryService.getItems(),
        inventoryService.getUnits()
      ]);
      setSuppliers(sups);
      setNarrations(narrs);
      setItems(itms);
      setUnits(unts);
      
      if (isEdit) {
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
        setDate(new Date(first.date));
        setSupplierAccount(first.accountId);
        setNarration(first.narrationId || '');
        setDescription(first.description || '');
        
        const mappedLines = details.map(d => ({
          seq: d.seq,
          itemId: d.itemId,
          unit: d.unit || '',
          qty: d.qty,
          rate: d.rate,
          addLess: d.addLess
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
      if (selectedItem) {
        defaultUnit = selectedItem.defaultUnit || selectedItem.primaryUnit || '';
        defaultRate = (defaultUnit === selectedItem.secondaryUnit ? selectedItem.secRate : selectedItem.priRate) || 0;
      }
      setCurrentLine(prev => ({
        ...prev,
        itemId: val,
        unit: defaultUnit,
        rate: defaultRate
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
        addLess: 0
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
        addLess: l.addLess
      }));

      const request = {
        date: dayjs(date).format('YYYY-MM-DD'),
        account: supplierAccount,
        narration: narration || undefined,
        description: description || undefined,
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
          router.replace({ pathname: '/purchases/[voucherNo]' as any, params: { voucherNo: voucherNo, mode: 'copy' } });
        }
      }
    ]);
  };

  const totalAmount = useMemo(() => {
    return lines.reduce((sum, l) => sum + (l.qty * l.rate + l.addLess), 0);
  }, [lines]);

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
                const lineTotal = line.qty * line.rate + line.addLess;
                return (
                  <View key={line.seq} style={styles.lineCard}>
                    <View style={styles.lineInfo}>
                      <Text style={styles.lineAccount} numberOfLines={1}>{itemTitle}</Text>
                      <Text style={styles.lineAmount}>Rs. {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                      <Text style={styles.lineDetail}>
                        Qty: {line.qty} {unitTitle} @ Rs. {line.rate.toLocaleString()} 
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

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Quantity *</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    placeholder="Enter quantity"
                    placeholderTextColor={Theme.colors.textSecondary}
                    value={currentLine.qty !== undefined ? currentLine.qty.toString() : ''}
                    onChangeText={(val) => setCurrentLine({ ...currentLine, qty: parseFloat(val) || 0 })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Rate *</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    placeholder="Enter rate"
                    placeholderTextColor={Theme.colors.textSecondary}
                    value={currentLine.rate !== undefined ? currentLine.rate.toString() : ''}
                    onChangeText={(val) => setCurrentLine({ ...currentLine, rate: parseFloat(val) || 0 })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Add / Less Amount</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    placeholder="Enter adjustment"
                    placeholderTextColor={Theme.colors.textSecondary}
                    value={currentLine.addLess !== undefined ? currentLine.addLess.toString() : ''}
                    onChangeText={(val) => setCurrentLine({ ...currentLine, addLess: parseFloat(val) || 0 })}
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

              <ScrollView>
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
                        <Text style={styles.modalListItemSub}>{u.code}</Text>
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
});
