"use client";

import { ProfileExtensionsPanel } from "@/features/profile-extensions/profile-extensions-panel";
import { EmploymentsPanel } from "@/features/profile-extensions/employments-panel";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, CalendarDays, Search, ShieldCheck, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/ui/app-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-provider";
import type { CoreUiForcedState } from "@/features/profile/profile-view";
import { getPerson, listAvailableCompanies, listPeople, type CoreProfile } from "@/lib/api";

function formatUpdated(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

export function PeopleListView({ forceState, initialCompanyId }: { forceState?: CoreUiForcedState; initialCompanyId?: string }) {
  const { session } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [page, setPage] = useState(1);
  const [selectedCompanyOverride, setSelectedCompanyOverride] = useState(
    session?.user.role === "SUPER_ADMIN" ? initialCompanyId ?? "" : session?.user.companyId ?? "",
  );
  const canRead = Boolean(session?.user.permissions.includes("people:read"));
  const isSuperAdmin = session?.user.role === "SUPER_ADMIN";
  const companiesQuery = useQuery({
    queryKey: ["company-options", session?.user.id],
    queryFn: () => listAvailableCompanies(session!),
    enabled: canRead && isSuperAdmin,
  });
  const requestedCompany = companiesQuery.data?.find((company) => company.id === selectedCompanyOverride);
  const selectedCompany = isSuperAdmin ? requestedCompany ?? companiesQuery.data?.[0] : undefined;
  const selectedCompanyId = isSuperAdmin ? selectedCompany?.id ?? "" : selectedCompanyOverride;
  const companyName = isSuperAdmin ? selectedCompany?.name : session?.user.companyName;
  const scopeReady = !isSuperAdmin || Boolean(selectedCompanyId);
  const peopleQuery = useQuery({
    queryKey: ["people", session?.user.id, selectedCompanyId || session?.user.companyId, deferredSearch, page],
    queryFn: () => listPeople(session!, {
      companyId: selectedCompanyId || session?.user.companyId,
      q: deferredSearch || undefined,
      page,
      pageSize: 20,
    }),
    enabled: canRead && scopeReady && forceState !== "loading" && forceState !== "error",
    placeholderData: (previous, previousQuery) => (
      previousQuery?.queryKey[2] === selectedCompanyId ? previous : undefined
    ),
  });
  const totalPages = Math.max(1, Math.ceil((peopleQuery.data?.total ?? 0) / (peopleQuery.data?.pageSize ?? 20)));

  if (!canRead) return <EmptyState title="Khu vực này không thuộc vai trò của bạn" description="Bạn cần quyền xem nhân sự của công ty để mở danh sách này." />;
  if (isSuperAdmin && companiesQuery.isPending) return <LoadingState label="Đang tải danh sách doanh nghiệp" />;
  if (isSuperAdmin && companiesQuery.isError) return <ErrorState title="Chưa thể tải danh sách doanh nghiệp" description="Hãy thử lại trước khi mở dữ liệu nhân sự." onRetry={() => void companiesQuery.refetch()} />;
  if (isSuperAdmin && companiesQuery.data?.length === 0) return <EmptyState title="Chưa có doanh nghiệp hoạt động" description="Danh sách nhân sự sẽ sẵn sàng sau khi có doanh nghiệp hoạt động." />;

  if (forceState === "error") {
    const retryPath = isSuperAdmin && selectedCompanyId ? `/nhan-su?companyId=${encodeURIComponent(selectedCompanyId)}` : "/nhan-su";
    return <ErrorState title="Chưa thể tải danh sách nhân sự" description="Kết nối dữ liệu đội ngũ đang gián đoạn. Hãy thử lại." onRetry={() => router.replace(retryPath)} />;
  }
  if (forceState === "loading" || !scopeReady || peopleQuery.isPending) return <LoadingState label="Đang tải danh sách nhân sự" />;
  if (peopleQuery.isError) {
    return <ErrorState title="Chưa thể tải danh sách nhân sự" description="Kết nối dữ liệu đội ngũ đang gián đoạn. Hãy thử lại." onRetry={() => void peopleQuery.refetch()} />;
  }
  if ((forceState === "empty" || !peopleQuery.data || peopleQuery.data.items.length === 0) && !deferredSearch) {
    return <EmptyState title="Chưa có nhân sự trong danh sách" description="Nhân sự sẽ xuất hiện tại đây khi được thêm vào công ty." />;
  }

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">People Intelligence</p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-ink sm:text-3xl">Đội ngũ {companyName}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Xem thông tin nghề nghiệp tối thiểu trong phạm vi công ty. Hồ sơ nhân sự ở chế độ chỉ đọc.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="neutral"><ShieldCheck size={13} aria-hidden="true" /> Chỉ đọc · {peopleQuery.data.total} nhân sự</Badge>
          <Button asChild variant="secondary">
            <Link href={`/nhan-su/tim-kiem${selectedCompanyId ? `?companyId=${encodeURIComponent(selectedCompanyId)}` : ""}`} prefetch={false}><Search size={16} aria-hidden="true" /> Tìm theo yêu cầu</Link>
          </Button>
        </div>
      </div>

      {isSuperAdmin ? (
        <div className="mt-6 max-w-xl">
          <label htmlFor="people-company" className="mb-2 block text-sm font-semibold text-ink">Chọn doanh nghiệp</label>
          <select
            id="people-company"
            value={selectedCompanyId}
            onChange={(event) => { setSelectedCompanyOverride(event.target.value); setPage(1); router.replace(`/nhan-su?companyId=${encodeURIComponent(event.target.value)}`); }}
            className="h-12 w-full rounded-xl border border-border bg-white px-4 text-sm text-ink shadow-[0_1px_2px_rgb(22_32_51_/_4%)] focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {companiesQuery.data?.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        </div>
      ) : null}

      <div className="relative mt-4 max-w-xl">
        <label htmlFor="people-search" className="sr-only">Tìm nhân sự</label>
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} aria-hidden="true" />
        <Input id="people-search" type="text" role="searchbox" inputMode="search" enterKeyHint="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm theo tên hoặc chức danh" className="pl-11 pr-12" />
        {search ? <button type="button" onClick={() => { setSearch(""); setPage(1); }} aria-label="Xóa nội dung tìm kiếm" className="absolute right-1 top-1/2 grid size-11 shrink-0 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-background hover:text-ink"><X size={17} aria-hidden="true" /></button> : null}
      </div>
      {peopleQuery.isFetching && !peopleQuery.isPending ? <p role="status" className="mt-3 text-sm font-medium text-muted">Đang cập nhật kết quả…</p> : null}

      {peopleQuery.data.items.length === 0 ? (
        <Card className="mt-5 flex min-h-64 flex-col items-center justify-center p-7 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-background text-primary" aria-hidden="true"><Search size={23} /></span>
          <h2 className="mt-4 text-lg font-bold">Không có kết quả phù hợp</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted">Thử tên hoặc chức danh khác.</p>
          <Button type="button" variant="secondary" className="mt-5" onClick={() => { setSearch(""); setPage(1); }}>Xóa bộ lọc</Button>
        </Card>
      ) : (
        <ul className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {peopleQuery.data.items.map((person) => (
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
                    <div><dt className="text-xs text-muted">Kỹ năng</dt><dd className="mt-1 font-semibold">{person.skillCount === null ? "Chưa đồng bộ" : `${person.skillCount} kỹ năng`}</dd></div>
                  </dl>
                  <p className="mt-4 text-xs text-muted">Cập nhật {formatUpdated(person.updatedAt)}</p>
                  <Button asChild variant="secondary" className="mt-5 w-full"><Link href={`/nhan-su/${encodeURIComponent(person.id)}${isSuperAdmin ? `?companyId=${encodeURIComponent(selectedCompanyId)}` : ""}`} aria-label={`Xem hồ sơ của ${person.name}`}>Xem hồ sơ <ArrowRight size={16} aria-hidden="true" /></Link></Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {peopleQuery.data.total > peopleQuery.data.pageSize ? (
        <nav aria-label="Phân trang danh sách nhân sự" className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-muted">Trang {peopleQuery.data.page}/{totalPages}</p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={page <= 1 || peopleQuery.isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))}>Trang trước</Button>
            <Button type="button" variant="secondary" disabled={page >= totalPages || peopleQuery.isFetching} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Trang sau</Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function ProfileSections({ profile }: { profile: CoreProfile }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader><h2 className="text-lg font-bold">Kỹ năng nổi bật</h2></CardHeader>
        <CardContent className="flex flex-wrap gap-2">{profile.skills.length > 0 ? profile.skills.map((skill) => <Badge key={skill.id} tone="success">{skill.name} · {skill.level}/5</Badge>) : <p className="text-sm leading-6 text-muted">Chưa có dữ liệu kỹ năng trong phạm vi được phép xem.</p>}</CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="text-lg font-bold">Kinh nghiệm hiện tại</h2></CardHeader>
        <CardContent className="space-y-4">
          {profile.experiences.length > 0 ? profile.experiences.map((experience) => <div key={experience.id} className="flex gap-3"><BriefcaseBusiness className="mt-0.5 shrink-0 text-primary" size={18} aria-hidden="true" /><div><h3 className="font-semibold">{experience.title}</h3><p className="mt-1 text-sm text-muted">{experience.organization}</p></div></div>) : <p className="text-sm leading-6 text-muted">Chưa có dữ liệu kinh nghiệm trong phạm vi được phép xem.</p>}
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader><h2 className="text-lg font-bold">Dòng thời gian nghề nghiệp</h2></CardHeader>
        <CardContent>
          {profile.timeline.length > 0 ? <ol className="grid gap-4 md:grid-cols-2">{profile.timeline.map((item) => <li key={item.id} className="flex gap-3 rounded-xl bg-background p-4"><CalendarDays className="mt-0.5 shrink-0 text-primary" size={18} aria-hidden="true" /><div><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-sm text-muted">{item.subtitle}</p></div></li>)}</ol> : <p className="text-sm leading-6 text-muted">Chưa có mốc nghề nghiệp trong phạm vi được phép xem.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

export function PeopleDetailView({ employeeId, forceState, companyId }: { employeeId: string; forceState?: CoreUiForcedState; companyId?: string }) {
  const { session } = useAuth();
  const router = useRouter();
  const canRead = Boolean(session?.user.permissions.includes("people:read"));
  const isSuperAdmin = session?.user.role === "SUPER_ADMIN";
  const companiesQuery = useQuery({
    queryKey: ["company-options", session?.user.id],
    queryFn: () => listAvailableCompanies(session!),
    enabled: canRead && isSuperAdmin,
  });
  const selectedCompany = companiesQuery.data?.find((company) => company.id === companyId);
  const effectiveCompanyId = isSuperAdmin ? selectedCompany?.id ?? "" : session?.user.companyId ?? "";
  const effectiveCompanyName = isSuperAdmin ? selectedCompany?.name : session?.user.companyName;
  const scopeReady = !isSuperAdmin || Boolean(selectedCompany);
  const personQuery = useQuery({
    queryKey: ["person", session?.user.id, effectiveCompanyId, employeeId],
    queryFn: () => getPerson(session!, employeeId, {
      companyId: effectiveCompanyId,
      companyName: effectiveCompanyName,
    }),
    enabled: canRead && scopeReady && forceState !== "loading" && forceState !== "error",
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
  if (isSuperAdmin && companiesQuery.isPending) return <LoadingState label="Đang xác minh doanh nghiệp" />;
  if (isSuperAdmin && companiesQuery.isError) return <ErrorState title="Chưa thể xác minh doanh nghiệp" description="Quay lại danh sách và thử chọn doanh nghiệp lần nữa." onRetry={() => void companiesQuery.refetch()} />;
  if (!scopeReady) return <EmptyState title="Hãy chọn doanh nghiệp trước" description="Quay lại danh sách nhân sự và chọn doanh nghiệp cần xem." />;
  if (forceState === "error") {
    const retryPath = `/nhan-su/${encodeURIComponent(employeeId)}${isSuperAdmin && effectiveCompanyId ? `?companyId=${encodeURIComponent(effectiveCompanyId)}` : ""}`;
    return <ErrorState title="Chưa thể tải hồ sơ nhân sự" description="Hồ sơ có thể không còn tồn tại hoặc kết nối đang gián đoạn." onRetry={() => router.replace(retryPath)} />;
  }
  if (forceState === "loading" || personQuery.isPending) return <LoadingState label="Đang tải hồ sơ nhân sự" />;
  if (personQuery.isError) return <ErrorState title="Chưa thể tải hồ sơ nhân sự" description="Hồ sơ có thể không còn tồn tại hoặc kết nối đang gián đoạn." onRetry={() => void personQuery.refetch()} />;
  if (forceState === "empty") return <EmptyState title="Không tìm thấy nhân sự" description="Quay lại danh sách để chọn một hồ sơ khác." />;
  if (!personQuery.data) return <EmptyState title="Không tìm thấy nhân sự" description="Quay lại danh sách để chọn một hồ sơ khác." />;
  const person = personQuery.data;

  return (
    <div className="space-y-6">
      <Link href={isSuperAdmin && effectiveCompanyId ? `/nhan-su?companyId=${encodeURIComponent(effectiveCompanyId)}` : "/nhan-su"} className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-semibold text-primary hover:text-primary-strong"><ArrowLeft size={16} aria-hidden="true" /> Quay lại danh sách</Link>
      <Card>
        <CardContent className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
          <span className="grid size-16 place-items-center rounded-2xl bg-[#EAF1F6] text-xl font-bold text-primary" aria-hidden="true">{person.initials}</span>
          <div>
            <div className="flex flex-wrap items-center gap-2"><Badge tone="neutral"><ShieldCheck size={13} aria-hidden="true" /> Hồ sơ chỉ đọc</Badge><Badge tone="neutral">Phiên hồ sơ {person.profileVersion}</Badge></div>
            <h1 className="mt-2 break-words text-2xl font-bold tracking-[-0.03em] sm:text-3xl">{person.name}</h1>
            <p className="mt-1 text-base text-muted">{person.jobTitle || "Chưa cập nhật chức danh"} · {person.department}</p>
            <p className="mt-2 text-xs text-muted">{person.companyName} · Cập nhật {formatUpdated(person.updatedAt)}</p>
          </div>
        </CardContent>
      </Card>
      <ProfileSections profile={person} />
      <ProfileExtensionsPanel userId={employeeId} />
      <EmploymentsPanel userId={employeeId} canManage={Boolean(session?.user.permissions.includes("people:write"))} />
      <p className="flex items-center gap-2 text-xs leading-5 text-muted"><UsersRound size={15} aria-hidden="true" /> Chỉ hiển thị thông tin nghề nghiệp cần thiết trong phạm vi công ty.</p>
    </div>
  );
}
