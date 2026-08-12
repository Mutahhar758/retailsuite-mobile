import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import dayjs from 'dayjs';
import { Theme } from '../../constants/theme';
import { saleSupplyService, SaleSupply } from '../../services/saleSupplyService';

export default function SaleSuppliesListScreen() {
  const router = useRouter();
  const [supplies, setSupplies] = useState<SaleSupply[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSupplies = useCallback(async () => {
    try {
      const data = await saleSupplyService.getList();
      setSupplies(data);
    } catch (error) {
      console.error('Failed to fetch sale supplies', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSupplies();
    }, [fetchSupplies])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchSupplies();
  };

  const renderItem = ({ item, index }: { item: SaleSupply; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(400)}>
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => router.push(`/sale-supplies/${item.voucherNo}`)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.voucherNo}>SP-{String(item.voucherNo).padStart(5, '0')}</Text>
          <Text style={styles.date}>{new Date(item.date).toLocaleDateString()}</Text>
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
          onPress={() => router.push('/sale-supplies/customer-register')}
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
