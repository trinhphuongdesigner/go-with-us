import { API_URL, apiRequest } from "@/lib/api";
import type { Session } from "@/lib/types";

export type PersonalDetails = { version: number; avatarAssetId: string | null; contributionScore: number; phone?: string | null; dateOfBirth?: string | null; idNumber?: string | null; gender?: string | null; emergencyContactName?: string | null; emergencyContactPhone?: string | null; onboardDate?: string | null; attitudeScore?: number | null; contributionAdjustment?: number | null };
export type Asset = { id: string; filename: string; mimeType: string; size: number; purpose: "AVATAR" | "EVIDENCE"; downloadPath: string };
export type Activity = { id: string; title: string; description: string | null; category: string | null; date: string; evidenceUrl: string | null; evidenceAssetId: string | null; version: number };
export type Employment = { id: string; title: string; startDate: string; endDate: string | null; status: "ACTIVE" | "ENDED"; version: number };
export type HrRequest = { id: string; senderId: string; recipientId: string; sourceType: "CERTIFICATION" | "AWARD"; sourceId: string; sourceSnapshot: Record<string, string | null>; message: string | null; status: "PENDING" | "APPROVED" | "REJECTED"; pointsAwarded: number; reviewNote: string | null; createdAt: string; reviewedAt: string | null; sender: { id: string; name: string; email: string } | null };
export type HrOptions = { employments: Array<{ id: string; title: string; companyId: string; companyName: string }>; recipients: Array<{ id: string; name: string; companyId: string }> };

export const extensionApi = <T>(session: Session, path: string, method = "GET", body?: unknown) => apiRequest<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, session.accessToken);
export async function uploadAsset(session: Session, file: File, purpose: "AVATAR" | "EVIDENCE"): Promise<Asset> {
  const body = new FormData(); body.append("file", file);
  return apiRequest<Asset>(`/profile-extensions/assets?purpose=${purpose}`, { method: "POST", body }, session.accessToken);
}
export async function assetBlob(session: Session, id: string) {
  const response = await fetch(`${API_URL}/profile-extensions/assets/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${session.accessToken}` } });
  if (!response.ok) throw new Error("Chưa thể tải tệp. Kiểm tra quyền truy cập và thử lại.");
  return response.blob();
}
export async function downloadAsset(session: Session, id: string, filename = "minh-chung") {
  const url = URL.createObjectURL(await assetBlob(session, id));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function assetIdFromUrl(url: string) { return url.match(/\/profile-extensions\/assets\/([\da-f-]{36})(?:$|[?#])/i)?.[1]; }
