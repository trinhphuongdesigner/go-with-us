"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, Plus, Save, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { Session } from "@/lib/types";
import { CareerPlanPanel } from "@/features/career-ai/plan-panel";
import { AssistantWorkspace } from "@/features/career-ai/assistant";
import { careerRequest } from "@/features/career-ai/api";
import { RoadmapTreeEditor } from "./tree-editor";
import {
  createSaveIntent, getRoadmapSettings, listRoadmaps, saveRoadmap,
  updateRoadmapSettings, updateRoadmapTask,
  type Roadmap, type RoadmapCategory, type RoadmapSave, type RoadmapSettings,
} from "./roadmap-api";

const inputClass = "mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-2 text-ink";
export const categoryLabels = { WORK: "Công việc", PERSONAL: "Cá nhân" } as const;

export function CategoryPicker({ category, onChange, disabled = false }: {
  category: RoadmapCategory; onChange: (category: RoadmapCategory) => void; disabled?: boolean;
}) {
  return <div role="group" aria-label="Nhóm lộ trình" className="flex flex-wrap gap-2">
    {(["WORK", "PERSONAL"] as const).map((value) => <Button key={value} type="button" aria-pressed={category === value}
      variant={category === value ? "primary" : "secondary"} disabled={disabled} onClick={() => onChange(value)}>{categoryLabels[value]}</Button>)}
  </div>;
}

function errorMessage(error: unknown) {
  return error instanceof ApiError && error.status === 409
    ? "Dữ liệu đã đổi ở nơi khác. Tải lại bản mới trước khi tiếp tục; bản nháp của bạn vẫn được giữ."
    : "Chưa thể hoàn tất. Kiểm tra kết nối rồi thử lại; chưa có xác nhận lưu từ máy chủ.";
}

type DraftMilestone = { id: string; title: string; tasks: string; dueDate: string };
const newMilestone = (): DraftMilestone => ({ id: crypto.randomUUID(), title: "", tasks: "", dueDate: "" });

function RoadmapEditor({ category, pending, onSave, onCancel }: {
  category: RoadmapCategory; pending: boolean;
  onSave: (draft: Omit<RoadmapSave, "clientRequestId">) => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [weeks, setWeeks] = useState(12);
  const [hours, setHours] = useState(3);
  const [milestones, setMilestones] = useState<DraftMilestone[]>(() => [newMilestone()]);
  const [confirmCancel, setConfirmCancel] = useState(false);
  function patch(id: string, values: Partial<DraftMilestone>) {
    setMilestones((current) => current.map((item) => item.id === id ? { ...item, ...values } : item));
  }
  function move(index: number, delta: number) {
    setMilestones((current) => {
      const next = [...current];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  }
  const valid = title.trim() && milestones.every((step) => step.title.trim() && step.tasks.trim()
    && step.tasks.split("\n").filter((line) => line.trim()).length <= 50
    && step.tasks.split("\n").every((line) => line.trim().length <= 180));
  return <form aria-label="Tạo lộ trình" className="rounded-2xl border border-border bg-surface p-5 sm:p-7" onSubmit={(event) => {
    event.preventDefault();
    if (!valid || pending) return;
    onSave({ category, title: title.trim(), durationWeeks: weeks, hoursPerWeek: hours, aiSuggested: false,
      milestones: milestones.map((step) => ({ title: step.title.trim(), dueDate: step.dueDate || null,
        tasks: step.tasks.split("\n").map((line) => line.trim()).filter(Boolean).map((task) => ({ title: task })),
      })) });
  }}>
    <fieldset disabled={pending} className="space-y-5">
      <legend className="text-xl font-bold">Lộ trình mới · {categoryLabels[category]}</legend>
      <p className="pt-2 text-sm text-muted">Bản nháp chưa được lưu. Mỗi lần lưu tạo một lộ trình riêng, không ghi đè lộ trình trước.</p>
      <label className="block text-sm font-semibold">Mục tiêu lộ trình<input required maxLength={180} className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">Thời lượng (tuần)<input required type="number" min={1} max={520} className={inputClass} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} /></label>
        <label className="text-sm font-semibold">Giờ mỗi tuần<input required type="number" min={1} max={168} className={inputClass} value={hours} onChange={(e) => setHours(Number(e.target.value))} /></label>
      </div>
      {milestones.map((step, index) => <section key={step.id} className="space-y-3 rounded-xl border border-border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Chặng {index + 1}</h3><div className="flex gap-1">
          <Button type="button" variant="ghost" size="icon" aria-label={`Đưa chặng ${index + 1} lên`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={18} /></Button>
          <Button type="button" variant="ghost" size="icon" aria-label={`Đưa chặng ${index + 1} xuống`} disabled={index === milestones.length - 1} onClick={() => move(index, 1)}><ArrowDown size={18} /></Button>
          <Button type="button" variant="ghost" size="icon" aria-label={`Xóa chặng ${index + 1}`} disabled={milestones.length === 1} onClick={() => setMilestones((current) => current.filter((item) => item.id !== step.id))}><Trash2 size={18} /></Button>
        </div></div>
        <label className="block text-sm font-semibold">Tên chặng {index + 1}<input required maxLength={180} className={inputClass} value={step.title} onChange={(e) => patch(step.id, { title: e.target.value })} /></label>
        <label className="block text-sm font-semibold">Ngày dự kiến chặng {index + 1}<input type="date" className={inputClass} value={step.dueDate} onChange={(e) => patch(step.id, { dueDate: e.target.value })} /></label>
        <label className="block text-sm font-semibold">Công việc chặng {index + 1}<textarea required className={cn(inputClass, "min-h-28")} value={step.tasks} onChange={(e) => patch(step.id, { tasks: e.target.value })} aria-describedby={`tasks-help-${step.id}`} /></label>
        <p id={`tasks-help-${step.id}`} className="text-xs text-muted">Mỗi dòng một việc, tối đa 50 việc/chặng và 180 ký tự/việc.</p>
      </section>)}
      <Button type="button" variant="secondary" disabled={milestones.length >= 30} onClick={() => setMilestones((current) => [...current, newMilestone()])}><Plus size={17} /> Thêm chặng</Button>
      <div className="flex flex-wrap gap-3 border-t border-border pt-5">
        <Button type="submit" disabled={!valid || pending}><Save size={17} /> {pending ? "Đang lưu…" : "Lưu lộ trình"}</Button>
        <Button type="button" variant="secondary" onClick={() => setConfirmCancel(true)}>Hủy bản nháp</Button>
      </div>
      {confirmCancel ? <div role="alert" className="space-y-3 rounded-xl border border-border p-4"><p>Nội dung chưa lưu sẽ bị bỏ. Bạn muốn hủy bản nháp?</p><div className="flex flex-wrap gap-2"><Button type="button" variant="danger" onClick={onCancel}>Bỏ bản nháp</Button><Button type="button" variant="secondary" onClick={() => setConfirmCancel(false)}>Tiếp tục chỉnh sửa</Button></div></div> : null}
    </fieldset>
  </form>;
}

function DisplaySettings({ settings, token, identity }: { settings: RoadmapSettings; token: string; identity: string }) {
  const client = useQueryClient();
  const [draft, setDraft] = useState(settings);
  const mutation = useMutation({ mutationFn: () => updateRoadmapSettings(token, {
    expectedVersion: settings.version, viewMode: draft.viewMode, costumeColor: draft.costumeColor,
    reduceMotion: draft.reduceMotion, fontSize: draft.fontSize, character: draft.character,
  }), onSuccess: (saved) => client.setQueryData(["roadmap-settings", identity], { settings: saved }) });
  return <details className="rounded-2xl border border-border bg-surface p-5">
    <summary className="min-h-8 cursor-pointer font-bold">Tùy chỉnh hiển thị cùng Milo</summary>
    <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
      <label className="text-sm font-semibold">Nhân vật đồng hành<select className={inputClass} value={draft.character} onChange={(event) => setDraft({ ...draft, character: event.target.value })}><option value="milo">Milo</option><option value="milo-guide">Milo hướng dẫn</option><option value="milo-standing">Milo đứng</option><option value="an">An</option><option value="none">Ẩn nhân vật</option></select></label>
      <label className="text-sm font-semibold">Cách xem<select className={inputClass} value={draft.viewMode} onChange={(event) => setDraft({ ...draft, viewMode: event.target.value as "stair" | "diagram" })}><option value="stair">Hành trình</option><option value="diagram">Sơ đồ chặng</option></select></label>
      <label className="text-sm font-semibold">Cỡ chữ<select className={inputClass} value={draft.fontSize} onChange={(event) => setDraft({ ...draft, fontSize: event.target.value as "sm" | "md" | "lg" })}><option value="sm">Nhỏ</option><option value="md">Vừa</option><option value="lg">Lớn</option></select></label>
      <label className="text-sm font-semibold">Màu đánh dấu hành trình<input type="color" className={inputClass} value={draft.costumeColor} onChange={(event) => setDraft({ ...draft, costumeColor: event.target.value })} /></label>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={draft.reduceMotion} onChange={(event) => setDraft({ ...draft, reduceMotion: event.target.checked })} /> Giảm chuyển động</label>
      <Button disabled={mutation.isPending || JSON.stringify(draft) === JSON.stringify(settings)} type="submit">{mutation.isPending ? "Đang lưu…" : "Lưu cách hiển thị"}</Button>
      {mutation.error ? <div role="alert" className="space-y-2 text-sm text-danger sm:col-span-2"><p>{errorMessage(mutation.error)}</p><Button type="button" variant="secondary" onClick={() => void client.invalidateQueries({ queryKey: ["roadmap-settings", identity] })}>Tải cài đặt mới</Button></div> : null}
    </form>
  </details>;
}

export function PersistedRoadmapView({ session }: { session: Session }) {
  const identity = `${session.user.companyId ?? "platform"}:${session.user.id}`;
  const [category, setCategory] = useState<RoadmapCategory>("WORK");
  const [editing, setEditing] = useState(false);
  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold text-primary">Phát triển cùng Milo</p><h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Lộ trình phát triển của bạn</h1><p className="mt-2 text-sm text-muted">Từng việc nhỏ, tiến bộ rõ ràng. Bạn quyết định khi nào lưu và hoàn thành.</p></div><Button disabled={editing} onClick={() => setEditing(true)}><Plus size={18} /> Tạo lộ trình</Button></header>
    <CategoryPicker category={category} onChange={setCategory} disabled={editing} />
    <RoadmapContent key={`${identity}:${category}`} identity={identity} session={session} category={category} editing={editing} onCloseEditor={() => setEditing(false)} />
    <CareerPlanPanel key={`plan:${identity}:${category}`} session={session} category={category} />
    <details className="rounded-2xl border border-border bg-surface p-5"><summary className="cursor-pointer font-bold">Cùng Milo xây dựng đề xuất lộ trình</summary><div className="mt-5"><AssistantWorkspace initialFocus="ROADMAP" category={category} /></div></details>
  </div>;
}

function RoadmapContent({ identity, session, category, editing, onCloseEditor }: {
  identity: string; session: Session; category: RoadmapCategory; editing: boolean; onCloseEditor: () => void;
}) {
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveIntent, setSaveIntent] = useState(createSaveIntent);
  const [announcement, setAnnouncement] = useState("");
  const [editStructure, setEditStructure] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const listKey = ["roadmaps", identity, category];
  const query = useQuery({ queryKey: listKey, queryFn: () => listRoadmaps(session.accessToken, category) });
  const settingsQuery = useQuery({ queryKey: ["roadmap-settings", identity], queryFn: () => getRoadmapSettings(session.accessToken) });
  const save = useMutation({ mutationFn: (draft: Omit<RoadmapSave, "clientRequestId">) => saveRoadmap(session.accessToken, saveIntent(draft)),
    onSuccess: (saved) => {
      client.setQueryData<Roadmap[]>(listKey, (current) => [saved, ...(current ?? []).filter((item) => item.id !== saved.id)]);
      setSelectedId(saved.id); onCloseEditor(); setSaveIntent(() => createSaveIntent()); setAnnouncement("Đã lưu lộ trình trên máy chủ.");
    } });
  const task = useMutation({ mutationFn: ({ roadmap, taskId, done }: { roadmap: Roadmap; taskId: string; done: boolean }) => updateRoadmapTask(session.accessToken, roadmap, taskId, done),
    onSuccess: (saved) => {
      client.setQueryData<Roadmap[]>(listKey, (current) => (current ?? []).map((item) => item.id === saved.id ? saved : item));
      setAnnouncement(`Đã lưu tiến độ: ${saved.completedTasks}/${saved.totalTasks} việc hoàn thành.`);
    } });
  const selected = query.data?.find((roadmap) => roadmap.id === selectedId) ?? query.data?.[0];
  const settings = settingsQuery.data?.settings;
  const structure = useMutation({ mutationFn: (draft: Parameters<Parameters<typeof RoadmapTreeEditor>[0]["onSave"]>[0]) => careerRequest<Roadmap>(session.accessToken, `/development-plans/me/roadmaps/${selected!.id}`, "PUT", { expectedVersion: selected!.version, title: draft.title, durationWeeks: draft.durationWeeks, hoursPerWeek: draft.hoursPerWeek, milestones: draft.milestones.map((step) => ({ title: step.title, description: step.description, dueDate: step.dueDate, tasks: step.tasks.map((item) => ({ title: item.title, metric: item.metric, done: item.done ?? false })) })) }), onSuccess: () => { setEditStructure(false); void query.refetch(); } });
  const remove = useMutation({ mutationFn: () => careerRequest(session.accessToken, `/development-plans/me/roadmaps/${selected!.id}?expected_version=${selected!.version}`, "DELETE"), onSuccess: () => { setConfirmDelete(false); setSelectedId(null); void query.refetch(); } });
  const characterAsset = settings?.character === "an" ? "/brand/an/an-welcome.png" : settings?.character === "milo-guide" ? "/brand/milo/milo-guide.png" : settings?.character === "milo-standing" ? "/brand/milo/milo-standing.png" : "/brand/milo/milo-purple-tablet.webp";
  return <>
    {structure.error || remove.error ? <p role="alert" className="text-danger">{errorMessage(structure.error ?? remove.error)}</p> : null}
    {selected && <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={editing || editStructure || task.isPending} onClick={() => setEditStructure(true)}>Chỉnh sửa chặng & công việc</Button><Button variant="ghost" disabled={editing || editStructure || task.isPending} onClick={() => setConfirmDelete(true)}>Xóa lộ trình</Button></div>}
    {confirmDelete && <div role="alert" className="rounded-xl border border-border p-4"><p className="mb-3">Xóa lộ trình và toàn bộ chặng/công việc? Mục tiêu liên kết được giữ.</p><Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>Xác nhận xóa</Button> <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Hủy</Button></div>}
    {editStructure && selected && <RoadmapTreeEditor key={selected.id} initial={{ title: selected.title, category: selected.category, durationWeeks: selected.durationWeeks, hoursPerWeek: selected.hoursPerWeek, milestones: selected.milestones }} pending={structure.isPending} onSave={(draft) => structure.mutate(draft)} onCancel={() => setEditStructure(false)} />}
    {announcement ? <p role="status" className="rounded-xl border border-border bg-surface p-4 text-sm text-sage-strong">{announcement}</p> : null}
    {editing ? <RoadmapEditor category={category} pending={save.isPending} onSave={(draft) => save.mutate(draft)} onCancel={() => { onCloseEditor(); save.reset(); setSaveIntent(() => createSaveIntent()); }} /> : null}
    {save.error || task.error ? <div role="alert" className="space-y-3 rounded-xl border border-border bg-surface p-4 text-danger"><p>{errorMessage(save.error ?? task.error)}</p><Button variant="secondary" onClick={async () => { const result = await query.refetch(); if (!result.isError) { task.reset(); save.reset(); } }}>Tải lộ trình mới nhất</Button></div> : null}
    {query.isPending ? <p role="status">Đang tải lộ trình…</p> : query.isError ? <div role="alert" className="space-y-3 rounded-xl border border-border p-5"><p>Chưa tải được lộ trình. Không thay đổi dữ liệu đã lưu.</p><Button onClick={() => void query.refetch()}>Thử lại</Button></div> : !selected ? <section className="flex flex-col items-center rounded-2xl border border-border bg-surface p-8 text-center"><Image src="/brand/milo/milo-purple-tablet.webp" alt="Milo sẵn sàng đồng hành" width={144} height={144} /><h2 className="mt-4 text-xl font-bold">Bắt đầu lộ trình {categoryLabels[category].toLowerCase()}</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted">Chưa có lộ trình trong nhóm này. Tạo mục tiêu, chia thành các chặng và thêm việc cần làm.</p></section> : <>
      <label className="block max-w-xl text-sm font-semibold">Lộ trình đã lưu · {categoryLabels[category]}<select disabled={editStructure} className={inputClass} value={selected.id} onChange={(event) => { setSelectedId(event.target.value); task.reset(); }}>
        {query.data?.map((roadmap) => <option key={roadmap.id} value={roadmap.id}>{roadmap.title} · {roadmap.completedTasks}/{roadmap.totalTasks} việc</option>)}
      </select></label>
      <section aria-label={selected.title} className={cn("overflow-hidden rounded-2xl border border-border bg-surface p-5 sm:p-7", settings?.fontSize === "lg" ? "text-lg" : settings?.fontSize === "sm" ? "text-sm" : "text-base")}>
        <div className="flex items-center justify-between gap-4"><div className="min-w-0"><p className="text-sm font-semibold text-primary">{categoryLabels[selected.category]} · Phiên {selected.version}</p><h2 className="mt-2 break-words text-2xl font-bold">{selected.title}</h2><p className="mt-2 text-sm text-muted">{selected.durationWeeks ? `${selected.durationWeeks} tuần` : "Chưa đặt thời lượng"}{selected.hoursPerWeek ? ` · ${selected.hoursPerWeek} giờ/tuần` : ""}</p></div>{settings?.character !== "none" && <Image src={characterAsset} alt="" width={96} height={96} className="hidden shrink-0 object-contain sm:block" />}</div>
        <div className="mt-5 flex justify-between gap-3 text-sm"><span>{selected.completedTasks}/{selected.totalTasks} việc hoàn thành</span><strong>{selected.progress}%</strong></div>
        <progress className="mt-2 h-3 w-full accent-primary" max={100} value={selected.progress} aria-label="Tiến độ lộ trình" />
        <ol className={cn("mt-7 gap-4", settings?.viewMode === "diagram" ? "grid md:grid-cols-2" : "grid")}>
          {selected.milestones.map((milestone, index) => <li key={milestone.id} className="min-w-0 rounded-2xl border border-border border-l-4 bg-background p-4 sm:p-5" style={{ borderLeftColor: settings?.costumeColor }}>
            <div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface font-bold text-primary">{milestone.status === "DONE" ? <Check size={18} aria-label="Hoàn thành" /> : index + 1}</span><div className="min-w-0"><h3 className="break-words font-bold">{milestone.title}</h3><p className="mt-1 text-xs text-muted">{milestone.completedTasks}/{milestone.totalTasks} việc{milestone.dueDate ? ` · Dự kiến ${new Date(`${milestone.dueDate}T00:00:00`).toLocaleDateString("vi-VN")}` : ""}</p></div></div>
            {milestone.description ? <p className="mt-3 whitespace-pre-wrap break-words text-muted">{milestone.description}</p> : null}
            <ul className="mt-4 space-y-2">{milestone.tasks.map((item) => <li key={item.id}><label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-surface p-3"><input className="mt-1 size-4 shrink-0 accent-primary" type="checkbox" checked={item.done} disabled={task.isPending || query.isFetching || Boolean(task.error)} onChange={(event) => task.mutate({ roadmap: selected, taskId: item.id, done: event.target.checked })} /><span className="min-w-0 break-words"><span className={item.done ? "text-muted line-through" : ""}>{item.title}</span>{item.metric ? <span className="mt-1 block text-xs text-muted">Tiêu chí: {item.metric}</span> : null}</span></label></li>)}</ul>
          </li>)}
        </ol>
      </section>
    </>}
    {settings ? <DisplaySettings key={settings.version} settings={settings} token={session.accessToken} identity={identity} /> : settingsQuery.isError ? <div role="alert"><p>Chưa tải được cài đặt hiển thị.</p><Button variant="secondary" onClick={() => void settingsQuery.refetch()}>Tải lại cài đặt</Button></div> : null}
    <p className="text-xs leading-5 text-muted">Công việc / Cá nhân được lưu riêng. AI chỉ đề xuất; mỗi lần lưu lộ trình mới tạo mục tiêu từ chặng cuối. Cài đặt hiển thị không thay đổi nội dung.</p>
  </>;
}
