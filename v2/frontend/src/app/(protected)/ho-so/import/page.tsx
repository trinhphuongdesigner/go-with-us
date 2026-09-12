import { ProfileImportListView, type ProfileImportForcedState } from "@/features/profile-import/profile-import-ui";

const allowedStates = new Set<ProfileImportForcedState>(["loading", "empty", "error"]);

export default async function ProfileImportPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const forceState = demoMode && state && allowedStates.has(state as ProfileImportForcedState) ? state as ProfileImportForcedState : undefined;
  return <ProfileImportListView forceState={forceState} />;
}
