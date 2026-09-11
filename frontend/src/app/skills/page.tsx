'use client';

import * as React from 'react';
import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Rating from '@mui/material/Rating';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api/client';
import * as skillsCompetencyApi from '@/lib/api/skillsCompetencyApi';
import type { EmployeeSkill, Skill } from '@/lib/api/skillsCompetencyApi';

export default function SkillsPage() {
  const { user } = useAuth();
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
    Promise.all([loadCatalog(), loadMySkills(user.id)]).catch((err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to load skills');
    });
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
      setError('Skill name is required');
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save skill');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <PageContainer>
        <PageHeader title="My Skills" subtitle="Skills you have logged." />

        <Card title="Add / update a skill" sx={{ mb: 3 }}>
          <Stack spacing={2}>
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
                  <TextField {...params} label="Skill name" placeholder="e.g. TypeScript" size="small" />
                )}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2">Level</Typography>
                <Rating
                  value={level}
                  max={5}
                  onChange={(_e, value) => setLevel(value ?? 1)}
                />
              </Box>
            </Stack>
            <TextField
              label="Note (optional)"
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
                {saving ? 'Saving...' : 'Save skill'}
              </Button>
            </Box>
          </Stack>
        </Card>

        <Card title="My skills">
          {!mySkills ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : mySkills.length === 0 ? (
            <Typography variant="body1">No skills logged yet — add one above.</Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Skill</TableCell>
                  <TableCell>Level</TableCell>
                  <TableCell>Note</TableCell>
                  <TableCell align="right">Edit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mySkills.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.skill.name}</TableCell>
                    <TableCell>
                      <Rating value={row.level} max={5} readOnly size="small" />
                    </TableCell>
                    <TableCell>{row.note ?? '—'}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleEditRow(row)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </PageContainer>
    </AppShell>
  );
}
