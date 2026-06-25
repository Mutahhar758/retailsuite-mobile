import { Stack } from 'expo-router';
import { Theme } from '../../constants/theme';

export default function ProductsLayout() {
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
          title: 'Products',
        }} 
      />
      <Stack.Screen 
        name="[id]" 
        options={{
          title: 'Product Details',
          presentation: 'card',
        }} 
      />
    </Stack>
  );
}
