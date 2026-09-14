"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock3,
  Layers,
  Map,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

import { ErrorState, LoadingState } from "@/components/ui/app-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-provider";
import { ApiError, apiRequest } from "@/lib/api";
import { cn } from "@/lib/cn";

export interface DashboardTask {
  id: string;
  title: string;
  done?: boolean;
}

export interface UpcomingMilestone {
  id: string;
  title: string;
  dueDate: string | null;
  roadmap: string;
  roadmapId?: string;
  roadmapVersion?: number;
  category: string;
  tasks: DashboardTask[];
}

export interface Summary {
  personal: boolean;
  canSwitchView: boolean;
  currentView: "personal" | "management";
  people?: number;
  companies?: number;
  activeRoadmaps?: number;
  skillCount?: number;
  projectCount?: number;
  roadmapCount?: number;
  milestoneCount?: number;
  completedMilestones?: number;
  taskCount?: number;
  completedTasks?: number;
  overdueMilestones?: number;
  skills?: { name: string; rating: number }[];
  upcoming?: UpcomingMilestone[];
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
    <Card className="group p-4 shadow-[0_10px_28px_rgb(24_49_42/0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgb(24_49_42/0.08)] sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium leading-5 text-muted sm:text-sm">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-[-0.03em] text-ink sm:text-3xl">{value}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{detail}</p>
        </div>
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${toneClass[tone]}`}
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
          className="text-sage transition-all duration-500"
        />
      </svg>
      <span className="absolute text-sm font-bold text-ink">{normalizedValue}%</span>
    </div>
  );
}

interface DueDateUrgency {
  label: string;
  tone: "neutral" | "warning" | "danger" | "success";
  isOverdue: boolean;
  daysDiff: number | null;
}

function getDueDateUrgency(value: string | null | undefined): DueDateUrgency {
  if (!value) return { label: "Chưa đặt hạn", tone: "neutral", isOverdue: false, daysDiff: null };
  const clean = value.slice(0, 10);
  const date = new Date(`${clean}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return { label: value, tone: "neutral", isOverdue: false, daysDiff: null };

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diffTime = date.getTime() - todayUtc.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const formatted = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);

  if (diffDays < 0) {
    return {
      label: `Quá hạn ${Math.abs(diffDays)} ngày (${formatted})`,
      tone: "danger",
      isOverdue: true,
      daysDiff: diffDays,
    };
  }
  if (diffDays === 0) {
    return {
      label: `Hôm nay là hạn chót (${formatted})`,
      tone: "warning",
      isOverdue: false,
      daysDiff: 0,
    };
  }
  if (diffDays === 1) {
    return {
      label: `Còn 1 ngày (Hạn mai: ${formatted})`,
      tone: "warning",
      isOverdue: false,
      daysDiff: 1,
    };
  }
  if (diffDays <= 3) {
    return {
      label: `Còn ${diffDays} ngày (${formatted})`,
      tone: "warning",
      isOverdue: false,
      daysDiff: diffDays,
    };
  }
  return {
    label: `Hạn ${formatted} (Còn ${diffDays} ngày)`,
    tone: "neutral",
    isOverdue: false,
    daysDiff: diffDays,
  };
}

function ViewSwitcher({
  activeView,
  onChange,
}: {
  activeView: "personal" | "management";
  onChange: (view: "personal" | "management") => void;
}) {
  return (
    <div
      role="group"
      aria-label="Chọn góc nhìn bảng điều khiển"
      className="inline-flex items-center gap-1 rounded-xl border border-border/80 bg-surface p-1 shadow-xs"
    >
      <button
        type="button"
        aria-pressed={activeView === "personal"}
        onClick={() => onChange("personal")}
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
          activeView === "personal"
            ? "bg-primary text-white shadow-xs"
            : "text-muted hover:bg-background hover:text-ink"
        )}
      >
        <UserRound size={14} aria-hidden="true" />
        Góc nhìn cá nhân
      </button>
      <button
        type="button"
        aria-pressed={activeView === "management"}
        onClick={() => onChange("management")}
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
          activeView === "management"
            ? "bg-primary text-white shadow-xs"
            : "text-muted hover:bg-background hover:text-ink"
        )}
      >
        <Building2 size={14} aria-hidden="true" />
        Góc nhìn quản lý
      </button>
    </div>
  );
}

function SkillDetailDialog({
  skill,
  onClose,
}: {
  skill: { name: string; rating: number } | null;
  onClose: () => void;
}) {
  if (!skill) return null;
  const rating = Math.min(5, Math.max(0, skill.rating));

  return (
    <Dialog.Root open={Boolean(skill)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/35 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-primary-subtle text-primary" aria-hidden="true">
                  <BadgeCheck size={18} />
                </span>
                <Badge tone="neutral">Thông tin đã ghi nhận</Badge>
              </div>
              <Dialog.Title className="mt-3 text-xl font-bold text-ink">
                {skill.name}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-muted">
                Mức kỹ năng đang được lưu trong hồ sơ của bạn
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Đóng hộp thoại">
                <X size={18} />
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-5 rounded-xl border border-border/80 bg-background/60 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-ink">Mức kỹ năng đã ghi nhận</span>
              <span className="font-bold text-primary">{rating} / 5</span>
            </div>
            <div className="mt-2.5 grid grid-cols-5 gap-1.5" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <div
                  key={lvl}
                  className={cn(
                    "h-2.5 rounded-full transition-all",
                    lvl <= rating ? "bg-primary" : "bg-border/60"
                  )}
                />
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border/80 bg-background/60 p-4 text-xs leading-5 text-muted">
            Chỉ phản ánh mức đang được lưu trong hồ sơ. Dữ liệu này chưa đủ để suy ra cấp bậc,
            chuẩn kỳ vọng hoặc khoảng cách phát triển.
          </div>

          <div className="mt-6 flex justify-end">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Đóng
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function QuickCheckinDialog({
  milestone,
  token,
  open,
  onOpenChange,
  onSuccess,
}: {
  milestone?: UpcomingMilestone;
  token?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
}) {
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [requiresRefresh, setRequiresRefresh] = useState(false);
  const updateInFlight = useRef(false);

  if (!milestone || !token) return null;

  async function handleToggle(taskId: string, currentDone: boolean) {
    if (
      updateInFlight.current ||
      requiresRefresh ||
      !milestone?.roadmapId ||
      milestone.roadmapVersion === undefined ||
      !token
    ) {
      return;
    }
    updateInFlight.current = true;
    let patchSucceeded = false;
    try {
      setUpdatingTaskId(taskId);
      setFeedbackMessage(null);
      await apiRequest(
        `/development-plans/me/roadmaps/${encodeURIComponent(milestone.roadmapId)}/tasks/${encodeURIComponent(taskId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            expectedVersion: milestone.roadmapVersion,
            done: !currentDone,
          }),
        },
        token
      );
      patchSucceeded = true;
      await onSuccess();
      setRequiresRefresh(false);
      setFeedbackMessage(!currentDone ? "🎉 Đã hoàn thành công việc!" : "Đã chuyển lại trạng thái chưa hoàn thành.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        try {
          await onSuccess();
          setRequiresRefresh(false);
          setFeedbackMessage(
            "Dữ liệu lộ trình đã thay đổi. CareerMate đã tải lại phiên bản mới; vui lòng thử lại."
          );
        } catch {
          setRequiresRefresh(true);
          setFeedbackMessage(
            "Dữ liệu lộ trình đã thay đổi nhưng chưa tải lại được. Vui lòng mở lộ trình để đồng bộ."
          );
        }
      } else if (patchSucceeded) {
        setRequiresRefresh(true);
        setFeedbackMessage(
          "Đã lưu thay đổi nhưng chưa tải lại được dữ liệu mới. Vui lòng mở lộ trình để đồng bộ."
        );
      } else {
        setFeedbackMessage("Chưa thể cập nhật trạng thái. Vui lòng thử lại.");
      }
    } finally {
      updateInFlight.current = false;
      setUpdatingTaskId(null);
    }
  }

  const urgency = getDueDateUrgency(milestone.dueDate);

  async function retryRefresh() {
    if (updateInFlight.current) return;
    updateInFlight.current = true;
    setUpdatingTaskId("refresh");
    try {
      await onSuccess();
      setRequiresRefresh(false);
      setFeedbackMessage("Đã tải lại dữ liệu lộ trình mới nhất.");
    } catch {
      setFeedbackMessage("Vẫn chưa tải lại được dữ liệu. Vui lòng thử lại sau.");
    } finally {
      updateInFlight.current = false;
      setUpdatingTaskId(null);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/35 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(92vw,540px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="ai">Check-in tiến độ</Badge>
                <Badge tone={urgency.tone}>{urgency.label}</Badge>
              </div>
              <Dialog.Title className="mt-3 text-xl font-bold text-ink">
                {milestone.title}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-muted">
                Lộ trình: {milestone.roadmap} · Đánh dấu công việc đã hoàn thành trực tiếp tại đây
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Đóng hộp thoại">
                <X size={18} />
              </Button>
            </Dialog.Close>
          </div>

          {feedbackMessage && (
            <div
              role="status"
              className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary-subtle px-3.5 py-2.5 text-xs font-semibold text-primary"
            >
              <span>{feedbackMessage}</span>
              {requiresRefresh ? (
                <Button type="button" size="sm" variant="secondary" onClick={() => void retryRefresh()}>
                  Tải lại dữ liệu
                </Button>
              ) : null}
            </div>
          )}

          <div className="mt-5 space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Danh sách công việc trong chặng</p>
            {milestone.tasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted">
                Chặng này chưa có đầu việc chi tiết. Hãy mở lộ trình để thêm công việc cụ thể.
              </div>
            ) : (
              milestone.tasks.map((task) => {
                const isPending = updatingTaskId === task.id;
                const isDone = Boolean(task.done);
                return (
                  <button
                    key={task.id}
                    type="button"
                    disabled={updatingTaskId !== null || requiresRefresh}
                    onClick={() => handleToggle(task.id, isDone)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left text-xs transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                      isDone
                        ? "border-border/60 bg-background/50 text-muted"
                        : "border-border bg-surface text-ink shadow-xs hover:border-primary/40 hover:bg-background/80"
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span
                        className={cn(
                          "grid size-6 shrink-0 place-items-center rounded-md border transition-colors",
                          isDone
                            ? "border-sage-strong bg-sage-strong text-white"
                            : "border-border bg-background hover:border-primary"
                        )}
                        aria-hidden="true"
                      >
                        {isDone ? <Check size={14} /> : null}
                      </span>
                      <span className={cn("truncate font-medium", isDone && "text-muted line-through")}>
                        {task.title}
                      </span>
                    </div>
                    {isPending ? (
                      <span className="text-[11px] text-muted animate-pulse">Đang lưu...</span>
                    ) : (
                      <span className={cn("text-[11px] font-semibold", isDone ? "text-sage-strong" : "text-primary")}>
                        {isDone ? "Đã xong" : "Chưa làm"}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/80 pt-4">
            <Button asChild variant="secondary" size="sm">
              <Link href="/lo-trinh" onClick={() => onOpenChange(false)} prefetch={false}>
                Mở toàn bộ lộ trình <ArrowRight size={14} className="ml-1" />
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Hoàn tất
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PersonalDashboard({
  data,
  name,
  canSwitchView,
  activeView,
  onSwitchView,
  onRefreshData,
  canQuickCheckin,
}: {
  data: Summary;
  name: string;
  canSwitchView: boolean;
  activeView: "personal" | "management";
  onSwitchView: (view: "personal" | "management") => void;
  onRefreshData: () => Promise<void>;
  canQuickCheckin: boolean;
}) {
  const { session } = useAuth();
  const [selectedSkill, setSelectedSkill] = useState<{ name: string; rating: number } | null>(null);
  const [checkinOpen, setCheckinOpen] = useState(false);

  const skills = data.skills ?? [];
  const totalMilestones = data.milestoneCount ?? 0;
  const completedMilestones = data.completedMilestones ?? 0;
  const totalTasks = data.taskCount ?? 0;
  const completedTasks = data.completedTasks ?? 0;
  const overdueCount = data.overdueMilestones ?? 0;
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

  const urgency = getDueDateUrgency(nextMilestone?.dueDate);

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
            Đây là những điểm quan trọng nhất từ hồ sơ và lộ trình phát triển của bạn.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canSwitchView && (
            <ViewSwitcher activeView={activeView} onChange={onSwitchView} />
          )}
          <Button asChild variant="secondary">
            <Link href="/lo-trinh" prefetch={false}>
              Mở lộ trình <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </Button>
        </div>
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
          value={String(overdueCount)}
          detail={overdueCount > 0 ? "Cần ưu tiên xử lý sớm" : "Đang đúng kế hoạch"}
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
              <p className="mt-0.5 text-xs text-muted">Bấm vào kỹ năng để xem mức đã ghi nhận</p>
            </div>
            <CircularProgress value={averageSkill} />
          </CardHeader>
          <CardContent className="space-y-4">
            {skills.slice(0, 5).map((skill) => {
              const rating = Math.min(5, Math.max(0, skill.rating));
              return (
                <div
                  key={skill.name}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedSkill(skill)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedSkill(skill);
                    }
                  }}
                  className="group -mx-2.5 cursor-pointer rounded-xl p-2.5 transition-colors hover:bg-background/80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label={`Xem mức đã ghi nhận của kỹ năng ${skill.name}`}
                >
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-semibold text-ink group-hover:text-primary transition-colors flex items-center gap-1.5">
                      {skill.name}
                      <ChevronRight size={14} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" aria-hidden="true" />
                    </span>
                    <span className="whitespace-nowrap text-xs font-medium text-muted">
                      {rating} / 5
                    </span>
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
                      className="h-full rounded-full bg-primary transition-all duration-300 group-hover:bg-primary-hover"
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
                Xem toàn bộ hồ sơ năng lực <ArrowRight size={16} aria-hidden="true" />
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge tone="ai">Lộ trình cùng Milo</Badge>
              <span className="text-xs font-semibold text-violet-strong">{roadmapProgress}%</span>
            </div>
            <h2 className="mt-3 text-xl font-bold tracking-[-0.02em] text-ink">
              {nextMilestone?.title ?? "Sẵn sàng cho chặng tiếp theo"}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>
                {nextMilestone
                  ? `${nextMilestone.category === "PERSONAL" ? "Cá nhân" : "Công việc"} · ${nextMilestone.roadmap}`
                  : "Tạo lộ trình để Milo đồng hành cùng bạn"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 flex min-h-60 flex-col items-start justify-between gap-4 pt-1 sm:flex-row sm:items-end">
            <div className="pb-2 min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs font-medium text-sage-strong">
                <CheckCircle2 size={16} aria-hidden="true" />
                {completedTasks}/{totalTasks} công việc đã hoàn thành
              </div>

              {nextMilestone ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={urgency.tone}>
                    {urgency.isOverdue ? <AlertCircle size={12} className="mr-1" /> : <Clock3 size={12} className="mr-1" />}
                    {urgency.label}
                  </Badge>
                </div>
              ) : null}

              {/* Milo Smart Whisper Speech Bubble */}
              <div className="mt-3.5 max-w-sm rounded-2xl border border-violet-200/80 bg-white/95 p-3.5 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#F1EEFF] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-violet-strong">
                    <Sparkles size={12} className="animate-pulse" aria-hidden="true" />
                    {overdueCount > 0 ? "Milo nhắc nhở" : roadmapProgress >= 80 ? "Milo cổ vũ" : "Milo gợi ý"}
                  </span>
                </div>
                <p className="mt-1.5 text-xs font-medium leading-relaxed text-ink/90">
                  {overdueCount > 0
                    ? `Bạn có ${overdueCount} chặng quá hạn. Đừng lo lắng, hãy check-in hoàn thành 1 việc nhỏ trước nhé!`
                    : roadmapProgress >= 80
                      ? `Tuyệt vời! Bạn đã hoàn thành ${roadmapProgress}% chặng đường, đích đến đang rất gần!`
                      : nextMilestone
                        ? `Chặng tiếp theo: "${nextMilestone.title}". Từng bước đi nhỏ tạo nên bước nhảy vọt!`
                        : "Khởi tạo lộ trình đầu tiên để Milo cùng bạn chinh phục mục tiêu sự nghiệp nhé!"}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {canQuickCheckin && nextMilestone && nextMilestone.tasks.length > 0 && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => setCheckinOpen(true)}
                  >
                    <CheckSquare size={15} className="mr-1.5" />
                    Check-in nhanh
                  </Button>
                )}
                <Button asChild variant="secondary" size="sm">
                  <Link href="/lo-trinh" prefetch={false}>
                    {nextMilestone ? "Mở lộ trình" : "Tạo lộ trình"}
                    <ArrowRight size={14} className="ml-1" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="relative h-48 w-36 shrink-0 sm:h-52 sm:w-44">
              <Image
                src="/brand/milo/milo-purple-tablet.webp"
                alt="Milo hướng dẫn lộ trình"
                fill
                loading="eager"
                sizes="176px"
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

      <SkillDetailDialog
        skill={selectedSkill}
        onClose={() => setSelectedSkill(null)}
      />

      {canQuickCheckin && nextMilestone && (
        <QuickCheckinDialog
          milestone={nextMilestone}
          token={session?.accessToken}
          open={checkinOpen}
          onOpenChange={setCheckinOpen}
          onSuccess={onRefreshData}
        />
      )}
    </div>
  );
}

function ManagementDashboard({
  data,
  name,
  permissions,
  canSwitchView,
  activeView,
  onSwitchView,
}: {
  data: Summary;
  name: string;
  permissions: string[];
  canSwitchView: boolean;
  activeView: "personal" | "management";
  onSwitchView: (view: "personal" | "management") => void;
}) {
  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
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
            Nắm bắt quy mô nhân sự, tiến độ đội ngũ và mở nhanh không gian ưu tiên.
          </p>
        </div>
        {canSwitchView && (
          <ViewSwitcher activeView={activeView} onChange={onSwitchView} />
        )}
      </header>

      <section aria-label="Các chỉ số quản lý" className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
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
        <MetricCard
          icon={Target}
          label="Tổng lộ trình"
          value={String(data.activeRoadmaps ?? 0)}
          detail="Trong phạm vi quản lý"
          tone="violet"
        />
        <MetricCard
          icon={ShieldCheck}
          label="Quyền quản trị"
          value={`${permissions.length} quyền`}
          detail="Phạm vi vai trò hoạt động"
          tone="amber"
        />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="shadow-[0_16px_36px_rgb(24_49_42/0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgb(24_49_42/0.08)]">
          <CardContent className="flex min-h-64 flex-col justify-between p-6">
            <div>
              <span className="grid size-11 place-items-center rounded-xl bg-primary-subtle text-primary" aria-hidden="true">
                <BriefcaseBusiness size={22} />
              </span>
              <h2 className="mt-5 text-xl font-bold text-ink">Không gian đội ngũ</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Tra cứu hồ sơ, số năm kinh nghiệm, kỹ năng và minh chứng thực tế của nhân sự bằng trợ lý AI.
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

        <Card className="shadow-[0_16px_36px_rgb(24_49_42/0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgb(24_49_42/0.08)]">
          <CardContent className="flex min-h-64 flex-col justify-between p-6">
            <div>
              <span className="grid size-11 place-items-center rounded-xl bg-[#EFF6F0] text-sage-strong" aria-hidden="true">
                <Layers size={22} />
              </span>
              <h2 className="mt-5 text-xl font-bold text-ink">Khung tiêu chí năng lực</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Thiết lập bộ tiêu chuẩn đánh giá và tiêu chí kỹ năng cho từng vai trò trong công ty.
              </p>
            </div>
            <Button asChild variant="secondary" className="mt-6 self-start">
              <Link href="/cong-ty/tieu-chi" prefetch={false}>
                Xem tiêu chí <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-[#F7F5FF] shadow-[0_16px_36px_rgb(36_24_56/0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgb(36_24_56/0.09)]">
          <CardContent className="relative z-10 flex min-h-64 flex-col justify-between p-6">
            <div>
              <span className="grid size-11 place-items-center rounded-xl bg-[#F1EEFF] text-violet-strong" aria-hidden="true">
                {permissions.includes("platform:manage") ? <ShieldCheck size={22} /> : <Sparkles size={22} />}
              </span>
              <h2 className="mt-5 text-xl font-bold text-ink">Cấu hình tổ chức</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Quản lý doanh nghiệp, tài khoản thành viên và các phân quyền truy cập hệ thống.
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
  const queryClient = useQueryClient();
  const [selectedView, setSelectedView] = useState<"personal" | "management" | null>(null);

  const query = useQuery({
    queryKey: ["live-dashboard", session?.user.id, session?.user.companyId, selectedView],
    queryFn: () => {
      const path = selectedView ? `/dashboard?view=${selectedView}` : "/dashboard";
      return apiRequest<Summary>(path, undefined, session!.accessToken);
    },
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

  const data = query.data;
  const canSwitch = data.canSwitchView;
  const currentActiveView = data.currentView;

  async function handleRefresh() {
    const result = await query.refetch();
    await queryClient.invalidateQueries({ queryKey: ["roadmaps"] });
    if (result.isError) throw result.error;
  }

  return data.personal ? (
    <PersonalDashboard
      data={data}
      name={session.user.name}
      canSwitchView={canSwitch}
      activeView={currentActiveView}
      onSwitchView={setSelectedView}
      onRefreshData={handleRefresh}
      canQuickCheckin={session.user.permissions.includes("roadmap:self")}
    />
  ) : (
    <ManagementDashboard
      data={data}
      name={session.user.name}
      permissions={session.user.permissions}
      canSwitchView={canSwitch}
      activeView={currentActiveView}
      onSwitchView={setSelectedView}
    />
  );
}
