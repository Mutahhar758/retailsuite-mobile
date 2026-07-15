import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Safe wrapper to prevent crashes if native module is null
const safeAsyncStorage = {
  getItem: async (name: string) => {
    try { return await AsyncStorage.getItem(name); } 
    catch (e) { console.warn('AsyncStorage get failed:', e); return null; }
  },
  setItem: async (name: string, value: string) => {
    try { await AsyncStorage.setItem(name, value); } 
    catch (e) { console.warn('AsyncStorage set failed:', e); }
  },
  removeItem: async (name: string) => {
    try { await AsyncStorage.removeItem(name); } 
    catch (e) { console.warn('AsyncStorage remove failed:', e); }
  },
};

interface AuthState {
  isAuthenticated: boolean;
  user: any | null;
  token: string | null;
  refreshToken: string | null;
  permissions: string[];
  setPermissions: (permissions: string[]) => void;
  isBiometricEnabled: boolean;
  setBiometricEnabled: (enabled: boolean) => void;
  setTokens: (token: string, refreshToken: string) => void;
  login: (token: string, refreshToken: string, user: any) => void;
  logout: () => void;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  loadProfileAndPermissions: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      refreshToken: null,
      permissions: [],
      setPermissions: (permissions) => set({ permissions }),
      isBiometricEnabled: false,
      setBiometricEnabled: (enabled) => set({ isBiometricEnabled: enabled }),
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      login: (token, refreshToken, user) => set({ isAuthenticated: true, token, refreshToken, user }),
      logout: () => set({ isAuthenticated: false, token: null, refreshToken: null, user: null, permissions: [] }),
      loadProfileAndPermissions: async () => {
        const { token } = get();
        if (!token) return;
        const headers = { Authorization: `Bearer ${token}` };
        try {
          const [profileRes, permissionsRes] = await Promise.all([
            axios.get('https://retailer-api.bizgripsolutions.com/api/personal/profile', { headers }),
            axios.get('https://retailer-api.bizgripsolutions.com/api/personal/permissions', { headers })
          ]);
          const profile = profileRes.data?.body;
          const permissions = permissionsRes.data?.body || [];
          set({
            user: profile,
            permissions
          });
        } catch (error) {
          console.error('Failed to load profile and permissions:', error);
        }
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => safeAsyncStorage),
      onRehydrateStorage: () => (state, error) => {
        useAuthStore.setState({ _hasHydrated: true });
      },
    }
  )
);
