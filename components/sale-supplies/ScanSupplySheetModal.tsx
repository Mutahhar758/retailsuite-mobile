import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import dayjs from 'dayjs';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Theme } from '../../constants/theme';
import {
  saleSupplyService,
  type ScannedSaleSupplyLine,
  type SaleSupplyScanResponse
} from '../../services/saleSupplyService';
import type { ChartOfAccountHeadDto } from '../../services/chartOfAccountService';

export interface MobileScannedAttachmentMeta {
  mediaId: string;
  fileName?: string;
  previewUrl?: string;
}

interface SelectedPageItem {
  id: string;
  uri: string;
  fileName: string;
  mediaId?: string;
}

interface ScanSupplySheetModalProps {
  visible: boolean;
  onClose: () => void;
  customers: ChartOfAccountHeadDto[];
  initialDate?: string;
  onImportLines: (
    importedLines: any[],
    attachments?: MobileScannedAttachmentMeta[]
  ) => void;
}

export const ScanSupplySheetModal: React.FC<ScanSupplySheetModalProps> = ({
  visible,
  onClose,
  customers,
  initialDate,
  onImportLines
}) => {
  const [loading, setLoading] = useState(false);
  const [targetDate, setTargetDate] = useState<Date>(
    initialDate ? dayjs(initialDate).toDate() : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [useTargetDateFilter, setUseTargetDateFilter] = useState(true);

  const [selectedPages, setSelectedPages] = useState<SelectedPageItem[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [scanResult, setScanResult] = useState<SaleSupplyScanResponse | null>(null);
  const [editableLines, setEditableLines] = useState<ScannedSaleSupplyLine[]>([]);

  // Customer mapping picker modal
  const [customerPickerVisible, setCustomerPickerVisible] = useState(false);
  const [editingSeq, setEditingSeq] = useState<number | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  useEffect(() => {
    if (visible) {
      setTargetDate(initialDate ? dayjs(initialDate).toDate() : new Date());
      setUseTargetDateFilter(true);
    }
  }, [visible, initialDate]);

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to photograph sheets.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uriParts = asset.uri.split('/');
        const fileName = asset.fileName || uriParts[uriParts.length - 1] || `sheet_${Date.now()}.jpg`;
        setSelectedPages(prev => [
          ...prev,
          {
            id: `${Date.now()}_${Math.random()}`,
            uri: asset.uri,
            fileName
          }
        ]);
      }
    } catch (err) {
      console.error('Camera error:', err);
      Alert.alert('Error', 'Failed to capture photo.');
    }
  };

  const handlePickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Gallery permission is required to select sheets.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.85
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newItems: SelectedPageItem[] = result.assets.map(asset => {
          const uriParts = asset.uri.split('/');
          const fileName = asset.fileName || uriParts[uriParts.length - 1] || `sheet_${Date.now()}.jpg`;
          return {
            id: `${Date.now()}_${Math.random()}`,
            uri: asset.uri,
            fileName
          };
        });
        setSelectedPages(prev => [...prev, ...newItems]);
      }
    } catch (err) {
      console.error('Gallery error:', err);
      Alert.alert('Error', 'Failed to pick image(s).');
    }
  };

  const handleRemovePage = (id: string) => {
    setSelectedPages(prev => {
      const filtered = prev.filter(p => p.id !== id);
      if (activePageIndex >= filtered.length) {
        setActivePageIndex(Math.max(0, filtered.length - 1));
      }
      return filtered;
    });
  };

  const handleStartScan = async () => {
    if (selectedPages.length === 0) {
      Alert.alert('Select Image', 'Please capture or pick at least one sheet image.');
      return;
    }

    setLoading(true);
    try {
      // 1. Upload to storage directly for attachments
      const updatedPages = [...selectedPages];
      await Promise.allSettled(
        updatedPages.map(async (page, idx) => {
          if (!page.mediaId) {
            try {
              const uploaded = await saleSupplyService.uploadAttachmentDirect(page.uri, page.fileName);
              updatedPages[idx] = { ...page, mediaId: uploaded.mediaId };
            } catch (err) {
              console.warn(`Direct upload failed for ${page.fileName}:`, err);
            }
          }
        })
      );
      setSelectedPages(updatedPages);

      // 2. Scan via AI Vision
      const dateStr = useTargetDateFilter ? dayjs(targetDate).format('YYYY-MM-DD') : undefined;
      const imagesToScan = updatedPages.map(p => ({ uri: p.uri, name: p.fileName }));
      const result = await saleSupplyService.scanSheet(imagesToScan, dateStr);

      setScanResult(result);
      setEditableLines(result.lines || []);
      setActivePageIndex(0);

      if (!result.lines || result.lines.length === 0) {
        Alert.alert('Notice', 'No supply lines found for this sheet/date.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to scan paper sheet.';
      Alert.alert('AI Scan Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    if (editingSeq === null) return;
    const cust = customers.find(c => c.account === customerId);
    setEditableLines(prev =>
      prev.map(line =>
        line.seq === editingSeq
          ? {
              ...line,
              matchedCustomerId: customerId,
              matchedCustomerName: cust?.title || customerId,
              isCustomerMatched: true
            }
          : line
      )
    );
    setCustomerPickerVisible(false);
    setEditingSeq(null);
    setCustomerSearchQuery('');
  };

  const handleFieldChange = (seq: number, field: keyof ScannedSaleSupplyLine, value: any) => {
    setEditableLines(prev =>
      prev.map(line => {
        if (line.seq === seq) {
          const updated = { ...line, [field]: value };
          const qty = Number(updated.qty) || 0;
          const rate = Number(updated.rate) || 0;
          const disc = Number(updated.discount) || 0;
          const addLess = Number(updated.addLess) || 0;
          const carriage = Number(updated.carriage) || 0;
          updated.amount = Math.max(0, (qty * rate) - disc + addLess + carriage);
          return updated;
        }
        return line;
      })
    );
  };

  const handleDeleteRow = (seq: number) => {
    setEditableLines(prev => prev.filter(l => l.seq !== seq));
  };

  const handleConfirmImport = () => {
    if (editableLines.length === 0) {
      Alert.alert('Empty', 'No lines to import.');
      return;
    }

    const unassigned = editableLines.filter(l => !l.matchedCustomerId);
    if (unassigned.length > 0) {
      Alert.alert(
        'Unmatched Customers',
        `${unassigned.length} line(s) are not assigned to a customer account. Import anyway? (You can assign them in the form before saving)`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Import Anyway', onPress: () => doImport() }
        ]
      );
      return;
    }

    doImport();
  };

  const doImport = () => {
    const linesToImport = editableLines.map((line, idx) => ({
      key: Date.now() + idx,
      seq: idx + 1,
      customerId: line.matchedCustomerId || '',
      qty: Number(line.qty) || 1,
      rate: Number(line.rate) || 0,
      discount: Number(line.discount) || 0,
      addLess: Number(line.addLess) || 0,
      carriage: Number(line.carriage) || 0,
      amount: Number(line.amount) || 0,
      secQty: 0,
      secRate: 0
    }));

    const attachments: MobileScannedAttachmentMeta[] = selectedPages
      .filter(p => !!p.mediaId)
      .map(p => ({
        mediaId: p.mediaId!,
        fileName: p.fileName,
        previewUrl: p.uri
      }));

    onImportLines(linesToImport, attachments);
    handleClose();
  };

  const handleClose = () => {
    setSelectedPages([]);
    setScanResult(null);
    setEditableLines([]);
    setActivePageIndex(0);
    onClose();
  };

  const filteredCustomers = customers.filter(c =>
    c.title.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
    c.account.toLowerCase().includes(customerSearchQuery.toLowerCase())
  );

  const currentActivePage = selectedPages[activePageIndex] || selectedPages[0];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="sparkles" size={22} color={Theme.colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.headerTitle}>AI Sheet Scanner</Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={Theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Target Date Section (Pivot/Matrix support) */}
        <View style={styles.targetDateCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center' }}
              onPress={() => setUseTargetDateFilter(!useTargetDateFilter)}
            >
              <Ionicons
                name={useTargetDateFilter ? 'checkbox' : 'square-outline'}
                size={20}
                color={Theme.colors.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.targetDateTitle}>Target Date Row Filter</Text>
            </TouchableOpacity>

            {useTargetDateFilter && (
              <TouchableOpacity
                style={styles.datePickerBtn}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={15} color={Theme.colors.primary} style={{ marginRight: 4 }} />
                <Text style={styles.datePickerBtnText}>{dayjs(targetDate).format('YYYY-MM-DD')}</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.targetDateHint}>
            Extracts rows for this specific date when sheet has multiple dates (Pivot/Matrix customers as columns).
          </Text>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={targetDate}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) setTargetDate(selectedDate);
            }}
          />
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Theme.colors.primary} />
            <Text style={styles.loadingTitle}>Analyzing with Gemini Vision AI...</Text>
            <Text style={styles.loadingSubtitle}>
              {selectedPages.length > 1
                ? `Merging ${selectedPages.length} pages (Matrix continuation support)`
                : 'Recognizing handwritten lines and columns'}
            </Text>
          </View>
        ) : !scanResult ? (
          <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Capture / Pick Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.cameraBtn]} onPress={handleTakePhoto}>
                <Ionicons name="camera" size={26} color={Theme.colors.white} />
                <Text style={styles.actionBtnText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionBtn, styles.galleryBtn]} onPress={handlePickFromGallery}>
                <Ionicons name="images" size={26} color={Theme.colors.primary} />
                <Text style={[styles.actionBtnText, { color: Theme.colors.primary }]}>Pick Gallery</Text>
              </TouchableOpacity>
            </View>

            {/* Selected Pages Strip */}
            {selectedPages.length > 0 ? (
              <View style={styles.selectedPagesContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={styles.sectionTitle}>
                    Selected Pages ({selectedPages.length})
                  </Text>
                  <Text style={styles.sectionSubtitle}>Multi-page support enabled</Text>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailStrip}>
                  {selectedPages.map((page, idx) => (
                    <View key={page.id} style={styles.thumbnailCard}>
                      <Image source={{ uri: page.uri }} style={styles.thumbnailImage} />
                      <View style={styles.pageBadge}>
                        <Text style={styles.pageBadgeText}>P{idx + 1}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteThumbnailBtn}
                        onPress={() => handleRemovePage(page.id)}
                      >
                        <Ionicons name="close-circle" size={20} color={Theme.colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={styles.scanSubmitBtn}
                  onPress={handleStartScan}
                >
                  <Ionicons name="sparkles" size={20} color={Theme.colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.scanSubmitBtnText}>
                    Analyze {selectedPages.length} Page{selectedPages.length > 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="document-attach-outline" size={64} color={Theme.colors.border} />
                <Text style={styles.emptyTitle}>No Paper Sheets Selected</Text>
                <Text style={styles.emptySubtitle}>
                  Take a photo of delivery register sheets or select from gallery. Supports Urdu, English, and Roman Urdu.
                </Text>
              </View>
            )}
          </ScrollView>
        ) : (
          /* Results Review Screen */
          <View style={{ flex: 1 }}>
            {/* Top Image Preview Strip */}
            {currentActivePage && (
              <View style={styles.imagePreviewHeader}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.previewTitle}>Sheet Preview</Text>
                  {selectedPages.length > 1 && (
                    <View style={{ flexDirection: 'row' }}>
                      {selectedPages.map((_, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.pageTab, activePageIndex === idx && styles.activePageTab]}
                          onPress={() => setActivePageIndex(idx)}
                        >
                          <Text style={[styles.pageTabText, activePageIndex === idx && styles.activePageTabText]}>
                            Page {idx + 1}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.rescanBtn}
                    onPress={() => {
                      setScanResult(null);
                      setEditableLines([]);
                    }}
                  >
                    <Ionicons name="refresh" size={14} color={Theme.colors.primary} />
                    <Text style={styles.rescanBtnText}>Re-scan</Text>
                  </TouchableOpacity>
                </View>

                <Image
                  source={{ uri: currentActivePage.uri }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              </View>
            )}

            {/* Extracted Lines List */}
            <View style={styles.linesListHeader}>
              <Text style={styles.linesListTitle}>
                Extracted Lines ({editableLines.length})
              </Text>
              <Text style={styles.linesListSubtitle}>Review & map to accounts</Text>
            </View>

            <ScrollView style={styles.linesScrollView} keyboardShouldPersistTaps="handled">
              {editableLines.map((line, idx) => (
                <View key={line.seq} style={styles.extractedLineCard}>
                  <View style={styles.lineCardTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Text style={styles.lineIndex}>#{idx + 1}</Text>
                      <Text style={styles.rawCustomerText} numberOfLines={1}>
                        {line.rawCustomerName || '—'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteRow(line.seq)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={Theme.colors.danger} />
                    </TouchableOpacity>
                  </View>

                  {/* Customer Selector Button */}
                  <TouchableOpacity
                    style={[
                      styles.customerSelectBtn,
                      !line.isCustomerMatched && styles.unmatchedCustomerBtn
                    ]}
                    onPress={() => {
                      setEditingSeq(line.seq);
                      setCustomerPickerVisible(true);
                    }}
                  >
                    <Ionicons
                      name={line.isCustomerMatched ? 'checkmark-circle' : 'alert-circle'}
                      size={16}
                      color={line.isCustomerMatched ? Theme.colors.success : Theme.colors.warning}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.customerSelectBtnText,
                        !line.matchedCustomerId && { color: Theme.colors.warning }
                      ]}
                      numberOfLines={1}
                    >
                      {line.matchedCustomerName
                        ? `${line.matchedCustomerName} (${line.matchedCustomerId})`
                        : 'Tap to Map Customer Account'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={Theme.colors.textSecondary} />
                  </TouchableOpacity>

                  {/* Qty, Rate, Amount inputs */}
                  <View style={styles.lineInputsRow}>
                    <View style={styles.inputCol}>
                      <Text style={styles.smallInputLabel}>Qty</Text>
                      <TextInput
                        style={styles.smallInput}
                        keyboardType="numeric"
                        value={String(line.qty)}
                        onChangeText={v => handleFieldChange(line.seq, 'qty', v)}
                      />
                    </View>
                    <View style={styles.inputCol}>
                      <Text style={styles.smallInputLabel}>Rate</Text>
                      <TextInput
                        style={styles.smallInput}
                        keyboardType="numeric"
                        value={String(line.rate)}
                        onChangeText={v => handleFieldChange(line.seq, 'rate', v)}
                      />
                    </View>
                    <View style={styles.inputCol}>
                      <Text style={styles.smallInputLabel}>Disc</Text>
                      <TextInput
                        style={styles.smallInput}
                        keyboardType="numeric"
                        value={String(line.discount)}
                        onChangeText={v => handleFieldChange(line.seq, 'discount', v)}
                      />
                    </View>
                    <View style={styles.amountCol}>
                      <Text style={styles.smallInputLabel}>Amount</Text>
                      <Text style={styles.lineAmountText}>
                        Rs. {Number(line.amount || 0).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Bottom Import Footer */}
            <View style={styles.footerBar}>
              <View>
                <Text style={styles.footerCount}>
                  Total Lines: {editableLines.length}
                </Text>
                <Text style={styles.footerAttached}>
                  {selectedPages.length} sheet(s) will be attached
                </Text>
              </View>
              <TouchableOpacity
                style={styles.importBtn}
                onPress={handleConfirmImport}
              >
                <Ionicons name="download-outline" size={18} color={Theme.colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.importBtnText}>Import Lines</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Customer Search & Select Modal */}
        <Modal
          visible={customerPickerVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setCustomerPickerVisible(false)}
        >
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerContainer}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Customer Account</Text>
                <TouchableOpacity onPress={() => setCustomerPickerVisible(false)}>
                  <Ionicons name="close" size={22} color={Theme.colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.pickerSearch}>
                <Ionicons name="search" size={16} color={Theme.colors.textSecondary} style={{ marginRight: 6 }} />
                <TextInput
                  style={styles.pickerSearchInput}
                  placeholder="Search customer title or account..."
                  value={customerSearchQuery}
                  onChangeText={setCustomerSearchQuery}
                  autoFocus
                />
              </View>

              <ScrollView style={{ maxHeight: 350 }}>
                {filteredCustomers.map(c => (
                  <TouchableOpacity
                    key={c.account}
                    style={styles.pickerItem}
                    onPress={() => handleCustomerSelect(c.account)}
                  >
                    <Text style={styles.pickerItemTitle}>{c.title}</Text>
                    <Text style={styles.pickerItemAccount}>{c.account}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingBottom: 14,
    backgroundColor: Theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Theme.colors.text
  },
  closeBtn: {
    padding: 4
  },
  targetDateCard: {
    margin: 12,
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe'
  },
  targetDateTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af'
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.white,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Theme.colors.border
  },
  datePickerBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.primary
  },
  targetDateHint: {
    fontSize: 11,
    color: '#3b82f6',
    marginTop: 4
  },
  content: {
    flex: 1,
    paddingHorizontal: 16
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8
  },
  cameraBtn: {
    backgroundColor: Theme.colors.primary
  },
  galleryBtn: {
    backgroundColor: Theme.colors.white,
    borderWidth: 1,
    borderColor: Theme.colors.primary
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Theme.colors.white
  },
  selectedPagesContainer: {
    marginTop: 20
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.colors.text
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Theme.colors.textSecondary
  },
  thumbnailStrip: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 16
  },
  thumbnailCard: {
    width: 100,
    height: 130,
    marginRight: 10,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    position: 'relative'
  },
  thumbnailImage: {
    width: '100%',
    height: '100%'
  },
  pageBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  pageBadgeText: {
    color: Theme.colors.white,
    fontSize: 11,
    fontWeight: '600'
  },
  deleteThumbnailBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: Theme.colors.white,
    borderRadius: 10
  },
  scanSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 6
  },
  scanSubmitBtnText: {
    color: Theme.colors.white,
    fontSize: 16,
    fontWeight: '700'
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.text,
    marginTop: 12
  },
  emptySubtitle: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text,
    marginTop: 16
  },
  loadingSubtitle: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6
  },
  imagePreviewHeader: {
    padding: 10,
    backgroundColor: Theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.text
  },
  pageTab: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 4,
    backgroundColor: '#f1f5f9'
  },
  activePageTab: {
    backgroundColor: Theme.colors.primary
  },
  pageTabText: {
    fontSize: 11,
    color: Theme.colors.textSecondary
  },
  activePageTabText: {
    color: Theme.colors.white,
    fontWeight: '600'
  },
  rescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  rescanBtnText: {
    fontSize: 12,
    color: Theme.colors.primary,
    fontWeight: '600'
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: 6,
    backgroundColor: '#f8fafc'
  },
  linesListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border
  },
  linesListTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.colors.text
  },
  linesListSubtitle: {
    fontSize: 12,
    color: Theme.colors.textSecondary
  },
  linesScrollView: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8
  },
  extractedLineCard: {
    backgroundColor: Theme.colors.white,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border
  },
  lineCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  lineIndex: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.primary,
    marginRight: 6
  },
  rawCustomerText: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.text,
    flex: 1
  },
  customerSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    marginBottom: 8
  },
  unmatchedCustomerBtn: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  customerSelectBtnText: {
    fontSize: 12,
    color: Theme.colors.text,
    flex: 1
  },
  lineInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  inputCol: {
    flex: 1
  },
  smallInputLabel: {
    fontSize: 10,
    color: Theme.colors.textSecondary,
    marginBottom: 2
  },
  smallInput: {
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 13,
    textAlign: 'center',
    color: Theme.colors.text,
    backgroundColor: '#fafafa'
  },
  amountCol: {
    flex: 1.3,
    alignItems: 'flex-end'
  },
  lineAmountText: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.primary,
    marginTop: 4
  },
  footerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border
  },
  footerCount: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.text
  },
  footerAttached: {
    fontSize: 11,
    color: Theme.colors.textSecondary
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6
  },
  importBtnText: {
    color: Theme.colors.white,
    fontSize: 14,
    fontWeight: '600'
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20
  },
  pickerContainer: {
    backgroundColor: Theme.colors.white,
    borderRadius: 12,
    padding: 16,
    maxHeight: '80%'
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Theme.colors.text
  },
  pickerSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 14,
    color: Theme.colors.text
  },
  pickerItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  pickerItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.text
  },
  pickerItemAccount: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 2
  }
});
