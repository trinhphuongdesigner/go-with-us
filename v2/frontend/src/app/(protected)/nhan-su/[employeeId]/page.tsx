import { PeopleDetailView } from "@/features/people/people-view";
import { DEMO_MODE } from "@/lib/api";

const forcedStates = new Set(["loading", "empty", "error", "stale"]);

export default async function PeopleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  const { employeeId } = await params;
  const requestedState = (await searchParams).state;
  const forceState = DEMO_MODE && requestedState && forcedStates.has(requestedState)
    ? requestedState as "loading" | "empty" | "error" | "stale"
    : undefined;
  return <PeopleDetailView employeeId={employeeId} forceState={forceState} />;
}
