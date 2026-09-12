"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/features/auth/auth-provider";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/app-state";

interface Summary {
  personal: boolean; people?: number; companies?: number;
  skillCount?: number; projectCount?: number; roadmapCount?: number;
  milestoneCount?: number; completedMilestones?: number; taskCount?: number;
  completedTasks?: number; overdueMilestones?: number;
  skills?: { name: string; rating: number }[];
  upcoming?: { id: string; title: string; dueDate: string | null; roadmap: string;
    category: string; tasks: { id: string; title: string }[] }[];
}

export function LiveDashboard() {
  const { session } = useAuth();
  const query = useQuery({ queryKey: ["live-dashboard", session?.user.id, session?.user.companyId],
    queryFn: () => apiRequest<Summary>("/dashboard", undefined, session!.accessToken), enabled: !!session });
  if (query.isPending) return <LoadingState label="Đang tải tổng quan" />;
  if (query.isError) return <ErrorState title="Chưa tải được tổng quan" description="Hãy thử tải lại dữ liệu." onRetry={() => void query.refetch()} />;
  const data = query.data;
  if (!session) return null;
  const metrics = data.personal ? [
    ["Kỹ năng đã khai báo", data.skillCount], ["Dự án", data.projectCount],
    ["Chặng hoàn thành", `${data.completedMilestones}/${data.milestoneCount}`],
    ["Chặng quá hạn", data.overdueMilestones],
  ] : [["Tài khoản hoạt động", data.people], ["Công ty trong phạm vi", data.companies]];
  return <div className="space-y-6">
    <header><p className="text-sm font-semibold text-primary">{data.personal ? "Không gian cá nhân" : "Không gian quản trị"}</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Chào {session.user.name}</h1><p className="mt-2 text-sm text-muted">{data.personal ? "Tổng quan từ hồ sơ và lộ trình bạn đã lưu. Kỹ năng tự khai báo không phải kết quả được xác minh." : "Dữ liệu tài khoản và công ty trong phạm vi quyền của bạn."}</p></header>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value]) => <Card key={String(label)} className="p-5"><p className="text-sm text-muted">{label}</p><p className="mt-3 text-3xl font-bold">{value ?? 0}</p></Card>)}</div>
    {data.personal ? <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
      <Card className="p-6"><h2 className="text-xl font-bold">Kỹ năng hiện tại</h2><ul className="mt-5 space-y-4">{data.skills?.map((skill) => <li key={skill.name}><div className="mb-2 flex justify-between gap-3 text-sm"><span>{skill.name}</span><span>{skill.rating}/5</span></div><progress className="h-2 w-full accent-primary" value={skill.rating} max={5} aria-label={`${skill.name}: ${skill.rating} trên 5`} /></li>)}</ul>{!data.skills?.length ? <p className="mt-4 text-sm text-muted">Chưa có kỹ năng. Bắt đầu với hồ sơ của bạn.</p> : null}<Button asChild variant="secondary" className="mt-6"><Link href="/ho-so">Cập nhật hồ sơ</Link></Button></Card>
      <Card className="p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Bước tiếp theo</h2><span className="text-sm text-muted">{data.completedTasks}/{data.taskCount} công việc hoàn thành</span></div><ul className="mt-5 space-y-4">{data.upcoming?.map((milestone) => <li key={milestone.id} className="rounded-xl bg-primary-subtle p-4"><p className="text-xs font-semibold text-primary">{milestone.category === "PERSONAL" ? "Cá nhân" : "Công việc"} · {milestone.roadmap}</p><h3 className="mt-2 font-bold">{milestone.title}</h3>{milestone.dueDate ? <p className="mt-1 text-xs text-muted">Hạn: {milestone.dueDate}</p> : null}<ul className="mt-3 space-y-1 text-sm">{milestone.tasks.slice(0, 3).map((task) => <li key={task.id}>{task.title}</li>)}</ul></li>)}</ul>{!data.upcoming?.length ? <p className="mt-4 text-sm text-muted">Chưa có chặng đang thực hiện. Bạn có thể tạo lộ trình mới.</p> : null}<Button asChild className="mt-6"><Link href="/lo-trinh">Mở lộ trình phát triển</Link></Button></Card>
    </div> : <Card className="flex flex-wrap gap-3 p-6">{session.user.permissions.includes("people:read") ? <Button asChild><Link href="/nhan-su">Xem đội ngũ</Link></Button> : null}{session.user.permissions.includes("company:manage") ? <Button asChild variant="secondary"><Link href="/cong-ty">Quản lý công ty và tài khoản</Link></Button> : null}{session.user.permissions.includes("platform:manage") ? <Button asChild variant="secondary"><Link href="/he-thong">Quản trị hệ thống</Link></Button> : null}</Card>}
  </div>;
}
