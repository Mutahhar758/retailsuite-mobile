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
  customerService,
  CustomerCreateRequest,
  CustomerUpdateRequest,
  CustomerResponse,
  CustomerSupplyItemDto
} from '../../services/customerService';
import { customerCategoryService, CustomerCategoryLookupResponse } from '../../services/customerCategoryService';
import { inventoryService, Item } from '../../services/inventoryService';
import { InlineSearchSelect } from '../../components/ui/InlineSearchSelect';
import { useKeyboard } from '../../hooks/useKeyboard';

export default function CustomerFormScreen() {
  const { account } = useLocalSearchParams<{ account: string }>();
  const router = useRouter();
  const isEdit = Boolean(account && account !== 'new');

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const { keyboardHeight, isKeyboardVisible } = useKeyboard();

  // Lookups
  const [allCustomers, setAllCustomers] = useState<CustomerResponse[]>([]);
  const [customerCategories, setCustomerCategories] = useState<CustomerCategoryLookupResponse[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  // Form State
  const [title, setTitle] = useState('');
  const [customerCategoryId, setCustomerCategoryId] = useState<string>('');
  const [customerCategoryTitle, setCustomerCategoryTitle] = useState<string>('');
  const [email, setEmail] = useState('');
  const [phone1, setPhone1] = useState('');
  const [phone2, setPhone2] = useState('');
  const [address, setAddress] = useState('');
  const [qualification, setQualification] = useState('');
  const [cnic, setCnic] = useState('');
  const [fax, setFax] = useState('');
  const [smsNumber, setSmsNumber] = useState('');
  const [iban, setIban] = useState('');
  const [active, setActive] = useState(true);
  const [smsAlert, setSmsAlert] = useState(false);
  const [emailAlert, setEmailAlert] = useState(false);
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Sub-Account State
  const [isSubAccount, setIsSubAccount] = useState(false);
  const [parentCustomerAccountId, setParentCustomerAccountId] = useState<string>('');

  // Default Supply Items
  const [supplyItems, setSupplyItems] = useState<CustomerSupplyItemDto[]>([]);

  useEffect(() => {
    loadLookups();
    if (isEdit) {
      loadCustomerDetails();
    }
  }, [isEdit]);

  const loadLookups = async () => {
    try {
      const [custRes, catRes, itemRes] = await Promise.all([
        customerService.getCustomers().catch(() => []),
        customerCategoryService.getLookup().catch(() => []),
        inventoryService.getItemsLookup().catch(() => [])
      ]);
      setAllCustomers(custRes || []);
      setCustomerCategories(catRes || []);
      setItems(itemRes || []);
    } catch (err) {
      console.warn('Failed to load customer form lookups', err);
    }
  };

  const loadCustomerDetails = async () => {
    try {
      const [details, custSupplyItems] = await Promise.all([
        customerService.getDetail(account!),
        customerService.getSupplyItems({ customerAccountId: account! }).catch(() => [])
      ]);

      if (details) {
        setTitle(details.title || '');
        setCustomerCategoryId(details.customerCategoryId || '');
        setCustomerCategoryTitle(details.customerCategoryTitle || '');
        setEmail(details.email || '');
        setPhone1(details.phone1 || '');
        setPhone2(details.phone2 || '');
        setAddress(details.address || '');
        setQualification(details.qualification || '');
        setCnic(details.cnic || '');
        setFax(details.fax || '');
        setSmsNumber(details.smsNumber || '');
        setIban(details.iban || '');
        setActive(details.active ?? true);
        setSmsAlert(details.smsAlert ?? false);
        setEmailAlert(details.emailAlert ?? false);
        setMediaId(details.mediaId || null);
        setImageUrl(details.mediaUrl || null);
        setIsSubAccount(Boolean(details.isSubAccount || details.parentCustomerAccountId));
        setParentCustomerAccountId(details.parentCustomerAccountId || '');
        setSupplyItems(
          custSupplyItems && custSupplyItems.length > 0
            ? custSupplyItems
            : (details.supplyItems || [])
        );
      } else {
        Alert.alert('Error', 'Customer not found.');
        router.back();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load customer details.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera roll permissions to upload an avatar.');
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
        const fileName = pickedAsset.fileName || uriParts[uriParts.length - 1] || 'avatar.jpg';
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
      const { fileId, uploadUrl } = await customerService.getPresignedUploadUrl(name);

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
      Alert.alert('Success', 'Avatar uploaded successfully.');
    } catch (error: any) {
      console.error('Failed to upload image', error);
      Alert.alert('Upload Error', 'Failed to upload avatar image to storage.');
    } finally {
      setUploading(false);
    }
  };

  const handleAddSupplyItem = (selectedItemId: string) => {
    if (!selectedItemId) return;
    if (supplyItems.some(s => s.itemId === selectedItemId)) {
      Alert.alert('Duplicate Item', 'This item is already in the customer default supply list.');
      return;
    }
    const found = items.find(i => i.id === selectedItemId);
    setSupplyItems(prev => [
      ...prev,
      {
        customerAccountId: isEdit ? account : undefined,
        itemId: selectedItemId,
        itemTitle: found?.title || selectedItemId,
        qty: 1,
        secQty: 0,
        rate: found?.priRate ?? undefined,
        discount: 0,
        carriage: 0,
        addLess: 0
      }
    ]);
  };

  const handleUpdateSupplyItem = (itemId: string, field: keyof CustomerSupplyItemDto, rawVal: string) => {
    setSupplyItems(prev =>
      prev.map(row => {
        if (row.itemId !== itemId) return row;
        if (rawVal === '') {
          return { ...row, [field]: field === 'qty' ? 0 : undefined };
        }
        const num = parseFloat(rawVal);
        return { ...row, [field]: isNaN(num) ? 0 : num };
      })
    );
  };

  const handleRemoveSupplyItem = (itemId: string) => {
    setSupplyItems(prev => prev.filter(s => s.itemId !== itemId));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Customer Name is required.');
      return;
    }

    if (isSubAccount && !parentCustomerAccountId) {
      Alert.alert('Validation Error', 'Please select a Main Customer Account for this sub-account.');
      return;
    }

    setSaving(true);
    try {
      const sanitizedSupplyItems = supplyItems
        .filter(s => s.itemId && (Number(s.qty) || 0) > 0)
        .map(s => ({
          customerAccountId: isEdit ? account : undefined,
          itemId: s.itemId,
          qty: Number(s.qty) || 1,
          secQty: s.secQty != null ? Number(s.secQty) : undefined,
          rate: s.rate != null ? Number(s.rate) : undefined,
          discount: s.discount != null ? Number(s.discount) : undefined,
          carriage: s.carriage != null ? Number(s.carriage) : undefined,
          addLess: s.addLess != null ? Number(s.addLess) : undefined,
        }));

      const commonPayload = {
        title,
        customerCategoryId: customerCategoryId || null,
        email,
        phone1,
        phone2,
        address,
        qualification: qualification || undefined,
        cnic,
        fax,
        smsNumber,
        iban,
        active,
        smsAlert,
        emailAlert,
        mediaId: mediaId || undefined,
        parentCustomerAccountId: isSubAccount ? (parentCustomerAccountId || undefined) : undefined,
        supplyItems: sanitizedSupplyItems
      };

      if (isEdit) {
        const payload: CustomerUpdateRequest = commonPayload;
        await customerService.update(account!, payload);
        Alert.alert('Success', 'Customer updated successfully.', [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        const payload: CustomerCreateRequest = commonPayload;
        await customerService.create(payload);
        Alert.alert('Success', 'Customer created successfully.', [{ text: 'OK', onPress: () => router.back() }]);
      }
    } catch (error: any) {
      console.error('Failed to save customer:', error?.response?.data || error);
      Alert.alert('Error', extractErrorMessage(error, 'Failed to save customer.'));
    } finally {
      setSaving(false);
    }
  };

  const categoryOptions = useMemo(() => customerCategories.map(c => ({
    value: c.code,
    label: c.title,
    subtitle: `Code: ${c.code}`
  })), [customerCategories]);

  const parentCustomerOptions = useMemo(() =>
    allCustomers
      .filter(c => c.account !== account && !c.isSubAccount && !c.parentCustomerAccountId)
      .map(c => ({
        value: c.account,
        label: c.title,
        subtitle: `Account: ${c.account}`
      })),
    [allCustomers, account]
  );

  const itemOptions = useMemo(() => items.map(i => ({
    value: i.id,
    label: i.title,
    subtitle: `Code: ${i.id} • Rate: Rs. ${i.priRate || 0}`
  })), [items]);

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
            <Text style={styles.avatarText}>{uploading ? 'Uploading...' : imageUrl ? 'Change Avatar' : 'Upload Avatar'}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(350)} style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Customer Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter customer name"
                placeholderTextColor={Theme.colors.textSecondary}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View style={styles.inputGroup}>
              <InlineSearchSelect
                label="Customer Category (Pricing Tier)"
                options={categoryOptions}
                value={customerCategoryId}
                displayValue={customerCategoryTitle || categoryOptions.find(c => c.value === customerCategoryId)?.label}
                onSelect={(val, opt) => {
                  setCustomerCategoryId(val);
                  setCustomerCategoryTitle(opt?.label || opt?.title || '');
                }}
                placeholder="Select Customer Category (Optional)..."
                icon="pricetag-outline"
                clearable
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                <Text style={styles.label}>Phone 1</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Primary phone"
                  placeholderTextColor={Theme.colors.textSecondary}
                  value={phone1}
                  onChangeText={setPhone1}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Phone 2</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Secondary phone"
                  placeholderTextColor={Theme.colors.textSecondary}
                  value={phone2}
                  onChangeText={setPhone2}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Email address"
                  placeholderTextColor={Theme.colors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Qualification</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Trader / Dealer"
                  placeholderTextColor={Theme.colors.textSecondary}
                  value={qualification}
                  onChangeText={setQualification}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address</Text>
              <TextInput
                style={[styles.textInput, { height: 70, textAlignVertical: 'top' }]}
                placeholder="Full address"
                placeholderTextColor={Theme.colors.textSecondary}
                value={address}
                onChangeText={setAddress}
                multiline
              />
            </View>
          </Animated.View>

          {/* Default Supply Items Section */}
          <Animated.View entering={FadeInDown.delay(100).duration(350)} style={styles.section}>
            <Text style={styles.sectionTitle}>Default Supply Items</Text>
            <Text style={styles.sectionSubtitle}>
              Configure standing quantities and custom rates for Sale Supply sheets
            </Text>

            <View style={{ marginBottom: Theme.spacing.sm }}>
              <InlineSearchSelect
                options={itemOptions}
                value=""
                onSelect={handleAddSupplyItem}
                placeholder="Search & add default supply item..."
                icon="add-circle-outline"
                compact
              />
            </View>

            {supplyItems.length === 0 ? (
              <Text style={styles.emptySupplyText}>No default supply items configured.</Text>
            ) : (
              supplyItems.map((sItem) => {
                const matchedItem = items.find(i => i.id === sItem.itemId);
                return (
                  <View key={sItem.itemId} style={styles.supplyItemCard}>
                    <View style={styles.supplyItemHeader}>
                      <Text style={styles.supplyItemTitle} numberOfLines={1}>
                        {sItem.itemTitle || matchedItem?.title || sItem.itemId}
                      </Text>
                      <TouchableOpacity onPress={() => handleRemoveSupplyItem(sItem.itemId)}>
                        <Ionicons name="trash-outline" size={18} color={Theme.colors.danger} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.supplyFieldsRow}>
                      <View style={styles.supplyFieldCol}>
                        <Text style={styles.supplyFieldLabel}>Qty</Text>
                        <TextInput
                          style={styles.supplyInput}
                          keyboardType="numeric"
                          value={sItem.qty != null ? String(sItem.qty) : ''}
                          onChangeText={(val) => handleUpdateSupplyItem(sItem.itemId, 'qty', val)}
                          placeholder="1"
                          selectTextOnFocus
                        />
                      </View>
                      <View style={styles.supplyFieldCol}>
                        <Text style={styles.supplyFieldLabel}>Sec Qty</Text>
                        <TextInput
                          style={styles.supplyInput}
                          keyboardType="numeric"
                          value={sItem.secQty != null ? String(sItem.secQty) : ''}
                          onChangeText={(val) => handleUpdateSupplyItem(sItem.itemId, 'secQty', val)}
                          placeholder="0"
                          selectTextOnFocus
                        />
                      </View>
                      <View style={styles.supplyFieldCol}>
                        <Text style={styles.supplyFieldLabel}>Rate</Text>
                        <TextInput
                          style={styles.supplyInput}
                          keyboardType="numeric"
                          value={sItem.rate != null ? String(sItem.rate) : ''}
                          onChangeText={(val) => handleUpdateSupplyItem(sItem.itemId, 'rate', val)}
                          placeholder="Default"
                          selectTextOnFocus
                        />
                      </View>
                    </View>

                    <View style={[styles.supplyFieldsRow, { marginTop: 6 }]}>
                      <View style={styles.supplyFieldCol}>
                        <Text style={styles.supplyFieldLabel}>Discount</Text>
                        <TextInput
                          style={styles.supplyInput}
                          keyboardType="numeric"
                          value={sItem.discount != null ? String(sItem.discount) : ''}
                          onChangeText={(val) => handleUpdateSupplyItem(sItem.itemId, 'discount', val)}
                          placeholder="0"
                          selectTextOnFocus
                        />
                      </View>
                      <View style={styles.supplyFieldCol}>
                        <Text style={styles.supplyFieldLabel}>Carriage</Text>
                        <TextInput
                          style={styles.supplyInput}
                          keyboardType="numeric"
                          value={sItem.carriage != null ? String(sItem.carriage) : ''}
                          onChangeText={(val) => handleUpdateSupplyItem(sItem.itemId, 'carriage', val)}
                          placeholder="0"
                          selectTextOnFocus
                        />
                      </View>
                      <View style={styles.supplyFieldCol}>
                        <Text style={styles.supplyFieldLabel}>Add/Less</Text>
                        <TextInput
                          style={styles.supplyInput}
                          keyboardType="numeric"
                          value={sItem.addLess != null ? String(sItem.addLess) : ''}
                          onChangeText={(val) => handleUpdateSupplyItem(sItem.itemId, 'addLess', val)}
                          placeholder="0"
                          selectTextOnFocus
                        />
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(350)} style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Details</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>CNIC</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter CNIC"
                placeholderTextColor={Theme.colors.textSecondary}
                value={cnic}
                onChangeText={setCnic}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: Theme.spacing.sm }]}>
                <Text style={styles.label}>IBAN</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Bank IBAN"
                  placeholderTextColor={Theme.colors.textSecondary}
                  value={iban}
                  onChangeText={setIban}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Fax</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Fax number"
                  placeholderTextColor={Theme.colors.textSecondary}
                  value={fax}
                  onChangeText={setFax}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>SMS Number</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Number for SMS alerts"
                placeholderTextColor={Theme.colors.textSecondary}
                value={smsNumber}
                onChangeText={setSmsNumber}
                keyboardType="phone-pad"
              />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(350)} style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>

            <View style={styles.switchRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.switchLabel}>Sub-Account of another Customer</Text>
                <Text style={styles.switchDesc}>Dispatches recorded here; GL debt rolls up to main</Text>
              </View>
              <Switch
                value={isSubAccount}
                onValueChange={(val) => {
                  setIsSubAccount(val);
                  if (!val) {
                    setParentCustomerAccountId('');
                  }
                }}
                trackColor={{ false: Theme.colors.border, true: Theme.colors.primary }}
                thumbColor={Theme.colors.white}
              />
            </View>

            {isSubAccount && (
              <View style={[styles.inputGroup, { marginTop: Theme.spacing.sm }]}>
                <InlineSearchSelect
                  label="Main Customer Account *"
                  options={parentCustomerOptions}
                  value={parentCustomerAccountId}
                  onSelect={setParentCustomerAccountId}
                  placeholder="Search & select main customer..."
                  icon="people-outline"
                />
              </View>
            )}

            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchLabel}>Active Account</Text>
                <Text style={styles.switchDesc}>Allow transactions for this customer</Text>
              </View>
              <Switch
                value={active}
                onValueChange={setActive}
                trackColor={{ false: Theme.colors.border, true: Theme.colors.success }}
                thumbColor={Theme.colors.white}
              />
            </View>

            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchLabel}>SMS Alerts</Text>
                <Text style={styles.switchDesc}>Send SMS on transactions</Text>
              </View>
              <Switch
                value={smsAlert}
                onValueChange={setSmsAlert}
                trackColor={{ false: Theme.colors.border, true: Theme.colors.primary }}
                thumbColor={Theme.colors.white}
              />
            </View>

            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchLabel}>Email Alerts</Text>
                <Text style={styles.switchDesc}>Send Email on transactions</Text>
              </View>
              <Switch
                value={emailAlert}
                onValueChange={setEmailAlert}
                trackColor={{ false: Theme.colors.border, true: Theme.colors.primary }}
                thumbColor={Theme.colors.white}
              />
            </View>
          </Animated.View>

        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={Theme.colors.white} /> : (
              <>
                <Ionicons name="save-outline" size={20} color={Theme.colors.white} style={{ marginRight: 8 }} />
                <Text style={styles.saveBtnText}>Save Customer</Text>
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
    color: Theme.colors.text,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  emptySupplyText: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    paddingVertical: Theme.spacing.sm,
  },
  supplyItemCard: {
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.radii.sm,
    padding: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  supplyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  supplyItemTitle: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.primary,
    fontWeight: '700',
    flex: 1,
  },
  supplyFieldsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  supplyFieldCol: {
    flex: 1,
  },
  supplyFieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
    marginBottom: 2,
  },
  supplyInput: {
    backgroundColor: Theme.colors.white,
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
  avatarSection: {
    alignItems: 'center',
    marginVertical: Theme.spacing.md,
  },
  avatarBtn: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
