import { Stack } from 'expo-router';
import { Theme } from '../../constants/theme';

export default function CustomersLayout() {
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
          title: 'Customers',
        }} 
      />
      <Stack.Screen 
        name="[account]" 
        options={{
          title: 'Customer Details',
          presentation: 'card',
        }} 
      />
    </Stack>
  );
}
