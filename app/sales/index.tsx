import React, { useState, useCallback, useMemo } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  SafeAreaView, ActivityIndicator, RefreshControl, TextInput 
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import dayjs from 'dayjs';
import { Theme } from '../../constants/theme';
import { saleService, SaleDto } from '../../services/saleService';

export default function SalesListScreen() {
  const router = useRouter();
  const [sales, setSales] = useState<SaleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSales = useCallback(async () => {
    try {
      const data = await saleService.getList();
      setSales(data || []);
    } catch (error) {
      console.error('Failed to fetch sales', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSales();
    }, [fetchSales])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchSales();
  };

  const filteredSales = useMemo(() => {
    if (!searchQuery.trim()) return sales;
    const q = searchQuery.toLowerCase().trim();
    return sales.filter(s => 
      (s.voucherNo && s.voucherNo.toLowerCase().includes(q)) ||
      (s.account && s.account.toLowerCase().includes(q)) ||
      (s.createdBy && s.createdBy.toLowerCase().includes(q))
    );
  }, [sales, searchQuery]);

  const renderItem = ({ item, index }: { item: SaleDto; index: number }) => (
    <Animated.View entering={FadeInUp.delay(Math.min(index * 40, 400)).duration(400)}>
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => router.push(`/sales/${item.voucherNo}` as any)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.voucherBadge}>
            <Text style={styles.voucherNo}>SL-{String(item.voucherNo).padStart(5, '0')}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.date, { marginRight: 10 }]}>{new Date(item.date).toLocaleDateString()}</Text>
            <TouchableOpacity 
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={(e) => {
                e.stopPropagation?.();
                router.push({ pathname: '/sales/[voucherNo]' as any, params: { voucherNo: item.voucherNo, mode: 'copy' } });
              }}
            >
              <Ionicons name="copy-outline" size={17} color={Theme.colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.account} numberOfLines={1}>{item.account || 'Walk-in Customer'}</Text>
          <Text style={styles.amount}>Rs. {(item.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}</Text>
        </View>
        <View style={styles.cardFooter}>
          <View style={{ flex: 1 }}>
            <View style={styles.infoRow}>
              <Ionicons name="add-circle-outline" size={13} color={Theme.colors.textSecondary} style={styles.infoIcon} />
              <Text style={styles.infoText}>
                Created: {item.createdBy || 'System'} | {dayjs(item.createdOn).format('DD-MMM-YYYY hh:mm A')}
              </Text>
            </View>
            {!!item.lastModifiedBy && (
              <View style={styles.infoRow}>
                <Ionicons name="create-outline" size={13} color={Theme.colors.textSecondary} style={styles.infoIcon} />
                <Text style={styles.infoText}>
                  Modified: {item.lastModifiedBy} | {dayjs(item.lastModifiedOn).format('DD-MMM-YYYY hh:mm A')}
                </Text>
              </View>
            )}
          </View>
          <Ionicons name="chevron-forward" size={16} color={Theme.colors.textSecondary} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={Theme.colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by customer or voucher #..."
          placeholderTextColor={Theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={Theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredSales}
          keyExtractor={(item) => item.voucherNo}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={64} color={Theme.colors.border} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No matching sales found.' : 'No sales found.'}
              </Text>
            </View>
          }
        />
      )}

      <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.fabContainer}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/sales/new' as any)}
        >
          <Ionicons name="add" size={30} color={Theme.colors.white} />
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.white,
    marginHorizontal: Theme.spacing.md,
    marginTop: Theme.spacing.sm,
    marginBottom: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.radii.md,
    height: 44,
    ...Theme.shadows.sm,
  },
  searchIcon: {
    marginRight: Theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Theme.typography.body,
    color: Theme.colors.text,
    height: '100%',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: Theme.spacing.md,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radii.lg,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
    ...Theme.shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.xs,
  },
  voucherBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  voucherNo: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.primary,
    fontWeight: '700',
  },
  date: {
    ...Theme.typography.small,
    color: Theme.colors.textSecondary,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: Theme.spacing.sm,
  },
  account: {
    ...Theme.typography.body,
    color: Theme.colors.text,
    flex: 1,
    marginRight: Theme.spacing.sm,
    fontWeight: '600',
  },
  amount: {
    ...Theme.typography.h3,
    color: Theme.colors.primary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Theme.colors.background,
    paddingTop: Theme.spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  infoIcon: {
    marginRight: 4,
  },
  infoText: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    fontSize: 11,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Theme.spacing.xxl,
    marginTop: Theme.spacing.xxl,
  },
  emptyText: {
    ...Theme.typography.body,
    color: Theme.colors.textSecondary,
    marginTop: Theme.spacing.md,
  },
  fabContainer: {
    position: 'absolute',
    bottom: Theme.spacing.lg,
    right: Theme.spacing.lg,
  },
  fab: {
    backgroundColor: Theme.colors.primary,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.md,
  },
});
