"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-provider";
import { apiRequest, ApiError, DEMO_MODE } from "@/lib/api";
import { roleLabels, type UserRole } from "@/lib/types";

type Company = { id: string; name: string; industry: string | null; status: "ACTIVE" | "ARCHIVED"; version: number };
type Account = { id: string; name: string; email: string; jobTitle: string | null; role: UserRole; companyId: string | null; isActive: boolean; version: number };
type Grants = { role: "HR" | "BOD"; permissions: string[]; version: number };
const fieldClass = "mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink";
const roleOrder: UserRole[] = ["SUPER_ADMIN", "COMPANY_ADMIN", "BOD", "HR", "EMPLOYEE"];
const grantLabels: Record<string, string> = { COMPANY_READ: "Xem công ty", COMPANY_WRITE: "Quản lý công ty", EMPLOYEE_READ: "Xem nhân sự", EMPLOYEE_WRITE: "Quản lý nhân sự", ASSESSMENT_REVIEW: "Duyệt đánh giá", PASSPORT_APPROVE: "Duyệt hộ chiếu" };
function errorText(error: unknown) { return error instanceof ApiError ? error.message : "Chưa thể lưu. Kiểm tra kết nối rồi thử lại."; }

export function OrganizationWorkspace({ initialCompanyId }: { initialCompanyId?: string }) {
  const { session } = useAuth();
  if (!session) return null;
  if (DEMO_MODE) return <p className="rounded-2xl border border-border bg-surface p-6">Quản trị dùng API thật. Mở bản QC Docker để tạo công ty, tài khoản và cấp quyền.</p>;
  return <Workspace key={`${session.user.id}:${initialCompanyId ?? ""}`} initialCompanyId={initialCompanyId} />;
}

function Workspace({ initialCompanyId }: { initialCompanyId?: string }) {
  const { session } = useAuth();
  const client = useQueryClient();
  const token = session!.accessToken;
  const actor = session!.user;
  const superAdmin = actor.role === "SUPER_ADMIN";
  const canWriteUsers = actor.permissions.includes("people:write");
  const canConfigure = ["SUPER_ADMIN", "COMPANY_ADMIN"].includes(actor.role) && actor.permissions.includes("company:manage");
  const [selectedId, setSelectedId] = useState(initialCompanyId ?? actor.companyId ?? "");
  const [tab, setTab] = useState<"company" | "users" | "roles">("users");
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [notice, setNotice] = useState("");
  const companies = useQuery({ queryKey: ["organization-companies", actor.id], queryFn: () => apiRequest<Company[]>("/organization/companies", undefined, token), enabled: actor.permissions.includes("company:read") });
  const company = companies.data?.find((item) => item.id === selectedId) ?? companies.data?.[0];
  const companyId = selectedId || company?.id || actor.companyId || "";
  const scope = `?companyId=${encodeURIComponent(companyId)}`;
  const users = useQuery({ queryKey: ["organization-users", actor.id, companyId], queryFn: () => apiRequest<Account[]>(`/organization/users${scope}`, undefined, token), enabled: !!companyId && actor.permissions.includes("people:read") });
  const roles = useQuery({ queryKey: ["organization-roles", actor.id, companyId], queryFn: () => apiRequest<Grants[]>(`/organization/roles${scope}`, undefined, token), enabled: !!companyId && canConfigure });
  const mutation = useMutation({ mutationFn: ({ path, method, body }: { path: string; method: string; body: unknown }) => apiRequest(path, { method, body: JSON.stringify(body) }, token), onSuccess: async () => {
    await Promise.all([client.invalidateQueries({ queryKey: ["organization-companies"] }), client.invalidateQueries({ queryKey: ["organization-users"] }), client.invalidateQueries({ queryKey: ["organization-roles"] }), client.invalidateQueries({ queryKey: ["company-options"] }), client.invalidateQueries({ queryKey: ["people"] })]);
    setEditing(null); setNotice("Đã lưu thay đổi trên máy chủ. Người vừa đổi quyền nên tải lại phiên để cập nhật menu.");
  } });
  const save = (path: string, body: unknown, method = "POST") => mutation.mutate({ path, method, body });
  return <div className="space-y-6">
    <header><p className="text-sm font-semibold text-primary">Phạm vi quản trị</p><h1 className="mt-2 text-3xl font-bold">Công ty, tài khoản & quyền</h1><p className="mt-2 text-sm text-muted">Chỉ thao tác trong công ty và cấp vai trò bạn được phép quản lý.</p></header>
    {notice ? <p role="status" className="rounded-xl bg-primary-subtle p-4 text-sm">{notice}</p> : null}
    {companies.isError || users.isError || roles.isError ? <div role="alert" className="space-y-3 rounded-xl border border-border p-4"><p>Chưa tải được dữ liệu quản trị.</p><Button onClick={() => void Promise.all([companies.refetch(), users.refetch(), roles.refetch()])}>Tải lại</Button></div> : null}
    {mutation.error ? <p role="alert" className="rounded-xl border border-border p-4 text-danger">{errorText(mutation.error)}</p> : null}
    {superAdmin ? <label className="block max-w-xl text-sm font-semibold">Công ty đang quản lý<select className={fieldClass} value={companyId} onChange={(event) => { setSelectedId(event.target.value); setNotice(""); }}><option value="">Chọn công ty</option>{companies.data?.map((item) => <option key={item.id} value={item.id}>{item.name}{item.status === "ARCHIVED" ? " · Đã khóa" : ""}</option>)}</select></label> : <p className="font-semibold">{company?.name ?? actor.companyName}</p>}
    <div role="group" aria-label="Chức năng quản trị" className="flex flex-wrap gap-2">{([['users', 'Tài khoản'], ['company', 'Thông tin công ty'], ['roles', 'Cấp quyền']] as const).filter(([key]) => key !== "roles" || canConfigure).map(([key, label]) => <Button key={key} variant={tab === key ? "primary" : "secondary"} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</Button>)}</div>
    {tab === "company" && company ? <form key={`${company.id}:${company.version}`} className="space-y-4 rounded-2xl border border-border bg-surface p-6" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      save(`/organization/companies/${company.id}`, { expectedVersion: company.version, name: form.get("name"), industry: form.get("industry") || null, status: form.get("status") ?? company.status }, "PATCH");
    }}><h2 className="text-xl font-bold">Thông tin công ty</h2><fieldset disabled={!canConfigure || mutation.isPending} className="space-y-4"><label className="block text-sm font-semibold">Tên công ty<input name="name" required maxLength={255} defaultValue={company.name} className={fieldClass} /></label><label className="block text-sm font-semibold">Lĩnh vực<input name="industry" maxLength={180} defaultValue={company.industry ?? ""} className={fieldClass} /></label>{superAdmin ? <label className="block text-sm font-semibold">Trạng thái<select name="status" defaultValue={company.status} className={fieldClass}><option value="ACTIVE">Hoạt động</option><option value="ARCHIVED">Khóa truy cập (giữ dữ liệu)</option></select></label> : null}<Button type="submit">Lưu công ty</Button></fieldset></form> : null}
    {tab === "users" ? <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Tài khoản trong phạm vi</h2>{canWriteUsers ? <Button disabled={!companyId || mutation.isPending} onClick={() => { mutation.reset(); setEditing("new"); }}>Thêm tài khoản</Button> : null}</div>
      {users.isPending && companyId ? <p role="status">Đang tải tài khoản…</p> : null}
      <ul className="grid gap-4 lg:grid-cols-2">{users.data?.map((user) => <li key={user.id} className="min-w-0 rounded-2xl border border-border bg-surface p-5"><h3 className="break-words font-bold">{user.name}</h3><p className="mt-1 break-all text-sm text-muted">{user.email}</p><p className="mt-2 text-sm">{roleLabels[user.role]} · {user.isActive ? "Hoạt động" : "Đã khóa"}</p>{canWriteUsers && user.id !== actor.id && (superAdmin || roleOrder.indexOf(user.role) > roleOrder.indexOf(actor.role)) ? <Button variant="secondary" className="mt-4" onClick={() => { mutation.reset(); setEditing(user); }}>Chỉnh sửa / khóa tài khoản</Button> : null}</li>)}</ul>
      {users.data?.length === 0 ? <p>Chưa có tài khoản phù hợp với phạm vi quản lý.</p> : null}</section> : null}
    {tab === "roles" && canConfigure ? <section className="space-y-4"><p className="text-sm text-muted">Thay đổi áp dụng cho tất cả tài khoản có vai trò tương ứng trong công ty. Không sửa vai trò hệ thống.</p>{roles.data?.map((role) => <form key={`${companyId}:${role.role}:${role.version}`} className="space-y-4 rounded-2xl border border-border bg-surface p-6" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); save(`/organization/roles/${role.role}${scope}`, { expectedVersion: role.version, permissions: form.getAll("permission") }, "PATCH"); }}><h2 className="text-xl font-bold">{roleLabels[role.role]}</h2><fieldset disabled={mutation.isPending} className="grid gap-3 sm:grid-cols-2">{Object.entries(grantLabels).map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="permission" value={key} defaultChecked={role.permissions.includes(key)} />{label}</label>)}</fieldset><Button disabled={mutation.isPending} type="submit">Lưu quyền {role.role}</Button></form>)}</section> : null}
    {superAdmin ? <details className="rounded-2xl border border-border bg-surface p-6"><summary className="cursor-pointer font-bold">Tạo công ty mới và quản trị viên</summary><form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); save("/organization/companies", { name: form.get("name"), industry: form.get("industry") || null, adminName: form.get("adminName"), adminEmail: form.get("adminEmail"), adminPassword: form.get("adminPassword") }); }}>
      {[['name','Tên công ty'],['industry','Lĩnh vực'],['adminName','Tên quản trị viên'],['adminEmail','Email quản trị viên'],['adminPassword','Mật khẩu khởi tạo (ít nhất 12 ký tự)']].map(([key,label]) => <label key={key} className="text-sm font-semibold">{label}<input name={key} required={key !== "industry"} type={key === "adminPassword" ? "password" : key === "adminEmail" ? "email" : "text"} autoComplete={key === "adminPassword" ? "new-password" : "off"} minLength={key === "adminPassword" ? 12 : undefined} maxLength={255} className={fieldClass} /></label>)}<Button type="submit" disabled={mutation.isPending}>Tạo công ty</Button></form></details> : null}
    <Dialog.Root open={!!editing} onOpenChange={(open) => { if (!open && !mutation.isPending) setEditing(null); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" /><Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(92vw,600px)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl bg-surface p-6"><Dialog.Title className="text-xl font-bold">{editing === "new" ? "Thêm tài khoản" : "Chỉnh sửa tài khoản"}</Dialog.Title><Dialog.Description className="mt-2 text-sm text-muted">Khóa tài khoản ngăn đăng nhập và giữ lịch sử nghiệp vụ. Không xóa dữ liệu hồ sơ.</Dialog.Description>{editing ? <AccountForm key={typeof editing === "string" ? editing : editing.id} value={editing} actorRole={actor.role} pending={mutation.isPending} error={mutation.error} onSubmit={(body) => save(editing === "new" ? "/organization/users" : `/organization/users/${editing.id}`, { ...body, ...(editing === "new" ? { companyId } : { expectedVersion: editing.version }) }, editing === "new" ? "POST" : "PATCH")} /> : null}<Button variant="ghost" className="mt-4" disabled={mutation.isPending} onClick={() => setEditing(null)}>Đóng</Button></Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}

function AccountForm({ value, actorRole, pending, error, onSubmit }: { value: Account | "new"; actorRole: UserRole; pending: boolean; error: unknown; onSubmit: (body: Record<string, unknown>) => void }) {
  const account = value === "new" ? null : value;
  return <form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ email: data.get("email"), name: data.get("name"), jobTitle: data.get("jobTitle") || null, role: data.get("role"), ...(account ? { isActive: data.get("active") === "on" } : { password: data.get("password") }) }); }}><fieldset disabled={pending} className="space-y-4">
    <label className="block text-sm font-semibold">Họ tên<input name="name" required maxLength={160} defaultValue={account?.name} className={fieldClass} /></label>
    <label className="block text-sm font-semibold">Email<input name="email" type="email" required defaultValue={account?.email} className={fieldClass} /></label>
    <label className="block text-sm font-semibold">Chức danh<input name="jobTitle" maxLength={160} defaultValue={account?.jobTitle ?? ""} className={fieldClass} /></label>
    <label className="block text-sm font-semibold">Vai trò<select name="role" defaultValue={account?.role ?? "EMPLOYEE"} className={fieldClass}>{roleOrder.filter((role) => role !== "SUPER_ADMIN" && (actorRole === "SUPER_ADMIN" || roleOrder.indexOf(role) > roleOrder.indexOf(actorRole))).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label>
    {account ? <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="active" defaultChecked={account.isActive} /> Tài khoản hoạt động</label> : <label className="block text-sm font-semibold">Mật khẩu khởi tạo<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={256} className={fieldClass} /></label>}
    {error ? <p role="alert" className="text-sm text-danger">{errorText(error)}</p> : null}<Button type="submit">{pending ? "Đang lưu…" : "Lưu tài khoản"}</Button>
  </fieldset></form>;
}
