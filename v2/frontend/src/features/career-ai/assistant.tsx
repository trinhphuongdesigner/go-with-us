"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-provider";
import { isEmployeeRole } from "@/lib/types";
import { saveRoadmap, type RoadmapCategory } from "@/features/roadmap/roadmap-api";
import { RoadmapTreeEditor } from "@/features/roadmap/tree-editor";
import { careerRequest, type Conversation, type Message, type Proposal } from "./api";
import { ErrorNotice, fieldClass, panelClass } from "./settings";

export function AssistantWorkspace({ initialFocus = "GENERAL", category = "WORK" }: { initialFocus?: "GENERAL" | "ROADMAP"; category?: RoadmapCategory }) {
  const { session } = useAuth();
  if (!session) return null;
  return <AssistantContent key={`${session.user.id}:${category}:${initialFocus}`} token={session.accessToken} userId={session.user.id} role={session.user.role} personal={isEmployeeRole(session.user.role)} initialFocus={initialFocus} category={category} />;
}

function AssistantContent({ token, userId, role, personal, initialFocus, category }: { token: string; userId: string; role: string; personal: boolean; initialFocus: "GENERAL" | "ROADMAP"; category: RoadmapCategory }) {
  const client = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [focus, setFocus] = useState(initialFocus);
  const [companyId, setCompanyId] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [proposalKey, setProposalKey] = useState("");
  const listKey = ["assistant-conversations", userId];
  const list = useQuery({ queryKey: listKey, queryFn: () => careerRequest<Conversation[]>(token, "/assistant/conversations") });
  const companies = useQuery({ queryKey: ["assistant-companies", userId], queryFn: () => careerRequest<{ items: Array<{ id: string; name: string }> }>(token, "/companies/options"), enabled: role === "SUPER_ADMIN" });
  const detail = useQuery({ queryKey: ["assistant-conversation", userId, selected], queryFn: () => careerRequest<Conversation & { messages: Message[] }>(token, `/assistant/conversations/${selected}`), enabled: Boolean(selected) });
  const ask = useMutation({ mutationFn: () => careerRequest<{ conversationId: string; message: Message }>(token, "/assistant/query", "POST", { question, focus, category, ...(selected ? { conversationId: selected } : {}), ...(companyId ? { companyId } : {}) }), onSuccess: (reply) => { setSelected(reply.conversationId); setQuestion(""); void client.invalidateQueries({ queryKey: listKey }); void client.invalidateQueries({ queryKey: ["assistant-conversation", userId, reply.conversationId] }); } });
  const change = useMutation({ mutationFn: (remove: boolean) => careerRequest(token, `/assistant/conversations/${selected}`, remove ? "DELETE" : "PATCH", remove ? undefined : { pinned: !detail.data?.pinned }), onSuccess: (_, remove) => { if (remove) setSelected(null); setDeleting(false); void client.invalidateQueries({ queryKey: listKey }); void client.invalidateQueries({ queryKey: ["assistant-conversation", userId] }); } });
  const save = useMutation({ mutationFn: (value: Proposal) => saveRoadmap(token, { ...value, milestones: value.milestones.map((step) => ({ title: step.title, description: step.description, dueDate: step.dueDate, tasks: step.tasks.map((task) => ({ title: task.title, metric: task.metric })) })), aiSuggested: true, clientRequestId: proposalKey } as Parameters<typeof saveRoadmap>[1]), onSuccess: () => { setProposal(null); void client.invalidateQueries({ queryKey: ["roadmaps"] }); void client.invalidateQueries({ queryKey: ["career-plan"] }); } });
  return <section className="space-y-5"><header><h2 className="text-2xl font-bold">Trợ lý Milo</h2><p className="mt-2 text-sm leading-6 text-muted">Trao đổi từ dữ liệu bạn có quyền xem. Đề xuất không tự thay đổi hồ sơ hay lộ trình; bạn xem và lưu riêng.</p></header><div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]"><aside className={panelClass}><Button className="w-full" disabled={ask.isPending} onClick={() => { setSelected(null); setProposal(null); ask.reset(); }}>Cuộc trò chuyện mới</Button><ErrorNotice error={list.error} /><div className="space-y-2">{list.data?.filter((item) => initialFocus !== "ROADMAP" || (item.focus === "ROADMAP" && item.category === category)).map((item) => <button key={item.id} type="button" disabled={ask.isPending} aria-pressed={selected === item.id} className={`min-h-11 w-full rounded-xl border p-3 text-left text-sm ${selected === item.id ? "border-primary bg-primary/10 text-primary" : "border-border"}`} onClick={() => { setSelected(item.id); setProposal(null); }}>{item.pinned ? "Đã ghim · " : ""}{item.title}</button>)}</div></aside><div className={panelClass}>
      {!selected && personal && <label className="block text-sm font-semibold">Chủ đề<select className={fieldClass} value={focus} disabled={ask.isPending} onChange={(event) => setFocus(event.target.value as typeof focus)}><option value="GENERAL">Trao đổi chung</option><option value="ROADMAP">Xây dựng lộ trình {category === "WORK" ? "công việc" : "cá nhân"}</option></select></label>}
      {role === "SUPER_ADMIN" && <label className="block text-sm font-semibold">Doanh nghiệp cho nội dung nhân sự<select className={fieldClass} value={companyId} disabled={ask.isPending} onChange={(event) => { setCompanyId(event.target.value); setSelected(null); }}><option value="">Chọn doanh nghiệp</option>{companies.data?.items.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>}
      {detail.data && <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{detail.data.title}</h3><div className="flex gap-2"><Button variant="ghost" disabled={change.isPending || ask.isPending} onClick={() => change.mutate(false)}>{detail.data.pinned ? "Bỏ ghim" : "Ghim"}</Button><Button variant="ghost" disabled={ask.isPending} onClick={() => setDeleting(true)}>Xóa</Button></div></div>}
      {deleting && <div role="alert"><p className="mb-2 text-sm">Xóa hội thoại và toàn bộ tin nhắn? Lộ trình đã lưu vẫn được giữ.</p><Button variant="danger" disabled={change.isPending} onClick={() => change.mutate(true)}>Xác nhận xóa</Button> <Button variant="secondary" onClick={() => setDeleting(false)}>Hủy</Button></div>}
      <ErrorNotice error={detail.error ?? ask.error ?? change.error ?? save.error} />{detail.isFetching && selected && <p role="status">Đang tải tin nhắn…</p>}
      <div className="max-h-[560px] space-y-4 overflow-y-auto" aria-live="polite">{detail.data?.messages.map((message) => <article key={message.id} className={`rounded-2xl p-4 ${message.role === "user" ? "bg-primary/10" : "border border-border bg-background"}`}><p className="mb-2 text-xs font-bold text-primary">{message.role === "user" ? "Bạn" : "Milo"}</p><p className="whitespace-pre-wrap break-words text-sm leading-7">{message.content}</p>{message.referencedUserIds.map((id) => <Link className="mr-3 text-sm text-primary underline" href={`/nhan-su/${encodeURIComponent(id)}`} key={id}>Xem nhân sự được nhắc đến</Link>)}{message.proposalData && <Button className="mt-3" variant="secondary" disabled={Boolean(proposal)} onClick={() => { setProposal(message.proposalData); setProposalKey(crypto.randomUUID()); save.reset(); }}>Xem & chỉnh đề xuất lộ trình</Button>}</article>)}</div>
      <form onSubmit={(event) => { event.preventDefault(); if (question.trim().length >= 2) ask.mutate(); }} className="space-y-3"><label className="block text-sm font-semibold">Tin nhắn cho Milo<textarea required minLength={2} maxLength={6000} className={`${fieldClass} min-h-28`} value={question} disabled={ask.isPending} onChange={(event) => setQuestion(event.target.value)} placeholder="Bạn muốn đạt được điều gì?" /></label><Button type="submit" disabled={ask.isPending || question.trim().length < 2}>{ask.isPending ? "Milo đang suy nghĩ…" : "Gửi tin nhắn"}</Button></form>
    </div></div>{proposal && <RoadmapTreeEditor allowCompletion={false} initial={proposal} pending={save.isPending} onSave={(value) => save.mutate(value)} onCancel={() => setProposal(null)} saveLabel="Xác nhận lưu lộ trình & mục tiêu" />} {save.isSuccess && <p role="status" className="text-sm text-sage-strong">Đã lưu lộ trình và mục tiêu liên kết. <Link href="/lo-trinh" className="underline">Mở lộ trình</Link></p>}</section>;
}
