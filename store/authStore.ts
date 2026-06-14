import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  setTokens: (token: string, refreshToken: string) => void;
  login: (token: string, refreshToken: string, user: any) => void;
  logout: () => void;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      refreshToken: null,
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      login: (token, refreshToken, user) => set({ isAuthenticated: true, token, refreshToken, user }),
      logout: () => set({ isAuthenticated: false, token: null, refreshToken: null, user: null }),
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
