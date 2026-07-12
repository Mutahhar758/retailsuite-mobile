import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_USERNAME_KEY = 'rs_bio_username';
const BIOMETRIC_PASSWORD_KEY = 'rs_bio_password';
const BIOMETRIC_TENANT_KEY = 'rs_bio_tenant';

export const BiometricService = {
  /**
   * Check if the device has biometric hardware capability.
   */
  async hasHardware(): Promise<boolean> {
    try {
      return await LocalAuthentication.hasHardwareAsync();
    } catch (error) {
      console.error('Error checking biometric hardware:', error);
      return false;
    }
  },

  /**
   * Check if biometrics are enrolled on the device.
   */
  async isEnrolled(): Promise<boolean> {
    try {
      return await LocalAuthentication.isEnrolledAsync();
    } catch (error) {
      console.error('Error checking biometric enrollment:', error);
      return false;
    }
  },

  /**
   * Check if biometric authentication is fully supported and enrolled.
   */
  async isSupported(): Promise<boolean> {
    const hasHardware = await this.hasHardware();
    const isEnrolled = await this.isEnrolled();
    return hasHardware && isEnrolled;
  },

  /**
   * Trigger the biometric authentication prompt.
   * @param reason The reason text shown to the user on iOS.
   */
  async authenticate(reason: string = 'Scan your fingerprint or use Face ID to sign in'): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        cancelLabel: 'Use Password',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: true, // We want the user to fallback to password input manually on our login page if needed
      });
      return result.success;
    } catch (error) {
      console.error('Error during biometric authentication:', error);
      return false;
    }
  },

  /**
   * Securely store user credentials.
   */
  async saveCredentials(username: string, password: string, tenantId: string): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(BIOMETRIC_USERNAME_KEY, username);
      await SecureStore.setItemAsync(BIOMETRIC_PASSWORD_KEY, password);
      await SecureStore.setItemAsync(BIOMETRIC_TENANT_KEY, tenantId);
      return true;
    } catch (error) {
      console.error('Error saving credentials to SecureStore:', error);
      return false;
    }
  },

  /**
   * Retrieve securely stored credentials.
   */
  async getCredentials() {
    try {
      const username = await SecureStore.getItemAsync(BIOMETRIC_USERNAME_KEY);
      const password = await SecureStore.getItemAsync(BIOMETRIC_PASSWORD_KEY);
      const tenantId = await SecureStore.getItemAsync(BIOMETRIC_TENANT_KEY);

      if (username && password && tenantId) {
        return { username, password, tenantId };
      }
      return null;
    } catch (error) {
      console.error('Error retrieving credentials from SecureStore:', error);
      return null;
    }
  },

  /**
   * Clear securely stored credentials.
   */
  async clearCredentials(): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_USERNAME_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_PASSWORD_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_TENANT_KEY);
      return true;
    } catch (error) {
      console.error('Error clearing credentials from SecureStore:', error);
      return false;
    }
  }
};
