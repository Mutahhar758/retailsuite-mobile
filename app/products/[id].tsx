import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, Alert, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, Switch, Image
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { Theme } from '../../constants/theme';
import { inventoryService, InventoryItemUpsertRequest, Unit } from '../../services/inventoryService';
import { itemCategoryService, ItemCategoryDto } from '../../services/itemCategoryService';

export default function ProductFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isEdit = id && id !== 'new';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Lookups
  const [categories, setCategories] = useState<ItemCategoryDto[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // Form State
  const [itemType, setItemType] = useState('Product');
  const [barcode, setBarcode] = useState('');
  const [itemCategoryCode, setItemCategoryCode] = useState('');
  const [title, setTitle] = useState('');
  const [itemKey, setItemKey] = useState('');
  const [priRate, setPriRate] = useState('0');
  const [secRate, setSecRate] = useState('0');
  const [primaryUnit, setPrimaryUnit] = useState('');
  const [secondaryUnit, setSecondaryUnit] = useState('');
  const [defaultUnit, setDefaultUnit] = useState('');
  const [qtyInPack, setQtyInPack] = useState('1');
  const [alert, setAlert] = useState(false);
  const [lowStockAlert, setLowStockAlert] = useState(false);
  const [opnStock, setOpnStock] = useState('0');
  const [opnRate, setOpnRate] = useState('0');
  
  // Media State
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch Lookups
      const [categoriesData, unitsData] = await Promise.all([
        itemCategoryService.getActiveItemCategories(),
        inventoryService.getUnits()
      ]);
      setCategories(categoriesData);
      setUnits(unitsData);

      if (isEdit) {
        const details = await inventoryService.getById(id!);
        if (details) {
          setItemType(details.itemType || 'Product');
          setBarcode(details.barcode || '');
          setItemCategoryCode(details.itemCategoryCode || '');
          setTitle(details.title || '');
          setItemKey(details.itemKey || '');
          setPriRate((details.priRate ?? 0).toString());
          setSecRate((details.secRate ?? 0).toString());
          setPrimaryUnit(details.primaryUnit || '');
          setSecondaryUnit(details.secondaryUnit || '');
          setDefaultUnit(details.defaultUnit || '');
          setQtyInPack((details.qtyInPack ?? 1).toString());
          setAlert(details.alert ?? false);
          setLowStockAlert(details.lowStockAlert ?? false);
          setOpnStock((details.opnStock ?? 0).toString());
          setOpnRate((details.opnRate ?? 0).toString());
          setMediaId(details.mediaId || null);
          setImageUrl(details.mediaUrl || null);
        } else {
          Alert.alert('Error', 'Product not found.');
          router.back();
        }
      } else {
        // Set defaults for new item
        if (categoriesData.length > 0) {
          setItemCategoryCode(categoriesData[0].code);
        }
        if (unitsData.length > 0) {
          setPrimaryUnit(unitsData[0].code);
        }
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load initial form data.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera roll permissions to upload product media.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const pickedAsset = result.assets[0];
        const uriParts = pickedAsset.uri.split('/');
        const fileName = pickedAsset.fileName || uriParts[uriParts.length - 1] || 'product.jpg';
        await uploadImage(pickedAsset.uri, fileName);
      }
    } catch (error) {
      console.error('Failed to pick image', error);
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  const uploadImage = async (uri: string, name: string) => {
    setUploading(true);
    try {
      const { fileId, uploadUrl } = await inventoryService.getPresignedUploadUrl(name);
      
      const formData = new FormData();
      formData.append('File', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: name,
        type: 'image/jpeg',
      } as any);

      await axios.post(uploadUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setMediaId(fileId);
      setImageUrl(uri);
      Alert.alert('Success', 'Product image uploaded successfully.');
    } catch (error: any) {
      console.error('Failed to upload image', error);
      Alert.alert('Upload Error', 'Failed to upload product image to storage.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Product Title is required.');
      return;
    }
    if (!itemCategoryCode) {
      Alert.alert('Validation Error', 'Category is required.');
      return;
    }
    if (itemType !== 'Service' && !primaryUnit) {
      Alert.alert('Validation Error', 'Primary Unit is required.');
      return;
    }

    setSaving(true);
    try {
      const payload: InventoryItemUpsertRequest = {
        id: isEdit ? id : undefined,
        itemCategoryCode,
        barcode: itemType === 'Service' ? undefined : barcode || undefined,
        title,
        itemKey: itemKey || undefined,
        priRate: parseFloat(priRate) || 0,
        secRate: itemType === 'Service' ? 0 : parseFloat(secRate) || 0,
        primaryUnit: itemType === 'Service' ? (primaryUnit || 'Unit') : primaryUnit,
        secondaryUnit: itemType === 'Service' ? undefined : secondaryUnit || undefined,
        defaultUnit: itemType === 'Service' ? undefined : defaultUnit || undefined,
        qtyInPack: itemType === 'Service' ? undefined : parseFloat(qtyInPack) || 1,
        alert,
        lowStockAlert: itemType === 'Service' ? false : lowStockAlert,
        opnStock: itemType === 'Service' ? undefined : parseFloat(opnStock) || 0,
        opnRate: itemType === 'Service' ? undefined : parseFloat(opnRate) || 0,
        itemType,
        mediaId: mediaId || undefined
      };

      if (isEdit) {
        await inventoryService.update(id!, payload);
        Alert.alert('Success', 'Product updated successfully.', [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        await inventoryService.create(payload);
        Alert.alert('Success', 'Product created successfully.', [{ text: 'OK', onPress: () => router.back() }]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Product',
      'Are you sure you want to delete this product?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await inventoryService.delete(id!);
              Alert.alert('Success', 'Product deleted successfully.', [{ text: 'OK', onPress: () => router.back() }]);
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to delete product.');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          
          {itemType !== 'Service' && (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.avatarSection}>
              <TouchableOpacity onPress={pickImage} disabled={uploading} style={styles.avatarBtn}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    {uploading ? (
                      <ActivityIndicator size="small" color={Theme.colors.primary} />
                    ) : (
                      <Ionicons name="camera-outline" size={32} color={Theme.colors.textSecondary} />
                    )}
                  </View>
                )}
                {imageUrl && !uploading && (
                  <View style={styles.editIconBadge}>
                    <Ionicons name="pencil" size={12} color={Theme.colors.white} />
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.avatarText}>{uploading ? 'Uploading...' : imageUrl ? 'Change Product Image' : 'Upload Product Image'}</Text>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                <Text style={styles.label}>Type *</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={itemType}
                    onValueChange={(val) => setItemType(val)}
                    style={styles.picker}
                    enabled={!isEdit}
                  >
                    <Picker.Item label="Product" value="Product" />
                    <Picker.Item label="Service" value="Service" />
                  </Picker>
                </View>
              </View>
              
              {itemType !== 'Service' && (
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Barcode</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Scan or enter barcode"
                    value={barcode}
                    onChangeText={setBarcode}
                  />
                </View>
              )}
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                <Text style={styles.label}>Category *</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={itemCategoryCode}
                    onValueChange={(val) => setItemCategoryCode(val)}
                    style={styles.picker}
                  >
                    {categories.map(c => (
                      <Picker.Item key={c.code} label={c.title} value={c.code} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Search Key</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Quick search key"
                  value={itemKey}
                  onChangeText={setItemKey}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Product Title *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter full product name"
                value={title}
                onChangeText={setTitle}
              />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Pricing & Units</Text>
            
            {itemType !== 'Service' ? (
              <>
                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                    <Text style={styles.label}>Primary Unit *</Text>
                    <View style={styles.pickerWrapper}>
                      <Picker
                        selectedValue={primaryUnit}
                        onValueChange={(val) => setPrimaryUnit(val)}
                        style={styles.picker}
                      >
                        {units.map(u => (
                          <Picker.Item key={u.code} label={u.title} value={u.code} />
                        ))}
                      </Picker>
                    </View>
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Primary Rate (Rs.)</Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      value={priRate}
                      onChangeText={setPriRate}
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                    <Text style={styles.label}>Secondary Unit</Text>
                    <View style={styles.pickerWrapper}>
                      <Picker
                        selectedValue={secondaryUnit}
                        onValueChange={(val) => setSecondaryUnit(val)}
                        style={styles.picker}
                      >
                        <Picker.Item label="None" value="" />
                        {units.map(u => (
                          <Picker.Item key={u.code} label={u.title} value={u.code} />
                        ))}
                      </Picker>
                    </View>
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Secondary Rate (Rs.)</Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      value={secRate}
                      onChangeText={setSecRate}
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                    <Text style={styles.label}>Default Unit</Text>
                    <View style={styles.pickerWrapper}>
                      <Picker
                        selectedValue={defaultUnit}
                        onValueChange={(val) => setDefaultUnit(val)}
                        style={styles.picker}
                      >
                        <Picker.Item label="Automatic" value="" />
                        {units.map(u => (
                          <Picker.Item key={u.code} label={u.title} value={u.code} />
                        ))}
                      </Picker>
                    </View>
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Quantity in Pack</Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      value={qtyInPack}
                      onChangeText={setQtyInPack}
                    />
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Rate (Rs.) *</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={priRate}
                  onChangeText={setPriRate}
                />
              </View>
            )}
          </Animated.View>

          {itemType !== 'Service' && (
            <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.section}>
              <Text style={styles.sectionTitle}>Opening Stock</Text>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                  <Text style={styles.label}>Opening Quantity</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={opnStock}
                    onChangeText={setOpnStock}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Opening Rate (Rs.)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={opnRate}
                    onChangeText={setOpnRate}
                  />
                </View>
              </View>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Alerts</Text>
            
            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchLabel}>Enable Alerts</Text>
                <Text style={styles.switchDesc}>Enable transactions alert monitoring</Text>
              </View>
              <Switch
                value={alert}
                onValueChange={setAlert}
                trackColor={{ false: Theme.colors.border, true: Theme.colors.primary }}
                thumbColor={Theme.colors.white}
              />
            </View>

            {itemType !== 'Service' && (
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Low Stock Alert</Text>
                  <Text style={styles.switchDesc}>Alert when stock falls below limit</Text>
                </View>
                <Switch
                  value={lowStockAlert}
                  onValueChange={setLowStockAlert}
                  trackColor={{ false: Theme.colors.border, true: Theme.colors.primary }}
                  thumbColor={Theme.colors.white}
                />
              </View>
            )}
          </Animated.View>

        </ScrollView>

        <View style={styles.footer}>
          {isEdit && (
            <TouchableOpacity style={[styles.deleteBtn, { marginBottom: 8 }]} onPress={handleDelete} disabled={saving}>
              <Ionicons name="trash-outline" size={20} color={Theme.colors.danger} style={{ marginRight: 8 }} />
              <Text style={styles.deleteBtnText}>Delete Product</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={Theme.colors.white} /> : (
              <>
                <Ionicons name="save-outline" size={20} color={Theme.colors.white} style={{ marginRight: 8 }} />
                <Text style={styles.saveBtnText}>{isEdit ? 'Update Product' : 'Save Product'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Theme.spacing.md,
    paddingBottom: Theme.spacing.xxl,
  },
  section: {
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radii.lg,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    ...Theme.shadows.sm,
  },
  sectionTitle: {
    ...Theme.typography.h3,
    color: Theme.colors.text,
    marginBottom: Theme.spacing.md,
  },
  inputGroup: {
    marginBottom: Theme.spacing.md,
  },
  label: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    marginBottom: 6,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radii.sm,
    padding: Theme.spacing.sm,
    ...Theme.typography.body,
    backgroundColor: Theme.colors.background,
    height: 48,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pickerWrapper: {
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.radii.sm,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
    height: 48,
    justifyContent: 'center',
  },
  picker: {
    width: '100%',
    color: Theme.colors.text,
    backgroundColor: 'transparent',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border + '50',
  },
  switchLabel: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.text,
  },
  switchDesc: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  footer: {
    padding: Theme.spacing.md,
    backgroundColor: Theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
  },
  saveBtn: {
    height: 50,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radii.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.white,
    fontWeight: '700',
  },
  deleteBtn: {
    height: 50,
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radii.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.danger,
  },
  deleteBtnText: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.danger,
    fontWeight: '700',
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: Theme.spacing.md,
  },
  avatarBtn: {
    width: 120,
    height: 120,
    borderRadius: Theme.radii.md,
    borderWidth: 2,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: Theme.colors.white,
    position: 'relative',
    ...Theme.shadows.sm,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
  },
  editIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Theme.colors.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Theme.colors.white,
  },
  avatarText: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    marginTop: 8,
    fontWeight: '600',
  },
});
