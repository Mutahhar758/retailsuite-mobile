import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Dimensions, ActivityIndicator, RefreshControl } from 'react-native';
import { Theme } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { dashboardService, DashboardStatsDto, SalesTrendDto, RecentPaymentDto } from '../../services/dashboardService';
import { LineChart } from 'react-native-gifted-charts';

const screenWidth = Dimensions.get('window').width;

export default function DashboardScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStatsDto | null>(null);
  const [salesTrend, setSalesTrend] = useState<SalesTrendDto[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPaymentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [statsData, trendData, paymentsData] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getSalesTrend(),
        dashboardService.getRecentPayments()
      ]);
      setStats(statsData);
      setSalesTrend(trendData);
      setRecentPayments(paymentsData);
    } catch (error) {
      console.log('Failed to fetch dashboard data', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  const SummaryCard = ({ title, value, icon, color, delay }: any) => (
    <Animated.View entering={FadeInDown.delay(delay).duration(600)} style={[styles.card, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardValue} adjustsFontSizeToFit numberOfLines={1}>{value}</Text>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.background }}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  // Format chart data
  const chartLabels = salesTrend.length > 0 ? salesTrend.map(s => s.month.substring(0, 3)) : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const chartData = salesTrend.length > 0 ? salesTrend.map(s => s.sales) : [0, 0, 0, 0, 0, 0];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

        {/* Header Section */}
        <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.email?.split('@')[0] || 'Admin'} 👋</Text>
            <Text style={styles.subtitle}>Here is your summary today</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/profile')} style={styles.profileBtn}>
            <Ionicons name="person-outline" size={24} color={Theme.colors.primary} />
          </TouchableOpacity>
        </Animated.View>

        {/* Top 4 Widgets Grid */}
        <View style={styles.grid}>
          <SummaryCard
            title="Total Sales (MTD)"
            value={stats ? `Rs. ${stats.totalSalesMTD.toLocaleString(undefined, { minimumFractionDigits: 0 })}` : 'Rs. 0'}
            icon="cart-outline" color={Theme.colors.primary} delay={200}
          />
          <SummaryCard
            title="Cash In"
            value={stats ? `Rs. ${stats.cashInMTD.toLocaleString(undefined, { minimumFractionDigits: 0 })}` : 'Rs. 0'}
            icon="arrow-down-outline" color={Theme.colors.success} delay={300}
          />
          <SummaryCard
            title="Cash Out"
            value={stats ? `Rs. ${stats.cashOutMTD.toLocaleString(undefined, { minimumFractionDigits: 0 })}` : 'Rs. 0'}
            icon="arrow-up-outline" color={Theme.colors.danger} delay={400}
          />
          <SummaryCard
            title="Total Stock Value"
            value={stats ? `Rs. ${stats.totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 0 })}` : 'Rs. 0'}
            icon="cube-outline" color={Theme.colors.warning} delay={500}
          />
        </View>

        {/* Sales Graph */}
        <Animated.View entering={FadeInDown.delay(600).duration(600)} style={styles.chartSection}>
          <Text style={styles.sectionTitle}>Sales Trend (Last 7 Months)</Text>
          <LineChart
            data={salesTrend.length > 0 ? salesTrend.map(s => ({ value: s.sales, label: s.month.substring(0, 3) })) : [{ value: 0, label: 'Jan' }]}
            width={screenWidth - Theme.spacing.md * 2 - 80}
            height={220}
            thickness={3}
            color={Theme.colors.primary}
            dataPointsColor={Theme.colors.primary}
            dataPointsRadius={4}
            startFillColor={Theme.colors.primary}
            endFillColor={Theme.colors.white}
            startOpacity={0.2}
            endOpacity={0.0}
            areaChart
            yAxisLabelWidth={45}
            yAxisTextStyle={{ color: Theme.colors.textSecondary, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: Theme.colors.textSecondary, fontSize: 10 }}
            formatYLabel={(label) => {
              const val = parseInt(label);
              if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
              if (val >= 1000) return (val / 1000).toFixed(0) + 'K';
              return label;
            }}
            rulesColor={Theme.colors.border}
            yAxisColor={Theme.colors.border}
            xAxisColor={Theme.colors.border}
            isAnimated
          />
        </Animated.View>

        {/* Recent Payments Section */}
        <Animated.View entering={FadeInDown.delay(700).duration(600)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
          </View>

          {recentPayments.length === 0 ? (
            <Text style={styles.emptyText}>No recent payments found.</Text>
          ) : (
            recentPayments.map((payment, index) => (
              <View key={`${payment.id}_${index}`} style={styles.activityItem}>
                <View style={[styles.iconContainer, { backgroundColor: payment.type === 'In' ? Theme.colors.success + '20' : Theme.colors.danger + '20' }]}>
                  <Ionicons name={payment.type === 'In' ? "arrow-down-outline" : "arrow-up-outline"} size={20} color={payment.type === 'In' ? Theme.colors.success : Theme.colors.danger} />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle} numberOfLines={1}>{payment.party || 'Unknown'}</Text>
                  <Text style={styles.activityTime}>{new Date(payment.date).toLocaleDateString()} • #{payment.id}</Text>
                </View>
                <View style={styles.amountContainer}>
                  <Text style={[styles.activityAmount, { color: payment.type === 'In' ? Theme.colors.success : Theme.colors.danger }]}>
                    {payment.type === 'In' ? '+' : '-'}Rs. {payment.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: payment.status === 'Completed' ? Theme.colors.success + '20' : Theme.colors.warning + '20' }]}>
                    <Text style={[styles.statusText, { color: payment.status === 'Completed' ? Theme.colors.success : Theme.colors.warning }]}>
                      {payment.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </Animated.View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: Theme.spacing.md,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
    marginTop: Theme.spacing.md,
  },
  greeting: {
    ...Theme.typography.h2,
    color: Theme.colors.text,
    marginBottom: 4,
  },
  subtitle: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
  },
  profileBtn: {
    backgroundColor: Theme.colors.white,
    padding: Theme.spacing.sm,
    borderRadius: Theme.radii.round,
    ...Theme.shadows.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
  },
  card: {
    width: '47%',
    backgroundColor: Theme.colors.white,
    padding: Theme.spacing.md,
    borderRadius: Theme.radii.lg,
    ...Theme.shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Theme.spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: Theme.radii.round,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    ...Theme.typography.small,
    color: Theme.colors.textSecondary,
    marginBottom: Theme.spacing.xs,
  },
  cardValue: {
    ...Theme.typography.h3,
    color: Theme.colors.text,
  },
  chartSection: {
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radii.xl,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
    ...Theme.shadows.sm,
  },
  section: {
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radii.xl,
    padding: Theme.spacing.md,
    ...Theme.shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  sectionTitle: {
    ...Theme.typography.h3,
    color: Theme.colors.text,
    marginBottom: 10,
  },
  emptyText: {
    ...Theme.typography.body,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: Theme.spacing.md,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  activityContent: {
    flex: 1,
    marginLeft: Theme.spacing.md,
  },
  activityTitle: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.text,
  },
  activityTime: {
    ...Theme.typography.small,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  activityAmount: {
    ...Theme.typography.bodyMedium,
    fontWeight: '600',
  },
  statusBadge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
