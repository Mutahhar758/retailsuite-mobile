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

export interface OrganizationLicense {
  licenseKey: string;
  tenantIdentifier: string;
  name: string;
}

interface AppState {
  licenses: OrganizationLicense[];
  currentTenantIdentifier: string | null;
  addLicense: (license: OrganizationLicense) => void;
  setCurrentTenant: (tenantId: string) => void;
  removeLicense: (licenseKey: string) => void;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      licenses: [],
      currentTenantIdentifier: null,
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
      
      addLicense: (license) => set((state) => {
        const exists = state.licenses.some(l => l.licenseKey === license.licenseKey);
        if (exists) return state;
        
        return { 
          licenses: [...state.licenses, license],
          currentTenantIdentifier: state.licenses.length === 0 ? license.tenantIdentifier : state.currentTenantIdentifier
        };
      }),
      setCurrentTenant: (tenantId) => set({ currentTenantIdentifier: tenantId }),
      removeLicense: (licenseKey) => set((state) => ({
        licenses: state.licenses.filter(l => l.licenseKey !== licenseKey),
        currentTenantIdentifier: state.currentTenantIdentifier && state.licenses.find(l => l.licenseKey === licenseKey)?.tenantIdentifier === state.currentTenantIdentifier 
          ? (state.licenses.find(l => l.licenseKey !== licenseKey)?.tenantIdentifier || null) 
          : state.currentTenantIdentifier
      })),
    }),
    {
      name: 'retail-mobile-storage',
      storage: createJSONStorage(() => safeAsyncStorage),
      onRehydrateStorage: () => (state, error) => {
        useAppStore.setState({ _hasHydrated: true });
      },
    }
  )
);
