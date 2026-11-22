import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Theme } from '../../constants/theme';
import { customerService } from '../../services/customerService';
import { vendorService } from '../../services/vendorService';
import { extractErrorMessage } from '../../services/api';

interface QuickAddPartyModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (party: { accountId: string; title: string; partyType: 'Customer' | 'Vendor' }) => void;
  canCreateCustomer?: boolean;
  canCreateVendor?: boolean;
}

export const QuickAddPartyModal: React.FC<QuickAddPartyModalProps> = ({
  visible,
  onClose,
  onCreated,
  canCreateCustomer = true,
  canCreateVendor = true,
}) => {
  const [partyType, setPartyType] = useState<'Customer' | 'Vendor'>(
    canCreateCustomer ? 'Customer' : 'Vendor'
  );
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName('');
    setPhone('');
    setPartyType(canCreateCustomer ? 'Customer' : 'Vendor');
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name Required', 'Please enter the party name.');
      return;
    }

    setSaving(true);
    try {
      let createdAccountId = '';
      const trimmedPhone = phone.trim() || undefined;

      if (partyType === 'Customer') {
        const res = await customerService.create({
          title: trimmedName,
          phone1: trimmedPhone,
          smsNumber: trimmedPhone,
          smsAlert: false,
          emailAlert: false,
          active: true,
        });
        createdAccountId = typeof res === 'string' ? res : res?.account || res?.id || '';
      } else {
        const res = await vendorService.create({
          title: trimmedName,
          phone1: trimmedPhone,
          smsNumber: trimmedPhone,
          smsAlert: false,
          emailAlert: false,
          active: true,
          showInSales: false,
        });
        createdAccountId = typeof res === 'string' ? res : (res as any)?.account || (res as any)?.id || '';
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onCreated({
        accountId: createdAccountId,
        title: trimmedName,
        partyType,
      });
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onShow={resetForm} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Quick Add Party</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {canCreateCustomer && canCreateVendor && (
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, partyType === 'Customer' && styles.toggleBtnActive]}
                onPress={() => setPartyType('Customer')}
              >
                <Text style={[styles.toggleText, partyType === 'Customer' && styles.toggleTextActive]}>
                  Customer
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, partyType === 'Vendor' && styles.toggleBtnActive]}
                onPress={() => setPartyType('Vendor')}
              >
                <Text style={[styles.toggleText, partyType === 'Vendor' && styles.toggleTextActive]}>
                  Vendor
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Party Name *</Text>
            <TextInput
              style={styles.input}
              placeholder={partyType === 'Customer' ? 'e.g. Al-Madina Dairy' : 'e.g. Usman Milk Farm'}
              placeholderTextColor="#A0AEC0"
              value={name}
              onChangeText={setName}
              autoFocus
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone Number (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="0300-1234567"
              placeholderTextColor="#A0AEC0"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Theme.colors.white} />
            ) : (
              <Text style={styles.saveBtnText}>Create &amp; Open Khata</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: Theme.colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 34 : Theme.spacing.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Theme.colors.border,
    alignSelf: 'center',
    marginBottom: Theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.radii.md,
    padding: 4,
    marginBottom: Theme.spacing.md,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Theme.radii.sm,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: Theme.colors.white,
    ...Theme.shadows.sm,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  toggleTextActive: {
    color: Theme.colors.primary,
    fontWeight: '700',
  },
  field: {
    marginBottom: Theme.spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Theme.colors.text,
  },
  saveBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radii.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Theme.spacing.xs,
    ...Theme.shadows.sm,
  },
  saveBtnDisabled: {
    opacity: 0.65,
  },
  saveBtnText: {
    color: Theme.colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
