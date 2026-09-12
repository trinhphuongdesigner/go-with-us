'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import Button from '@/components/ui/Button';
import { colorTokens, radiusTokens } from '@/theme/theme';
import type {
  DevelopmentMilestone,
  LifeCategory,
  RoadmapDisplaySettings,
} from '@/lib/api/developmentPlansApi';
import RoadmapStaircase from './RoadmapStaircase';
import RoadmapDiagram from './RoadmapDiagram';
import type { RoadmapCharacter } from './roadmapCharacters';

export interface RoadmapDraftTask {
  id: string;
  title: string;
  metric: string;
  done: boolean;
}

export interface RoadmapDraftMilestone {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  tasks: RoadmapDraftTask[];
}

export interface CustomizeSaveData {
  category: LifeCategory;
  durationWeeks?: number;
  hoursPerWeek?: number;
  milestones: RoadmapDraftMilestone[];
  settings: RoadmapDisplaySettings;
}

interface Props {
  category: LifeCategory;
  durationWeeks: number | null;
  hoursPerWeek: number | null;
  milestones: DevelopmentMilestone[];
  settings: RoadmapDisplaySettings;
  onCancel: () => void;
  onSave: (data: CustomizeSaveData) => Promise<void>;
  saving?: boolean;
}

type CompanionChoice = 'milo' | 'human' | 'none';

function companionFromCharacter(character?: string): CompanionChoice {
  if (character === 'none') return 'none';
  if (character === 'an-welcome') return 'human';
  return 'milo';
}

function characterFromCompanion(choice: CompanionChoice): RoadmapCharacter | 'none' {
  if (choice === 'milo') return 'milo-standing';
  if (choice === 'human') return 'an-welcome';
  return 'none';
}

let tempSeq = 0;
const nextTempId = () => `draft-${Date.now()}-${tempSeq++}`;

/** Full editor shown inline in place of the main card body (no dialog). */
export default function RoadmapCustomizePanel({
  category: initialCategory,
  durationWeeks: initialDurationWeeks,
  hoursPerWeek: initialHoursPerWeek,
  milestones: initialMilestones,
  settings: initialSettings,
  onCancel,
  onSave,
  saving = false,
}: Props) {
  const [category, setCategory] = React.useState<LifeCategory>(initialCategory);
  const [durationWeeks, setDurationWeeks] = React.useState(
    initialDurationWeeks !== null ? String(initialDurationWeeks) : '',
  );
  const [hoursPerWeek, setHoursPerWeek] = React.useState(
    initialHoursPerWeek !== null ? String(initialHoursPerWeek) : '',
  );
  const [drafts, setDrafts] = React.useState<RoadmapDraftMilestone[]>(() =>
    [...initialMilestones]
      .sort((a, b) => a.order - b.order)
      .map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description ?? '',
        dueDate: m.dueDate ? m.dueDate.slice(0, 10) : '',
        tasks: [...m.tasks]
          .sort((a, b) => a.order - b.order)
          .map((t) => ({ id: t.id, title: t.title, metric: t.metric ?? '', done: t.done })),
      })),
  );
  const [settings, setSettings] = React.useState<RoadmapDisplaySettings>(initialSettings);
  const [expandedId, setExpandedId] = React.useState<string | null>(drafts[0]?.id ?? null);
  const dragIdRef = React.useRef<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);

  const previewMilestones: DevelopmentMilestone[] = drafts.map((d, i) => ({
    id: d.id,
    roadmapId: '',
    title: d.title || `Cột mốc ${i + 1}`,
    description: d.description || null,
    dueDate: d.dueDate || null,
    status: 'NOT_STARTED',
    order: i,
    tasks: [],
  }));

  const move = (idx: number, dir: -1 | 1) => {
    setDrafts((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const reorderTo = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    setDrafts((prev) => {
      const from = prev.findIndex((d) => d.id === draggedId);
      const to = prev.findIndex((d) => d.id === targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const updateDraft = (id: string, patch: Partial<RoadmapDraftMilestone>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const removeDraft = (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  const addDraft = () => {
    const draft: RoadmapDraftMilestone = { id: nextTempId(), title: '', description: '', dueDate: '', tasks: [] };
    setDrafts((prev) => [...prev, draft]);
    setExpandedId(draft.id);
  };

  const addTask = (milestoneId: string) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === milestoneId
          ? { ...d, tasks: [...d.tasks, { id: nextTempId(), title: '', metric: '', done: false }] }
          : d,
      ),
    );
  };

  const updateTask = (milestoneId: string, taskId: string, patch: Partial<RoadmapDraftTask>) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === milestoneId ? { ...d, tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) } : d,
      ),
    );
  };

  const removeTask = (milestoneId: string, taskId: string) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === milestoneId ? { ...d, tasks: d.tasks.filter((t) => t.id !== taskId) } : d)),
    );
  };

  const handleSave = async () => {
    await onSave({
      category,
      durationWeeks: durationWeeks ? Number(durationWeeks) : undefined,
      hoursPerWeek: hoursPerWeek ? Number(hoursPerWeek) : undefined,
      milestones: drafts
        .filter((d) => d.title.trim().length > 0)
        .map((d) => ({ ...d, tasks: d.tasks.filter((t) => t.title.trim().length > 0) })),
      settings,
    });
  };

  const companion = companionFromCharacter(settings.character);
  const paceChip = [
    durationWeeks ? `${durationWeeks} tuần` : null,
    hoursPerWeek ? `${hoursPerWeek} giờ/tuần` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Box>
      <Typography sx={{ fontWeight: 600, fontSize: 16, mb: 2 }}>Tùy chỉnh lộ trình</Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' }, gap: 3 }}>
        {/* Cột trái: chỉnh nội dung */}
        <Stack spacing={2}>
          <Box>
            <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>Loại mục tiêu</Typography>
            <Stack direction="row" spacing={1}>
              <Button variant={category === 'WORK' ? 'contained' : 'outlined'} size="sm" onClick={() => setCategory('WORK')}>
                Công việc
              </Button>
              <Button variant={category === 'PERSONAL' ? 'contained' : 'outlined'} size="sm" onClick={() => setCategory('PERSONAL')}>
                Cá nhân
              </Button>
            </Stack>
          </Box>

          <Stack direction="row" spacing={2}>
            <TextField
              label="Thời lượng (tuần)"
              type="number"
              size="small"
              fullWidth
              value={durationWeeks}
              onChange={(e) => setDurationWeeks(e.target.value)}
              slotProps={{ htmlInput: { min: 1 } }}
            />
            <TextField
              label="Thời gian mỗi tuần (giờ)"
              type="number"
              size="small"
              fullWidth
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(e.target.value)}
              slotProps={{ htmlInput: { min: 1 } }}
            />
          </Stack>

          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Các cột mốc</Typography>
            <Stack spacing={1}>
              {drafts.map((d, idx) => {
                const expanded = expandedId === d.id;
                const isDragOver = dragOverId === d.id;
                return (
                  <Box
                    key={d.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverId !== d.id) setDragOverId(d.id);
                    }}
                    onDragLeave={() => setDragOverId((prev) => (prev === d.id ? null : prev))}
                    onDrop={(e) => {
                      e.preventDefault();
                      const draggedId = dragIdRef.current;
                      setDragOverId(null);
                      if (draggedId) reorderTo(draggedId, d.id);
                    }}
                    sx={{
                      borderRadius: `${radiusTokens.sm}px`,
                      border: `1px solid ${isDragOver ? colorTokens.primary : colorTokens.border}`,
                      bgcolor: colorTokens.surface,
                      overflow: 'hidden',
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', px: 1, py: 0.75, cursor: 'pointer' }}
                      onClick={() => setExpandedId(expanded ? null : d.id)}
                    >
                      <Box
                        draggable
                        onClick={(e) => e.stopPropagation()}
                        onDragStart={(e) => {
                          dragIdRef.current = d.id;
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          dragIdRef.current = null;
                          setDragOverId(null);
                        }}
                        sx={{ display: 'flex', alignItems: 'center', cursor: 'grab', color: colorTokens.secondary }}
                        title="Kéo để sắp xếp"
                      >
                        <DragIndicatorRoundedIcon fontSize="small" />
                      </Box>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: colorTokens.primary, minWidth: 22 }}>
                        {String(idx + 1).padStart(2, '0')}
                      </Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.title || 'Cột mốc chưa đặt tên'}
                      </Typography>
                      <Stack direction="row" onClick={(e) => e.stopPropagation()}>
                        <IconButton size="small" disabled={idx === 0} onClick={() => move(idx, -1)}>
                          <ArrowUpwardRoundedIcon fontSize="inherit" />
                        </IconButton>
                        <IconButton size="small" disabled={idx === drafts.length - 1} onClick={() => move(idx, 1)}>
                          <ArrowDownwardRoundedIcon fontSize="inherit" />
                        </IconButton>
                      </Stack>
                      <IconButton size="small" onClick={() => setExpandedId(expanded ? null : d.id)}>
                        {expanded ? <ExpandLessRoundedIcon fontSize="small" /> : <ExpandMoreRoundedIcon fontSize="small" />}
                      </IconButton>
                    </Stack>

                    {expanded && (
                      <Stack spacing={1.25} sx={{ px: 1.5, pb: 1.5 }}>
                        <TextField
                          size="small"
                          label="Tên cột mốc"
                          value={d.title}
                          onChange={(e) => updateDraft(d.id, { title: e.target.value })}
                        />
                        <TextField
                          size="small"
                          label="Kết quả mong đợi"
                          multiline
                          minRows={2}
                          value={d.description}
                          onChange={(e) => updateDraft(d.id, { description: e.target.value })}
                        />
                        <TextField
                          size="small"
                          type="date"
                          label="Hạn"
                          value={d.dueDate}
                          onChange={(e) => updateDraft(d.id, { dueDate: e.target.value })}
                          slotProps={{ inputLabel: { shrink: true } }}
                        />
                        <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
                          Đầu việc
                        </Typography>
                        <Stack spacing={1}>
                          {d.tasks.map((t) => (
                            <Stack key={t.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                              <TextField
                                size="small"
                                placeholder="Tên đầu việc"
                                value={t.title}
                                onChange={(e) => updateTask(d.id, t.id, { title: e.target.value })}
                                sx={{ flex: 2 }}
                              />
                              <TextField
                                size="small"
                                placeholder="Đo lường (vd: 3 lần/tuần)"
                                value={t.metric}
                                onChange={(e) => updateTask(d.id, t.id, { metric: e.target.value })}
                                sx={{ flex: 1 }}
                              />
                              <IconButton size="small" onClick={() => removeTask(d.id, t.id)}>
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          ))}
                        </Stack>
                        <Button
                          variant="outlined"
                          size="sm"
                          startIcon={<AddIcon fontSize="small" />}
                          onClick={() => addTask(d.id)}
                        >
                          Thêm đầu việc
                        </Button>

                        <Stack direction="row" sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                          <Button
                            variant="text"
                            size="sm"
                            startIcon={<DeleteOutlineIcon fontSize="small" />}
                            onClick={() => removeDraft(d.id)}
                          >
                            Xóa cột mốc
                          </Button>
                        </Stack>
                      </Stack>
                    )}
                  </Box>
                );
              })}
            </Stack>
            <Button variant="outlined" size="sm" startIcon={<AddIcon fontSize="small" />} onClick={addDraft} sx={{ mt: 1.5 }}>
              Thêm cột mốc
            </Button>
          </Box>
        </Stack>

        {/* Cột phải: trực quan hoá + cách hiển thị */}
        <Stack spacing={2}>
          <Box
            sx={{
              p: 2,
              borderRadius: `${radiusTokens.md}px`,
              border: `1px solid ${colorTokens.border}`,
              bgcolor: colorTokens.canvas,
            }}
          >
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 13 }}>Xem trước lộ trình</Typography>
              {paceChip && <Chip label={paceChip} size="small" sx={{ bgcolor: colorTokens.primarySubtle, fontSize: 11 }} />}
            </Stack>
            {settings.viewMode === 'diagram' ? (
              <RoadmapDiagram
                milestones={previewMilestones}
                selectedIndex={-1}
                onSelect={() => undefined}
                currentIndex={0}
              />
            ) : (
              <RoadmapStaircase
                milestones={previewMilestones}
                selectedIndex={-1}
                onSelect={() => undefined}
                currentIndex={0}
                character={characterFromCompanion(companion)}
                compact
              />
            )}
            {settings.viewMode !== 'diagram' && companion !== 'none' && (
              <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 1, color: colorTokens.secondary }}>
                {companion === 'milo' ? 'Milo' : 'Nhân vật'} đồng hành cùng bạn
              </Typography>
            )}
          </Box>

          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Cách hiển thị</Typography>

            <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>Chế độ xem mặc định</Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
              <Button
                size="sm"
                variant={settings.viewMode !== 'diagram' ? 'contained' : 'outlined'}
                onClick={() => setSettings((s) => ({ ...s, viewMode: 'stair' }))}
              >
                Bậc thang
              </Button>
              <Button
                size="sm"
                variant={settings.viewMode === 'diagram' ? 'contained' : 'outlined'}
                onClick={() => setSettings((s) => ({ ...s, viewMode: 'diagram' }))}
              >
                Sơ đồ
              </Button>
            </Stack>

            <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>Nhân vật đồng hành</Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
              {([
                { key: 'milo', label: 'Milo' },
                { key: 'human', label: 'Nhân vật người' },
                { key: 'none', label: 'Không hiển thị' },
              ] as { key: CompanionChoice; label: string }[]).map((opt) => (
                <Button
                  key={opt.key}
                  size="sm"
                  variant={companion === opt.key ? 'contained' : 'outlined'}
                  onClick={() => setSettings((s) => ({ ...s, character: characterFromCompanion(opt.key) }))}
                >
                  {opt.label}
                </Button>
              ))}
            </Stack>
          </Box>
        </Stack>
      </Box>

      <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
        <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
        </Button>
        <Button variant="outlined" onClick={onCancel} disabled={saving}>
          Hủy thay đổi
        </Button>
      </Stack>
    </Box>
  );
}
