"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api";
import { careerRequest, type Connection } from "./api";

export const fieldClass = "mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-2 text-ink";
export const panelClass = "space-y-4 rounded-2xl border border-border bg-surface p-5 sm:p-7";
export function ErrorNotice({ error }: { error: unknown }) { return error ? <p role="alert" className="text-sm text-danger">{error instanceof ApiError ? error.message : "Chưa hoàn tất. Vui lòng thử lại; nội dung đang nhập vẫn được giữ."}</p> : null; }

function ConnectionForm({ connection, token }: { connection: Connection; token: string }) {
  const client = useQueryClient();
  const [key, setKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(connection.baseUrl ?? "");
  const [model, setModel] = useState(connection.model ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const mutation = useMutation({ mutationFn: (remove: boolean) => careerRequest<Connection>(token, `/ai-settings/${connection.provider}`, remove ? "DELETE" : "PUT", remove ? undefined : { ...(key ? { apiKey: key } : {}), baseUrl: baseUrl || null, model: model || null }), onSuccess: () => { setKey(""); setConfirmed(false); void client.invalidateQueries({ queryKey: ["ai-connections"] }); } });
  return <form className={panelClass} onSubmit={(event) => { event.preventDefault(); mutation.mutate(false); }}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{connection.provider}</h3><span className="text-sm text-muted">{connection.hasKey ? `Đã cấu hình · ${connection.source === "environment" ? "môi trường" : "máy chủ"}` : "Chưa kết nối"}</span></div>
    <fieldset disabled={mutation.isPending} className="space-y-4">
      <label className="block text-sm font-semibold">Secret / API key<input autoComplete="new-password" type="password" className={fieldClass} value={key} onChange={(event) => setKey(event.target.value)} required={!connection.hasKey} placeholder={connection.hasKey ? "Để trống để giữ khóa đã lưu" : "Nhập khóa API"} /></label>
      <label className="block text-sm font-semibold">Base URL (HTTPS)<input type="url" className={fieldClass} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="Để trống để dùng endpoint mặc định" /></label>
      <label className="block text-sm font-semibold">Model ID<input maxLength={150} className={fieldClass} value={model} onChange={(event) => setModel(event.target.value)} placeholder="Để trống để dùng model mặc định" /></label>
      <div className="flex flex-wrap gap-2"><Button type="submit">{mutation.isPending ? "Đang lưu…" : "Lưu kết nối"}</Button>{connection.source === "database" && <Button type="button" variant="secondary" onClick={() => setConfirmed(true)}>Gỡ kết nối</Button>}</div>
      {confirmed && <div role="alert" className="space-y-2"><p className="text-sm">Gỡ khóa đã lưu cho toàn ứng dụng? Cấu hình môi trường, nếu có, vẫn hoạt động.</p><Button type="button" variant="danger" onClick={() => mutation.mutate(true)}>Xác nhận gỡ</Button> <Button type="button" variant="secondary" onClick={() => setConfirmed(false)}>Hủy</Button></div>}
    </fieldset><ErrorNotice error={mutation.error} />{mutation.isSuccess && <p role="status" className="text-sm text-sage-strong">Đã cập nhật cấu hình. Chưa gọi AI kiểm tra kết nối.</p>}
  </form>;
}

export function CareerAiSettings() {
  const { session } = useAuth();
  const query = useQuery({ queryKey: ["ai-connections", session?.user.id], queryFn: () => careerRequest<Connection[]>(session!.accessToken, "/ai-settings"), enabled: session?.user.role === "SUPER_ADMIN" });
  if (!session || session.user.role !== "SUPER_ADMIN") return null;
  return <section className="space-y-5"><header><h2 className="text-xl font-bold">Kết nối AI</h2><p className="mt-2 text-sm leading-6 text-muted">Cấu hình dùng chung toàn ứng dụng, chỉ Super Admin được sửa. Khóa được mã hóa và không bao giờ trả về trình duyệt. Ưu tiên Anthropic → OpenAI → Gemini. Madison dùng Anthropic Messages.</p></header><ErrorNotice error={query.error} />{query.isPending && <p role="status">Đang tải kết nối…</p>}<div className="grid gap-4 xl:grid-cols-3">{query.data?.map((connection) => <ConnectionForm key={`${connection.provider}:${connection.baseUrl}:${connection.model}:${connection.source}`} connection={connection} token={session.accessToken} />)}</div></section>;
}
