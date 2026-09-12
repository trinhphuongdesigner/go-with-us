"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, CalendarDays, Search, ShieldCheck, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/ui/app-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-provider";
import type { CoreUiForcedState } from "@/features/profile/profile-view";
import { getPerson, listPeople, type CoreProfile } from "@/lib/api";

function formatUpdated(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi");
}

export function PeopleListView({ forceState }: { forceState?: CoreUiForcedState }) {
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const canRead = Boolean(session?.user.permissions.includes("people:read"));
  const peopleQuery = useQuery({
    queryKey: ["people", session?.user.companyId],
    queryFn: () => listPeople(session!),
    enabled: canRead && forceState !== "loading" && forceState !== "error",
  });
  const filtered = useMemo(() => {
    const query = normalize(search.trim());
    if (!query) return peopleQuery.data?.items ?? [];
    return (peopleQuery.data?.items ?? []).filter((person) => normalize(`${person.name} ${person.jobTitle} ${person.department}`).includes(query));
  }, [peopleQuery.data, search]);

  if (forceState === "error") {
    return <ErrorState title="Chưa thể tải danh sách nhân sự" description="Kết nối dữ liệu đội ngũ đang gián đoạn. Hãy thử lại." onRetry={() => void peopleQuery.refetch()} />;
  }
  if (forceState === "loading" || peopleQuery.isPending) return <LoadingState label="Đang tải danh sách nhân sự" />;
  if (peopleQuery.isError) {
    return <ErrorState title="Chưa thể tải danh sách nhân sự" description="Kết nối dữ liệu đội ngũ đang gián đoạn. Hãy thử lại." onRetry={() => void peopleQuery.refetch()} />;
  }
  if (forceState === "empty" || !peopleQuery.data || peopleQuery.data.items.length === 0) {
    return <EmptyState title="Chưa có nhân sự trong danh sách" description="Nhân sự sẽ xuất hiện tại đây khi được thêm vào công ty." />;
  }

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">People Intelligence</p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-ink sm:text-3xl">Đội ngũ {session?.user.companyName}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Xem thông tin nghề nghiệp tối thiểu trong phạm vi công ty. Hồ sơ nhân sự ở chế độ chỉ đọc.</p>
        </div>
        <Badge tone="neutral"><ShieldCheck size={13} aria-hidden="true" /> Chỉ đọc · {peopleQuery.data.total} nhân sự</Badge>
      </div>

      <div className="relative mt-6 max-w-xl">
        <label htmlFor="people-search" className="sr-only">Tìm nhân sự</label>
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} aria-hidden="true" />
        <Input id="people-search" type="search" role="searchbox" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên, chức danh hoặc phòng ban" className="pl-11 pr-12" />
        {search ? <button type="button" onClick={() => setSearch("")} aria-label="Xóa nội dung tìm kiếm" className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-background hover:text-ink"><X size={17} aria-hidden="true" /></button> : null}
      </div>

      {filtered.length === 0 ? (
        <Card className="mt-5 flex min-h-64 flex-col items-center justify-center p-7 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-background text-primary" aria-hidden="true"><Search size={23} /></span>
          <h2 className="mt-4 text-lg font-bold">Không có kết quả phù hợp</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted">Thử tên, chức danh hoặc phòng ban khác.</p>
          <Button type="button" variant="secondary" className="mt-5" onClick={() => setSearch("")}>Xóa bộ lọc</Button>
        </Card>
      ) : (
        <ul className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((person) => (
            <li key={person.id}>
              <Card className="h-full transition-shadow hover:shadow-soft">
                <CardContent className="flex h-full flex-col">
                  <div className="flex items-start gap-3">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#EAF1F6] font-bold text-primary" aria-hidden="true">{person.initials}</span>
                    <div className="min-w-0">
                      <h2 className="break-words font-bold text-ink">{person.name}</h2>
                      <p className="mt-1 text-sm leading-6 text-muted">{person.jobTitle}</p>
                    </div>
                  </div>
                  <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
                    <div><dt className="text-xs text-muted">Phòng ban</dt><dd className="mt-1 font-semibold">{person.department}</dd></div>
                    <div><dt className="text-xs text-muted">Kỹ năng</dt><dd className="mt-1 font-semibold">{person.skillCount} kỹ năng</dd></div>
                  </dl>
                  <p className="mt-4 text-xs text-muted">Cập nhật {formatUpdated(person.updatedAt)}</p>
                  <Button asChild variant="secondary" className="mt-5 w-full"><Link href={`/nhan-su/${encodeURIComponent(person.id)}`} aria-label={`Xem hồ sơ của ${person.name}`}>Xem hồ sơ <ArrowRight size={16} aria-hidden="true" /></Link></Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProfileSections({ profile }: { profile: CoreProfile }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader><h2 className="text-lg font-bold">Kỹ năng nổi bật</h2></CardHeader>
        <CardContent className="flex flex-wrap gap-2">{profile.skills.map((skill) => <Badge key={skill.id} tone="success">{skill.name} · {skill.level}/5</Badge>)}</CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="text-lg font-bold">Kinh nghiệm hiện tại</h2></CardHeader>
        <CardContent className="space-y-4">
          {profile.experiences.map((experience) => <div key={experience.id} className="flex gap-3"><BriefcaseBusiness className="mt-0.5 shrink-0 text-primary" size={18} aria-hidden="true" /><div><h3 className="font-semibold">{experience.title}</h3><p className="mt-1 text-sm text-muted">{experience.organization}</p></div></div>)}
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader><h2 className="text-lg font-bold">Dòng thời gian nghề nghiệp</h2></CardHeader>
        <CardContent>
          <ol className="grid gap-4 md:grid-cols-2">{profile.timeline.map((item) => <li key={item.id} className="flex gap-3 rounded-xl bg-background p-4"><CalendarDays className="mt-0.5 shrink-0 text-primary" size={18} aria-hidden="true" /><div><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-sm text-muted">{item.subtitle}</p></div></li>)}</ol>
        </CardContent>
      </Card>
    </div>
  );
}

export function PeopleDetailView({ employeeId, forceState }: { employeeId: string; forceState?: CoreUiForcedState }) {
  const { session } = useAuth();
  const canRead = Boolean(session?.user.permissions.includes("people:read"));
  const personQuery = useQuery({
    queryKey: ["people", session?.user.companyId, employeeId],
    queryFn: () => getPerson(session!, employeeId),
    enabled: canRead && forceState !== "loading" && forceState !== "error",
  });

  if (!canRead) {
    return (
      <Card role="alert" className="mx-auto flex min-h-80 max-w-2xl flex-col items-center justify-center p-8 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-[#FFF7E8] text-[#80520F]" aria-hidden="true"><ShieldCheck size={24} /></span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[#80520F]">Không có quyền truy cập</p>
        <h1 className="mt-2 text-xl font-bold text-ink">Khu vực này không thuộc vai trò của bạn</h1>
        <p className="mt-2 max-w-lg text-sm leading-6 text-muted">Bạn cần quyền xem nhân sự của công ty để mở hồ sơ này.</p>
        <Button asChild className="mt-6"><Link href="/dashboard">Về trang tổng quan</Link></Button>
      </Card>
    );
  }
  if (forceState === "error") return <ErrorState title="Chưa thể tải hồ sơ nhân sự" description="Hồ sơ có thể không còn tồn tại hoặc kết nối đang gián đoạn." onRetry={() => void personQuery.refetch()} />;
  if (forceState === "loading" || personQuery.isPending) return <LoadingState label="Đang tải hồ sơ nhân sự" />;
  if (personQuery.isError) return <ErrorState title="Chưa thể tải hồ sơ nhân sự" description="Hồ sơ có thể không còn tồn tại hoặc kết nối đang gián đoạn." onRetry={() => void personQuery.refetch()} />;
  if (forceState === "empty") return <EmptyState title="Không tìm thấy nhân sự" description="Quay lại danh sách để chọn một hồ sơ khác." />;
  if (!personQuery.data) return <EmptyState title="Không tìm thấy nhân sự" description="Quay lại danh sách để chọn một hồ sơ khác." />;
  const person = personQuery.data;

  return (
    <div className="space-y-6">
      <Link href="/nhan-su" className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-semibold text-primary hover:text-primary-strong"><ArrowLeft size={16} aria-hidden="true" /> Quay lại danh sách</Link>
      <Card>
        <CardContent className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
          <span className="grid size-16 place-items-center rounded-2xl bg-[#EAF1F6] text-xl font-bold text-primary" aria-hidden="true">{person.initials}</span>
          <div>
            <div className="flex flex-wrap items-center gap-2"><Badge tone="neutral"><ShieldCheck size={13} aria-hidden="true" /> Hồ sơ chỉ đọc</Badge><Badge tone="neutral">Phiên hồ sơ {person.profileVersion}</Badge></div>
            <h1 className="mt-2 break-words text-2xl font-bold tracking-[-0.03em] sm:text-3xl">{person.name}</h1>
            <p className="mt-1 text-base text-muted">{person.jobTitle} · {person.department}</p>
            <p className="mt-2 text-xs text-muted">{person.companyName} · Cập nhật {formatUpdated(person.updatedAt)}</p>
          </div>
        </CardContent>
      </Card>
      <ProfileSections profile={person} />
      <p className="flex items-center gap-2 text-xs leading-5 text-muted"><UsersRound size={15} aria-hidden="true" /> Chỉ hiển thị thông tin nghề nghiệp cần thiết trong phạm vi công ty.</p>
    </div>
  );
}
