'use client';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import { useAuth } from '@/contexts/AuthContext';
import { colorTokens } from '@/theme/theme';
import type { DevelopmentMilestone, DevelopmentGoal } from '@/lib/api/developmentPlansApi';

/** Local vector character keeps the roadmap usable without an external image service. */
function CareerCharacter({ future = false }: { future?: boolean }) {
  return (
    <svg viewBox="0 0 120 120" width="88" height="88" aria-hidden="true">
      <circle cx="60" cy="60" r="58" fill={colorTokens.accent900} />
      <path d="M31 67V43c0-19 12-30 29-30s29 11 29 30v24z" fill={colorTokens.text} />
      <path
        d="M18 112c2-26 19-35 42-35s40 9 42 35"
        fill={future ? colorTokens.accent300 : colorTokens.accent700}
      />
      <path d="M51 69v14l9 9 9-9V69" fill="#e9ad88" />
      <path
        d="M38 39c0 0 14-2 21-13 5 9 14 13 23 13v15c0 16-10 25-22 25S38 70 38 54z"
        fill="#f3c6a5"
      />
      <circle cx="49" cy="51" r="2" fill={colorTokens.text} />
      <circle cx="71" cy="51" r="2" fill={colorTokens.text} />
      <path
        d="M54 65q6 5 12 0"
        fill="none"
        stroke="#a35a4c"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {future ? (
        <>
          <path d="M46 81l14 11-12 16-10-22m36-5L60 92l12 16 10-22" fill={colorTokens.surface} />
          <rect
            x="41"
            y="44"
            width="15"
            height="13"
            rx="5"
            fill="none"
            stroke={colorTokens.text}
            strokeWidth="2"
          />
          <rect
            x="64"
            y="44"
            width="15"
            height="13"
            rx="5"
            fill="none"
            stroke={colorTokens.text}
            strokeWidth="2"
          />
          <path d="M56 49h8" stroke={colorTokens.text} strokeWidth="2" />
        </>
      ) : (
        <>
          <rect x="31" y="89" width="58" height="26" rx="4" fill={colorTokens.text} />
          <path
            d="M54 99l-5 4 5 4m12-8 5 4-5 4"
            fill="none"
            stroke={colorTokens.accent900}
            strokeWidth="2"
          />
        </>
      )}
    </svg>
  );
}

export default function RoadmapJourney({
  milestones,
  goals,
}: {
  milestones: DevelopmentMilestone[];
  goals: DevelopmentGoal[];
}) {
  const { user } = useAuth();
  const aliceDemo = user?.email === 'alice@acme.dev';
  const tasks = milestones.flatMap((milestone) => milestone.tasks);
  const completed = tasks.filter((task) => task.done).length;
  const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const nextGoal = goals.find((goal) => goal.category === 'WORK' && goal.status !== 'ACHIEVED');

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        mb: 3,
        borderRadius: 2,
        bgcolor: colorTokens.bg,
        border: `1px solid ${colorTokens.divider}`,
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
        <FlagOutlinedIcon color="primary" fontSize="small" />
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: colorTokens.accent300 }}>
          {aliceDemo ? 'Alice demo · career direction' : 'Your career direction'}
        </Typography>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr minmax(120px, 0.8fr) 1fr' },
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Avatar
            src={user?.avatarUrl ?? undefined}
            alt={user?.name ?? 'Your avatar'}
            sx={{ width: 88, height: 88, bgcolor: 'transparent', flexShrink: 0 }}
          >
            <CareerCharacter />
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontSize: 12 }}>
              {aliceDemo ? 'Demo starting point' : 'Current profile'}
            </Typography>
            <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
              {user?.name ?? 'Your profile'}
            </Typography>
            <Typography variant="body2">
              {aliceDemo
                ? 'Level 3+ · Developer'
                : (user?.jobTitle ?? 'Add your role in My Profile')}
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ textAlign: 'center', px: 1 }}>
          <Typography sx={{ fontSize: 24, fontWeight: 600, color: colorTokens.accent300 }}>
            {percent}%
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', my: 0.5 }}>
            <LinearProgress
              aria-label="Roadmap task completion"
              variant="determinate"
              value={percent}
              sx={{ flex: 1, height: 6, borderRadius: 3 }}
            />
            <ArrowForwardRoundedIcon color="primary" fontSize="small" />
          </Stack>
          <Typography variant="body2" sx={{ fontSize: 12 }}>
            {completed} of {tasks.length} tasks complete
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Box sx={{ width: 88, height: 88, flexShrink: 0 }}>
            <CareerCharacter future />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontSize: 12 }}>
              Target direction
            </Typography>
            <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
              {aliceDemo ? 'Principal Architect' : (nextGoal?.title ?? 'Your next milestone')}
            </Typography>
            <Typography variant="body2">
              {aliceDemo ? 'Level 5 · Aspiration' : 'Build toward it, one task at a time'}
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
