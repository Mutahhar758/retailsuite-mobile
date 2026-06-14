import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Appearance } from 'react-native';
import 'react-native-reanimated';
import { useAuthStore } from '../store/authStore';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  // Force native system elements (like picker dialogs and alert dialogs) to always render in light mode safely
  useEffect(() => {
    try {
      if (typeof Appearance.setColorScheme === 'function') {
        Appearance.setColorScheme('light');
      }
    } catch (e) {
      console.warn('Failed to set color scheme:', e);
    }
  }, []);

  useEffect(() => {
    if (!navigationState?.key) return;
    if (!_hasHydrated) return;

    const inAuthGroup = segments[0] === '(auth)';

    // Defer the navigation to the next tick to ensure the root layout has finished mounting.
    // This resolves the 'Attempted to navigate before mounting the Root Layout component' error
    // which occurs on slower devices.
    const timeout = setTimeout(() => {
      if (!isAuthenticated && !inAuthGroup) {
        router.replace('/(auth)/login');
      } else if (isAuthenticated && inAuthGroup) {
        router.replace('/(tabs)/dashboard');
      }
    }, 0);

    return () => clearTimeout(timeout);
  }, [isAuthenticated, _hasHydrated, segments, navigationState?.key]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}

