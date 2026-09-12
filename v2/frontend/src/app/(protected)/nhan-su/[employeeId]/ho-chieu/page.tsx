import { TalentManagedPassport } from "@/features/talent-workflows";

export default async function Page({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  return <TalentManagedPassport userId={employeeId} />;
}
