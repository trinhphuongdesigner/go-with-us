import Chip from '@mui/material/Chip';
import { toneForStatus, TONE_COLORS, type StatusTone } from '@/lib/statusColors';

interface StatusChipProps {
  label: string;
  /** Explicit tone override; otherwise derived from `label` via toneForStatus. */
  tone?: StatusTone;
}

/** Tone-mapped chip — never set a chip color directly at the call site. */
export default function StatusChip({ label, tone }: StatusChipProps) {
  const resolvedTone = tone ?? toneForStatus(label);
  const colors = TONE_COLORS[resolvedTone];

  return (
    <Chip
      label={label}
      size="small"
      sx={{
        backgroundColor: colors.bg,
        color: colors.fg,
      }}
    />
  );
}
