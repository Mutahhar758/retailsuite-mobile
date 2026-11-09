import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { user, permissions } = useAuthStore();

  const hasPermission = (action: string, resource: string) => {
    if (user?.isOwner) return true;
    const requiredPermission = `Permissions.${resource}.${action}`;
    return permissions.includes(requiredPermission);
  };

  const showDataEntry = 
    hasPermission('View', 'ReceiptVouchers') || 
    hasPermission('View', 'SaleSupplies') || 
    hasPermission('View', 'Sales') || 
    hasPermission('View', 'POSSales') || 
    hasPermission('View', 'PaymentVouchers') || 
    hasPermission('View', 'Purchases');
  const showReports = 
    user?.isOwner ||
    hasPermission('View', 'Reports') ||
    permissions.some((p) =>
      p === 'Permissions.AccountStatement.View' ||
      p === 'Permissions.AccountStatementWithDue.View' ||
      p === 'Permissions.AccountBalance.View' ||
      p === 'Permissions.TrialBalance.View' ||
      p === 'Permissions.StockBalance.View' ||
      p === 'Permissions.StockLedger.View' ||
      p === 'Permissions.IncomeSummary.View' ||
      p === 'Permissions.BalanceSheet.View' ||
      p === 'Permissions.CustomerBill.View' ||
      p === 'Permissions.CustomerBalanceRecovery.View' ||
      p === 'Permissions.PurchaseSupplyComparison.View' ||
      p === 'Permissions.MilkComparison.View' ||
      p === 'Permissions.ProfitByCustomer.View' ||
      p === 'Permissions.ProfitByItem.View' ||
      p === 'Permissions.MiscReports.View'
    );

  const showSetup = 
    user?.isOwner ||
    hasPermission('View', 'Customers') || 
    hasPermission('View', 'Suppliers') || 
    hasPermission('View', 'Vendors') || 
    hasPermission('View', 'InventoryItems') ||
    hasPermission('View', 'ChartOfAccounts');

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Theme.colors.primary,
          tabBarInactiveTintColor: Theme.colors.textSecondary,
          tabBarStyle: {
            backgroundColor: Theme.colors.white,
            borderTopColor: Theme.colors.border,
            height: Platform.OS === 'android' ? (60 + insets.bottom) : (85),
            paddingBottom: Platform.OS === 'android' ? (insets.bottom > 0 ? insets.bottom : 8) : insets.bottom,
            paddingTop: 10,
            ...Theme.shadows.md,
          },
        }}>
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="grid-outline" size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="data-entry"
          options={{
            title: 'Data Entry',
            href: showDataEntry ? undefined : null as any,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="create-outline" size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: 'Reports',
            href: showReports ? undefined : null as any,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="document-text-outline" size={size} color={color as string} />
            ),
          }}
        />
        <Tabs.Screen
          name="setup"
          options={{
            title: 'Setup',
            href: showSetup ? undefined : null as any,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" size={size} color={color as string} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
