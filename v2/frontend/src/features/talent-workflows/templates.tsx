"use client";

import { useState } from "react";
import { AssessmentBuilderView, createEmptyTemplate, type AssessmentTemplate } from "@/features/assessment-template-builder";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Cycle, Field, fieldClass, Loading, panelClass, statusLabel, TalentHeader, Template, useTalentAction, useTalentQuery, useTalentScope } from "./shared";

export function TalentTemplates() {
  const scopeState = useTalentScope();
  return <TalentTemplatesContent key={`${scopeState.session?.user.id}:${scopeState.companyId}`} scopeState={scopeState} />;
}

function TalentTemplatesContent({scopeState}: {scopeState: ReturnType<typeof useTalentScope>}) {
  const {session,ready,companyId,scope,selector} = scopeState;
  const rows=useTalentQuery<Template[]>(`/assessments/templates?${scope}`,ready);
  const cycles=useTalentQuery<Cycle[]>(`/assessments/cycles?${scope}`,ready);
  const [editing,setEditing]=useState<Template|"new"|null>(null);
  const [cycleName,setCycleName]=useState(""); const [period,setPeriod]=useState(""); const [dueDate,setDueDate]=useState(""); const [templateId,setTemplateId]=useState("");
  const canManage=(session?.user.role==="SUPER_ADMIN"||session?.user.companyId===companyId)&&!!session?.user.permissions.includes("assessment:review")&&["HR","COMPANY_ADMIN","SUPER_ADMIN"].includes(session.user.role);
  const action=useTalentAction(async()=>{await rows.refetch();await cycles.refetch();});
  async function saveTemplate(value:AssessmentTemplate,publish:boolean) {
    const payload={companyId,name:value.name,description:value.description,groups:value.groups.map(g=>({id:g.id,name:g.name,description:g.description,weight:g.weight,scoreDimension:g.scoreDimension??"CONTRIBUTION",passportDimension:g.passportDimension??null,questions:g.questions.map(q=>({id:q.id,text:q.title,guidance:q.helpText,weight:q.weight,maxScore:q.maxScore??10}))}))};
    const existing=editing&&editing!=="new"?editing:null;
    const result=await apiRequest<Template>(existing?`/assessments/templates/${existing.id}`:"/assessments/templates",{method:existing?"PUT":"POST",body:JSON.stringify({...payload,...(existing?{expectedVersion:existing.version}:{})})},session?.accessToken);
    setEditing(result);
    if(publish)await apiRequest(`/assessments/templates/${result.id}/publish`,{method:"POST",body:JSON.stringify({expectedVersion:result.version})},session?.accessToken);
    await rows.refetch();setEditing(null);action.setMessage(publish?"Đã phát hành mẫu. Bạn có thể mở chu kỳ mới.":"Đã lưu bản nháp trên máy chủ.");
  }
  const initial:AssessmentTemplate=editing&&editing!=="new"?{id:editing.id,name:editing.name,description:editing.description,groups:editing.groups.map(g=>({...g,questions:g.questions.map(q=>({...q,title:q.text,helpText:q.guidance}))}))}:createEmptyTemplate();
  return <main className="mx-auto max-w-7xl space-y-6"><TalentHeader title="Mẫu tiêu chí & chu kỳ" description="Thiết kế thang đánh giá theo doanh nghiệp, phát hành mẫu và mở chu kỳ. Phiếu đang dùng giữ nguyên phiên bản mẫu để kết quả luôn có căn cứ."/>{selector}{action.feedback}<Loading loading={ready&&rows.isLoading} error={rows.error||cycles.error} retry={()=>rows.refetch()}/>
    {canManage&&ready&&<Button onClick={()=>setEditing("new")}>Tạo mẫu mới</Button>}
    {editing&&canManage&&<section className="space-y-4"><Button variant="secondary" onClick={()=>setEditing(null)}>Đóng trình biên tập</Button><AssessmentBuilderView key={editing==="new"?`new:${companyId}`:`${editing.id}:${editing.version}`} initialTemplate={initial} onSave={saveTemplate}/></section>}
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{rows.data?.map(template=><section key={template.id} className={`${panelClass} space-y-3`}><p className="text-xs font-semibold text-primary">{statusLabel[template.status]} · v{template.version}</p><h2 className="text-lg font-bold">{template.name}</h2><p className="text-sm text-muted">{template.description}</p><p className="text-sm">{template.groups.length} nhóm · {template.groups.reduce((n,g)=>n+g.questions.length,0)} tiêu chí</p>{canManage&&template.status!=="ARCHIVED"&&<div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={()=>setEditing(template)}>Chỉnh sửa</Button>{template.status==="DRAFT"&&<Button size="sm" disabled={action.busy} onClick={()=>void action.run(`/assessments/templates/${template.id}/publish`,"POST",{expectedVersion:template.version})}>Phát hành</Button>}<Button size="sm" variant="ghost" disabled={action.busy} onClick={()=>void action.run(`/assessments/templates/${template.id}/archive`,"POST",{expectedVersion:template.version})}>Lưu trữ</Button></div>}</section>)}</div>
    {rows.data?.length===0&&<p className={panelClass}>Chưa có mẫu đánh giá. HR có thể tạo mẫu đầu tiên.</p>}
    {canManage&&ready&&<form className={`${panelClass} space-y-4`} onSubmit={async e=>{e.preventDefault();const result=await action.run("/assessments/cycles","POST",{companyId,templateId,name:cycleName,period,dueDate:dueDate||null});if(result){setCycleName("");action.setMessage("Đã mở chu kỳ đánh giá.");}}}><h2 className="text-xl font-bold">Mở chu kỳ đánh giá</h2><div className="grid gap-4 md:grid-cols-2"><Field label="Tên chu kỳ"><input required className={fieldClass} value={cycleName} onChange={e=>setCycleName(e.target.value)}/></Field><Field label="Mẫu đã phát hành"><select required className={fieldClass} value={templateId} onChange={e=>setTemplateId(e.target.value)}><option value="">Chọn mẫu</option>{rows.data?.filter(t=>t.status==="ACTIVE").map(t=><option key={t.id} value={t.id}>{t.name} · v{t.version}</option>)}</select></Field><Field label="Tháng đánh giá"><input required type="month" className={fieldClass} value={period} onChange={e=>setPeriod(e.target.value)}/></Field><Field label="Hạn hoàn thành"><input type="date" className={fieldClass} value={dueDate} onChange={e=>setDueDate(e.target.value)}/></Field></div><Button disabled={action.busy}>Mở chu kỳ</Button></form>}
    <section className="space-y-3"><h2 className="text-xl font-bold">Các chu kỳ</h2>{cycles.data?.map(c=><div key={c.id} className={`${panelClass} flex flex-wrap items-center justify-between gap-4`}><div><h3 className="font-semibold">{c.name} · {c.period}</h3><p className="mt-1 text-sm text-muted">{statusLabel[c.status]} · {c.template.name} · v{c.template.version}</p></div>{canManage&&<Button variant="secondary" disabled={action.busy} onClick={()=>void action.run(`/assessments/cycles/${c.id}`,"PATCH",{expectedVersion:c.version,status:c.status==="OPEN"?"CLOSED":"OPEN"})}>{c.status==="OPEN"?"Đóng chu kỳ":"Mở lại"}</Button>}</div>)}</section>
  </main>;
}
