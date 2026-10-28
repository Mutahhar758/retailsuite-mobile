import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import dayjs from 'dayjs';
import { Theme } from '../../constants/theme';
import { saleSupplyService, SaleSupply } from '../../services/saleSupplyService';
import { useAppStore } from '../../store/appStore';

export default function SaleSuppliesListScreen() {
  const router = useRouter();
  const { currentTenantIdentifier, licenses } = useAppStore();
  const currentOrg = licenses.find(l => l.tenantIdentifier === currentTenantIdentifier);
  const IsWandaFeature = (currentOrg as any)?.hasVariablePackFeature ?? false;

  const [supplies, setSupplies] = useState<SaleSupply[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const PAGE_SIZE = 20;

  const fetchSupplies = useCallback(async (pageNumber = 1) => {
    try {
      const result = await saleSupplyService.getList({ pageNumber, pageSize: PAGE_SIZE });
      setSupplies(prev => {
        if (pageNumber === 1) return result.data;
        const seen = new Set(prev.map(r => r.voucherNo));
        return [...prev, ...result.data.filter(r => !seen.has(r.voucherNo))];
      });
      setPage(pageNumber);
      setHasMore(pageNumber < result.totalPages);
    } catch (error) {
      console.error('Failed to fetch sale supplies', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSupplies(1);
    }, [fetchSupplies])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchSupplies(1);
  };

  const onEndReached = () => {
    if (loading || refreshing || loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchSupplies(page + 1);
  };
  const renderItem = ({ item, index }: { item: SaleSupply; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(400)}>
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => router.push(`/sale-supplies/${item.voucherNo}`)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.voucherNo}>SP-{String(item.voucherNo).padStart(5, '0')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.date, { marginRight: 10 }]}>{new Date(item.date).toLocaleDateString()}</Text>
            <TouchableOpacity 
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={(e) => {
                e.stopPropagation?.();
                router.push({ pathname: '/sale-supplies/[voucherNo]', params: { voucherNo: item.voucherNo, mode: 'copy' } });
              }}
            >
              <Ionicons name="copy-outline" size={17} color={Theme.colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.cardBody}>
          <Text style={styles.title} numberOfLines={1}>{item.item || 'Unknown Item'}</Text>
          {!!item.supplyOrderTitle && (
            <View style={styles.profileBadge}>
              <Ionicons name="document-text-outline" size={12} color="#1d4ed8" style={{ marginRight: 4 }} />
              <Text style={styles.profileText} numberOfLines={1}>
                {item.supplyOrderTitle}
              </Text>
            </View>
          )}
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
          data={supplies}
          keyExtractor={(item) => item.voucherNo}
          renderItem={renderItem}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={Theme.colors.primary} /> : null}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="car-outline" size={64} color={Theme.colors.border} />
              <Text style={styles.emptyText}>No sale supplies found.</Text>
            </View>
          }
        />
      )}

      <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.fabContainer}>
        <TouchableOpacity
          style={styles.registerFab}
          onPress={() => router.push(IsWandaFeature ? '/sale-supplies/wanda-customer-register' : '/sale-supplies/normal-customer-register')}
        >
          <Ionicons name="people-outline" size={20} color={Theme.colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.registerFabText}>Customer Register</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/sale-supplies/new')}
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
    marginBottom: Theme.spacing.sm,
    ...Theme.shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.xs,
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
    marginBottom: Theme.spacing.sm,
  },
  title: {
    ...Theme.typography.h3,
    color: Theme.colors.text,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
  },
  profileText: {
    ...Theme.typography.caption,
    color: '#1d4ed8',
    fontWeight: '600',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  registerFab: {
    backgroundColor: Theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: Theme.colors.primary,
    ...Theme.shadows.md,
  },
  registerFabText: {
    color: Theme.colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  fab: {
    backgroundColor: Theme.colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.md,
  },
});
