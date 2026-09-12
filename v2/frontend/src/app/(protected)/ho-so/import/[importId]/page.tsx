import { ProfileImportDetailView, type ProfileImportForcedState } from "@/features/profile-import/profile-import-ui";

const allowedStates = new Set<ProfileImportForcedState>(["loading", "error", "stale"]);

export default async function ProfileImportDetailPage({ params, searchParams }: {
  params: Promise<{ importId: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  const [{ importId }, { state }] = await Promise.all([params, searchParams]);
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const forceState = demoMode && state && allowedStates.has(state as ProfileImportForcedState) ? state as ProfileImportForcedState : undefined;
  return <ProfileImportDetailView importId={importId} forceState={forceState} />;
}
