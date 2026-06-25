import { Stack } from 'expo-router';
import { Theme } from '../../constants/theme';

export default function VendorsLayout() {
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
          title: 'Vendors',
        }} 
      />
      <Stack.Screen 
        name="[account]" 
        options={{
          title: 'Vendor Details',
          presentation: 'card',
        }} 
      />
    </Stack>
  );
}
