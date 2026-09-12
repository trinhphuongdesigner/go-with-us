'use client';

import * as React from 'react';
import NextLink from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@/components/ui/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import PageSkeleton from '@/components/ui/PageSkeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api/client';
import {
  getCompetencyProfile,
  type CompetencyProfile,
} from '@/lib/api/competencyProfileApi';
import { uploadAvatar } from '@/lib/api/usersApi';
import { colorTokens, radiusTokens, shadowTokens } from '@/theme/theme';
import ProfileTimeline from './ProfileTimeline';
import PersonalInfoTab from './PersonalInfoTab';
import SkillsTab from './SkillsTab';
import CertificationsTab from './CertificationsTab';
import ProjectsTab from './ProjectsTab';
import AwardsTab from './AwardsTab';
import CareerPassportTab from './CareerPassportTab';
import ActivityTab from './ActivityTab';
import DevelopmentPlanTab from './DevelopmentPlanTab';

// 'passport' is a stable slug other pages deep-link to (e.g.
// /profile?tab=passport) since Career Passport and My Skills moved in here
// from their own nav entries — index-based routing would break if the tab
// order ever changes.
const TABS = [
  { key: 'personal-info', label: 'Thông tin cá nhân' },
  { key: 'timeline', label: 'Dòng thời gian' },
  { key: 'skills', label: 'Kỹ năng' },
  { key: 'projects', label: 'Dự án' },
  { key: 'certifications', label: 'Chứng chỉ' },
  { key: 'awards', label: 'Thành tích' },
  { key: 'activity', label: 'Nhật ký hoạt động' },
  { key: 'development-plan', label: 'Lộ trình phát triển' },
  { key: 'passport', label: 'Hộ chiếu nghề nghiệp' },
] as const;

/**
 * M1 — the competency profile screen. Everything the idea doc calls "hồ sơ
 * năng lực toàn diện": identity, skills, and the three self-managed
 * sections, over a merged timeline.
 */
export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton variant="profile" />}>
      <ProfilePageContent />
    </Suspense>
  );
}

/** Split out so useSearchParams (deep-linking ?tab=passport) has the
 * Suspense boundary Next.js requires for a statically prerendered page. */
function ProfilePageContent() {
  const { user, updateCurrentUser } = useAuth();
  const searchParams = useSearchParams();

  const [profile, setProfile] = React.useState<CompetencyProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  const initialTab = TABS.findIndex((t) => t.key === searchParams.get('tab'));
  const [tab, setTab] = React.useState(initialTab >= 0 ? initialTab : 0);

  // Tabs call this after a save/delete to refresh aggregate data (counts,
  // timeline, etc). Only the *first* load shows the full-page skeleton —
  // subsequent calls swap `profile` in place so the header/tab chrome never
  // disappears, just the numbers/lists that actually changed.
  const hasLoadedRef = React.useRef(false);
  const loadProfile = React.useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    setError(null);
    try {
      setProfile(await getCompetencyProfile());
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được hồ sơ');
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

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadingAvatar(true);
    setError(null);
    try {
      const updated = await uploadAvatar(file);
      setProfile((prev) => (prev ? { ...prev, user: { ...prev.user, avatarUrl: updated.avatarUrl } } : prev));
      updateCurrentUser(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được ảnh đại diện');
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <PageContainer>
        <PageHeader
          title="Hồ sơ của tôi"
          subtitle="Hồ sơ năng lực đầy đủ — kỹ năng, dự án, chứng chỉ và thành tích."
          actions={
            <Button
              component={NextLink}
              href="/profile/import"
              variant="contained"
              startIcon={<UploadFileOutlinedIcon />}
            >
              Cập nhật hồ sơ năng lực
            </Button>
          }
        />

        {error ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <PageSkeleton variant="profile" />
        ) : profile ? (
          <>
            <Card sx={{ mb: 3 }}>
              {/* Cover banner — avatar overlaps its bottom edge (offset up),
                  mirroring the reference profile layout without adopting its
                  top tab bar (that part of the page keeps the existing side
                  nav below). */}
              <Box
                sx={{
                  mx: -3,
                  mt: -3,
                  height: 104,
                  borderRadius: `${radiusTokens.md}px ${radiusTokens.md}px 0 0`,
                  background: `linear-gradient(135deg, ${colorTokens.primary} 0%, ${colorTokens.heading} 100%)`,
                }}
              />
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2.5}
                sx={{ alignItems: { sm: 'flex-start' } }}
              >
                <Box sx={{ mt: -6, flexShrink: 0, position: 'relative' }}>
                  <Avatar
                    src={profile.user.avatarUrl ?? undefined}
                    sx={{
                      width: 96,
                      height: 96,
                      bgcolor: colorTokens.primary,
                      color: '#ffffff',
                      border: `4px solid ${colorTokens.surface}`,
                      boxShadow: shadowTokens.card,
                      fontSize: 32,
                    }}
                  >
                    {profile.user.name?.[0]?.toUpperCase() ?? '?'}
                  </Avatar>
                  <IconButton
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    sx={{
                      position: 'absolute',
                      bottom: -4,
                      right: -4,
                      width: 30,
                      height: 30,
                      bgcolor: colorTokens.surface,
                      border: `1px solid ${colorTokens.border}`,
                      '&:hover': { bgcolor: colorTokens.surface },
                    }}
                    aria-label="Tải ảnh đại diện mới"
                  >
                    {uploadingAvatar ? (
                      <CircularProgress size={14} />
                    ) : (
                      <PhotoCameraOutlinedIcon fontSize="small" />
                    )}
                  </IconButton>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={handleAvatarChange}
                  />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0, pt: { sm: 2 } }}>
                  <Typography variant="h2">{profile.user.name}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.25 }}>
                    {currentEmployment
                      ? `${currentEmployment.jobTitle}${currentEmployment.level ? ` · ${currentEmployment.level}` : ''} @ ${currentEmployment.company.name}`
                      : (profile.user.jobTitle ??
                        profile.user.company?.name ??
                        'Chưa có vị trí hiện tại')}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.25 }}>
                    {profile.user.email}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={{ xs: 2, sm: 3 }} sx={{ pr: 1, pt: { sm: 2 }, flexWrap: 'wrap' }}>
                  <Stat label="Kỹ năng" value={profile.skills.length} />
                  <Stat label="Dự án" value={profile.projects.length} />
                  <Stat
                    label="Chứng chỉ"
                    value={profile.certifications.length}
                  />
                  <Stat label="Thành tích" value={profile.awards.length} />
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
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                divider={
                  <Divider
                    orientation="vertical"
                    flexItem
                    sx={{ display: { xs: 'none', md: 'block' } }}
                  />
                }
                sx={{ alignItems: 'stretch' }}
              >
                <Box
                  component="nav"
                  aria-label="Mục hồ sơ"
                  sx={{
                    width: { xs: '100%', md: 220 },
                    flexShrink: 0,
                    borderBottom: { xs: `1px solid ${colorTokens.border}`, md: 'none' },
                    pb: { xs: 1.5, md: 0 },
                    mb: { xs: 1.5, md: 0 },
                    pr: { md: 2.5 },
                  }}
                >
                  <List
                    sx={{
                      display: 'flex',
                      flexDirection: { xs: 'row', md: 'column' },
                      gap: 0.5,
                      overflowX: { xs: 'auto', md: 'visible' },
                    }}
                  >
                    {TABS.map((t, index) => (
                      <ListItemButton
                        key={t.key}
                        selected={tab === index}
                        onClick={() => setTab(index)}
                        sx={{
                          borderRadius: `${radiusTokens.md}px`,
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                          color: colorTokens.secondary,
                          '&.Mui-selected': {
                            backgroundColor: colorTokens.primarySubtle,
                            color: colorTokens.primary,
                            '&:hover': { backgroundColor: colorTokens.primarySubtle },
                          },
                        }}
                      >
                        <ListItemText
                          primary={t.label}
                          slotProps={{ primary: { sx: { fontSize: 14.5, fontWeight: 700 } } }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Box>

                <Box sx={{ flex: 1, minWidth: 0, pl: { md: 2.5 } }}>
                  {tab === 0 ? (
                    <PersonalInfoTab employments={profile.employments} />
                  ) : null}
                  {tab === 1 ? (
                    <ProfileTimeline entries={profile.timeline} />
                  ) : null}
                  {tab === 2 ? <SkillsTab onChanged={loadProfile} /> : null}
                  {tab === 3 ? (
                    <ProjectsTab
                      projects={profile.projects}
                      employments={profile.employments}
                      onChanged={loadProfile}
                    />
                  ) : null}
                  {tab === 4 ? (
                    <CertificationsTab
                      certifications={profile.certifications}
                      employments={profile.employments}
                      onChanged={loadProfile}
                    />
                  ) : null}
                  {tab === 5 ? (
                    <AwardsTab
                      awards={profile.awards}
                      employments={profile.employments}
                      onChanged={loadProfile}
                    />
                  ) : null}
                  {tab === 6 ? <ActivityTab /> : null}
                  {tab === 7 ? <DevelopmentPlanTab /> : null}
                  {tab === 8 ? <CareerPassportTab /> : null}
                </Box>
              </Stack>
            </Card>
          </>
        ) : null}
    </PageContainer>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="h2" sx={{ fontSize: 28, lineHeight: 1.2 }}>
        {value}
      </Typography>
      <Typography variant="caption">{label}</Typography>
    </Box>
  );
}
