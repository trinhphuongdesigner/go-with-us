'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import Divider from '@mui/material/Divider';
import IconButton from '@/components/ui/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import StatusChip from '@/components/ui/StatusChip';
import { toneForStatus } from '@/lib/statusColors';
import { ApiError } from '@/lib/api/client';
import {
  createGoal,
  deleteGoal,
  updateGoal,
  type DevelopmentGoal,
  type GoalStatus,
  type LifeCategory,
} from '@/lib/api/developmentPlansApi';
import { colorTokens } from '@/theme/theme';

const STATUS_OPTIONS: GoalStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'ACHIEVED'];
const STATUS_LABEL: Record<GoalStatus, string> = {
  NOT_STARTED: 'Chưa bắt đầu',
  IN_PROGRESS: 'Đang thực hiện',
  ACHIEVED: 'Đã đạt',
};
const TABS: LifeCategory[] = ['WORK', 'PERSONAL'];
const TAB_LABEL: Record<LifeCategory, string> = {
  WORK: 'Công việc',
  PERSONAL: 'Cá nhân',
};
const TAB_HINT: Record<LifeCategory, string> = {
  WORK: 'Kỹ năng, chứng chỉ và những gì phục vụ công việc.',
  PERSONAL: 'Sức khỏe, thể thao, tình nguyện — không trực tiếp phục vụ việc, nhưng cho ngữ cảnh.',
};

interface FormState {
  title: string;
  description: string;
  dueDate: string;
}

const EMPTY_FORM: FormState = { title: '', description: '', dueDate: '' };

/**
 * Goal Tracker (M7) — the two buckets the idea doc calls for: WORK vs
 * PERSONAL, each with its own tab, add form, and inline progress tracking.
 */
export default function GoalsPanel({
  goals,
  onChanged,
}: {
  goals: DevelopmentGoal[];
  onChanged: () => void;
}) {
  const { ask, dialog } = useConfirmDialog();
  const [tab, setTab] = React.useState<LifeCategory>('WORK');
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const visible = goals.filter((g) => g.category === tab);

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createGoal({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: tab,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
      });
      setForm(EMPTY_FORM);
      setOpen(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thêm được mục tiêu');
    } finally {
      setSaving(false);
    }
  };

  const handleProgress = async (goal: DevelopmentGoal, progress: number) => {
    try {
      const updated = await updateGoal(goal.id, {
        progress,
        status:
          progress >= 100
            ? 'ACHIEVED'
            : progress > 0
              ? 'IN_PROGRESS'
              : 'NOT_STARTED',
      });
      onChanged();
      void updated;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không cập nhật được tiến độ');
    }
  };

  const handleStatus = async (goal: DevelopmentGoal, status: GoalStatus) => {
    try {
      await updateGoal(goal.id, { status });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không cập nhật được mục tiêu');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGoal(id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không xóa được mục tiêu');
    }
  };

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1, mb: 1 }}
      >
        <Tabs value={tab} onChange={(_, v: LifeCategory) => setTab(v)}>
          {TABS.map((t) => (
            <Tab key={t} value={t} label={TAB_LABEL[t]} />
          ))}
        </Tabs>
        <Button startIcon={<AddIcon />} size="sm" onClick={() => setOpen(true)}>
          Thêm mục tiêu
        </Button>
      </Stack>
      <Typography variant="body2" sx={{ fontSize: 12.5, mb: 2 }}>
        {TAB_HINT[tab]}
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      {visible.length === 0 ? (
        <Typography variant="body2">
          Chưa có mục tiêu {TAB_LABEL[tab].toLowerCase()}.
        </Typography>
      ) : (
        <Stack divider={<Divider />} spacing={2}>
          {visible.map((goal) => (
            <Box key={goal.id} sx={{ pt: 1 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                sx={{ justifyContent: 'space-between', gap: 1 }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {goal.title}
                    {goal.aiSuggested ? (
                      <Typography
                        component="span"
                        variant="body2"
                        sx={{ ml: 1, fontSize: 11, color: colorTokens.accentInk }}
                      >
                        AI gợi ý
                      </Typography>
                    ) : null}
                  </Typography>
                  {goal.description ? (
                    <Typography variant="body2">{goal.description}</Typography>
                  ) : null}
                  {goal.dueDate ? (
                    <Typography variant="body2" sx={{ fontSize: 12 }}>
                      Hạn {new Date(goal.dueDate).toLocaleDateString('vi-VN')}
                    </Typography>
                  ) : null}
                </Box>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <TextField
                    select
                    size="small"
                    value={goal.status}
                    onChange={(e) => handleStatus(goal, e.target.value as GoalStatus)}
                    sx={{ width: 150 }}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <MenuItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </MenuItem>
                    ))}
                  </TextField>
                  <StatusChip
                    label={STATUS_LABEL[goal.status]}
                    tone={toneForStatus(goal.status)}
                  />
                  <IconButton
                    size="sm"
                    aria-label="Xóa mục tiêu"
                    onClick={() =>
                      ask({
                        title: 'Xóa mục tiêu',
                        description: `Xóa “${goal.title}”? Hành động này không thể hoàn tác.`,
                        confirmLabel: 'Xóa',
                        danger: true,
                        onConfirm: () => handleDelete(goal.id),
                      })
                    }
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
              </Stack>

              <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={goal.progress}
                  sx={{ flex: 1, height: 8, borderRadius: 4 }}
                />
                <TextField
                  type="number"
                  size="small"
                  value={goal.progress}
                  onChange={(e) => {
                    const value = Math.max(
                      0,
                      Math.min(100, Number(e.target.value) || 0),
                    );
                    handleProgress(goal, value);
                  }}
                  slotProps={{ htmlInput: { min: 0, max: 100 } }}
                  sx={{ width: 90 }}
                />
                <Typography variant="body2" sx={{ fontSize: 12.5 }}>
                  %
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Thêm mục tiêu ${TAB_LABEL[tab].toLowerCase()}`}
        actions={
          <>
            <Button variant="text" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button variant="contained" onClick={handleAdd} disabled={saving}>
              {saving ? 'Đang thêm...' : 'Thêm'}
            </Button>
          </>
        }
      >
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Tiêu đề"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Mô tả"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Hạn"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
          </Stack>
      </Dialog>
      {dialog}
    </Box>
  );
}
