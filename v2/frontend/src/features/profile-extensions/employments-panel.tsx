"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-provider";
import { DEMO_MODE } from "@/lib/api";
import { extensionApi, type Employment } from "./api";
export function EmploymentsPanel({ userId, canManage }: {
    userId: string;
    canManage: boolean;
}) {
    const { session } = useAuth();
    const cache = useQueryClient();
    const [adding, setAdding] = useState(false);
    const [title, setTitle] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [ending, setEnding] = useState<Employment | null>(null);
    const [finishDate, setFinishDate] = useState(new Date().toISOString().slice(0, 10));
    const path = `/profile-extensions/people/${userId}/employments`;
    const query = useQuery({ queryKey: ["profile-employments", session?.user.id, userId], queryFn: () => extensionApi<Employment[]>(session!, path), enabled: Boolean(session) && !DEMO_MODE });
    const save = useMutation({ mutationFn: () => ending ? extensionApi(session!, `${path}/${ending.id}/end`, "POST", { expectedVersion: ending.version, endDate: finishDate }) : extensionApi(session!, path, "POST", { title, startDate, endDate: endDate || null }), onSuccess: async () => { setAdding(false); setEnding(null); setTitle(""); setStartDate(""); setEndDate(""); await cache.invalidateQueries({ queryKey: ["profile-employments"] }); await cache.invalidateQueries({ queryKey: ["core-profile"] }); await cache.invalidateQueries({ queryKey: ["hr-options"] }); } });
    if (DEMO_MODE) return null;
    return <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Kỳ làm việc</h2><p className="mt-1 text-sm text-muted">Giữ lịch sử công tác. Mỗi người có tối đa một kỳ đang hoạt động.</p></div>{canManage ? <Button variant="secondary" onClick={() => { setAdding(true); setEnding(null); }}>Thêm kỳ làm việc</Button> : null}</div></CardHeader><CardContent className="space-y-4">{query.error || save.error ? <p role="alert" className="text-sm text-danger">{(query.error || save.error)?.message}</p> : null}{query.data?.map((employment) => <div key={employment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"><div><p className="font-bold">{employment.title}</p><p className="mt-1 text-sm text-muted">{employment.startDate.slice(0, 10)} → {employment.endDate?.slice(0, 10) || "Hiện tại"} · {employment.status === "ACTIVE" ? "Đang làm việc" : "Đã kết thúc"}</p></div>{canManage && employment.status === "ACTIVE" ? <Button variant="secondary" onClick={() => { setEnding(employment); setAdding(false); }}>Kết thúc kỳ làm việc</Button> : null}</div>)}{query.data?.length === 0 ? <p className="text-sm text-muted">Chưa có kỳ làm việc.</p> : null}{adding || ending ? <form className="space-y-4 rounded-xl bg-background p-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>{ending ? <><h3 className="font-bold">Kết thúc: {ending.title}</h3><p className="text-sm text-muted">Hồ sơ và lịch sử được giữ lại. Kỳ này không còn được dùng để gửi yêu cầu mới tới HR.</p><label className="grid gap-2 text-sm font-semibold">Ngày kết thúc<Input type="date" required min={ending.startDate.slice(0, 10)} value={finishDate} onChange={(event) => setFinishDate(event.target.value)}/></label></> : <><label className="grid gap-2 text-sm font-semibold">Chức danh của kỳ làm việc<Input required maxLength={255} value={title} onChange={(event) => setTitle(event.target.value)}/></label><div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Ngày bắt đầu<Input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)}/></label><label className="grid gap-2 text-sm font-semibold">Ngày kết thúc (để trống nếu hiện tại)<Input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)}/></label></div></>}<div className="flex gap-2"><Button disabled={save.isPending}>{ending ? "Xác nhận kết thúc" : "Lưu kỳ làm việc"}</Button><Button type="button" variant="ghost" disabled={save.isPending} onClick={() => { setAdding(false); setEnding(null); }}>Hủy</Button></div></form> : null}</CardContent></Card>;
}
