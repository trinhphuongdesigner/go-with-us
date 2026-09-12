"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BriefcaseBusiness, CalendarDays, CheckCircle2, FileUp, Pencil, Plus, RefreshCcw, Save, Sparkles, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { ErrorState, LoadingState } from "@/components/ui/app-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-provider";
import { ProfileExtensionsPanel } from "@/features/profile-extensions/profile-extensions-panel";
import { EmploymentsPanel } from "@/features/profile-extensions/employments-panel";
import { SkillsEditor } from "./skills-editor";
import {
  ApiError,
  createProfileResource,
  deleteProfileResource,
  getOwnProfile,
  replaceEmployeeSkills,
  updateOwnProfile,
  updateProfileResource,
  type CoreProfile,
  type ProfileResourceCreate,
  type ProfileResourceKind,
  type ProfileResourcePatch,
} from "@/lib/api";

export type CoreUiForcedState = "loading" | "empty" | "error" | "stale";

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { month: "short", year: "numeric" }).format(new Date(value));
}

function formatUpdated(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function ProfileEmptyState() {
  return (
    <Card className="mt-6 grid min-h-80 overflow-hidden md:grid-cols-[1fr_220px]">
      <div className="flex flex-col items-start justify-center p-6 sm:p-9">
        <Badge tone="ai"><Sparkles size={13} aria-hidden="true" /> Bắt đầu cùng Milo</Badge>
        <h2 className="mt-4 text-xl font-bold text-ink">Hồ sơ của bạn đang chờ nội dung</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted">Thêm chức danh hoặc nhập tài liệu để tạo dòng thời gian nghề nghiệp. Bạn luôn kiểm tra và quyết định nội dung được lưu.</p>
        <Button asChild className="mt-5"><Link href="/ho-so/import">Nhập hồ sơ từ tài liệu <ArrowRight size={16} aria-hidden="true" /></Link></Button>
      </div>
      <div className="relative min-h-52 bg-[#F5F1FF]" aria-hidden="true">
        <Image src="/brand/milo/milo-purple-tablet.webp" alt="" fill loading="eager" sizes="220px" className="object-contain object-bottom p-4" />
      </div>
    </Card>
  );
}

function ProfileHeader({ profile, editing, stale, onEdit }: { profile: CoreProfile; editing: boolean; stale: boolean; onEdit: () => void }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="grid gap-5 md:grid-cols-[auto_1fr] md:items-center xl:grid-cols-[auto_1fr_auto]">
        <span className="grid size-16 place-items-center rounded-2xl bg-[#EAF1F6] text-xl font-bold text-primary" aria-hidden="true">{profile.initials}</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Hồ sơ 360°</p>
            <Badge tone="neutral">Phiên hồ sơ {profile.profileVersion}</Badge>
          </div>
          <h1 className="mt-2 break-words text-2xl font-bold tracking-[-0.03em] text-ink sm:text-3xl">{profile.name}</h1>
          <p className="mt-1 text-base text-muted">{profile.jobTitle || "Chưa cập nhật chức danh"} · {profile.companyName}</p>
          <p className="mt-2 text-xs text-muted">Cập nhật {formatUpdated(profile.updatedAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-1 xl:justify-end">
          <Button type="button" variant="secondary" onClick={onEdit} disabled={editing || stale}><Pencil size={16} aria-hidden="true" /> Chỉnh sửa hồ sơ</Button>
          <Button asChild><Link href="/ho-so/import"><FileUp size={16} aria-hidden="true" /> Nhập hồ sơ từ tài liệu</Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}

const resourceOptions: Array<{
  value: ProfileResourceKind;
  label: string;
  firstLabel: string;
  secondLabel: string;
  saveLabel: string;
}> = [
  { value: "experiences", label: "Kinh nghiệm", firstLabel: "Tiêu đề", secondLabel: "Tổ chức", saveLabel: "Lưu kinh nghiệm" },
  { value: "projects", label: "Dự án", firstLabel: "Tên dự án", secondLabel: "Vai trò", saveLabel: "Lưu dự án" },
  { value: "certifications", label: "Chứng chỉ", firstLabel: "Tên chứng chỉ", secondLabel: "Đơn vị cấp", saveLabel: "Lưu chứng chỉ" },
  { value: "awards", label: "Giải thưởng", firstLabel: "Tên giải thưởng", secondLabel: "Đơn vị trao", saveLabel: "Lưu giải thưởng" },
];

const resourceTypeLabels: Record<string, string> = {
  DEGREE: "Bằng cấp",
  LANGUAGE: "Ngoại ngữ",
  PROFESSIONAL: "Chuyên môn",
  OTHER: "Khác",
  WORK: "Công việc",
  PERSONAL: "Cá nhân",
};

function ProfileResourceCreateForm({
  profileVersion,
  employments,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  profileVersion: number;
  employments: CoreProfile["employments"];
  pending: boolean;
  error: boolean;
  onCancel: () => void;
  onSubmit: (kind: ProfileResourceKind, payload: ProfileResourceCreate) => void;
}) {
  const [kind, setKind] = useState<ProfileResourceKind>("experiences");
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [employmentId, setEmploymentId] = useState("");
  const [domain, setDomain] = useState("");
  const [techStack, setTechStack] = useState("");
  const [contribution, setContribution] = useState("");
  const [url, setUrl] = useState("");
  const [resourceType, setResourceType] = useState("PROFESSIONAL");
  const [score, setScore] = useState("");
  const option = resourceOptions.find((item) => item.value === kind) ?? resourceOptions[0];

  function submitResource(event: FormEvent) {
    event.preventDefault();
    const common = { profileVersion };
    if (kind === "experiences") {
      onSubmit(kind, { ...common, title: first.trim(), organization: second.trim(), employmentId: employmentId || null, description: description.trim() || null, startDate: startDate || null, endDate: endDate || null });
    } else if (kind === "projects") {
      onSubmit(kind, { ...common, name: first.trim(), role: second.trim(), employmentId: employmentId || null, domain: domain.trim() || null, description: description.trim() || null, techStack: techStack.split(",").map((item) => item.trim()).filter(Boolean), contribution: contribution.trim() || null, url: url.trim() || null, startDate: startDate || null, endDate: endDate || null });
    } else if (kind === "certifications") {
      onSubmit(kind, { ...common, name: first.trim(), issuer: second.trim(), type: resourceType as "DEGREE" | "LANGUAGE" | "PROFESSIONAL" | "OTHER", score: score.trim() || null, credentialUrl: url.trim() || null, issuedAt: startDate || null, expiresAt: endDate || null });
    } else {
      onSubmit(kind, { ...common, name: first.trim(), issuer: second.trim(), type: resourceType as "WORK" | "PERSONAL", description: description.trim() || null, evidenceUrl: url.trim() || null, awardedAt: startDate || null });
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-bold">Thêm nội dung hồ sơ</h2>
        <p className="mt-1 text-sm leading-6 text-muted">Nguồn gốc được hệ thống gắn theo người thực hiện và không thể sửa từ biểu mẫu.</p>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={submitResource}>
          <label className="grid gap-2 text-sm font-semibold" htmlFor="profile-resource-kind">
            Loại nội dung
            <select
              id="profile-resource-kind"
              value={kind}
              onChange={(event) => {
                setKind(event.target.value as ProfileResourceKind);
                setFirst("");
                setSecond("");
                setStartDate("");
                setEndDate(""); setDescription(""); setEmploymentId(""); setDomain(""); setTechStack(""); setContribution(""); setUrl(""); setScore("");
                setResourceType(event.target.value === "awards" ? "WORK" : "PROFESSIONAL");
              }}
              className="h-12 rounded-xl border border-border bg-white px-4 text-sm focus:border-primary focus:outline-none"
            >
              {resourceOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold" htmlFor="profile-resource-first">
            {option.firstLabel}
            <Input id="profile-resource-first" value={first} onChange={(event) => setFirst(event.target.value)} required autoFocus />
          </label>
          <label className="grid gap-2 text-sm font-semibold" htmlFor="profile-resource-second">
            {option.secondLabel}
            <Input id="profile-resource-second" value={second} onChange={(event) => setSecond(event.target.value)} required />
          </label>
          <label className="grid gap-2 text-sm font-semibold" htmlFor="profile-resource-start">
            {kind === "certifications" ? "Ngày cấp" : kind === "awards" ? "Ngày nhận" : "Ngày bắt đầu"}
            <Input id="profile-resource-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          {(kind === "experiences" || kind === "projects") ? <>
            <label className="grid gap-2 text-sm font-semibold">Kỳ làm việc liên quan
              <select value={employmentId} onChange={(event) => setEmploymentId(event.target.value)} className="h-12 rounded-xl border border-border bg-white px-4 text-sm focus:border-primary focus:outline-none">
                <option value="">Không liên kết</option>{employments.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">Ngày kết thúc<Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
          </> : null}
          {kind === "projects" ? <>
            <label className="grid gap-2 text-sm font-semibold">Lĩnh vực<Input value={domain} onChange={(event) => setDomain(event.target.value)} /></label>
            <label className="grid gap-2 text-sm font-semibold">Công nghệ, cách nhau bằng dấu phẩy<Input value={techStack} onChange={(event) => setTechStack(event.target.value)} /></label>
            <label className="grid gap-2 text-sm font-semibold md:col-span-2">Đóng góp<textarea className="min-h-24 rounded-xl border border-border bg-white p-3 text-sm" value={contribution} onChange={(event) => setContribution(event.target.value)} /></label>
            <label className="grid gap-2 text-sm font-semibold md:col-span-2">Mô tả<textarea className="min-h-24 rounded-xl border border-border bg-white p-3 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          </> : null}
          {(kind === "certifications" || kind === "awards") ? <>
            <label className="grid gap-2 text-sm font-semibold">Loại
              <select value={resourceType} onChange={(event) => setResourceType(event.target.value)} className="h-12 rounded-xl border border-border bg-white px-4 text-sm">
                {(kind === "certifications" ? ["DEGREE", "LANGUAGE", "PROFESSIONAL", "OTHER"] : ["WORK", "PERSONAL"]).map((value) => <option key={value} value={value}>{resourceTypeLabels[value]}</option>)}
              </select>
            </label>
            {kind === "certifications" ? <label className="grid gap-2 text-sm font-semibold">Điểm / xếp loại<Input value={score} onChange={(event) => setScore(event.target.value)} /></label> : null}
            {kind === "certifications" ? <label className="grid gap-2 text-sm font-semibold">Ngày hết hạn<Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label> : null}
          </> : null}
          <label className="grid gap-2 text-sm font-semibold md:col-span-2">{kind === "certifications" ? "URL chứng thực" : kind === "awards" ? "URL minh chứng" : kind === "projects" ? "URL dự án" : "Mô tả"}
            {kind === "experiences" ? <textarea className="min-h-24 rounded-xl border border-border bg-white p-3 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} /> : <Input type="url" value={url} onChange={(event) => setUrl(event.target.value)} />}
          </label>
          {kind === "awards" ? <label className="grid gap-2 text-sm font-semibold md:col-span-2">Mô tả<textarea className="min-h-24 rounded-xl border border-border bg-white p-3 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} /></label> : null}
          {error ? <p role="alert" className="text-sm font-semibold text-danger md:col-span-2">Chưa thể lưu nội dung. Hãy tải lại hồ sơ và thử lại.</p> : null}
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button type="submit" disabled={pending || !first.trim() || !second.trim()}><Save size={16} aria-hidden="true" /> {pending ? "Đang lưu…" : option.saveLabel}</Button>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>Hủy</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

type EditableProfileResource =
  | CoreProfile["experiences"][number]
  | CoreProfile["projects"][number]
  | CoreProfile["certifications"][number]
  | CoreProfile["awards"][number];

function resourceName(kind: ProfileResourceKind, resource: EditableProfileResource) {
  return kind === "experiences" ? (resource as CoreProfile["experiences"][number]).title : (resource as { name: string }).name;
}

function resourceSecondValue(kind: ProfileResourceKind, resource: EditableProfileResource) {
  if (kind === "experiences") return (resource as CoreProfile["experiences"][number]).organization;
  if (kind === "projects") return (resource as CoreProfile["projects"][number]).role;
  return (resource as CoreProfile["certifications"][number] | CoreProfile["awards"][number]).issuer;
}

function ProfileResourceEditForm({
  kind,
  resource,
  employments,
  profileVersion,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  kind: ProfileResourceKind;
  resource: EditableProfileResource;
  employments: CoreProfile["employments"];
  profileVersion: number;
  pending: boolean;
  error: boolean;
  onCancel: () => void;
  onSubmit: (payload: ProfileResourcePatch) => void;
}) {
  const option = resourceOptions.find((item) => item.value === kind) ?? resourceOptions[0];
  const [first, setFirst] = useState(resourceName(kind, resource));
  const [second, setSecond] = useState(resourceSecondValue(kind, resource));
  const initial = resource as unknown as Record<string, unknown>;
  const [startDate, setStartDate] = useState(String(initial.startDate ?? initial.issuedAt ?? initial.awardedAt ?? ""));
  const [endDate, setEndDate] = useState(String(initial.endDate ?? initial.expiresAt ?? ""));
  const [description, setDescription] = useState(String(initial.description ?? ""));
  const [employmentId, setEmploymentId] = useState(String(initial.employmentId ?? ""));
  const [domain, setDomain] = useState(String(initial.domain ?? ""));
  const [techStack, setTechStack] = useState(Array.isArray(initial.techStack) ? initial.techStack.join(", ") : "");
  const [contribution, setContribution] = useState(String(initial.contribution ?? ""));
  const [url, setUrl] = useState(String(initial.url ?? initial.credentialUrl ?? initial.evidenceUrl ?? ""));
  const [resourceType, setResourceType] = useState(String(initial.type ?? (kind === "awards" ? "WORK" : "PROFESSIONAL")));
  const [score, setScore] = useState(String(initial.score ?? ""));

  function submitResource(event: FormEvent) {
    event.preventDefault();
    if (kind === "experiences") {
      onSubmit({ profileVersion, title: first.trim(), organization: second.trim(), employmentId: employmentId || null, description: description.trim() || null, startDate: startDate || null, endDate: endDate || null });
    } else if (kind === "projects") {
      onSubmit({ profileVersion, name: first.trim(), role: second.trim(), employmentId: employmentId || null, domain: domain.trim() || null, description: description.trim() || null, techStack: techStack.split(",").map((item) => item.trim()).filter(Boolean), contribution: contribution.trim() || null, url: url.trim() || null, startDate: startDate || null, endDate: endDate || null });
    } else if (kind === "certifications") {
      onSubmit({ profileVersion, name: first.trim(), issuer: second.trim(), type: resourceType as "DEGREE" | "LANGUAGE" | "PROFESSIONAL" | "OTHER", score: score.trim() || null, credentialUrl: url.trim() || null, issuedAt: startDate || null, expiresAt: endDate || null });
    } else {
      onSubmit({ profileVersion, name: first.trim(), issuer: second.trim(), type: resourceType as "WORK" | "PERSONAL", description: description.trim() || null, evidenceUrl: url.trim() || null, awardedAt: startDate || null });
    }
  }

  return (
    <form className="mt-4 grid gap-4 rounded-xl bg-background p-4 md:grid-cols-2" onSubmit={submitResource}>
      <label className="grid gap-2 text-sm font-semibold">
        {option.firstLabel}
        <Input value={first} onChange={(event) => setFirst(event.target.value)} required autoFocus />
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        {option.secondLabel}
        <Input value={second} onChange={(event) => setSecond(event.target.value)} required />
      </label>
      <label className="grid gap-2 text-sm font-semibold">{kind === "certifications" ? "Ngày cấp" : kind === "awards" ? "Ngày nhận" : "Ngày bắt đầu"}<Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
      {(kind === "experiences" || kind === "projects") ? <>
        <label className="grid gap-2 text-sm font-semibold">Kỳ làm việc liên quan<select value={employmentId} onChange={(event) => setEmploymentId(event.target.value)} className="h-12 rounded-xl border border-border bg-white px-4 text-sm"><option value="">Không liên kết</option>{employments.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-semibold">Ngày kết thúc<Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
      </> : null}
      {kind === "projects" ? <>
        <label className="grid gap-2 text-sm font-semibold">Lĩnh vực<Input value={domain} onChange={(event) => setDomain(event.target.value)} /></label>
        <label className="grid gap-2 text-sm font-semibold">Công nghệ, cách nhau bằng dấu phẩy<Input value={techStack} onChange={(event) => setTechStack(event.target.value)} /></label>
        <label className="grid gap-2 text-sm font-semibold md:col-span-2">Đóng góp<textarea className="min-h-24 rounded-xl border border-border bg-white p-3 text-sm" value={contribution} onChange={(event) => setContribution(event.target.value)} /></label>
      </> : null}
      {(kind === "certifications" || kind === "awards") ? <>
        <label className="grid gap-2 text-sm font-semibold">Loại<select value={resourceType} onChange={(event) => setResourceType(event.target.value)} className="h-12 rounded-xl border border-border bg-white px-4 text-sm">{(kind === "certifications" ? ["DEGREE", "LANGUAGE", "PROFESSIONAL", "OTHER"] : ["WORK", "PERSONAL"]).map((value) => <option key={value} value={value}>{resourceTypeLabels[value]}</option>)}</select></label>
        {kind === "certifications" ? <><label className="grid gap-2 text-sm font-semibold">Điểm / xếp loại<Input value={score} onChange={(event) => setScore(event.target.value)} /></label><label className="grid gap-2 text-sm font-semibold">Ngày hết hạn<Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label></> : null}
      </> : null}
      <label className="grid gap-2 text-sm font-semibold md:col-span-2">{kind === "certifications" ? "URL chứng thực" : kind === "awards" ? "URL minh chứng" : kind === "projects" ? "URL dự án" : "Mô tả"}{kind === "experiences" ? <textarea className="min-h-24 rounded-xl border border-border bg-white p-3 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} /> : <Input type="url" value={url} onChange={(event) => setUrl(event.target.value)} />}</label>
      {(kind === "projects" || kind === "awards") ? <label className="grid gap-2 text-sm font-semibold md:col-span-2">Mô tả<textarea className="min-h-24 rounded-xl border border-border bg-white p-3 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} /></label> : null}
      {error ? <p role="alert" className="text-sm font-semibold text-danger md:col-span-2">Chưa thể lưu thay đổi. Hãy tải lại hồ sơ và thử lại.</p> : null}
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <Button type="submit" disabled={pending || !first.trim() || !second.trim()}><Save size={16} aria-hidden="true" /> {pending ? "Đang lưu…" : option.saveLabel}</Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>Hủy</Button>
      </div>
    </form>
  );
}

function SkillReplacePanel({
  profile,
  stale,
  pending,
  error,
  onSave,
}: {
  profile: CoreProfile;
  stale: boolean;
  pending: boolean;
  error: boolean;
  onSave: (skills: Array<{ skillId: string; rating: number; note: string | null }>) => void;
}) {
  return <SkillsEditor profile={profile} stale={stale} pending={pending} error={error} onSave={onSave} />;
}

function ProfileResourcesPanel({
  profile,
  stale,
  active,
  onActiveChange,
  editingId,
  onEditingChange,
  updatePending,
  updateError,
  deletePending,
  deleteError,
  onUpdate,
  onDelete,
  skillsPending,
  skillsError,
  onSkillsSave,
}: {
  profile: CoreProfile;
  stale: boolean;
  active: "skills" | ProfileResourceKind;
  onActiveChange: (active: "skills" | ProfileResourceKind) => void;
  editingId: string | null;
  onEditingChange: (id: string | null) => void;
  updatePending: boolean;
  updateError: boolean;
  deletePending: boolean;
  deleteError: boolean;
  onUpdate: (kind: ProfileResourceKind, resourceId: string, payload: ProfileResourcePatch) => void;
  onDelete: (kind: ProfileResourceKind, resourceId: string) => void;
  skillsPending: boolean;
  skillsError: boolean;
  onSkillsSave: (skills: Array<{ skillId: string; rating: number; note: string | null }>) => void;
}) {
  const tabs: Array<{ value: "skills" | ProfileResourceKind; label: string; count: number }> = [
    { value: "skills", label: "Kỹ năng", count: profile.skills.length },
    ...resourceOptions.map((option) => ({ value: option.value, label: option.label, count: profile[option.value].length })),
  ];
  const resources = active === "skills" ? [] : profile[active] as EditableProfileResource[];
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-bold">Nội dung hồ sơ</h2>
        <div role="group" aria-label="Các phần hồ sơ" className="mt-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Button
              key={tab.value}
              type="button"
              variant={active === tab.value ? "primary" : "secondary"}
              aria-pressed={active === tab.value}
              onClick={() => {
                onActiveChange(tab.value);
                onEditingChange(null);
              }}
            >
              {tab.label} ({tab.count})
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {deleteError ? <p role="alert" className="mb-4 rounded-xl bg-danger-soft p-3 text-sm font-semibold text-danger">Chưa thể xóa nội dung. Hãy kiểm tra kết nối và thử lại.</p> : null}
        {active === "skills" ? (
          <SkillReplacePanel key={profile.profileVersion} profile={profile} stale={stale} pending={skillsPending} error={skillsError} onSave={onSkillsSave} />
        ) : resources.length === 0 ? (
          <p className="rounded-xl bg-background p-4 text-sm leading-6 text-muted">Chưa có nội dung trong phần này.</p>
        ) : (
          <ul className="grid gap-3">
            {resources.map((resource) => {
              const name = resourceName(active, resource);
              return (
                <li key={resource.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-ink">{name}</p>
                      <p className="mt-1 text-sm text-muted">{resourceSecondValue(active, resource)}</p>
                      <Badge className="mt-2" tone={resource.sourceType === "IMPORT" ? "ai" : "neutral"}>
                        {resource.sourceType === "ADMIN" ? "HR cập nhật" : resource.sourceType === "IMPORT" ? "Từ tài liệu" : "Tự cập nhật"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="ghost" aria-label={`Chỉnh sửa ${name}`} onClick={() => onEditingChange(resource.id)} disabled={stale || deletePending}><Pencil size={16} aria-hidden="true" /></Button>
                      {confirmingDeleteId === resource.id ? <>
                        <Button type="button" variant="ghost" aria-label={`Xác nhận xóa ${name}`} autoFocus onClick={() => { onDelete(active, resource.id); setConfirmingDeleteId(null); }} disabled={stale || deletePending}><Trash2 size={16} aria-hidden="true" /> Xác nhận xóa</Button>
                        <Button type="button" variant="ghost" onClick={() => setConfirmingDeleteId(null)} disabled={deletePending}>Hủy xóa</Button>
                      </> : <Button type="button" variant="ghost" aria-label={`Xóa ${name}`} onClick={() => setConfirmingDeleteId(resource.id)} disabled={stale || deletePending}><Trash2 size={16} aria-hidden="true" /></Button>}
                    </div>
                  </div>
                  {editingId === resource.id ? (
                    <ProfileResourceEditForm
                      kind={active}
                      resource={resource}
                      employments={profile.employments}
                      profileVersion={profile.profileVersion}
                      pending={updatePending}
                      error={updateError}
                      onCancel={() => onEditingChange(null)}
                      onSubmit={(payload) => onUpdate(active, resource.id, payload)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function ProfileView({ forceState }: { forceState?: CoreUiForcedState }) {
  const { session } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [saved, setSaved] = useState(false);
  const [stale, setStale] = useState(forceState === "stale");
  const [refreshError, setRefreshError] = useState(false);
  const [addingResource, setAddingResource] = useState(false);
  const [activeResourceSection, setActiveResourceSection] = useState<"skills" | ProfileResourceKind>("skills");
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const [resourceNotice, setResourceNotice] = useState("");
  const resourceNoticeRef = useRef<HTMLDivElement>(null);

  function announceResource(message: string) {
    setResourceNotice(message);
    window.setTimeout(() => resourceNoticeRef.current?.focus(), 0);
  }

  const profileQuery = useQuery({
    queryKey: ["core-profile", session?.user.id],
    queryFn: () => getOwnProfile(session!),
    enabled: Boolean(session) && forceState !== "loading" && forceState !== "error",
  });
  const profile = profileQuery.data;

  const update = useMutation({
    mutationFn: () => updateOwnProfile(session!, { name: name.trim(), jobTitle: jobTitle.trim() || null, profileVersion: profile!.profileVersion }),
    onSuccess: (next) => {
      queryClient.setQueryData(["core-profile", session?.user.id], next);
      setEditing(false);
      setSaved(true);
      setStale(false);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setStale(true);
        window.setTimeout(() => alertRef.current?.focus(), 0);
      }
    },
  });
  const createResource = useMutation({
    mutationFn: ({ kind, payload }: { kind: ProfileResourceKind; payload: ProfileResourceCreate }) => (
      createProfileResource(session!, kind, payload)
    ),
    onSuccess: async () => {
      setAddingResource(false);
      await queryClient.invalidateQueries({ queryKey: ["core-profile", session?.user.id] });
      announceResource("Đã thêm nội dung hồ sơ");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setStale(true);
        window.setTimeout(() => alertRef.current?.focus(), 0);
      }
    },
  });
  const handleMutationError = (error: unknown) => {
    if (error instanceof ApiError && error.status === 409) {
      setStale(true);
      window.setTimeout(() => alertRef.current?.focus(), 0);
    }
  };
  const updateResource = useMutation({
    mutationFn: ({ kind, resourceId, payload }: { kind: ProfileResourceKind; resourceId: string; payload: ProfileResourcePatch }) => (
      updateProfileResource(session!, kind, resourceId, payload)
    ),
    onSuccess: async () => {
      setEditingResourceId(null);
      await queryClient.invalidateQueries({ queryKey: ["core-profile", session?.user.id] });
      announceResource("Đã lưu nội dung hồ sơ");
    },
    onError: handleMutationError,
  });
  const removeResource = useMutation({
    mutationFn: ({ kind, resourceId }: { kind: ProfileResourceKind; resourceId: string }) => (
      deleteProfileResource(session!, kind, resourceId, profile!.profileVersion)
    ),
    onSuccess: async () => {
      setEditingResourceId(null);
      await queryClient.invalidateQueries({ queryKey: ["core-profile", session?.user.id] });
      announceResource("Đã xóa nội dung hồ sơ");
    },
    onError: handleMutationError,
  });
  const replaceSkills = useMutation({
    mutationFn: (skills: Array<{ skillId: string; rating: number; note: string | null }>) => (
      replaceEmployeeSkills(session!, profile!.id, { profileVersion: profile!.profileVersion, skills })
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["core-profile", session?.user.id] });
      announceResource("Đã lưu toàn bộ kỹ năng");
    },
    onError: handleMutationError,
  });

  function startEdit() {
    if (!profile) return;
    setName(profile.name);
    setJobTitle(profile.jobTitle);
    setSaved(false);
    setEditing(true);
  }

  async function reloadProfile() {
    setRefreshError(false);
    const result = await profileQuery.refetch();
    if (result.isSuccess && result.data) {
      setName(result.data.name);
      setJobTitle(result.data.jobTitle);
      setStale(false);
      return;
    }
    setRefreshError(true);
    window.setTimeout(() => alertRef.current?.focus(), 0);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || stale) return;
    update.mutate();
  }

  if (forceState === "error") {
    return <ErrorState title="Chưa thể tải hồ sơ" description="Kết nối dữ liệu hồ sơ đang gián đoạn. Hãy thử lại." onRetry={() => router.replace("/ho-so")} />;
  }
  if (forceState === "loading" || profileQuery.isPending) return <LoadingState label="Đang tải hồ sơ" />;
  if (profileQuery.isError && !profile) {
    return <ErrorState title="Chưa thể tải hồ sơ" description="Kết nối dữ liệu hồ sơ đang gián đoạn. Hãy thử lại." onRetry={() => void profileQuery.refetch()} />;
  }
  if (forceState === "empty" || !profile) return <ProfileEmptyState />;

  return (
    <div className="space-y-6">
      <ProfileHeader profile={profile} editing={editing} stale={stale} onEdit={startEdit} />
      <div className="flex flex-wrap gap-3"><Button asChild><Link href="/ho-so/nhap-da-nguon">Nhập hồ sơ đa nguồn</Link></Button><Button asChild variant="secondary"><Link href="/yeu-cau-nang-luc">Gửi minh chứng cho HR</Link></Button><Button asChild variant="secondary"><Link href="/ho-chieu">Hộ chiếu nghề nghiệp</Link></Button></div>
      <ProfileExtensionsPanel />
      {session ? <EmploymentsPanel userId={session.user.id} canManage={false} /> : null}

      {saved ? <div role="status" className="flex items-center gap-2 rounded-xl border border-[#D7E7DA] bg-[#F5FAF6] px-4 py-3 text-sm font-semibold text-sage-strong"><CheckCircle2 size={18} aria-hidden="true" /> Đã lưu hồ sơ</div> : null}
      {resourceNotice ? <div ref={resourceNoticeRef} tabIndex={-1} role="status" className="flex items-center gap-2 rounded-xl border border-[#D7E7DA] bg-[#F5FAF6] px-4 py-3 text-sm font-semibold text-sage-strong"><CheckCircle2 size={18} aria-hidden="true" /> {resourceNotice}</div> : null}

      {stale ? (
        <Card className="border-[#F0DFC0] bg-[#FFFAF0]">
          <div ref={alertRef} tabIndex={-1} role="alert" className="p-5">
            <h2 className="font-bold text-[#80520F]">Hồ sơ đã thay đổi ở nơi khác</h2>
            <p className="mt-1 text-sm leading-6 text-[#80520F]">Tải bản mới trước khi chỉnh sửa tiếp để tránh ghi đè thay đổi vừa được lưu.</p>
            {refreshError ? <p className="mt-2 text-sm font-semibold text-danger">Chưa tải được bản mới. Hồ sơ vẫn đang khóa để bảo vệ thay đổi.</p> : null}
            <Button type="button" variant="secondary" className="mt-4" onClick={() => void reloadProfile()} disabled={profileQuery.isFetching}>
              <RefreshCcw size={16} aria-hidden="true" /> {profileQuery.isFetching ? "Đang tải bản mới…" : "Tải lại hồ sơ"}
            </Button>
          </div>
        </Card>
      ) : null}

      {editing ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold">Chỉnh sửa thông tin cốt lõi</h2>
            <p className="mt-1 text-sm leading-6 text-muted">Hai trường này xuất hiện ở đầu hồ sơ và danh sách nhân sự.</p>
          </CardHeader>
          <CardContent>
            <form className="grid gap-5" onSubmit={submit}>
              <label className="grid gap-2 text-sm font-semibold" htmlFor="profile-name">Họ và tên<Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" /></label>
              <div className="grid gap-2">
                <label className="text-sm font-semibold" htmlFor="profile-job-title">Chức danh hiện tại</label>
                <Input id="profile-job-title" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} aria-describedby="profile-job-title-help" />
                <span id="profile-job-title-help" className="text-xs font-normal text-muted">Có thể để trống nếu chưa có chức danh chính thức.</span>
              </div>
              {update.isError && !stale ? <p role="alert" className="text-sm font-semibold text-danger">Chưa thể lưu hồ sơ. Hãy kiểm tra kết nối và thử lại.</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={update.isPending || stale || !name.trim()}><Save size={16} aria-hidden="true" /> {update.isPending ? "Đang lưu…" : "Lưu thay đổi"}</Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={update.isPending}>Hủy</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" variant="secondary" onClick={() => setAddingResource(true)} disabled={addingResource || stale}>
          <Plus size={16} aria-hidden="true" /> Thêm nội dung hồ sơ
        </Button>
      </div>
      {addingResource ? (
        <ProfileResourceCreateForm
          profileVersion={profile.profileVersion}
          employments={profile.employments}
          pending={createResource.isPending}
          error={createResource.isError && !stale}
          onCancel={() => setAddingResource(false)}
          onSubmit={(kind, payload) => createResource.mutate({ kind, payload })}
        />
      ) : null}

      <ProfileResourcesPanel
        profile={profile}
        stale={stale}
        active={activeResourceSection}
        onActiveChange={setActiveResourceSection}
        editingId={editingResourceId}
        onEditingChange={setEditingResourceId}
        updatePending={updateResource.isPending}
        updateError={updateResource.isError && !stale}
        deletePending={removeResource.isPending}
        deleteError={removeResource.isError && !stale}
        onUpdate={(kind, resourceId, payload) => updateResource.mutate({ kind, resourceId, payload })}
        onDelete={(kind, resourceId) => removeResource.mutate({ kind, resourceId })}
        skillsPending={replaceSkills.isPending}
        skillsError={replaceSkills.isError && !stale}
        onSkillsSave={(skills) => replaceSkills.mutate(skills)}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)]">
        <section aria-labelledby="profile-timeline-heading">
          <Card>
            <CardHeader>
              <h2 id="profile-timeline-heading" className="text-lg font-bold">Dòng thời gian nghề nghiệp</h2>
              <p className="mt-1 text-sm leading-6 text-muted">Các mốc đã được bạn xác nhận hoặc nhập từ nguồn có minh chứng.</p>
            </CardHeader>
            <CardContent>
              {profile.timeline.length === 0 ? (
                <p className="rounded-xl bg-background p-4 text-sm leading-6 text-muted">
                  Chưa có mốc nghề nghiệp được đồng bộ. Bạn có thể nhập tài liệu hoặc bổ sung chi tiết ở bước tiếp theo.
                </p>
              ) : <ol className="space-y-1">
                {profile.timeline.map((item, index) => (
                  <li key={item.id} className="relative grid grid-cols-[24px_1fr] gap-3 pb-6 last:pb-0">
                    {index < profile.timeline.length - 1 ? <span className="absolute left-[11px] top-6 h-[calc(100%-8px)] w-px bg-border" aria-hidden="true" /> : null}
                    <span className="mt-1 grid size-6 place-items-center rounded-full bg-[#EAF1F6] text-primary" aria-hidden="true">{item.kind === "EXPERIENCE" ? <BriefcaseBusiness size={13} /> : <CalendarDays size={13} />}</span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-ink">{item.title}</h3>
                        <Badge tone={item.sourceType === "IMPORT" ? "ai" : "neutral"}>
                          {item.sourceType === "IMPORT" ? "Từ tài liệu" : item.sourceType === "ADMIN" ? "HR cập nhật" : item.sourceType === null ? "Kỳ làm việc" : "Tự cập nhật"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted">{item.subtitle}</p>
                      <p className="mt-1 text-xs font-medium text-muted">{formatMonth(item.startDate)}{item.endDate ? ` – ${formatMonth(item.endDate)}` : " – Hiện tại"}</p>
                    </div>
                  </li>
                ))}
              </ol>}
            </CardContent>
          </Card>
        </section>

        <div className="space-y-6">
          <Card>
            <CardHeader><h2 className="text-lg font-bold">Năng lực nổi bật</h2></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {profile.skills.length > 0
                ? profile.skills.map((skill) => <Badge key={skill.id} tone="success">{skill.name} · {skill.level}/5</Badge>)
                : <p className="text-sm leading-6 text-muted">Chưa có kỹ năng được đồng bộ từ hồ sơ chi tiết.</p>}
            </CardContent>
          </Card>
          <aside aria-label="Gợi ý từ Milo" className="flex items-center gap-3 rounded-2xl border border-[#E4DFF8] bg-[#FAF8FF] p-4">
            <span className="relative size-20 shrink-0 self-end"><Image src="/brand/milo/milo-purple-tablet.webp" alt="Milo gợi ý bước tiếp theo" fill loading="eager" sizes="80px" className="object-contain object-bottom" /></span>
            <div><p className="text-sm font-bold text-ink">Milo gợi ý</p><p className="mt-1 text-sm leading-6 text-muted">Thêm minh chứng cho kỹ năng để hồ sơ dễ hiểu hơn khi trao đổi phát triển.</p></div>
          </aside>
        </div>
      </div>
    </div>
  );
}
