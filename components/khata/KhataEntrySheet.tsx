import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import { Theme } from '../../constants/theme';
import { ChartOfAccountHeadDto } from '../../services/chartOfAccountService';
import {
  KhataLedgerEntryDto,
  formatKhataAmount,
  khataService,
} from '../../services/khataService';
import { receiptService } from '../../services/receiptService';
import { paymentService } from '../../services/paymentService';
import { extractErrorMessage } from '../../services/api';

export type KhataEntryDirection = 'IN' | 'OUT';

interface KhataEntrySheetProps {
  visible: boolean;
  direction: KhataEntryDirection;
  partyAccountId: string;
  partyTitle: string;
  currentBalance: number;
  cashBankAccounts: ChartOfAccountHeadDto[];
  defaultCashBankAccountId: string;
  editingEntry?: KhataLedgerEntryDto | null;
  canDelete?: boolean;
  onClose: () => void;
  onSaved: (selectedCashBankId: string) => void;
}

export const KhataEntrySheet: React.FC<KhataEntrySheetProps> = ({
  visible,
  direction,
  partyAccountId,
  partyTitle,
  currentBalance,
  cashBankAccounts,
  defaultCashBankAccountId,
  editingEntry,
  canDelete = true,
  onClose,
  onSaved,
}) => {
  const isEdit = Boolean(editingEntry);
  const isIn = direction === 'IN';

  const [amountText, setAmountText] = useState('');
  const [cashBankId, setCashBankId] = useState(defaultCashBankAccountId);
  const [showCashBankPicker, setShowCashBankPicker] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const initForm = () => {
    setShowCashBankPicker(false);
    setShowDatePicker(false);

    if (editingEntry) {
      const existingAmt = editingEntry.cr > 0 ? editingEntry.cr : editingEntry.dr;
      setAmountText(String(existingAmt));
      setCashBankId(editingEntry.counterpartAccountId || defaultCashBankAccountId);
      const parsedDate = dayjs(editingEntry.vDate);
      setDate(parsedDate.isValid() ? parsedDate.toDate() : new Date());
      setRemarks(editingEntry.remarks || '');
    } else {
      setAmountText('');
      setCashBankId(defaultCashBankAccountId);
      setDate(new Date());
      setRemarks('');
    }
  };

  const parsedAmount = parseFloat(amountText.replace(/,/g, '')) || 0;

  // Calculate live balance preview
  const computePreviewBalance = (): number => {
    let base = currentBalance;
    if (editingEntry) {
      base -= editingEntry.dr - editingEntry.cr;
    }
    return isIn ? base - parsedAmount : base + parsedAmount;
  };

  const previewBalance = computePreviewBalance();
  const selectedCashBankTitle =
    cashBankAccounts.find((a) => a.account === cashBankId)?.title || 'Select Cash/Bank';

  const handleSave = async () => {
    if (parsedAmount <= 0) {
      Alert.alert('Enter Amount', 'Please enter an amount greater than 0.');
      return;
    }
    if (!cashBankId) {
      Alert.alert('Cash/Bank Required', 'Please select a Cash or Bank account.');
      return;
    }

    setSaving(true);
    try {
      const dateStr = dayjs(date).format('YYYY-MM-DD');
      const trimmedRemarks = remarks.trim() || undefined;

      if (isEdit && editingEntry) {
        // Load full voucher details so multi-line vouchers (e.g. Bulk Receipts) preserve other lines
        if (isIn) {
          const existingLines = await receiptService.getDetail(editingEntry.voucherNo);
          const first = existingLines[0];
          const updatedLines = existingLines.map((l) =>
            l.seq === editingEntry.vSeq
              ? {
                  seq: l.seq,
                  account: partyAccountId,
                  amount: parsedAmount,
                  checkNum: l.checkNum || undefined,
                  checkDate: l.checkDate || undefined,
                  remarks: trimmedRemarks,
                }
              : {
                  seq: l.seq,
                  account: l.accountId,
                  amount: l.amount,
                  checkNum: l.checkNum || undefined,
                  checkDate: l.checkDate || undefined,
                  remarks: l.remarks || undefined,
                }
          );

          await receiptService.update(editingEntry.voucherNo, {
            date: dateStr,
            clearingDate: first?.clearingDate || undefined,
            cashBankAccount: cashBankId,
            narration: first?.narrationId || undefined,
            lines:
              updatedLines.length > 0
                ? updatedLines
                : [
                    {
                      seq: editingEntry.vSeq || 1,
                      account: partyAccountId,
                      amount: parsedAmount,
                      remarks: trimmedRemarks,
                    },
                  ],
          });
        } else {
          const existingLines = await paymentService.getDetail(editingEntry.voucherNo);
          const first = existingLines[0];
          const updatedLines = existingLines.map((l) =>
            l.seq === editingEntry.vSeq
              ? {
                  seq: l.seq,
                  account: partyAccountId,
                  amount: parsedAmount,
                  checkNum: l.checkNum || undefined,
                  checkDate: l.checkDate || undefined,
                  remarks: trimmedRemarks,
                }
              : {
                  seq: l.seq,
                  account: l.accountId,
                  amount: l.amount,
                  checkNum: l.checkNum || undefined,
                  checkDate: l.checkDate || undefined,
                  remarks: l.remarks || undefined,
                }
          );

          await paymentService.update(editingEntry.voucherNo, {
            date: dateStr,
            clearingDate: first?.clearingDate || undefined,
            cashBankAccount: cashBankId,
            narration: first?.narrationId || undefined,
            lines:
              updatedLines.length > 0
                ? updatedLines
                : [
                    {
                      seq: editingEntry.vSeq || 1,
                      account: partyAccountId,
                      amount: parsedAmount,
                      remarks: trimmedRemarks,
                    },
                  ],
          });
        }
      } else {
        if (isIn) {
          await receiptService.create({
            date: dateStr,
            cashBankAccount: cashBankId,
            lines: [
              {
                seq: 1,
                account: partyAccountId,
                amount: parsedAmount,
                remarks: trimmedRemarks,
              },
            ],
          });
        } else {
          await paymentService.create({
            date: dateStr,
            cashBankAccount: cashBankId,
            lines: [
              {
                seq: 1,
                account: partyAccountId,
                amount: parsedAmount,
                remarks: trimmedRemarks,
              },
            ],
          });
        }
      }

      await khataService.setSavedCashBankAccount(cashBankId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSaved(cashBankId);
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editingEntry) return;
    const voucherLabel = `${editingEntry.vType}-${editingEntry.voucherNo}`;
    Alert.alert(
      'Delete Entry?',
      editingEntry.isMultiLineVoucher
        ? `This will remove only ${partyTitle}'s line from ${voucherLabel}. Other parties in the voucher will not be affected.`
        : `Are you sure you want to delete ${voucherLabel}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              if (isIn) {
                if (editingEntry.isMultiLineVoucher) {
                  await receiptService.deleteLine(editingEntry.voucherNo, editingEntry.vSeq);
                } else {
                  await receiptService.delete(editingEntry.voucherNo);
                }
              } else {
                if (editingEntry.isMultiLineVoucher) {
                  await paymentService.deleteLine(editingEntry.voucherNo, editingEntry.vSeq);
                } else {
                  await paymentService.delete(editingEntry.voucherNo);
                }
              }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              onSaved(cashBankId);
            } catch (err) {
              Alert.alert('Error', extractErrorMessage(err));
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const accentColor = isIn ? Theme.colors.success : Theme.colors.danger;
  const accentBg = isIn ? Theme.colors.success + '18' : Theme.colors.danger + '18';

  return (
    <Modal visible={visible} transparent animationType="slide" onShow={initForm} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.directionBadge, { backgroundColor: accentBg }]}>
                <Text style={[styles.directionBadgeText, { color: accentColor }]}>
                  {isIn ? 'IN — You Got' : 'OUT — You Gave'}
                </Text>
              </View>
              <Text style={styles.voucherMeta}>
                {isEdit && editingEntry
                  ? `${editingEntry.vType}-${editingEntry.voucherNo}`
                  : isIn
                  ? 'Receipt (RV)'
                  : 'Payment (PV)'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Big Amount Input */}
          <View style={[styles.amountBox, { borderColor: accentColor + '80' }]}>
            <Text style={styles.currencyPrefix}>Rs</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor="#CBD5E0"
              keyboardType="decimal-pad"
              value={amountText}
              onChangeText={setAmountText}
              autoFocus
            />
          </View>

          {/* Live Balance Preview */}
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>New Balance Preview</Text>
            <Text
              style={[
                styles.previewValue,
                {
                  color:
                    previewBalance > 0
                      ? Theme.colors.success
                      : previewBalance < 0
                      ? Theme.colors.danger
                      : Theme.colors.textSecondary,
                },
              ]}
            >
              {formatKhataAmount(previewBalance)}{' '}
              {previewBalance > 0
                ? '(You will Get)'
                : previewBalance < 0
                ? '(You will Give)'
                : '(Settled)'}
            </Text>
          </View>

          {/* Cash/Bank & Date Pills */}
          <View style={styles.pillsRow}>
            <TouchableOpacity
              style={styles.selectorPill}
              onPress={() => setShowCashBankPicker((prev) => !prev)}
            >
              <Ionicons name="wallet-outline" size={16} color={Theme.colors.primary} />
              <Text style={styles.selectorPillText} numberOfLines={1}>
                {selectedCashBankTitle}
              </Text>
              <Ionicons
                name={showCashBankPicker ? 'chevron-up' : 'chevron-down'}
                size={15}
                color={Theme.colors.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.selectorPill, styles.datePill]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={16} color={Theme.colors.primary} />
              <Text style={styles.selectorPillText}>{dayjs(date).format('DD MMM YY')}</Text>
            </TouchableOpacity>
          </View>

          {/* Inline Cash/Bank Account Picker */}
          {showCashBankPicker && (
            <View style={styles.pickerContainer}>
              <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                {cashBankAccounts.map((acc) => {
                  const selected = acc.account === cashBankId;
                  return (
                    <TouchableOpacity
                      key={acc.account}
                      style={[styles.pickerItem, selected && styles.pickerItemSelected]}
                      onPress={() => {
                        setCashBankId(acc.account);
                        setShowCashBankPicker(false);
                      }}
                    >
                      <Text
                        style={[styles.pickerItemText, selected && styles.pickerItemTextSelected]}
                      >
                        {acc.title}
                      </Text>
                      {selected && (
                        <Ionicons name="checkmark" size={18} color={Theme.colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, selectedDate) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selectedDate) setDate(selectedDate);
              }}
            />
          )}

          {/* Optional Note */}
          <TextInput
            style={styles.noteInput}
            placeholder="Add note / remarks (optional)"
            placeholderTextColor="#A0AEC0"
            value={remarks}
            onChangeText={setRemarks}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          {/* Action Row */}
          <View style={styles.actionRow}>
            {isEdit && canDelete && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDelete}
                disabled={deleting || saving}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={Theme.colors.danger} />
                ) : (
                  <Ionicons name="trash-outline" size={20} color={Theme.colors.danger} />
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.saveBtn,
                { backgroundColor: accentColor },
                (saving || deleting) && styles.btnDisabled,
              ]}
              onPress={handleSave}
              disabled={saving || deleting}
            >
              {saving ? (
                <ActivityIndicator color={Theme.colors.white} />
              ) : (
                <Text style={styles.saveBtnText}>
                  {isEdit ? 'Update Entry' : isIn ? 'Save IN Entry' : 'Save OUT Entry'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: Theme.colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 34 : Theme.spacing.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Theme.colors.border,
    alignSelf: 'center',
    marginBottom: Theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  directionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Theme.radii.round,
  },
  directionBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  voucherMeta: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontWeight: '500',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
    borderWidth: 2,
    borderRadius: Theme.radii.lg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 10,
  },
  currencyPrefix: {
    fontSize: 22,
    fontWeight: '700',
    color: Theme.colors.textSecondary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '700',
    color: Theme.colors.text,
    paddingVertical: 2,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    paddingHorizontal: 2,
  },
  previewLabel: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  previewValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: Theme.spacing.sm,
  },
  selectorPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  datePill: {
    flex: 0.72,
  },
  selectorPillText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  pickerContainer: {
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radii.md,
    marginBottom: Theme.spacing.sm,
    maxHeight: 150,
    overflow: 'hidden',
  },
  pickerScroll: {
    paddingVertical: 4,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pickerItemSelected: {
    backgroundColor: Theme.colors.primary + '12',
  },
  pickerItemText: {
    fontSize: 14,
    color: Theme.colors.text,
  },
  pickerItemTextSelected: {
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  noteInput: {
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Theme.colors.text,
    marginBottom: Theme.spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deleteBtn: {
    width: 50,
    height: 50,
    borderRadius: Theme.radii.lg,
    backgroundColor: Theme.colors.danger + '15',
    borderWidth: 1,
    borderColor: Theme.colors.danger + '40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtn: {
    flex: 1,
    height: 50,
    borderRadius: Theme.radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.sm,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  saveBtnText: {
    color: Theme.colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
