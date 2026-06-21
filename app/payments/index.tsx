import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import dayjs from 'dayjs';
import { Theme } from '../../constants/theme';
import { paymentService, PaymentDto } from '../../services/paymentService';

export default function PaymentsListScreen() {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPayments = useCallback(async () => {
    try {
      const data = await paymentService.getList();
      setPayments(data);
    } catch (error) {
      console.error('Failed to fetch payments', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPayments();
    }, [fetchPayments])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchPayments();
  };

  const renderItem = ({ item, index }: { item: PaymentDto; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(400)}>
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => router.push(`/payments/${item.voucherNo}`)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.voucherNo}>PV-{String(item.voucherNo).padStart(5, '0')}</Text>
          <Text style={styles.date}>{new Date(item.date).toLocaleDateString()}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.narration} numberOfLines={1}>{item.narration || 'No narration'}</Text>
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
          data={payments}
          keyExtractor={(item) => item.voucherNo}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color={Theme.colors.border} />
              <Text style={styles.emptyText}>No payments found.</Text>
            </View>
          }
        />
      )}

      <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.fabContainer}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/payments/new')}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  narration: {
    ...Theme.typography.body,
    color: Theme.colors.text,
    flex: 1,
    marginRight: Theme.spacing.sm,
  },
  amount: {
    ...Theme.typography.h3,
    color: Theme.colors.danger, // payment is out, red is better
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
