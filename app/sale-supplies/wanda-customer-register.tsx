import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import dayjs from 'dayjs';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Theme } from '../../constants/theme';
import {
  saleSupplyService, SaleSupplyLine, SaleSupplyCustomerLineUpdateRequest
} from '../../services/saleSupplyService';
import { chartOfAccountService, ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import { inventoryService, Item } from '../../services/inventoryService';
import { InlineSearchSelect } from '../../components/ui/InlineSearchSelect';

interface EditableLine extends SaleSupplyLine {
  isDirty?: boolean;
  packQty?: number;
  packing?: number;
}

export default function WandaCustomerRegister() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Lookups
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  // Filters
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<Date>(dayjs().startOf('month').toDate());
  const [toDate, setToDate] = useState<Date>(dayjs().toDate());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [filterCollapsed, setFilterCollapsed] = useState(false);

  const [lines, setLines] = useState<EditableLine[]>([]);

  // Inline Quick Add State
  const [quickAddExpanded, setQuickAddExpanded] = useState(false);
  const [addDate, setAddDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [addItemId, setAddItemId] = useState('');
  const [addQty, setAddQty] = useState('50');
  const [addSecQty, setAddSecQty] = useState('1');
  const [addRate, setAddRate] = useState('0');
  const [addSecRate, setAddSecRate] = useState('0');
  const [addDiscount, setAddDiscount] = useState('0');
  const [addAddLess, setAddAddLess] = useState('0');
  const [addPackQty, setAddPackQty] = useState('50');
  const [addingEntry, setAddingEntry] = useState(false);

  useEffect(() => {
    loadLookups();
  }, []);

  const loadLookups = async () => {
    try {
      const [cusData, itemData] = await Promise.all([
        chartOfAccountService.getCustomerAccounts(),
        inventoryService.getItemsLookup()
      ]);
      setCustomers(cusData);
      setItems(itemData);
    } catch (error) {
      console.error('Failed to load lookups', error);
    }
  };

  const fetchCustomerLines = useCallback(async () => {
    if (!selectedCustomerId) {
      setLines([]);
      return;
    }

    try {
      setLoading(true);
      const params = {
        customerId: selectedCustomerId,
        fromDate: dayjs(fromDate).format('YYYY-MM-DD'),
        toDate: dayjs(toDate).format('YYYY-MM-DD'),
        itemId: selectedItemId || undefined
      };
      const result = await saleSupplyService.getCustomerLines(params);
      result.sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
      setLines(result.map(l => ({ ...l, isDirty: false })));
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to fetch customer supply records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCustomerId, fromDate, toDate, selectedItemId]);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomerLines();
    }
  }, [selectedCustomerId, fromDate, toDate, selectedItemId, fetchCustomerLines]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCustomerLines();
  };

  const setDateShortcut = (shortcut: 'thisMonth' | 'lastMonth' | 'thisWeek' | 'today') => {
    if (shortcut === 'thisMonth') {
      setFromDate(dayjs().startOf('month').toDate());
      setToDate(dayjs().endOf('month').toDate());
    } else if (shortcut === 'lastMonth') {
      setFromDate(dayjs().subtract(1, 'month').startOf('month').toDate());
      setToDate(dayjs().subtract(1, 'month').endOf('month').toDate());
    } else if (shortcut === 'thisWeek') {
      setFromDate(dayjs().startOf('week').toDate());
      setToDate(dayjs().endOf('week').toDate());
    } else if (shortcut === 'today') {
      setFromDate(dayjs().toDate());
      setToDate(dayjs().toDate());
    }
  };

  const handleInlineWandaChange = (voucherNo: string, seq: number, field: string, rawVal: string) => {
    const numVal = parseFloat(rawVal) || 0;
    setLines(prev => prev.map(l => {
      if (l.voucherNo !== voucherNo || l.seq !== seq) return l;
      const pack = (l.secQty && l.secQty > 0) ? (l.qty / l.secQty) : 50;
      let qty = Number(l.qty) || 0;
      let secQty = Number(l.secQty) || 0;
      let rate = Number(l.rate) || 0;
      let secRate = Number(l.secRate) || 0;
      let discount = Number(l.discount) || 0;
      let addLess = Number(l.addLess) || 0;

      if (field === 'secQty') {
        secQty = numVal;
        if (pack > 0) qty = Math.round(secQty * pack * 100) / 100;
      } else if (field === 'qty') {
        qty = numVal;
        if (pack > 0) secQty = Math.round((qty / pack) * 100) / 100;
      } else if (field === 'rate') {
        rate = numVal;
        if (pack > 0) secRate = Math.round(rate * pack * 100) / 100;
      } else if (field === 'secRate') {
        secRate = numVal;
        if (pack > 0) rate = Math.round((secRate / pack) * 100000000) / 100000000;
      } else if (field === 'discount') {
        discount = numVal;
      } else if (field === 'addLess') {
        addLess = numVal;
      }

      const amount = Math.round((((qty * rate) - discount) + addLess) * 100) / 100;
      return {
        ...l,
        qty,
        secQty,
        rate,
        secRate,
        discount,
        addLess,
        amount,
        isDirty: true
      };
    }));
  };

  const handleSaveSingleLine = async (line: EditableLine) => {
    try {
      setSaving(true);
      await saleSupplyService.updateLine(line.voucherNo, line.seq, {
        seq: line.seq,
        customerId: line.customerId,
        unit: 'Kg',
        qty: line.qty,
        rate: line.rate,
        discount: line.discount,
        addLess: line.addLess,
        secQty: line.secQty,
        secRate: line.secRate,
        secUnit: 'Bags'
      });

      setLines(prev => prev.map(l => (
        l.voucherNo === line.voucherNo && l.seq === line.seq ? { ...l, isDirty: false } : l
      )));
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to update record');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    const dirtyLines = lines.filter(l => l.isDirty);
    if (dirtyLines.length === 0) {
      Alert.alert('Info', 'No modified records to save');
      return;
    }

    try {
      setSaving(true);
      const requests: SaleSupplyCustomerLineUpdateRequest[] = dirtyLines.map(l => ({
        voucherNo: l.voucherNo,
        seq: l.seq,
        line: {
          seq: l.seq,
          customerId: l.customerId,
          unit: 'Kg',
          qty: l.qty,
          rate: l.rate,
          discount: l.discount,
          addLess: l.addLess,
          secQty: l.secQty,
          secRate: l.secRate,
          secUnit: 'Bags'
        }
      }));

      await saleSupplyService.updateCustomerLines(requests);
      Alert.alert('Success', `Saved ${dirtyLines.length} record updates`);
      fetchCustomerLines();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save batch updates');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLine = (line: EditableLine) => {
    Alert.alert(
      'Delete Supply Record',
      `Delete line from SP-${line.voucherNo}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await saleSupplyService.deleteLine(line.voucherNo, line.seq);
              fetchCustomerLines();
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Failed to delete record line');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleAddBagsChange = (val: string) => {
    setAddSecQty(val);
    const bags = parseFloat(val) || 0;
    const pack = parseFloat(addPackQty) || 50;
    if (bags > 0 && pack > 0) {
      setAddQty(String(Math.round(bags * pack * 100) / 100));
    }
  };

  const handleAddWeightChange = (val: string) => {
    setAddQty(val);
    const weight = parseFloat(val) || 0;
    const pack = parseFloat(addPackQty) || 50;
    if (weight > 0 && pack > 0) {
      setAddSecQty(String(Math.round((weight / pack) * 100) / 100));
    }
  };

  const handleAddRateKgChange = (val: string) => {
    setAddRate(val);
    const rateKg = parseFloat(val) || 0;
    const pack = parseFloat(addPackQty) || 50;
    if (rateKg > 0 && pack > 0) {
      setAddSecRate(String(Math.round(rateKg * pack * 100) / 100));
    }
  };

  const handleAddBagRateChange = (val: string) => {
    setAddSecRate(val);
    const bagRate = parseFloat(val) || 0;
    const pack = parseFloat(addPackQty) || 50;
    if (bagRate > 0 && pack > 0) {
      setAddRate(String(Math.round((bagRate / pack) * 100000000) / 100000000));
    }
  };

  const handleAddSupplyRecord = async () => {
    if (!selectedCustomerId || !addItemId) {
      Alert.alert('Error', 'Please select customer and item');
      return;
    }

    try {
      setAddingEntry(true);
      const qty = parseFloat(addQty) || 0;
      const rate = parseFloat(addRate) || 0;
      const discount = parseFloat(addDiscount) || 0;
      const addLess = parseFloat(addAddLess) || 0;
      const secQty = parseFloat(addSecQty) || 0;
      const secRate = parseFloat(addSecRate) || 0;

      const existingVouchers = await saleSupplyService.getList({
        fromDate: addDate,
        toDate: addDate,
        itemId: addItemId
      });

      if (existingVouchers.data?.length > 0) {
        const targetVoucher = existingVouchers.data[0];
        const details = await saleSupplyService.getDetail(targetVoucher.voucherNo);
        const nextSeq = details.length > 0 ? Math.max(...details.map(d => d.seq)) + 1 : 1;

        const updatedLines = details.map(d => ({
          seq: d.seq,
          customerId: d.customerId,
          unit: d.unit || 'Kg',
          qty: d.qty,
          rate: d.rate,
          discount: d.discount,
          addLess: d.addLess,
          secQty: d.secQty,
          secRate: d.secRate,
          secUnit: d.secUnit || 'Bags'
        }));

        updatedLines.push({
          seq: nextSeq,
          customerId: selectedCustomerId,
          unit: 'Kg',
          qty,
          rate,
          discount,
          addLess,
          secQty,
          secRate,
          secUnit: 'Bags'
        });

        await saleSupplyService.update(targetVoucher.voucherNo, {
          date: addDate,
          itemId: addItemId,
          lines: updatedLines
        });
      } else {
        await saleSupplyService.create({
          date: addDate,
          itemId: addItemId,
          lines: [{
            seq: 1,
            customerId: selectedCustomerId,
            qty,
            rate,
            discount,
            addLess,
            secQty,
            secRate
          }]
        });
      }

      setQuickAddExpanded(false);
      fetchCustomerLines();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to add supply record');
    } finally {
      setAddingEntry(false);
    }
  };

  const stats = useMemo(() => {
    const totalRecords = lines.length;
    const totalQty = lines.reduce((acc, l) => acc + (Number(l.qty) || 0), 0);
    const totalBags = lines.reduce((acc, l) => acc + (Number(l.secQty) || 0), 0);
    const totalAmount = lines.reduce((acc, l) => acc + (Number(l.amount) || 0), 0);
    const dirtyCount = lines.filter(l => l.isDirty).length;
    return { totalRecords, totalQty, totalBags, totalAmount, dirtyCount };
  }, [lines]);

  const selectedCustomerName = useMemo(() => {
    return customers.find(c => c.account === selectedCustomerId)?.title || 'Select Customer';
  }, [customers, selectedCustomerId]);

  const customerOptions = useMemo(() => customers.map(c => ({
    value: c.account,
    label: c.title,
    subtitle: c.parentCustomerTitle ? `Sub of: ${c.parentCustomerTitle} • ${c.account}` : c.account
  })), [customers]);

  const itemOptions = useMemo(() => items.map(i => ({
    value: i.id,
    label: i.title,
    subtitle: `Rate: Rs. ${i.priRate || 0}/Kg | Pack: ${i.qtyInPack || 50} Kg`
  })), [items]);

  const renderRecordItem = ({ item, index }: { item: EditableLine; index: number }) => (
    <Animated.View entering={FadeInUp.delay(Math.min(index * 20, 200)).duration(250)}>
      <View style={[styles.compactRow, item.isDirty && styles.compactRowDirty]}>
        {/* Top Row: Date, Voucher Tag, Item Title, Net Amount, Save/Delete */}
        <View style={styles.rowHeader}>
          <View style={styles.rowHeaderLeft}>
            <Text style={styles.compactDate}>{dayjs(item.date).format('DD-MMM')}</Text>
            <TouchableOpacity onPress={() => router.push(`/sale-supplies/${item.voucherNo}`)}>
              <View style={styles.compactVoucherTag}>
                <Text style={styles.compactVoucherText}>SP-{item.voucherNo}</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.compactItemTitle} numberOfLines={1}>
              {item.itemTitle || item.itemId}
            </Text>
            {Boolean(item.subAccountTitle) && (
              <View style={{ backgroundColor: '#e0f2fe', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 }}>
                <Text style={{ fontSize: 10, color: '#0369a1', fontWeight: '700' }}>
                  {item.subAccountTitle}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.rowHeaderRight}>
            <Text style={styles.compactAmount}>Rs. {(item.amount || 0).toFixed(2)}</Text>
            {item.isDirty && (
              <TouchableOpacity style={styles.compactSaveBtn} onPress={() => handleSaveSingleLine(item)}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.compactDeleteBtn} onPress={() => handleDeleteLine(item)}>
              <Ionicons name="trash-outline" size={15} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Inline Editable Wanda Fields */}
        <View style={styles.inlineFieldsRow}>
          <View style={styles.inlineFieldCol}>
            <Text style={styles.inlineFieldLabel}>Bags</Text>
            <TextInput
              style={styles.inlineInput}
              keyboardType="numeric"
              value={String(item.secQty || 0)}
              onChangeText={(val) => handleInlineWandaChange(item.voucherNo, item.seq, 'secQty', val)}
              selectTextOnFocus
            />
          </View>
          <View style={styles.inlineFieldCol}>
            <Text style={styles.inlineFieldLabel}>Wt (Kg)</Text>
            <TextInput
              style={styles.inlineInput}
              keyboardType="numeric"
              value={String(item.qty || 0)}
              onChangeText={(val) => handleInlineWandaChange(item.voucherNo, item.seq, 'qty', val)}
              selectTextOnFocus
            />
          </View>
          <View style={styles.inlineFieldCol}>
            <Text style={styles.inlineFieldLabel}>Bag Rate</Text>
            <TextInput
              style={styles.inlineInput}
              keyboardType="numeric"
              value={String(Math.round((Number(item.secRate) || 0) * 100) / 100)}
              onChangeText={(val) => handleInlineWandaChange(item.voucherNo, item.seq, 'secRate', val)}
              selectTextOnFocus
            />
          </View>
          <View style={styles.inlineFieldCol}>
            <Text style={styles.inlineFieldLabel}>Rate/Kg</Text>
            <TextInput
              style={styles.inlineInput}
              keyboardType="numeric"
              value={String(Math.round((Number(item.rate) || 0) * 100) / 100)}
              onChangeText={(val) => handleInlineWandaChange(item.voucherNo, item.seq, 'rate', val)}
              selectTextOnFocus
            />
          </View>
          <View style={styles.inlineFieldCol}>
            <Text style={styles.inlineFieldLabel}>Add/Less</Text>
            <TextInput
              style={styles.inlineInput}
              keyboardType="numeric"
              value={String(item.addLess || 0)}
              onChangeText={(val) => handleInlineWandaChange(item.voucherNo, item.seq, 'addLess', val)}
              selectTextOnFocus
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header Banner */}
      <View style={styles.headerBanner}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Wanda Customer Register</Text>
            <Text style={styles.bannerSub} numberOfLines={1}>{selectedCustomerName}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.toggleFilterBtn}
              onPress={() => setFilterCollapsed(!filterCollapsed)}
            >
              <Ionicons name={filterCollapsed ? "options-outline" : "chevron-up"} size={18} color="#fff" />
            </TouchableOpacity>
            {stats.dirtyCount > 0 && (
              <TouchableOpacity
                style={styles.saveAllBtn}
                onPress={handleSaveAll}
                disabled={saving}
              >
                <Ionicons name="save-outline" size={16} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.saveAllText}>Save ({stats.dirtyCount})</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Filter Section */}
      {!filterCollapsed && (
        <View style={styles.filterCard}>
          <InlineSearchSelect
            options={customerOptions}
            value={selectedCustomerId || ''}
            onSelect={(val) => setSelectedCustomerId(val)}
            placeholder="Search & Select Customer..."
            icon="person-outline"
            compact
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shortcutScroll} contentContainerStyle={styles.shortcutContent}>
            <TouchableOpacity style={styles.shortcutChip} onPress={() => setDateShortcut('thisMonth')}>
              <Text style={styles.shortcutText}>This Month</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutChip} onPress={() => setDateShortcut('lastMonth')}>
              <Text style={styles.shortcutText}>Last Month</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutChip} onPress={() => setDateShortcut('thisWeek')}>
              <Text style={styles.shortcutText}>This Week</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcutChip} onPress={() => setDateShortcut('today')}>
              <Text style={styles.shortcutText}>Today</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowFromPicker(true)} activeOpacity={0.7}>
                <Ionicons name="calendar-outline" size={14} color="#2563eb" />
                <Text style={styles.dateText}>{dayjs(fromDate).format('DD MMM YYYY')}</Text>
              </TouchableOpacity>
              {showFromPicker && (
                <DateTimePicker
                  value={fromDate}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowFromPicker(false);
                    if (selectedDate) setFromDate(selectedDate);
                  }}
                />
              )}
            </View>

            <View style={styles.dateField}>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowToPicker(true)} activeOpacity={0.7}>
                <Ionicons name="calendar-outline" size={14} color="#2563eb" />
                <Text style={styles.dateText}>{dayjs(toDate).format('DD MMM YYYY')}</Text>
              </TouchableOpacity>
              {showToPicker && (
                <DateTimePicker
                  value={toDate}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowToPicker(false);
                    if (selectedDate) setToDate(selectedDate);
                  }}
                />
              )}
            </View>

            {selectedCustomerId && (
              <TouchableOpacity
                style={styles.addRecordBtn}
                onPress={() => setQuickAddExpanded(prev => !prev)}
              >
                <Ionicons name={quickAddExpanded ? 'close' : 'add'} size={16} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', marginLeft: 3 }}>
                  {quickAddExpanded ? 'Hide' : 'Quick Add'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Inline Collapsible Quick Add Supply Record Bar */}
          {selectedCustomerId && quickAddExpanded && (
            <View style={styles.quickAddBox}>
              <Text style={styles.quickAddTitle}>+ Quick Add Wanda Supply Record</Text>
              <InlineSearchSelect
                options={itemOptions}
                value={addItemId}
                onSelect={(val) => {
                  setAddItemId(val);
                  const found = items.find(i => i.id === val);
                  if (found) {
                    const pack = found.qtyInPack || 50;
                    setAddPackQty(String(pack));
                    const rateKg = found.priRate || 0;
                    setAddRate(String(rateKg));
                    setAddSecRate(String(Math.round(rateKg * pack * 100) / 100));
                  }
                }}
                placeholder="Select Feed Item..."
                icon="cube-outline"
                compact
              />
              <View style={[styles.inlineFieldsRow, { marginTop: 6 }]}>
                <View style={[styles.inlineFieldCol, { flex: 1.2 }]}>
                  <Text style={styles.inlineFieldLabel}>Date</Text>
                  <TextInput
                    style={styles.inlineInput}
                    value={addDate}
                    onChangeText={setAddDate}
                  />
                </View>
                <View style={styles.inlineFieldCol}>
                  <Text style={styles.inlineFieldLabel}>Bags</Text>
                  <TextInput
                    style={styles.inlineInput}
                    keyboardType="numeric"
                    value={addSecQty}
                    onChangeText={handleAddBagsChange}
                    selectTextOnFocus
                  />
                </View>
                <View style={styles.inlineFieldCol}>
                  <Text style={styles.inlineFieldLabel}>Wt (Kg)</Text>
                  <TextInput
                    style={styles.inlineInput}
                    keyboardType="numeric"
                    value={addQty}
                    onChangeText={handleAddWeightChange}
                    selectTextOnFocus
                  />
                </View>
                <View style={styles.inlineFieldCol}>
                  <Text style={styles.inlineFieldLabel}>Bag Rate</Text>
                  <TextInput
                    style={styles.inlineInput}
                    keyboardType="numeric"
                    value={addSecRate}
                    onChangeText={handleAddBagRateChange}
                    selectTextOnFocus
                  />
                </View>
                <TouchableOpacity
                  style={styles.quickAddSubmitBtn}
                  onPress={handleAddSupplyRecord}
                  disabled={addingEntry}
                >
                  {addingEntry ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.quickAddSubmitText}>Add</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Main List */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            data={lines}
            keyExtractor={(item) => `${item.voucherNo}-${item.seq}`}
            renderItem={renderRecordItem}
            contentContainerStyle={styles.listContainer}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={40} color="#94a3b8" />
                <Text style={styles.emptyText}>
                  {selectedCustomerId
                    ? 'No supply records found in date range.'
                    : 'Select a customer above to view supply records.'}
                </Text>
              </View>
            }
          />
        )}
      </KeyboardAvoidingView>

      {/* Bottom Sticky Summary Footer Bar */}
      {selectedCustomerId && (
        <View style={styles.bottomSummaryBar}>
          <View style={styles.bottomSummaryLeft}>
            <Text style={styles.bottomSummaryCustomer} numberOfLines={1}>{selectedCustomerName}</Text>
            <Text style={styles.bottomSummaryStats}>
              {stats.totalRecords} Rows | Bags: <Text style={{ fontWeight: '700', color: '#fef08a' }}>{stats.totalBags}</Text> | Wt: <Text style={{ fontWeight: '700', color: '#93c5fd' }}>{stats.totalQty.toFixed(2)} Kg</Text>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              style={styles.printBillBtn}
              onPress={() => {
                router.push({
                  pathname: '/(tabs)/reports',
                  params: {
                    report: 'customer-bill',
                    account: selectedCustomerId,
                    fromDate: dayjs(fromDate).format('YYYY-MM-DD'),
                    toDate: dayjs(toDate).format('YYYY-MM-DD')
                  }
                });
              }}
            >
              <Ionicons name="print-outline" size={16} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.printBillText}>Print Bill</Text>
            </TouchableOpacity>

            <View style={styles.bottomSummaryRight}>
              <Text style={styles.bottomSummaryLabel}>TOTAL AMOUNT</Text>
              <Text style={styles.bottomSummaryVal}>Rs. {stats.totalAmount.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  headerBanner: {
    backgroundColor: '#1e40af',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bannerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  bannerSub: { fontSize: 12, color: '#bfdbfe', marginTop: 1 },
  toggleFilterBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  saveAllBtn: {
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  saveAllText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  filterCard: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8
  },
  shortcutScroll: { marginVertical: 2 },
  shortcutContent: { gap: 6 },
  shortcutChip: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe'
  },
  shortcutText: { fontSize: 11, fontWeight: '600', color: '#1d4ed8' },
  dateRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dateField: { flex: 1 },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    gap: 4
  },
  dateText: { fontSize: 12, fontWeight: '600', color: '#0f172a' },
  addRecordBtn: {
    backgroundColor: '#0284c7',
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center'
  },
  quickAddBox: {
    backgroundColor: '#f0f9ff',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginTop: 4
  },
  quickAddTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
    marginBottom: 6
  },
  quickAddSubmitBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end'
  },
  quickAddSubmitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12
  },
  listContainer: { paddingHorizontal: 10, paddingVertical: 6, paddingBottom: 80 },
  compactRow: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1
  },
  compactRowDirty: { backgroundColor: '#fefce8', borderColor: '#eab308' },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  rowHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1
  },
  rowHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  compactDate: { fontSize: 11, fontWeight: '700', color: '#475569' },
  compactVoucherTag: { backgroundColor: '#fff7ed', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 0.5, borderColor: '#fdba74' },
  compactVoucherText: { fontSize: 10, fontWeight: '700', color: '#c2410c' },
  compactItemTitle: { fontSize: 13, fontWeight: '700', color: '#1d4ed8', flex: 1 },
  compactAmount: { fontSize: 14, fontWeight: '800', color: '#15803d' },
  compactSaveBtn: { backgroundColor: '#16a34a', borderRadius: 4, padding: 4 },
  compactDeleteBtn: { padding: 2 },
  inlineFieldsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center'
  },
  inlineFieldCol: {
    flex: 1
  },
  inlineFieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 2
  },
  inlineInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 6,
    height: 34,
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a'
  },
  bottomSummaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8
  },
  bottomSummaryLeft: { flex: 1 },
  bottomSummaryCustomer: { fontSize: 13, fontWeight: '600', color: '#cbd5e1' },
  bottomSummaryStats: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  printBillBtn: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  printBillText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  bottomSummaryRight: { alignItems: 'flex-end' },
  bottomSummaryLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5 },
  bottomSummaryVal: { fontSize: 18, fontWeight: '800', color: '#4ade80' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { padding: 30, alignItems: 'center' },
  emptyText: { marginTop: 8, fontSize: 13, color: '#64748b', textAlign: 'center' }
});
