import { apiRequest } from "@/lib/api";
import type { RoadmapCategory, RoadmapSave } from "@/features/roadmap/roadmap-api";

export type Connection = { provider: "ANTHROPIC" | "OPENAI" | "GEMINI"; hasKey: boolean; baseUrl: string | null; model: string | null; source: "database" | "environment" | "none" };
export type GoalDraft = { title: string; category: RoadmapCategory; description: string | null; metric: string | null; targetValue: number | null; currentValue: number | null; progress: number; dueDate: string | null; status: "NOT_STARTED" | "IN_PROGRESS" | "ACHIEVED"; aiSuggested: boolean };
export type Goal = GoalDraft & { id: string; roadmapId: string | null; createdAt: string; updatedAt: string };
export type Plan = { id: string; category: RoadmapCategory; version: number; content: string; summary: string | null; aiGenerated: boolean; createdAt: string };
// Proposals describe content; provenance is supplied only at the explicit save boundary.
export type Proposal = Omit<RoadmapSave, "clientRequestId" | "aiSuggested">;
export type Conversation = { id: string; title: string; focus: "GENERAL" | "ROADMAP"; category: RoadmapCategory; pinned: boolean; updatedAt: string };
export type Message = { id: string; role: string; content: string; referencedUserIds: string[]; proposalData: Proposal | null; createdAt: string };
export const careerRequest = <T,>(token: string, path: string, method = "GET", body?: unknown) => apiRequest<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, token);
