import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { Theme } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const router = useRouter();

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
  }
});
