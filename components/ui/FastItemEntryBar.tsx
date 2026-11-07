import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Theme } from '../../constants/theme';
import { Item } from '../../services/inventoryService';
import { parseBarcodePayload, ParsedBarcodeResult } from '../../utils/barcodeParser';
import { InlineBarcodeCameraStrip } from './InlineBarcodeCameraStrip';

export interface FastItemEntryBarProps {
  items: Item[];
  mode: 'list' | 'grid';
  onModeChange?: (mode: 'list' | 'grid') => void;
  showModeToggle?: boolean;
  onAddItem: (item: Item, qty?: number, customRate?: number, customAmount?: number) => void;
  onDecrementItem?: (itemId: string) => void;
  resolveItemRate?: (item: Item) => number;
  cartQtyMap?: Record<string, number>;
  placeholder?: string;
  rateLabel?: string;
  categoryMap?: Record<string, string> | Map<string, string>;
}

export const FastItemEntryBar: React.FC<FastItemEntryBarProps> = ({
  items,
  mode,
  onModeChange,
  showModeToggle = true,
  onAddItem,
  onDecrementItem,
  resolveItemRate,
  cartQtyMap = {},
  placeholder = 'Scan barcode, 5*code, or search item...',
  categoryMap,
}) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [scanFeedbackError, setScanFeedbackError] = useState<boolean>(false);
  const [cameraOpen, setCameraOpen] = useState<boolean>(false);

  const getRate = (item: Item): number => {
    if (resolveItemRate) return resolveItemRate(item);
    return item.priRate || 0;
  };

  // Categories for POS Grid Mode
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      const code = item.itemCategoryCode || 'OTHER';
      const mapTitle =
        categoryMap instanceof Map ? categoryMap.get(code) : categoryMap?.[code];
      const title =
        (item.itemCategoryTitle && item.itemCategoryTitle.trim()) ||
        mapTitle ||
        code;
      if (!map.has(code)) {
        map.set(code, title);
      }
    }
    return Array.from(map.entries()).map(([code, title]) => ({ code, title }));
  }, [items, categoryMap]);

  // Suggestions for fast search dropdown
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    // Strip multiplier prefix like "5*" when showing live suggestions
    const cleanQ = q.includes('*') ? q.split('*').pop()!.trim() : q;
    if (!cleanQ) return [];

    return items
      .filter(
        (i) =>
          i.title.toLowerCase().includes(cleanQ) ||
          String(i.id).toLowerCase().includes(cleanQ) ||
          (i.barcode && i.barcode.toLowerCase().includes(cleanQ)) ||
          (i.itemKey && i.itemKey.toLowerCase().includes(cleanQ))
      )
      .slice(0, 8);
  }, [items, query]);

  // Filtered items for POS Grid
  const gridItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => {
        if (selectedCategory !== 'ALL' && i.itemCategoryCode !== selectedCategory) {
          return false;
        }
        if (!q) return true;
        return (
          i.title.toLowerCase().includes(q) ||
          String(i.id).toLowerCase().includes(q) ||
          (i.barcode && i.barcode.toLowerCase().includes(q))
        );
      })
      .slice(0, 60);
  }, [items, selectedCategory, query]);

  const triggerFeedback = (msg: string, isError = false) => {
    setScanFeedbackError(isError);
    setScanFeedback(msg);
    setTimeout(() => {
      setScanFeedback((prev) => (prev === msg ? null : prev));
    }, 2200);
  };

  const handleCameraBarcodeScanned = (scannedCode: string, stripMultiplier: number) => {
    // Check if user also typed "5*" in the search input before scanning
    let finalMultiplier = stripMultiplier || 1;
    const raw = query.trim();
    if (raw.endsWith('*')) {
      const maybeNum = parseFloat(raw.slice(0, -1));
      if (!isNaN(maybeNum) && maybeNum > 0) {
        finalMultiplier = maybeNum;
        setQuery('');
      }
    }

    const payloadToParse =
      finalMultiplier > 1 ? `${finalMultiplier}*${scannedCode}` : scannedCode;
    const parsed: ParsedBarcodeResult | null = parseBarcodePayload(payloadToParse, items);

    if (parsed) {
      const resolvedRate =
        parsed.isVariableWeight && parsed.rate !== undefined
          ? parsed.rate
          : getRate(parsed.matchedItem);
      onAddItem(parsed.matchedItem, parsed.qty, resolvedRate, parsed.amount);
      triggerFeedback(`+${parsed.qty} × ${parsed.matchedItem.title}`, false);
    } else {
      triggerFeedback(`Barcode not found: ${scannedCode}`, true);
    }
  };

  const handleSubmitQuery = () => {
    const raw = query.trim();
    if (!raw) return;

    const parsed: ParsedBarcodeResult | null = parseBarcodePayload(raw, items);
    if (parsed) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const resolvedRate =
        parsed.isVariableWeight && parsed.rate !== undefined
          ? parsed.rate
          : getRate(parsed.matchedItem);
      onAddItem(parsed.matchedItem, parsed.qty, resolvedRate, parsed.amount);
      setQuery('');
      triggerFeedback(`Added ${parsed.qty} × ${parsed.matchedItem.title}`);
      return;
    }

    // Fallback to first suggestion if available
    if (suggestions.length > 0) {
      const first = suggestions[0];
      let multQty = 1;
      if (raw.includes('*')) {
        const parts = raw.split('*');
        const maybeNum = parseFloat(parts[0]);
        if (!isNaN(maybeNum) && maybeNum > 0) multQty = maybeNum;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onAddItem(first, multQty, getRate(first));
      setQuery('');
      triggerFeedback(`Added ${multQty} × ${first.title}`);
    }
  };

  const handleSelectSuggestion = (item: Item) => {
    let multQty = 1;
    const raw = query.trim();
    if (raw.includes('*')) {
      const parts = raw.split('*');
      const maybeNum = parseFloat(parts[0]);
      if (!isNaN(maybeNum) && maybeNum > 0) multQty = maybeNum;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onAddItem(item, multQty, getRate(item));
    setQuery('');
    triggerFeedback(`Added ${multQty} × ${item.title}`);
  };

  const parseQuickPresets = (item: Item): number[] => {
    if (!item.quickQtyPresets) return [];
    try {
      const parsed = JSON.parse(item.quickQtyPresets);
      if (Array.isArray(parsed)) {
        return parsed.map(Number).filter((n) => !isNaN(n) && n > 0).slice(0, 4);
      }
    } catch {
      const parts = item.quickQtyPresets
        .split(',')
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !isNaN(n) && n > 0);
      return parts.slice(0, 4);
    }
    return [];
  };

  return (
    <View style={styles.wrapper}>
      {/* Top Search + Mode Toggle Row */}
      <View style={styles.topRow}>
        <View style={styles.searchInputWrap}>
          <TouchableOpacity
            onPress={() => setCameraOpen((prev) => !prev)}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Ionicons
              name="barcode-outline"
              size={19}
              color={cameraOpen ? '#16A34A' : Theme.colors.primary}
            />
          </TouchableOpacity>
          <TextInput
            style={styles.searchInput}
            placeholder={placeholder}
            placeholderTextColor={Theme.colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="go"
            onSubmitEditing={handleSubmitQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={17} color={Theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
          {query.trim().length > 0 && (
            <TouchableOpacity style={styles.goBtn} onPress={handleSubmitQuery}>
              <Ionicons name="return-down-back" size={15} color="#FFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.cameraScanBtn,
              cameraOpen && styles.cameraScanBtnActive,
            ]}
            onPress={() => setCameraOpen((prev) => !prev)}
            activeOpacity={0.75}
          >
            <Ionicons
              name={cameraOpen ? 'camera' : 'camera-outline'}
              size={16}
              color={cameraOpen ? '#FFFFFF' : Theme.colors.primary}
            />
          </TouchableOpacity>
        </View>

        {showModeToggle && onModeChange && (
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'list' && styles.modeBtnActive]}
              onPress={() => onModeChange('list')}
            >
              <Ionicons
                name="list"
                size={16}
                color={mode === 'list' ? '#FFF' : Theme.colors.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'grid' && styles.modeBtnActive]}
              onPress={() => onModeChange('grid')}
            >
              <Ionicons
                name="grid"
                size={15}
                color={mode === 'grid' ? '#FFF' : Theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Inline Live Camera Laser Scanner Strip */}
      <InlineBarcodeCameraStrip
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onBarcodeScanned={handleCameraBarcodeScanned}
        defaultContinuous={true}
        showMultipliers={true}
      />

      {/* Instant Toast Pill on Scan/Add */}
      {scanFeedback ? (
        <View
          style={[
            styles.feedbackBanner,
            scanFeedbackError && styles.feedbackBannerError,
          ]}
        >
          <Ionicons
            name={scanFeedbackError ? 'alert-circle' : 'checkmark-circle'}
            size={14}
            color={scanFeedbackError ? '#DC2626' : '#16A34A'}
          />
          <Text
            style={[
              styles.feedbackText,
              scanFeedbackError && styles.feedbackTextError,
            ]}
          >
            {scanFeedback}
          </Text>
        </View>
      ) : null}

      {/* Inline Autocomplete Dropdown (in List Mode or when typing) */}
      {mode === 'list' && suggestions.length > 0 && (
        <View style={styles.suggestionsCard}>
          <ScrollView
            style={styles.suggestionsScroll}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {suggestions.map((item) => {
              const rate = getRate(item);
              const inCartQty = cartQtyMap[item.id] || 0;
              const unitTitle =
                item.primaryUnitTitle || item.defaultUnitTitle || item.primaryUnit || '';
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.suggestionRow}
                  onPress={() => handleSelectSuggestion(item)}
                >
                  <View style={styles.suggestionInfo}>
                    <View style={styles.suggestionTitleRow}>
                      <Text style={styles.suggestionTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {inCartQty > 0 && (
                        <View style={styles.inCartBadge}>
                          <Text style={styles.inCartBadgeText}>In Bill: {inCartQty}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.suggestionMeta}>
                      ID: {item.id}
                      {item.barcode ? ` • ${item.barcode}` : ''}
                      {unitTitle ? ` • ${unitTitle}` : ''}
                    </Text>
                  </View>
                  <View style={styles.suggestionRight}>
                    <Text style={styles.suggestionRate}>
                      Rs. {rate.toLocaleString()}
                    </Text>
                    <View style={styles.addIconPill}>
                      <Ionicons name="add" size={16} color="#FFF" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Rapid POS Counter Grid Mode */}
      {mode === 'grid' && (
        <View style={styles.gridContainer}>
          {/* Category Filter Chips */}
          {categories.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
              contentContainerStyle={styles.categoryScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <TouchableOpacity
                style={[
                  styles.categoryChip,
                  selectedCategory === 'ALL' && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory('ALL')}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategory === 'ALL' && styles.categoryChipTextActive,
                  ]}
                >
                  All ({items.length})
                </Text>
              </TouchableOpacity>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.code}
                  style={[
                    styles.categoryChip,
                    selectedCategory === cat.code && styles.categoryChipActive,
                  ]}
                  onPress={() => setSelectedCategory(cat.code)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      selectedCategory === cat.code && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Product Tiles Grid */}
          <ScrollView
            style={styles.tilesScroll}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.tilesGrid}>
              {gridItems.map((item) => {
                const rate = getRate(item);
                const qtyInCart = cartQtyMap[item.id] || 0;
                const presets = parseQuickPresets(item);
                const unitLbl =
                  item.primaryUnitTitle || item.defaultUnitTitle || '';

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.tileCard,
                      qtyInCart > 0 && styles.tileCardActive,
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.tileMainTouch}
                      activeOpacity={0.7}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                          () => {}
                        );
                        onAddItem(item, 1, rate);
                      }}
                    >
                      <View style={styles.tileHeader}>
                        <Text style={styles.tileCode} numberOfLines={1}>
                          #{item.id}
                        </Text>
                        {qtyInCart > 0 && (
                          <View style={styles.tileQtyBadge}>
                            <Text style={styles.tileQtyBadgeText}>{qtyInCart}</Text>
                          </View>
                        )}
                      </View>

                      <Text style={styles.tileTitle} numberOfLines={2}>
                        {item.title}
                      </Text>

                      <View style={styles.tileFooter}>
                        <Text style={styles.tileRate}>
                          Rs. {rate.toLocaleString()}
                          {unitLbl ? (
                            <Text style={styles.tileUnit}>/{unitLbl}</Text>
                          ) : null}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Quick Stepper or Preset Chips inside Tile */}
                    {(qtyInCart > 0 || presets.length > 0) && (
                      <View style={styles.tileBottomActions}>
                        {qtyInCart > 0 && onDecrementItem && (
                          <TouchableOpacity
                            style={styles.tileMinusBtn}
                            onPress={() => onDecrementItem(item.id)}
                          >
                            <Ionicons name="remove" size={14} color={Theme.colors.danger} />
                          </TouchableOpacity>
                        )}
                        {presets.map((p) => (
                          <TouchableOpacity
                            key={String(p)}
                            style={styles.presetChip}
                            onPress={() => onAddItem(item, p, rate)}
                          >
                            <Text style={styles.presetChipText}>+{p}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Theme.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 42,
    ...Theme.shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: Theme.colors.text,
    marginLeft: 7,
    paddingVertical: 4,
  },
  clearBtn: {
    padding: 4,
  },
  goBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginLeft: 4,
  },
  cameraScanBtn: {
    width: 30,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  cameraScanBtnActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
  },
  modeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  modeBtnActive: {
    backgroundColor: Theme.colors.primary,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 6,
  },
  feedbackBannerError: {
    backgroundColor: '#FEE2E2',
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
  },
  feedbackTextError: {
    color: '#B91C1C',
  },
  suggestionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginTop: 6,
    overflow: 'hidden',
    ...Theme.shadows.md,
  },
  suggestionsScroll: {
    maxHeight: 240,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  suggestionInfo: {
    flex: 1,
    marginRight: 8,
  },
  suggestionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: Theme.colors.text,
    flexShrink: 1,
  },
  inCartBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  inCartBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  suggestionMeta: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  suggestionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  suggestionRate: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  addIconPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContainer: {
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 8,
  },
  categoryScroll: {
    marginBottom: 8,
  },
  categoryScrollContent: {
    gap: 6,
    paddingRight: 8,
  },
  categoryChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  categoryChipActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  categoryChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  tilesScroll: {
    maxHeight: 280,
  },
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tileCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 9,
    justifyContent: 'space-between',
  },
  tileCardActive: {
    borderColor: Theme.colors.primary,
    backgroundColor: '#F5F3FF',
  },
  tileMainTouch: {
    flex: 1,
  },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  tileCode: {
    fontSize: 10,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  tileQtyBadge: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileQtyBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tileTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Theme.colors.text,
    lineHeight: 16,
    marginBottom: 5,
  },
  tileFooter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  tileRate: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  tileUnit: {
    fontSize: 10,
    fontWeight: '400',
    color: Theme.colors.textSecondary,
  },
  tileBottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
    paddingTop: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  tileMinusBtn: {
    width: 24,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  presetChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
});
