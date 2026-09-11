import { DashboardView } from "@/features/dashboard/dashboard-view";

type ForcedState = "loading" | "empty" | "error";

export const metadata = { title: "Tổng quan" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const params = await searchParams;
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const state = demoMode && (params.state === "loading" || params.state === "empty" || params.state === "error")
    ? params.state as ForcedState
    : undefined;
  return <DashboardView forceState={state} />;
}
