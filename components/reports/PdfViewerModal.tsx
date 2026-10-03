import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Platform,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Theme } from '../../constants/theme';
import { generatePdfViewerHtml } from '../../utils/pdfUtils';

interface PdfViewerModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  base64Pdf: string | null;
  loading?: boolean;
  fileName?: string;
  onClose: () => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  visible,
  title,
  subtitle,
  base64Pdf,
  loading = false,
  fileName = 'report.pdf',
  onClose,
}) => {
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [sharingLoading, setSharingLoading] = useState(false);

  useEffect(() => {
    if (visible && base64Pdf) {
      const html = generatePdfViewerHtml(base64Pdf, title);
      setHtmlContent(html);
      setTotalPages(null);
    } else if (!visible) {
      // Clear memory when modal closes
      setHtmlContent('');
      setTotalPages(null);
    }
  }, [visible, base64Pdf, title]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'STATUS' && data.totalPages) {
        setTotalPages(data.totalPages);
      }
    } catch {
      // Ignore non-json messages
    }
  };

  const handleShare = async () => {
    if (!base64Pdf) return;
    try {
      setSharingLoading(true);
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing Unavailable', 'Sharing is not supported on this device.');
        return;
      }

      // Write strictly to the temporary cache directory for immediate sharing,
      // without touching permanent device downloads or storage.
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const tempUri = `${FileSystem.cacheDirectory}${safeName}`;
      await FileSystem.writeAsStringAsync(tempUri, base64Pdf, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await Sharing.shareAsync(tempUri, {
        mimeType: 'application/pdf',
        dialogTitle: title,
        UTI: 'com.adobe.pdf',
      });

      // Cleanup cache file after share dialog finishes
      try {
        await FileSystem.deleteAsync(tempUri, { idempotent: true });
      } catch {
        // Safe to ignore temp file cleanup error
      }
    } catch (err: any) {
      Alert.alert('Share Error', err?.message || 'Failed to share PDF document.');
    } finally {
      setSharingLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

        {/* Modern In-App Viewer Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color="#f8fafc" />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          <View style={styles.headerActions}>
            {totalPages !== null && (
              <View style={styles.pageBadge}>
                <Ionicons name="document-text-outline" size={12} color="#94a3b8" style={{ marginRight: 4 }} />
                <Text style={styles.pageBadgeText}>
                  {totalPages} {totalPages === 1 ? 'Page' : 'Pages'}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.headerButton, { marginLeft: 8 }]}
              onPress={handleShare}
              disabled={sharingLoading || !base64Pdf}
              activeOpacity={0.7}
            >
              {sharingLoading ? (
                <ActivityIndicator size="small" color="#f8fafc" />
              ) : (
                <Ionicons name="share-outline" size={22} color="#f8fafc" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Viewer Body */}
        <View style={styles.body}>
          {loading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.loadingText}>Loading PDF from server...</Text>
              <Text style={styles.loadingSub}>Opening PDF document in memory...</Text>
            </View>
          ) : htmlContent ? (
            <WebView
              originWhitelist={['*']}
              source={{ html: htmlContent }}
              style={styles.webView}
              onMessage={handleMessage}
              javaScriptEnabled
              domStorageEnabled
              scalesPageToFit={Platform.OS === 'android'}
              bounces={false}
              scrollEnabled
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              containerStyle={{ backgroundColor: '#0f172a' }}
            />
          ) : (
            <View style={styles.centerLoading}>
              <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
              <Text style={[styles.loadingText, { color: '#f87171' }]}>No PDF Data Available</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '400',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  pageBadgeText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  webView: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
  },
  loadingSub: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 13,
  },
});
