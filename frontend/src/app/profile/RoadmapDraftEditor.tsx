'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { colorTokens } from '@/theme/theme';
import type { RoadmapProposal } from '@/lib/api/assistantApi';
import type { SaveRoadmapPayload } from '@/lib/api/developmentPlansApi';

export type DraftTask = { key: string; selected: boolean; title: string; metric: string };
export type DraftMilestone = {
  key: string;
  selected: boolean;
  title: string;
  description: string;
  dueDate: string;
  tasks: DraftTask[];
};

export const newDraftTask = (): DraftTask => ({
  key: crypto.randomUUID(),
  selected: true,
  title: '',
  metric: '',
});
export const newDraftMilestone = (): DraftMilestone => ({
  key: crypto.randomUUID(),
  selected: true,
  title: '',
  description: '',
  dueDate: '',
  tasks: [newDraftTask()],
});
export const toDraft = (proposal: RoadmapProposal): DraftMilestone[] =>
  proposal.milestones.map((milestone) => ({
    ...newDraftMilestone(),
    title: milestone.title,
    description: milestone.description ?? '',
    dueDate: milestone.dueDate?.slice(0, 10) ?? '',
    tasks: milestone.tasks.map((task) => ({
      ...newDraftTask(),
      title: task.title,
      metric: task.metric ?? '',
    })),
  }));

/** Reject incomplete selected rows instead of silently dropping the user's work. */
export function reviewPayload(draft: DraftMilestone[]): SaveRoadmapPayload {
  const selected = draft.filter((milestone) => milestone.selected);
  if (!selected.length) throw new Error('Select at least one milestone to review.');
  const milestones = selected.map((milestone) => {
    if (!milestone.title.trim()) throw new Error('Give every selected milestone a name.');
    const tasks = milestone.tasks.filter((task) => task.selected);
    if (!tasks.length) throw new Error(`“${milestone.title}” needs at least one selected task.`);
    if (tasks.some((task) => !task.title.trim() || !task.metric.trim())) {
      throw new Error(
        `Add a task name and success metric for every selected task in “${milestone.title}”.`,
      );
    }
    if (
      milestone.dueDate &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(milestone.dueDate) ||
        Number.isNaN(Date.parse(milestone.dueDate)) ||
        new Date(milestone.dueDate).toISOString().slice(0, 10) !== milestone.dueDate)
    ) {
      throw new Error(`Choose a valid deadline for “${milestone.title}”.`);
    }
    return {
      title: milestone.title.trim(),
      description: milestone.description.trim() || undefined,
      dueDate: milestone.dueDate || undefined,
      tasks: tasks.map((task) => ({ title: task.title.trim(), metric: task.metric.trim() })),
    };
  });
  return { milestones };
}

function move<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const result = [...items];
  const target = index + direction;
  if (target < 0 || target >= result.length) return items;
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}

export default function RoadmapDraftEditor({
  draft,
  onChange,
  disabled,
}: {
  draft: DraftMilestone[];
  onChange: (draft: DraftMilestone[]) => void;
  disabled: boolean;
}) {
  const patch = (index: number, update: Partial<DraftMilestone>) =>
    onChange(draft.map((milestone, i) => (i === index ? { ...milestone, ...update } : milestone)));
  return (
    <Box>
      <Box
        role="region"
        aria-label="Edit proposed roadmap"
        tabIndex={0}
        sx={{ overflowX: 'auto', p: 0.5, pb: 2 }}
      >
        <Stack direction="row" spacing={2} sx={{ alignItems: 'stretch' }}>
          {draft.map((milestone, index) => (
            <Box
              key={milestone.key}
              sx={{
                p: 2,
                width: { xs: '100%', sm: 340 },
                flexShrink: 0,
                boxSizing: 'border-box',
                border: `1px solid ${milestone.selected ? colorTokens.selectedBorder : colorTokens.border}`,
                borderRadius: 2,
                bgcolor: milestone.selected ? colorTokens.canvas : colorTokens.surface,
              }}
            >
              <Stack
                direction="row"
                sx={{
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <FormControlLabel
                  sx={{ mr: 0 }}
                  control={
                    <Checkbox
                      checked={milestone.selected}
                      onChange={(e) => patch(index, { selected: e.target.checked })}
                      disabled={disabled}
                    />
                  }
                  label={`Include ${index + 1}`}
                />
                <Box>
                  <IconButton
                    aria-label={`Move milestone ${index + 1} earlier`}
                    size="small"
                    disabled={disabled || index === 0}
                    onClick={() => onChange(move(draft, index, -1))}
                  >
                    <ArrowBackIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label={`Move milestone ${index + 1} later`}
                    size="small"
                    disabled={disabled || index === draft.length - 1}
                    onClick={() => onChange(move(draft, index, 1))}
                  >
                    <ArrowForwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label={`Remove proposed milestone ${index + 1}`}
                    size="small"
                    disabled={disabled}
                    onClick={() => onChange(draft.filter((_, i) => i !== index))}
                  >
                    <DeleteOutlinedIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Stack>
              <Stack spacing={2}>
                <TextField
                  label={`Proposed milestone ${index + 1}`}
                  required
                  size="small"
                  value={milestone.title}
                  disabled={disabled || !milestone.selected}
                  onChange={(e) => patch(index, { title: e.target.value })}
                />
                <TextField
                  label={`Proposed deadline ${index + 1}`}
                  type="date"
                  size="small"
                  value={milestone.dueDate}
                  disabled={disabled || !milestone.selected}
                  onChange={(e) => patch(index, { dueDate: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  label="Description"
                  size="small"
                  multiline
                  minRows={2}
                  value={milestone.description}
                  disabled={disabled || !milestone.selected}
                  onChange={(e) => patch(index, { description: e.target.value })}
                />
                {milestone.tasks.map((task, taskIndex) => {
                  const patchTask = (update: Partial<DraftTask>) =>
                    patch(index, {
                      tasks: milestone.tasks.map((t, i) =>
                        i === taskIndex ? { ...t, ...update } : t,
                      ),
                    });
                  const taskDisabled = disabled || !milestone.selected;
                  return (
                    <Box
                      key={task.key}
                      sx={{ pt: 1, borderTop: `1px solid ${colorTokens.border}` }}
                    >
                      <Stack
                        direction="row"
                        sx={{
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                        }}
                      >
                        <FormControlLabel
                          sx={{ mr: 0 }}
                          control={
                            <Checkbox
                              size="small"
                              checked={task.selected}
                              disabled={taskDisabled}
                              onChange={(e) => patchTask({ selected: e.target.checked })}
                            />
                          }
                          label={<Typography variant="body2">Task {taskIndex + 1}</Typography>}
                        />
                        <Box>
                          <IconButton
                            aria-label={`Move task ${taskIndex + 1} earlier in proposal ${index + 1}`}
                            size="small"
                            disabled={taskDisabled || taskIndex === 0}
                            onClick={() =>
                              patch(index, { tasks: move(milestone.tasks, taskIndex, -1) })
                            }
                          >
                            <ArrowBackIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            aria-label={`Move task ${taskIndex + 1} later in proposal ${index + 1}`}
                            size="small"
                            disabled={taskDisabled || taskIndex === milestone.tasks.length - 1}
                            onClick={() =>
                              patch(index, { tasks: move(milestone.tasks, taskIndex, 1) })
                            }
                          >
                            <ArrowForwardIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            aria-label={`Remove task ${taskIndex + 1} from proposal ${index + 1}`}
                            size="small"
                            disabled={taskDisabled}
                            onClick={() =>
                              patch(index, {
                                tasks: milestone.tasks.filter((_, i) => i !== taskIndex),
                              })
                            }
                          >
                            <DeleteOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Stack>
                      <Stack spacing={1.5} sx={{ mt: 1 }}>
                        <TextField
                          label={`Task ${taskIndex + 1} name`}
                          required
                          size="small"
                          value={task.title}
                          disabled={taskDisabled || !task.selected}
                          onChange={(e) => patchTask({ title: e.target.value })}
                        />
                        <TextField
                          label={`Task ${taskIndex + 1} metric`}
                          placeholder="e.g. Lead 2 architecture reviews"
                          required
                          size="small"
                          value={task.metric}
                          disabled={taskDisabled || !task.selected}
                          onChange={(e) => patchTask({ metric: e.target.value })}
                        />
                      </Stack>
                    </Box>
                  );
                })}
                <Button
                  startIcon={<AddIcon />}
                  size="small"
                  disabled={disabled || !milestone.selected}
                  onClick={() => patch(index, { tasks: [...milestone.tasks, newDraftTask()] })}
                >
                  Add task
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>
      <Button
        startIcon={<AddIcon />}
        variant="outlined"
        size="small"
        disabled={disabled}
        onClick={() => onChange([...draft, newDraftMilestone()])}
      >
        Add proposed milestone
      </Button>
    </Box>
  );
}
