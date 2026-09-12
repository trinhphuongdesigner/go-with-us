'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@/components/ui/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import CheckIcon from '@mui/icons-material/Check';
import StatusChip from '@/components/ui/StatusChip';
import { colorTokens, radiusTokens } from '@/theme/theme';
import * as api from '@/lib/api/developmentPlansApi';
import type { DevelopmentMilestone } from '@/lib/api/developmentPlansApi';
import InlineRoadmapField from './InlineRoadmapField';

function TaskComposer({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (title: string, metric: string) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [metric, setMetric] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  if (!open)
    return (
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        Add task
      </Button>
    );
  return (
    <Box
      component="form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (disabled || !title.trim() || !metric.trim()) return;
        setError(null);
        try {
          await onAdd(title.trim(), metric.trim());
          setTitle('');
          setMetric('');
          setOpen(false);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not add task.');
        }
      }}
      sx={{ mt: 1 }}
    >
      <Stack spacing={1.5}>
        <TextField
          label="New task"
          size="small"
          autoFocus
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={disabled}
        />
        <TextField
          label="Success metric"
          placeholder="e.g. Ship 2 reviewed features"
          size="small"
          required
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          disabled={disabled}
        />
        {error ? <Alert severity="error">{error}</Alert> : null}
        <Stack direction="row" spacing={1}>
          <Button
            type="submit"
            size="small"
            variant="outlined"
            disabled={disabled || !title.trim() || !metric.trim()}
          >
            Add task
          </Button>
          <Button size="small" onClick={() => setOpen(false)} disabled={disabled}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default function MilestonesPanel({
  milestones,
  onChanged,
}: {
  milestones: DevelopmentMilestone[];
  onChanged: () => Promise<void>;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [pendingTask, setPendingTask] = React.useState<{ id: string; done: boolean } | null>(null);
  const busyRef = React.useRef(false);
  const [adding, setAdding] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [deleting, setDeleting] = React.useState<{
    id: string;
    title: string;
    kind: 'task' | 'milestone';
  } | null>(null);

  const mutate = async (operation: () => Promise<unknown>) => {
    if (busyRef.current) throw new Error('Please wait for the current change to finish.');
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await operation();
      await onChanged();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const perform = async (operation: () => Promise<unknown>) => {
    try {
      await mutate(operation);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the change.');
      return false;
    }
  };

  return (
    <Box>
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 2 }}
      >
        <Typography variant="body2">
          Edit a name, deadline or metric. Check off tasks as you finish.
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setAdding(true)}
          disabled={busy || adding}
          sx={{ flexShrink: 0 }}
        >
          Add milestone
        </Button>
      </Stack>
      {adding ? (
        <Box
          component="form"
          sx={{ p: 2, mb: 2, border: `1px solid ${colorTokens.border}`, borderRadius: 2 }}
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy || !title.trim()) return;
            const ok = await perform(() =>
              api.createMilestone({ title: title.trim(), dueDate: dueDate || undefined }),
            );
            if (ok) {
              setAdding(false);
              setTitle('');
              setDueDate('');
            }
          }}
        >
          <Stack spacing={1.5}>
            <TextField
              autoFocus
              label="New milestone"
              required
              size="small"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
              fullWidth
            />
            <TextField
              label="Deadline"
              type="date"
              size="small"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              disabled={busy}
            />
            <Stack direction="row" spacing={1}>
              <Button type="submit" variant="contained" disabled={busy || !title.trim()}>
                Create milestone
              </Button>
              <Button onClick={() => setAdding(false)} disabled={busy}>
                Cancel
              </Button>
            </Stack>
          </Stack>
        </Box>
      ) : null}
      {milestones.length === 0 ? (
        <Box
          sx={{
            p: 3,
            textAlign: 'center',
            border: `1px dashed ${colorTokens.selectedBorder}`,
            borderRadius: 2,
            bgcolor: colorTokens.canvas,
          }}
        >
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Your next chapter starts here</Typography>
          <Typography variant="body2">
            Add your first milestone, or ask the roadmap assistant below for a proposal.
          </Typography>
        </Box>
      ) : (
        <Box
          role="region"
          aria-label="Roadmap milestones"
          tabIndex={0}
          sx={{
            overflowX: 'auto',
            pb: 2,
            px: 0.5,
            '&:focus-visible': { outline: `2px solid ${colorTokens.primary}` },
          }}
        >
          <Box
            component="ol"
            sx={{ display: 'flex', alignItems: 'stretch', listStyle: 'none', p: 0, m: 0, gap: 2 }}
          >
            {[...milestones]
              .sort((a, b) => a.order - b.order)
              .map((milestone, index) => {
                const done = milestone.tasks.filter((task) => task.done).length;
                const total = milestone.tasks.length;
                const complete = total > 0 && done === total;
                const status = complete ? 'Done' : done ? 'In progress' : 'Not started';
                return (
                  <Box
                    component="li"
                    key={milestone.id}
                    sx={{
                      width: { xs: '100%', sm: 320 },
                      flexShrink: 0,
                      minWidth: 0,
                      position: 'relative',
                      pt: 1,
                    }}
                  >
                    <Box
                      aria-hidden="true"
                      sx={{
                        position: 'absolute',
                        top: 25,
                        left: 0,
                        right: -16,
                        height: 2,
                        bgcolor: colorTokens.border,
                      }}
                    />
                    <Box
                      sx={{
                        position: 'relative',
                        width: 36,
                        height: 36,
                        mb: 2,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: '50%',
                        fontWeight: 600,
                        bgcolor: complete ? colorTokens.primary : colorTokens.primarySubtle,
                        color: complete ? '#fff' : colorTokens.primary,
                        border: `2px solid ${colorTokens.surface}`,
                      }}
                    >
                      {complete ? (
                        <CheckIcon fontSize="small" />
                      ) : (
                        String(index + 1).padStart(2, '0')
                      )}
                    </Box>
                    <Box
                      sx={{
                        p: 2,
                        border: `1px solid ${complete ? colorTokens.selectedBorder : colorTokens.border}`,
                        borderRadius: `${radiusTokens.md}px`,
                        bgcolor: colorTokens.surface,
                      }}
                    >
                      <Stack
                        direction="row"
                        sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
                      >
                        <StatusChip
                          label={status}
                          tone={complete ? 'success' : done ? 'info' : 'neutral'}
                        />
                        <IconButton
                          aria-label={`Delete milestone ${milestone.title}`}
                          size="small"
                          disabled={busy}
                          onClick={() =>
                            setDeleting({
                              id: milestone.id,
                              title: milestone.title,
                              kind: 'milestone',
                            })
                          }
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                      <InlineRoadmapField
                        label={`milestone ${index + 1} name`}
                        value={milestone.title}
                        required
                        strong
                        disabled={busy}
                        onSave={(value) =>
                          mutate(() => api.updateMilestone(milestone.id, { title: value }))
                        }
                      />
                      <InlineRoadmapField
                        label={`milestone ${index + 1} description`}
                        value={milestone.description ?? ''}
                        placeholder="Add a short description"
                        disabled={busy}
                        onSave={(value) =>
                          mutate(() => api.updateMilestone(milestone.id, { description: value }))
                        }
                      />
                      <Typography variant="body2" sx={{ fontSize: 11, mt: 1, pl: 0.75 }}>
                        DEADLINE
                      </Typography>
                      <InlineRoadmapField
                        label={`milestone ${index + 1} deadline`}
                        type="date"
                        value={milestone.dueDate?.slice(0, 10) ?? ''}
                        placeholder="Set deadline"
                        required={!!milestone.dueDate}
                        disabled={busy}
                        onSave={(value) =>
                          mutate(() =>
                            api.updateMilestone(milestone.id, { dueDate: value || undefined }),
                          )
                        }
                      />
                      <Box sx={{ my: 2 }}>
                        <LinearProgress
                          variant="determinate"
                          aria-label={`Milestone ${index + 1} progress`}
                          value={total ? (done / total) * 100 : 0}
                          sx={{ height: 5, borderRadius: 2 }}
                        />
                        <Typography variant="body2" sx={{ fontSize: 12, mt: 0.75 }}>
                          {done}/{total} tasks complete
                        </Typography>
                      </Box>
                      <Stack spacing={1.5} sx={{ mb: 1 }}>
                        {[...milestone.tasks]
                          .sort((a, b) => a.order - b.order)
                          .map((task, taskIndex) => (
                            <Box
                              key={task.id}
                              sx={{ borderTop: `1px solid ${colorTokens.border}`, pt: 1 }}
                            >
                              <Stack direction="row" sx={{ alignItems: 'flex-start' }}>
                                <Checkbox
                                  size="small"
                                  checked={
                                    pendingTask?.id === task.id ? pendingTask.done : task.done
                                  }
                                  disabled={busy}
                                  slotProps={{ input: { 'aria-label': `Complete ${task.title}` } }}
                                  onChange={(event) => {
                                    const done = event.target.checked;
                                    setPendingTask({ id: task.id, done });
                                    void perform(() => api.updateTask(task.id, { done })).finally(
                                      () => setPendingTask(null),
                                    );
                                  }}
                                />
                                <Box
                                  sx={{
                                    minWidth: 0,
                                    flex: 1,
                                    textDecoration: task.done ? 'line-through' : 'none',
                                  }}
                                >
                                  <InlineRoadmapField
                                    label={`milestone ${index + 1} task ${taskIndex + 1} name`}
                                    value={task.title}
                                    required
                                    disabled={busy}
                                    onSave={(value) =>
                                      mutate(() => api.updateTask(task.id, { title: value }))
                                    }
                                  />
                                </Box>
                                <IconButton
                                  aria-label={`Delete task ${task.title}`}
                                  size="small"
                                  disabled={busy}
                                  onClick={() =>
                                    setDeleting({ id: task.id, title: task.title, kind: 'task' })
                                  }
                                >
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </Stack>
                              <Box sx={{ pl: 0.75 }}>
                                <Typography variant="body2" sx={{ fontSize: 11 }}>
                                  SUCCESS METRIC
                                </Typography>
                                <InlineRoadmapField
                                  label={`milestone ${index + 1} task ${taskIndex + 1} metric`}
                                  value={task.metric ?? ''}
                                  placeholder="Add a measurable outcome"
                                  disabled={busy}
                                  onSave={(value) =>
                                    mutate(() => api.updateTask(task.id, { metric: value }))
                                  }
                                />
                              </Box>
                            </Box>
                          ))}
                      </Stack>
                      <TaskComposer
                        disabled={busy}
                        onAdd={(taskTitle, metric) =>
                          mutate(() => api.createTask(milestone.id, { title: taskTitle, metric }))
                        }
                      />
                    </Box>
                  </Box>
                );
              })}
          </Box>
        </Box>
      )}
      <Dialog
        open={!!deleting}
        onClose={() => {
          if (!busy) setDeleting(null);
        }}
        aria-labelledby="delete-roadmap-title"
      >
        <DialogTitle id="delete-roadmap-title">Delete {deleting?.kind}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            “{deleting?.title}” will be removed
            {deleting?.kind === 'milestone' ? ', including its tasks and their progress' : ''}.
          </DialogContentText>
          {error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)} disabled={busy}>
            Cancel
          </Button>
          <Button
            color="error"
            disabled={busy}
            onClick={async () => {
              if (!deleting) return;
              const item = deleting;
              if (
                await perform(() =>
                  item.kind === 'milestone'
                    ? api.deleteMilestone(item.id)
                    : api.deleteTask(item.id),
                )
              )
                setDeleting(null);
            }}
          >
            Delete {deleting?.kind}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
