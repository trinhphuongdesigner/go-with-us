'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@/components/ui/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api/client';
import {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  ROLE_LABEL,
  initialsOf,
  type DemoAccount,
  type DemoRole,
} from '@/lib/demoAccounts';
import { TONE_COLORS, type StatusTone } from '@/lib/statusColors';
import { colorTokens, radiusTokens, shadowTokens } from '@/theme/theme';

const ROLE_TONE: Record<DemoRole, StatusTone> = {
  SUPER_ADMIN: 'warning',
  COMPANY_ADMIN: 'info',
  EMPLOYEE: 'success',
};

const ACCOUNT_GROUPS: Array<{ label: string; accounts: DemoAccount[] }> = [
  { label: 'Employees', accounts: DEMO_ACCOUNTS.filter((account) => account.role === 'EMPLOYEE') },
  {
    label: 'Company',
    accounts: DEMO_ACCOUNTS.filter((account) => account.role === 'COMPANY_ADMIN'),
  },
  {
    label: 'Platform',
    accounts: DEMO_ACCOUNTS.filter((account) => account.role === 'SUPER_ADMIN'),
  },
];

const PITCH_POINTS = [
  {
    title: 'History that outlives a manager',
    body: 'Projects, skills, and monthly notes stay on the record when a PM leaves mid-cycle.',
  },
  {
    title: 'Two-way assessment',
    body: 'Your company sets the rubric. Employees record their own work — not only top-down scores.',
  },
  {
    title: 'Ask for people in plain language',
    body: '“Who has React and a real-estate domain?” instead of asking a DC lead, then every PM.',
  },
];

function AccountRow({ account, dense }: { account: DemoAccount; dense?: boolean }) {
  const tone = TONE_COLORS[ROLE_TONE[account.role]];

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, width: '100%' }}>
      <Avatar
        sx={{
          width: dense ? 32 : 36,
          height: dense ? 32 : 36,
          fontSize: 12,
          fontWeight: 600,
          bgcolor: tone.bg,
          color: tone.fg,
        }}
      >
        {initialsOf(account.name)}
      </Avatar>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          sx={{
            fontSize: 14,
            fontWeight: 500,
            color: colorTokens.text,
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {account.name}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontSize: 12,
            lineHeight: 1.35,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {account.jobTitle}
          {account.company ? ` · ${account.company}` : ''}
        </Typography>
      </Box>
      <Chip
        label={ROLE_LABEL[account.role]}
        size="small"
        sx={{
          height: 22,
          backgroundColor: tone.bg,
          color: tone.fg,
          flexShrink: 0,
        }}
      />
    </Box>
  );
}

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [loading, user, router]);

  const handleAccountChange = (event: SelectChangeEvent<string>) => {
    setEmail(event.target.value);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Choose an account to continue.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await login(email, DEMO_PASSWORD);
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const selected = DEMO_ACCOUNTS.find((account) => account.email === email);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colorTokens.canvas,
        px: { xs: 2, md: 4 },
        py: { xs: 4, md: 6 },
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 980,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' },
          borderRadius: `${radiusTokens.lg}px`,
          overflow: 'hidden',
          backgroundColor: colorTokens.surface,
          border: `1px solid ${colorTokens.divider}`,
          boxShadow: shadowTokens.lg,
        }}
      >
        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: colorTokens.accent900,
            px: { xs: 3, md: 5 },
            py: { xs: 3.5, md: 5.5 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 4,
            borderRight: { md: `1px solid ${colorTokens.divider}` },
          }}
        >
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              width: 280,
              height: 280,
              borderRadius: '50%',
              border: `1px solid ${colorTokens.accent700}`,
              opacity: 0.35,
              right: -80,
              top: -90,
            }}
          />
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              width: 180,
              height: 180,
              borderRadius: '50%',
              backgroundColor: colorTokens.accent700,
              opacity: 0.12,
              right: 24,
              bottom: -40,
            }}
          />

          <Box sx={{ position: 'relative' }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: `${radiusTokens.md}px`,
                backgroundColor: colorTokens.accent,
                color: colorTokens.accentContrast,
                display: 'grid',
                placeItems: 'center',
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '0.04em',
                mb: 2.5,
              }}
            >
              CM
            </Box>
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: colorTokens.accentInk,
                mb: 1,
              }}
            >
              CareerMate
            </Typography>
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: 26, md: 32 },
                lineHeight: 1.2,
                mb: 1.5,
                maxWidth: 420,
              }}
            >
              The record that stays when people move on.
            </Typography>
            <Typography variant="body2" sx={{ maxWidth: 400, color: colorTokens.text }}>
              HR sees the whole journey. Employees keep their own history. Staffing a project
              takes a sentence, not a chain of pings.
            </Typography>
          </Box>

          <Box
            sx={{
              position: 'relative',
              display: { xs: 'none', md: 'flex' },
              flexDirection: 'column',
              gap: 2.25,
            }}
          >
            {PITCH_POINTS.map((point) => (
              <Box key={point.title} sx={{ display: 'flex', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: colorTokens.accent,
                    mt: 0.7,
                    flexShrink: 0,
                  }}
                />
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 500, color: colorTokens.text }}>
                    {point.title}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.25 }}>
                    {point.body}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        <Box
          sx={{
            px: { xs: 3, md: 5 },
            py: { xs: 3.5, md: 5.5 },
            display: 'flex',
            flexDirection: 'column',
            minHeight: { md: 560 },
          }}
        >
          <Typography variant="h2" sx={{ mb: 0.5 }}>
            Sign in
          </Typography>
          <Typography variant="body2" sx={{ mb: 3 }}>
            Choose a demo account. Password is applied automatically — you do not type it.
          </Typography>

          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}

          <Box
            component="form"
            onSubmit={handleSubmit}
            autoComplete="off"
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <Box>
              <Typography
                component="label"
                htmlFor="demo-account"
                sx={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'rgba(28,40,54,.65)',
                  mb: 0.75,
                }}
              >
                Account
              </Typography>
              <Select
                id="demo-account"
                fullWidth
                displayEmpty
                value={email}
                onChange={handleAccountChange}
                renderValue={(value) => {
                  const account = DEMO_ACCOUNTS.find((item) => item.email === value);
                  if (!account) {
                    return (
                      <Typography variant="body2" sx={{ py: 0.5 }}>
                        Choose who to sign in as
                      </Typography>
                    );
                  }
                  return <AccountRow account={account} dense />;
                }}
                MenuProps={{
                  slotProps: {
                    paper: { sx: { maxHeight: 420 } },
                  },
                }}
                sx={{
                  '& .MuiSelect-select': {
                    display: 'flex',
                    alignItems: 'center',
                    py: 1.35,
                  },
                }}
              >
                {ACCOUNT_GROUPS.flatMap((group, groupIndex) => [
                  <MenuItem
                    key={`label-${group.label}`}
                    disabled
                    sx={{
                      opacity: '1 !important',
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: colorTokens.neutral500,
                      minHeight: 32,
                      mt: groupIndex === 0 ? 0 : 0.5,
                      borderTop:
                        groupIndex === 0 ? 'none' : `1px solid ${colorTokens.divider}`,
                    }}
                  >
                    {group.label}
                  </MenuItem>,
                  ...group.accounts.map((account) => (
                    <MenuItem
                      key={account.email}
                      value={account.email}
                      sx={{ py: 1.25, px: 1.5 }}
                    >
                      <AccountRow account={account} />
                    </MenuItem>
                  )),
                ])}
              </Select>
            </Box>

            {selected ? (
              <Typography variant="body2">{selected.email}</Typography>
            ) : null}

            <Button type="submit" variant="contained" disabled={submitting || !email} fullWidth>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </Box>

          <Typography variant="body2" sx={{ mt: 'auto', pt: 4 }}>
            Demo workspace. Same password for every seeded user.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
