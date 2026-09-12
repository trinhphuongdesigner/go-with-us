import type {
  CoreProfile,
  EmployeeSkillListRead,
  EmployeeSkillReplace,
  PeopleCompanyScope,
  PeopleList,
  PeopleQuery,
  PersonDetail,
  ProfileResourceCreate,
  ProfileResourceKind,
  ProfileResourcePatch,
  ProfileResourceRead,
  ProfileUpdateRequest,
} from "@/lib/api";
import type { Session } from "@/lib/types";

const employeeProfile: CoreProfile = {
  id: "demo-employee",
  name: "Nguyễn Khánh Linh",
  jobTitle: "Product Designer",
  initials: "KL",
  companyName: "Acme Việt Nam",
  profileVersion: 4,
  updatedAt: "2026-09-11T08:30:00.000Z",
  skills: [
    { id: "employee-skill-product-discovery", skillId: "skill-product-discovery", name: "Product discovery", level: 4, sourceType: "SELF" },
    { id: "employee-skill-prototyping", skillId: "skill-prototyping", name: "Prototyping", level: 4, sourceType: "IMPORT" },
    { id: "employee-skill-research", skillId: "skill-research", name: "User research", level: 3, sourceType: "SELF" },
  ],
  experiences: [
    { id: "experience-acme", title: "Product Designer", organization: "Acme Việt Nam", startDate: "2024-01-01", endDate: null },
  ],
  projects: [
    { id: "project-careermate", name: "CareerMate", role: "Product Designer", startDate: "2026-06-01", endDate: null },
  ],
  certifications: [{ id: "cert-design", name: "Google UX Design", issuer: "Google", issuedAt: "2024-06-01" }],
  awards: [],
  employments: [],
  timeline: [
    { id: "timeline-careermate", kind: "PROJECT", title: "Ra mắt CareerMate", subtitle: "Product Designer", startDate: "2026-06-01", endDate: null, sourceType: "IMPORT" },
    { id: "timeline-acme", kind: "EXPERIENCE", title: "Gia nhập Acme Việt Nam", subtitle: "Product Designer", startDate: "2024-01-01", endDate: null, sourceType: "SELF" },
  ],
};

const adminProfile: CoreProfile = {
  ...employeeProfile,
  id: "demo-company-admin",
  name: "Trần Minh An",
  jobTitle: "People Operations Manager",
  initials: "MA",
  profileVersion: 3,
  skills: [{ id: "employee-skill-people-ops", skillId: "skill-people-ops", name: "People operations", level: 4, sourceType: "SELF" }],
  experiences: [{ id: "experience-people-ops", title: "People Operations Manager", organization: "Acme Việt Nam", startDate: "2023-03-01", endDate: null }],
  projects: [],
  certifications: [],
  timeline: [{ id: "timeline-people-ops", kind: "EXPERIENCE", title: "Dẫn dắt People Operations", subtitle: "Acme Việt Nam", startDate: "2023-03-01", endDate: null, sourceType: "SELF" }],
};

const engineerProfile: CoreProfile = {
  ...employeeProfile,
  id: "demo-engineer",
  name: "Lê Hoàng Nam",
  jobTitle: "Senior Engineer",
  initials: "HN",
  profileVersion: 7,
  skills: [
    { id: "employee-skill-typescript", skillId: "skill-typescript", name: "TypeScript", level: 5, sourceType: "SELF" },
    { id: "employee-skill-system-design", skillId: "skill-system-design", name: "System design", level: 4, sourceType: "SELF" },
  ],
  experiences: [{ id: "experience-engineer", title: "Senior Engineer", organization: "Acme Việt Nam", startDate: "2022-08-01", endDate: null }],
  projects: [{ id: "project-platform", name: "People Data Platform", role: "Tech Lead", startDate: "2025-02-01", endDate: null }],
  certifications: [],
  timeline: [{ id: "timeline-platform", kind: "PROJECT", title: "People Data Platform", subtitle: "Tech Lead", startDate: "2025-02-01", endDate: null, sourceType: "SELF" }],
};

const fallbackProfiles = new Map([
  [employeeProfile.id, employeeProfile],
  [adminProfile.id, adminProfile],
  [engineerProfile.id, engineerProfile],
]);
const memoryProfiles = new Map<string, CoreProfile>();

function keyFor(userId: string) {
  return `careermate-v2-core-profile:${userId}`;
}

function browserStorage() {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return null;
  return window.localStorage;
}

function readStored(userId: string): CoreProfile | undefined {
  const storage = browserStorage();
  if (!storage) return memoryProfiles.get(userId);
  const saved = storage.getItem(keyFor(userId));
  if (!saved) return memoryProfiles.get(userId);
  try {
    return JSON.parse(saved) as CoreProfile;
  } catch {
    storage.removeItem(keyFor(userId));
    return undefined;
  }
}

function writeStored(profile: CoreProfile) {
  memoryProfiles.set(profile.id, structuredClone(profile));
  browserStorage()?.setItem(keyFor(profile.id), JSON.stringify(profile));
}

function profileFor(userId: string): CoreProfile {
  const saved = readStored(userId);
  if (saved) return structuredClone(saved);
  const fallback = fallbackProfiles.get(userId) ?? employeeProfile;
  const profile = structuredClone(fallback);
  if (profile.id !== userId) profile.id = userId;
  return profile;
}

export function getDemoOwnProfile(session: Session): CoreProfile {
  return profileFor(session.user.id);
}

export function updateDemoOwnProfile(session: Session, request: ProfileUpdateRequest): CoreProfile {
  const current = profileFor(session.user.id);
  if (request.profileVersion !== current.profileVersion) {
    throw Object.assign(new Error("Phiên hồ sơ đã thay đổi"), {
      status: 409,
      details: { detail: "Phiên hồ sơ đã thay đổi", currentProfileVersion: current.profileVersion },
    });
  }
  const next: CoreProfile = {
    ...current,
    name: request.name.trim(),
    jobTitle: request.jobTitle?.trim() ?? "",
    initials: request.name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase(),
    profileVersion: current.profileVersion + 1,
    updatedAt: new Date().toISOString(),
  };
  writeStored(next);
  return structuredClone(next);
}

function requireDemoVersion(current: CoreProfile, profileVersion: number) {
  if (profileVersion !== current.profileVersion) {
    throw Object.assign(new Error("Phiên hồ sơ đã thay đổi"), {
      status: 409,
      details: { detail: "Phiên hồ sơ đã thay đổi", currentProfileVersion: current.profileVersion },
    });
  }
}

function resourceTitle(kind: ProfileResourceKind, value: Record<string, unknown>) {
  if (kind === "experiences") return String(value.title ?? "Kinh nghiệm");
  return String(value.name ?? "Nội dung hồ sơ");
}

function demoResource(
  session: Session,
  kind: ProfileResourceKind,
  resourceId: string,
  value: Record<string, unknown>,
): ProfileResourceRead {
  const now = new Date().toISOString();
  return {
    id: resourceId,
    ...value,
    sourceType: "SELF",
    sourceImportId: null,
    proposalItemId: null,
    createdBy: session.user.id,
    updatedBy: session.user.id,
    createdAt: now,
    updatedAt: now,
    version: 1,
  } as unknown as ProfileResourceRead;
}

export function createDemoProfileResource(
  session: Session,
  kind: ProfileResourceKind,
  payload: ProfileResourceCreate,
): ProfileResourceRead {
  const current = profileFor(session.user.id);
  const values = payload as unknown as Record<string, unknown>;
  requireDemoVersion(current, Number(values.profileVersion));
  const resourceId = `demo-${kind}-${crypto.randomUUID()}`;
  const resource = demoResource(session, kind, resourceId, values);
  const next = { ...current, profileVersion: current.profileVersion + 1, updatedAt: new Date().toISOString() };
  const existing = current[kind] as unknown as Array<Record<string, unknown>>;
  next[kind] = [...existing, resource] as never;
  writeStored(next);
  return resource;
}

export function updateDemoProfileResource(
  session: Session,
  kind: ProfileResourceKind,
  resourceId: string,
  payload: ProfileResourcePatch,
): ProfileResourceRead {
  const current = profileFor(session.user.id);
  const values = payload as unknown as Record<string, unknown>;
  requireDemoVersion(current, Number(values.profileVersion));
  const existing = current[kind] as unknown as Array<Record<string, unknown>>;
  const found = existing.find((item) => item.id === resourceId);
  if (!found) throw Object.assign(new Error("Không tìm thấy nội dung hồ sơ"), { status: 404 });
  const updated: Record<string, unknown> = {
    ...found,
    ...values,
    id: resourceId,
    updatedAt: new Date().toISOString(),
    updatedBy: session.user.id,
    version: Number(found.version ?? 1) + 1,
  };
  delete updated.profileVersion;
  const next = { ...current, profileVersion: current.profileVersion + 1, updatedAt: new Date().toISOString() };
  next[kind] = existing.map((item) => item.id === resourceId ? updated : item) as never;
  writeStored(next);
  return updated as unknown as ProfileResourceRead;
}

export function deleteDemoProfileResource(
  session: Session,
  kind: ProfileResourceKind,
  resourceId: string,
  profileVersion: number,
) {
  const current = profileFor(session.user.id);
  requireDemoVersion(current, profileVersion);
  const existing = current[kind] as unknown as Array<Record<string, unknown>>;
  if (!existing.some((item) => item.id === resourceId)) {
    throw Object.assign(new Error("Không tìm thấy nội dung hồ sơ"), { status: 404 });
  }
  const next = { ...current, profileVersion: current.profileVersion + 1, updatedAt: new Date().toISOString() };
  next[kind] = existing.filter((item) => item.id !== resourceId) as never;
  writeStored(next);
}

export function replaceDemoEmployeeSkills(
  session: Session,
  userId: string,
  payload: EmployeeSkillReplace,
): EmployeeSkillListRead {
  const current = profileFor(userId);
  requireDemoVersion(current, payload.profileVersion);
  const existingBySkill = new Map(current.skills.map((skill) => [skill.skillId, skill]));
  const now = new Date().toISOString();
  const skills = payload.skills.map((input) => {
    const previous = existingBySkill.get(input.skillId);
    return {
      id: previous?.id ?? `employee-skill-${crypto.randomUUID()}`,
      skillId: input.skillId,
      name: previous?.name ?? resourceTitle("projects", { name: "Kỹ năng" }),
      category: previous?.category ?? null,
      level: input.rating,
      note: input.note ?? null,
      selfAssessed: previous?.selfAssessed ?? true,
      sourceType: previous?.sourceType ?? "SELF" as const,
    };
  });
  const next = { ...current, skills, profileVersion: current.profileVersion + 1, updatedAt: now };
  writeStored(next);
  return {
    profileVersion: next.profileVersion,
    items: skills.map((skill) => ({
      id: skill.id,
      skillId: skill.skillId,
      name: skill.name,
      category: skill.category ?? null,
      rating: skill.level,
      note: skill.note,
      selfAssessed: skill.selfAssessed,
      sourceType: skill.sourceType,
      sourceImportId: null,
      proposalItemId: null,
      createdBy: session.user.id,
      updatedBy: session.user.id,
      createdAt: now,
      updatedAt: now,
      version: 1,
    })),
  };
}

export function listDemoPeople(session: Session, query: PeopleQuery = {}): PeopleList {
  const companyId = query.companyId ?? session.user.companyId;
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  if (!companyId) return { items: [], total: 0, page, pageSize };
  const profiles = [
    { profile: profileFor(employeeProfile.id), department: "Sản phẩm" },
    { profile: profileFor(engineerProfile.id), department: "Kỹ thuật" },
  ];
  const needle = query.q?.trim().toLocaleLowerCase("vi-VN");
  const filtered = needle
    ? profiles.filter(({ profile }) => `${profile.name} ${profile.jobTitle}`.toLocaleLowerCase("vi-VN").includes(needle))
    : profiles;
  const offset = (page - 1) * pageSize;
  return {
    items: filtered.slice(offset, offset + pageSize).map(({ profile, department }) => ({
      id: profile.id,
      name: profile.name,
      jobTitle: profile.jobTitle,
      department,
      initials: profile.initials,
      skillCount: profile.skills.length,
      profileVersion: profile.profileVersion,
      updatedAt: profile.updatedAt,
    })),
    total: filtered.length,
    page,
    pageSize,
  };
}

export function getDemoPerson(session: Session, employeeId: string, scope: PeopleCompanyScope = {}): PersonDetail {
  const person = listDemoPeople(session, { companyId: scope.companyId, pageSize: 100 }).items.find((candidate) => candidate.id === employeeId);
  const known = fallbackProfiles.has(employeeId) || Boolean(readStored(employeeId));
  if (!person || !known) throw Object.assign(new Error("Không tìm thấy nhân sự"), { status: 404 });
  return { ...profileFor(employeeId), companyName: scope.companyName ?? profileFor(employeeId).companyName, department: person.department };
}
