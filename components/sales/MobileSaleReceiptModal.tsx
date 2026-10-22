import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Share,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { Theme } from '../../constants/theme';

export interface MobileSaleReceiptLine {
  seq?: number;
  itemTitle: string;
  qty: number;
  unit?: string | null;
  rate: number;
  discount?: number;
  amount: number;
}

export interface MobileSaleReceiptData {
  voucherNo: string;
  date: string | Date;
  customerName?: string;
  customerPhone?: string;
  narration?: string;
  description?: string;
  lines: MobileSaleReceiptLine[];
  grossTotal: number;
  totalDiscount: number;
  netAmount: number;
  cashReceived: number;
  cashBack: number;
  balance?: number;
  orgName?: string;
  isDuplicate?: boolean;
}

interface Props {
  visible: boolean;
  receiptData: MobileSaleReceiptData | null;
  onClose: () => void;
}

export const MobileSaleReceiptModal: React.FC<Props> = ({
  visible,
  receiptData,
  onClose
}) => {
  if (!receiptData) return null;

  const handleShare = async () => {
    const storeName = receiptData.orgName || 'Retail Store';
    const dateStr = dayjs(receiptData.date).format('DD-MMM-YYYY hh:mm A');
    
    let text = `================================\n`;
    text += `         ${storeName.toUpperCase()}\n`;
    text += `       SALE RECEIPT ${receiptData.isDuplicate ? '(DUPLICATE)' : ''}\n`;
    text += `================================\n`;
    text += `Voucher: ${receiptData.voucherNo}\n`;
    text += `Date:    ${dateStr}\n`;
    text += `Customer: ${receiptData.customerName || 'Walk-in Customer'}\n`;
    if (receiptData.narration) text += `Narration: ${receiptData.narration}\n`;
    text += `--------------------------------\n`;
    text += `Item              Qty   Rate   Total\n`;
    text += `--------------------------------\n`;
    
    receiptData.lines.forEach(l => {
      const title = l.itemTitle.length > 15 ? l.itemTitle.substring(0, 15) : l.itemTitle.padEnd(15, ' ');
      const qty = String(l.qty).padStart(4, ' ');
      const rate = l.rate.toFixed(0).padStart(6, ' ');
      const total = l.amount.toFixed(0).padStart(7, ' ');
      text += `${title} ${qty} ${rate} ${total}\n`;
    });
    
    text += `--------------------------------\n`;
    text += `Gross Total:    Rs. ${receiptData.grossTotal.toFixed(2)}\n`;
    if (receiptData.totalDiscount > 0) {
      text += `Discount:      -Rs. ${receiptData.totalDiscount.toFixed(2)}\n`;
    }
    text += `Net Amount:     Rs. ${receiptData.netAmount.toFixed(2)}\n`;
    text += `Cash Received:  Rs. ${receiptData.cashReceived.toFixed(2)}\n`;
    if (receiptData.cashBack > 0) {
      text += `Change Return:  Rs. ${receiptData.cashBack.toFixed(2)}\n`;
    }
    if (receiptData.balance !== undefined && receiptData.balance > 0) {
      text += `Remaining Due:  Rs. ${receiptData.balance.toFixed(2)}\n`;
    }
    text += `================================\n`;
    text += ` Thank you for your business!\n`;
    text += ` Powered by RetailSuite\n`;

    try {
      await Share.share({
        message: text,
        title: `Sale Receipt ${receiptData.voucherNo}`
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="receipt-outline" size={22} color={Theme.colors.primary} />
              <Text style={styles.headerTitle}>Sale Receipt</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Slip Content */}
          <ScrollView style={styles.slipScroll} contentContainerStyle={styles.slipContent}>
            <View style={styles.slipCard}>
              <Text style={styles.storeTitle}>{(receiptData.orgName || 'Retail Store').toUpperCase()}</Text>
              <Text style={styles.receiptSub}>SALE RECEIPT</Text>
              {receiptData.isDuplicate && (
                <View style={styles.dupBadge}>
                  <Text style={styles.dupBadgeText}>*** DUPLICATE / REPRINT ***</Text>
                </View>
              )}

              <View style={styles.divider} />

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Voucher:</Text>
                <Text style={styles.metaVal}>{receiptData.voucherNo}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Date:</Text>
                <Text style={styles.metaVal}>{dayjs(receiptData.date).format('DD-MMM-YYYY hh:mm A')}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Customer:</Text>
                <Text style={styles.metaVal}>{receiptData.customerName || 'Walk-in Customer'}</Text>
              </View>

              <View style={styles.divider} />

              {/* Items Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.colHeader, { flex: 2 }]}>Item</Text>
                <Text style={[styles.colHeader, { flex: 1, textAlign: 'center' }]}>Qty</Text>
                <Text style={[styles.colHeader, { flex: 1, textAlign: 'right' }]}>Rate</Text>
                <Text style={[styles.colHeader, { flex: 1.2, textAlign: 'right' }]}>Total</Text>
              </View>

              {/* Items Rows */}
              {receiptData.lines.map((l, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.itemTitle}>{l.itemTitle}</Text>
                    {l.discount && l.discount > 0 ? (
                      <Text style={styles.itemDiscount}>Disc: -Rs.{l.discount}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.itemText, { flex: 1, textAlign: 'center' }]}>{l.qty} {l.unit || ''}</Text>
                  <Text style={[styles.itemText, { flex: 1, textAlign: 'right' }]}>{l.rate.toFixed(0)}</Text>
                  <Text style={[styles.itemAmount, { flex: 1.2, textAlign: 'right' }]}>{l.amount.toFixed(2)}</Text>
                </View>
              ))}

              <View style={styles.divider} />

              {/* Totals Summary */}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Gross Total:</Text>
                <Text style={styles.totalVal}>Rs. {receiptData.grossTotal.toFixed(2)}</Text>
              </View>
              {receiptData.totalDiscount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: '#16a34a' }]}>Discount:</Text>
                  <Text style={[styles.totalVal, { color: '#16a34a' }]}>-Rs. {receiptData.totalDiscount.toFixed(2)}</Text>
                </View>
              )}
              <View style={[styles.totalRow, styles.netRow]}>
                <Text style={styles.netLabel}>Net Bill:</Text>
                <Text style={styles.netVal}>Rs. {receiptData.netAmount.toFixed(2)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Cash Received:</Text>
                <Text style={styles.totalVal}>Rs. {receiptData.cashReceived.toFixed(2)}</Text>
              </View>
              {receiptData.cashBack > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Change Return:</Text>
                  <Text style={styles.totalVal}>Rs. {receiptData.cashBack.toFixed(2)}</Text>
                </View>
              )}
              {receiptData.balance !== undefined && receiptData.balance > 0 && (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: '#dc2626', fontWeight: '700' }]}>Remaining Due:</Text>
                  <Text style={[styles.totalVal, { color: '#dc2626', fontWeight: '700' }]}>Rs. {receiptData.balance.toFixed(2)}</Text>
                </View>
              )}

              <View style={styles.divider} />
              <Text style={styles.thankYou}>Thank you for your business!</Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Done</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.shareBtnText}>Print / Share</Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  container: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a'
  },
  slipScroll: {
    backgroundColor: '#f8fafc'
  },
  slipContent: {
    padding: 16
  },
  slipCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center'
  },
  storeTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center'
  },
  receiptSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
    letterSpacing: 1
  },
  dupBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ef4444',
    borderStyle: 'dashed'
  },
  dupBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ef4444'
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 10
  },
  metaRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  metaLabel: {
    fontSize: 12,
    color: '#64748b'
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a'
  },
  tableHeader: {
    width: '100%',
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1'
  },
  colHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569'
  },
  tableRow: {
    width: '100%',
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    alignItems: 'center'
  },
  itemTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a'
  },
  itemDiscount: {
    fontSize: 10,
    color: '#16a34a'
  },
  itemText: {
    fontSize: 12,
    color: '#334155'
  },
  itemAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a'
  },
  totalRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  totalLabel: {
    fontSize: 13,
    color: '#475569'
  },
  totalVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a'
  },
  netRow: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 6,
    marginVertical: 4
  },
  netLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a'
  },
  netVal: {
    fontSize: 15,
    fontWeight: '800',
    color: Theme.colors.primary
  },
  thankYou: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center'
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  closeBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569'
  },
  shareBtn: {
    flex: 2,
    height: 44,
    borderRadius: 8,
    backgroundColor: Theme.colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff'
  }
});
