import { apiRequest } from './client';

export type AssistantFocus = 'GENERAL' | 'ROADMAP';

export interface AssistantConversation {
  id: string;
  userId: string;
  title: string;
  focus: AssistantFocus;
  createdAt: string;
  updatedAt: string;
}

export interface RoadmapProposalTask {
  title: string;
  metric?: string;
}

export interface RoadmapProposalMilestone {
  title: string;
  description?: string;
  dueDate?: string;
  tasks: RoadmapProposalTask[];
}

export interface RoadmapProposal {
  milestones: RoadmapProposalMilestone[];
}

export interface AssistantMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  referencedUserIds: string[];
  /** ROADMAP focus only — present once the model has enough to propose. */
  proposalData: RoadmapProposal | null;
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
  /** Only used when starting a new conversation. */
  focus?: AssistantFocus;
}) {
  return apiRequest<AssistantQueryResult>('/assistant/query', {
    method: 'POST',
    body: payload,
  });
}
