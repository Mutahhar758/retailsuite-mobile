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

  const showDataEntry = hasPermission('View', 'Receipts') || hasPermission('View', 'SaleSupplies') || hasPermission('View', 'Payments') || hasPermission('View', 'Purchases');
  const showReports = hasPermission('View', 'Reports');
  const showSetup = hasPermission('View', 'Customers') || hasPermission('View', 'Suppliers') || hasPermission('View', 'InventoryItems');

  return (
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
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="data-entry"
        options={{
          title: 'Data Entry',
          href: showDataEntry ? undefined : null as any,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="create-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          href: showReports ? undefined : null as any,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="setup"
        options={{
          title: 'Setup',
          href: showSetup ? undefined : null as any,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
