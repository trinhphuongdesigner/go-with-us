import { apiRequest } from "@/lib/api";
import type { components } from "../../../../contracts/generated/openapi";

export type Roadmap = components["schemas"]["RoadmapRead"];
export type RoadmapSave = components["schemas"]["RoadmapSave"];
export type RoadmapCategory = Roadmap["category"];
export type RoadmapSettings = components["schemas"]["RoadmapSettingsRead"];
export type SettingsPatch = components["schemas"]["RoadmapSettingsPatch"];

const ROOT = "/development-plans/me";

export function listRoadmaps(token: string, category: RoadmapCategory) {
  return apiRequest<Roadmap[]>(`${ROOT}/roadmaps?category=${category}`, undefined, token);
}

export function getRoadmapSettings(token: string) {
  return apiRequest<{ settings: RoadmapSettings }>(ROOT, undefined, token);
}

export function saveRoadmap(token: string, draft: RoadmapSave) {
  return apiRequest<Roadmap>(`${ROOT}/roadmaps`, { method: "POST", body: JSON.stringify(draft) }, token);
}

export function updateRoadmapTask(token: string, roadmap: Roadmap, taskId: string, done: boolean) {
  return apiRequest<Roadmap>(`${ROOT}/roadmaps/${encodeURIComponent(roadmap.id)}/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH", body: JSON.stringify({ expectedVersion: roadmap.version, done }),
  }, token);
}

export function updateRoadmapSettings(token: string, patch: SettingsPatch) {
  return apiRequest<RoadmapSettings>(`${ROOT}/settings`, { method: "PATCH", body: JSON.stringify(patch) }, token);
}

/** Reuse an id on network retries; a changed draft represents a new save intent. */
export function createSaveIntent() {
  let previousBody = "";
  let previousId = "";
  return (draft: Omit<RoadmapSave, "clientRequestId">): RoadmapSave => {
    const body = JSON.stringify(draft);
    if (body !== previousBody) {
      previousBody = body;
      previousId = crypto.randomUUID();
    }
    return { ...draft, clientRequestId: previousId };
  };
}
