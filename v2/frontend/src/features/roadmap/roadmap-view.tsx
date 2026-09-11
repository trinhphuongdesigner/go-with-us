"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowDown,
  ArrowUp,
  BrainCircuit,
  Check,
  Clock3,
  GripVertical,
  PencilLine,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/cn";

type MilestoneStatus = "completed" | "current" | "upcoming" | "goal";

interface Milestone {
  id: string;
  title: string;
  period: string;
  status: MilestoneStatus;
  stateLabel: string;
}

const initialMilestones: Milestone[] = [
  { id: "foundation", title: "Nền tảng", period: "Tuần 1–2", status: "completed", stateLabel: "Đã hoàn thành" },
  { id: "feedback", title: "Giao tiếp & phản hồi", period: "Tuần 3–5", status: "current", stateLabel: "Đang thực hiện" },
  { id: "coordination", title: "Điều phối nhóm", period: "Tuần 6–9", status: "upcoming", stateLabel: "Sắp tới" },
  { id: "leadership", title: "Dẫn dắt nhóm", period: "Tuần 10–12", status: "goal", stateLabel: "Mục tiêu" },
];

const ROADMAP_DRAFT_KEY = "careermate-v2-roadmap-draft";
// Reserve visual headroom for Milo and the speech bubble above the current step.
// The path and every step share the same offset so the illustration stays aligned.
const desktopTopPositions = [316, 222, 312, 184];

function MilestoneDetails({ milestone, index, editing, instance, onChange }: {
  milestone: Milestone;
  index: number;
  editing: boolean;
  instance: "desktop" | "mobile";
  onChange: (patch: Partial<Milestone>) => void;
}) {
  const stateTone = milestone.status === "completed" ? "text-sage-strong" : milestone.status === "current" ? "text-violet-strong" : "text-muted";
  return (
    <div className="text-center">
      <p className={cn("text-xs font-bold tabular-nums", stateTone)}>{String(index + 1).padStart(2, "0")}</p>
      {editing ? (
        <>
          <label className="sr-only" htmlFor={`milestone-title-${instance}-${milestone.id}`}>Tên bước {index + 1}</label>
          <input
            id={`milestone-title-${instance}-${milestone.id}`}
            value={milestone.title}
            onChange={(event) => onChange({ title: event.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-1 text-center text-sm font-bold text-ink"
          />
          <label className="sr-only" htmlFor={`milestone-period-${instance}-${milestone.id}`}>Thời gian bước {index + 1}</label>
          <input
            id={`milestone-period-${instance}-${milestone.id}`}
            value={milestone.period}
            onChange={(event) => onChange({ period: event.target.value })}
            className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-1 text-center text-xs text-muted"
          />
        </>
      ) : (
        <>
          <h3 className="mt-1 text-sm font-bold leading-5 text-ink">{milestone.title}</h3>
          <p className={cn("mt-1 text-xs font-semibold", stateTone)}>{milestone.stateLabel}</p>
          <p className="mt-1 text-xs text-muted">{milestone.period}</p>
        </>
      )}
    </div>
  );
}

function MindMapDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="secondary"><BrainCircuit size={17} aria-hidden="true" /> Xem mind map AI</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/35 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(94vw,880px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-2xl sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge tone="ai"><Sparkles size={13} aria-hidden="true" /> Gợi ý có dẫn nguồn</Badge>
              <Dialog.Title className="mt-3 text-xl font-bold text-ink">Mind map: Giao tiếp & phản hồi</Dialog.Title>
              <Dialog.Description className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                AI sắp xếp đề xuất từ hồ sơ và tài liệu bạn đã cung cấp. Bạn quyết định nội dung nào được thêm vào lộ trình.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Đóng mind map"><X size={20} /></Button></Dialog.Close>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {[
              ["Năng lực cần cải thiện", "Phản hồi có cấu trúc", "Hồ sơ năng lực · mục Giao tiếp"],
              ["Hoạt động đề xuất", "Thực hành mô hình SBI trong 3 buổi 1:1", "Tài liệu Kỹ năng quản lý · trang 12"],
              ["Minh chứng hoàn thành", "2 biên bản phản hồi và xác nhận của quản lý", "Mục tiêu quý 3 · tiêu chí 2"],
            ].map(([label, value, evidence]) => (
              <div key={label} className="rounded-2xl border border-border bg-background/70 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-primary">{label}</p>
                <p className="mt-3 text-sm font-semibold leading-6 text-ink">{value}</p>
                <p className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted">Nguồn: {evidence}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-[#E4DFFC] bg-[#F7F5FF] p-3 text-xs leading-5 text-violet-strong">
            Đây là bản đề xuất, chưa được lưu vào hồ sơ hoặc lộ trình.
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function RoadmapView() {
  const { session } = useAuth();
  const ownerKey = `${session?.user.companyId ?? "platform"}:${session?.user.id ?? "anonymous"}`;
  const draftKey = `${ROADMAP_DRAFT_KEY}:${ownerKey}`;

  return <RoadmapWorkspace key={draftKey} draftKey={draftKey} />;
}

function RoadmapWorkspace({ draftKey }: { draftKey: string }) {
  const [milestones, setMilestones] = useState(initialMilestones);
  const [editing, setEditing] = useState(false);
  const [version, setVersion] = useState(3);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    window.localStorage.removeItem(ROADMAP_DRAFT_KEY);
    const saved = window.localStorage.getItem(draftKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { milestones?: Milestone[]; version?: number };
      if (Array.isArray(parsed.milestones) && parsed.milestones.length >= 2) {
        const frame = window.requestAnimationFrame(() => {
          setMilestones(parsed.milestones!);
          setVersion(typeof parsed.version === "number" ? parsed.version : 3);
        });
        return () => window.cancelAnimationFrame(frame);
      }
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  function updateMilestone(index: number, patch: Partial<Milestone>) {
    setMilestones((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function moveMilestone(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= milestones.length) return;
    setMilestones((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setAnnouncement(`${milestones[index].title} đã được di chuyển ${delta < 0 ? "lên" : "xuống"}.`);
  }

  function addMilestone() {
    const goalIndex = milestones.findIndex((item) => item.status === "goal");
    const next = [...milestones];
    next.splice(goalIndex < 0 ? next.length : goalIndex, 0, {
      id: `draft-${Date.now()}`,
      title: "Bước phát triển mới",
      period: "Chọn thời gian",
      status: "upcoming",
      stateLabel: "Bản nháp",
    });
    setMilestones(next);
    setAnnouncement("Đã thêm một bước mới vào bản nháp.");
  }

  function saveDraft() {
    const nextVersion = version + 1;
    setVersion(nextVersion);
    window.localStorage.setItem(draftKey, JSON.stringify({ milestones, version: nextVersion }));
    setEditing(false);
    setAnnouncement("Đã lưu bản nháp lộ trình mới.");
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="ai"><Sparkles size={13} aria-hidden="true" /> Đồng hành cùng Milo</Badge>
            <span className="text-xs text-muted">Bản nháp v{version} · vừa cập nhật</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-[-0.03em] text-ink sm:text-3xl">Lộ trình phát triển của bạn</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Mỗi chặng có mục tiêu, hoạt động và minh chứng rõ ràng. Bạn có thể chỉnh lại thứ tự bằng các nút điều khiển hoặc bàn phím.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MindMapDialog />
          {editing ? (
            <Button onClick={saveDraft}><Save size={17} aria-hidden="true" /> Lưu bản nháp</Button>
          ) : (
            <Button onClick={() => setEditing(true)}><PencilLine size={17} aria-hidden="true" /> Tùy chỉnh lộ trình</Button>
          )}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">{announcement}</p>

      <Card className="mt-6 overflow-hidden">
        <CardHeader className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between sm:pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Mục tiêu hiện tại</p>
            <h2 className="mt-1 text-lg font-bold text-ink">Trưởng nhóm sản phẩm</h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted"><Clock3 size={16} aria-hidden="true" /> 12 tuần · hoàn thành 1/4 chặng</div>
        </CardHeader>

        <div className="hidden overflow-x-auto bg-[radial-gradient(circle_at_45%_42%,#F7F5FF_0,transparent_36%),linear-gradient(#fff,#fff)] lg:block" data-testid="desktop-roadmap-scroll">
          <div className="relative min-h-[616px]" style={{ width: `${Math.max(1100, milestones.length * 260)}px` }}>
          <svg className="absolute inset-x-0 top-40 h-80 w-full" viewBox="0 0 1200 320" preserveAspectRatio="none" aria-hidden="true">
            <path d="M45 238 C190 238 225 112 345 112 S555 232 680 232 S900 82 1150 82" fill="none" stroke="#E7E2FA" strokeWidth="17" strokeLinecap="round" />
            <path d="M45 238 C190 238 225 112 345 112" fill="none" stroke="#7867D9" strokeWidth="7" strokeLinecap="round" />
          </svg>
          {milestones.map((milestone, index) => {
            const left = milestones.length === 1 ? 50 : 10 + (index / (milestones.length - 1)) * 80;
            return (
            <article data-testid={`roadmap-milestone-${milestone.id}`} key={milestone.id} className="absolute w-52" style={{ left: `calc(${left}% - 104px)`, top: `${desktopTopPositions[index % desktopTopPositions.length]}px` }}>
              <div className="relative mx-auto h-28 w-48">
                <Image src={`/brand/roadmap/step-${milestone.status}.svg`} alt="" fill sizes="192px" className="object-contain" />
                <span className="absolute inset-x-0 top-[42px] text-center text-lg font-bold text-white" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                {milestone.status === "completed" ? <Image src="/brand/roadmap/check-marker.svg" alt="Đã hoàn thành" width={48} height={50} className="absolute left-1/2 top-0 -translate-x-1/2" /> : null}
                {milestone.status === "goal" ? <Image src="/brand/roadmap/goal-flag.svg" alt="Cột mốc mục tiêu" width={58} height={98} className="absolute left-1/2 -top-10 -translate-x-1/2" /> : null}
                {milestone.status === "current" ? (
                  <>
                    <div className="absolute -top-44 left-1/2 h-48 w-48 -translate-x-1/2">
                      <Image src="/brand/milo/milo-purple-tablet.webp" alt="Milo đang đồng hành ở chặng hiện tại" fill sizes="192px" className="object-contain object-bottom" />
                    </div>
                    <div className="absolute -right-20 -top-40 w-40 rounded-xl border border-[#E4DFFC] bg-white px-3 py-2 text-xs font-semibold leading-5 text-violet-strong shadow-soft">Tiếp tục bước tiếp theo nhé!</div>
                  </>
                ) : null}
              </div>
              <MilestoneDetails milestone={milestone} index={index} editing={editing} instance="desktop" onChange={(patch) => updateMilestone(index, patch)} />
              {editing ? (
                <div className="mt-2 flex items-center justify-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => moveMilestone(index, -1)} disabled={index === 0} aria-label={`Di chuyển ${milestone.title} lên`}><ArrowUp size={17} /></Button>
                  <Button variant="ghost" size="icon" onClick={() => moveMilestone(index, 1)} disabled={index === milestones.length - 1} aria-label={`Di chuyển ${milestone.title} xuống`}><ArrowDown size={17} /></Button>
                  {milestone.status === "upcoming" ? <Button variant="ghost" size="icon" className="text-danger" onClick={() => setMilestones((current) => current.filter((item) => item.id !== milestone.id))} aria-label={`Xóa ${milestone.title}`}><Trash2 size={17} /></Button> : null}
                </div>
              ) : null}
            </article>
          );})}
          </div>
        </div>

        <CardContent className="space-y-3 bg-background/45 lg:hidden">
          {milestones.map((milestone, index) => (
            <article data-testid={`roadmap-milestone-${milestone.id}`} key={milestone.id} className={cn("rounded-2xl border bg-white p-4", milestone.status === "current" ? "border-[#CFC5F7]" : "border-border")}>
              <div className="flex items-start gap-3">
                <div className="relative h-16 w-24 shrink-0">
                  <Image src={`/brand/roadmap/step-${milestone.status}.svg`} alt="" fill sizes="96px" className="object-contain" />
                  <span className="absolute inset-x-0 top-[24px] text-center text-xs font-bold text-white" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div className="min-w-0 flex-1"><MilestoneDetails milestone={milestone} index={index} editing={editing} instance="mobile" onChange={(patch) => updateMilestone(index, patch)} /></div>
                {milestone.status === "current" ? <Image src="/brand/milo/milo-purple-tablet.webp" alt="Milo" width={72} height={72} className="-my-2 object-contain" /> : null}
              </div>
              {editing ? (
                <div className="mt-3 flex items-center justify-end gap-1 border-t border-border pt-3">
                  <GripVertical size={18} className="mr-auto text-muted" aria-hidden="true" />
                  <Button variant="ghost" size="icon" onClick={() => moveMilestone(index, -1)} disabled={index === 0} aria-label={`Di chuyển ${milestone.title} lên`}><ArrowUp size={17} /></Button>
                  <Button variant="ghost" size="icon" onClick={() => moveMilestone(index, 1)} disabled={index === milestones.length - 1} aria-label={`Di chuyển ${milestone.title} xuống`}><ArrowDown size={17} /></Button>
                  {milestone.status === "upcoming" ? <Button variant="ghost" size="icon" className="text-danger" onClick={() => setMilestones((current) => current.filter((item) => item.id !== milestone.id))} aria-label={`Xóa ${milestone.title}`}><Trash2 size={17} /></Button> : null}
                </div>
              ) : null}
            </article>
          ))}
        </CardContent>

        {editing ? (
          <div className="flex flex-col gap-3 border-t border-border bg-background/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-muted"><Check size={15} className="mr-1 inline text-sage-strong" /> Các thay đổi chỉ nằm trong bản nháp cho đến khi bạn lưu.</p>
            <Button variant="secondary" size="sm" onClick={addMilestone}><Plus size={16} /> Thêm bước</Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
