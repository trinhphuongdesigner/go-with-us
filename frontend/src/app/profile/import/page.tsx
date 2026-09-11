'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@/components/ui/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { keyframes } from '@mui/system';
import { colorTokens } from '@/theme/theme';
import { ApiError } from '@/lib/api/client';

const popAnimation = keyframes`
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  60% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`;
import {
  analyzeSources,
  refineProposal,
  applyRichUpdates,
  type RichProfileProposal,
  type RichBasicInfo,
  type RichSkill,
  type RichActivity,
  type RichGoal,
  type RichRoadmapMilestone,
  type RichRoadmapTask,
  type ParsedProfile,
} from '@/lib/api/profileImportsApi';

type DraftSkill = RichSkill & { key: string; selected: boolean };
type DraftProject = NonNullable<ParsedProfile['projects']>[number] & { key: string; selected: boolean };
type DraftCert = NonNullable<ParsedProfile['certifications']>[number] & { key: string; selected: boolean };
type DraftAward = NonNullable<ParsedProfile['awards']>[number] & { key: string; selected: boolean };
type DraftActivity = RichActivity & { key: string; selected: boolean };
type DraftGoal = RichGoal & { key: string; selected: boolean };
type DraftRoadmapTask = RichRoadmapTask & { key: string; selected: boolean };
type DraftMilestone = RichRoadmapMilestone & { key: string; selected: boolean; tasks: DraftRoadmapTask[] };

interface LocalDrafts {
  basicInfo?: RichBasicInfo & { selected: boolean };
  skills: DraftSkill[];
  projects: DraftProject[];
  certifications: DraftCert[];
  awards: DraftAward[];
  activities: DraftActivity[];
  goals: DraftGoal[];
  roadmap?: { milestones: DraftMilestone[] };
  summary: string;
  dedupNotes?: string;
}

function move<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const result = [...items];
  const target = index + direction;
  if (target < 0 || target >= result.length) return items;
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}

function newDraftTask(): RichRoadmapTask & { key: string; selected: boolean } {
  return { key: crypto.randomUUID(), selected: true, title: '', metric: '' };
}

function wrapMilestone(m: RichRoadmapMilestone): DraftMilestone {
  return {
    ...m,
    key: crypto.randomUUID(),
    selected: true,
    tasks: (m.tasks || []).map((t) => ({ ...t, key: crypto.randomUUID(), selected: true })) as DraftRoadmapTask[],
  };
}

function wrapArray<T extends object>(items: T[] | undefined): (T & { key: string; selected: boolean })[] {
  return (items || []).map((item) => ({ ...item, key: crypto.randomUUID(), selected: true }));
}

function toPlain<T extends { key?: string; selected?: boolean }>(items: T[]): Omit<T, 'key' | 'selected'>[] {
  return items
    .filter((i) => i.selected)
    .map(({ key: _k, selected: _s, ...rest }) => rest as Omit<T, 'key' | 'selected'>);
}

const STEPS = ['Nhập nguồn dữ liệu', 'Xem & chỉnh sửa đề xuất', 'Hoàn tất'];

export default function ProfileImportPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = React.useState(0);
  const [urlText, setUrlText] = React.useState('');
  const [pastedText, setPastedText] = React.useState('');
  const [files, setFiles] = React.useState<File[]>([]);

  const [drafts, setDrafts] = React.useState<LocalDrafts | null>(null);
  const [instruction, setInstruction] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [identityConfirm, setIdentityConfirm] = React.useState<{
    detectedSourceName: string;
    drafts: LocalDrafts;
  } | null>(null);

  const pending = React.useRef(false);

  const hasSources = urlText.trim().length > 0 || files.length > 0 || pastedText.trim().length > 0;

  const selectedCount = React.useMemo(() => {
    if (!drafts) return 0;
    let n = 0;
    if (drafts.basicInfo?.selected) n++;
    n += drafts.skills.filter((s) => s.selected).length;
    n += drafts.projects.filter((p) => p.selected).length;
    n += drafts.certifications.filter((c) => c.selected).length;
    n += drafts.awards.filter((a) => a.selected).length;
    n += drafts.activities.filter((a) => a.selected).length;
    n += drafts.goals.filter((g) => g.selected).length;
    if (drafts.roadmap) {
      n += drafts.roadmap.milestones.filter((m) => m.selected).length;
      drafts.roadmap.milestones.forEach((m) => {
        n += (m.tasks as any[]).filter((t: any) => t.selected).length;
      });
    }
    return n;
  }, [drafts]);

  const handleAnalyze = async () => {
    if (pending.current || !hasSources) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const urls = urlText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const pastedTexts = pastedText.trim() ? [pastedText.trim()] : [];
      const proposal = await analyzeSources({ urls, pastedTexts }, files.length ? files : undefined);

      const local: LocalDrafts = {
        basicInfo: proposal.basicInfo ? { ...proposal.basicInfo, selected: true } : undefined,
        skills: wrapArray(proposal.skills),
        projects: wrapArray(proposal.projects),
        certifications: wrapArray(proposal.certifications),
        awards: wrapArray(proposal.awards),
        activities: wrapArray(proposal.activities),
        goals: wrapArray(proposal.goals),
        roadmap: proposal.roadmap
          ? { milestones: proposal.roadmap.milestones.map(wrapMilestone) }
          : undefined,
        summary: proposal.summary,
        dedupNotes: proposal.dedupNotes,
      };

      const detectedSourceName = proposal.identityCheck?.detectedSourceName?.trim();
      if (proposal.identityCheck?.matches === false && detectedSourceName) {
        setIdentityConfirm({ detectedSourceName, drafts: local });
      } else {
        setDrafts(local);
        setStep(1);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Phân tích thất bại');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const handleRefine = async () => {
    if (pending.current || !drafts || !instruction.trim()) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const plainProposal: RichProfileProposal = {
        basicInfo: drafts.basicInfo?.selected ? { name: drafts.basicInfo.name, jobTitle: drafts.basicInfo.jobTitle, phone: drafts.basicInfo.phone, summary: drafts.basicInfo.summary } : undefined,
        skills: toPlain(drafts.skills),
        projects: toPlain(drafts.projects),
        certifications: toPlain(drafts.certifications),
        awards: toPlain(drafts.awards),
        activities: toPlain(drafts.activities),
        goals: toPlain(drafts.goals),
        roadmap: drafts.roadmap
          ? {
              milestones: drafts.roadmap.milestones
                .filter((m) => m.selected)
                .map((m) => ({
                  title: m.title,
                  description: m.description,
                  dueDate: m.dueDate,
                  tasks: toPlain(m.tasks),
                })),
            }
          : undefined,
        summary: drafts.summary,
        dedupNotes: drafts.dedupNotes,
      };
      const updated = await refineProposal({ proposal: plainProposal, instruction: instruction.trim() });

      const local: LocalDrafts = {
        basicInfo: updated.basicInfo ? { ...updated.basicInfo, selected: true } : undefined,
        skills: wrapArray(updated.skills),
        projects: wrapArray(updated.projects),
        certifications: wrapArray(updated.certifications),
        awards: wrapArray(updated.awards),
        activities: wrapArray(updated.activities),
        goals: wrapArray(updated.goals),
        roadmap: updated.roadmap
          ? { milestones: updated.roadmap.milestones.map(wrapMilestone) }
          : undefined,
        summary: updated.summary,
        dedupNotes: updated.dedupNotes,
      };
      setDrafts(local);
      setInstruction('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Chỉnh sửa thất bại');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const patchBasic = (update: Partial<RichBasicInfo>) => {
    setDrafts((d) => {
      if (!d?.basicInfo) return d;
      return { ...d, basicInfo: { ...d.basicInfo, ...update } };
    });
  };

  const toggleBasic = (checked: boolean) => {
    setDrafts((d) => {
      if (!d?.basicInfo) return d;
      return { ...d, basicInfo: { ...d.basicInfo, selected: checked } };
    });
  };

  const toggleItem = <K extends 'skills' | 'projects' | 'certifications' | 'awards' | 'activities' | 'goals'>(
    section: K,
    key: string,
    checked: boolean,
  ) => {
    setDrafts((d) => {
      if (!d) return d;
      const arr = (d[section] as any[]).map((item: any) => (item.key === key ? { ...item, selected: checked } : item));
      return { ...d, [section]: arr };
    });
  };

  const moveItem = <K extends 'skills' | 'projects' | 'certifications' | 'awards' | 'activities' | 'goals'>(
    section: K,
    key: string,
    direction: -1 | 1,
  ) => {
    setDrafts((d) => {
      if (!d) return d;
      const arr = [...(d[section] as any[])];
      const idx = arr.findIndex((x: any) => x.key === key);
      if (idx < 0) return d;
      return { ...d, [section]: move(arr, idx, direction) };
    });
  };

  const deleteItem = <K extends 'skills' | 'projects' | 'certifications' | 'awards' | 'activities' | 'goals'>(
    section: K,
    key: string,
  ) => {
    setDrafts((d) => {
      if (!d) return d;
      const arr = (d[section] as any[]).filter((x: any) => x.key !== key);
      return { ...d, [section]: arr };
    });
  };

  const updateItem = <K extends 'skills' | 'projects' | 'certifications' | 'awards' | 'activities' | 'goals'>(
    section: K,
    key: string,
    update: Partial<any>,
  ) => {
    setDrafts((d) => {
      if (!d) return d;
      const arr = (d[section] as any[]).map((item: any) => (item.key === key ? { ...item, ...update } : item));
      return { ...d, [section]: arr };
    });
  };

  // Roadmap specific
  const toggleMilestone = (key: string, checked: boolean) => {
    setDrafts((d) => {
      if (!d?.roadmap) return d;
      return {
        ...d,
        roadmap: {
          milestones: d.roadmap.milestones.map((m) => (m.key === key ? { ...m, selected: checked } : m)),
        },
      };
    });
  };

  const moveMilestone = (key: string, direction: -1 | 1) => {
    setDrafts((d) => {
      if (!d?.roadmap) return d;
      const arr = [...d.roadmap.milestones];
      const idx = arr.findIndex((m) => m.key === key);
      if (idx < 0) return d;
      return { ...d, roadmap: { milestones: move(arr, idx, direction) } };
    });
  };

  const deleteMilestone = (key: string) => {
    setDrafts((d) => {
      if (!d?.roadmap) return d;
      return { ...d, roadmap: { milestones: d.roadmap.milestones.filter((m) => m.key !== key) } };
    });
  };

  const updateMilestone = (key: string, update: Partial<RichRoadmapMilestone>) => {
    setDrafts((d) => {
      if (!d?.roadmap) return d;
      return {
        ...d,
        roadmap: {
          milestones: d.roadmap.milestones.map((m) => (m.key === key ? ({ ...m, ...update } as DraftMilestone) : m)),
        },
      };
    });
  };

  const toggleTask = (milestoneKey: string, taskKey: string, checked: boolean) => {
    setDrafts((d) => {
      if (!d?.roadmap) return d;
      return {
        ...d,
        roadmap: {
          milestones: d.roadmap.milestones.map((m) =>
            m.key === milestoneKey
              ? {
                  ...m,
                  tasks: (m.tasks as DraftRoadmapTask[]).map((t) => (t.key === taskKey ? { ...t, selected: checked } : t)),
                }
              : m,
          ),
        },
      };
    });
  };

  const moveTask = (milestoneKey: string, taskKey: string, direction: -1 | 1) => {
    setDrafts((d) => {
      if (!d?.roadmap) return d;
      return {
        ...d,
        roadmap: {
          milestones: d.roadmap.milestones.map((m) => {
            if (m.key !== milestoneKey) return m;
            const arr = [...m.tasks];
            const idx = arr.findIndex((t) => t.key === taskKey);
            if (idx < 0) return m;
            return { ...m, tasks: move(arr, idx, direction) };
          }),
        },
      };
    });
  };

  const deleteTask = (milestoneKey: string, taskKey: string) => {
    setDrafts((d) => {
      if (!d?.roadmap) return d;
      return {
        ...d,
        roadmap: {
          milestones: d.roadmap.milestones.map((m) =>
            m.key === milestoneKey ? ({ ...m, tasks: (m.tasks as DraftRoadmapTask[]).filter((t) => t.key !== taskKey) } as DraftMilestone) : m,
          ),
        },
      };
    });
  };

  const updateTask = (milestoneKey: string, taskKey: string, update: Partial<RichRoadmapTask>) => {
    setDrafts((d) => {
      if (!d?.roadmap) return d;
      return {
        ...d,
        roadmap: {
          milestones: d.roadmap.milestones.map((m) =>
            m.key === milestoneKey
              ? ({ ...m, tasks: (m.tasks as DraftRoadmapTask[]).map((t) => (t.key === taskKey ? { ...t, ...update } : t)) } as DraftMilestone)
              : m,
          ),
        },
      };
    });
  };

  const addTask = (milestoneKey: string) => {
    setDrafts((d) => {
      if (!d?.roadmap) return d;
      return {
        ...d,
        roadmap: {
          milestones: d.roadmap.milestones.map((m) =>
            m.key === milestoneKey
              ? {
                  ...m,
                  tasks: [
                    ...m.tasks,
                    { key: crypto.randomUUID(), selected: true, title: '', metric: '' } as any,
                  ],
                }
              : m,
          ),
        },
      };
    });
  };

  const handleSave = async () => {
    if (!drafts || pending.current) return;
    pending.current = true;
    setIsSaving(true);
    setError(null);
    setStep(2); // go to completion step (loading then success)
    try {
      const payload = {
        basicInfo: drafts.basicInfo?.selected
          ? { name: drafts.basicInfo.name, jobTitle: drafts.basicInfo.jobTitle, phone: drafts.basicInfo.phone, summary: drafts.basicInfo.summary }
          : undefined,
        skills: toPlain(drafts.skills),
        projects: toPlain(drafts.projects),
        certifications: toPlain(drafts.certifications),
        awards: toPlain(drafts.awards),
        activities: toPlain(drafts.activities),
        goals: toPlain(drafts.goals),
        roadmap: drafts.roadmap
          ? {
              milestones: drafts.roadmap.milestones
                .filter((m) => m.selected)
                .map((m) => ({
                  title: m.title,
                  description: m.description,
                  dueDate: m.dueDate,
                  tasks: toPlain(m.tasks),
                })),
            }
          : undefined,
      };
      const res = await applyRichUpdates(payload);
      setResult(
        `Đã lưu: ${res.skills} kỹ năng, ${res.projects} dự án, ${res.certifications} chứng chỉ, ${res.awards} thành tích, ${res.activities} hoạt động, ${res.goals} mục tiêu, ${res.roadmapMilestones} cột mốc.${res.basic ? ' Cập nhật thông tin cơ bản.' : ''}`,
      );
      // keep isSaving true a tiny bit for smooth transition, then false
      setTimeout(() => setIsSaving(false), 300);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Lưu thất bại');
      setIsSaving(false);
      setStep(1); // back to review on failure
    } finally {
      pending.current = false;
    }
  };

  const resetAll = () => {
    setStep(0);
    setDrafts(null);
    setUrlText('');
    setPastedText('');
    setFiles([]);
    setInstruction('');
    setResult(null);
    setError(null);
  };

  const removeFile = (index: number) => setFiles((fs) => fs.filter((_, i) => i !== index));

  return (
    <PageContainer>
      <PageHeader
        title="Cập nhật hồ sơ năng lực"
        subtitle="Dán link (LinkedIn/FB/web) hoặc upload nhiều file (PDF, PPT, XLSX, DOC, MD...) — AI phân tích với dữ liệu hiện có, đề xuất cập nhật."
      />

      {error ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      ) : null}

      <Card sx={{ mb: 3 }}>
        <Stepper activeStep={step} alternativeLabel>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Card>

      {step === 0 ? (
        <Card title="Nguồn dữ liệu">
          <Stack spacing={2}>
            <TextField
              label="Dán các link (mỗi dòng một link: LinkedIn, Facebook, website...)"
              multiline
              minRows={2}
              value={urlText}
              onChange={(e) => setUrlText(e.target.value)}
              fullWidth
              disabled={busy}
            />

            <Box>
              <Button variant="outlined" component="label" disabled={busy}>
                Chọn file (PDF, DOCX, XLSX, PPT, TXT, MD...)
                <input
                  hidden
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.markdown,.csv,.json"
                  onChange={(e) => {
                    const fs = Array.from(e.target.files || []);
                    setFiles((prev) => [...prev, ...fs]);
                  }}
                />
              </Button>
              {files.length > 0 ? (
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                  {files.map((f, i) => (
                    <Chip key={i} label={f.name} size="small" onDelete={() => removeFile(i)} />
                  ))}
                </Stack>
              ) : null}
            </Box>

            <TextField
              label="Dán thêm văn bản / mô tả"
              multiline
              minRows={6}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              fullWidth
              disabled={busy}
              helperText="Nội dung CV, mô tả LinkedIn, hoặc bất kỳ văn bản nào liên quan."
            />

            {busy ? <LinearProgress /> : null}

            <Box>
              <Button variant="contained" onClick={handleAnalyze} disabled={busy || !hasSources}>
                {busy ? 'Đang phân tích...' : 'Phân tích bằng AI'}
              </Button>
            </Box>
          </Stack>
        </Card>
      ) : null}

      {step === 1 && drafts ? (
        <>
          <Card title="Tóm tắt" sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              AI chỉ đề xuất thông tin mới hoặc thay đổi. Bỏ qua nội dung trùng lặp.
            </Typography>
            {drafts.summary ? <Alert severity="info">{drafts.summary}</Alert> : null}
            {drafts.dedupNotes ? (
              <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
                {drafts.dedupNotes}
              </Typography>
            ) : null}
            <Typography sx={{ mt: 1, fontWeight: 600 }}>{selectedCount} mục được chọn</Typography>
          </Card>

          {/* Basic Info */}
          <Card title="Thông tin cơ bản" sx={{ mb: 3 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={drafts.basicInfo?.selected ?? false}
                  disabled={busy || !drafts.basicInfo}
                  onChange={(e) => toggleBasic(e.target.checked)}
                />
              }
              label="Cập nhật thông tin cơ bản"
            />
            {drafts.basicInfo ? (
              <Stack spacing={1.5} sx={{ mt: 1 }}>
                <TextField
                  label="Họ tên"
                  size="small"
                  value={drafts.basicInfo.name ?? ''}
                  disabled={busy || !drafts.basicInfo.selected}
                  onChange={(e) => patchBasic({ name: e.target.value })}
                />
                <TextField
                  label="Chức danh"
                  size="small"
                  value={drafts.basicInfo.jobTitle ?? ''}
                  disabled={busy || !drafts.basicInfo.selected}
                  onChange={(e) => patchBasic({ jobTitle: e.target.value })}
                />
                <TextField
                  label="Số điện thoại"
                  size="small"
                  value={drafts.basicInfo.phone ?? ''}
                  disabled={busy || !drafts.basicInfo.selected}
                  onChange={(e) => patchBasic({ phone: e.target.value })}
                />
                <TextField
                  label="Tóm tắt"
                  size="small"
                  multiline
                  minRows={2}
                  value={drafts.basicInfo.summary ?? ''}
                  disabled={busy || !drafts.basicInfo.selected}
                  onChange={(e) => patchBasic({ summary: e.target.value })}
                />
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Không có đề xuất mới.
              </Typography>
            )}
          </Card>

          {/* Skills */}
          <Card title={`Kỹ năng (${drafts.skills.length})`} sx={{ mb: 3 }}>
            {drafts.skills.length === 0 ? (
              <Typography variant="body2">Không có đề xuất mới.</Typography>
            ) : (
              <Stack spacing={1}>
                {drafts.skills.map((skill, index) => (
                  <Box
                    key={skill.key}
                    sx={{ p: 1.5, border: `1px solid ${colorTokens.border}`, borderRadius: 1 }}
                  >
                    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={skill.selected}
                            disabled={busy}
                            onChange={(e) => toggleItem('skills', skill.key, e.target.checked)}
                          />
                        }
                        label=""
                        sx={{ mr: 0 }}
                      />
                      <Box>
                        <IconButton
                          size="small"
                          disabled={busy || index === 0}
                          onClick={() => moveItem('skills', skill.key, -1)}
                        >
                          <ArrowBackIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          disabled={busy || index === drafts.skills.length - 1}
                          onClick={() => moveItem('skills', skill.key, 1)}
                        >
                          <ArrowForwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" disabled={busy} onClick={() => deleteItem('skills', skill.key)}>
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Stack>
                    <Stack spacing={1} sx={{ mt: 0.5 }}>
                      <TextField
                        label="Tên kỹ năng"
                        size="small"
                        value={skill.name}
                        disabled={busy || !skill.selected}
                        onChange={(e) => updateItem('skills', skill.key, { name: e.target.value })}
                      />
                      <TextField
                        label="Mức (1-5)"
                        size="small"
                        type="number"
                        slotProps={{ htmlInput: { min: 1, max: 5 } }}
                        value={skill.level ?? ''}
                        disabled={busy || !skill.selected}
                        onChange={(e) =>
                          updateItem('skills', skill.key, { level: e.target.value ? parseInt(e.target.value) : undefined })
                        }
                      />
                      <TextField
                        label="Ghi chú"
                        size="small"
                        value={skill.note ?? ''}
                        disabled={busy || !skill.selected}
                        onChange={(e) => updateItem('skills', skill.key, { note: e.target.value })}
                      />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Card>

          {/* Projects */}
          <Card title={`Dự án (${drafts.projects.length})`} sx={{ mb: 3 }}>
            {drafts.projects.length === 0 ? (
              <Typography variant="body2">Không có đề xuất mới.</Typography>
            ) : (
              <Stack spacing={1}>
                {drafts.projects.map((project, index) => (
                  <Box
                    key={project.key}
                    sx={{ p: 1.5, border: `1px solid ${colorTokens.border}`, borderRadius: 1 }}
                  >
                    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={project.selected}
                            disabled={busy}
                            onChange={(e) => toggleItem('projects', project.key, e.target.checked)}
                          />
                        }
                        label=""
                        sx={{ mr: 0 }}
                      />
                      <Box>
                        <IconButton
                          size="small"
                          disabled={busy || index === 0}
                          onClick={() => moveItem('projects', project.key, -1)}
                        >
                          <ArrowBackIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          disabled={busy || index === drafts.projects.length - 1}
                          onClick={() => moveItem('projects', project.key, 1)}
                        >
                          <ArrowForwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" disabled={busy} onClick={() => deleteItem('projects', project.key)}>
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Stack>
                    <Stack spacing={1} sx={{ mt: 0.5 }}>
                      <TextField
                        label="Tên dự án"
                        size="small"
                        value={project.name}
                        disabled={busy || !project.selected}
                        onChange={(e) => updateItem('projects', project.key, { name: e.target.value })}
                      />
                      <TextField
                        label="Vai trò"
                        size="small"
                        value={project.role}
                        disabled={busy || !project.selected}
                        onChange={(e) => updateItem('projects', project.key, { role: e.target.value })}
                      />
                      <TextField
                        label="Lĩnh vực"
                        size="small"
                        value={project.domain ?? ''}
                        disabled={busy || !project.selected}
                        onChange={(e) => updateItem('projects', project.key, { domain: e.target.value })}
                      />
                      <Stack direction="row" spacing={1}>
                        <TextField
                          label="Bắt đầu"
                          size="small"
                          value={project.startDate ?? ''}
                          disabled={busy || !project.selected}
                          onChange={(e) => updateItem('projects', project.key, { startDate: e.target.value })}
                        />
                        <TextField
                          label="Kết thúc"
                          size="small"
                          value={project.endDate ?? ''}
                          disabled={busy || !project.selected}
                          onChange={(e) => updateItem('projects', project.key, { endDate: e.target.value })}
                        />
                      </Stack>
                      <TextField
                        label="Đóng góp"
                        size="small"
                        multiline
                        minRows={2}
                        value={project.contribution ?? ''}
                        disabled={busy || !project.selected}
                        onChange={(e) => updateItem('projects', project.key, { contribution: e.target.value })}
                      />
                      <TextField
                        label="Công nghệ (phân cách dấu phẩy)"
                        size="small"
                        value={(project.techStack || []).join(', ')}
                        disabled={busy || !project.selected}
                        onChange={(e) =>
                          updateItem('projects', project.key, {
                            techStack: e.target.value
                              .split(',')
                              .map((t) => t.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Card>

          {/* Certifications */}
          <Card title={`Chứng chỉ (${drafts.certifications.length})`} sx={{ mb: 3 }}>
            {drafts.certifications.length === 0 ? (
              <Typography variant="body2">Không có đề xuất mới.</Typography>
            ) : (
              <Stack spacing={1}>
                {drafts.certifications.map((cert, index) => (
                  <Box
                    key={cert.key}
                    sx={{ p: 1.5, border: `1px solid ${colorTokens.border}`, borderRadius: 1 }}
                  >
                    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={cert.selected}
                            disabled={busy}
                            onChange={(e) => toggleItem('certifications', cert.key, e.target.checked)}
                          />
                        }
                        label=""
                        sx={{ mr: 0 }}
                      />
                      <Box>
                        <IconButton
                          size="small"
                          disabled={busy || index === 0}
                          onClick={() => moveItem('certifications', cert.key, -1)}
                        >
                          <ArrowBackIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          disabled={busy || index === drafts.certifications.length - 1}
                          onClick={() => moveItem('certifications', cert.key, 1)}
                        >
                          <ArrowForwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" disabled={busy} onClick={() => deleteItem('certifications', cert.key)}>
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Stack>
                    <Stack spacing={1} sx={{ mt: 0.5 }}>
                      <TextField
                        label="Tên chứng chỉ"
                        size="small"
                        value={cert.name}
                        disabled={busy || !cert.selected}
                        onChange={(e) => updateItem('certifications', cert.key, { name: e.target.value })}
                      />
                      <TextField
                        label="Tổ chức cấp"
                        size="small"
                        value={cert.issuer ?? ''}
                        disabled={busy || !cert.selected}
                        onChange={(e) => updateItem('certifications', cert.key, { issuer: e.target.value })}
                      />
                      <Stack direction="row" spacing={1}>
                        <TextField
                          label="Loại"
                          size="small"
                          value={cert.type ?? ''}
                          disabled={busy || !cert.selected}
                          onChange={(e) => updateItem('certifications', cert.key, { type: e.target.value })}
                        />
                        <TextField
                          label="Điểm / Kết quả"
                          size="small"
                          value={cert.score ?? ''}
                          disabled={busy || !cert.selected}
                          onChange={(e) => updateItem('certifications', cert.key, { score: e.target.value })}
                        />
                      </Stack>
                      <TextField
                        label="Ngày cấp (YYYY-MM-DD)"
                        size="small"
                        value={cert.issuedAt ?? ''}
                        disabled={busy || !cert.selected}
                        onChange={(e) => updateItem('certifications', cert.key, { issuedAt: e.target.value })}
                      />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Card>

          {/* Awards */}
          <Card title={`Thành tích (${drafts.awards.length})`} sx={{ mb: 3 }}>
            {drafts.awards.length === 0 ? (
              <Typography variant="body2">Không có đề xuất mới.</Typography>
            ) : (
              <Stack spacing={1}>
                {drafts.awards.map((award, index) => (
                  <Box
                    key={award.key}
                    sx={{ p: 1.5, border: `1px solid ${colorTokens.border}`, borderRadius: 1 }}
                  >
                    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={award.selected}
                            disabled={busy}
                            onChange={(e) => toggleItem('awards', award.key, e.target.checked)}
                          />
                        }
                        label=""
                        sx={{ mr: 0 }}
                      />
                      <Box>
                        <IconButton
                          size="small"
                          disabled={busy || index === 0}
                          onClick={() => moveItem('awards', award.key, -1)}
                        >
                          <ArrowBackIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          disabled={busy || index === drafts.awards.length - 1}
                          onClick={() => moveItem('awards', award.key, 1)}
                        >
                          <ArrowForwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" disabled={busy} onClick={() => deleteItem('awards', award.key)}>
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Stack>
                    <Stack spacing={1} sx={{ mt: 0.5 }}>
                      <TextField
                        label="Tiêu đề"
                        size="small"
                        value={award.title}
                        disabled={busy || !award.selected}
                        onChange={(e) => updateItem('awards', award.key, { title: e.target.value })}
                      />
                      <TextField
                        label="Tổ chức"
                        size="small"
                        value={award.issuer ?? ''}
                        disabled={busy || !award.selected}
                        onChange={(e) => updateItem('awards', award.key, { issuer: e.target.value })}
                      />
                      <Stack direction="row" spacing={1}>
                        <TextField
                          label="Loại (WORK/PERSONAL)"
                          size="small"
                          value={award.category ?? ''}
                          disabled={busy || !award.selected}
                          onChange={(e) => updateItem('awards', award.key, { category: e.target.value })}
                        />
                        <TextField
                          label="Ngày (YYYY-MM-DD)"
                          size="small"
                          value={award.awardedAt ?? ''}
                          disabled={busy || !award.selected}
                          onChange={(e) => updateItem('awards', award.key, { awardedAt: e.target.value })}
                        />
                      </Stack>
                      <TextField
                        label="Mô tả"
                        size="small"
                        multiline
                        minRows={2}
                        value={award.description ?? ''}
                        disabled={busy || !award.selected}
                        onChange={(e) => updateItem('awards', award.key, { description: e.target.value })}
                      />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Card>

          {/* Activities */}
          <Card title={`Hoạt động (${drafts.activities.length})`} sx={{ mb: 3 }}>
            {drafts.activities.length === 0 ? (
              <Typography variant="body2">Không có đề xuất mới.</Typography>
            ) : (
              <Stack spacing={1}>
                {drafts.activities.map((act, index) => (
                  <Box
                    key={act.key}
                    sx={{ p: 1.5, border: `1px solid ${colorTokens.border}`, borderRadius: 1 }}
                  >
                    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={act.selected}
                            disabled={busy}
                            onChange={(e) => toggleItem('activities', act.key, e.target.checked)}
                          />
                        }
                        label=""
                        sx={{ mr: 0 }}
                      />
                      <Box>
                        <IconButton
                          size="small"
                          disabled={busy || index === 0}
                          onClick={() => moveItem('activities', act.key, -1)}
                        >
                          <ArrowBackIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          disabled={busy || index === drafts.activities.length - 1}
                          onClick={() => moveItem('activities', act.key, 1)}
                        >
                          <ArrowForwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" disabled={busy} onClick={() => deleteItem('activities', act.key)}>
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Stack>
                    <Stack spacing={1} sx={{ mt: 0.5 }}>
                      <TextField
                        label="Tiêu đề hoạt động"
                        size="small"
                        value={act.title}
                        disabled={busy || !act.selected}
                        onChange={(e) => updateItem('activities', act.key, { title: e.target.value })}
                      />
                      <TextField
                        label="Ngày (YYYY-MM-DD)"
                        size="small"
                        value={act.date}
                        disabled={busy || !act.selected}
                        onChange={(e) => updateItem('activities', act.key, { date: e.target.value })}
                      />
                      <TextField
                        label="Mô tả"
                        size="small"
                        multiline
                        minRows={2}
                        value={act.description ?? ''}
                        disabled={busy || !act.selected}
                        onChange={(e) => updateItem('activities', act.key, { description: e.target.value })}
                      />
                      <TextField
                        label="Loại"
                        size="small"
                        value={act.category ?? ''}
                        disabled={busy || !act.selected}
                        onChange={(e) => updateItem('activities', act.key, { category: e.target.value })}
                      />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Card>

          {/* Goals */}
          <Card title={`Mục tiêu phát triển (${drafts.goals.length})`} sx={{ mb: 3 }}>
            {drafts.goals.length === 0 ? (
              <Typography variant="body2">Không có đề xuất mới.</Typography>
            ) : (
              <Stack spacing={1}>
                {drafts.goals.map((goal, index) => (
                  <Box
                    key={goal.key}
                    sx={{ p: 1.5, border: `1px solid ${colorTokens.border}`, borderRadius: 1 }}
                  >
                    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={goal.selected}
                            disabled={busy}
                            onChange={(e) => toggleItem('goals', goal.key, e.target.checked)}
                          />
                        }
                        label=""
                        sx={{ mr: 0 }}
                      />
                      <Box>
                        <IconButton
                          size="small"
                          disabled={busy || index === 0}
                          onClick={() => moveItem('goals', goal.key, -1)}
                        >
                          <ArrowBackIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          disabled={busy || index === drafts.goals.length - 1}
                          onClick={() => moveItem('goals', goal.key, 1)}
                        >
                          <ArrowForwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" disabled={busy} onClick={() => deleteItem('goals', goal.key)}>
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Stack>
                    <Stack spacing={1} sx={{ mt: 0.5 }}>
                      <TextField
                        label="Tiêu đề mục tiêu"
                        size="small"
                        value={goal.title}
                        disabled={busy || !goal.selected}
                        onChange={(e) => updateItem('goals', goal.key, { title: e.target.value })}
                      />
                      <Stack direction="row" spacing={1}>
                        <TextField
                          label="Hạn (YYYY-MM-DD)"
                          size="small"
                          value={goal.dueDate ?? ''}
                          disabled={busy || !goal.selected}
                          onChange={(e) => updateItem('goals', goal.key, { dueDate: e.target.value })}
                        />
                        <TextField
                          label="Loại (WORK/PERSONAL)"
                          size="small"
                          value={goal.category ?? ''}
                          disabled={busy || !goal.selected}
                          onChange={(e) => updateItem('goals', goal.key, { category: e.target.value })}
                        />
                      </Stack>
                      <TextField
                        label="Metric / Kết quả mong đợi"
                        size="small"
                        value={goal.metric ?? ''}
                        disabled={busy || !goal.selected}
                        onChange={(e) => updateItem('goals', goal.key, { metric: e.target.value })}
                      />
                      <TextField
                        label="Mô tả"
                        size="small"
                        multiline
                        minRows={2}
                        value={goal.description ?? ''}
                        disabled={busy || !goal.selected}
                        onChange={(e) => updateItem('goals', goal.key, { description: e.target.value })}
                      />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Card>

          {/* Roadmap */}
          <Card title={`Lộ trình phát triển (${drafts.roadmap?.milestones.length || 0} cột mốc)`} sx={{ mb: 3 }}>
            {!drafts.roadmap || drafts.roadmap.milestones.length === 0 ? (
              <Typography variant="body2">Không có đề xuất mới.</Typography>
            ) : (
              <Stack spacing={2}>
                {drafts.roadmap.milestones.map((milestone, mIndex) => (
                  <Box
                    key={milestone.key}
                    sx={{ p: 1.5, border: `1px solid ${colorTokens.border}`, borderRadius: 1 }}
                  >
                    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={milestone.selected}
                            disabled={busy}
                            onChange={(e) => toggleMilestone(milestone.key, e.target.checked)}
                          />
                        }
                        label={`Cột mốc ${mIndex + 1}`}
                        sx={{ mr: 0 }}
                      />
                      <Box>
                        <IconButton
                          size="small"
                          disabled={busy || mIndex === 0}
                          onClick={() => moveMilestone(milestone.key, -1)}
                        >
                          <ArrowBackIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          disabled={busy || mIndex === drafts.roadmap!.milestones.length - 1}
                          onClick={() => moveMilestone(milestone.key, 1)}
                        >
                          <ArrowForwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" disabled={busy} onClick={() => deleteMilestone(milestone.key)}>
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Stack>
                    <Stack spacing={1} sx={{ mt: 0.5 }}>
                      <TextField
                        label="Tiêu đề cột mốc"
                        size="small"
                        value={milestone.title}
                        disabled={busy || !milestone.selected}
                        onChange={(e) => updateMilestone(milestone.key, { title: e.target.value })}
                      />
                      <TextField
                        label="Hạn (YYYY-MM-DD)"
                        size="small"
                        value={milestone.dueDate ?? ''}
                        disabled={busy || !milestone.selected}
                        onChange={(e) => updateMilestone(milestone.key, { dueDate: e.target.value })}
                      />
                      <TextField
                        label="Mô tả"
                        size="small"
                        multiline
                        minRows={2}
                        value={milestone.description ?? ''}
                        disabled={busy || !milestone.selected}
                        onChange={(e) => updateMilestone(milestone.key, { description: e.target.value })}
                      />

                      <Typography variant="caption" sx={{ mt: 1 }}>
                        Tasks
                      </Typography>
                      {(milestone.tasks as DraftRoadmapTask[]).map((task, tIndex) => (
                        <Box key={task.key} sx={{ pl: 1, borderLeft: `2px solid ${colorTokens.border}` }}>
                          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  size="small"
                                  checked={task.selected}
                                  disabled={busy || !milestone.selected}
                                  onChange={(e) => toggleTask(milestone.key, task.key, e.target.checked)}
                                />
                              }
                              label=""
                              sx={{ mr: 0 }}
                            />
                            <Box>
                              <IconButton
                                size="small"
                                disabled={busy || !milestone.selected || tIndex === 0}
                                onClick={() => moveTask(milestone.key, task.key, -1)}
                              >
                                <ArrowBackIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                disabled={busy || !milestone.selected || tIndex === milestone.tasks.length - 1}
                                onClick={() => moveTask(milestone.key, task.key, 1)}
                              >
                                <ArrowForwardIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                disabled={busy || !milestone.selected}
                                onClick={() => deleteTask(milestone.key, task.key)}
                              >
                                <DeleteOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Stack>
                          <Stack spacing={1} sx={{ mt: 0.5 }}>
                            <TextField
                              label="Task"
                              size="small"
                              value={task.title}
                              disabled={busy || !milestone.selected || !task.selected}
                              onChange={(e) => updateTask(milestone.key, task.key, { title: e.target.value })}
                            />
                            <TextField
                              label="Metric"
                              size="small"
                              value={task.metric ?? ''}
                              disabled={busy || !milestone.selected || !task.selected}
                              onChange={(e) => updateTask(milestone.key, task.key, { metric: e.target.value })}
                            />
                          </Stack>
                        </Box>
                      ))}
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        disabled={busy || !milestone.selected}
                        onClick={() => addTask(milestone.key)}
                      >
                        Thêm task
                      </Button>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Card>

          {/* Chat refine */}
          <Card title="Chỉnh sửa bằng chat" sx={{ mb: 3 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <TextField
                placeholder="Ví dụ: bỏ chứng chỉ cũ, sửa ngày dự án ABC thành 2023-06, thêm metric cho milestone X, thêm hoạt động volunteer 2024-06"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                fullWidth
                multiline
                minRows={2}
                disabled={busy}
              />
              <Button variant="contained" onClick={handleRefine} disabled={busy || !instruction.trim()}>
                Gửi
              </Button>
            </Stack>
            <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
              AI sẽ nhận toàn bộ đề xuất hiện tại + hướng dẫn của bạn và trả về bản cập nhật.
            </Typography>
          </Card>

          {busy ? <LinearProgress sx={{ mb: 2 }} /> : null}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button variant="contained" onClick={handleSave} disabled={busy || selectedCount === 0}>
              {busy ? 'Đang lưu...' : `Lưu ${selectedCount} thay đổi đã chọn`}
            </Button>
            <Button onClick={() => setStep(0)} disabled={busy}>
              Quay lại chỉnh nguồn
            </Button>
          </Stack>
        </>
      ) : null}

      {step === 2 ? (
        <Card>
          <Box
            sx={{
              py: 8,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              minHeight: 320,
            }}
          >
            {isSaving ? (
              <>
                <CircularProgress size={72} thickness={4} sx={{ mb: 3 }} />
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Đang lưu thay đổi vào hồ sơ...
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Vui lòng chờ trong giây lát
                </Typography>
                <LinearProgress sx={{ mt: 3, width: '50%', maxWidth: 280 }} />
              </>
            ) : (
              <>
                <CheckCircleIcon
                  sx={{
                    fontSize: 96,
                    color: 'success.main',
                    mb: 2,
                    animation: `${popAnimation} 0.4s ease-out`,
                  }}
                />
                <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
                  Cập nhật thành công!
                </Typography>
                {result && (
                  <Typography variant="body1" sx={{ mb: 3, maxWidth: 520, color: 'text.secondary' }}>
                    {result}
                  </Typography>
                )}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Button variant="contained" onClick={() => router.push('/profile')}>
                    Xem hồ sơ
                  </Button>
                  <Button onClick={resetAll}>Cập nhật thêm</Button>
                </Stack>
              </>
            )}
          </Box>
        </Card>
      ) : null}

      <ConfirmDialog
        open={Boolean(identityConfirm)}
        title="Tên không khớp với hồ sơ hiện tại"
        description={
          identityConfirm
            ? `Nguồn dữ liệu bạn cung cấp đề cập tên "${identityConfirm.detectedSourceName}", khác với tên trên hồ sơ của bạn ("${user?.name ?? 'chưa rõ'}"). Bạn có chắc đây là dữ liệu của chính mình và muốn tiếp tục nhập không?`
            : undefined
        }
        confirmLabel="Vẫn tiếp tục"
        cancelLabel="Bỏ qua"
        onConfirm={() => {
          if (!identityConfirm) return;
          setDrafts(identityConfirm.drafts);
          setStep(1);
          setIdentityConfirm(null);
        }}
        onCancel={() => setIdentityConfirm(null)}
      />
    </PageContainer>
  );
}
