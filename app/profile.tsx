import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Switch, Platform, Modal, TextInput, ActivityIndicator } from 'react-native';
import { Theme } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BiometricService } from '../services/biometricService';
import api from '../services/api';

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { isBiometricEnabled, setBiometricEnabled } = useAuthStore();
  const { currentTenantIdentifier } = useAppStore();
  const router = useRouter();

  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);

  useEffect(() => {
    const checkBiometricSupport = async () => {
      const supported = await BiometricService.isSupported();
      setIsBiometricSupported(supported);
    };
    checkBiometricSupport();
  }, []);

  const handleToggleBiometrics = async (value: boolean) => {
    if (!value) {
      const cleared = await BiometricService.clearCredentials();
      if (cleared) {
        setBiometricEnabled(false);
        Alert.alert('Disabled', 'Biometric login has been disabled.');
      }
      return;
    }

    const supported = await BiometricService.isSupported();
    if (!supported) {
      Alert.alert('Not Supported', 'Biometrics (fingerprint/face recognition) are not available or not set up on this device.');
      return;
    }

    setVerifyPassword('');
    setPasswordModalVisible(true);
  };

  const handleVerifyPassword = async () => {
    if (!verifyPassword.trim()) {
      Alert.alert('Error', 'Please enter your password.');
      return;
    }

    setVerifyLoading(true);
    try {
      const username = user?.email;
      if (!username) {
        Alert.alert('Error', 'Unable to retrieve your username.');
        setVerifyLoading(false);
        return;
      }

      const response = await api.post('/api/auth/login', {
        login: username,
        loginType: 'Username',
        password: verifyPassword
      });

      const body = response.data?.body || response.data;
      if (body && (body.token || body.accessToken)) {
        const saved = await BiometricService.saveCredentials(username, verifyPassword, currentTenantIdentifier || '');
        if (saved) {
          setBiometricEnabled(true);
          setPasswordModalVisible(false);
          setVerifyPassword('');
          Alert.alert('Success', 'Biometric login has been enabled.');
        } else {
          Alert.alert('Error', 'Failed to securely save credentials.');
        }
      } else {
        Alert.alert('Error', 'Invalid response from server.');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.metadata?.message || error.message || 'Incorrect password';
      Alert.alert('Verification Failed', errorMessage);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: () => {
            logout();
            router.replace('/(auth)/login');
          }
        }
      ]
    );
  };

  const username = user?.email?.split('@')[0] || 'Admin';
  const email = user?.email || 'admin@example.com';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{username.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.nameText}>{username}</Text>
          <Text style={styles.emailText}>{email}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.iconWrapper, { backgroundColor: Theme.colors.primary + '15' }]}>
              <Ionicons name="person-outline" size={20} color={Theme.colors.primary} />
            </View>
            <Text style={styles.menuText}>Personal Information</Text>
            <Ionicons name="chevron-forward" size={20} color={Theme.colors.border} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.iconWrapper, { backgroundColor: Theme.colors.success + '15' }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Theme.colors.success} />
            </View>
            <Text style={styles.menuText}>Security</Text>
            <Ionicons name="chevron-forward" size={20} color={Theme.colors.border} />
          </TouchableOpacity>

          <View style={styles.menuItem}>
            <View style={[styles.iconWrapper, { backgroundColor: Theme.colors.primary + '15' }]}>
              <Ionicons name="finger-print-outline" size={20} color={Theme.colors.primary} />
            </View>
            <Text style={styles.menuText}>Biometric Login</Text>
            {isBiometricSupported ? (
              <Switch
                value={isBiometricEnabled}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: Theme.colors.border, true: Theme.colors.primary }}
                thumbColor={Platform.OS === 'ios' ? undefined : (isBiometricEnabled ? Theme.colors.white : Theme.colors.background)}
              />
            ) : (
              <Text style={styles.disabledText}>Not Supported</Text>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>

          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.iconWrapper, { backgroundColor: Theme.colors.warning + '15' }]}>
              <Ionicons name="notifications-outline" size={20} color={Theme.colors.warning} />
            </View>
            <Text style={styles.menuText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color={Theme.colors.border} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.iconWrapper, { backgroundColor: Theme.colors.secondary + '15' }]}>
              <Ionicons name="color-palette-outline" size={20} color={Theme.colors.secondary} />
            </View>
            <Text style={styles.menuText}>Appearance</Text>
            <Ionicons name="chevron-forward" size={20} color={Theme.colors.border} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={Theme.colors.danger} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.versionText}>Retail Suite v1.0.3</Text>

      </ScrollView>

      <Modal visible={passwordModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Password</Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)} disabled={verifyLoading}>
                <Ionicons name="close" size={24} color={Theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>Please enter your password to enable biometric login.</Text>

            <View style={styles.modalInputGroup}>
              <View style={styles.modalInputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={Theme.colors.textSecondary} style={styles.modalInputIcon} />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Password"
                  placeholderTextColor={Theme.colors.textSecondary}
                  value={verifyPassword}
                  onChangeText={setVerifyPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalCancelButton]} 
                onPress={() => setPasswordModalVisible(false)} 
                disabled={verifyLoading}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalButton} 
                onPress={handleVerifyPassword} 
                disabled={verifyLoading}
              >
                {verifyLoading ? (
                  <ActivityIndicator color={Theme.colors.white} />
                ) : (
                  <Text style={styles.modalButtonText}>Enable</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: Theme.spacing.md,
    paddingBottom: 40,
  },
  header: {
    marginBottom: Theme.spacing.xl,
    marginTop: Theme.spacing.md,
  },
  title: {
    ...Theme.typography.h1,
    color: Theme.colors.text,
  },
  profileCard: {
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radii.xl,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
    ...Theme.shadows.md,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    ...Theme.shadows.sm,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Theme.colors.white,
  },
  nameText: {
    ...Theme.typography.h2,
    color: Theme.colors.text,
    marginBottom: 4,
  },
  emailText: {
    ...Theme.typography.body,
    color: Theme.colors.textSecondary,
  },
  section: {
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radii.xl,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
    ...Theme.shadows.sm,
  },
  sectionTitle: {
    ...Theme.typography.small,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Theme.spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border + '50',
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.md,
  },
  menuText: {
    flex: 1,
    ...Theme.typography.bodyMedium,
    color: Theme.colors.text,
    fontWeight: '500',
  },
  logoutSection: {
    marginTop: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
  },
  logoutBtn: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.white,
    padding: Theme.spacing.lg,
    borderRadius: Theme.radii.xl,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.sm,
    borderWidth: 1,
    borderColor: Theme.colors.danger + '20',
  },
  logoutText: {
    ...Theme.typography.h3,
    color: Theme.colors.danger,
    marginLeft: Theme.spacing.sm,
  },
  versionText: {
    textAlign: 'center',
    color: Theme.colors.textSecondary,
    fontSize: 12,
    opacity: 0.6,
  },
  disabledText: {
    ...Theme.typography.small,
    color: Theme.colors.textSecondary,
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Theme.colors.glassDark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.md,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radii.lg,
    padding: Theme.spacing.md,
    ...Theme.shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  modalTitle: {
    ...Theme.typography.h3,
    color: Theme.colors.text,
  },
  modalSubtitle: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    marginBottom: Theme.spacing.md,
  },
  modalInputGroup: {
    marginBottom: Theme.spacing.lg,
  },
  modalInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: Theme.spacing.md,
  },
  modalInputIcon: {
    marginRight: Theme.spacing.sm,
  },
  modalInput: {
    flex: 1,
    height: 50,
    ...Theme.typography.body,
    color: Theme.colors.text,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Theme.spacing.md,
  },
  modalButton: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  modalCancelButton: {
    backgroundColor: Theme.colors.background,
  },
  modalButtonText: {
    color: Theme.colors.white,
    ...Theme.typography.bodyMedium,
  },
  modalCancelButtonText: {
    color: Theme.colors.textSecondary,
    ...Theme.typography.bodyMedium,
  },
});
