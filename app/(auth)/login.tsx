import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Theme } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { AddLicenseModal } from '../../components/AddLicenseModal';
import api from '../../services/api';
import { BiometricService } from '../../services/biometricService';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);

  const { licenses, currentTenantIdentifier, setCurrentTenant } = useAppStore();
  const { login, isBiometricEnabled, setBiometricEnabled } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (licenses.length === 0) {
      setIsModalVisible(true);
    }
  }, [licenses.length]);

  const handleBiometricLogin = useCallback(async () => {
    const supported = await BiometricService.isSupported();
    if (!supported) return;

    const authenticated = await BiometricService.authenticate('Scan your fingerprint or face to log in');
    if (!authenticated) return;

    const credentials = await BiometricService.getCredentials();
    if (!credentials) {
      Alert.alert('Error', 'No stored biometric credentials found. Please sign in manually.');
      return;
    }

    setLoading(true);
    try {
      setCurrentTenant(credentials.tenantId);

      const response = await api.post('/api/auth/login', {
        login: credentials.username,
        loginType: 'Username',
        password: credentials.password
      });

      const body = response.data?.body || response.data;
      if (body && (body.token || body.accessToken)) {
        await BiometricService.saveCredentials(credentials.username, credentials.password, credentials.tenantId);
        login(body.token || body.accessToken, body.refreshToken, { email: credentials.username });
        router.replace('/(tabs)/dashboard');
      } else {
        Alert.alert('Error', 'Invalid response from server.');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.metadata?.message || error.message || 'Biometric login failed';
      Alert.alert('Biometric Login Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [setCurrentTenant, login, router]);

  useEffect(() => {
    const checkBiometricSupport = async () => {
      const supported = await BiometricService.isSupported();
      setIsBiometricSupported(supported);

      if (supported && isBiometricEnabled) {
        const timer = setTimeout(() => {
          handleBiometricLogin();
        }, 500);
        return () => clearTimeout(timer);
      }
    };
    checkBiometricSupport();
  }, [isBiometricEnabled, handleBiometricLogin]);

  const handleLogin = async () => {
    if (!currentTenantIdentifier) {
      Alert.alert('Organization Required', 'Please select an organization first.');
      return;
    }
    if (!username || !password) {
      Alert.alert('Validation Error', 'Please enter both username and password.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', {
        login: username,
        loginType: 'Username',
        password: password
      });

      const body = response.data?.body || response.data;
      if (body && (body.token || body.accessToken)) {
        login(body.token || body.accessToken, body.refreshToken, { email: username });

        if (isBiometricSupported && !isBiometricEnabled) {
          Alert.alert(
            'Enable Biometric Login',
            'Would you like to enable biometric (fingerprint/face) login for faster access next time?',
            [
              {
                text: 'Maybe Later',
                style: 'cancel',
                onPress: () => router.replace('/(tabs)/dashboard')
              },
              {
                text: 'Enable',
                onPress: async () => {
                  const saved = await BiometricService.saveCredentials(username, password, currentTenantIdentifier);
                  if (saved) {
                    setBiometricEnabled(true);
                    Alert.alert('Enabled', 'Biometric login has been enabled successfully.', [
                      { text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }
                    ]);
                  } else {
                    router.replace('/(tabs)/dashboard');
                  }
                }
              }
            ]
          );
        } else {
          if (isBiometricSupported && isBiometricEnabled) {
            await BiometricService.saveCredentials(username, password, currentTenantIdentifier);
          }
          router.replace('/(tabs)/dashboard');
        }
      } else {
        Alert.alert('Error', 'Invalid response from server.');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.metadata?.message || error.message || 'Login failed';
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.backgroundAccent} />
      <View style={styles.backgroundAccentTwo} />

      <Animated.View entering={FadeInUp.delay(200).duration(800)} style={styles.headerContainer}>
        <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Retail Portal</Text>
        <Text style={styles.subtitle}>Sign in to access your dashboard</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(400).duration(800)} style={styles.formContainer}>

        {/* Organization Picker */}
        <View style={styles.inputGroup}>
          <View style={styles.orgHeader}>
            <Text style={styles.label}>Organization</Text>
            <TouchableOpacity onPress={() => setIsModalVisible(true)}>
              <Text style={styles.addOrgText}>+ Add New</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={currentTenantIdentifier || undefined}
              onValueChange={(itemValue) => {
                if (itemValue) setCurrentTenant(itemValue);
              }}
              style={[styles.picker, { color: Theme.colors.text }]}
              enabled={licenses.length > 0}
              dropdownIconColor={Theme.colors.primary}
            >
              {licenses.length === 0 ? (
                <Picker.Item label="Select Organization" value={null} />
              ) : (
                licenses.map((lic) => (
                  <Picker.Item key={lic.tenantIdentifier} label={lic.name} value={lic.tenantIdentifier} />
                ))
              )}
            </Picker>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Username</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={20} color={Theme.colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="username"
              placeholderTextColor={Theme.colors.textSecondary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color={Theme.colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={Theme.colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color={Theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.forgotPassword}>
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </TouchableOpacity>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.button, { flex: 1 }]} onPress={handleLogin} disabled={loading || licenses.length === 0}>
            {loading ? (
              <ActivityIndicator color={Theme.colors.white} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {isBiometricSupported && isBiometricEnabled && (
            <TouchableOpacity 
              style={styles.biometricButton} 
              onPress={handleBiometricLogin}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Ionicons name="finger-print-outline" size={28} color={Theme.colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      <AddLicenseModal
        visible={isModalVisible}
        onClose={() => {
          const currentLicenses = useAppStore.getState().licenses;
          if (currentLicenses.length > 0) {
            setIsModalVisible(false);
          } else {
            Alert.alert('Required', 'You must add an organization to continue.');
          }
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    padding: 12,
  },
  backgroundAccent: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Theme.colors.primary,
    opacity: 0.1,
  },
  backgroundAccentTwo: {
    position: 'absolute',
    bottom: -50,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Theme.colors.secondary,
    opacity: 0.1,
  },
  headerContainer: {
    marginBottom: Theme.spacing.xxl,
    alignItems: 'center',
  },
  logo: {
    height: 80,
    width: 200,
    marginBottom: Theme.spacing.md,
  },
  title: {
    ...Theme.typography.h1,
    color: Theme.colors.text,
    marginBottom: Theme.spacing.sm,
  },
  subtitle: {
    ...Theme.typography.body,
    color: Theme.colors.textSecondary,
  },
  formContainer: {
    backgroundColor: Theme.colors.white,
    padding: Theme.spacing.md,
    borderRadius: Theme.radii.xl,
    ...Theme.shadows.md,
    width: '100%',
  },
  orgHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  addOrgText: {
    ...Theme.typography.caption,
    color: Theme.colors.primary,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: Theme.spacing.lg,
  },
  label: {
    ...Theme.typography.caption,
    color: Theme.colors.text,
    fontWeight: '600',
    ...(Platform.OS !== 'ios' ? { marginBottom: Theme.spacing.sm } : {}),
  },
  pickerWrapper: {
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
  },
  picker: {
    height: Platform.OS === 'ios' ? 120 : 50,
    width: '100%',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: Theme.spacing.md,
  },
  inputIcon: {
    marginRight: Theme.spacing.sm,
  },
  input: {
    flex: 1,
    height: 50,
    ...Theme.typography.body,
    color: Theme.colors.text,
  },
  eyeIcon: {
    padding: Theme.spacing.sm,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: Theme.spacing.xl,
  },
  forgotPasswordText: {
    ...Theme.typography.caption,
    color: Theme.colors.primary,
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    backgroundColor: Theme.colors.primary,
    height: 54,
    borderRadius: Theme.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.sm,
  },
  buttonText: {
    color: Theme.colors.white,
    ...Theme.typography.h3,
  },
  biometricButton: {
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.primary + '30',
    width: 54,
    height: 54,
    borderRadius: Theme.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Theme.spacing.md,
    ...Theme.shadows.sm,
  },
});
