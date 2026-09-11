'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import * as developmentPlansApi from '@/lib/api/developmentPlansApi';
import type {
  DevelopmentMilestone,
  DevelopmentPlan,
  LifeCategory,
  RoadmapDisplaySettings,
} from '@/lib/api/developmentPlansApi';
import { askAssistant } from '@/lib/api/assistantApi';
import { colorTokens } from '@/theme/theme';
import RoadmapSummaryCard from './RoadmapSummaryCard';
import RoadmapStaircase from './RoadmapStaircase';
import RoadmapDetailPanel from './RoadmapDetailPanel';
import RoadmapDiagram from './RoadmapDiagram';
import RoadmapCustomizePanel, { type CustomizeSaveData } from './RoadmapCustomizePanel';
import type { RoadmapCharacter } from './roadmapCharacters';

type ViewMode = 'stair' | 'diagram';

export default function DevelopmentPlanTab() {
  const [plan, setPlan] = React.useState<DevelopmentPlan | null>(null);
  const [category, setCategory] = React.useState<LifeCategory>('WORK');
  const [milestones, setMilestones] = React.useState<DevelopmentMilestone[] | null>(null);
  const [milestonesError, setMilestonesError] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<ViewMode>('stair');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [customizing, setCustomizing] = React.useState(false);
  const [savingSettings, setSavingSettings] = React.useState(false);

  // AI roadmap builder state — the proposal is never self-persisting.
  const [aiInput, setAiInput] = React.useState('');
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [aiProposal, setAiProposal] = React.useState<DevelopmentMilestone[] | null>(null);

  const loadPlan = React.useCallback(
    () =>
      developmentPlansApi.getMyPlan().then((data) => {
        setPlan(data);
        if (data?.displaySettings?.viewMode) setViewMode(data.displaySettings.viewMode);
      }),
    [],
  );

  const loadMilestones = React.useCallback(
    (cat: LifeCategory) =>
      developmentPlansApi
        .listMilestones(cat)
        .then((data) => {
          setMilestones(data);
          setMilestonesError(null);
        })
        .catch((err) => {
          setMilestonesError(err instanceof Error ? err.message : 'Không tải được lộ trình');
        }),
    [],
  );

  React.useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  React.useEffect(() => {
    void loadMilestones(category);
    setAiProposal(null);
    setCustomizing(false);
  }, [category, loadMilestones]);

  const isDraft = aiProposal !== null;
  const activeMilestones = isDraft ? aiProposal! : milestones ?? [];
  const sortedMilestones = React.useMemo(
    () => [...activeMilestones].sort((a, b) => a.order - b.order),
    [activeMilestones],
  );

  const currentIndex = React.useMemo(() => {
    if (sortedMilestones.length === 0) return -1;
    const idx = sortedMilestones.findIndex((m) => m.status !== 'DONE');
    return idx === -1 ? sortedMilestones.length - 1 : idx;
  }, [sortedMilestones]);

  React.useEffect(() => {
    setSelectedIndex(currentIndex >= 0 ? currentIndex : 0);
  }, [category, isDraft, currentIndex]);

  const selectedMilestone = sortedMilestones[selectedIndex];
  const goalTitle = sortedMilestones.length > 0 ? sortedMilestones[sortedMilestones.length - 1].title : null;
  const character = plan?.displaySettings?.character as RoadmapCharacter | undefined;

  // ---- Task edits: persisted milestones hit the API, draft edits stay local ----

  const handleToggleTask = (taskId: string, done: boolean) => {
    if (isDraft) {
      setAiProposal((prev) =>
        prev ? prev.map((m) => ({ ...m, tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, done } : t)) })) : null,
      );
      return;
    }
    setMilestones((prev) =>
      prev ? prev.map((m) => ({ ...m, tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, done } : t)) })) : null,
    );
    void developmentPlansApi.updateTask(taskId, { done }).catch(() => void loadMilestones(category));
  };

  // ---- AI roadmap skill: proposal only, explicit save persists ----

  const handleAskAI = async () => {
    const q = aiInput.trim();
    if (!q || aiBusy) return;

    setAiBusy(true);
    setAiError(null);

    const categoryLabel = category === 'WORK' ? 'Công việc' : 'Cá nhân';
    const paceNote =
      plan?.durationWeeks || plan?.hoursPerWeek
        ? ` Thời lượng mong muốn: ${plan?.durationWeeks ? `${plan.durationWeeks} tuần` : ''}${
            plan?.durationWeeks && plan?.hoursPerWeek ? ', ' : ''
          }${plan?.hoursPerWeek ? `${plan.hoursPerWeek} giờ mỗi tuần` : ''}.`
        : '';
    const enrichedQuestion = `${q}\n\nLoại mục tiêu: ${categoryLabel}.${paceNote} Hãy xây dựng lộ trình với các cột mốc và nhiệm vụ phù hợp.`;

    try {
      const res = await askAssistant({ question: enrichedQuestion, focus: 'ROADMAP' });
      if (res.message.proposalData) {
        const temp: DevelopmentMilestone[] = res.message.proposalData.milestones.map((m, i) => ({
          id: `temp-${i}`,
          planId: '',
          title: m.title,
          description: m.description ?? null,
          dueDate: m.dueDate ?? null,
          status: 'NOT_STARTED',
          category,
          order: i,
          tasks: m.tasks.map((t, ti) => ({
            id: `temp-${i}-${ti}`,
            milestoneId: `temp-${i}`,
            title: t.title,
            metric: t.metric ?? null,
            done: false,
            order: ti,
          })),
        }));
        setAiProposal(temp);
      } else {
        setAiError(res.message.content || 'AI cần thêm thông tin để đưa ra đề xuất.');
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Không tạo được đề xuất');
    } finally {
      setAiBusy(false);
    }
  };

  const handleSaveAiProposal = async () => {
    if (!aiProposal) return;
    try {
      const saved = await developmentPlansApi.saveRoadmap({
        category,
        milestones: aiProposal.map((m) => ({
          title: m.title,
          description: m.description ?? undefined,
          dueDate: m.dueDate ?? undefined,
          tasks: m.tasks.map((t) => ({ title: t.title, metric: t.metric ?? undefined })),
        })),
      });
      setMilestones(saved);
      setAiProposal(null);
      setAiInput('');
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Lưu lộ trình thất bại');
    }
  };

  // ---- Tùy chỉnh lộ trình: inline editor replaces the main card body ----

  const handleSaveCustomize = async (data: CustomizeSaveData) => {
    setSavingSettings(true);
    try {
      const sourceById = new Map(activeMilestones.map((m) => [m.id, m]));
      const saved = await developmentPlansApi.saveRoadmap({
        category: data.category,
        durationWeeks: data.durationWeeks,
        hoursPerWeek: data.hoursPerWeek,
        milestones: data.milestones.map((d) => {
          const original = sourceById.get(d.id);
          return {
            title: d.title,
            description: d.description || undefined,
            dueDate: d.dueDate || undefined,
            tasks: original ? original.tasks.map((t) => ({ title: t.title, metric: t.metric ?? undefined })) : [],
          };
        }),
      });
      const updatedPlan = await developmentPlansApi.updatePlanSettings(data.settings);
      setPlan(updatedPlan);
      if (data.settings.viewMode) setViewMode(data.settings.viewMode);
      setCategory(data.category);
      setMilestones(saved);
      setAiProposal(null);
      setCustomizing(false);
    } catch (e) {
      setMilestonesError(e instanceof Error ? e.message : 'Lưu tùy chỉnh thất bại');
    } finally {
      setSavingSettings(false);
    }
  };

  const viewsRef = React.useRef<HTMLDivElement | null>(null);
  const scrollToViews = () => viewsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const defaultSettings: RoadmapDisplaySettings = {
    character: plan?.displaySettings?.character ?? 'milo-standing',
    viewMode: plan?.displaySettings?.viewMode ?? 'stair',
    costumeColor: plan?.displaySettings?.costumeColor,
    reduceMotion: plan?.displaySettings?.reduceMotion ?? false,
    fontSize: plan?.displaySettings?.fontSize ?? 'md',
  };

  return (
    <Box>
      <Card sx={{ mb: 3, minWidth: 0 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 2 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 600, fontSize: 16 }}>Hành trình của bạn</Typography>
            <Stack direction="row" spacing={1}>
              <Button variant={category === 'WORK' ? 'contained' : 'outlined'} size="sm" onClick={() => setCategory('WORK')}>
                Công việc
              </Button>
              <Button variant={category === 'PERSONAL' ? 'contained' : 'outlined'} size="sm" onClick={() => setCategory('PERSONAL')}>
                Cá nhân
              </Button>
            </Stack>
          </Stack>
          {!customizing && (
            <Button variant="outlined" size="sm" onClick={() => setCustomizing(true)}>
              Tùy chỉnh lộ trình
            </Button>
          )}
        </Stack>

        {milestonesError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setMilestonesError(null)}>
            {milestonesError}
          </Alert>
        )}

        {customizing ? (
          <RoadmapCustomizePanel
            category={category}
            durationWeeks={plan?.durationWeeks ?? null}
            hoursPerWeek={plan?.hoursPerWeek ?? null}
            milestones={activeMilestones}
            settings={defaultSettings}
            onCancel={() => setCustomizing(false)}
            onSave={handleSaveCustomize}
            saving={savingSettings}
          />
        ) : (
          <>
            <Box sx={{ mb: 2.5 }}>
              <RoadmapSummaryCard
                goalTitle={goalTitle}
                milestones={sortedMilestones}
                currentIndex={currentIndex}
                durationWeeks={plan?.durationWeeks}
                hoursPerWeek={plan?.hoursPerWeek}
                character={character}
                isDraft={isDraft}
                onContinue={sortedMilestones.length > 0 ? scrollToViews : undefined}
                onViewAll={sortedMilestones.length > 0 ? scrollToViews : undefined}
              />
            </Box>

            {sortedMilestones.length === 0 ? (
              <Typography variant="body2" sx={{ color: colorTokens.secondary, textAlign: 'center', py: 3 }}>
                Chưa có lộ trình. Dùng trợ lý AI bên dưới để tạo đề xuất đầu tiên.
              </Typography>
            ) : (
              <Box ref={viewsRef}>
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Button variant={viewMode === 'stair' ? 'contained' : 'outlined'} size="sm" onClick={() => setViewMode('stair')}>
                    Bậc thang
                  </Button>
                  <Button variant={viewMode === 'diagram' ? 'contained' : 'outlined'} size="sm" onClick={() => setViewMode('diagram')}>
                    Sơ đồ
                  </Button>
                </Stack>

                {viewMode === 'stair' ? (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.6fr 1fr' }, gap: 2 }}>
                    <RoadmapStaircase
                      milestones={sortedMilestones}
                      selectedIndex={selectedIndex}
                      onSelect={setSelectedIndex}
                      currentIndex={currentIndex}
                      character={character}
                    />
                    <RoadmapDetailPanel
                      milestone={selectedMilestone}
                      index={selectedIndex}
                      onToggleTask={handleToggleTask}
                      onViewDiagram={() => setViewMode('diagram')}
                    />
                  </Box>
                ) : (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.6fr 1fr' }, gap: 2 }}>
                    <RoadmapDiagram
                      milestones={sortedMilestones}
                      selectedIndex={selectedIndex}
                      onSelect={setSelectedIndex}
                      currentIndex={currentIndex}
                    />
                    <RoadmapDetailPanel
                      milestone={selectedMilestone}
                      index={selectedIndex}
                      onToggleTask={handleToggleTask}
                    />
                  </Box>
                )}

                {isDraft && (
                  <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                    <Button variant="contained" onClick={() => void handleSaveAiProposal()}>
                      Lưu lộ trình
                    </Button>
                    <Button variant="outlined" onClick={() => setAiProposal(null)}>
                      Hủy đề xuất
                    </Button>
                  </Stack>
                )}
              </Box>
            )}
          </>
        )}
      </Card>

      <Card title="Dựng lộ trình bằng AI" sx={{ mb: 3, minWidth: 0 }}>
        <Typography variant="body2" sx={{ mb: 1.5, color: colorTokens.secondary }}>
          Nhập mong muốn của bạn cho mục tiêu {category === 'WORK' ? 'Công việc' : 'Cá nhân'} đang chọn. AI sẽ đề xuất
          lộ trình với cột mốc và nhiệm vụ đo lường được — bạn xem, chỉnh sửa rồi mới lưu.
        </Typography>

        <Box component="form" onSubmit={(e) => { e.preventDefault(); void handleAskAI(); }}>
          <TextField
            fullWidth
            multiline
            minRows={4}
            maxRows={10}
            placeholder="Ví dụ: Tôi muốn trở thành Product Manager trong 6 tháng tới. Tôi hiện là Frontend Developer..."
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            disabled={aiBusy}
            sx={{ mb: 1 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" disabled={aiBusy || !aiInput.trim()}>
              {aiBusy ? 'Đang tạo…' : 'Gửi'}
            </Button>
          </Box>
        </Box>

        {aiError && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setAiError(null)}>
            {aiError}
          </Alert>
        )}
      </Card>
    </Box>
  );
}
