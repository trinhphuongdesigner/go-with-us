"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Clock3,
  Map,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { ErrorState, LoadingState } from "@/components/ui/app-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-provider";
import { apiRequest } from "@/lib/api";

interface Summary {
  personal: boolean;
  people?: number;
  companies?: number;
  skillCount?: number;
  projectCount?: number;
  roadmapCount?: number;
  milestoneCount?: number;
  completedMilestones?: number;
  taskCount?: number;
  completedTasks?: number;
  overdueMilestones?: number;
  skills?: { name: string; rating: number }[];
  upcoming?: {
    id: string;
    title: string;
    dueDate: string | null;
    roadmap: string;
    category: string;
    tasks: { id: string; title: string }[];
  }[];
}

type MetricTone = "blue" | "sage" | "violet" | "amber";

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  detail: string;
  tone: MetricTone;
}) {
  const toneClass: Record<MetricTone, string> = {
    blue: "bg-primary-subtle text-primary",
    sage: "bg-[#EFF6F0] text-sage-strong",
    violet: "bg-[#F1EEFF] text-violet-strong",
    amber: "bg-[#FFF7E8] text-[#8A5A12]",
  };

  return (
    <Card className="p-4 shadow-[0_10px_28px_rgb(24_49_42/0.04)] sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium leading-5 text-muted sm:text-sm">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-[-0.03em] text-ink">{value}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{detail}</p>
        </div>
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${toneClass[tone]}`}
          aria-hidden="true"
        >
          <Icon size={20} />
        </span>
      </div>
    </Card>
  );
}

function CircularProgress({ value }: { value: number }) {
  const normalizedValue = Math.min(100, Math.max(0, value));
  const circumference = 2 * Math.PI * 27;
  const dash = (normalizedValue / 100) * circumference;

  return (
    <div
      className="relative grid size-18 place-items-center"
      role="img"
      aria-label={`Mức kỹ năng trung bình ${normalizedValue}%`}
    >
      <svg className="size-18 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="27" fill="none" stroke="#E5E7EB" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r="27"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          className="text-sage"
        />
      </svg>
      <span className="absolute text-sm font-bold text-ink">{normalizedValue}%</span>
    </div>
  );
}

function formatDueDate(value: string | null | undefined) {
  if (!value) return "Chưa đặt hạn";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function PersonalDashboard({ data, name }: { data: Summary; name: string }) {
  const skills = data.skills ?? [];
  const totalMilestones = data.milestoneCount ?? 0;
  const completedMilestones = data.completedMilestones ?? 0;
  const totalTasks = data.taskCount ?? 0;
  const completedTasks = data.completedTasks ?? 0;
  const nextMilestone = data.upcoming?.[0];
  const averageSkill = skills.length
    ? Math.round(
        (skills.reduce((total, skill) => total + Math.min(5, Math.max(0, skill.rating)), 0) /
          (skills.length * 5)) *
          100,
      )
    : 0;
  const roadmapProgress = totalTasks
    ? Math.round((completedTasks / totalTasks) * 100)
    : totalMilestones
      ? Math.round((completedMilestones / totalMilestones) * 100)
      : 0;

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">Góc nhìn cá nhân</Badge>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span className="size-1.5 rounded-full bg-sage" aria-hidden="true" />
              Dữ liệu trực tiếp từ FastAPI
            </span>
          </div>
          <h1 className="mt-3 text-balance text-2xl font-bold tracking-[-0.03em] text-ink sm:text-3xl">
            Chào {name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Đây là những điểm quan trọng nhất từ hồ sơ và lộ trình bạn đã lưu.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/lo-trinh" prefetch={false}>
            Mở lộ trình <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </Button>
      </header>

      <section
        aria-label="Các chỉ số chính"
        className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
      >
        <MetricCard
          icon={UserRound}
          label="Kỹ năng đã khai báo"
          value={String(data.skillCount ?? skills.length)}
          detail={`${data.projectCount ?? 0} dự án trong hồ sơ`}
          tone="sage"
        />
        <MetricCard
          icon={Target}
          label="Lộ trình đang thực hiện"
          value={String(data.roadmapCount ?? 0)}
          detail={`${totalTasks} công việc cần theo dõi`}
          tone="blue"
        />
        <MetricCard
          icon={Map}
          label="Chặng đã hoàn thành"
          value={`${completedMilestones}/${totalMilestones}`}
          detail="Tiến độ từ lộ trình đã lưu"
          tone="violet"
        />
        <MetricCard
          icon={Clock3}
          label="Chặng quá hạn"
          value={String(data.overdueMilestones ?? 0)}
          detail={(data.overdueMilestones ?? 0) > 0 ? "Cần ưu tiên xử lý" : "Đang đúng kế hoạch"}
          tone="amber"
        />
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <Card className="shadow-[0_16px_36px_rgb(24_49_42/0.05)]">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
                Năng lực trọng tâm
              </p>
              <h2 className="mt-1 text-lg font-bold text-ink">Kỹ năng hiện tại</h2>
            </div>
            <CircularProgress value={averageSkill} />
          </CardHeader>
          <CardContent className="space-y-5">
            {skills.slice(0, 4).map((skill) => {
              const rating = Math.min(5, Math.max(0, skill.rating));
              return (
                <div key={skill.name}>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-medium text-ink">{skill.name}</span>
                    <span className="whitespace-nowrap text-xs text-muted">{rating} / 5</span>
                  </div>
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-background"
                    role="progressbar"
                    aria-label={skill.name}
                    aria-valuemin={0}
                    aria-valuemax={5}
                    aria-valuenow={rating}
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${rating * 20}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {!skills.length ? (
              <div className="rounded-xl bg-background px-4 py-5 text-sm leading-6 text-muted">
                Chưa có kỹ năng nào trong hồ sơ. Hãy thêm kỹ năng đầu tiên để theo dõi tiến độ.
              </div>
            ) : null}
            <Button asChild variant="ghost" className="px-0 text-primary hover:bg-transparent">
              <Link href="/ho-so" prefetch={false}>
                Xem hồ sơ năng lực <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-[#F7F5FF] shadow-[0_16px_36px_rgb(36_24_56/0.06)]">
          <div
            className="absolute -right-16 -top-16 size-52 rounded-full bg-white/60 blur-3xl"
            aria-hidden="true"
          />
          <CardHeader className="relative z-10">
            <div className="flex items-center justify-between gap-3">
              <Badge tone="ai">Lộ trình cùng Milo</Badge>
              <span className="text-xs font-semibold text-violet-strong">{roadmapProgress}%</span>
            </div>
            <h2 className="mt-3 text-xl font-bold tracking-[-0.02em] text-ink">
              {nextMilestone?.title ?? "Sẵn sàng cho chặng tiếp theo"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {nextMilestone
                ? `${nextMilestone.category === "PERSONAL" ? "Cá nhân" : "Công việc"} · ${nextMilestone.roadmap}`
                : "Tạo lộ trình để Milo đồng hành cùng bạn"}
            </p>
          </CardHeader>
          <CardContent className="relative z-10 flex min-h-56 flex-col items-start justify-between gap-3 pt-1 sm:flex-row sm:items-end">
            <div className="pb-2">
              <div className="flex items-center gap-2 text-xs font-medium text-sage-strong">
                <CheckCircle2 size={16} aria-hidden="true" />
                {completedTasks}/{totalTasks} công việc đã hoàn thành
              </div>
              {nextMilestone ? (
                <p className="mt-2 text-xs text-muted">Hạn {formatDueDate(nextMilestone.dueDate)}</p>
              ) : null}
              <Button asChild className="mt-5">
                <Link href="/lo-trinh" prefetch={false}>
                  {nextMilestone ? "Tiếp tục bước tiếp theo" : "Tạo lộ trình"}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <div className="relative h-52 w-40 shrink-0 sm:w-48">
              <Image
                src="/brand/milo/milo-purple-tablet.webp"
                alt="Milo hướng dẫn lộ trình"
                fill
                loading="eager"
                sizes="192px"
                className="object-contain object-bottom"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 shadow-[0_12px_30px_rgb(24_49_42/0.04)]">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EFF6F0] text-sage-strong"
              aria-hidden="true"
            >
              <BadgeCheck size={20} />
            </span>
            <div>
              <h2 className="text-sm font-bold text-ink">Hồ sơ và lộ trình đã được đồng bộ</h2>
              <p className="mt-1 text-xs leading-5 text-muted">
                Các chỉ số trên được tổng hợp từ dữ liệu bạn đã lưu, không phải dữ liệu minh hoạ.
              </p>
            </div>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href="/ho-so" prefetch={false}>Cập nhật hồ sơ</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ManagementDashboard({ data, name, permissions }: { data: Summary; name: string; permissions: string[] }) {
  return (
    <div>
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success">Góc nhìn quản lý</Badge>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <span className="size-1.5 rounded-full bg-sage" aria-hidden="true" />
            Dữ liệu trực tiếp từ FastAPI
          </span>
        </div>
        <h1 className="mt-3 text-balance text-2xl font-bold tracking-[-0.03em] text-ink sm:text-3xl">
          Chào {name}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Nắm bắt phạm vi quản lý và mở nhanh không gian cần ưu tiên.
        </p>
      </header>

      <section aria-label="Các chỉ số quản lý" className="mt-6 grid gap-4 sm:grid-cols-2">
        <MetricCard
          icon={UsersRound}
          label="Tài khoản trong phạm vi"
          value={String(data.people ?? 0)}
          detail="Theo quyền truy cập hiện tại"
          tone="sage"
        />
        <MetricCard
          icon={Building2}
          label="Doanh nghiệp trong phạm vi"
          value={String(data.companies ?? 0)}
          detail="Không gian có thể quản lý"
          tone="blue"
        />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="shadow-[0_16px_36px_rgb(24_49_42/0.05)]">
          <CardContent className="flex min-h-64 flex-col justify-between">
            <div>
              <span className="grid size-11 place-items-center rounded-xl bg-primary-subtle text-primary" aria-hidden="true">
                <BriefcaseBusiness size={22} />
              </span>
              <h2 className="mt-5 text-xl font-bold text-ink">Không gian đội ngũ</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Xem hồ sơ, năng lực và tiến độ của nhân sự trong đúng phạm vi được cấp.
              </p>
            </div>
            {permissions.includes("people:read") ? (
              <Button asChild className="mt-6 self-start">
                <Link href="/nhan-su" prefetch={false}>
                  Xem đội ngũ <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-[#F7F5FF] shadow-[0_16px_36px_rgb(36_24_56/0.06)]">
          <CardContent className="relative z-10 flex min-h-64 flex-col justify-between">
            <div>
              <span className="grid size-11 place-items-center rounded-xl bg-[#F1EEFF] text-violet-strong" aria-hidden="true">
                {permissions.includes("platform:manage") ? <ShieldCheck size={22} /> : <Sparkles size={22} />}
              </span>
              <h2 className="mt-5 text-xl font-bold text-ink">Cấu hình tổ chức</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Quản lý công ty, tài khoản và cấu hình nền tảng theo vai trò hiện tại.
              </p>
            </div>
            {permissions.includes("company:manage") || permissions.includes("platform:manage") ? (
              <Button asChild variant="secondary" className="mt-6 self-start">
                <Link href={permissions.includes("platform:manage") ? "/he-thong" : "/cong-ty-cua-toi"} prefetch={false}>
                  Mở không gian quản lý <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function LiveDashboard() {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ["live-dashboard", session?.user.id, session?.user.companyId],
    queryFn: () => apiRequest<Summary>("/dashboard", undefined, session!.accessToken),
    enabled: Boolean(session),
  });

  if (query.isPending) return <LoadingState label="Đang tải tổng quan" />;
  if (query.isError) {
    return (
      <ErrorState
        title="Chưa tải được tổng quan"
        description="Kết nối dữ liệu đang gián đoạn. Bạn có thể thử lại mà không mất thay đổi."
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (!session || !query.data) return null;

  return query.data.personal ? (
    <PersonalDashboard data={query.data} name={session.user.name} />
  ) : (
    <ManagementDashboard
      data={query.data}
      name={session.user.name}
      permissions={session.user.permissions}
    />
  );
}
