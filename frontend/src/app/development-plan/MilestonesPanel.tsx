'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@/components/ui/Button';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import IconButton from '@/components/ui/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import StatusChip from '@/components/ui/StatusChip';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ApiError } from '@/lib/api/client';
import {
  createTask,
  deleteMilestone,
  deleteTask,
  updateTask,
  type DevelopmentMilestone,
} from '@/lib/api/developmentPlansApi';

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Chưa bắt đầu',
  IN_PROGRESS: 'Đang thực hiện',
  DONE: 'Hoàn thành',
};

/**
 * The measurable, checkable side of the roadmap — one milestone per card,
 * tasks tick off individually and the milestone status follows
 * automatically (see DevelopmentPlansService.syncMilestoneStatus).
 */
export default function MilestonesPanel({
  milestones,
  onChanged,
}: {
  milestones: DevelopmentMilestone[];
  onChanged: () => void;
}) {
  const { ask, dialog } = useConfirmDialog();
  const [error, setError] = React.useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = React.useState<Record<string, string>>({});

  const handleToggleTask = async (taskId: string, done: boolean) => {
    try {
      await updateTask(taskId, { done });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không cập nhật được nhiệm vụ');
    }
  };

  const handleAddTask = async (milestoneId: string) => {
    const title = (newTaskTitle[milestoneId] ?? '').trim();
    if (!title) return;
    try {
      await createTask(milestoneId, { title });
      setNewTaskTitle((prev) => ({ ...prev, [milestoneId]: '' }));
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thêm được nhiệm vụ');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không xóa được nhiệm vụ');
    }
  };

  const handleDeleteMilestone = async (id: string) => {
    try {
      await deleteMilestone(id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không xóa được cột mốc');
    }
  };

  if (milestones.length === 0) {
    return (
      <Typography variant="body2">
        Chưa có cột mốc — dựng bằng trợ lý AI bên dưới, hoặc chỉ dùng kế hoạch markdown.
      </Typography>
    );
  }

  return (
    <Box>
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <Stack spacing={2.5}>
        {milestones.map((milestone) => (
          <Box key={milestone.id}>
            <Stack
              direction="row"
              sx={{ justifyContent: 'space-between', alignItems: 'center' }}
            >
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {milestone.title}
                </Typography>
                {milestone.description ? (
                  <Typography variant="body2">{milestone.description}</Typography>
                ) : null}
                {milestone.dueDate ? (
                  <Typography variant="body2" sx={{ fontSize: 12 }}>
                    Hạn {new Date(milestone.dueDate).toLocaleDateString('vi-VN')}
                  </Typography>
                ) : null}
              </Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <StatusChip label={STATUS_LABEL[milestone.status] ?? milestone.status} />
                <IconButton
                  size="sm"
                  aria-label="Xóa cột mốc"
                  onClick={() =>
                    ask({
                      title: 'Xóa cột mốc',
                      description: `Xóa “${milestone.title}” và các nhiệm vụ?`,
                      confirmLabel: 'Xóa',
                      danger: true,
                      onConfirm: () => handleDeleteMilestone(milestone.id),
                    })
                  }
                >
                  <DeleteOutlineIcon />
                </IconButton>
              </Stack>
            </Stack>

            <Stack spacing={0.5} sx={{ mt: 1, pl: 1 }}>
              {milestone.tasks.map((task) => (
                <Stack
                  key={task.id}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'center' }}
                >
                  <Checkbox
                    size="small"
                    checked={task.done}
                    onChange={(e) => handleToggleTask(task.id, e.target.checked)}
                  />
                  <Typography
                    variant="body2"
                    sx={{
                      flex: 1,
                      textDecoration: task.done ? 'line-through' : 'none',
                      opacity: task.done ? 0.6 : 1,
                    }}
                  >
                    {task.title}
                    {task.metric ? ` — ${task.metric}` : ''}
                  </Typography>
                  <IconButton
                    size="sm"
                    aria-label="Xóa nhiệm vụ"
                    onClick={() =>
                      ask({
                        title: 'Xóa nhiệm vụ',
                        description: `Xóa “${task.title}”?`,
                        confirmLabel: 'Xóa',
                        danger: true,
                        onConfirm: () => handleDeleteTask(task.id),
                      })
                    }
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
              ))}

              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                <TextField
                  placeholder="Thêm nhiệm vụ"
                  size="small"
                  value={newTaskTitle[milestone.id] ?? ''}
                  onChange={(e) =>
                    setNewTaskTitle((prev) => ({
                      ...prev,
                      [milestone.id]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTask(milestone.id);
                  }}
                  fullWidth
                />
                <Button size="small" onClick={() => handleAddTask(milestone.id)}>
                  Thêm
                </Button>
              </Stack>
            </Stack>
            <Divider sx={{ mt: 2 }} />
          </Box>
        ))}
      </Stack>
      {dialog}
    </Box>
  );
}
