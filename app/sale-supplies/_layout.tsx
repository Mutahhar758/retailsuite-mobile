import { Stack } from 'expo-router';
import { Theme } from '../../constants/theme';

export default function SaleSuppliesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Theme.colors.background,
        },
        headerTintColor: Theme.colors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{
          title: 'Sale Supplies',
        }} 
      />
      <Stack.Screen 
        name="[voucherNo]" 
        options={{
          title: 'Supply Details',
          presentation: 'card',
        }} 
      />
    </Stack>
  );
}
