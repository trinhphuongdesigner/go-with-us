"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-provider";
import { Assessment, Cycle, Field, fieldClass, Loading, panelClass, statusLabel, TalentHeader, useTalentAction, useTalentQuery, useTalentScope } from "./shared";

export function TalentAssessments() {
  const scopeState = useTalentScope();
  return <TalentAssessmentsContent key={`${scopeState.session?.user.id}:${scopeState.companyId}`} scopeState={scopeState} />;
}

function TalentAssessmentsContent({scopeState}: {scopeState: ReturnType<typeof useTalentScope>}) {
  const {session, ready, selector, scope, companyId} = scopeState;
  const ownCompany = session?.user.companyId === companyId;
  const self = !!session?.user.permissions.includes("assessment:self");
  const review = !!session?.user.permissions.includes("assessment:review");
  const [tab,setTab] = useState<"mine"|"received"|"pending">("received");
  const activeTab = self || tab === "mine" ? tab : "pending";
  const list = useTalentQuery<Assessment[]>(`/assessments?scope=${activeTab}&${scope}`,ready && (self || review));
  const cycles = useTalentQuery<Cycle[]>(`/assessments/cycles?${scope}`,ready && (self || review));
  const colleagues = useTalentQuery<Array<{id:string; name:string; jobTitle:string}>>(`/assessments/colleagues?${scope}`,ready && (self || review));
  const [cycleId,setCycleId] = useState(""); const [type,setType] = useState("SELF"); const [revieweeId,setRevieweeId] = useState("");
  const action = useTalentAction(() => list.refetch()); const router = useRouter();
  const open = cycles.data?.filter(c => c.status === "OPEN") ?? [];
  const chosenCycle = open.some(c => c.id === cycleId) ? cycleId : open[0]?.id ?? "";
  const chosenType = self ? (!ownCompany && type === "SELF" ? "PEER" : type) : "MANAGER";
  async function start() { const row = await action.run<Assessment>("/assessments","POST",{cycleId:chosenCycle,type:chosenType, ...(chosenType !== "SELF" ? {revieweeId} : {})}); if(row)router.push(`/danh-gia/${row.id}`); }
  return <main className="mx-auto max-w-6xl space-y-6"><TalentHeader title="Đánh giá năng lực" description="Tự nhìn lại, nhận phản hồi và ghi nhận tiến bộ qua từng chu kỳ. Kết quả chỉ đi vào hồ sơ đã xác nhận sau khi được duyệt." />{selector}
    {!self && !review && <p>Bạn chưa được cấp quyền đánh giá.</p>}
    {(self || review) && <section className={panelClass}><h2 className="mb-4 text-lg font-bold">Bắt đầu một lượt đánh giá</h2><div className="grid gap-4 md:grid-cols-3"><Field label="Chu kỳ"><select className={fieldClass} value={chosenCycle} onChange={e=>setCycleId(e.target.value)}><option value="">Chọn chu kỳ mở</option>{open.map(c=><option key={c.id} value={c.id}>{c.name} · {c.period}</option>)}</select></Field><Field label="Hình thức"><select className={fieldClass} value={chosenType} onChange={e=>setType(e.target.value)}>{self&&<>{ownCompany && <option value="SELF">Tự đánh giá</option>}<option value="PEER">Đồng nghiệp</option></>}{review && <option value="MANAGER">Quản lý</option>}</select></Field>{chosenType !== "SELF" && <Field label="Người được đánh giá"><select className={fieldClass} value={revieweeId} onChange={e=>setRevieweeId(e.target.value)}><option value="">Chọn đồng nghiệp</option>{colleagues.data?.filter(p=>p.id!==session?.user.id).map(p=><option key={p.id} value={p.id}>{p.name} · {p.jobTitle}</option>)}</select></Field>}</div><Button className="mt-4" disabled={action.busy || !chosenCycle || (chosenType!=="SELF"&&!revieweeId)} onClick={()=>void start()}>Tạo bản nháp</Button>{open.length===0&&!cycles.isLoading&&<p className="mt-3 text-sm text-muted">Chưa có chu kỳ mở. HR có thể phát hành mẫu và mở chu kỳ tại Mẫu & chu kỳ.</p>}</section>}
    {action.feedback}<Loading loading={ready&&list.isLoading} error={list.error||cycles.error||colleagues.error} retry={()=>list.refetch()} />
    <div className="flex flex-wrap gap-2">{(self || review)&&(["received","mine"] as const).filter(t=>self||t==="mine").map(t=><Button key={t} variant={activeTab===t?"primary":"secondary"} onClick={()=>setTab(t)}>{t==="mine"?"Tôi đã viết":"Đánh giá về tôi"}</Button>)}{review&&<Button variant={activeTab==="pending"?"primary":"secondary"} onClick={()=>setTab("pending")}>Chờ xét duyệt</Button>}</div>
    <div className="grid gap-4 md:grid-cols-2">{list.data?.map(row=><Link key={row.id} href={`/danh-gia/${row.id}`} className={`${panelClass} block transition-colors hover:border-primary`}><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-primary">{statusLabel[row.status]}</span><span className="text-sm font-bold">{row.totalScore===null?"Chưa chấm":`${row.totalScore}/10`}</span></div><h2 className="mt-3 text-lg font-bold">{row.revieweeName}</h2><p className="mt-2 text-sm text-muted">{statusLabel[row.type]} · Người viết: {row.reviewerName}</p><p className="mt-2 text-sm">{row.templateSnapshot.name}</p></Link>)}</div>{list.data?.length===0&&<p className={`${panelClass} text-muted`}>Chưa có lượt đánh giá trong mục này.</p>}</main>;
}

export function TalentAssessmentDetail({id}:{id:string}) {
  const query=useTalentQuery<Assessment>(`/assessments/${id}`);
  return <main className="mx-auto max-w-5xl space-y-5"><TalentHeader title="Phiếu đánh giá" description="Lưu bản nháp khi cần. Gửi phiếu sau khi hoàn thành các tiêu chí; các lượt đã duyệt giữ nguyên mẫu và thang điểm tại thời điểm đánh giá."/><Loading loading={query.isLoading} error={query.error} retry={()=>query.refetch()}/>{query.data&&<AssessmentEditor key={`${query.data.id}:${query.data.version}`} row={query.data} refresh={()=>query.refetch()}/>}</main>;
}
function AssessmentEditor({row,refresh}:{row:Assessment;refresh:()=>unknown}) {
  const {session}=useAuth(); const [answers,setAnswers]=useState(row.answers); const [mood,setMood]=useState(row.mood); const [highlights,setHighlights]=useState(row.highlights); const [comment,setComment]=useState(row.comment); const [reviewComment,setReviewComment]=useState(""); const action=useTalentAction(refresh);
  const writer=session?.user.id===row.reviewerId;
  const role=session?.user.role;
  const managementScope=role==="SUPER_ADMIN"||session?.user.companyId===row.companyId;
  const hr=managementScope&&!!session?.user.permissions.includes("assessment:review")&&["HR","COMPANY_ADMIN","SUPER_ADMIN"].includes(role??"");
  const approver=managementScope&&!!session?.user.permissions.includes("assessment:review")&&["BOD","COMPANY_ADMIN","SUPER_ADMIN"].includes(role??"")&&session?.user.id!==row.revieweeId;
  const editable=(writer&&row.status==="DRAFT")||(hr&&row.status==="SUBMITTED");
  const body={expectedVersion:row.version,answers,mood,highlights,comment};
  const setAnswer=(questionId:string,score:number,feedback?:string)=>setAnswers(previous=>{const found=previous.find(a=>a.questionId===questionId);return [...previous.filter(a=>a.questionId!==questionId),{questionId,score,comment:feedback??found?.comment??""}];});
  return <div className="space-y-5">{action.feedback}<section className={panelClass}><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-bold">{row.revieweeName} · {statusLabel[row.type]}</h2><p className="mt-2 text-sm text-muted">{row.templateSnapshot.name} · Phiên bản {row.templateSnapshot.version}</p></div><p className="font-semibold text-primary">{statusLabel[row.status]} {row.totalScore!==null&&`· ${row.totalScore}/10`}</p></div>{row.reviewComment&&<p className="mt-3 rounded-xl bg-background p-3 text-sm">Phản hồi duyệt: {row.reviewComment}</p>}</section>
    <fieldset disabled={!editable||action.busy} className="space-y-5"><div className={`${panelClass} grid gap-4 md:grid-cols-2`}><Field label="Cảm nhận tháng này"><select className={fieldClass} value={mood} onChange={e=>setMood(e.target.value)}><option value="">Chọn cảm nhận</option>{["Rất tốt","Tốt","Bình thường","Cần hỗ trợ"].map(m=><option key={m}>{m}</option>)}</select></Field><Field label="Điểm nổi bật"><textarea className={fieldClass} rows={3} value={highlights} onChange={e=>setHighlights(e.target.value)}/></Field></div>
      {row.templateSnapshot.groups.map(group=><section key={group.id} className={panelClass}><h2 className="text-lg font-bold">{group.name}</h2><p className="mb-5 mt-2 text-sm text-muted">{group.description} · Trọng số {group.weight} · {group.scoreDimension==="ATTITUDE"?"Thái độ":"Đóng góp"}</p><div className="space-y-5">{group.questions.map(q=>{const answer=answers.find(a=>a.questionId===q.id);return <div key={q.id} className="grid gap-3 border-t border-border pt-4 md:grid-cols-[1fr_140px]"><div><p className="font-semibold">{q.text}</p><p className="mt-1 text-sm text-muted">{q.guidance}</p></div><Field label={`Điểm / ${q.maxScore}`}><select className={fieldClass} value={answer?.score??""} onChange={e=>setAnswer(q.id,Number(e.target.value))}><option value="" disabled>Chọn điểm</option>{Array.from({length:q.maxScore},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></Field><div className="md:col-span-2"><Field label="Minh chứng / nhận xét"><textarea disabled={!answer} placeholder="Chọn điểm trước khi thêm minh chứng" className={fieldClass} value={answer?.comment??""} rows={2} onChange={e=>setAnswer(q.id,answer?.score??1,e.target.value)}/></Field></div></div>;})}</div></section>)}
      <Field label="Nhận xét chung"><textarea className={fieldClass} rows={3} value={comment} onChange={e=>setComment(e.target.value)}/></Field>
    </fieldset><div className="flex flex-wrap gap-3">{editable&&<Button variant="secondary" disabled={action.busy} onClick={()=>void action.run(`/assessments/${row.id}`,"PATCH",body)}>Lưu thay đổi</Button>}{writer&&row.status==="DRAFT"&&<Button disabled={action.busy} onClick={()=>void action.run(`/assessments/${row.id}/submit`,"POST",body)}>Gửi đánh giá</Button>}<Button variant="ghost" asChild><Link href="/danh-gia">Về danh sách</Link></Button></div>
    {row.status==="SUBMITTED"&&approver&&<section className={`${panelClass} space-y-4`}><h2 className="font-bold">Xét duyệt đánh giá</h2><Field label="Nhận xét / lý do cần chỉnh sửa"><textarea className={fieldClass} value={reviewComment} onChange={e=>setReviewComment(e.target.value)}/></Field><div className="flex gap-3"><Button disabled={action.busy} onClick={()=>void action.run(`/assessments/${row.id}/approve`,"POST",{expectedVersion:row.version,comment:reviewComment})}>Phê duyệt</Button><Button variant="secondary" disabled={action.busy||!reviewComment.trim()} onClick={()=>void action.run(`/assessments/${row.id}/request-revision`,"POST",{expectedVersion:row.version,comment:reviewComment})}>Yêu cầu chỉnh sửa</Button></div></section>}
  </div>;
}
