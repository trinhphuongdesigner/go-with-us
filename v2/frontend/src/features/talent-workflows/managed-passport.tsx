"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SnapshotView } from "./passport";
import { Loading, panelClass, type Snapshot, statusLabel, useTalentQuery } from "./shared";

type ManagedPassport = {
  person: { name: string; jobTitle: string | null; companyId: string };
  employments: Array<{ id: string; title: string; startDate: string; endDate: string | null; status: string }>;
  assessments: Array<{ type: string; totalScore: number | null; contributionScore: number | null; attitudeScore: number | null; approvedAt: string | null }>;
  skills: Snapshot["skills"];
  projects: Array<{ name: string; role: string | null; contribution: string | null }>;
  approvedSummaries: Array<{ id: string; source: string; snapshot: Snapshot }>;
};

function displayDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa ghi nhận";
}

export function TalentManagedPassport({ userId }: { userId: string }) {
  const query = useTalentQuery<ManagedPassport>(`/career-passport?userId=${encodeURIComponent(userId)}`);
  // Do not display previously cached private content after a failed authorization refresh.
  const passport = query.isError ? undefined : query.data;
  const scores = passport?.assessments.flatMap(row => row.totalScore === null ? [] : [row.totalScore]) ?? [];
  const average = scores.length ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2) : null;

  return <main className="mx-auto max-w-6xl space-y-6">
    <header className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">CareerMate · Hồ sơ có căn cứ</p>
      <h1 className="text-3xl font-bold text-ink">{passport ? `Hộ chiếu nghề nghiệp · ${passport.person.name}` : "Hộ chiếu nghề nghiệp nhân sự"}</h1>
      <p className="max-w-3xl text-sm leading-6 text-muted">Chế độ chỉ đọc dành cho người có quyền xem hồ sơ. Membership bổ sung không cấp quyền xem hộ chiếu của công ty khác.</p>
      <Button variant="secondary" asChild><Link href={passport ? `/nhan-su/${encodeURIComponent(userId)}?companyId=${encodeURIComponent(passport.person.companyId)}` : "/nhan-su"}>Về hồ sơ nhân sự</Link></Button>
    </header>
    <Loading loading={query.isLoading} error={query.error} retry={() => query.refetch()} />
    {passport && <>
      <section className={`${panelClass} grid gap-5 sm:grid-cols-3`}>
        <div><p className="text-sm text-muted">Chức danh hiện tại</p><h2 className="mt-2 text-xl font-bold">{passport.person.jobTitle || "Chưa cập nhật"}</h2></div>
        <div><p className="text-sm text-muted">Đánh giá đã duyệt hiển thị</p><p className="mt-2 text-2xl font-bold text-primary">{passport.assessments.length}</p></div>
        <div><p className="text-sm text-muted">Điểm trung bình các lượt hiển thị</p><p className="mt-2 text-2xl font-bold text-primary">{average === null ? "Chưa có điểm" : `${average}/10`}</p></div>
      </section>
      <section className={`${panelClass} space-y-4`}>
        <h2 className="text-xl font-bold">Quá trình làm việc</h2>
        {passport.employments.length === 0 && <p className="text-sm text-muted">Chưa ghi nhận giai đoạn làm việc.</p>}
        {passport.employments.map(row => <article key={row.id} className="border-t border-border pt-4"><h3 className="font-semibold">{row.title}</h3><p className="mt-2 text-sm text-muted">{displayDate(row.startDate)} — {row.endDate ? displayDate(row.endDate) : "Hiện tại"} · {row.status === "ACTIVE" ? "Đang làm việc" : "Đã kết thúc"}</p></article>)}
      </section>
      <section className={`${panelClass} space-y-4`}>
        <h2 className="text-xl font-bold">Năng lực tự khai báo</h2>
        <p className="text-sm text-muted">Kỹ năng và rating là dữ liệu tự khai báo, không đồng nghĩa đã được tổ chức xác minh.</p>
        <div className="flex flex-wrap gap-2">{passport.skills.map((skill, index) => <span key={`${skill.name}:${index}`} className="rounded-lg bg-background px-3 py-2 text-sm">{skill.name} · {skill.rating}/5</span>)}</div>
        {passport.skills.length === 0 && <p className="text-sm text-muted">Chưa có kỹ năng.</p>}
      </section>
      <section className={`${panelClass} space-y-4`}>
        <h2 className="text-xl font-bold">Dự án và đóng góp</h2>
        {passport.projects.length === 0 && <p className="text-sm text-muted">Chưa có dự án được ghi nhận.</p>}
        {passport.projects.map((project, index) => <article key={index} className="space-y-2 border-t border-border pt-4"><h3 className="font-semibold">{project.name}</h3><p className="text-sm text-primary">{project.role || "Chưa ghi vai trò"}</p><p className="whitespace-pre-wrap text-sm leading-6">{project.contribution || "Chưa ghi đóng góp"}</p></article>)}
      </section>
      <section className={`${panelClass} space-y-4`}>
        <h2 className="text-xl font-bold">Đánh giá đã xác nhận</h2>
        <p className="text-sm text-muted">Tối đa 100 lượt đã duyệt gần nhất. Không hiển thị bản nháp hoặc nhận xét riêng trên phiếu.</p>
        {passport.assessments.length === 0 && <p className="text-sm text-muted">Chưa có đánh giá được duyệt.</p>}
        <div className="grid gap-3 sm:grid-cols-2">{passport.assessments.map((row, index) => <article key={index} className="space-y-2 rounded-xl bg-background p-4"><h3 className="font-semibold">{statusLabel[row.type] ?? row.type}</h3><p className="text-sm text-muted">Xác nhận: {displayDate(row.approvedAt)}</p><p className="text-sm">Tổng: {row.totalScore ?? "—"}/10 · Đóng góp: {row.contributionScore ?? "—"}/10 · Thái độ: {row.attitudeScore ?? "—"}/10</p></article>)}</div>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Tổng kết đã duyệt</h2>
        <p className="text-sm text-muted">Nội dung được đóng băng tại thời điểm xác nhận. Trang này không tạo hoặc công bố liên kết chia sẻ.</p>
        {passport.approvedSummaries.length === 0 && <p className={`${panelClass} text-sm text-muted`}>Chưa có tổng kết đã được xác nhận.</p>}
        {passport.approvedSummaries.map(summary => <div className="space-y-2" key={summary.id}><p className="text-sm font-semibold text-primary">{summary.source === "PERSONAL" ? "Tổng kết cá nhân" : "Tổng kết tổ chức"}</p><SnapshotView snapshot={summary.snapshot} /></div>)}
      </section>
    </>}
  </main>;
}
