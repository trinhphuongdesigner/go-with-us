"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Camera, Download, Plus, Save, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-provider";
import { DEMO_MODE } from "@/lib/api";
import { assetBlob, downloadAsset, extensionApi, uploadAsset, type Activity, type Asset, type PersonalDetails } from "./api";
import { SkillsInsightPanel } from "./skills-insight-panel";
const fieldLabels = { phone: "Điện thoại", dateOfBirth: "Ngày sinh", idNumber: "Số giấy tờ tùy thân", gender: "Giới tính", emergencyContactName: "Người liên hệ khẩn cấp", emergencyContactPhone: "Điện thoại khẩn cấp" } as const;
const fieldClass = "grid gap-2 text-sm font-semibold";
const textareaClass = "min-h-24 w-full rounded-xl border border-border bg-surface p-3 text-sm focus-visible:outline-primary";
const selectClass = "h-12 w-full rounded-xl border border-border bg-surface px-3 text-sm";
export function ExtensionError({ error }: {
    error: unknown;
}) { return error ? <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error instanceof Error ? error.message : "Chưa thể lưu. Vui lòng thử lại."}</p> : null; }
export function PrivateAvatar({ assetId }: {
    assetId: string | null;
}) {
    const { session } = useAuth();
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!assetId || !session)
            return;
        let active = true;
        let objectUrl: string | undefined;
        void assetBlob(session, assetId).then((blob) => { objectUrl = URL.createObjectURL(blob); if (active)
            setUrl(objectUrl);
        else
            URL.revokeObjectURL(objectUrl); }).catch(() => { });
        return () => { active = false; if (objectUrl)
            URL.revokeObjectURL(objectUrl); setUrl(null); };
    }, [assetId, session]);
    // Private bearer-authenticated bytes cannot be loaded through the public Next image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    return url ? <img src={url} alt="Ảnh đại diện hồ sơ" className="size-24 rounded-2xl object-cover"/> : <span className="grid size-24 place-items-center rounded-2xl bg-primary-soft text-primary"><Camera aria-hidden="true" size={28}/></span>;
}
function DetailsForm({ details, userId }: {
    details: PersonalDetails;
    userId?: string;
}) {
    const { session } = useAuth();
    const cache = useQueryClient();
    const [values, setValues] = useState(() => Object.fromEntries(Object.keys(fieldLabels).map((key) => [key, details[key as keyof typeof fieldLabels] || ""])));
    const [onboardDate, setOnboardDate] = useState(details.onboardDate || "");
    const [attitudeScore, setAttitudeScore] = useState(details.attitudeScore?.toString() || "");
    const [adjustment, setAdjustment] = useState(details.contributionAdjustment?.toString() || "0");
    const [saved, setSaved] = useState(false);
    const mutation = useMutation({ mutationFn: (body: unknown) => extensionApi<PersonalDetails>(session!, userId ? `/profile-extensions/people/${userId}` : "/profile-extensions/me", "PATCH", body), onSuccess: async () => { setSaved(true); await cache.invalidateQueries({ queryKey: ["profile-extensions"] }); } });
    const avatar = useMutation({ mutationFn: async (file: File) => { const asset = await uploadAsset(session!, file, "AVATAR"); return extensionApi(session!, "/profile-extensions/me", "PATCH", { expectedVersion: details.version, avatarAssetId: asset.id }); }, onSuccess: () => cache.invalidateQueries({ queryKey: ["profile-extensions"] }) });
    const canEdit = !userId || Boolean(session?.user.permissions.includes("people:write"));
    function submit(event: FormEvent) { event.preventDefault(); setSaved(false); mutation.mutate({ expectedVersion: details.version, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value || null])), ...(userId ? { onboardDate: onboardDate || null, attitudeScore: attitudeScore ? Number(attitudeScore) : null, contributionAdjustment: Number(adjustment) } : {}) }); }
    return <Card><CardHeader><div className="flex flex-wrap items-center gap-5"><PrivateAvatar assetId={details.avatarAssetId}/><div><h2 className="text-lg font-bold">Thông tin cá nhân</h2><p className="mt-1 text-sm text-muted">Điểm đóng góp: {details.contributionScore} · Điểm thái độ: {details.attitudeScore ?? "Chưa đánh giá"}</p>{!userId ? <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-primary"><Camera size={16} aria-hidden="true"/>Đổi ảnh đại diện<input aria-label="Tải ảnh đại diện tối đa 5 MB" className="max-w-48 text-xs" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={avatar.isPending} onChange={(event) => { const file = event.target.files?.[0]; if (file)
        avatar.mutate(file); event.target.value = ""; }}/></label> : null}</div></div></CardHeader><CardContent><form className="space-y-4" onSubmit={submit}><div className="grid gap-4 md:grid-cols-2">{Object.entries(fieldLabels).map(([key, label]) => <label key={key} className={fieldClass}>{label}<Input type={key === "dateOfBirth" ? "date" : key.includes("Phone") || key === "phone" ? "tel" : "text"} value={values[key]} disabled={!canEdit || mutation.isPending} onChange={(e) => setValues({ ...values, [key]: e.target.value })}/></label>)}{userId ? <><label className={fieldClass}>Ngày onboard<Input type="date" value={onboardDate} disabled={!canEdit} onChange={(e) => setOnboardDate(e.target.value)}/></label><label className={fieldClass}>Điểm thái độ (0–100)<Input type="number" min={0} max={100} value={attitudeScore} disabled={!canEdit} onChange={(e) => setAttitudeScore(e.target.value)}/></label><label className={fieldClass}>Điểm đóng góp bổ sung<Input type="number" min={0} value={adjustment} disabled={!canEdit} onChange={(e) => setAdjustment(e.target.value)}/></label></> : <p className="text-sm text-muted">Ngày onboard: {details.onboardDate || "Chưa được HR cập nhật"}</p>}</div><ExtensionError error={mutation.error || avatar.error}/>{saved ? <p role="status" className="text-sm text-primary">Đã lưu thông tin.</p> : null}{canEdit ? <Button disabled={mutation.isPending || avatar.isPending}><Save size={16} aria-hidden="true"/>{mutation.isPending ? "Đang lưu…" : "Lưu thông tin cá nhân"}</Button> : null}</form></CardContent></Card>;
}
function ActivityEditor({ entry, assets, onDone }: {
    entry: Activity | null;
    assets: Asset[];
    onDone: () => void;
}) {
    const { session } = useAuth();
    const cache = useQueryClient();
    const [title, setTitle] = useState(entry?.title || "");
    const [description, setDescription] = useState(entry?.description || "");
    const [category, setCategory] = useState(entry?.category || "");
    const [date, setDate] = useState(entry?.date || new Date().toISOString().slice(0, 10));
    const [evidenceUrl, setEvidenceUrl] = useState(entry?.evidenceUrl || "");
    const [evidenceAssetId, setEvidenceAssetId] = useState(entry?.evidenceAssetId || "");
    const save = useMutation({ mutationFn: () => extensionApi(session!, entry ? `/activity-logs/${entry.id}` : "/activity-logs", entry ? "PUT" : "POST", { title, description: description || null, category: category || null, date, evidenceUrl: evidenceUrl || null, evidenceAssetId: evidenceAssetId || null, ...(entry ? { expectedVersion: entry.version } : {}) }), onSuccess: async () => { await cache.invalidateQueries({ queryKey: ["activities"] }); onDone(); } });
    return <form className="grid gap-4 rounded-2xl border border-border bg-background p-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}><h3 className="font-bold">{entry ? "Sửa hoạt động" : "Thêm hoạt động"}</h3><div className="grid gap-4 md:grid-cols-2"><label className={fieldClass}>Tên hoạt động<Input required maxLength={180} value={title} onChange={(e) => setTitle(e.target.value)}/></label><label className={fieldClass}>Ngày<Input type="date" required value={date} onChange={(e) => setDate(e.target.value)}/></label><label className={fieldClass}>Phân loại<Input maxLength={80} placeholder="Học tập, công việc, cộng đồng…" value={category} onChange={(e) => setCategory(e.target.value)}/></label><label className={fieldClass}>Tệp minh chứng<select className={selectClass} value={evidenceAssetId} onChange={(e) => setEvidenceAssetId(e.target.value)}><option value="">Không chọn</option>{assets.filter((asset) => asset.purpose === "EVIDENCE").map((asset) => <option value={asset.id} key={asset.id}>{asset.filename}</option>)}</select></label></div><label className={fieldClass}>Nội dung<textarea className={textareaClass} value={description} onChange={(e) => setDescription(e.target.value)}/></label><label className={fieldClass}>Hoặc liên kết minh chứng<Input type="url" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)}/></label><ExtensionError error={save.error}/><div className="flex gap-2"><Button disabled={save.isPending || !title.trim()}>Lưu hoạt động</Button><Button type="button" variant="secondary" onClick={onDone}>Hủy</Button></div></form>;
}
function ProfileExtensionsContent({ userId }: {
    userId?: string;
}) {
    const { session } = useAuth();
    const cache = useQueryClient();
    const [editingActivity, setEditingActivity] = useState<Activity | null | undefined>(undefined);
    const [actionError, setActionError] = useState<unknown>(null);
    const details = useQuery({ queryKey: ["profile-extensions", session?.user.id, userId], queryFn: () => extensionApi<PersonalDetails>(session!, userId ? `/profile-extensions/users/${userId}` : "/profile-extensions/me"), enabled: Boolean(session) && !DEMO_MODE });
    const activities = useQuery({ queryKey: ["activities", session?.user.id, userId], queryFn: () => extensionApi<Activity[]>(session!, `/activity-logs${userId ? `?userId=${userId}` : ""}`), enabled: Boolean(session) && !DEMO_MODE });
    const assets = useQuery({ queryKey: ["profile-assets", session?.user.id], queryFn: () => extensionApi<Asset[]>(session!, "/profile-extensions/assets"), enabled: Boolean(session) && !userId && !DEMO_MODE });
    const upload = useMutation({ mutationFn: (file: File) => uploadAsset(session!, file, "EVIDENCE"), onSuccess: () => cache.invalidateQueries({ queryKey: ["profile-assets"] }) });
    const remove = useMutation({ mutationFn: (path: string) => extensionApi(session!, path, "DELETE"), onSuccess: async () => { await cache.invalidateQueries({ queryKey: ["activities"] }); await cache.invalidateQueries({ queryKey: ["profile-assets"] }); } });
    if (DEMO_MODE)
        return <Card><CardContent className="p-5 text-sm text-muted">Thông tin cá nhân, tệp riêng tư và duyệt HR cần đăng nhập bản QC kết nối FastAPI; chế độ mẫu không ghi dữ liệu.</CardContent></Card>;
    if (!session)
        return null;
    return <div className="space-y-6">{details.data ? <DetailsForm key={`${userId || "self"}:${details.data.version}`} details={details.data} userId={userId}/> : <Card><CardContent className="p-5"><p role="status">{details.isPending ? "Đang tải thông tin cá nhân…" : "Chưa tải được thông tin."}</p><ExtensionError error={details.error}/><Button variant="secondary" onClick={() => void details.refetch()}>Tải lại</Button></CardContent></Card>}{!userId ? <div className="flex justify-end"><Button asChild><Link href="/yeu-cau-nang-luc"><Send size={16} aria-hidden="true"/>Gửi chứng chỉ / giải thưởng cho HR</Link></Button></div> : null}<Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Nhật ký hoạt động</h2><p className="mt-1 text-sm text-muted">Ghi lại đóng góp, học tập và minh chứng theo thời gian.</p></div>{!userId ? <Button variant="secondary" onClick={() => setEditingActivity(null)}><Plus size={16} aria-hidden="true"/>Thêm hoạt động</Button> : null}</div></CardHeader><CardContent className="space-y-4"><ExtensionError error={activities.error || remove.error || actionError}/>{editingActivity !== undefined ? <ActivityEditor key={editingActivity?.id || "new"} entry={editingActivity} assets={assets.data || []} onDone={() => setEditingActivity(undefined)}/> : null}{activities.data?.length === 0 ? <p className="text-sm text-muted">Chưa có hoạt động. Thêm mốc đầu tiên để bắt đầu nhật ký.</p> : null}{activities.data?.map((entry) => <article className="rounded-xl border border-border p-4" key={entry.id}><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-bold">{entry.title}</h3><p className="mt-1 text-sm text-muted">{entry.date} · {entry.category || "Chưa phân loại"}</p></div>{!userId ? <div className="flex gap-2"><Button variant="ghost" onClick={() => setEditingActivity(entry)}>Sửa</Button><Button variant="ghost" disabled={remove.isPending} onClick={() => { if (window.confirm(`Xóa hoạt động “${entry.title}”?`))
        remove.mutate(`/activity-logs/${entry.id}`); }}>Xóa</Button></div> : null}</div><p className="mt-3 whitespace-pre-wrap text-sm">{entry.description}</p>{entry.evidenceAssetId ? <Button variant="ghost" onClick={() => void downloadAsset(session, entry.evidenceAssetId!, entry.title).catch(setActionError)}><Download size={16} aria-hidden="true"/>Tải minh chứng</Button> : null}{entry.evidenceUrl ? <a href={entry.evidenceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-primary underline">Mở liên kết minh chứng</a> : null}</article>)}</CardContent></Card>{!userId ? <Card><CardHeader><h2 className="text-lg font-bold">Kho minh chứng riêng tư</h2><p className="mt-1 text-sm text-muted">Ảnh, PDF, Word, Excel · tối đa 10 MB mỗi tệp. Tệp chỉ được tải qua phiên đăng nhập có quyền.</p></CardHeader><CardContent className="space-y-4"><label className={fieldClass}>Tải tệp mới<Input type="file" accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx" disabled={upload.isPending} onChange={(e) => { const file = e.target.files?.[0]; if (file)
        upload.mutate(file); e.target.value = ""; }}/></label><ExtensionError error={upload.error || assets.error}/>{upload.isPending ? <p role="status">Đang tải tệp…</p> : null}<ul className="space-y-2">{assets.data?.filter((asset) => asset.purpose === "EVIDENCE").map((asset) => <li key={asset.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background p-3"><span className="min-w-0 break-all text-sm">{asset.filename} · {Math.ceil(asset.size / 1024)} KB</span><div className="flex gap-2"><Button variant="ghost" aria-label={`Tải ${asset.filename}`} onClick={() => void downloadAsset(session, asset.id, asset.filename).catch(setActionError)}><Download size={16} aria-hidden="true"/></Button><Button variant="ghost" disabled={remove.isPending} aria-label={`Xóa ${asset.filename}`} onClick={() => { if (window.confirm(`Xóa tệp “${asset.filename}” khỏi kho?`))
        remove.mutate(`/profile-extensions/assets/${asset.id}`); }}><Trash2 size={16} aria-hidden="true"/></Button></div></li>)}</ul></CardContent></Card> : null}</div>;
}

export function ProfileExtensionsPanel({ userId }: { userId?: string }) {
    return <div className="space-y-6"><ProfileExtensionsContent userId={userId} />{userId ? <SkillsInsightPanel userId={userId} /> : null}</div>;
}
