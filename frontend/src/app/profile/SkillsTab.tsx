'use client';

import * as React from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import PageSkeleton from '@/components/ui/PageSkeleton';
import Stack from '@mui/material/Stack';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import SkillLevelMeter from '@/components/ui/SkillLevelMeter';
import Button from '@/components/ui/Button';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import IconButton from '@/components/ui/IconButton';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api/client';
import * as skillsCompetencyApi from '@/lib/api/skillsCompetencyApi';
import type { EmployeeSkill, Skill } from '@/lib/api/skillsCompetencyApi';

/** Skill self-management — moved in from the old standalone /skills page. */
export default function SkillsTab({ onChanged }: { onChanged: () => void }) {
  const { user } = useAuth();
  const { ask, dialog } = useConfirmDialog();
  const [catalog, setCatalog] = React.useState<Skill[] | null>(null);
  const [mySkills, setMySkills] = React.useState<EmployeeSkill[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [skillName, setSkillName] = React.useState('');
  const [level, setLevel] = React.useState<number>(3);
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const loadCatalog = React.useCallback(() => {
    return skillsCompetencyApi.listSkills().then(setCatalog);
  }, []);

  const loadMySkills = React.useCallback((userId: string) => {
    return skillsCompetencyApi.listUserSkills(userId).then(setMySkills);
  }, []);

  React.useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        await Promise.all([loadCatalog(), loadMySkills(user.id)]);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Không tải được kỹ năng');
      }
    })();
  }, [user, loadCatalog, loadMySkills]);

  const resetForm = () => {
    setSkillName('');
    setLevel(3);
    setNote('');
  };

  const handleEditRow = (row: EmployeeSkill) => {
    setSkillName(row.skill.name);
    setLevel(row.level);
    setNote(row.note ?? '');
  };

  const handleSave = async () => {
    if (!user) return;
    const trimmedName = skillName.trim();
    if (!trimmedName) {
      setError('Cần có tên kỹ năng');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const skill = await skillsCompetencyApi.upsertSkill({ name: trimmedName });
      await skillsCompetencyApi.bulkUpsertOwnSkills(user.id, [
        { skillId: skill.id, level, note: note.trim() || undefined },
      ]);
      await Promise.all([loadCatalog(), loadMySkills(user.id)]);
      resetForm();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được kỹ năng');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: EmployeeSkill) => {
    if (!user) return;
    try {
      await skillsCompetencyApi.deleteEmployeeSkill(user.id, row.skillId);
      await loadMySkills(user.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không xóa được kỹ năng');
    }
  };

  return (
    <Box>
      <Stack spacing={2} sx={{ mb: 3 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ alignItems: { md: 'center' } }}
        >
          <Autocomplete
            freeSolo
            options={(catalog ?? []).map((s) => s.name)}
            value={skillName}
            onInputChange={(_e, value) => setSkillName(value)}
            sx={{ minWidth: 260, flex: 1 }}
            renderInput={(params) => (
              <TextField {...params} label="Tên kỹ năng" placeholder="ví dụ TypeScript" size="small" />
            )}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">Cấp độ</Typography>
            <SkillLevelMeter value={level} onChange={setLevel} />
          </Box>
        </Stack>
        <TextField
          label="Ghi chú (tuỳ chọn)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          multiline
          minRows={2}
          fullWidth
          size="small"
        />
        {error ? (
          <Typography variant="body2" sx={{ color: 'error.main' }}>
            {error}
          </Typography>
        ) : null}
        <Box>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu kỹ năng'}
          </Button>
        </Box>
      </Stack>

      {!mySkills ? (
        <PageSkeleton variant="table" rows={4} embedded />
      ) : mySkills.length === 0 ? (
        <Typography variant="body1">Chưa có kỹ năng nào — thêm ở trên.</Typography>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Kỹ năng</TableCell>
              <TableCell>Cấp độ</TableCell>
              <TableCell>Ghi chú</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mySkills.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.skill.name}</TableCell>
                <TableCell>
                  <SkillLevelMeter value={row.level} size="sm" />
                </TableCell>
                <TableCell>{row.note ?? '—'}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleEditRow(row)}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() =>
                      ask({
                        title: 'Xóa kỹ năng',
                        description: `Xóa "${row.skill.name}"? Hành động này không thể hoàn tác.`,
                        confirmLabel: 'Xóa',
                        danger: true,
                        onConfirm: () => handleDelete(row),
                      })
                    }
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {dialog}
    </Box>
  );
}
