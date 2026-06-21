import { Stack } from 'expo-router';
import { Theme } from '../../constants/theme';

export default function PaymentsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Theme.colors.background,
        },
        headerTintColor: Theme.colors.text,
        headerShadowVisible: false,
        headerTitleStyle: {
          ...Theme.typography.h3,
        },
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Payments',
        }} 
      />
      <Stack.Screen 
        name="bulk" 
        options={{ 
          title: 'Bulk Payment',
          presentation: 'card',
        }} 
      />
      <Stack.Screen 
        name="[voucherNo]" 
        options={{ 
          title: 'Payment Details',
          presentation: 'card',
        }} 
      />
    </Stack>
  );
}
