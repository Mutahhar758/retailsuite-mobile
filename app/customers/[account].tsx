import React, { useEffect, useState } from 'react';
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
  Image,
  Modal,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { Theme } from '../../constants/theme';
import { extractErrorMessage } from '../../services/api';
import { customerService, CustomerCreateRequest, CustomerUpdateRequest, CustomerResponse } from '../../services/customerService';

export default function CustomerFormScreen() {
  const { account } = useLocalSearchParams<{ account: string }>();
  const router = useRouter();
  const isEdit = account && account !== 'new';

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone1, setPhone1] = useState('');
  const [phone2, setPhone2] = useState('');
  const [address, setAddress] = useState('');
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
  const [parentCustomerAccountId, setParentCustomerAccountId] = useState<string | null>(null);
  const [parentCustomerTitle, setParentCustomerTitle] = useState('');
  const [allCustomers, setAllCustomers] = useState<CustomerResponse[]>([]);
  const [parentModalVisible, setParentModalVisible] = useState(false);
  const [parentSearchQuery, setParentSearchQuery] = useState('');

  useEffect(() => {
    customerService.getCustomers()
      .then(res => setAllCustomers(res || []))
      .catch(() => {});

    if (isEdit) {
      loadCustomerDetails();
    }
  }, [isEdit]);

  const loadCustomerDetails = async () => {
    try {
      const details = await customerService.getDetail(account!);
      if (details) {
        setTitle(details.title || '');
        setEmail(details.email || '');
        setPhone1(details.phone1 || '');
        setPhone2(details.phone2 || '');
        setAddress(details.address || '');
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
        setParentCustomerAccountId(details.parentCustomerAccountId || null);
        setParentCustomerTitle(details.parentCustomerTitle || '');
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
      if (isEdit) {
        const payload: CustomerUpdateRequest = {
          title, email, phone1, phone2, address, cnic, fax, smsNumber, iban, active, smsAlert, emailAlert, mediaId: mediaId || undefined, parentCustomerAccountId: isSubAccount ? (parentCustomerAccountId || undefined) : undefined
        };
        await customerService.update(account!, payload);
        Alert.alert('Success', 'Customer updated successfully.', [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        const payload: CustomerCreateRequest = {
          title, email, phone1, phone2, address, cnic, fax, smsNumber, iban, active, smsAlert, emailAlert, mediaId: mediaId || undefined, parentCustomerAccountId: isSubAccount ? (parentCustomerAccountId || undefined) : undefined
        };
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
            <Text style={styles.avatarText}>{uploading ? 'Uploading...' : imageUrl ? 'Change Avatar' : 'Upload Avatar'}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
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
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter email address"
                placeholderTextColor={Theme.colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
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

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address</Text>
              <TextInput
                style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Full address"
                placeholderTextColor={Theme.colors.textSecondary}
                value={address}
                onChangeText={setAddress}
                multiline
              />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
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

          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.section}>
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
                    setParentCustomerAccountId(null);
                    setParentCustomerTitle('');
                  }
                }}
                trackColor={{ false: Theme.colors.border, true: Theme.colors.primary }}
                thumbColor={Theme.colors.white}
              />
            </View>

            {isSubAccount && (
              <View style={[styles.inputGroup, { marginTop: Theme.spacing.sm }]}>
                <Text style={styles.label}>Main Customer Account *</Text>
                <TouchableOpacity
                  style={styles.selectorBtn}
                  onPress={() => setParentModalVisible(true)}
                >
                  <Text style={[styles.selectorText, !parentCustomerAccountId && styles.placeholder]}>
                    {parentCustomerTitle
                      ? `${parentCustomerTitle} (${parentCustomerAccountId})`
                      : 'Select Main Customer...'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={Theme.colors.textSecondary} />
                </TouchableOpacity>
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

        <Modal visible={parentModalVisible} animationType="slide" transparent>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Main Customer Account</Text>
              <TouchableOpacity onPress={() => setParentModalVisible(false)}>
                <Ionicons name="close" size={24} color={Theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchBox}>
              <Ionicons name="search" size={18} color={Theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search main customer by name or code..."
                placeholderTextColor={Theme.colors.textSecondary}
                value={parentSearchQuery}
                onChangeText={setParentSearchQuery}
                autoFocus
              />
            </View>

            <FlatList
              data={allCustomers
                .filter(c => c.account !== account && !c.isSubAccount && !c.parentCustomerAccountId)
                .filter(c => 
                  c.title.toLowerCase().includes(parentSearchQuery.toLowerCase()) ||
                  c.account.toLowerCase().includes(parentSearchQuery.toLowerCase())
                )}
              keyExtractor={item => item.account}
              contentContainerStyle={{ padding: Theme.spacing.md }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalListItem,
                    item.account === parentCustomerAccountId && styles.modalListItemSelected
                  ]}
                  onPress={() => {
                    setParentCustomerAccountId(item.account);
                    setParentCustomerTitle(item.title);
                    setParentModalVisible(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemTitle}>{item.title}</Text>
                    <Text style={styles.modalItemSubtitle}>Account: {item.account}</Text>
                  </View>
                  {item.account === parentCustomerAccountId ? (
                    <Ionicons name="checkmark-circle" size={20} color={Theme.colors.primary} />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={Theme.colors.border} />
                  )}
                </TouchableOpacity>
              )}
            />
          </SafeAreaView>
        </Modal>

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
    color: Theme.colors.text,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  selectorBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radii.sm,
    padding: Theme.spacing.sm,
    backgroundColor: Theme.colors.background,
    minHeight: 44,
  },
  selectorText: {
    ...Theme.typography.body,
    color: Theme.colors.text,
  },
  placeholder: {
    color: Theme.colors.textSecondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    padding: Theme.spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  modalTitle: {
    ...Theme.typography.h3,
    color: Theme.colors.text,
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.white,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radii.sm,
    paddingHorizontal: Theme.spacing.sm,
    marginVertical: Theme.spacing.sm,
    height: 40,
  },
  modalSearchInput: {
    flex: 1,
    ...Theme.typography.body,
    color: Theme.colors.text,
  },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radii.sm,
    marginBottom: Theme.spacing.xs,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  modalListItemSelected: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.primary + '08',
  },
  modalItemTitle: {
    ...Theme.typography.bodyMedium,
    color: Theme.colors.text,
    fontWeight: '600',
  },
  modalItemSubtitle: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
});
