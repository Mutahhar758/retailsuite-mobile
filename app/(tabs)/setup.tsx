import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Theme } from '../../constants/theme';

export default function SetupScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
          <Text style={styles.title}>Setup</Text>
          <Text style={styles.subtitle}>System configuration and masters</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(600)}>
          <TouchableOpacity 
            style={styles.card}
            onPress={() => router.push('/customers')}
          >
            <View style={[styles.iconContainer, { backgroundColor: Theme.colors.secondary + '20' }]}>
              <Ionicons name="people-outline" size={32} color={Theme.colors.secondary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Customers</Text>
              <Text style={styles.cardDesc}>Manage your customer accounts</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Theme.colors.textSecondary} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(600)}>
          <TouchableOpacity 
            style={styles.card}
            onPress={() => router.push('/vendors')}
          >
            <View style={[styles.iconContainer, { backgroundColor: Theme.colors.primary + '20' }]}>
              <Ionicons name="business-outline" size={32} color={Theme.colors.primary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Vendors</Text>
              <Text style={styles.cardDesc}>Manage your vendor accounts</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Theme.colors.textSecondary} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(600)}>
          <TouchableOpacity 
            style={styles.card}
            onPress={() => router.push('/products')}
          >
            <View style={[styles.iconContainer, { backgroundColor: Theme.colors.secondary + '20' }]}>
              <Ionicons name="cube-outline" size={32} color={Theme.colors.secondary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Products</Text>
              <Text style={styles.cardDesc}>Manage your product catalog</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Theme.colors.textSecondary} />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    padding: Theme.spacing.md,
  },
  header: {
    marginBottom: Theme.spacing.xl,
    marginTop: Theme.spacing.md,
  },
  title: {
    ...Theme.typography.h1,
    color: Theme.colors.text,
  },
  subtitle: {
    ...Theme.typography.body,
    color: Theme.colors.textSecondary,
    marginTop: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.white,
    padding: Theme.spacing.md,
    borderRadius: Theme.radii.lg,
    marginBottom: Theme.spacing.md,
    ...Theme.shadows.sm,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: Theme.spacing.md,
  },
  cardTitle: {
    ...Theme.typography.h3,
    color: Theme.colors.text,
  },
  cardDesc: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
});
