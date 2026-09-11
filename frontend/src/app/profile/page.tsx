'use client';

import * as React from 'react';
import NextLink from 'next/link';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api/client';
import {
  getCompetencyProfile,
  type CompetencyProfile,
} from '@/lib/api/competencyProfileApi';
import { colorTokens } from '@/theme/theme';
import ProfileTimeline from './ProfileTimeline';
import CertificationsTab from './CertificationsTab';
import ProjectsTab from './ProjectsTab';
import AwardsTab from './AwardsTab';

const TABS = ['Timeline', 'Projects', 'Certifications', 'Awards'] as const;

/**
 * M1 — the competency profile screen. Everything the idea doc calls "hồ sơ
 * năng lực toàn diện": identity, skills, and the three self-managed
 * sections, over a merged timeline.
 */
export default function ProfilePage() {
  const { user } = useAuth();

  const [profile, setProfile] = React.useState<CompetencyProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState(0);

  const loadProfile = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await getCompetencyProfile());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!user) return;
    // Wrapped rather than called directly so the initial fetch's setState
    // lands after the effect, not synchronously inside it.
    void (async () => {
      await loadProfile();
    })();
  }, [user, loadProfile]);

  const currentEmployment = profile?.employments.find(
    (e) => e.status === 'ACTIVE',
  );

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="My Profile"
          subtitle="Your full competency record — skills, projects, certifications and achievements."
          actions={
            <>
              <Button
                component={NextLink}
                href="/career-passport"
                variant="outlined"
                startIcon={<BadgeOutlinedIcon />}
              >
                Career passport
              </Button>
              <Button
                component={NextLink}
                href="/profile/import"
                variant="contained"
                startIcon={<UploadFileOutlinedIcon />}
              >
                Import CV
              </Button>
            </>
          }
        />

        {error ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        ) : null}

        {loading ? <LinearProgress sx={{ mb: 3 }} /> : null}

        {profile ? (
          <>
            <Card sx={{ mb: 3 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2.5}
                sx={{ alignItems: { sm: 'center' } }}
              >
                <Avatar
                  src={profile.user.avatarUrl ?? undefined}
                  sx={{ width: 64, height: 64, bgcolor: colorTokens.accent }}
                >
                  {profile.user.name?.[0]?.toUpperCase() ?? '?'}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="h2">{profile.user.name}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.25 }}>
                    {currentEmployment
                      ? `${currentEmployment.jobTitle}${currentEmployment.level ? ` · ${currentEmployment.level}` : ''} @ ${currentEmployment.company.name}`
                      : (profile.user.jobTitle ??
                        profile.user.company?.name ??
                        'No current position on record')}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: 12.5, mt: 0.25 }}>
                    {profile.user.email}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={3} sx={{ pr: 1 }}>
                  <Stat label="Skills" value={profile.skills.length} />
                  <Stat label="Projects" value={profile.projects.length} />
                  <Stat
                    label="Certificates"
                    value={profile.certifications.length}
                  />
                  <Stat label="Awards" value={profile.awards.length} />
                </Stack>
              </Stack>

              {profile.skills.length > 0 ? (
                <>
                  <Divider sx={{ my: 2.5 }} />
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ flexWrap: 'wrap', gap: 1 }}
                  >
                    {profile.skills.map((entry) => (
                      <Chip
                        key={entry.id}
                        label={`${entry.skill.name} · ${entry.level}/5`}
                        size="small"
                        variant={entry.level >= 4 ? 'filled' : 'outlined'}
                        color={entry.level >= 4 ? 'primary' : 'default'}
                      />
                    ))}
                  </Stack>
                </>
              ) : null}
            </Card>

            <Card>
              <Tabs
                value={tab}
                onChange={(_, next: number) => setTab(next)}
                sx={{ mb: 2.5, borderBottom: `1px solid ${colorTokens.divider}` }}
              >
                {TABS.map((label) => (
                  <Tab key={label} label={label} />
                ))}
              </Tabs>

              {tab === 0 ? (
                <ProfileTimeline entries={profile.timeline} />
              ) : null}
              {tab === 1 ? (
                <ProjectsTab
                  projects={profile.projects}
                  employments={profile.employments}
                  onChanged={loadProfile}
                />
              ) : null}
              {tab === 2 ? (
                <CertificationsTab
                  certifications={profile.certifications}
                  onChanged={loadProfile}
                />
              ) : null}
              {tab === 3 ? (
                <AwardsTab awards={profile.awards} onChanged={loadProfile} />
              ) : null}
            </Card>
          </>
        ) : null}
      </PageContainer>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="h2" sx={{ lineHeight: 1.2 }}>
        {value}
      </Typography>
      <Typography variant="body2" sx={{ fontSize: 12 }}>
        {label}
      </Typography>
    </Box>
  );
}
