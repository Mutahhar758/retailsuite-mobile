import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Theme } from '../constants/theme';

export default function Index() {
  const authHydrated = useAuthStore(state => state._hasHydrated);
  const appHydrated = useAppStore(state => state._hasHydrated);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const router = useRouter();

  useEffect(() => {
    if (authHydrated && appHydrated) {
      if (isAuthenticated) {
        router.replace('/(tabs)/dashboard');
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [authHydrated, appHydrated, isAuthenticated, router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.background }}>
      <ActivityIndicator size="large" color={Theme.colors.primary} />
    </View>
  );
}
