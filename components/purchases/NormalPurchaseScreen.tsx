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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { Theme } from '../../constants/theme';
import { extractErrorMessage } from '../../services/api';
import { purchaseService, PurchaseLineRequest } from '../../services/purchaseService';
import {
  chartOfAccountService,
  ChartOfAccountHeadDto,
} from '../../services/chartOfAccountService';
import { narrationService, NarrationDto } from '../../services/narrationService';
import { inventoryService, Item, Unit } from '../../services/inventoryService';
import { itemCategoryService } from '../../services/itemCategoryService';
import { useAppStore } from '../../store/appStore';
import { InlineSearchSelect, InlineSelectOption } from '../ui/InlineSearchSelect';
import { FastItemEntryBar } from '../ui/FastItemEntryBar';
import { useKeyboard } from '../../hooks/useKeyboard';
import {
  MobileMultiPaymentSection,
  PaymentSplitRow,
} from '../ui/MobileMultiPaymentSection';
import {
  getSelectablePrimaryUnits,
  resolveDisplayQtyAndUnit,
  toBasePrimaryQty,
} from '../../utils/unitConversion';

interface EditablePurchaseLine extends PurchaseLineRequest {
  displayQty?: number;
  selectedUnitId?: string;
  unitFactor?: number;
  showExtras?: boolean;
}

export function NormalPurchaseScreen() {
  const { voucherNo, mode } = useLocalSearchParams<{ voucherNo: string; mode?: string }>();
  const router = useRouter();
  const isEdit = Boolean(voucherNo && voucherNo !== 'new' && mode !== 'copy');

  const { currentTenantIdentifier, licenses } = useAppStore();
  const currentOrg = licenses.find((l) => l.tenantIdentifier === currentTenantIdentifier);
  const hasSecondaryQty = currentOrg?.hasSecondaryQty ?? false;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Lookups
  const [suppliers, setSuppliers] = useState<ChartOfAccountHeadDto[]>([]);
  const [narrations, setNarrations] = useState<NarrationDto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // UI Mode
  const [headerExpanded, setHeaderExpanded] = useState(true);
  const [entryMode, setEntryMode] = useState<'list' | 'grid'>('list');

  // Form State
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [supplierAccount, setSupplierAccount] = useState('');
  const [narration, setNarration] = useState('');
  const [description, setDescription] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const { keyboardHeight, isKeyboardVisible } = useKeyboard();

  // Lines & Payments
  const [lines, setLines] = useState<EditablePurchaseLine[]>([]);
  const [payments, setPayments] = useState<PaymentSplitRow[]>([]);
  const [legacyCashPaid, setLegacyCashPaid] = useState<number>(0);

  useEffect(() => {
    fetchLookups();
  }, []);

  const fetchLookups = async () => {
    try {
      const [sups, narrs, itms, unts, itmCats] = await Promise.all([
        chartOfAccountService.getSupplierAccounts(),
        narrationService.getActiveNarrationsLookup(),
        inventoryService.getItemsLookup(undefined, true),
        inventoryService.getUnits(),
        itemCategoryService.getActiveItemCategoriesLookup().catch(() => []),
      ]);
      const safeSups = sups || [];
      const itmCatMap = new Map<string, string>((itmCats || []).map((c) => [c.code, c.title]));
      const safeItems = (itms || []).map((i) => ({
        ...i,
        itemCategoryTitle: i.itemCategoryTitle || itmCatMap.get(i.itemCategoryCode) || i.itemCategoryCode,
      }));
      const safeUnits = unts || [];
      setSuppliers(safeSups);
      setNarrations(narrs || []);
      setItems(safeItems);
      setUnits(safeUnits);

      if (voucherNo && voucherNo !== 'new') {
        await loadVoucherDetails(safeItems, safeUnits);
      } else {
        if (safeSups.length > 0) {
          setSupplierAccount(safeSups[0].account);
        }
        setLoading(false);
      }
    } catch {
      Alert.alert('Error', 'Failed to load form data.');
      setLoading(false);
    }
  };

  const loadVoucherDetails = async (loadedItems: Item[], loadedUnits: Unit[]) => {
    try {
      const [details, savedPayments] = await Promise.all([
        purchaseService.getDetail(voucherNo!),
        mode === 'copy'
          ? Promise.resolve([])
          : purchaseService.getPayments(voucherNo!).catch(() => []),
      ]);
      if (details && details.length > 0) {
        const first = details[0];
        setDate(mode === 'copy' ? new Date() : new Date(first.date));
        setSupplierAccount(first.accountId);
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
        } else if (first.cashPaid !== undefined && first.cashPaid !== null) {
          setLegacyCashPaid(Number(first.cashPaid) || 0);
        }

        const mappedLines: EditablePurchaseLine[] = details.map((d) => {
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
            addLess: d.addLess || 0,
            secQty: d.secQty || 0,
            secRate: d.secRate || 0,
            secUnit: d.secUnit || itemObj?.secondaryUnit || '',
            showExtras: Boolean((d.addLess || 0) !== 0 || hasSec),
          };
        });
        setLines(mappedLines);
      }
    } catch {
      Alert.alert('Error', 'Failed to load purchase details.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  // Resolve Purchase Cost Rate (lastPurchaseRate ?? costRate ?? 0)
  const resolvePurchaseRates = (item: Item): { costRate: number; secCostRate: number } => {
    const cost = item.lastPurchaseRate ?? item.costRate ?? 0;
    const pSize = Number(item.qtyInPack || 0);
    const secCost =
      item.lastPurchaseSecRate ??
      item.secCostRate ??
      (pSize > 0 ? cost * pSize : 0);
    return { costRate: cost, secCostRate: secCost };
  };

  const handleFastAddItem = (item: Item, addedQty: number = 1, customRate?: number) => {
    const { costRate, secCostRate } = resolvePurchaseRates(item);
    const effectiveRate = customRate !== undefined ? customRate : costRate;

    setLines((prev) => {
      const existingIndex = prev.findIndex(
        (l) => String(l.itemId).trim().toLowerCase() === String(item.id).trim().toLowerCase()
      );
      if (existingIndex >= 0) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const factor = existing.unitFactor || 1;
        const newBaseQty = Number((Number(existing.qty || 0) + Number(addedQty || 1)).toFixed(4));
        const newDispQty =
          factor > 1 ? Number((newBaseQty * factor).toFixed(3)) : newBaseQty;
        updated[existingIndex] = {
          ...existing,
          qty: newBaseQty,
          displayQty: newDispQty,
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
          addLess: 0,
          secUnit: item.secondaryUnit || '',
          secQty: 0,
          secRate: secCostRate,
          showExtras: false,
        },
        ...prev,
      ];
    });
  };

  const updateLine = (seq: number, patch: Partial<EditablePurchaseLine>) => {
    setLines((prev) =>
      prev.map((l) => (l.seq === seq ? { ...l, ...patch } : l))
    );
  };

  const handleLineQtyChange = (line: EditablePurchaseLine, rawText: string) => {
    const entered = parseFloat(rawText);
    const num = isNaN(entered) ? 0 : entered;
    const factor = line.unitFactor || 1;
    const baseQty = toBasePrimaryQty(num, factor);
    updateLine(line.seq, {
      displayQty: num,
      qty: baseQty,
    });
  };

  const handleStepLineQty = (line: EditablePurchaseLine, delta: number) => {
    const factor = line.unitFactor || 1;
    const step = factor > 1 ? 50 : 1;
    const currentDisp = line.displayQty ?? line.qty ?? 0;
    const nextDisp = Math.max(0, Number((currentDisp + delta * step).toFixed(3)));
    const nextBase = toBasePrimaryQty(nextDisp, factor);
    updateLine(line.seq, {
      displayQty: nextDisp,
      qty: nextBase,
    });
  };

  const handleSwitchLineUnit = (line: EditablePurchaseLine, item?: Item) => {
    const selectable = getSelectablePrimaryUnits(item, units);
    if (selectable.length <= 1) return;
    const currentIdx = selectable.findIndex((u) => u.unitId === line.selectedUnitId);
    const nextOpt = selectable[(currentIdx + 1) % selectable.length];
    const currentDisp = line.displayQty ?? line.qty ?? 0;
    const newBaseQty = toBasePrimaryQty(currentDisp, nextOpt.factor);
    updateLine(line.seq, {
      unit: nextOpt.unitId,
      selectedUnitId: nextOpt.unitId,
      unitFactor: nextOpt.factor,
      qty: newBaseQty,
      displayQty: currentDisp,
    });
  };

  const removeLine = async (seq: number) => {
    if (isEdit) {
      try {
        await purchaseService.deleteLine(voucherNo!, seq);
      } catch {
        Alert.alert('Error', 'Failed to delete line from database.');
        return;
      }
    }
    setLines((prev) => prev.filter((l) => l.seq !== seq));
  };

  const totalAmount = useMemo(
    () =>
      Math.round(
        lines.reduce(
          (sum, l) =>
            sum +
            ((l.qty || 0) * (l.rate || 0) +
              (l.addLess || 0) +
              (l.secQty || 0) * (l.secRate || 0)),
          0
        ) * 100
      ) / 100,
    [lines]
  );

  const totalPaid = useMemo(
    () => payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [payments]
  );
  const cashBackAmount = Math.max(0, Math.round((totalPaid - totalAmount) * 100) / 100);

  const cartQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of lines) {
      map[l.itemId] = Number(((map[l.itemId] || 0) + (l.qty || 0)).toFixed(3));
    }
    return map;
  }, [lines]);

  const handleSaveVoucher = async () => {
    if (!supplierAccount || !date) {
      Alert.alert('Validation Error', 'Date and Supplier Account are required.');
      return;
    }
    if (lines.length === 0) {
      Alert.alert('Validation Error', 'At least one line item is required.');
      return;
    }
    const invalidLine = lines.find((l) => !l.itemId || (l.qty || 0) <= 0);
    if (invalidLine) {
      Alert.alert('Validation Error', 'All items must have a quantity greater than 0.');
      return;
    }

    setSaving(true);
    try {
      const cleanedLines: PurchaseLineRequest[] = lines.map((l, idx) => ({
        seq: idx + 1,
        itemId: l.itemId,
        unit: l.selectedUnitId || l.unit || undefined,
        qty: Number(l.qty) || 0,
        rate: Number(l.rate) || 0,
        addLess: Number(l.addLess) || 0,
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
        account: supplierAccount,
        narration: narration || undefined,
        description: description || undefined,
        cashPaid: totalPaid,
        cashBack: cashBackAmount,
        lines: cleanedLines,
        payments: validPayments,
      };

      if (isEdit) {
        await purchaseService.update(voucherNo!, request);
        Alert.alert('Success', 'Purchase updated successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        await purchaseService.create(request);
        Alert.alert('Success', 'Purchase created successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', extractErrorMessage(error, 'Failed to save purchase.'));
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
            Alert.alert('Success', 'Purchase deleted.', [
              { text: 'OK', onPress: () => router.back() },
            ]);
          } catch {
            Alert.alert('Error', 'Failed to delete purchase.');
            setSaving(false);
          }
        },
      },
    ]);
  };

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
      if (clean && clean === item.secondaryUnit && item.secondaryUnitTitle) return item.secondaryUnitTitle;
      if (item.primaryUnitTitle) return item.primaryUnitTitle;
      if (item.defaultUnitTitle) return item.defaultUnitTitle;
    }
    if (/^\d+$/.test(clean)) return '';
    return clean;
  };

  const supplierOptions: InlineSelectOption[] = useMemo(
    () =>
      suppliers.map((s) => ({
        id: s.account,
        title: s.title,
        subtitle: `Account: ${s.account}`,
      })),
    [suppliers]
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

  const selectedSupplierObj = suppliers.find((s) => s.account === supplierAccount);

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
              onPress={() => setHeaderExpanded((p) => !p)}
            >
              <View style={styles.masterSummaryLeft}>
                <View style={styles.voucherBadge}>
                  <Text style={styles.voucherBadgeText}>
                    {isEdit
                      ? `PR-${String(voucherNo).padStart(5, '0')}`
                      : mode === 'copy'
                      ? 'COPY'
                      : 'NEW PURCHASE'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.dateChip}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={13} color={Theme.colors.primary} />
                  <Text style={styles.dateChipText}>{dayjs(date).format('DD MMM YY')}</Text>
                </TouchableOpacity>
                <Text style={styles.supplierSummaryTitle} numberOfLines={1}>
                  {selectedSupplierObj?.title || 'Select Supplier *'}
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
                  label="Supplier / Vendor Account *"
                  placeholder="Search Supplier..."
                  value={supplierAccount}
                  options={supplierOptions}
                  onSelect={setSupplierAccount}
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
                      <Text style={styles.compactLabel}>Invoice Ref / Notes</Text>
                      <TextInput
                        style={styles.compactTextInput}
                        placeholder="Supplier bill #..."
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
            mode={entryMode}
            onModeChange={setEntryMode}
            onAddItem={(itm, q, r) => handleFastAddItem(itm, q, r)}
            resolveItemRate={(itm) => resolvePurchaseRates(itm).costRate}
            cartQtyMap={cartQtyMap}
          />

          {/* Inline Purchase Line Cards */}
          <View style={styles.linesSection}>
            <View style={styles.linesHeaderRow}>
              <Text style={styles.linesSectionTitle}>
                Purchased Items ({lines.length})
              </Text>
              {lines.length > 0 && (
                <Text style={styles.linesTotalBadge}>
                  Total: Rs. {totalAmount.toLocaleString()}
                </Text>
              )}
            </View>

            {lines.length === 0 ? (
              <View style={styles.emptyCartBox}>
                <Ionicons name="cube-outline" size={32} color={Theme.colors.border} />
                <Text style={styles.emptyCartText}>
                  Scan or search items above to add to purchase bill.
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
                  activeUnitOpt?.shortLabel ||
                  itemObj?.primaryUnitTitle ||
                  line.unit ||
                  'Unit';
                const dispQty = line.displayQty ?? line.qty ?? 0;
                const showSecQty = Boolean(
                  hasSecondaryQty ||
                  line.secUnit ||
                  itemObj?.secondaryUnit ||
                  Number(line.secQty || 0) > 0
                );
                const lineTotal =
                  Math.round(
                    ((line.qty || 0) * (line.rate || 0) +
                      (line.addLess || 0) +
                      (line.secQty || 0) * (line.secRate || 0)) *
                      100
                  ) / 100;

                return (
                  <View key={line.seq} style={styles.lineCard}>
                    <View style={styles.lineTopRow}>
                      <Text style={styles.lineItemTitle} numberOfLines={1}>
                        {itemObj?.title || `Item #${line.itemId}`}
                      </Text>
                      <View style={styles.lineTopIcons}>
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
                              styles.extraToggleText,
                              line.showExtras && { color: '#FFF' },
                            ]}
                          >
                            {line.showExtras ? 'Close' : showSecQty ? '+Add/Less • Sec' : '+Add/Less'}
                          </Text>
                        </TouchableOpacity>
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

                    <View style={styles.inlineInputsRow}>
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

                      <View style={styles.inlineFieldBox}>
                        <Text style={styles.miniFieldLabel}>Cost Rate</Text>
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

                      <View style={styles.inlineAmountBox}>
                        <Text style={styles.miniFieldLabel}>Line Total</Text>
                        <Text style={styles.inlineAmountReadonly}>
                          Rs. {lineTotal.toLocaleString()}
                        </Text>
                      </View>
                    </View>

                    {line.showExtras && (
                      <View style={styles.extrasRow}>
                        <View style={styles.extraField}>
                          <Text style={styles.extraLabel}>Add / Less (Rs.)</Text>
                          <TextInput
                            style={styles.extraInput}
                            keyboardType="numeric"
                            placeholder="0"
                            value={line.addLess ? String(line.addLess) : ''}
                            onChangeText={(txt) =>
                              updateLine(line.seq, { addLess: parseFloat(txt) || 0 })
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
                                  updateLine(line.seq, { secQty: parseFloat(txt) || 0 })
                                }
                              />
                            </View>
                            <View style={styles.extraField}>
                              <Text style={styles.extraLabel}>Sec Cost Rate</Text>
                              <TextInput
                                style={styles.extraInput}
                                keyboardType="numeric"
                                placeholder="0"
                                value={line.secRate ? String(line.secRate) : ''}
                                onChangeText={(txt) =>
                                  updateLine(line.seq, { secRate: parseFloat(txt) || 0 })
                                }
                              />
                            </View>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>

          {/* Multi-Payment Section */}
          <MobileMultiPaymentSection
            mode="purchase"
            netTotal={totalAmount}
            payments={payments}
            onChange={setPayments}
            legacyCashAmount={legacyCashPaid}
          />
        </ScrollView>

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
            style={styles.saveBtn}
            onPress={handleSaveVoucher}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>
                  {isEdit ? 'Update Purchase' : 'Save Purchase'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAwareContainer>
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
  supplierSummaryTitle: {
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
    fontSize: 12,
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
  extraToggleText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Theme.colors.primary,
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
  inlineAmountReadonly: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Theme.colors.primary,
    marginTop: 1,
  },
  extrasRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 7,
    paddingTop: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CBD5E1',
  },
  extraField: {
    flex: 1,
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
    height: 30,
    fontSize: 12,
    fontWeight: '600',
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
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 10,
    backgroundColor: Theme.colors.primary,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
