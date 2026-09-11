"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, Map, Target, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/app-state";
import { useAuth } from "@/features/auth/auth-provider";
import { getDashboardSummary } from "@/lib/api";

type ForcedState = "loading" | "empty" | "error" | undefined;

function CircularProgress({ value }: { value: number }) {
  const circumference = 2 * Math.PI * 27;
  const dash = (value / 100) * circumference;

  return (
    <div className="relative grid size-18 place-items-center" role="img" aria-label={`Hồ sơ hoàn thành ${value}%`}>
      <svg className="size-18 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="27" fill="none" stroke="#E5E7EB" strokeWidth="6" />
        <circle cx="32" cy="32" r="27" fill="none" stroke="#5B7F65" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${dash} ${circumference - dash}`} />
      </svg>
      <span className="absolute text-sm font-bold text-ink">{value}%</span>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone }: { icon: typeof Target; label: string; value: string; detail: string; tone: "blue" | "sage" | "violet" | "amber" }) {
  const toneClass = {
    blue: "bg-[#EAF1F6] text-primary",
    sage: "bg-[#EFF6F0] text-sage-strong",
    violet: "bg-[#F1EEFF] text-violet-strong",
    amber: "bg-[#FFF7E8] text-[#8A5A12]",
  }[tone];

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium leading-5 text-muted sm:text-sm">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-[-0.03em] text-ink">{value}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{detail}</p>
        </div>
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${toneClass}`} aria-hidden="true"><Icon size={20} /></span>
      </div>
    </Card>
  );
}

export function DashboardView({ forceState }: { forceState?: ForcedState }) {
  const { session } = useAuth();
  const summary = useQuery({
    queryKey: ["dashboard-summary", session?.user.id],
    queryFn: () => getDashboardSummary(session!),
    enabled: Boolean(session),
  });

  if (forceState === "loading" || summary.isPending) return <LoadingState label="Đang tải tổng quan" />;
  if (forceState === "error" || summary.isError) {
    return <ErrorState title="Chưa thể tải tổng quan" description="Kết nối dữ liệu đang gián đoạn. Bạn có thể thử lại mà không mất thay đổi." onRetry={() => void summary.refetch()} />;
  }
  if (forceState === "empty") {
    return <EmptyState title="Chưa có dữ liệu tổng quan" description="Bắt đầu cập nhật hồ sơ năng lực để CareerMate xây dựng lộ trình phù hợp cho bạn." />;
  }

  const data = summary.data;
  if (!data || !session) return null;

  const isAdmin = session.user.role !== "EMPLOYEE";
  const milestone = data.nextMilestone;

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone={isAdmin ? "success" : "neutral"}>{isAdmin ? "Góc nhìn quản lý" : "Góc nhìn cá nhân"}</Badge>
            <span className="text-xs text-muted">Cập nhật hôm nay</span>
          </div>
          <h1 className="mt-3 text-balance text-2xl font-bold tracking-[-0.03em] text-ink sm:text-3xl">{data.greeting}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {isAdmin ? "Nắm bắt tiến độ đội ngũ và những việc cần ưu tiên trong một màn hình." : "Bạn đang đi đúng hướng. Đây là những việc quan trọng nhất trong hành trình của bạn."}
          </p>
        </div>
        <Button asChild variant="secondary"><Link href="/lo-trinh" prefetch={false}>Mở lộ trình <ArrowRight size={16} aria-hidden="true" /></Link></Button>
      </header>

      <section aria-label="Các chỉ số chính" className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard icon={UserRound} label={isAdmin ? "Hồ sơ đã cập nhật" : "Hồ sơ năng lực"} value={`${data.profileCompletion}%`} detail={isAdmin ? "Tỷ lệ của đội ngũ" : "Đã xác minh 12 thông tin"} tone="sage" />
        <MetricCard icon={Target} label={isAdmin ? "Mục tiêu đội ngũ" : "Mục tiêu đang thực hiện"} value={String(data.activeGoals)} detail="1 mục tiêu cần cập nhật" tone="blue" />
        <MetricCard icon={Map} label="Chặng đã hoàn thành" value={`${data.completedMilestones}/${data.totalMilestones}`} detail="Tiến độ đúng kế hoạch" tone="violet" />
        <MetricCard icon={CalendarDays} label="Đánh giá tiếp theo" value="18/09" detail={data.nextAssessment} tone="amber" />
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Năng lực trọng tâm</p>
              <h2 className="mt-1 text-lg font-bold text-ink">Khoảng cách đến mục tiêu</h2>
            </div>
            <CircularProgress value={data.profileCompletion} />
          </CardHeader>
          <CardContent className="space-y-5">
            {data.skillFocus.map((skill) => (
              <div key={skill.name}>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium text-ink">{skill.name}</span>
                  <span className="whitespace-nowrap text-xs text-muted">{skill.level} / {skill.target}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-background" role="progressbar" aria-label={skill.name} aria-valuemin={0} aria-valuemax={skill.target} aria-valuenow={skill.level}>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (skill.level / skill.target) * 100)}%` }} />
                </div>
              </div>
            ))}
            <Button asChild variant="ghost" className="px-0 text-primary hover:bg-transparent">
              <Link href="/ho-so" prefetch={false}>Xem hồ sơ năng lực <ArrowRight size={16} aria-hidden="true" /></Link>
            </Button>
          </CardContent>
        </Card>

        {milestone ? <Card className="relative overflow-hidden bg-[#F7F5FF]">
          <div className="absolute -right-16 -top-16 size-52 rounded-full bg-white/60 blur-3xl" aria-hidden="true" />
          <CardHeader className="relative z-10">
            <div className="flex items-center justify-between gap-3">
              <Badge tone="ai">Lộ trình cùng Milo</Badge>
              <span className="text-xs font-semibold text-violet-strong">{milestone.progress}%</span>
            </div>
            <h2 className="mt-3 text-xl font-bold tracking-[-0.02em] text-ink">{milestone.title}</h2>
            <p className="mt-1 text-sm text-muted">Đang thực hiện · {milestone.period}</p>
          </CardHeader>
          <CardContent className="relative z-10 flex min-h-56 flex-col items-start justify-between gap-3 pt-1 sm:flex-row sm:items-end">
            <div className="pb-2">
              <div className="flex items-center gap-2 text-xs font-medium text-sage-strong"><CheckCircle2 size={16} aria-hidden="true" /> 2 nhiệm vụ đã hoàn thành</div>
              <Button asChild className="mt-5"><Link href="/lo-trinh" prefetch={false}>Tiếp tục bước tiếp theo <ArrowRight size={16} aria-hidden="true" /></Link></Button>
            </div>
            <div className="relative h-52 w-40 shrink-0 sm:w-48">
              <Image src="/brand/milo/milo-purple-tablet.webp" alt="Milo hướng dẫn lộ trình" fill loading="eager" sizes="192px" className="object-contain object-bottom" />
            </div>
          </CardContent>
        </Card> : null}
      </div>

      <Card className="mt-4">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EFF6F0] text-sage-strong" aria-hidden="true"><BadgeCheck size={20} /></span>
            <div>
              <h2 className="text-sm font-bold text-ink">Đánh giá năng lực sắp tới</h2>
              <p className="mt-1 text-xs leading-5 text-muted">Bạn có thể xem tiêu chí và chuẩn bị minh chứng trước ngày {data.nextAssessment}.</p>
            </div>
          </div>
          <Button asChild variant="secondary" size="sm"><Link href="/danh-gia" prefetch={false}>Xem tiêu chí</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
