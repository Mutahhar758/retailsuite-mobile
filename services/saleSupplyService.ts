import api from './api';
import axios from 'axios';
import { Platform } from 'react-native';

export interface SaleSupply {
  date: string;
  voucherNo: string;
  item: string;
  createdBy: string;
  createdOn: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
  supplyOrderMasterId?: number;
  supplyOrderTitle?: string;
}

export interface SaleSupplyLine {
  seq: number;
  date: string;
  voucherNo: string;
  itemId: string;
  itemTitle?: string;
  narration?: string;
  narrationId?: string;
  description?: string;
  supplyOrderMasterId?: number;
  customerId: string;
  customerTitle?: string;
  subAccountId?: string;
  subAccountTitle?: string;
  unit?: string;
  qty: number;
  rate: number;
  discount: number;
  addLess: number;
  carriage?: number;
  amount: number;
  secQty?: number;
  secRate?: number;
  secUnit?: string;
  qtyInPack?: number;
  packing?: number;
  createdBy: string;
  createdOn: string;
  lastModifiedBy?: string;
  lastModifiedOn?: string;
}

export interface SaleSupplyLineRequest {
  seq: number;
  customerId: string;
  unit?: string;
  qty: number;
  rate: number;
  discount: number;
  addLess: number;
  carriage?: number;
  secQty?: number;
  secRate?: number;
  secUnit?: string;
  qtyInPack?: number | null;
  packing?: number | null;
  packQty?: number;
}

export interface SaleSupplyCustomerLineUpdateRequest {
  voucherNo: string;
  seq: number;
  line: SaleSupplyLineRequest;
}

export interface SaleSupplyCreateRequest {
  date: string;
  itemId: string;
  supplyOrderMasterId?: number;
  narration?: string;
  description?: string;
  lines: SaleSupplyLineRequest[];
  attachmentMediaIds?: string[];
}

export interface SaleSupplyUpdateRequest {
  date: string;
  itemId: string;
  supplyOrderMasterId?: number;
  narration?: string;
  description?: string;
  lines: SaleSupplyLineRequest[];
  attachmentMediaIds?: string[];
}

export interface ScannedSaleSupplyLine {
  seq: number;
  rawCustomerName: string;
  matchedCustomerId?: string | null;
  matchedCustomerName?: string | null;
  qty: number;
  rate: number;
  discount: number;
  addLess: number;
  carriage: number;
  amount: number;
  isCustomerMatched: boolean;
}

export interface SaleSupplyScanResponse {
  lines: ScannedSaleSupplyLine[];
  remainingScansThisMonth: number;
  monthlyLimit: number;
  rawDetectedText?: string;
}

export interface SaleSupplyAttachment {
  id: number;
  vType?: string;
  vNo?: string;
  mediaId: string;
  fileName: string;
  fileUrl?: string;
  downloadUrl?: string;
  description?: string;
  createdOn: string;
  createdBy?: string;
}

export const saleSupplyService = {
  async getList(params?: {
    fromDate?: string;
    toDate?: string;
    itemId?: string;
    voucherNo?: string;
    searchTerm?: string;
  }) {
    const response = await api.get('/api/SaleSupplies', { params });
    return response.data.body as SaleSupply[];
  },

  async getDetail(voucherNo: string) {
    const response = await api.get(`/api/SaleSupplies/${voucherNo}`);
    return response.data.body as SaleSupplyLine[];
  },

  async getCustomerLines(params: {
    customerId: string;
    fromDate?: string;
    toDate?: string;
    itemId?: string;
  }) {
    const response = await api.get('/api/SaleSupplies/customer-records', { params });
    return response.data.body as SaleSupplyLine[];
  },

  async create(request: SaleSupplyCreateRequest) {
    const response = await api.post('/api/SaleSupplies', request);
    return response.data.body as string;
  },

  async update(voucherNo: string, request: SaleSupplyUpdateRequest) {
    await api.put(`/api/SaleSupplies/${voucherNo}`, request);
  },

  async updateLine(voucherNo: string, seq: number, request: SaleSupplyLineRequest) {
    await api.put(`/api/SaleSupplies/${voucherNo}/lines/${seq}`, request);
  },

  async updateCustomerLines(requests: SaleSupplyCustomerLineUpdateRequest[]) {
    await api.put('/api/SaleSupplies/customer-lines', requests);
  },

  async delete(voucherNo: string) {
    await api.delete(`/api/SaleSupplies/${voucherNo}`);
  },

  async deleteLine(voucherNo: string, seq: number) {
    await api.delete(`/api/SaleSupplies/${voucherNo}/lines/${seq}`);
  },

  async scanSheet(
    images: Array<{ uri: string; name?: string; type?: string }>,
    targetDate?: string
  ) {
    const formData = new FormData();
    for (const img of images) {
      const fileName = img.name || 'sheet.jpg';
      const fileType = img.type || (fileName.endsWith('.png') ? 'image/png' : 'image/jpeg');
      formData.append('files', {
        uri: Platform.OS === 'ios' ? img.uri.replace('file://', '') : img.uri,
        name: fileName,
        type: fileType,
      } as any);
    }

    if (targetDate) {
      formData.append('targetDate', targetDate);
    }

    const response = await api.post('/api/SaleSupplies/scan-sheet', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000 // 2 minutes timeout for AI vision scan
    });
    return response.data.body as SaleSupplyScanResponse;
  },

  async getAttachmentUploadUrl(fileName: string) {
    const response = await api.post('/api/SaleSupplies/attachments/presigned-upload-url', null, { params: { fileName } });
    const data = response?.data?.body;
    if (!data?.uploadUrl) {
      throw new Error(response?.data?.metadata?.message || 'Server did not return a valid upload URL for the attachment.');
    }
    return data as { fileId: string; uploadUrl: string; expiresAt?: string };
  },

  async uploadAttachmentDirect(uri: string, fileName: string): Promise<{ mediaId: string; fileName: string }> {
    const { fileId, uploadUrl } = await this.getAttachmentUploadUrl(fileName);
    const formData = new FormData();
    const fileType = fileName.endsWith('.png') ? 'image/png' : 'image/jpeg';
    formData.append('File', {
      uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
      name: fileName,
      type: fileType,
    } as any);

    await axios.post(uploadUrl, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return { mediaId: fileId, fileName };
  },

  async getAttachments(voucherNo: string) {
    const response = await api.get(`/api/SaleSupplies/${voucherNo}/attachments`);
    return response.data.body as SaleSupplyAttachment[];
  },

  async addAttachment(voucherNo: string, request: { mediaId: string; fileName?: string; description?: string }) {
    const response = await api.post(`/api/SaleSupplies/${voucherNo}/attachments`, {
      vNo: voucherNo,
      vType: 'SP',
      ...request
    });
    return response.data.body as SaleSupplyAttachment;
  },

  async deleteAttachment(voucherNo: string, attachmentId: number) {
    await api.delete(`/api/SaleSupplies/${voucherNo}/attachments/${attachmentId}`);
  }
};
