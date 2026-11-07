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
import { Theme } from '../../constants/theme';

export interface InlineSelectOption {
  id?: string;
  value?: string;
  title?: string;
  label?: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  raw?: any;
}

interface InlineSearchSelectProps {
  label?: string;
  placeholder?: string;
  value?: string | null;
  displayValue?: string;
  options: InlineSelectOption[];
  onSelect: (id: string, option?: InlineSelectOption) => void;
  allowClear?: boolean;
  clearable?: boolean;
  allowCustomText?: boolean;
  disabled?: boolean;
  compact?: boolean;
  maxVisibleResults?: number;
  rightAccessory?: React.ReactNode;
  icon?: keyof typeof Ionicons.glyphMap | string;
}

const getOptionId = (o: InlineSelectOption): string => o.id ?? o.value ?? '';
const getOptionTitle = (o: InlineSelectOption): string => o.title ?? o.label ?? '';

export const InlineSearchSelect: React.FC<InlineSearchSelectProps> = ({
  label,
  placeholder = 'Select...',
  value,
  displayValue,
  options,
  onSelect,
  allowClear = false,
  clearable = false,
  allowCustomText = false,
  disabled = false,
  compact = false,
  maxVisibleResults = 25,
  rightAccessory,
  icon,
}) => {
  const canClear = allowClear || clearable;
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');

  const selectedOption = useMemo(
    () => options.find((o) => getOptionId(o) === value),
    [options, value]
  );

  const resolvedLabel =
    displayValue ??
    (selectedOption ? getOptionTitle(selectedOption) : undefined) ??
    (allowCustomText && value ? value : '');

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options.slice(0, maxVisibleResults);
    return options
      .filter((o) => {
        const title = getOptionTitle(o).toLowerCase();
        const id = getOptionId(o).toLowerCase();
        return (
          title.includes(q) ||
          id.includes(q) ||
          (o.subtitle && o.subtitle.toLowerCase().includes(q))
        );
      })
      .slice(0, maxVisibleResults);
  }, [options, search, maxVisibleResults]);

  const handleToggle = () => {
    if (disabled) return;
    if (!expanded) {
      setSearch(allowCustomText && value && !selectedOption ? value : '');
    }
    setExpanded((prev) => !prev);
  };

  const handlePick = (opt: InlineSelectOption) => {
    onSelect(getOptionId(opt), opt);
    setExpanded(false);
    setSearch('');
  };

  const handleClear = () => {
    onSelect('', undefined);
    setSearch('');
    setExpanded(false);
  };

  const handleCommitCustom = () => {
    if (allowCustomText) {
      onSelect(search.trim(), undefined);
      setExpanded(false);
    }
  };

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text>
          {rightAccessory}
        </View>
      ) : null}

      {!expanded ? (
        <TouchableOpacity
          style={[
            styles.trigger,
            compact && styles.triggerCompact,
            disabled && styles.triggerDisabled,
            !!resolvedLabel && styles.triggerSelected,
          ]}
          onPress={handleToggle}
          activeOpacity={0.75}
          disabled={disabled}
        >
          <View style={styles.triggerContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {icon ? (
                <Ionicons
                  name={icon as any}
                  size={15}
                  color={resolvedLabel ? Theme.colors.primary : Theme.colors.textSecondary}
                />
              ) : null}
              <Text
                style={[
                  styles.triggerText,
                  compact && styles.triggerTextCompact,
                  !resolvedLabel && styles.placeholderText,
                  { flex: 1 },
                ]}
                numberOfLines={1}
              >
                {resolvedLabel || placeholder}
              </Text>
            </View>
            {selectedOption?.subtitle ? (
              <Text style={styles.triggerSubtitle} numberOfLines={1}>
                {selectedOption.subtitle}
              </Text>
            ) : null}
          </View>

          <View style={styles.triggerActions}>
            {selectedOption?.badge ? (
              <View
                style={[
                  styles.badge,
                  selectedOption.badgeColor
                    ? { backgroundColor: selectedOption.badgeColor + '20' }
                    : undefined,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    selectedOption.badgeColor
                      ? { color: selectedOption.badgeColor }
                      : undefined,
                  ]}
                >
                  {selectedOption.badge}
                </Text>
              </View>
            ) : null}

            {canClear && !!resolvedLabel && !disabled ? (
              <TouchableOpacity
                onPress={handleClear}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.clearBtn}
              >
                <Ionicons name="close-circle" size={17} color={Theme.colors.textSecondary} />
              </TouchableOpacity>
            ) : null}

            <Ionicons
              name="chevron-down"
              size={16}
              color={Theme.colors.textSecondary}
            />
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.expandedBox}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={Theme.colors.primary} />
            <TextInput
              style={styles.searchInput}
              placeholder={
                allowCustomText
                  ? `${placeholder} (type or pick below)`
                  : `Search ${label || 'options'}...`
              }
              placeholderTextColor={Theme.colors.textSecondary}
              value={search}
              onChangeText={(txt) => {
                setSearch(txt);
                if (allowCustomText) {
                  onSelect(txt, undefined);
                }
              }}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                if (filteredOptions.length === 1 && !allowCustomText) {
                  handlePick(filteredOptions[0]);
                } else if (allowCustomText) {
                  handleCommitCustom();
                } else {
                  setExpanded(false);
                }
              }}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.clearSearchBtn}>
                <Ionicons name="close-circle" size={16} color={Theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setExpanded(false)}
              style={styles.closeBtn}
            >
              <Ionicons name="chevron-up" size={18} color={Theme.colors.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.optionsList}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {allowCustomText && search.trim().length > 0 && (
              <TouchableOpacity
                style={[styles.optionRow, styles.customOptionRow]}
                onPress={handleCommitCustom}
              >
                <Ionicons name="create-outline" size={15} color={Theme.colors.primary} />
                <Text style={styles.customOptionText} numberOfLines={1}>
                  Use &ldquo;{search.trim()}&rdquo;
                </Text>
              </TouchableOpacity>
            )}

            {filteredOptions.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No matching results</Text>
              </View>
            ) : (
              filteredOptions.map((item) => {
                const itemId = getOptionId(item);
                const itemTitle = getOptionTitle(item);
                const isSelected = itemId === value;
                return (
                  <TouchableOpacity
                    key={itemId}
                    style={[
                      styles.optionRow,
                      isSelected && styles.optionRowSelected,
                    ]}
                    onPress={() => handlePick(item)}
                  >
                    <View style={styles.optionTextCol}>
                      <Text
                        style={[
                          styles.optionTitle,
                          isSelected && styles.optionTitleSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {itemTitle}
                      </Text>
                      {item.subtitle ? (
                        <Text style={styles.optionSubtitle} numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    {item.badge ? (
                      <View
                        style={[
                          styles.badge,
                          item.badgeColor
                            ? { backgroundColor: item.badgeColor + '20' }
                            : undefined,
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            item.badgeColor ? { color: item.badgeColor } : undefined,
                          ]}
                        >
                          {item.badge}
                        </Text>
                      </View>
                    ) : null}
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={17}
                        color={Theme.colors.primary}
                        style={{ marginLeft: 6 }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  containerCompact: {
    marginBottom: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.textSecondary,
  },
  labelCompact: {
    fontSize: 11,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    minHeight: 40,
  },
  triggerCompact: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    minHeight: 34,
    borderRadius: 8,
  },
  triggerSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
  },
  triggerDisabled: {
    opacity: 0.6,
    backgroundColor: '#F1F5F9',
  },
  triggerContent: {
    flex: 1,
    marginRight: 6,
  },
  triggerText: {
    fontSize: 14,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  triggerTextCompact: {
    fontSize: 13,
  },
  placeholderText: {
    fontWeight: '400',
    color: Theme.colors.textSecondary,
  },
  triggerSubtitle: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginTop: 1,
  },
  triggerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clearBtn: {
    padding: 2,
  },
  badge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  expandedBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Theme.colors.primary,
    borderRadius: 10,
    overflow: 'hidden',
    ...Theme.shadows.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Theme.colors.text,
    marginLeft: 6,
    paddingVertical: 4,
  },
  clearSearchBtn: {
    padding: 4,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 2,
  },
  optionsList: {
    maxHeight: 200,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  optionRowSelected: {
    backgroundColor: '#EEF2FF',
  },
  customOptionRow: {
    backgroundColor: '#F5F3FF',
    justifyContent: 'flex-start',
    gap: 6,
  },
  customOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.colors.primary,
    flex: 1,
  },
  optionTextCol: {
    flex: 1,
    marginRight: 8,
  },
  optionTitle: {
    fontSize: 13.5,
    fontWeight: '500',
    color: Theme.colors.text,
  },
  optionTitleSelected: {
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  optionSubtitle: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginTop: 1,
  },
  emptyBox: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
});
