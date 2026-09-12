"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/auth-provider";
import { apiRequest, ApiError, DEMO_MODE, listAvailableCompanies } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { getCompanyNavigation } from "@/lib/navigation";

type CompanyBrief = { id: string; name: string; industry?: string | null };
type Member = { userId: string; name: string; email: string; role: string; jobTitle: string | null };
const field = "mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm";
function ErrorMessage({ error }: { error: unknown }) { return error ? <p role="alert" className="text-sm text-danger">{error instanceof ApiError ? error.message : "Chưa thực hiện được. Hãy thử lại."}</p> : null; }

export function MyCompanies() {
  const { session } = useAuth();
  const params = useSearchParams();
  const companyId = params.get("companyId");
  const query = useQuery<CompanyBrief[]>({ queryKey: ["my-companies", session?.user.id], queryFn: () => session?.user.role === "SUPER_ADMIN" ? listAvailableCompanies(session) : apiRequest<CompanyBrief[]>("/company-memberships/mine", undefined, session!.accessToken), enabled: !!session && !DEMO_MODE });
  if (!session) return null;
  const company = query.data?.find((item) => item.id === companyId);
  return <div className="space-y-6"><header><p className="text-sm font-semibold text-primary">Không gian tổ chức</p><h1 className="mt-2 text-3xl font-bold">{company?.name ?? "Công ty của tôi"}</h1><p className="mt-2 text-sm text-muted">Tư cách thành viên cho phép mở phạm vi công ty; không thay đổi công ty đang làm việc hay vai trò của bạn.</p></header><ErrorMessage error={query.error} />{query.isPending && !DEMO_MODE ? <p role="status">Đang tải công ty…</p> : null}{DEMO_MODE ? <p>Danh sách thành viên cần bản QC API thật.</p> : null}
    {companyId && query.isSuccess && !company ? <p role="alert">Bạn không còn tư cách thành viên trong công ty này.</p> : null}
    {company ? <div className="grid gap-3 sm:grid-cols-2">{getCompanyNavigation(company.id, session.user.permissions).filter((item) => !item.exact).map((item) => <Link key={item.href} href={item.href} className="flex min-h-20 items-center gap-3 rounded-2xl border border-border bg-surface p-5 font-semibold hover:border-primary"><item.icon className="text-primary" size={22} />{item.label}</Link>)}</div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{query.data?.map((row) => <Link key={row.id} href={`/cong-ty-cua-toi?companyId=${encodeURIComponent(row.id)}`} className="rounded-2xl border border-border bg-surface p-6 hover:border-primary"><h2 className="text-xl font-bold">{row.name}</h2><p className="mt-2 text-sm text-muted">{row.industry ?? "Mở không gian công ty"}</p></Link>)}</div>}
    {query.isSuccess && !query.data.length ? <p>Bạn chưa được thêm vào công ty nào. Liên hệ quản trị viên để được cấp tư cách thành viên.</p> : null}
  </div>;
}

export function MembershipManager({ companyId }: { companyId: string }) {
  const { session } = useAuth(); const client = useQueryClient();
  const [userId, setUserId] = useState(""); const [removing, setRemoving] = useState<Member | null>(null);
  const allowed = !!session && !!companyId && (session.user.role === "SUPER_ADMIN" || (session.user.role === "COMPANY_ADMIN" && session.user.companyId === companyId));
  const members = useQuery({ queryKey: ["company-members", session?.user.id, companyId], queryFn: () => apiRequest<Member[]>(`/company-memberships/${companyId}/members`, undefined, session!.accessToken), enabled: allowed && !DEMO_MODE });
  const candidates = useQuery({ queryKey: ["membership-candidates", session?.user.id], queryFn: () => apiRequest<Array<{id:string;name:string;email:string}>>("/organization/users", undefined, session!.accessToken), enabled: allowed && session?.user.role === "SUPER_ADMIN" && !DEMO_MODE });
  const mutation = useMutation({ mutationFn: ({ id, remove }: {id:string;remove:boolean}) => apiRequest(`/company-memberships/${companyId}/members${remove ? `/${id}` : ""}`, { method: remove ? "DELETE" : "POST", ...(remove ? {} : { body: JSON.stringify({ userId:id }) }) }, session!.accessToken), onSuccess: () => { setUserId(""); setRemoving(null); void client.invalidateQueries({ queryKey:["company-members"] }); void client.invalidateQueries({ queryKey:["my-companies"] }); void client.invalidateQueries({ queryKey:["company-options"] }); } });
  if (!allowed || DEMO_MODE) return null;
  return <section className="space-y-4 rounded-2xl border border-border bg-surface p-6"><h2 className="text-xl font-bold">Thành viên công ty</h2><p className="text-sm text-muted">Thêm tài khoản đã tồn tại vào phạm vi công ty. Đây không phải chuyển nhân sự hay cấp thêm vai trò.</p><ErrorMessage error={members.error ?? mutation.error} /><form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); mutation.mutate({id:userId,remove:false}); }}><label className="flex-1 text-sm font-semibold">Tài khoản cần thêm{candidates.data ? <select required value={userId} onChange={(event) => setUserId(event.target.value)} className={field}><option value="">Chọn tài khoản</option>{candidates.data.filter((item) => !members.data?.some((member) => member.userId === item.id)).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.email}</option>)}</select> : <input required value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="UUID tài khoản do quản trị viên cung cấp" className={field} />}</label><Button disabled={mutation.isPending || !userId} type="submit">Thêm thành viên</Button></form>
    {members.isPending ? <p role="status">Đang tải thành viên…</p> : null}<ul className="space-y-3">{members.data?.map((member) => <li key={member.userId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background p-4"><div><p className="font-semibold">{member.name}</p><p className="mt-1 break-all text-xs text-muted">{member.email} · {member.role}</p></div><Button variant="secondary" onClick={() => setRemoving(member)}>Gỡ khỏi công ty</Button></li>)}</ul>
    {removing ? <div role="alert" className="space-y-3 rounded-xl border border-border p-4"><p>Gỡ tư cách thành viên của {removing.name}? Tài khoản và lịch sử làm việc vẫn được giữ.</p><Button variant="danger" disabled={mutation.isPending} onClick={() => mutation.mutate({id:removing.userId,remove:true})}>Xác nhận gỡ</Button><Button variant="ghost" onClick={() => setRemoving(null)}>Hủy</Button></div> : null}{mutation.isSuccess ? <p role="status" className="text-sm">Đã cập nhật danh sách thành viên.</p> : null}
  </section>;
}

export function PasswordReset({ userId, self = false }: { userId: string; self?: boolean }) {
  const { session, signOut } = useAuth(); const [password,setPassword] = useState(""); const [currentPassword,setCurrentPassword] = useState("");
  const mutation = useMutation({ mutationFn: () => apiRequest(`/organization/users/${userId}/reset-password`, {method:"POST",body:JSON.stringify({password,...(self?{currentPassword}:{})})}, session!.accessToken), onSuccess: async () => {setPassword("");setCurrentPassword(""); if(self) await signOut();} });
  if (!session || DEMO_MODE) return null;
  return <details className="rounded-2xl border border-border bg-surface p-5"><summary className="cursor-pointer font-semibold">{self ? "Đổi mật khẩu của tôi" : "Đặt lại mật khẩu tài khoản"}</summary><form className="mt-4 space-y-4" onSubmit={(event) => {event.preventDefault();mutation.mutate();}}><p className="text-sm text-muted">Tất cả phiên đăng nhập của tài khoản này sẽ hết hiệu lực. Cần đăng nhập lại với mật khẩu mới.</p>{self ? <label className="block text-sm font-semibold">Mật khẩu hiện tại<input required autoComplete="current-password" type="password" value={currentPassword} onChange={(event)=>setCurrentPassword(event.target.value)} className={field}/></label>:null}<label className="block text-sm font-semibold">Mật khẩu mới<input required minLength={12} maxLength={256} autoComplete="new-password" type="password" value={password} onChange={(event)=>setPassword(event.target.value)} className={field}/></label><ErrorMessage error={mutation.error}/>{mutation.isSuccess?<p role="status">Đã đặt lại mật khẩu và thu hồi các phiên cũ.</p>:null}<Button disabled={mutation.isPending} type="submit">Xác nhận đổi mật khẩu</Button></form></details>;
}
