import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Theme } from '../constants/theme';

export default function Index() {
  const authHydrated = useAuthStore(state => state._hasHydrated);
  const appHydrated = useAppStore(state => state._hasHydrated);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  if (!authHydrated || !appHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.background }}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/dashboard" />;
  } else {
    return <Redirect href="/(auth)/login" />;
  }
}
