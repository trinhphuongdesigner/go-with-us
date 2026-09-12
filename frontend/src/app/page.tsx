'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import PageContainer from '@/components/layout/PageContainer';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import PageSkeleton from '@/components/ui/PageSkeleton';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Alert from '@mui/material/Alert';
import OpenInFullOutlinedIcon from '@mui/icons-material/OpenInFullOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import RadioButtonUncheckedOutlinedIcon from '@mui/icons-material/RadioButtonUncheckedOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCompetencyProfile,
  type CompetencyProfile,
  type EmployeeSkillEntry,
  type TimelineEntry,
} from '@/lib/api/competencyProfileApi';
import {
  getMyPlan,
  listRoadmaps,
  type DevelopmentMilestone,
} from '@/lib/api/developmentPlansApi';
import { colorTokens, radiusTokens, shadowTokens } from '@/theme/theme';
import RoadmapSummaryCard from './profile/RoadmapSummaryCard';

/**
 * Dashboard tổng quan cho nhân sự — gộp lại các mảnh dữ liệu đã có ở
 * `/profile` (thông tin cá nhân, kỹ năng, dòng thời gian, lộ trình) thành
 * một cái nhìn nhanh, kèm các tín hiệu thật rút ra từ lộ trình hiện tại
 * (việc cần làm, việc trễ hạn, cột mốc đã hoàn thành). Không có endpoint
 * riêng — chỉ gọi lại các API sẵn có (`getCompetencyProfile`, `getMyPlan`,
 * `listRoadmaps`), mỗi cái đều đã được EMPLOYEE dùng được từ trước; mọi chỉ
 * số dưới đây là derive ở client, không có state/API mới.
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [profile, setProfile] = React.useState<CompetencyProfile | null>(null);
  const [milestones, setMilestones] = React.useState<DevelopmentMilestone[]>([]);
  const [timelineExpanded, setTimelineExpanded] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;

    setLoading(true);
    setError(null);

    Promise.all([getCompetencyProfile(), getMyPlan(), listRoadmaps('WORK')])
      .then(([prof, , roadmaps]) => {
        setProfile(prof);
        setMilestones(roadmaps[0]?.milestones ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Không tải được trang chủ'))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <PageContainer>
        <PageSkeleton variant="cards" rows={4} />
      </PageContainer>
    );
  }

  const skills = [...(profile?.skills ?? [])].sort((a, b) => b.level - a.level);
  const timeline = profile?.timeline ?? [];
  const sortedMilestones = [...milestones].sort((a, b) => a.order - b.order);
  const goalTitle = sortedMilestones.length > 0 ? sortedMilestones[sortedMilestones.length - 1].title : null;
  const currentIndex = sortedMilestones.length > 0
    ? (() => {
        const idx = sortedMilestones.findIndex((m) => m.status !== 'DONE');
        return idx === -1 ? sortedMilestones.length - 1 : idx;
      })()
    : -1;
  const currentMilestone = currentIndex >= 0 ? sortedMilestones[currentIndex] : null;

  const now = Date.now();
  const overdueMilestones = sortedMilestones.filter(
    (m) => m.status !== 'DONE' && m.dueDate && new Date(m.dueDate).getTime() < now,
  );
  const overdueTaskCount = overdueMilestones.reduce(
    (sum, m) => sum + m.tasks.filter((t) => !t.done).length,
    0,
  );
  const upcomingTasks = currentMilestone ? currentMilestone.tasks.filter((t) => !t.done) : [];
  const doneMilestones = [...sortedMilestones]
    .filter((m) => m.status === 'DONE')
    .sort((a, b) => b.order - a.order)
    .slice(0, 5);
  const milestoneCompletionPct =
    sortedMilestones.length > 0
      ? Math.round((sortedMilestones.filter((m) => m.status === 'DONE').length / sortedMilestones.length) * 100)
      : null;

  return (
    <PageContainer>
      {error ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      ) : null}

      <DashboardHero
        name={user?.name ?? ''}
        avatarUrl={profile?.user.avatarUrl ?? null}
        skillCount={skills.length}
        milestoneCompletionPct={milestoneCompletionPct}
        pendingTaskCount={upcomingTasks.length}
        overdueTaskCount={overdueTaskCount}
      />

      <Stack spacing={3} sx={{ mt: 3 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' },
            gap: 3,
            alignItems: 'stretch',
          }}
        >
          {/* Cột trái: kỹ năng — phân bố level + chip, xếp lần lượt. */}
          <Card
            title="Kỹ năng"
            actions={
              <Button variant="text" size="sm" onClick={() => router.push('/profile?tab=skills')}>
                Xem tất cả
              </Button>
            }
          >
            {skills.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Chưa có kỹ năng nào — thêm ở tab Kỹ năng.
              </Typography>
            ) : (
              <Stack spacing={2.5}>
                <SkillLevelDistribution skills={skills} />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {skills.slice(0, 8).map((entry) => (
                    <Chip
                      key={entry.id}
                      label={`${entry.skill.name} · ${entry.level}/5`}
                      size="small"
                      variant={entry.level >= 4 ? 'filled' : 'outlined'}
                      color={entry.level >= 4 ? 'primary' : 'default'}
                    />
                  ))}
                </Stack>
              </Stack>
            )}
          </Card>

          {/* Cột phải: dòng thời gian, cao bằng cột trái — scroll nội bộ nếu dài, nút mở rộng để xem toàn màn hình. */}
          <Card
            title="Dòng thời gian"
            actions={
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                <Tooltip title="Xem toàn màn hình">
                  <IconButton size="small" onClick={() => setTimelineExpanded(true)}>
                    <OpenInFullOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Button variant="text" size="sm" onClick={() => router.push('/profile?tab=timeline')}>
                  Xem tất cả
                </Button>
              </Stack>
            }
          >
            <TimelineList entries={timeline} maxHeight={420} />
          </Card>
        </Box>

        <Card
          title="Lộ trình phát triển"
          actions={
            sortedMilestones.length > 0 ? (
              <Button variant="text" size="sm" onClick={() => router.push('/profile?tab=development-plan')}>
                Xem toàn bộ
              </Button>
            ) : undefined
          }
        >
          {sortedMilestones.length === 0 ? (
            <Stack spacing={2} sx={{ alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                Chưa có lộ trình phát triển.
              </Typography>
              <Button variant="outlined" size="sm" onClick={() => router.push('/profile?tab=development-plan')}>
                Tạo lộ trình
              </Button>
            </Stack>
          ) : (
            <Stack spacing={3}>
              <RoadmapSummaryCard
                goalTitle={goalTitle}
                milestones={sortedMilestones}
                currentIndex={currentIndex}
                compact={false}
                onViewAll={() => router.push('/profile?tab=development-plan')}
              />

              {overdueMilestones.length > 0 ? (
                <OverdueMilestonesAlert milestones={overdueMilestones} now={now} />
              ) : null}

              {upcomingTasks.length > 0 ? (
                <UpcomingTasksList milestoneTitle={currentMilestone!.title} tasks={upcomingTasks} />
              ) : null}

              {doneMilestones.length > 0 ? <CompletedMilestonesRow milestones={doneMilestones} /> : null}
            </Stack>
          )}
        </Card>
      </Stack>

      <Dialog
        open={timelineExpanded}
        onClose={() => setTimelineExpanded(false)}
        title="Dòng thời gian"
        maxWidth="md"
        actions={
          <Button variant="text" onClick={() => setTimelineExpanded(false)}>
            Đóng
          </Button>
        }
      >
        <TimelineList entries={timeline} maxHeight="70vh" />
      </Dialog>
    </PageContainer>
  );
}

/**
 * Signature element của trang — banner gradient đậm hơn mức bình thường
 * (nhưng vẫn dùng đúng colorTokens gốc), gộp lời chào + nhận diện cá nhân
 * với các tín hiệu thật (kỹ năng, tiến độ lộ trình, việc chờ/trễ). Đây là
 * khối duy nhất trong app kết hợp cả hai, nên đặt lên đầu trang chủ.
 */
function DashboardHero({
  name,
  avatarUrl,
  skillCount,
  milestoneCompletionPct,
  pendingTaskCount,
  overdueTaskCount,
}: {
  name: string;
  avatarUrl: string | null;
  skillCount: number;
  milestoneCompletionPct: number | null;
  pendingTaskCount: number;
  overdueTaskCount: number;
}) {
  const statusText =
    overdueTaskCount > 0
      ? `Có ${overdueTaskCount} việc trễ hạn cần xử lý`
      : pendingTaskCount > 0
        ? `${pendingTaskCount} việc đang chờ ở bước hiện tại`
        : 'Chưa có việc nào trễ hạn';

  return (
    <Box
      sx={{
        p: { xs: 3, md: 4 },
        borderRadius: `${radiusTokens.lg}px`,
        background: `linear-gradient(135deg, ${colorTokens.primary} 0%, ${colorTokens.heading} 100%)`,
        color: '#ffffff',
        boxShadow: shadowTokens.md,
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} sx={{ alignItems: { sm: 'center' }, mb: 3 }}>
        <Avatar src={avatarUrl ?? undefined} sx={{ width: 72, height: 72, fontSize: 28, border: '3px solid rgba(255,255,255,0.35)' }}>
          {name?.[0]?.toUpperCase() ?? '?'}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: { xs: 24, md: 28 }, fontWeight: 600, lineHeight: 1.2 }}>
            Chào mừng trở lại{name ? `, ${name}` : ''}
          </Typography>
          <Typography sx={{ opacity: 0.85, mt: 0.5 }}>{statusText}</Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={{ xs: 2, sm: 4 }} sx={{ flexWrap: 'wrap', rowGap: 2 }}>
        <HeroStat label="Kỹ năng" value={skillCount} />
        <HeroStat
          label="Cột mốc hoàn thành"
          value={milestoneCompletionPct !== null ? `${milestoneCompletionPct}%` : '—'}
        />
        <HeroStat label="Việc đang chờ" value={pendingTaskCount} />
        <HeroStat
          label="Việc trễ hạn"
          value={overdueTaskCount}
          warn={overdueTaskCount > 0}
        />
      </Stack>
    </Box>
  );
}

function HeroStat({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: 30,
          fontWeight: 700,
          lineHeight: 1.1,
          color: warn ? '#FFD9CC' : '#ffffff',
        }}
      >
        {value}
      </Typography>
      <Typography sx={{ fontSize: 13, opacity: 0.8 }}>{label}</Typography>
    </Box>
  );
}

/** Horizontal bar per skill level (1-5) — how many skills sit at each level. No chart library needed for five bars. */
function SkillLevelDistribution({ skills }: { skills: EmployeeSkillEntry[] }) {
  const max = Math.max(...[1, 2, 3, 4, 5].map((lvl) => skills.filter((s) => s.level === lvl).length), 1);

  return (
    <Stack spacing={0.75}>
      {[5, 4, 3, 2, 1].map((lvl) => {
        const count = skills.filter((s) => s.level === lvl).length;
        return (
          <Stack key={lvl} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="caption" sx={{ width: 44, flexShrink: 0, color: colorTokens.secondary }}>
              Cấp {lvl}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={(count / max) * 100}
              sx={{
                flex: 1,
                height: 8,
                borderRadius: 4,
                bgcolor: colorTokens.muted,
                '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: lvl >= 4 ? colorTokens.primary : colorTokens.selectedBorder },
              }}
            />
            <Typography variant="caption" sx={{ width: 18, textAlign: 'right', color: colorTokens.secondary }}>
              {count}
            </Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}

/** Tasks still open under the milestone the person is currently on. */
function UpcomingTasksList({
  milestoneTitle,
  tasks,
}: {
  milestoneTitle: string;
  tasks: DevelopmentMilestone['tasks'];
}) {
  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
        Cần làm tiếp · {milestoneTitle}
      </Typography>
      <Stack spacing={1}>
        {tasks.slice(0, 5).map((task) => (
          <Stack key={task.id} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <RadioButtonUncheckedOutlinedIcon sx={{ fontSize: 18, color: colorTokens.primary, mt: '2px' }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2">{task.title}</Typography>
              {task.metric ? (
                <Typography variant="caption" color="text.secondary">
                  {task.metric}
                </Typography>
              ) : null}
            </Box>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

/** Milestones past their dueDate and not yet DONE — a real warning, not decoration, so it renders as an Alert rather than a tinted label. */
function OverdueMilestonesAlert({
  milestones,
  now,
}: {
  milestones: DevelopmentMilestone[];
  now: number;
}) {
  return (
    <Alert severity="warning" icon={<WarningAmberOutlinedIcon fontSize="small" />}>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
        {milestones.length} cột mốc đang trễ hạn
      </Typography>
      <Stack spacing={0.5}>
        {milestones.map((m) => {
          const daysLate = Math.max(1, Math.round((now - new Date(m.dueDate!).getTime()) / 86_400_000));
          const openTasks = m.tasks.filter((t) => !t.done).length;
          return (
            <Typography key={m.id} variant="body2">
              {m.title} — trễ {daysLate} ngày{openTasks > 0 ? `, còn ${openTasks} việc chưa xong` : ''}
            </Typography>
          );
        })}
      </Stack>
    </Alert>
  );
}

/** Recently completed milestones, worth calling out — silently omitted when there's nothing to praise yet. */
function CompletedMilestonesRow({ milestones }: { milestones: DevelopmentMilestone[] }) {
  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
        Đã hoàn thành tốt
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
        {milestones.map((m) => (
          <Chip
            key={m.id}
            icon={<CheckCircleOutlinedIcon fontSize="small" />}
            label={m.title}
            size="small"
            color="primary"
          />
        ))}
      </Stack>
    </Box>
  );
}

/** Compact vertical timeline list — used both inline (fixed max height,
 * scrolls internally) and inside the "xem toàn màn hình" Dialog (tall
 * viewport-relative max height). */
function TimelineList({
  entries,
  maxHeight,
}: {
  entries: TimelineEntry[];
  maxHeight: number | string;
}) {
  if (entries.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Chưa có hoạt động nào.
      </Typography>
    );
  }

  return (
    <Stack
      spacing={1.5}
      divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}
      sx={{ maxHeight, overflowY: 'auto', pr: 0.5 }}
    >
      {entries.map((entry) => (
        <Box key={entry.id}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {entry.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {new Date(entry.date).toLocaleDateString('vi-VN', { year: 'numeric', month: 'short', day: 'numeric' })}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
