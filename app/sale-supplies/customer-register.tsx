import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView,
  ActivityIndicator, RefreshControl, Modal, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
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
import { inventoryService, Item, Unit } from '../../services/inventoryService';
import { useAppStore } from '../../store/appStore';

interface EditableLine extends SaleSupplyLine {
  isDirty?: boolean;
}

export default function CustomerSupplyRegisterScreen() {
  const router = useRouter();
  const { currentTenantIdentifier, licenses } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const hasSecondaryQty = currentOrg?.hasSecondaryQty ?? false;
  const hasVariablePackFeature = (currentOrg as any)?.hasVariablePackFeature ?? false;

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Lookups
  const [customers, setCustomers] = useState<ChartOfAccountHeadDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // Filters
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<Date>(dayjs().startOf('month').toDate());
  const [toDate, setToDate] = useState<Date>(dayjs().toDate());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [filterCollapsed, setFilterCollapsed] = useState(false);

  const [lines, setLines] = useState<EditableLine[]>([]);

  // Modals
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Line Edit Modal
  const [editLine, setEditLine] = useState<EditableLine | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editQty, setEditQty] = useState('');
  const [editRate, setEditRate] = useState('');
  const [editDiscount, setEditDiscount] = useState('');
  const [editAddLess, setEditAddLess] = useState('');
  const [editSecQty, setEditSecQty] = useState('');
  const [editSecRate, setEditSecRate] = useState('');

  // Quick Add Modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addDate, setAddDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [addItemId, setAddItemId] = useState('');
  const [addQty, setAddQty] = useState('1');
  const [addRate, setAddRate] = useState('0');
  const [addDiscount, setAddDiscount] = useState('0');
  const [addAddLess, setAddAddLess] = useState('0');
  const [addSecQty, setAddSecQty] = useState('0');
  const [addSecRate, setAddSecRate] = useState('0');
  const [addingEntry, setAddingEntry] = useState(false);

  useEffect(() => {
    loadLookups();
  }, []);

  const loadLookups = async () => {
    try {
      const [cusData, itemData, unitData] = await Promise.all([
        chartOfAccountService.getCustomerAccounts(),
        inventoryService.getItemsLookup(),
        inventoryService.getUnitsLookup()
      ]);
      setCustomers(cusData);
      setItems(itemData);
      setUnits(unitData);
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
      // Sort ASC by date
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

  // Open Edit Modal for a specific line
  const handleOpenEditModal = (line: EditableLine) => {
    setEditLine(line);
    setEditQty(String(line.qty || 0));
    setEditRate(String(line.rate || 0));
    setEditDiscount(String(line.discount || 0));
    setEditAddLess(String(line.addLess || 0));
    setEditSecQty(String(line.secQty || 0));
    setEditSecRate(String(line.secRate || 0));
    setEditModalVisible(true);
  };

  // Apply edits to line in state
  const handleApplyLineEdit = () => {
    if (!editLine) return;

    const qty = parseFloat(editQty) || 0;
    const rate = parseFloat(editRate) || 0;
    const discount = parseFloat(editDiscount) || 0;
    const addLess = parseFloat(editAddLess) || 0;
    const secQty = parseFloat(editSecQty) || 0;
    const secRate = parseFloat(editSecRate) || 0;

    const amount = hasVariablePackFeature
      ? Math.round(((qty * (rate - discount)) + addLess) * 100) / 100
      : Math.round(((qty * (rate - discount)) + addLess + (secQty * secRate)) * 100) / 100;

    setLines(prev => prev.map(l => (
      l.voucherNo === editLine.voucherNo && l.seq === editLine.seq
        ? {
            ...l,
            qty,
            rate,
            discount,
            addLess,
            secQty,
            secRate,
            amount,
            isDirty: true
          }
        : l
    )));

    setEditModalVisible(false);
  };

  // Save single line back to server
  const handleSaveSingleLine = async (line: EditableLine) => {
    try {
      setSaving(true);
      await saleSupplyService.updateLine(line.voucherNo, line.seq, {
        seq: line.seq,
        customerId: line.customerId,
        unit: line.unit || undefined,
        qty: line.qty,
        rate: line.rate,
        discount: line.discount,
        addLess: line.addLess,
        secQty: line.secQty,
        secRate: line.secRate,
        secUnit: line.secUnit || undefined
      });

      Alert.alert('Success', `Updated record for SP-${line.voucherNo}`);
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

  // Save all modified lines
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
          unit: l.unit || undefined,
          qty: l.qty,
          rate: l.rate,
          discount: l.discount,
          addLess: l.addLess,
          secQty: l.secQty,
          secRate: l.secRate,
          secUnit: l.secUnit || undefined
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

  // Delete line
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
              Alert.alert('Deleted', `Record deleted from SP-${line.voucherNo}`);
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

  // Add new supply record
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

      if (existingVouchers.length > 0) {
        const targetVoucher = existingVouchers[0];
        const details = await saleSupplyService.getDetail(targetVoucher.voucherNo);
        const nextSeq = details.length > 0 ? Math.max(...details.map(d => d.seq)) + 1 : 1;

        const updatedLines = details.map(d => ({
          seq: d.seq,
          customerId: d.customerId,
          unit: d.unit || undefined,
          qty: d.qty,
          rate: d.rate,
          discount: d.discount,
          addLess: d.addLess,
          secQty: d.secQty,
          secRate: d.secRate,
          secUnit: d.secUnit || undefined
        }));

        updatedLines.push({
          seq: nextSeq,
          customerId: selectedCustomerId,
          unit: undefined,
          qty,
          rate,
          discount,
          addLess,
          secQty,
          secRate,
          secUnit: undefined
        });

        await saleSupplyService.update(targetVoucher.voucherNo, {
          date: addDate,
          itemId: addItemId,
          lines: updatedLines
        });

        Alert.alert('Success', `Added supply record to SP-${targetVoucher.voucherNo}`);
      } else {
        const newVNo = await saleSupplyService.create({
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

        Alert.alert('Success', `Created new supply voucher SP-${newVNo}`);
      }

      setAddModalVisible(false);
      fetchCustomerLines();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to add supply record');
    } finally {
      setAddingEntry(false);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const totalRecords = lines.length;
    const totalQty = lines.reduce((acc, l) => acc + (Number(l.qty) || 0), 0);
    const totalAmount = lines.reduce((acc, l) => acc + (Number(l.amount) || 0), 0);
    const dirtyCount = lines.filter(l => l.isDirty).length;
    return { totalRecords, totalQty, totalAmount, dirtyCount };
  }, [lines]);

  const selectedCustomerName = useMemo(() => {
    return customers.find(c => c.account === selectedCustomerId)?.title || 'Select Customer';
  }, [customers, selectedCustomerId]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    return customers.filter(c =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.account.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [customers, searchQuery]);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    return items.filter(i =>
      i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  // Ultra-Compact Line Item Render (High Density, 52px height)
  const renderRecordItem = ({ item, index }: { item: EditableLine; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 20).duration(250)}>
      <TouchableOpacity
        style={[styles.compactRow, item.isDirty && styles.compactRowDirty]}
        activeOpacity={0.7}
        onPress={() => handleOpenEditModal(item)}
      >
        {/* Left Column: Date & Voucher Tag */}
        <View style={styles.compactLeft}>
          <Text style={styles.compactDate}>{dayjs(item.date).format('DD-MMM')}</Text>
          <TouchableOpacity onPress={() => router.push(`/sale-supplies/${item.voucherNo}`)}>
            <View style={styles.compactVoucherTag}>
              <Text style={styles.compactVoucherText}>SP-{item.voucherNo}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Center Column: Item Title & Metrics Formula */}
        <View style={styles.compactCenter}>
          <Text style={styles.compactItemTitle} numberOfLines={1}>
            {item.itemTitle || item.itemId}
          </Text>
          <Text style={styles.compactSubText} numberOfLines={1}>
            Qty: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{item.qty}</Text>
            {item.rate > 0 ? ` @ $${item.rate}` : ''}
            {item.discount > 0 ? ` (Disc: $${item.discount})` : ''}
            {hasSecondaryQty && item.secQty ? ` | Sec: ${item.secQty}` : ''}
          </Text>
        </View>

        {/* Right Column: Net Amount & Direct Actions */}
        <View style={styles.compactRight}>
          <Text style={styles.compactAmount}>${(item.amount || 0).toFixed(2)}</Text>
          <View style={styles.compactActions}>
            {item.isDirty ? (
              <TouchableOpacity style={styles.compactSaveBtn} onPress={() => handleSaveSingleLine(item)}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </TouchableOpacity>
            ) : (
              <Ionicons name="create-outline" size={16} color="#3b82f6" />
            )}
            <TouchableOpacity style={styles.compactDeleteBtn} onPress={() => handleDeleteLine(item)}>
              <Ionicons name="trash-outline" size={14} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header Banner */}
      <View style={styles.headerBanner}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Customer Supply Register</Text>
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

      {/* Filter Section (Collapsible to maximize list scroll space) */}
      {!filterCollapsed && (
        <View style={styles.filterCard}>
          <TouchableOpacity
            style={styles.selectorBtn}
            onPress={() => {
              setSearchQuery('');
              setCustomerModalVisible(true);
            }}
          >
            <Ionicons name="person-outline" size={16} color="#2563eb" style={{ marginRight: 6 }} />
            <Text style={styles.selectorText} numberOfLines={1}>
              {selectedCustomerName}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#64748b" />
          </TouchableOpacity>

          {/* Quick Date Range Chips */}
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
                onPress={() => setAddModalVisible(true)}
              >
                <Ionicons name="add" size={16} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Main High-Density Scrollable List */}
      <View style={{ flex: 1 }}>
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
      </View>

      {/* Bottom Sticky Summary Footer Bar */}
      {selectedCustomerId && (
        <View style={styles.bottomSummaryBar}>
          <View style={styles.bottomSummaryLeft}>
            <Text style={styles.bottomSummaryCustomer} numberOfLines={1}>{selectedCustomerName}</Text>
            <Text style={styles.bottomSummaryStats}>
              {stats.totalRecords} Rows | Qty: <Text style={{ fontWeight: '700', color: '#93c5fd' }}>{stats.totalQty.toFixed(2)}</Text>
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
              <Text style={styles.bottomSummaryVal}>${stats.totalAmount.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Customer Selector Modal */}
      <Modal visible={customerModalVisible} animationType="slide" transparent>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Customer</Text>
            <TouchableOpacity onPress={() => setCustomerModalVisible(false)}>
              <Ionicons name="close" size={24} color="#1e293b" />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search customer name or code..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <FlatList
            data={filteredCustomers}
            keyExtractor={(item) => item.account}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  setSelectedCustomerId(item.account);
                  setCustomerModalVisible(false);
                }}
              >
                <Text style={styles.optionTitle}>{item.title}</Text>
                <Text style={styles.optionSub}>Account: {item.account}</Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Item Filter Modal */}
      <Modal visible={itemModalVisible} animationType="slide" transparent>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Item</Text>
            <TouchableOpacity onPress={() => setItemModalVisible(false)}>
              <Ionicons name="close" size={24} color="#1e293b" />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search item title or code..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <TouchableOpacity
            style={[styles.modalOption, !selectedItemId && styles.selectedOption]}
            onPress={() => {
              setSelectedItemId(null);
              setItemModalVisible(false);
            }}
          >
            <Text style={styles.optionTitle}>All Items</Text>
          </TouchableOpacity>

          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalOption, selectedItemId === item.id && styles.selectedOption]}
                onPress={() => {
                  setSelectedItemId(item.id);
                  setItemModalVisible(false);
                }}
              >
                <Text style={styles.optionTitle}>{item.title}</Text>
                <Text style={styles.optionSub}>Code: {item.id}</Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Line Edit Modal */}
      <Modal visible={editModalVisible} animationType="fade" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.editCardModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Record ({editLine?.itemTitle || editLine?.itemId})</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1e293b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              <Text style={styles.inputLabel}>Quantity</Text>
              <TextInput
                style={styles.editInput}
                keyboardType="numeric"
                value={editQty}
                onChangeText={setEditQty}
              />

              <Text style={styles.inputLabel}>Rate</Text>
              <TextInput
                style={styles.editInput}
                keyboardType="numeric"
                value={editRate}
                onChangeText={setEditRate}
              />

              <Text style={styles.inputLabel}>Discount</Text>
              <TextInput
                style={styles.editInput}
                keyboardType="numeric"
                value={editDiscount}
                onChangeText={setEditDiscount}
              />

              <Text style={styles.inputLabel}>Add / Less Amount</Text>
              <TextInput
                style={styles.editInput}
                keyboardType="numeric"
                value={editAddLess}
                onChangeText={setEditAddLess}
              />

              {(hasSecondaryQty || hasVariablePackFeature) && (
                <>
                  <Text style={styles.inputLabel}>Secondary Qty</Text>
                  <TextInput
                    style={styles.editInput}
                    keyboardType="numeric"
                    value={editSecQty}
                    onChangeText={setEditSecQty}
                  />

                  <Text style={styles.inputLabel}>Secondary Rate</Text>
                  <TextInput
                    style={styles.editInput}
                    keyboardType="numeric"
                    value={editSecRate}
                    onChangeText={setEditSecRate}
                  />
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.applyEditBtn}
              onPress={handleApplyLineEdit}
            >
              <Text style={styles.applyEditText}>Apply Changes</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Quick Add Supply Record Modal */}
      <Modal visible={addModalVisible} animationType="slide" transparent>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Supply Record for {selectedCustomerName}</Text>
            <TouchableOpacity onPress={() => setAddModalVisible(false)}>
              <Ionicons name="close" size={24} color="#1e293b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ paddingHorizontal: 16 }}>
            <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.editInput}
              value={addDate}
              onChangeText={setAddDate}
            />

            <Text style={styles.inputLabel}>Item</Text>
            <TouchableOpacity
              style={styles.selectorBtn}
              onPress={() => {
                setSearchQuery('');
                setItemModalVisible(true);
              }}
            >
              <Text style={styles.selectorText}>
                {addItemId ? items.find(i => i.id === addItemId)?.title : 'Select Item...'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Quantity</Text>
            <TextInput
              style={styles.editInput}
              keyboardType="numeric"
              value={addQty}
              onChangeText={setAddQty}
            />

            <Text style={styles.inputLabel}>Rate</Text>
            <TextInput
              style={styles.editInput}
              keyboardType="numeric"
              value={addRate}
              onChangeText={setAddRate}
            />

            <TouchableOpacity
              style={[styles.applyEditBtn, { marginTop: 24 }]}
              onPress={handleAddSupplyRecord}
              disabled={addingEntry}
            >
              {addingEntry ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.applyEditText}>Add Record</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  selectorText: { fontSize: 14, fontWeight: '600', color: '#0f172a', flex: 1 },
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center'
  },

  /* Compact Row Styling (High density, ~52px height) */
  listContainer: { paddingHorizontal: 10, paddingVertical: 6, paddingBottom: 80 },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    elevation: 1,
    gap: 8
  },
  compactRowDirty: { backgroundColor: '#fefce8', borderColor: '#eab308' },
  compactLeft: { width: 68, alignItems: 'flex-start' },
  compactDate: { fontSize: 11, fontWeight: '700', color: '#475569' },
  compactVoucherTag: { backgroundColor: '#fff7ed', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, marginTop: 2, borderWidth: 0.5, borderColor: '#fdba74' },
  compactVoucherText: { fontSize: 10, fontWeight: '700', color: '#c2410c' },
  compactCenter: { flex: 1, justifyContent: 'center' },
  compactItemTitle: { fontSize: 14, fontWeight: '700', color: '#1d4ed8' },
  compactSubText: { fontSize: 11, color: '#64748b', marginTop: 1 },
  compactRight: { alignItems: 'flex-end', justifyContent: 'center' },
  compactAmount: { fontSize: 14, fontWeight: '800', color: '#15803d' },
  compactActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  compactSaveBtn: { backgroundColor: '#16a34a', borderRadius: 4, padding: 2 },
  compactDeleteBtn: { padding: 2 },

  /* Bottom Summary Footer Bar */
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
  bottomSummaryVal: { fontSize: 20, fontWeight: '800', color: '#4ade80' },

  /* Modal Styles */
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  searchInput: { backgroundColor: '#f1f5f9', margin: 16, padding: 12, borderRadius: 8, fontSize: 15, color: '#0f172a' },
  modalOption: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  selectedOption: { backgroundColor: '#eff6ff' },
  optionTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  optionSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  editCardModal: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 12, marginBottom: 4 },
  editInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', padding: 10, borderRadius: 8, fontSize: 15, color: '#0f172a' },
  applyEditBtn: { backgroundColor: '#16a34a', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  applyEditText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { padding: 30, alignItems: 'center' },
  emptyText: { marginTop: 8, fontSize: 13, color: '#64748b', textAlign: 'center' }
});
