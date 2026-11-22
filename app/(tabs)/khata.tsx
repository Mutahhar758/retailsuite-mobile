import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { Theme } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import {
  KhataPartyDto,
  KhataSummaryResponse,
  formatKhataAmount,
  khataService,
} from '../../services/khataService';
import { QuickAddPartyModal } from '../../components/khata/QuickAddPartyModal';

type FilterType = 'All' | 'Customer' | 'Vendor' | 'ToReceive' | 'ToGive';
type SortType = 'Recent' | 'Highest' | 'Name';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'Customer', label: 'Customers' },
  { key: 'Vendor', label: 'Vendors' },
  { key: 'ToReceive', label: 'To Receive' },
  { key: 'ToGive', label: 'To Give' },
];

export default function KhataHomeScreen() {
  const router = useRouter();
  const { user, permissions } = useAuthStore();

  const hasPermission = (action: string, resource: string) => {
    if (user?.isOwner) return true;
    return permissions.includes(`Permissions.${resource}.${action}`);
  };

  const canCreateCustomer = hasPermission('Create', 'Customers');
  const canCreateVendor = hasPermission('Create', 'Vendors') || hasPermission('Create', 'Suppliers');
  const canQuickAdd = canCreateCustomer || canCreateVendor;

  const [summary, setSummary] = useState<KhataSummaryResponse>({
    totalReceivable: 0,
    totalPayable: 0,
    netBalance: 0,
    parties: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('All');
  const [sortBy, setSortBy] = useState<SortType>('Recent');
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const loadParties = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      setError(null);
      const data = await khataService.getParties();
      setSummary(data);
    } catch {
      setError('Failed to load Khata parties. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadParties(false);
    }, [loadParties])
  );

  const filteredParties = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = summary.parties.filter((p) => {
      if (q) {
        const matchTitle = p.title.toLowerCase().includes(q);
        const matchPhone = (p.phone || '').toLowerCase().includes(q);
        const matchId = p.accountId.toLowerCase().includes(q);
        if (!matchTitle && !matchPhone && !matchId) return false;
      }
      if (filter === 'Customer' && p.partyType !== 'Customer') return false;
      if (filter === 'Vendor' && p.partyType !== 'Vendor') return false;
      if (filter === 'ToReceive' && p.balance <= 0) return false;
      if (filter === 'ToGive' && p.balance >= 0) return false;
      return true;
    });

    if (sortBy === 'Highest') {
      return [...list].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
    }
    if (sortBy === 'Name') {
      return [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    // Default 'Recent' preserves backend order (latest transaction first)
    return list;
  }, [summary.parties, search, filter, sortBy]);

  const cycleSort = () => {
    setSortBy((prev) => (prev === 'Recent' ? 'Highest' : prev === 'Highest' ? 'Name' : 'Recent'));
  };

  const getInitials = (title: string) => {
    const parts = title.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return ((parts[0][0] || '') + (parts[1][0] || '')).toUpperCase();
  };

  const renderPartyItem = ({ item }: { item: KhataPartyDto }) => {
    const isReceivable = item.balance > 0;
    const isPayable = item.balance < 0;
    const balanceColor = isReceivable
      ? Theme.colors.success
      : isPayable
      ? Theme.colors.danger
      : Theme.colors.textSecondary;
    const balanceLabel = isReceivable
      ? 'You will Get'
      : isPayable
      ? 'You will Give'
      : 'Settled';
    const isVendor = item.partyType === 'Vendor';

    return (
      <TouchableOpacity
        style={styles.partyCard}
        activeOpacity={0.75}
        onPress={() =>
          router.push({
            pathname: '/khata/[accountId]',
            params: { accountId: item.accountId, title: item.title },
          } as any)
        }
      >
        <View
          style={[
            styles.avatar,
            { backgroundColor: isVendor ? Theme.colors.warning + '25' : Theme.colors.primary + '18' },
          ]}
        >
          <Text
            style={[
              styles.avatarText,
              { color: isVendor ? '#B7791F' : Theme.colors.primary },
            ]}
          >
            {getInitials(item.title)}
          </Text>
        </View>

        <View style={styles.partyInfo}>
          <View style={styles.partyTitleRow}>
            <Text style={styles.partyTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <View
              style={[
                styles.typeBadge,
                { backgroundColor: isVendor ? Theme.colors.warning + '25' : Theme.colors.primary + '14' },
              ]}
            >
              <Text
                style={[
                  styles.typeBadgeText,
                  { color: isVendor ? '#975A16' : Theme.colors.primary },
                ]}
              >
                {item.partyType}
              </Text>
            </View>
          </View>
          <Text style={styles.partyMeta} numberOfLines={1}>
            {item.lastTransactionDate
              ? `${dayjs(item.lastTransactionDate).format('DD MMM YYYY')}${
                  item.lastTransactionNote ? ` · ${item.lastTransactionNote}` : ''
                }`
              : item.phone || 'No entries yet'}
          </Text>
        </View>

        <View style={styles.balanceCol}>
          <Text style={[styles.balanceAmount, { color: balanceColor }]}>
            {formatKhataAmount(item.balance)}
          </Text>
          <Text style={styles.balanceSub}>{balanceLabel}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.screenTitle}>Khata</Text>
            <Text style={styles.screenSubtitle}>Quick party ledger &amp; cash in/out</Text>
          </View>
          {canQuickAdd && (
            <TouchableOpacity
              style={styles.addPartyBtn}
              onPress={() => setShowQuickAdd(true)}
            >
              <Ionicons name="add" size={18} color={Theme.colors.white} />
              <Text style={styles.addPartyBtnText}>Add Party</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summarySplit}>
            <View style={styles.summaryHalf}>
              <Text style={styles.summaryLabel}>You will Get</Text>
              <Text style={[styles.summaryValue, { color: Theme.colors.success }]}>
                {formatKhataAmount(summary.totalReceivable)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={[styles.summaryHalf, { paddingLeft: 14 }]}>
              <Text style={styles.summaryLabel}>You will Give</Text>
              <Text style={[styles.summaryValue, { color: Theme.colors.danger }]}>
                {formatKhataAmount(summary.totalPayable)}
              </Text>
            </View>
          </View>
          <View style={styles.netRow}>
            <Text style={styles.netLabel}>Net Balance</Text>
            <Text
              style={[
                styles.netValue,
                {
                  color:
                    summary.netBalance > 0
                      ? Theme.colors.success
                      : summary.netBalance < 0
                      ? Theme.colors.danger
                      : Theme.colors.text,
                },
              ]}
            >
              {summary.netBalance >= 0 ? '+ ' : '− '}
              {formatKhataAmount(summary.netBalance)}
            </Text>
          </View>
        </View>

        {/* Search & Sort Row */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={Theme.colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search customer, vendor, or phone..."
              placeholderTextColor="#A0AEC0"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={Theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.sortBtn} onPress={cycleSort}>
            <Ionicons name="swap-vertical-outline" size={16} color={Theme.colors.primary} />
            <Text style={styles.sortBtnText}>{sortBy}</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Party List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>Loading Khata...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Ionicons name="cloud-offline-outline" size={42} color={Theme.colors.textSecondary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadParties(true)}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredParties}
          keyExtractor={(item) => item.accountId}
          renderItem={renderPartyItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadParties(true)}
              colors={[Theme.colors.primary]}
              tintColor={Theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerBox}>
              <Ionicons name="book-outline" size={44} color={Theme.colors.textSecondary} />
              <Text style={styles.emptyTitle}>No parties found</Text>
              <Text style={styles.emptySub}>
                {search || filter !== 'All'
                  ? 'Try clearing your search or filter.'
                  : 'Tap "+ Add Party" above to start your Khata.'}
              </Text>
            </View>
          }
        />
      )}

      <QuickAddPartyModal
        visible={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        canCreateCustomer={canCreateCustomer}
        canCreateVendor={canCreateVendor}
        onCreated={(party) => {
          setShowQuickAdd(false);
          loadParties(false);
          if (party.accountId) {
            router.push({
              pathname: '/khata/[accountId]',
              params: { accountId: party.accountId, title: party.title },
            } as any);
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
  headerContainer: {
    backgroundColor: Theme.colors.white,
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Theme.spacing.sm,
    paddingBottom: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  screenSubtitle: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    marginTop: 1,
  },
  addPartyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Theme.radii.round,
    ...Theme.shadows.sm,
  },
  addPartyBtnText: {
    color: Theme.colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radii.lg,
    padding: 14,
    marginBottom: 12,
  },
  summarySplit: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryHalf: {
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: Theme.colors.border,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Theme.colors.textSecondary,
  },
  summaryValue: {
    fontSize: 19,
    fontWeight: '700',
    marginTop: 2,
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
  },
  netLabel: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontWeight: '500',
  },
  netValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radii.md,
    paddingHorizontal: 10,
    height: 40,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Theme.colors.text,
    paddingVertical: 0,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.colors.primary + '12',
    borderWidth: 1,
    borderColor: Theme.colors.primary + '30',
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 2,
  },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: Theme.radii.round,
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  filterChipTextActive: {
    color: Theme.colors.white,
  },
  listContent: {
    padding: Theme.spacing.md,
    paddingBottom: 32,
  },
  partyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radii.lg,
    padding: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    ...Theme.shadows.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  partyInfo: {
    flex: 1,
    marginRight: 8,
  },
  partyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  partyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.text,
    flexShrink: 1,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  partyMeta: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 3,
  },
  balanceCol: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  balanceSub: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 14,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Theme.radii.md,
  },
  retryBtnText: {
    color: Theme.colors.white,
    fontWeight: '700',
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  emptySub: {
    marginTop: 4,
    fontSize: 13,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
  },
});
