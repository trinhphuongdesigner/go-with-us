import { TalentAssessmentDetail } from "@/features/talent-workflows";
export default async function Page({params}:{params:Promise<{assessmentId:string}>}) { const {assessmentId}=await params; return <TalentAssessmentDetail id={assessmentId}/>; }
