import { Stack } from 'expo-router';
import { Theme } from '../../constants/theme';

export default function ReceiptsLayout() {
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
          title: 'Receipts',
        }} 
      />
      <Stack.Screen 
        name="bulk" 
        options={{ 
          title: 'Bulk Receipt',
          presentation: 'card',
        }} 
      />
      <Stack.Screen 
        name="[voucherNo]" 
        options={{ 
          title: 'Receipt Details',
          presentation: 'card',
        }} 
      />
    </Stack>
  );
}
