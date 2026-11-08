import React, { useEffect, useState, useMemo } from 'react';
import { KeyboardAwareContainer } from '../../components/ui/KeyboardAwareContainer';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { Theme } from '../../constants/theme';
import { extractErrorMessage } from '../../services/api';
import {
  inventoryService,
  InventoryItemUpsertRequest,
  Unit,
  ItemCustomerCategoryPriceDto
} from '../../services/inventoryService';
import { itemCategoryService, ItemCategoryDto } from '../../services/itemCategoryService';
import { brandService, BrandLookupDto } from '../../services/brandService';
import { customerCategoryService, CustomerCategoryLookupResponse } from '../../services/customerCategoryService';
import { InlineSearchSelect } from '../../components/ui/InlineSearchSelect';
import { InlineBarcodeCameraStrip } from '../../components/ui/InlineBarcodeCameraStrip';
import { useKeyboard } from '../../hooks/useKeyboard';

export default function ProductFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isEdit = Boolean(id && id !== 'new');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Lookups
  const [categories, setCategories] = useState<ItemCategoryDto[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [brands, setBrands] = useState<BrandLookupDto[]>([]);
  const [customerCategories, setCustomerCategories] = useState<CustomerCategoryLookupResponse[]>([]);

  // Form State
  const [itemType, setItemType] = useState('Product');
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const { keyboardHeight, isKeyboardVisible } = useKeyboard();
  const [barcode, setBarcode] = useState('');
  const [itemCategoryCode, setItemCategoryCode] = useState('');
  const [itemCategoryTitle, setItemCategoryTitle] = useState('');
  const [brandId, setBrandId] = useState('');
  const [title, setTitle] = useState('');
  const [itemKey, setItemKey] = useState('');
  const [priRate, setPriRate] = useState('0');
  const [secRate, setSecRate] = useState('0');
  const [costRate, setCostRate] = useState('0');
  const [secCostRate, setSecCostRate] = useState('0');
  const [primaryUnit, setPrimaryUnit] = useState('');
  const [secondaryUnit, setSecondaryUnit] = useState('');
  const [defaultUnit, setDefaultUnit] = useState('');
  const [qtyInPack, setQtyInPack] = useState('1');
  const [quickQtyPresets, setQuickQtyPresets] = useState('');
  const [additionalUnits, setAdditionalUnits] = useState<string>('');
  const [requireImei, setRequireImei] = useState(false);
  const [alert, setAlert] = useState(false);
  const [lowStockAlert, setLowStockAlert] = useState(false);
  const [lowStockQty, setLowStockQty] = useState('0');
  const [minSalePrice, setMinSalePrice] = useState('');
  const [opnStock, setOpnStock] = useState('0');
  const [opnRate, setOpnRate] = useState('0');

  // Customer Category Custom Prices map: { [categoryCode]: { priRate: string, secRate: string } }
  const [catRateInputs, setCatRateInputs] = useState<Record<string, { priRate: string; secRate: string }>>({});

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
      const [categoriesData, unitsData, brandsData, custCatsData] = await Promise.all([
        itemCategoryService.getActiveItemCategoriesLookup(),
        inventoryService.getUnitsLookup(),
        brandService.getActiveBrands().catch(() => []),
        customerCategoryService.getLookup().catch(() => [])
      ]);
      setCategories(categoriesData);
      setUnits(unitsData);
      setBrands(brandsData);
      setCustomerCategories(custCatsData);

      if (isEdit) {
        const [details, existingCatPrices] = await Promise.all([
          inventoryService.getById(id!),
          inventoryService.getItemCategoryPrices(id!).catch(() => [])
        ]);

        if (details) {
          setItemType(details.itemType || 'Product');
          setBarcode(details.barcode || '');
          setItemCategoryCode(details.itemCategoryCode || '');
          setItemCategoryTitle(details.itemCategoryTitle || '');
          setBrandId(details.brandId || '');
          setTitle(details.title || '');
          setItemKey(details.itemKey || '');
          setPriRate((details.priRate ?? 0).toString());
          setSecRate((details.secRate ?? 0).toString());
          setCostRate((details.costRate ?? 0).toString());
          setSecCostRate((details.secCostRate ?? 0).toString());
          setPrimaryUnit(details.primaryUnit || '');
          setSecondaryUnit(details.secondaryUnit || '');
          setDefaultUnit(details.defaultUnit || '');
          setQtyInPack((details.qtyInPack ?? 1).toString());
          setQuickQtyPresets(details.quickQtyPresets || '');
          setAdditionalUnits(details.additionalUnits || '');
          setRequireImei(details.requireImei ?? false);
          setAlert(details.alert ?? false);
          setLowStockAlert(details.lowStockAlert ?? false);
          setLowStockQty((details.lowStockQty ?? 0).toString());
          setMinSalePrice(details.minSalePrice != null ? details.minSalePrice.toString() : '');
          setOpnStock((details.opnStock ?? 0).toString());
          setOpnRate((details.opnRate ?? 0).toString());
          setMediaId(details.mediaId || null);
          setImageUrl(details.mediaUrl || null);

          const priceList = (existingCatPrices && existingCatPrices.length > 0)
            ? existingCatPrices
            : (details.customerCategoryPrices || []);
          const rateMap: Record<string, { priRate: string; secRate: string }> = {};
          priceList.forEach(cp => {
            rateMap[cp.customerCategoryId] = {
              priRate: cp.priRate != null ? String(cp.priRate) : '',
              secRate: cp.secRate != null ? String(cp.secRate) : ''
            };
          });
          setCatRateInputs(rateMap);
        } else {
          Alert.alert('Error', 'Product not found.');
          router.back();
        }
      } else {
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

  const updateCategoryRateInput = (catCode: string, field: 'priRate' | 'secRate', val: string) => {
    setCatRateInputs(prev => ({
      ...prev,
      [catCode]: {
        priRate: field === 'priRate' ? val : (prev[catCode]?.priRate || ''),
        secRate: field === 'secRate' ? val : (prev[catCode]?.secRate || '')
      }
    }));
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
      const customerCategoryPrices: ItemCustomerCategoryPriceDto[] = customerCategories
        .map(cat => {
          const entry = catRateInputs[cat.code];
          const p = entry?.priRate ? parseFloat(entry.priRate) : 0;
          const s = entry?.secRate ? parseFloat(entry.secRate) : null;
          if (!p && !s) return null;
          return {
            itemId: isEdit ? id : undefined,
            customerCategoryId: cat.code,
            customerCategoryTitle: cat.title,
            priRate: p || 0,
            secRate: s
          };
        })
        .filter(Boolean) as ItemCustomerCategoryPriceDto[];

      const payload: InventoryItemUpsertRequest = {
        id: isEdit ? id : undefined,
        itemCategoryCode,
        brandId: brandId || null,
        barcode: itemType === 'Service' ? undefined : barcode || undefined,
        title,
        itemKey: itemKey || undefined,
        priRate: parseFloat(priRate) || 0,
        secRate: itemType === 'Service' ? 0 : parseFloat(secRate) || 0,
        costRate: itemType === 'Service' ? 0 : parseFloat(costRate) || 0,
        secCostRate: itemType === 'Service' ? 0 : parseFloat(secCostRate) || 0,
        primaryUnit: itemType === 'Service' ? (primaryUnit || 'Unit') : primaryUnit,
        secondaryUnit: itemType === 'Service' ? undefined : secondaryUnit || undefined,
        defaultUnit: itemType === 'Service' ? undefined : defaultUnit || undefined,
        qtyInPack: itemType === 'Service' ? undefined : parseFloat(qtyInPack) || 1,
        quickQtyPresets: quickQtyPresets.trim() || null,
        additionalUnits: additionalUnits || null,
        requireImei: itemType === 'Service' ? false : requireImei,
        alert,
        lowStockAlert: itemType === 'Service' ? false : lowStockAlert,
        lowStockQty: itemType === 'Service' || !lowStockAlert ? undefined : (parseFloat(lowStockQty) || 0),
        minSalePrice: minSalePrice ? (parseFloat(minSalePrice) || 0) : null,
        opnStock: itemType === 'Service' ? undefined : parseFloat(opnStock) || 0,
        opnRate: itemType === 'Service' ? undefined : parseFloat(opnRate) || 0,
        itemType,
        mediaId: mediaId || undefined,
        customerCategoryPrices
      };

      if (isEdit) {
        await inventoryService.update(id!, payload);
        if (customerCategories.length > 0) {
          await inventoryService.saveItemCategoryPrices(id!, customerCategoryPrices).catch(() => {});
        }
        Alert.alert('Success', 'Product updated successfully.', [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        await inventoryService.create(payload);
        Alert.alert('Success', 'Product created successfully.', [{ text: 'OK', onPress: () => router.back() }]);
      }
    } catch (error: any) {
      console.error('Failed to save product:', error?.response?.data || error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to save product.'));
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
              console.error('Failed to delete product:', error?.response?.data || error);
              Alert.alert('Error', extractErrorMessage(error, 'Failed to delete product.'));
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  const categoryOptions = useMemo(() => categories.map(c => ({
    value: c.code,
    label: c.title,
    subtitle: `Code: ${c.code}`
  })), [categories]);

  const brandOptions = useMemo(() => brands.map(b => ({
    value: b.id,
    label: b.title
  })), [brands]);

  const unitOptions = useMemo(() => units.map(u => ({
    value: u.code,
    label: u.title,
    subtitle: u.code
  })), [units]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAwareContainer
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        style={styles.container}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: isKeyboardVisible ? 24 : 40 },
          ]}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >

          {itemType !== 'Service' && (
            <Animated.View entering={FadeInDown.duration(350)} style={styles.avatarSection}>
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

          <Animated.View entering={FadeInDown.duration(350)} style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                <Text style={styles.label}>Type *</Text>
                <View style={styles.segmentContainer}>
                  {(['Product', 'Service'] as const).map(t => (
                    <TouchableOpacity
                      key={t}
                      disabled={isEdit}
                      style={[styles.segmentBtn, itemType === t && styles.segmentBtnActive]}
                      onPress={() => setItemType(t)}
                    >
                      <Text style={[styles.segmentText, itemType === t && styles.segmentTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {itemType !== 'Service' && (
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Barcode</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      placeholder="Scan or enter"
                      placeholderTextColor={Theme.colors.textSecondary}
                      value={barcode}
                      onChangeText={setBarcode}
                    />
                    <TouchableOpacity
                      style={{
                        height: 44,
                        width: 42,
                        borderRadius: 10,
                        backgroundColor: barcodeScannerOpen ? Theme.colors.primary : '#EEF2FF',
                        borderWidth: 1,
                        borderColor: barcodeScannerOpen ? Theme.colors.primary : '#C7D2FE',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onPress={() => setBarcodeScannerOpen((prev) => !prev)}
                    >
                      <Ionicons
                        name={barcodeScannerOpen ? 'camera' : 'camera-outline'}
                        size={19}
                        color={barcodeScannerOpen ? '#FFFFFF' : Theme.colors.primary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {itemType !== 'Service' && (
              <View style={{ marginBottom: barcodeScannerOpen ? 12 : 0 }}>
                <InlineBarcodeCameraStrip
                  visible={barcodeScannerOpen}
                  onClose={() => setBarcodeScannerOpen(false)}
                  onBarcodeScanned={(code) => {
                    setBarcode(code);
                    setBarcodeScannerOpen(false);
                  }}
                  defaultContinuous={false}
                  showMultipliers={false}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Product Title *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter full product name"
                placeholderTextColor={Theme.colors.textSecondary}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View style={styles.inputGroup}>
              <InlineSearchSelect
                label="Category *"
                options={categoryOptions}
                value={itemCategoryCode}
                displayValue={itemCategoryTitle || categoryOptions.find(c => c.value === itemCategoryCode)?.label}
                onSelect={(val, opt) => {
                  setItemCategoryCode(val);
                  setItemCategoryTitle(opt?.label || opt?.title || '');
                }}
                placeholder="Select Category..."
                icon="folder-outline"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                <InlineSearchSelect
                  label="Brand"
                  options={brandOptions}
                  value={brandId}
                  onSelect={setBrandId}
                  placeholder="Optional Brand..."
                  clearable
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Search Key</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Quick search key"
                  placeholderTextColor={Theme.colors.textSecondary}
                  value={itemKey}
                  onChangeText={setItemKey}
                />
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150).duration(350)} style={styles.section}>
            <Text style={styles.sectionTitle}>Pricing, Cost & Units</Text>

            {itemType !== 'Service' ? (
              <>
                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                    <InlineSearchSelect
                      label="Primary Unit *"
                      options={unitOptions}
                      value={primaryUnit}
                      onSelect={setPrimaryUnit}
                      placeholder="Select Unit..."
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Primary Sale Rate (Rs.)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0.00"
                      placeholderTextColor={Theme.colors.textSecondary}
                      keyboardType="numeric"
                      value={priRate}
                      onChangeText={setPriRate}
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                    <InlineSearchSelect
                      label="Secondary Unit"
                      options={unitOptions}
                      value={secondaryUnit}
                      onSelect={setSecondaryUnit}
                      placeholder="None"
                      clearable
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Secondary Sale Rate (Rs.)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0.00"
                      placeholderTextColor={Theme.colors.textSecondary}
                      keyboardType="numeric"
                      value={secRate}
                      onChangeText={setSecRate}
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                    <Text style={styles.label}>Primary Cost Rate (Rs.)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0.00"
                      placeholderTextColor={Theme.colors.textSecondary}
                      keyboardType="numeric"
                      value={costRate}
                      onChangeText={setCostRate}
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Secondary Cost Rate (Rs.)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0.00"
                      placeholderTextColor={Theme.colors.textSecondary}
                      keyboardType="numeric"
                      value={secCostRate}
                      onChangeText={setSecCostRate}
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                    <InlineSearchSelect
                      label="Default Unit"
                      options={unitOptions}
                      value={defaultUnit}
                      onSelect={setDefaultUnit}
                      placeholder="Automatic"
                      clearable
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Quantity in Pack</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="1"
                      placeholderTextColor={Theme.colors.textSecondary}
                      keyboardType="numeric"
                      value={qtyInPack}
                      onChangeText={setQtyInPack}
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                    <Text style={styles.label}>Minimum Sale Price (Rs.)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Optional min price cap"
                      placeholderTextColor={Theme.colors.textSecondary}
                      keyboardType="numeric"
                      value={minSalePrice}
                      onChangeText={setMinSalePrice}
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Quick Qty Presets</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. 0.25, 0.5, 1, 5"
                      placeholderTextColor={Theme.colors.textSecondary}
                      value={quickQtyPresets}
                      onChangeText={setQuickQtyPresets}
                    />
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Rate (Rs.) *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0.00"
                  placeholderTextColor={Theme.colors.textSecondary}
                  keyboardType="numeric"
                  value={priRate}
                  onChangeText={setPriRate}
                />
              </View>
            )}
          </Animated.View>

          {/* Customer Category Custom Pricing Section */}
          {customerCategories.length > 0 && (
            <Animated.View entering={FadeInDown.delay(220).duration(350)} style={styles.section}>
              <Text style={styles.sectionTitle}>Customer Category Custom Rates</Text>
              <Text style={styles.sectionSubtitle}>
                Override sale rates for specific customer tiers (leave blank to use default rate)
              </Text>
              {customerCategories.map(cat => (
                <View key={cat.code} style={styles.catPriceRow}>
                  <View style={{ flex: 1.2, paddingRight: 8 }}>
                    <Text style={styles.catPriceTitle}>{cat.title}</Text>
                    <Text style={styles.catPriceCode}>{cat.code}</Text>
                  </View>
                  <View style={{ flex: 1, marginRight: 6 }}>
                    <Text style={styles.catPriceLabel}>Primary Rate</Text>
                    <TextInput
                      style={styles.catPriceInput}
                      keyboardType="numeric"
                      placeholder={priRate || '0'}
                      placeholderTextColor={Theme.colors.textSecondary}
                      value={catRateInputs[cat.code]?.priRate || ''}
                      onChangeText={(val) => updateCategoryRateInput(cat.code, 'priRate', val)}
                      selectTextOnFocus
                    />
                  </View>
                  {itemType !== 'Service' && (
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catPriceLabel}>Sec Rate</Text>
                      <TextInput
                        style={styles.catPriceInput}
                        keyboardType="numeric"
                        placeholder={secRate || '0'}
                        placeholderTextColor={Theme.colors.textSecondary}
                        value={catRateInputs[cat.code]?.secRate || ''}
                        onChangeText={(val) => updateCategoryRateInput(cat.code, 'secRate', val)}
                        selectTextOnFocus
                      />
                    </View>
                  )}
                </View>
              ))}
            </Animated.View>
          )}

          {itemType !== 'Service' && (
            <Animated.View entering={FadeInDown.delay(300).duration(350)} style={styles.section}>
              <Text style={styles.sectionTitle}>Opening Stock</Text>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                  <Text style={styles.label}>Opening Quantity</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0.00"
                    placeholderTextColor={Theme.colors.textSecondary}
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
                    placeholderTextColor={Theme.colors.textSecondary}
                    keyboardType="numeric"
                    value={opnRate}
                    onChangeText={setOpnRate}
                  />
                </View>
              </View>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(350).duration(350)} style={styles.section}>
            <Text style={styles.sectionTitle}>Options & Alerts</Text>

            {itemType !== 'Service' && (
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Require IMEI / Serial #</Text>
                  <Text style={styles.switchDesc}>Prompt for IMEI/Serial on sale & purchase</Text>
                </View>
                <Switch
                  value={requireImei}
                  onValueChange={setRequireImei}
                  trackColor={{ false: Theme.colors.border, true: Theme.colors.primary }}
                  thumbColor={Theme.colors.white}
                />
              </View>
            )}

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
              <>
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

                {lowStockAlert && (
                  <View style={[styles.inputGroup, { marginTop: Theme.spacing.sm }]}>
                    <Text style={styles.label}>Low Stock Quantity Threshold</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="0.00"
                      placeholderTextColor={Theme.colors.textSecondary}
                      keyboardType="numeric"
                      value={lowStockQty}
                      onChangeText={setLowStockQty}
                    />
                  </View>
                )}
              </>
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

      </KeyboardAwareContainer>
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
    marginBottom: 4,
  },
  sectionSubtitle: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    marginBottom: Theme.spacing.sm,
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
    height: 44,
    color: Theme.colors.text,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.radii.sm,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    height: 44,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: Theme.colors.primary,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  segmentTextActive: {
    color: Theme.colors.white,
  },
  catPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border + '50',
  },
  catPriceTitle: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.text,
    fontWeight: '600',
  },
  catPriceCode: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
  },
  catPriceLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
    marginBottom: 2,
  },
  catPriceInput: {
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 36,
    fontSize: 13,
    color: Theme.colors.text,
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
