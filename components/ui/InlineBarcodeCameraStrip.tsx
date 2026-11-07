import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Theme } from '../../constants/theme';

export interface InlineBarcodeCameraStripProps {
  visible: boolean;
  onClose: () => void;
  onBarcodeScanned: (barcode: string, multiplier: number) => void;
  defaultContinuous?: boolean;
  showMultipliers?: boolean;
}

const MULTIPLIER_OPTIONS = [1, 2, 5, 12];
const SAME_CODE_COOLDOWN_MS = 1300;

export const InlineBarcodeCameraStrip: React.FC<InlineBarcodeCameraStripProps> = ({
  visible,
  onClose,
  onBarcodeScanned,
  defaultContinuous = true,
  showMultipliers = true,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [continuous, setContinuous] = useState(defaultContinuous);
  const [torch, setTorch] = useState(false);
  const [multiplier, setMultiplier] = useState<number>(1);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [scanFlash, setScanFlash] = useState(false);

  const lastCodeRef = useRef<string>('');
  const lastTimeRef = useRef<number>(0);

  if (!visible) return null;

  if (Platform.OS === 'web') {
    return (
      <View style={styles.permissionCard}>
        <View style={styles.permissionHeader}>
          <Ionicons name="barcode-outline" size={20} color={Theme.colors.primary} />
          <Text style={styles.permissionTitle}>
            Camera Barcode Scanner (Mobile Device)
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeIconBtn}>
            <Ionicons name="close" size={18} color={Theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.permissionDesc}>
          Live camera laser scanning runs on Android/iOS devices. On Web, type or use a USB/Bluetooth scanner in the box above.
        </Text>
      </View>
    );
  }

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionCard}>
        <View style={styles.permissionHeader}>
          <Ionicons name="camera-outline" size={20} color={Theme.colors.primary} />
          <Text style={styles.permissionTitle}>Camera Access Needed</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeIconBtn}>
            <Ionicons name="close" size={18} color={Theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.permissionDesc}>
          Allow camera permission to scan barcodes directly into your bill.
        </Text>
        <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
          <Ionicons name="checkmark-circle-outline" size={16} color="#FFF" />
          <Text style={styles.grantBtnText}>Enable Camera Scanner</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = (result: BarcodeScanningResult) => {
    const code = (result?.data || '').trim();
    if (!code) return;

    const now = Date.now();
    if (
      code === lastCodeRef.current &&
      now - lastTimeRef.current < SAME_CODE_COOLDOWN_MS
    ) {
      return;
    }

    lastCodeRef.current = code;
    lastTimeRef.current = now;
    setLastScannedCode(code);
    setScanFlash(true);
    setTimeout(() => setScanFlash(false), 300);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {}
    );

    onBarcodeScanned(code, multiplier);

    // Reset multiplier back to 1x after each scan so next item defaults to 1x
    if (multiplier !== 1) {
      setMultiplier(1);
    }

    if (!continuous) {
      onClose();
    }
  };

  const handleResetCooldown = () => {
    lastCodeRef.current = '';
    lastTimeRef.current = 0;
    setLastScannedCode(null);
  };

  return (
    <View
      style={[
        styles.stripContainer,
        scanFlash && styles.stripContainerFlash,
      ]}
    >
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: [
            'ean13',
            'ean8',
            'upc_a',
            'upc_e',
            'code128',
            'code39',
            'code93',
            'itf14',
            'codabar',
            'qr',
          ],
        }}
        onBarcodeScanned={handleBarCodeScanned}
      />

      {/* Top Controls Bar */}
      <View style={styles.topOverlay}>
        <TouchableOpacity
          style={[
            styles.modePill,
            continuous ? styles.modePillContinuous : styles.modePillSingle,
          ]}
          onPress={() => setContinuous((prev) => !prev)}
        >
          <Ionicons
            name={continuous ? 'repeat' : 'scan-outline'}
            size={13}
            color="#FFFFFF"
          />
          <Text style={styles.modePillText}>
            {continuous ? 'Continuous' : '1-Scan'}
          </Text>
        </TouchableOpacity>

        {showMultipliers && (
          <View style={styles.multiplierBar}>
            {MULTIPLIER_OPTIONS.map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.multChip,
                  multiplier === m && styles.multChipActive,
                ]}
                onPress={() => setMultiplier(m)}
              >
                <Text
                  style={[
                    styles.multChipText,
                    multiplier === m && styles.multChipTextActive,
                  ]}
                >
                  {m}×
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.rightControls}>
          <TouchableOpacity
            style={[styles.iconPill, torch && styles.iconPillActive]}
            onPress={() => setTorch((prev) => !prev)}
          >
            <Ionicons
              name={torch ? 'flash' : 'flash-outline'}
              size={15}
              color={torch ? '#FEF08A' : '#FFFFFF'}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconPillClose} onPress={onClose}>
            <Ionicons name="close" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Center POS Laser Reticle */}
      <View style={styles.reticleContainer} pointerEvents="none">
        <View style={styles.reticleBox}>
          <View
            style={[
              styles.laserLine,
              scanFlash && styles.laserLineSuccess,
            ]}
          />
        </View>
      </View>

      {/* Bottom Status Bar */}
      <View style={styles.bottomOverlay}>
        {lastScannedCode ? (
          <TouchableOpacity
            style={styles.scannedAgainPill}
            onPress={handleResetCooldown}
          >
            <Ionicons name="checkmark-circle" size={13} color="#4ADE80" />
            <Text style={styles.bottomStatusText} numberOfLines={1}>
              Scanned: {lastScannedCode} • Tap to scan same again
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.aimStatusRow}>
            <Ionicons name="barcode-outline" size={13} color="#E2E8F0" />
            <Text style={styles.bottomStatusText}>
              Align barcode with red laser line
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  stripContainer: {
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 6,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: Theme.colors.primary,
    position: 'relative',
  },
  stripContainerFlash: {
    borderColor: '#22C55E',
  },
  camera: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topOverlay: {
    position: 'absolute',
    top: 6,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
  },
  modePillContinuous: {
    backgroundColor: 'rgba(37, 99, 235, 0.85)',
  },
  modePillSingle: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
  },
  modePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  multiplierBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 12,
    padding: 2,
    gap: 2,
  },
  multChip: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 10,
  },
  multChipActive: {
    backgroundColor: '#F59E0B',
  },
  multChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  multChipTextActive: {
    color: '#FFFFFF',
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: 'rgba(202, 138, 4, 0.85)',
  },
  iconPillClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(220, 38, 38, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleBox: {
    width: '78%',
    height: 62,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  laserLine: {
    width: '94%',
    height: 2,
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 4,
  },
  laserLineSuccess: {
    backgroundColor: '#22C55E',
    height: 3,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    right: 8,
    alignItems: 'center',
    zIndex: 10,
  },
  aimStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  scannedAgainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(20, 83, 45, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 12,
  },
  bottomStatusText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '600',
  },
  permissionCard: {
    marginTop: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 12,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  permissionTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.text,
  },
  closeIconBtn: {
    padding: 2,
  },
  permissionDesc: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginBottom: 8,
  },
  grantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Theme.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  grantBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
