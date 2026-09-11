import Loading from '@/components/ui/Loading';

/** Fills the page slot inside AppShell — not the whole viewport — so the
 *  sidebar / top bar stay visible while the next route streams in. */
export default function AppLoading() {
  return <Loading variant="fill" size="lg" />;
}
