import { apiRequest } from './client';

export interface AssistantConversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  referencedUserIds: string[];
  createdAt: string;
}

export interface ConversationDetail extends AssistantConversation {
  messages: AssistantMessage[];
}

export interface ReferencedPerson {
  id: string;
  name: string;
  jobTitle: string | null;
  avatarUrl: string | null;
}

export interface AssistantQueryResult {
  conversationId: string;
  message: AssistantMessage;
  /** The people the assistant named, hydrated so the UI can link to them. */
  referenced: ReferencedPerson[];
}

export function listConversations() {
  return apiRequest<AssistantConversation[]>('/assistant/conversations');
}

export function getConversation(id: string) {
  return apiRequest<ConversationDetail>(`/assistant/conversations/${id}`);
}

export function deleteConversation(id: string) {
  return apiRequest<{ id: string }>(`/assistant/conversations/${id}`, {
    method: 'DELETE',
  });
}

export function askAssistant(payload: {
  question: string;
  conversationId?: string;
}) {
  return apiRequest<AssistantQueryResult>('/assistant/query', {
    method: 'POST',
    body: payload,
  });
}
