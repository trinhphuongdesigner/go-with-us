'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@/components/ui/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@/components/ui/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import SendIcon from '@mui/icons-material/Send';
import { ApiError } from '@/lib/api/client';
import {
  askAssistant,
  type AssistantMessage,
  type RoadmapProposal,
} from '@/lib/api/assistantApi';
import { saveRoadmap, type SaveRoadmapPayload } from '@/lib/api/developmentPlansApi';
import { colorTokens } from '@/theme/theme';

type DraftTask = { title: string; metric: string };
type DraftMilestone = {
  title: string;
  description: string;
  dueDate: string;
  tasks: DraftTask[];
};

const toDraft = (proposal: RoadmapProposal): DraftMilestone[] =>
  proposal.milestones.map((m) => ({
    title: m.title,
    description: m.description ?? '',
    dueDate: m.dueDate ?? '',
    tasks: m.tasks.map((t) => ({ title: t.title, metric: t.metric ?? '' })),
  }));

/**
 * ROADMAP-focus assistant — auto-collects the user's own profile as
 * context (backend side), asks a clarifying question when it doesn't have
 * enough to work with, and otherwise proposes milestones/tasks the user
 * can edit right here before committing them as real records.
 */
export default function RoadmapAssistant({
  onSaved,
}: {
  onSaved: () => void;
}) {
  const [conversationId, setConversationId] = React.useState<string | null>(
    null,
  );
  const [messages, setMessages] = React.useState<AssistantMessage[]>([]);
  const [question, setQuestion] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<DraftMilestone[] | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const handleAsk = async (text?: string) => {
    const value = (text ?? question).trim();
    if (!value) return;

    setBusy(true);
    setError(null);
    setSaved(false);
    setQuestion('');

    try {
      const result = await askAssistant({
        question: value,
        conversationId: conversationId ?? undefined,
        focus: conversationId ? undefined : 'ROADMAP',
      });
      setConversationId(result.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          id: `you-${prev.length}`,
          conversationId: result.conversationId,
          role: 'user',
          content: value,
          referencedUserIds: [],
          proposalData: null,
          createdAt: new Date().toISOString(),
        },
        result.message,
      ]);
      if (result.message.proposalData) {
        setDraft(toDraft(result.message.proposalData));
      }
    } catch (err) {
      setQuestion(value);
      setError(err instanceof ApiError ? err.message : 'Trợ lý không trả lời được');
    } finally {
      setBusy(false);
    }
  };

  const patchMilestone = (index: number, patch: Partial<DraftMilestone>) => {
    if (!draft) return;
    setDraft(draft.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };

  const patchTask = (
    milestoneIndex: number,
    taskIndex: number,
    patch: Partial<DraftTask>,
  ) => {
    if (!draft) return;
    setDraft(
      draft.map((m, i) =>
        i === milestoneIndex
          ? {
              ...m,
              tasks: m.tasks.map((t, ti) =>
                ti === taskIndex ? { ...t, ...patch } : t,
              ),
            }
          : m,
      ),
    );
  };

  const handleSave = async () => {
    if (!draft) return;
    const payload: SaveRoadmapPayload = {
      milestones: draft
        .filter((m) => m.title.trim())
        .map((m) => ({
          title: m.title.trim(),
          description: m.description.trim() || undefined,
          dueDate: m.dueDate || undefined,
          tasks: m.tasks
            .filter((t) => t.title.trim())
            .map((t) => ({
              title: t.title.trim(),
              metric: t.metric.trim() || undefined,
            })),
        }))
        .filter((m) => m.tasks.length > 0),
    };
    if (payload.milestones.length === 0) {
      setError('Thêm ít nhất một cột mốc với một nhiệm vụ trước khi lưu.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveRoadmap(payload);
      setDraft(null);
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được lộ trình');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      {saved ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaved(false)}>
          Đã lưu lộ trình — xem ở Cột mốc phía trên.
        </Alert>
      ) : null}

      {messages.length === 0 ? (
        <Typography variant="body2" sx={{ mb: 2 }}>
          Nói với trợ lý bạn muốn phát triển thành gì — nó đã biết kỹ năng và
          mục tiêu của bạn, không cần nhắc lại.
        </Typography>
      ) : (
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          {messages.map((message) => (
            <Box
              key={message.id}
              sx={{
                display: 'flex',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <Box
                sx={{
                  maxWidth: '85%',
                  px: 1.75,
                  py: 1,
                  borderRadius: 2,
                  backgroundColor:
                    message.role === 'user' ? colorTokens.accent900 : colorTokens.bg,
                  border: `1px solid ${colorTokens.divider}`,
                }}
              >
                <Typography variant="body2">{message.content}</Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      )}

      {busy ? <LinearProgress sx={{ mb: 2 }} /> : null}

      <Stack direction="row" spacing={1.5} sx={{ mb: 3 }}>
        <TextField
          placeholder="ví dụ Tôi muốn trở thành tech lead trong năm tới"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleAsk();
            }
          }}
          fullWidth
          size="small"
        />
        <Button
          variant="contained"
          endIcon={<SendIcon />}
          onClick={() => handleAsk()}
          disabled={busy || !question.trim()}
        >
          Gửi
        </Button>
      </Stack>

      {draft ? (
        <Box>
          <Typography variant="body1" sx={{ fontWeight: 600, mb: 1.5 }}>
            Lộ trình đề xuất — sửa trước khi lưu
          </Typography>
          <Stack spacing={2}>
            {draft.map((milestone, mIndex) => (
              <Box
                key={mIndex}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: `1px solid ${colorTokens.divider}`,
                }}
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <TextField
                    label={`Cột mốc ${mIndex + 1}`}
                    value={milestone.title}
                    onChange={(e) => patchMilestone(mIndex, { title: e.target.value })}
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Hạn"
                    type="date"
                    value={milestone.dueDate}
                    onChange={(e) =>
                      patchMilestone(mIndex, { dueDate: e.target.value })
                    }
                    size="small"
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: { xs: '100%', sm: 180 } }}
                  />
                  <IconButton
                    onClick={() => setDraft(draft.filter((_, i) => i !== mIndex))}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <TextField
                  label="Mô tả"
                  value={milestone.description}
                  onChange={(e) =>
                    patchMilestone(mIndex, { description: e.target.value })
                  }
                  size="small"
                  fullWidth
                  sx={{ mt: 1.5 }}
                />

                <Stack spacing={1} sx={{ mt: 2, pl: 1 }}>
                  {milestone.tasks.map((task, tIndex) => (
                    <Stack key={tIndex} direction="row" spacing={1}>
                      <Chip label={`Nhiệm vụ ${tIndex + 1}`} size="small" sx={{ mt: 0.5 }} />
                      <TextField
                        label="Nhiệm vụ"
                        value={task.title}
                        onChange={(e) =>
                          patchTask(mIndex, tIndex, { title: e.target.value })
                        }
                        size="small"
                        fullWidth
                      />
                      <TextField
                        label="Cách đo"
                        value={task.metric}
                        onChange={(e) =>
                          patchTask(mIndex, tIndex, { metric: e.target.value })
                        }
                        size="small"
                        fullWidth
                      />
                      <IconButton
                        onClick={() =>
                          patchMilestone(mIndex, {
                            tasks: milestone.tasks.filter((_, i) => i !== tIndex),
                          })
                        }
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() =>
                      patchMilestone(mIndex, {
                        tasks: [...milestone.tasks, { title: '', metric: '' }],
                      })
                    }
                  >
                    Thêm nhiệm vụ
                  </Button>
                </Stack>
              </Box>
            ))}
          </Stack>

          <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() =>
                setDraft([
                  ...draft,
                  { title: '', description: '', dueDate: '', tasks: [] },
                ])
              }
            >
              Thêm cột mốc
            </Button>
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu lộ trình'}
            </Button>
            <Button onClick={() => setDraft(null)} disabled={saving}>
              Bỏ qua
            </Button>
          </Stack>
        </Box>
      ) : null}
    </Box>
  );
}

