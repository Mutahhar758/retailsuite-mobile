import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { Theme } from '../../constants/theme';
import {
  saleService,
  CustomerItemPriceHistoryResponse,
} from '../../services/saleService';

interface CustomerPriceHistorySheetProps {
  accountId: string;
  customerTitle?: string;
  itemId: string;
  itemTitle?: string;
  onApplyRate: (rate: number, secRate?: number) => void;
  onClose: () => void;
}

export const CustomerPriceHistorySheet: React.FC<CustomerPriceHistorySheetProps> = ({
  accountId,
  customerTitle,
  itemId,
  itemTitle,
  onApplyRate,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<CustomerItemPriceHistoryResponse | null>(null);

  useEffect(() => {
    let active = true;
    if (!accountId || !itemId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    saleService
      .getCustomerItemHistory(accountId, itemId, 6)
      .then((res) => {
        if (active) setHistory(res);
      })
      .catch(() => {
        if (active) setHistory(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accountId, itemId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Ionicons name="time-outline" size={16} color={Theme.colors.primary} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            Price History: {itemTitle || itemId}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={17} color={Theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {customerTitle ? (
        <Text style={styles.customerSub} numberOfLines={1}>
          Customer: {customerTitle}
        </Text>
      ) : null}

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>Fetching previous rates...</Text>
        </View>
      ) : !history || !history.hasHistory ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyText}>
            No previous sales found for this customer & item.
          </Text>
        </View>
      ) : (
        <View>
          {/* Last Sale Quick Summary */}
          <View style={styles.lastSaleBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lastSaleLabel}>
                Last Sold ({history.lastSaleDate ? dayjs(history.lastSaleDate).format('DD MMM YY') : 'N/A'})
              </Text>
              <Text style={styles.lastSaleRate}>
                Rs. {(history.lastRate ?? 0).toLocaleString()}
                {history.lastQty ? `  •  Qty: ${history.lastQty}` : ''}
                {history.lastDiscount ? `  •  Disc: ${history.lastDiscount}` : ''}
              </Text>
            </View>
            {history.lastRate !== undefined && (
              <TouchableOpacity
                style={styles.applyBtn}
                onPress={() => {
                  onApplyRate(history.lastRate!, history.lastSecRate);
                  onClose();
                }}
              >
                <Ionicons name="checkmark-circle" size={14} color="#FFF" />
                <Text style={styles.applyBtnText}>Apply Rate</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Recent Sales Rows */}
          {history.recentSales?.slice(0, 4).map((entry, idx) => (
            <View key={`${entry.voucherNo}-${idx}`} style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyRowDate}>
                  {dayjs(entry.date).format('DD MMM YYYY')} • #{entry.voucherNo} ({entry.vType})
                </Text>
                <Text style={styles.historyRowMeta}>
                  Qty: {entry.qty} {entry.unit || ''} × Rs. {entry.rate.toLocaleString()}
                  {entry.discount > 0 ? ` (-${entry.discount})` : ''} = Rs.{' '}
                  {entry.amount.toLocaleString()}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.useRowRateBtn}
                onPress={() => {
                  onApplyRate(entry.rate, entry.secRate);
                  onClose();
                }}
              >
                <Text style={styles.useRowRateText}>Use Rs. {entry.rate}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 10,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  headerTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Theme.colors.text,
    flex: 1,
  },
  closeBtn: {
    padding: 2,
  },
  customerSub: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    marginBottom: 6,
    marginTop: 2,
  },
  centerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  loadingText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
  },
  emptyText: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  lastSaleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    marginBottom: 6,
  },
  lastSaleLabel: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
    fontWeight: '600',
  },
  lastSaleRate: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.primary,
    marginTop: 1,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
  },
  applyBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  historyRowDate: {
    fontSize: 11,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  historyRowMeta: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
  },
  useRowRateBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  useRowRateText: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.colors.primary,
  },
});
