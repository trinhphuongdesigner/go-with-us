import { apiRequest } from './client';
import type { AiProvider, AiSetting } from '@/types';

export interface UpsertAiSettingPayload {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export function listAiSettings() {
  return apiRequest<AiSetting[]>('/ai-settings');
}

export function getAiSetting(provider: AiProvider) {
  return apiRequest<AiSetting>(`/ai-settings/${provider}`);
}

export function upsertAiSetting(provider: AiProvider, payload: UpsertAiSettingPayload) {
  return apiRequest<AiSetting>(`/ai-settings/${provider}`, { method: 'PUT', body: payload });
}

export function deleteAiSetting(provider: AiProvider) {
  return apiRequest<{ provider: AiProvider }>(`/ai-settings/${provider}`, { method: 'DELETE' });
}
