import api from './api';

export const AiActionType = {
  Answer: 'Answer',
  Navigate: 'Navigate',
  DraftVoucher: 'DraftVoucher'
} as const;

export type AiActionType = typeof AiActionType[keyof typeof AiActionType] | string | number;

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiAssistantRequest {
  prompt: string;
  currentRoute?: string;
  activeFilters?: Record<string, string>;
  history?: AiChatMessage[];
}

export interface AiAssistantResponse {
  replyText: string;
  actionType: AiActionType;
  targetRoute?: string;
  actionPayload?: Record<string, any>;
  success: boolean;
  errorMessage?: string;
}

export const aiAssistantService = {
  async chat(request: AiAssistantRequest): Promise<AiAssistantResponse> {
    const response = await api.post('/api/v1/ai/assistant/chat', request, {
      timeout: 45000
    });
    return response.data?.body ?? response.data;
  }
};
