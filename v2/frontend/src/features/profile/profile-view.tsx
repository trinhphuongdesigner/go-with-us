"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BriefcaseBusiness, CalendarDays, CheckCircle2, FileUp, Pencil, RefreshCcw, Save, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

import { ErrorState, LoadingState } from "@/components/ui/app-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-provider";
import { ApiError, getOwnProfile, updateOwnProfile, type CoreProfile } from "@/lib/api";

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

function ProfileHeader({ profile, editing, onEdit }: { profile: CoreProfile; editing: boolean; onEdit: () => void }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="grid gap-5 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <span className="grid size-16 place-items-center rounded-2xl bg-[#EAF1F6] text-xl font-bold text-primary" aria-hidden="true">{profile.initials}</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Hồ sơ 360°</p>
            <Badge tone="neutral">Phiên hồ sơ {profile.profileVersion}</Badge>
          </div>
          <h1 className="mt-2 break-words text-2xl font-bold tracking-[-0.03em] text-ink sm:text-3xl">{profile.name}</h1>
          <p className="mt-1 text-base text-muted">{profile.jobTitle} · {profile.companyName}</p>
          <p className="mt-2 text-xs text-muted">Cập nhật {formatUpdated(profile.updatedAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button type="button" variant="secondary" onClick={onEdit} disabled={editing}><Pencil size={16} aria-hidden="true" /> Chỉnh sửa hồ sơ</Button>
          <Button asChild><Link href="/ho-so/import"><FileUp size={16} aria-hidden="true" /> Nhập hồ sơ từ tài liệu</Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProfileView({ forceState }: { forceState?: CoreUiForcedState }) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [saved, setSaved] = useState(false);
  const [stale, setStale] = useState(forceState === "stale");
  const [refreshError, setRefreshError] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);

  const profileQuery = useQuery({
    queryKey: ["core-profile", session?.user.id],
    queryFn: () => getOwnProfile(session!),
    enabled: Boolean(session) && forceState !== "loading" && forceState !== "error",
  });
  const profile = profileQuery.data;

  const update = useMutation({
    mutationFn: () => updateOwnProfile(session!, { name: name.trim(), jobTitle: jobTitle.trim(), profileVersion: profile!.profileVersion }),
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
    if (!name.trim() || !jobTitle.trim() || stale) return;
    update.mutate();
  }

  if (forceState === "error") {
    return <ErrorState title="Chưa thể tải hồ sơ" description="Kết nối dữ liệu hồ sơ đang gián đoạn. Hãy thử lại." onRetry={() => void profileQuery.refetch()} />;
  }
  if (forceState === "loading" || profileQuery.isPending) return <LoadingState label="Đang tải hồ sơ" />;
  if (profileQuery.isError && !profile) {
    return <ErrorState title="Chưa thể tải hồ sơ" description="Kết nối dữ liệu hồ sơ đang gián đoạn. Hãy thử lại." onRetry={() => void profileQuery.refetch()} />;
  }
  if (forceState === "empty" || !profile) return <ProfileEmptyState />;

  return (
    <div className="space-y-6">
      <ProfileHeader profile={profile} editing={editing} onEdit={startEdit} />

      {saved ? <div role="status" className="flex items-center gap-2 rounded-xl border border-[#D7E7DA] bg-[#F5FAF6] px-4 py-3 text-sm font-semibold text-sage-strong"><CheckCircle2 size={18} aria-hidden="true" /> Đã lưu hồ sơ</div> : null}

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
              <label className="grid gap-2 text-sm font-semibold" htmlFor="profile-job-title">Chức danh hiện tại<Input id="profile-job-title" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} required /></label>
              {update.isError && !stale ? <p role="alert" className="text-sm font-semibold text-danger">Chưa thể lưu hồ sơ. Hãy kiểm tra kết nối và thử lại.</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={update.isPending || stale || !name.trim() || !jobTitle.trim()}><Save size={16} aria-hidden="true" /> {update.isPending ? "Đang lưu…" : "Lưu thay đổi"}</Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={update.isPending}>Hủy</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)]">
        <section aria-labelledby="profile-timeline-heading">
          <Card>
            <CardHeader>
              <h2 id="profile-timeline-heading" className="text-lg font-bold">Dòng thời gian nghề nghiệp</h2>
              <p className="mt-1 text-sm leading-6 text-muted">Các mốc đã được bạn xác nhận hoặc nhập từ nguồn có minh chứng.</p>
            </CardHeader>
            <CardContent>
              <ol className="space-y-1">
                {profile.timeline.map((item, index) => (
                  <li key={item.id} className="relative grid grid-cols-[24px_1fr] gap-3 pb-6 last:pb-0">
                    {index < profile.timeline.length - 1 ? <span className="absolute left-[11px] top-6 h-[calc(100%-8px)] w-px bg-border" aria-hidden="true" /> : null}
                    <span className="mt-1 grid size-6 place-items-center rounded-full bg-[#EAF1F6] text-primary" aria-hidden="true">{item.kind === "EXPERIENCE" ? <BriefcaseBusiness size={13} /> : <CalendarDays size={13} />}</span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-ink">{item.title}</h3>
                        <Badge tone={item.sourceType === "IMPORT" ? "ai" : "neutral"}>{item.sourceType === "IMPORT" ? "Từ tài liệu" : "Tự cập nhật"}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted">{item.subtitle}</p>
                      <p className="mt-1 text-xs font-medium text-muted">{formatMonth(item.startDate)}{item.endDate ? ` – ${formatMonth(item.endDate)}` : " – Hiện tại"}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </section>

        <div className="space-y-6">
          <Card>
            <CardHeader><h2 className="text-lg font-bold">Năng lực nổi bật</h2></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {profile.skills.map((skill) => <Badge key={skill.id} tone="success">{skill.name} · {skill.level}/5</Badge>)}
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
