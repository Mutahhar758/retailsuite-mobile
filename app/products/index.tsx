import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl, Image, TextInput, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { Theme } from '../../constants/theme';
import { inventoryService, Item } from '../../services/inventoryService';

export default function ProductsListScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Item[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const data = await inventoryService.getItems();
      setProducts(data);
    } catch (error) {
      console.error('Failed to fetch products', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, [fetchProducts])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchProducts();
  };

  const filteredProducts = products.filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(query) ||
      (item.barcode && item.barcode.toLowerCase().includes(query)) ||
      (item.itemKey && item.itemKey.toLowerCase().includes(query))
    );
  });

  const renderItem = ({ item, index }: { item: Item; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 30).duration(300)}>
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => router.push(`/products/${item.id}`)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.listAvatarContainer}>
            {item.mediaUrl ? (
              <Image source={{ uri: item.mediaUrl }} style={styles.listAvatarImage} />
            ) : (
              <Ionicons 
                name={item.itemType === 'Service' ? 'construct-outline' : 'cube-outline'} 
                size={22} 
                color={Theme.colors.textSecondary} 
              />
            )}
          </View>
          
          <View style={{ flex: 1, marginLeft: Theme.spacing.sm }}>
            <View style={styles.cardHeader}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <View style={[styles.typeBadge, { backgroundColor: item.itemType === 'Service' ? Theme.colors.secondary + '20' : Theme.colors.primary + '20' }]}>
                <Text style={[styles.typeText, { color: item.itemType === 'Service' ? Theme.colors.secondary : Theme.colors.primary }]}>
                  {item.itemType || 'Product'}
                </Text>
              </View>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.row}>
                <View style={styles.infoCol}>
                  <Text style={styles.labelText}>Category</Text>
                  <Text style={styles.valueText}>{item.itemCategoryTitle || item.itemCategoryCode}</Text>
                </View>
                <View style={styles.infoCol}>
                  <Text style={styles.labelText}>Rate</Text>
                  <Text style={styles.valueText}>
                    Rs. {item.priRate.toFixed(2)} {item.primaryUnit ? `/ ${item.primaryUnit}` : ''}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
        
        <View style={styles.cardFooter}>
          <Text style={styles.skuText}>{item.barcode ? `Barcode: ${item.barcode}` : item.itemKey ? `Key: ${item.itemKey}` : `ID: ${item.id}`}</Text>
          <Ionicons name="chevron-forward" size={16} color={Theme.colors.textSecondary} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={Theme.colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title, barcode, key..."
          placeholderTextColor={Theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={18} color={Theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={64} color={Theme.colors.border} />
              <Text style={styles.emptyText}>No products found.</Text>
            </View>
          }
        />
      )}

      <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.fabContainer}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/products/new')}
        >
          <Ionicons name="add" size={30} color={Theme.colors.white} />
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.white,
    marginHorizontal: Theme.spacing.md,
    marginTop: Theme.spacing.sm,
    marginBottom: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.sm,
    borderRadius: Theme.radii.md,
    height: 48,
    ...Theme.shadows.sm,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    ...Theme.typography.body,
    color: Theme.colors.text,
  },
  clearButton: {
    padding: 4,
  },
  listContainer: {
    padding: Theme.spacing.md,
    paddingBottom: 100, // Space for FAB
  },
  card: {
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radii.lg,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
    ...Theme.shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.xs,
  },
  title: {
    ...Theme.typography.h3,
    color: Theme.colors.text,
    flex: 1,
    marginRight: Theme.spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Theme.radii.sm,
  },
  typeText: {
    ...Theme.typography.small,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardBody: {
    marginBottom: Theme.spacing.sm,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoCol: {
    flex: 1,
  },
  labelText: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  valueText: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.text,
    fontWeight: '500',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Theme.colors.background,
    paddingTop: Theme.spacing.xs,
  },
  skuText: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Theme.spacing.xxl,
    marginTop: Theme.spacing.xxl,
  },
  emptyText: {
    ...Theme.typography.body,
    color: Theme.colors.textSecondary,
    marginTop: Theme.spacing.md,
  },
  fabContainer: {
    position: 'absolute',
    bottom: Theme.spacing.lg,
    right: Theme.spacing.lg,
  },
  fab: {
    backgroundColor: Theme.colors.primary,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.md,
  },
  listAvatarContainer: {
    width: 54,
    height: 54,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  listAvatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
});
