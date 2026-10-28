import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import dayjs from 'dayjs';
import { Theme } from '../../constants/theme';
import { purchaseService, PurchaseDto } from '../../services/purchaseService';

export default function PurchasesListScreen() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<PurchaseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const PAGE_SIZE = 20;

  const fetchPurchases = useCallback(async (pageNumber = 1) => {
    try {
      const result = await purchaseService.getList({ pageNumber, pageSize: PAGE_SIZE });
      setPurchases(prev => {
        if (pageNumber === 1) return result.data;
        const seen = new Set(prev.map(r => r.voucherNo));
        return [...prev, ...result.data.filter(r => !seen.has(r.voucherNo))];
      });
      setPage(pageNumber);
      setHasMore(pageNumber < result.totalPages);
    } catch (error) {
      console.error('Failed to fetch purchases', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPurchases(1);
    }, [fetchPurchases])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchPurchases(1);
  };

  const onEndReached = () => {
    if (loading || refreshing || loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchPurchases(page + 1);
  };

  const renderItem = ({ item, index }: { item: PurchaseDto; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(400)}>
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => router.push(`/purchases/${item.voucherNo}` as any)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.voucherNo}>PU-{String(item.voucherNo).padStart(5, '0')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.date, { marginRight: 10 }]}>{new Date(item.date).toLocaleDateString()}</Text>
            <TouchableOpacity 
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={(e) => {
                e.stopPropagation?.();
                router.push({ pathname: '/purchases/[voucherNo]' as any, params: { voucherNo: item.voucherNo, mode: 'copy' } });
              }}
            >
              <Ionicons name="copy-outline" size={17} color={Theme.colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.account} numberOfLines={1}>{item.account || 'Unknown Supplier'}</Text>
          <Text style={styles.amount}>Rs. {item.amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}</Text>
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
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={purchases}
          keyExtractor={(item) => item.voucherNo}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator size="small" color={Theme.colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cart-outline" size={64} color={Theme.colors.border} />
              <Text style={styles.emptyText}>No purchases found.</Text>
            </View>
          }
        />
      )}

      <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.fabContainer}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/purchases/new' as any)}
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
    marginBottom: Theme.spacing.md,
    ...Theme.shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  voucherNo: {
    ...Theme.typography.caption,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  date: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  account: {
    ...Theme.typography.body,
    fontWeight: '600',
    color: Theme.colors.text,
    flex: 1,
    marginRight: Theme.spacing.sm,
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
    borderTopColor: Theme.colors.border,
    paddingTop: Theme.spacing.sm,
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
    fontSize: 10,
    color: Theme.colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    ...Theme.typography.body,
    color: Theme.colors.textSecondary,
    marginTop: Theme.spacing.md,
  },
  fabContainer: {
    position: 'absolute',
    bottom: Theme.spacing.xl,
    right: Theme.spacing.xl,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.md,
  },
});
