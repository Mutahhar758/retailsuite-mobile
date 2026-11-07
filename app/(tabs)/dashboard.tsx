import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  dashboardService,
  DashboardStatsDto,
  SalesTrendDto,
  CashFlowTrendDto,
  ExpenseCategoryDto,
  RecentExpenseDto,
  StockStatusDto,
  RecentPaymentDto
} from '../../services/dashboardService';
import { LineChart } from 'react-native-gifted-charts';

const screenWidth = Dimensions.get('window').width;

export default function DashboardScreen() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStatsDto | null>(null);
  const [salesTrend, setSalesTrend] = useState<SalesTrendDto[]>([]);
  const [cashFlowTrend, setCashFlowTrend] = useState<CashFlowTrendDto[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<ExpenseCategoryDto[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<RecentExpenseDto[]>([]);
  const [stockStatus, setStockStatus] = useState<StockStatusDto[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPaymentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [
        statsData,
        trendData,
        cashFlowData,
        expCatData,
        recExpData,
        stockData,
        paymentsData
      ] = await Promise.all([
        dashboardService.getStats().catch(() => null),
        dashboardService.getSalesTrend().catch(() => []),
        dashboardService.getCashFlowTrend().catch(() => []),
        dashboardService.getExpensesByCategory().catch(() => []),
        dashboardService.getRecentExpenses().catch(() => []),
        dashboardService.getStockStatus().catch(() => []),
        dashboardService.getRecentPayments().catch(() => [])
      ]);
      if (statsData) setStats(statsData);
      setSalesTrend(trendData || []);
      setCashFlowTrend(cashFlowData || []);
      setExpensesByCategory(expCatData || []);
      setRecentExpenses(recExpData || []);
      setStockStatus(stockData || []);
      setRecentPayments(paymentsData || []);
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

  const SummaryCard = ({ title, value, icon, color, delay }: any) => (
    <Animated.View entering={FadeInDown.delay(delay).duration(500)} style={[styles.card, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={22} color={color} />
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

  const lowStockItems = stockStatus.filter(
    s => s.status === 'Low Stock' || s.status === 'Out of Stock' || s.lowStockAlert
  );

  const totalExpenseCatSum = expensesByCategory.reduce((acc, e) => acc + (e.value || 0), 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header Section */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.email?.split('@')[0] || 'Admin'} 👋</Text>
            <Text style={styles.subtitle}>Here is your business overview today</Text>
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
            icon="cart-outline" color={Theme.colors.primary} delay={150}
          />
          <SummaryCard
            title="Cash In (MTD)"
            value={stats ? `Rs. ${stats.cashInMTD.toLocaleString(undefined, { minimumFractionDigits: 0 })}` : 'Rs. 0'}
            icon="arrow-down-outline" color={Theme.colors.success} delay={250}
          />
          <SummaryCard
            title="Cash Out (MTD)"
            value={stats ? `Rs. ${stats.cashOutMTD.toLocaleString(undefined, { minimumFractionDigits: 0 })}` : 'Rs. 0'}
            icon="arrow-up-outline" color={Theme.colors.danger} delay={350}
          />
          <SummaryCard
            title="Total Stock Value"
            value={stats ? `Rs. ${stats.totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 0 })}` : 'Rs. 0'}
            icon="cube-outline" color={Theme.colors.warning} delay={450}
          />
        </View>

        {/* Low Stock Alert Banner / Section */}
        {lowStockItems.length > 0 && (
          <Animated.View entering={FadeInDown.delay(500).duration(500)} style={styles.lowStockSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="warning-outline" size={20} color="#d97706" />
                <Text style={styles.sectionTitleInline}>Low Stock Alerts ({lowStockItems.length})</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/(tabs)/reports', params: { reportType: 'stock_balance' } })}
              >
                <Text style={styles.linkText}>View All</Text>
              </TouchableOpacity>
            </View>
            {lowStockItems.slice(0, 5).map((item, idx) => {
              const isOut = item.qty <= 0 || item.status === 'Out of Stock';
              return (
                <View key={`${item.code || item.name}_${idx}`} style={styles.stockRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stockName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.stockMeta}>
                      Threshold: {item.lowStockQty ?? 0} • Value: Rs. {(item.value || 0).toLocaleString()}
                    </Text>
                  </View>
                  <View style={[styles.stockBadge, { backgroundColor: isOut ? '#fef2f2' : '#fffbeb' }]}>
                    <Text style={[styles.stockBadgeText, { color: isOut ? '#dc2626' : '#d97706' }]}>
                      {item.qty} Left
                    </Text>
                  </View>
                </View>
              );
            })}
          </Animated.View>
        )}

        {/* Sales Trend Graph */}
        <Animated.View entering={FadeInDown.delay(550).duration(500)} style={styles.chartSection}>
          <Text style={styles.sectionTitle}>Sales Trend (Last 7 Months)</Text>
          <LineChart
            data={salesTrend.length > 0 ? salesTrend.map(s => ({ value: s.sales, label: s.month.substring(0, 3) })) : [{ value: 0, label: 'Jan' }]}
            width={screenWidth - Theme.spacing.md * 2 - 80}
            height={200}
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

        {/* Cash Flow Trend Section */}
        {cashFlowTrend.length > 0 && (
          <Animated.View entering={FadeInDown.delay(600).duration(500)} style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleInline}>Cash Flow Trend (In vs Out)</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Theme.colors.success }} />
                  <Text style={{ fontSize: 11, color: Theme.colors.textSecondary }}>In</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Theme.colors.danger }} />
                  <Text style={{ fontSize: 11, color: Theme.colors.textSecondary }}>Out</Text>
                </View>
              </View>
            </View>
            {cashFlowTrend.slice(-6).map((cf, idx) => {
              const maxVal = Math.max(cf.cashIn || 0, cf.cashOut || 0, 1);
              const inPct = Math.min(100, Math.round(((cf.cashIn || 0) / maxVal) * 100));
              const outPct = Math.min(100, Math.round(((cf.cashOut || 0) / maxVal) * 100));
              return (
                <View key={`${cf.month}_${idx}`} style={styles.cfRow}>
                  <Text style={styles.cfMonth}>{cf.month.substring(0, 3)}</Text>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.cfBarTrack}>
                      <View style={[styles.cfBarFill, { width: `${inPct}%`, backgroundColor: Theme.colors.success }]} />
                    </View>
                    <View style={styles.cfBarTrack}>
                      <View style={[styles.cfBarFill, { width: `${outPct}%`, backgroundColor: Theme.colors.danger }]} />
                    </View>
                  </View>
                  <View style={styles.cfValues}>
                    <Text style={[styles.cfValText, { color: Theme.colors.success }]}>
                      +{((cf.cashIn || 0) / 1000).toFixed(0)}k
                    </Text>
                    <Text style={[styles.cfValText, { color: Theme.colors.danger }]}>
                      -{((cf.cashOut || 0) / 1000).toFixed(0)}k
                    </Text>
                  </View>
                </View>
              );
            })}
          </Animated.View>
        )}

        {/* Expenses by Category & Recent Expenses */}
        {(expensesByCategory.length > 0 || recentExpenses.length > 0) && (
          <Animated.View entering={FadeInDown.delay(650).duration(500)} style={styles.section}>
            <Text style={styles.sectionTitle}>Expenses Breakdown (MTD)</Text>
            {expensesByCategory.slice(0, 5).map((exp, idx) => {
              const pct = totalExpenseCatSum > 0 ? Math.round((exp.value / totalExpenseCatSum) * 100) : 0;
              return (
                <View key={`${exp.category}_${idx}`} style={styles.expCatRow}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={styles.expCatName}>{exp.category}</Text>
                    <Text style={styles.expCatAmount}>Rs. {exp.value.toLocaleString()} ({pct}%)</Text>
                  </View>
                  <View style={styles.cfBarTrack}>
                    <View style={[styles.cfBarFill, { width: `${pct}%`, backgroundColor: '#8b5cf6' }]} />
                  </View>
                </View>
              );
            })}

            {recentExpenses.length > 0 && (
              <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: Theme.colors.border }}>
                <Text style={[styles.cardTitle, { fontWeight: '700', marginBottom: 8 }]}>Recent Expense Vouchers</Text>
                {recentExpenses.slice(0, 4).map((re, idx) => (
                  <View key={`${re.id}_${idx}`} style={styles.recentExpenseRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityTitle} numberOfLines={1}>{re.category}</Text>
                      <Text style={styles.activityTime}>{new Date(re.date).toLocaleDateString()} • #{re.id}</Text>
                    </View>
                    <Text style={[styles.activityAmount, { color: Theme.colors.danger }]}>
                      Rs. {re.amount.toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        )}

        {/* Recent Payments Section */}
        <Animated.View entering={FadeInDown.delay(700).duration(500)} style={styles.section}>
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
    marginBottom: Theme.spacing.lg,
    marginTop: Theme.spacing.sm,
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
    marginBottom: Theme.spacing.lg,
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
    marginBottom: Theme.spacing.sm,
  },
  iconContainer: {
    width: 38,
    height: 38,
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
  lowStockSection: {
    backgroundColor: '#fffbeb',
    borderRadius: Theme.radii.lg,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitleInline: {
    ...Theme.typography.h3,
    color: Theme.colors.text,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#fef3c7',
  },
  stockName: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  stockMeta: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stockBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chartSection: {
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radii.xl,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
    ...Theme.shadows.sm,
  },
  section: {
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radii.xl,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
    ...Theme.shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  sectionTitle: {
    ...Theme.typography.h3,
    color: Theme.colors.text,
    marginBottom: 10,
  },
  cfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  cfMonth: {
    width: 34,
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.textSecondary,
  },
  cfBarTrack: {
    height: 7,
    backgroundColor: Theme.colors.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  cfBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  cfValues: {
    width: 55,
    alignItems: 'flex-end',
  },
  cfValText: {
    fontSize: 10,
    fontWeight: '700',
  },
  expCatRow: {
    marginBottom: 10,
  },
  expCatName: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  expCatAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6d28d9',
  },
  recentExpenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
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
    marginBottom: Theme.spacing.md,
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
