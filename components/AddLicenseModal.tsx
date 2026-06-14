import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Theme } from '../constants/theme';
import api from '../services/api';
import { useAppStore } from '../store/appStore';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddLicenseModal: React.FC<Props> = ({ visible, onClose, onSuccess }) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const addLicense = useAppStore((state) => state.addLicense);

  const handleVerify = async () => {
    if (!licenseKey.trim()) {
      Alert.alert('Error', 'Please enter a license key.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/api/license/verify/${licenseKey.trim()}`);
      
      const tenantData = response.data?.body || response.data;
      const tenantIdentifier = tenantData?.identifier || tenantData?.id;
      const name = tenantData?.name || 'Unknown Organization';

      if (tenantIdentifier) {
        addLicense({
          licenseKey: licenseKey.trim(),
          tenantIdentifier,
          name,
        });
        Alert.alert('Success', `Successfully added license for ${name}`);
        setLicenseKey('');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        Alert.alert('Error', 'Invalid response from license server.');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.metadata?.message || error.message || 'Verification failed';
      Alert.alert('Verification Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Organization License</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>License Key</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="key-outline" size={20} color={Theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter organization license key"
                placeholderTextColor={Theme.colors.textSecondary}
                value={licenseKey}
                onChangeText={setLicenseKey}
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading}>
              {loading ? <ActivityIndicator color={Theme.colors.white} /> : <Text style={styles.buttonText}>Verify & Add</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Theme.colors.glassDark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radii.lg,
    padding: Theme.spacing.md,
    ...Theme.shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  title: {
    ...Theme.typography.h3,
    color: Theme.colors.text,
  },
  inputGroup: {
    marginBottom: Theme.spacing.xl,
  },
  label: {
    ...Theme.typography.caption,
    color: Theme.colors.text,
    marginBottom: Theme.spacing.sm,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: Theme.spacing.md,
  },
  inputIcon: {
    marginRight: Theme.spacing.sm,
  },
  input: {
    flex: 1,
    height: 50,
    ...Theme.typography.body,
    color: Theme.colors.text,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Theme.spacing.md,
  },
  button: {
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Theme.colors.background,
  },
  buttonText: {
    color: Theme.colors.white,
    ...Theme.typography.bodyMedium,
  },
  cancelButtonText: {
    color: Theme.colors.textSecondary,
    ...Theme.typography.bodyMedium,
  },
});
