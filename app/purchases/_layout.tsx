import { Stack } from 'expo-router';
import { Theme } from '../../constants/theme';

export default function PurchasesLayout() {
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
          title: 'Purchases',
        }} 
      />
      <Stack.Screen 
        name="[voucherNo]" 
        options={{ 
          title: 'Purchase Details',
          presentation: 'card',
        }} 
      />
    </Stack>
  );
}
