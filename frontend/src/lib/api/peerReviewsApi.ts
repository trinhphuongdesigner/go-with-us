import { apiRequest } from './client';

// Peer Reviews has no shared type in @/types (that file is reserved for the
// foundation-pass resources — see its own header comment), so this module
// owns its own shapes, same as usersApi.ts owns Create/UpdatePayload.

export interface PeerReviewUserSummary {
  id: string;
  name: string;
  jobTitle: string | null;
  avatarUrl: string | null;
}

export interface PeerReviewRatings {
  [criterion: string]: number;
}

export interface GivenPeerReview {
  id: string;
  reviewerId: string;
  revieweeId: string;
  content: string;
  ratings: PeerReviewRatings | null;
  createdAt: string;
  reviewee: PeerReviewUserSummary;
}

export interface ReceivedPeerReview {
  id: string;
  reviewerId: string;
  revieweeId: string;
  content: string;
  ratings: PeerReviewRatings | null;
  createdAt: string;
  reviewer: PeerReviewUserSummary;
}

export interface CreatePeerReviewPayload {
  revieweeId: string;
  content: string;
  ratings?: PeerReviewRatings;
}

export function listGivenReviews() {
  return apiRequest<GivenPeerReview[]>('/peer-reviews/given');
}

export function listReceivedReviews(userId?: string) {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return apiRequest<ReceivedPeerReview[]>(`/peer-reviews/received${query}`);
}

export function createPeerReview(payload: CreatePeerReviewPayload) {
  return apiRequest<GivenPeerReview>('/peer-reviews', { method: 'POST', body: payload });
}
