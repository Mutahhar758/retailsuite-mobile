import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, Alert, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, Switch
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Theme } from '../../constants/theme';
import { customerService, CustomerCreateRequest, CustomerUpdateRequest } from '../../services/customerService';

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

  useEffect(() => {
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

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Customer Name is required.');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        const payload: CustomerUpdateRequest = {
          title, email, phone1, phone2, address, cnic, fax, smsNumber, iban, active, smsAlert, emailAlert
        };
        await customerService.update(account!, payload);
        Alert.alert('Success', 'Customer updated successfully.', [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        const payload: CustomerCreateRequest = {
          title, email, phone1, phone2, address, cnic, fax, smsNumber, iban, active, smsAlert, emailAlert
        };
        await customerService.create(payload);
        Alert.alert('Success', 'Customer created successfully.', [{ text: 'OK', onPress: () => router.back() }]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to save customer.');
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
          
          <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Customer Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter customer name"
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter email address"
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
                  value={iban}
                  onChangeText={setIban}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Fax</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Fax number"
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
                value={smsNumber}
                onChangeText={setSmsNumber}
                keyboardType="phone-pad"
              />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            
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
});
