import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Theme } from '../../constants/theme';

export default function DataEntryScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
          <Text style={styles.title}>Data Entry</Text>
          <Text style={styles.subtitle}>Manage your daily entries</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(600)}>
          <TouchableOpacity 
            style={styles.card}
            onPress={() => router.push('/receipts')}
          >
            <View style={[styles.iconContainer, { backgroundColor: Theme.colors.primary + '20' }]}>
              <Ionicons name="document-text-outline" size={32} color={Theme.colors.primary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Receipt</Text>
              <Text style={styles.cardDesc}>View and manage cash or bank receipts</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.card}
            onPress={() => router.push('/receipts/bulk')}
          >
            <View style={[styles.iconContainer, { backgroundColor: Theme.colors.success + '20' }]}>
              <Ionicons name="documents-outline" size={32} color={Theme.colors.success} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Bulk Receipt</Text>
              <Text style={styles.cardDesc}>Create receipts for multiple customers at once</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.card}
            onPress={() => router.push('/sale-supplies')}
          >
            <View style={[styles.iconContainer, { backgroundColor: Theme.colors.warning + '20' }]}>
              <Ionicons name="car-outline" size={32} color={Theme.colors.warning} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Sale Supply</Text>
              <Text style={styles.cardDesc}>Supply items to multiple customers</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.card, { opacity: 0.6 }]}
            onPress={() => {}}
            disabled={true}
          >
            <View style={[styles.iconContainer, { backgroundColor: Theme.colors.danger + '20' }]}>
              <Ionicons name="wallet-outline" size={32} color={Theme.colors.danger} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Payment</Text>
              <Text style={styles.cardDesc}>Manage payments (Coming soon)</Text>
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
