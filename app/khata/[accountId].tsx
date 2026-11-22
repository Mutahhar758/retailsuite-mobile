import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { Theme } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import {
  KhataLedgerEntryDto,
  KhataLedgerResponse,
  formatKhataAmount,
  khataService,
} from '../../services/khataService';
import {
  ChartOfAccountHeadDto,
  chartOfAccountService,
} from '../../services/chartOfAccountService';
import { reportService } from '../../services/reportService';
import { extractErrorMessage } from '../../services/api';
import {
  KhataEntryDirection,
  KhataEntrySheet,
} from '../../components/khata/KhataEntrySheet';
import { PdfViewerModal } from '../../components/reports/PdfViewerModal';

type PeriodKey = 'ALL' | 'MONTH' | '30D' | '90D';

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'ALL', label: 'All Time' },
  { key: 'MONTH', label: 'This Month' },
  { key: '30D', label: '30 Days' },
  { key: '90D', label: '90 Days' },
];

export default function PartyKhataDetailScreen() {
  const { accountId, title: initialTitle } = useLocalSearchParams<{
    accountId: string;
    title?: string;
  }>();
  const router = useRouter();
  const { user, permissions } = useAuthStore();

  const hasPermission = (action: string, resource: string) => {
    if (user?.isOwner) return true;
    return permissions.includes(`Permissions.${resource}.${action}`);
  };

  const canCreateReceipt = hasPermission('Create', 'ReceiptVouchers');
  const canUpdateReceipt = hasPermission('Update', 'ReceiptVouchers');
  const canDeleteReceipt = hasPermission('Delete', 'ReceiptVouchers');
  const canCreatePayment = hasPermission('Create', 'PaymentVouchers');
  const canUpdatePayment = hasPermission('Update', 'PaymentVouchers');
  const canDeletePayment = hasPermission('Delete', 'PaymentVouchers');
  const canViewStatementPdf =
    user?.isOwner ||
    hasPermission('View', 'AccountStatement') ||
    hasPermission('View', 'Reports');

  const [ledger, setLedger] = useState<KhataLedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>('ALL');

  const [cashBankAccounts, setCashBankAccounts] = useState<ChartOfAccountHeadDto[]>([]);
  const [defaultCashBankId, setDefaultCashBankId] = useState('');

  // IN/OUT Entry Sheet State
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetDirection, setSheetDirection] = useState<KhataEntryDirection>('IN');
  const [editingEntry, setEditingEntry] = useState<KhataLedgerEntryDto | null>(null);

  // Share & PDF State
  const [shareMenuVisible, setShareMenuVisible] = useState(false);
  const [pdfVisible, setPdfVisible] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);

  // Read-only detail modal for non-RV/PV entries
  const [readOnlyEntry, setReadOnlyEntry] = useState<KhataLedgerEntryDto | null>(null);

  const getDateRange = useCallback((p: PeriodKey) => {
    const today = dayjs().format('YYYY-MM-DD');
    if (p === 'MONTH') {
      return { fromDate: dayjs().startOf('month').format('YYYY-MM-DD'), toDate: today };
    }
    if (p === '30D') {
      return { fromDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'), toDate: today };
    }
    if (p === '90D') {
      return { fromDate: dayjs().subtract(90, 'day').format('YYYY-MM-DD'), toDate: today };
    }
    return { fromDate: undefined, toDate: undefined };
  }, []);

  const refreshLedger = useCallback(
    async (isRefresh = false) => {
      if (!accountId) return;
      try {
        if (isRefresh) setRefreshing(true);
        const range = getDateRange(period);
        const data = await khataService.getPartyLedger(accountId, range);
        setLedger(data);
      } catch (err) {
        Alert.alert('Error', extractErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accountId, period, getDateRange]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [cbList, savedId] = await Promise.all([
          chartOfAccountService.getCashBankAccounts(),
          khataService.getSavedCashBankAccount(),
        ]);
        if (!active) return;
        const safeList = cbList || [];
        setCashBankAccounts(safeList);

        if (savedId && safeList.some((a) => a.account === savedId)) {
          setDefaultCashBankId(savedId);
        } else {
          const cashDefault =
            safeList.find((a) => a.title.toLowerCase().includes('cash in hand')) ||
            safeList.find((a) => a.title.toLowerCase().includes('cash')) ||
            safeList[0];
          if (cashDefault) setDefaultCashBankId(cashDefault.account);
        }
      } catch {
        // non-fatal, handled when opening entry sheet
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!accountId) return;
    let active = true;
    (async () => {
      try {
        const range = getDateRange(period);
        const data = await khataService.getPartyLedger(accountId, range);
        if (active) setLedger(data);
      } catch (err) {
        if (active) Alert.alert('Error', extractErrorMessage(err));
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [accountId, period, getDateRange]);

  const displayedEntries = useMemo(() => {
    if (!ledger?.entries) return [];
    // Show newest entries at the top for quick mobile glanceability
    return [...ledger.entries].reverse();
  }, [ledger]);

  const handleOpenNewEntry = (dir: KhataEntryDirection) => {
    if (dir === 'IN' && !canCreateReceipt) {
      Alert.alert('Permission Denied', 'You do not have permission to create Receipt vouchers.');
      return;
    }
    if (dir === 'OUT' && !canCreatePayment) {
      Alert.alert('Permission Denied', 'You do not have permission to create Payment vouchers.');
      return;
    }
    setEditingEntry(null);
    setSheetDirection(dir);
    setSheetVisible(true);
  };

  const handleTapEntry = (entry: KhataLedgerEntryDto) => {
    if (!entry.isEditable) {
      setReadOnlyEntry(entry);
      return;
    }
    const dir: KhataEntryDirection = entry.vType === 'RV' ? 'IN' : 'OUT';
    const canEdit = dir === 'IN' ? canUpdateReceipt : canUpdatePayment;
    if (!canEdit) {
      setReadOnlyEntry(entry);
      return;
    }
    setEditingEntry(entry);
    setSheetDirection(dir);
    setSheetVisible(true);
  };

  const handleCall = () => {
    const phone = ledger?.phone?.trim();
    if (!phone) {
      Alert.alert('No Phone Number', 'This party does not have a phone number saved.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Error', 'Unable to open phone dialer.');
    });
  };

  const handleShareWhatsApp = async () => {
    setShareMenuVisible(false);
    if (!ledger) return;

    const statusText =
      ledger.currentBalance > 0
        ? `Receivable Balance: ${formatKhataAmount(ledger.currentBalance)}`
        : ledger.currentBalance < 0
        ? `Payable Balance: ${formatKhataAmount(ledger.currentBalance)}`
        : 'Balance: Rs 0 (Settled)';

    const msg = `Assalam-o-Alaikum ${ledger.title},\nYour Khata summary as of ${dayjs().format(
      'DD MMM YYYY'
    )}:\n${statusText}\nThank you!`;

    const digits = (ledger.phone || '').replace(/[^\d+]/g, '');
    if (digits) {
      const normalized = digits.startsWith('0') ? `92${digits.slice(1)}` : digits.replace(/^\+/, '');
      const waUrl = `https://wa.me/${normalized}?text=${encodeURIComponent(msg)}`;
      const supported = await Linking.canOpenURL(waUrl).catch(() => false);
      if (supported) {
        Linking.openURL(waUrl);
        return;
      }
    }

    Share.share({ message: msg }).catch(() => {});
  };

  const handleSharePdf = async () => {
    setShareMenuVisible(false);
    if (!ledger || !accountId) return;
    if (!canViewStatementPdf) {
      Alert.alert('Permission Denied', 'You do not have permission to generate Account Statement PDFs.');
      return;
    }

    setPdfVisible(true);
    setPdfLoading(true);
    setPdfBase64(null);
    try {
      const range = getDateRange(period);
      const fromDate = range.fromDate || dayjs().startOf('year').format('YYYY-MM-DD');
      const toDate = range.toDate || dayjs().format('YYYY-MM-DD');
      const base64 = await reportService.getAccountStatementPdf({
        account: accountId,
        fromDate,
        toDate,
      });
      setPdfBase64(base64);
    } catch (err) {
      setPdfVisible(false);
      Alert.alert('Error', extractErrorMessage(err));
    } finally {
      setPdfLoading(false);
    }
  };

  const partyTitle = ledger?.title || initialTitle || 'Khata';
  const currentBal = ledger?.currentBalance ?? 0;
  const isReceivable = currentBal > 0;
  const isPayable = currentBal < 0;
  const bannerColor = isReceivable
    ? Theme.colors.success
    : isPayable
    ? Theme.colors.danger
    : Theme.colors.textSecondary;

  const renderEntry = ({ item }: { item: KhataLedgerEntryDto }) => {
    const isRv = item.vType === 'RV';
    const isPv = item.vType === 'PV';
    const tagBg = isRv
      ? Theme.colors.success + '18'
      : isPv
      ? Theme.colors.danger + '18'
      : Theme.colors.border;
    const tagColor = isRv
      ? Theme.colors.success
      : isPv
      ? Theme.colors.danger
      : Theme.colors.textSecondary;

    return (
      <TouchableOpacity
        style={styles.entryCard}
        activeOpacity={0.75}
        onPress={() => handleTapEntry(item)}
      >
        <View style={styles.entryLeft}>
          <View style={styles.entryTagRow}>
            <View style={[styles.vTag, { backgroundColor: tagBg }]}>
              <Text style={[styles.vTagText, { color: tagColor }]}>
                {item.vType}-{item.voucherNo}
              </Text>
            </View>
            <Text style={styles.entryDate}>{dayjs(item.vDate).format('DD MMM YY')}</Text>
          </View>
          <Text style={styles.entryNote} numberOfLines={2}>
            {item.remarks || item.narration || item.counterpartTitle || item.vType}
          </Text>
          <Text style={styles.entrySubMeta} numberOfLines={1}>
            Bal: {formatKhataAmount(item.runningBalance)}{' '}
            {item.runningBalance > 0 ? 'Dr' : item.runningBalance < 0 ? 'Cr' : ''}
            {item.counterpartTitle ? ` · ${item.counterpartTitle}` : ''}
          </Text>
        </View>

        <View style={styles.entryAmounts}>
          <Text style={[styles.amountCol, { color: Theme.colors.danger }]}>
            {item.dr > 0 ? formatKhataAmount(item.dr) : ''}
          </Text>
          <Text style={[styles.amountCol, { color: Theme.colors.success }]}>
            {item.cr > 0 ? formatKhataAmount(item.cr) : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.partyName} numberOfLines={1}>
                {partyTitle}
              </Text>
              {ledger?.partyType && (
                <View style={styles.partyTypePill}>
                  <Text style={styles.partyTypePillText}>{ledger.partyType}</Text>
                </View>
              )}
            </View>
            <Text style={styles.partyPhone}>{ledger?.phone || accountId}</Text>
          </View>

          <View style={styles.headerActions}>
            {Boolean(ledger?.phone) && (
              <TouchableOpacity style={styles.iconActionBtn} onPress={handleCall}>
                <Ionicons name="call-outline" size={18} color={Theme.colors.text} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={() => setShareMenuVisible(true)}
            >
              <Ionicons name="share-social-outline" size={16} color={Theme.colors.primary} />
              <Text style={styles.shareBtnText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Live Balance Banner */}
        <View
          style={[
            styles.balanceBanner,
            {
              backgroundColor: bannerColor + '12',
              borderColor: bannerColor + '35',
            },
          ]}
        >
          <View>
            <Text style={[styles.bannerLabel, { color: bannerColor }]}>
              {isReceivable ? 'You will Get' : isPayable ? 'You will Give' : 'Settled'}
            </Text>
            <Text style={[styles.bannerAmount, { color: bannerColor }]}>
              {formatKhataAmount(currentBal)}
            </Text>
          </View>
          <View style={styles.bannerRight}>
            <Text style={styles.bannerStat}>
              IN:{' '}
              <Text style={{ color: Theme.colors.success, fontWeight: '700' }}>
                {formatKhataAmount(ledger?.totalIn ?? 0)}
              </Text>
            </Text>
            <Text style={styles.bannerStat}>
              OUT / Bills:{' '}
              <Text style={{ color: Theme.colors.danger, fontWeight: '700' }}>
                {formatKhataAmount(ledger?.totalOut ?? 0)}
              </Text>
            </Text>
          </View>
        </View>

        {/* Period Filter Row */}
        <View style={styles.periodRow}>
          <View style={styles.periodChips}>
            {PERIODS.map((p) => {
              const active = period === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.periodChip, active && styles.periodChipActive]}
                  onPress={() => setPeriod(p.key)}
                >
                  <Text style={[styles.periodChipText, active && styles.periodChipTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* Column Header */}
      <View style={styles.tableHeader}>
        <Text style={styles.tableHeaderLabel}>ENTRIES (TAP RV/PV TO EDIT)</Text>
        <View style={styles.tableHeaderRight}>
          <Text style={[styles.tableHeaderCol, { color: Theme.colors.danger }]}>OUT / Dr</Text>
          <Text style={[styles.tableHeaderCol, { color: Theme.colors.success }]}>IN / Cr</Text>
        </View>
      </View>

      {/* Ledger Timeline */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={displayedEntries}
          keyExtractor={(item, idx) => `${item.vType}-${item.voucherNo}-${item.vSeq}-${idx}`}
          renderItem={renderEntry}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => refreshLedger(true)}
              colors={[Theme.colors.primary]}
              tintColor={Theme.colors.primary}
            />
          }
          ListFooterComponent={
            ledger && ledger.openingBalance !== 0 ? (
              <View style={styles.openingRow}>
                <Text style={styles.openingLabel}>Opening Balance</Text>
                <Text style={styles.openingVal}>
                  {formatKhataAmount(ledger.openingBalance)}{' '}
                  {ledger.openingBalance > 0 ? 'Dr' : 'Cr'}
                </Text>
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            <View style={styles.centerBox}>
              <Ionicons name="receipt-outline" size={42} color={Theme.colors.textSecondary} />
              <Text style={styles.emptyTitle}>No entries in this period</Text>
              <Text style={styles.emptySub}>
                Tap IN (You Got) or OUT (You Gave) below to record a transaction.
              </Text>
            </View>
          }
        />
      )}

      {/* Sticky Bottom IN / OUT Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: Theme.colors.success },
            !canCreateReceipt && styles.actionBtnDisabled,
          ]}
          activeOpacity={0.85}
          onPress={() => handleOpenNewEntry('IN')}
        >
          <Text style={styles.actionBtnTitle}>+ IN (You Got)</Text>
          <Text style={styles.actionBtnSub}>Receipt Voucher</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: Theme.colors.danger },
            !canCreatePayment && styles.actionBtnDisabled,
          ]}
          activeOpacity={0.85}
          onPress={() => handleOpenNewEntry('OUT')}
        >
          <Text style={styles.actionBtnTitle}>− OUT (You Gave)</Text>
          <Text style={styles.actionBtnSub}>Payment Voucher</Text>
        </TouchableOpacity>
      </View>

      {/* Fast IN / OUT Sheet */}
      <KhataEntrySheet
        visible={sheetVisible}
        direction={sheetDirection}
        partyAccountId={accountId!}
        partyTitle={partyTitle}
        currentBalance={currentBal}
        cashBankAccounts={cashBankAccounts}
        defaultCashBankAccountId={defaultCashBankId}
        editingEntry={editingEntry}
        canDelete={sheetDirection === 'IN' ? canDeleteReceipt : canDeletePayment}
        onClose={() => setSheetVisible(false)}
        onSaved={(selectedCbId) => {
          setDefaultCashBankId(selectedCbId);
          setSheetVisible(false);
          refreshLedger(false);
        }}
      />

      {/* Share Options Sheet */}
      <Modal
        visible={shareMenuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setShareMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShareMenuVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Share Khata</Text>

            <TouchableOpacity style={styles.shareOption} onPress={handleShareWhatsApp}>
              <View style={[styles.shareOptionIcon, { backgroundColor: Theme.colors.success + '18' }]}>
                <Ionicons name="logo-whatsapp" size={22} color={Theme.colors.success} />
              </View>
              <View style={styles.shareOptionText}>
                <Text style={styles.shareOptionTitle}>Send WhatsApp Reminder</Text>
                <Text style={styles.shareOptionSub}>Quick formatted balance message</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareOption} onPress={handleSharePdf}>
              <View style={[styles.shareOptionIcon, { backgroundColor: Theme.colors.primary + '18' }]}>
                <Ionicons name="document-text-outline" size={22} color={Theme.colors.primary} />
              </View>
              <View style={styles.shareOptionText}>
                <Text style={styles.shareOptionTitle}>Share Full PDF Statement</Text>
                <Text style={styles.shareOptionSub}>Official account statement PDF</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Read-Only Voucher Detail Modal */}
      <Modal
        visible={Boolean(readOnlyEntry)}
        transparent
        animationType="fade"
        onRequestClose={() => setReadOnlyEntry(null)}
      >
        <View style={styles.centerModalOverlay}>
          <View style={styles.readOnlyCard}>
            <Text style={styles.readOnlyTitle}>
              {readOnlyEntry?.vType}-{readOnlyEntry?.voucherNo}
            </Text>
            <Text style={styles.readOnlySub}>
              Date: {readOnlyEntry ? dayjs(readOnlyEntry.vDate).format('DD MMM YYYY') : ''}
            </Text>
            <Text style={styles.readOnlySub}>
              Account: {readOnlyEntry?.counterpartTitle || '-'}
            </Text>
            <Text style={styles.readOnlySub}>
              Amount:{' '}
              {readOnlyEntry
                ? formatKhataAmount(readOnlyEntry.dr > 0 ? readOnlyEntry.dr : readOnlyEntry.cr)
                : ''}{' '}
              ({readOnlyEntry && readOnlyEntry.dr > 0 ? 'Dr' : 'Cr'})
            </Text>
            {Boolean(readOnlyEntry?.remarks || readOnlyEntry?.narration) && (
              <Text style={styles.readOnlySub}>
                Note: {readOnlyEntry?.remarks || readOnlyEntry?.narration}
              </Text>
            )}
            <Text style={styles.readOnlyHint}>
              Non-cash vouchers (Sales, Purchases, Journals) can be edited from Data Entry.
            </Text>
            <TouchableOpacity
              style={styles.readOnlyCloseBtn}
              onPress={() => setReadOnlyEntry(null)}
            >
              <Text style={styles.readOnlyCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PDF Viewer Modal */}
      <PdfViewerModal
        visible={pdfVisible}
        title={`${partyTitle} — Statement`}
        subtitle={dayjs().format('DD MMM YYYY')}
        base64Pdf={pdfBase64}
        loading={pdfLoading}
        fileName={`Khata_${partyTitle.replace(/\s+/g, '_')}.pdf`}
        onClose={() => setPdfVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    backgroundColor: Theme.colors.white,
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.xs,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  partyName: {
    fontSize: 17,
    fontWeight: '700',
    color: Theme.colors.text,
    flexShrink: 1,
  },
  partyTypePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: Theme.colors.primary + '14',
  },
  partyTypePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  partyPhone: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.primary + '14',
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  balanceBanner: {
    marginTop: 12,
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  bannerAmount: {
    fontSize: 23,
    fontWeight: '700',
    marginTop: 2,
  },
  bannerRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  bannerStat: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  periodRow: {
    marginTop: 10,
  },
  periodChips: {
    flexDirection: 'row',
    gap: 6,
  },
  periodChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: Theme.radii.round,
    backgroundColor: Theme.colors.background,
  },
  periodChipActive: {
    backgroundColor: Theme.colors.primary,
  },
  periodChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  periodChipTextActive: {
    color: Theme.colors.white,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 8,
    backgroundColor: '#EDF2F7',
  },
  tableHeaderLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Theme.colors.textSecondary,
    letterSpacing: 0.4,
  },
  tableHeaderRight: {
    flexDirection: 'row',
    gap: 10,
  },
  tableHeaderCol: {
    width: 78,
    textAlign: 'right',
    fontSize: 10,
    fontWeight: '700',
  },
  listContent: {
    padding: Theme.spacing.md,
    paddingBottom: 24,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radii.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  entryLeft: {
    flex: 1,
    marginRight: 8,
  },
  entryTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  vTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  entryDate: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
  },
  entryNote: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.text,
    marginTop: 4,
  },
  entrySubMeta: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  entryAmounts: {
    flexDirection: 'row',
    gap: 10,
  },
  amountCol: {
    width: 78,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
  },
  openingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: Theme.radii.md,
    backgroundColor: '#EDF2F7',
    marginTop: 4,
  },
  openingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  openingVal: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  bottomBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 12,
    backgroundColor: Theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
  },
  actionBtn: {
    flex: 1,
    borderRadius: Theme.radii.lg,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadows.sm,
  },
  actionBtnDisabled: {
    opacity: 0.45,
  },
  actionBtnTitle: {
    color: Theme.colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  actionBtnSub: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11,
    marginTop: 1,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  emptySub: {
    marginTop: 4,
    fontSize: 13,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    backgroundColor: Theme.colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.sm,
    paddingBottom: 32,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Theme.colors.border,
    alignSelf: 'center',
    marginBottom: Theme.spacing.md,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: Theme.spacing.md,
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: 10,
    gap: 12,
  },
  shareOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareOptionText: {
    flex: 1,
  },
  shareOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  shareOptionSub: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  centerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.lg,
  },
  readOnlyCard: {
    width: '100%',
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radii.lg,
    padding: Theme.spacing.lg,
  },
  readOnlyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
    marginBottom: 10,
  },
  readOnlySub: {
    fontSize: 14,
    color: Theme.colors.text,
    marginBottom: 6,
  },
  readOnlyHint: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 8,
    marginBottom: 16,
  },
  readOnlyCloseBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radii.md,
    paddingVertical: 11,
    alignItems: 'center',
  },
  readOnlyCloseText: {
    color: Theme.colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
});
