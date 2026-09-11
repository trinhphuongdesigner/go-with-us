'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SendIcon from '@mui/icons-material/Send';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import { askAssistant, type AssistantMessage } from '@/lib/api/assistantApi';
import {
  saveRoadmap,
  type DevelopmentMilestone,
  type SaveRoadmapPayload,
} from '@/lib/api/developmentPlansApi';
import { colorTokens } from '@/theme/theme';
import RoadmapDraftEditor, {
  toDraft,
  reviewPayload,
  type DraftMilestone,
} from './RoadmapDraftEditor';

/** ROADMAP conversations return proposals; only the confirmation dialog can save. */
export default function RoadmapAssistant({
  onSaved,
  existingMilestones,
}: {
  onSaved: (milestones: DevelopmentMilestone[]) => void;
  existingMilestones: DevelopmentMilestone[] | null;
}) {
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<AssistantMessage[]>([]);
  const [question, setQuestion] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<DraftMilestone[] | null>(null);
  const [preview, setPreview] = React.useState<SaveRoadmapPayload | null>(null);
  const [replaceConfirmed, setReplaceConfirmed] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const requestPending = React.useRef(false);
  const savePending = React.useRef(false);
  const draftRef = React.useRef<HTMLDivElement>(null);
  const existingCount = existingMilestones?.length ?? 0;
  const completedTasks =
    existingMilestones?.flatMap((m) => m.tasks).filter((task) => task.done).length ?? 0;

  const handleAsk = async () => {
    const value = question.trim();
    if (!value || requestPending.current || savePending.current || draft) return;
    requestPending.current = true;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const result = await askAssistant({
        question: value,
        conversationId: conversationId ?? undefined,
        focus: conversationId ? undefined : 'ROADMAP',
      });
      setConversationId(result.conversationId);
      setQuestion('');
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
        requestAnimationFrame(() => draftRef.current?.focus());
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'The assistant could not respond. Please try again.',
      );
    } finally {
      requestPending.current = false;
      setBusy(false);
    }
  };

  const handleReview = () => {
    if (!draft || !existingMilestones) return;
    setError(null);
    try {
      setPreview(reviewPayload(draft));
      setReplaceConfirmed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review the selected milestones.');
    }
  };

  const handleSave = async () => {
    if (
      !preview ||
      savePending.current ||
      !existingMilestones ||
      (existingCount > 0 && !replaceConfirmed)
    )
      return;
    savePending.current = true;
    setSaving(true);
    setError(null);
    try {
      const milestones = await saveRoadmap(preview);
      onSaved(milestones);
      setPreview(null);
      setDraft(null);
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save roadmap. Your proposal is still here.',
      );
    } finally {
      savePending.current = false;
      setSaving(false);
    }
  };

  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{ mb: 1.5, alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
      >
        <Chip
          icon={<AutoAwesomeOutlinedIcon />}
          label="Roadmap assistant"
          size="small"
          variant="outlined"
        />
        <Typography variant="body2">Discuss → Review → Confirm</Typography>
      </Stack>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Your profile, skills and goals provide the context. Tell the assistant your target role and
        timeframe; it will ask when more detail is needed.
      </Typography>
      {error && !preview ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      {saved ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaved(false)}>
          Roadmap saved. Your milestones above are ready to track.
        </Alert>
      ) : null}
      <Stack
        role="log"
        aria-label="Roadmap conversation"
        spacing={1.5}
        sx={{ maxHeight: 360, overflowY: 'auto', mb: 2 }}
      >
        {messages.map((message) => (
          <Box
            key={message.id}
            sx={{
              alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '95%',
              px: 2,
              py: 1.5,
              borderRadius: 2,
              bgcolor: message.role === 'user' ? colorTokens.accent900 : colorTokens.bg,
            }}
          >
            <Typography sx={{ fontSize: 11, fontWeight: 600, mb: 0.5 }}>
              {message.role === 'user' ? 'You' : 'Roadmap assistant'}
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {message.content}
            </Typography>
          </Box>
        ))}
      </Stack>
      {busy ? <LinearProgress aria-label="Waiting for roadmap suggestions" sx={{ mb: 2 }} /> : null}
      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          void handleAsk();
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
          <TextField
            label="Your roadmap goal"
            placeholder="e.g. Grow into a Principal Architect role in 18 months"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            fullWidth
            size="small"
            disabled={busy || saving || !!draft}
            multiline
            maxRows={4}
            helperText={
              draft ? 'Review or discard the proposal to continue the conversation.' : undefined
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void handleAsk();
              }
            }}
          />
          <Button
            type="submit"
            variant="contained"
            endIcon={<SendIcon />}
            disabled={busy || saving || !!draft || !question.trim()}
            sx={{ alignSelf: { sm: 'flex-start' } }}
          >
            Send
          </Button>
        </Stack>
      </Box>
      {draft ? (
        <Box ref={draftRef} tabIndex={-1} sx={{ scrollMarginTop: 24 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Proposal only. Select what to keep, edit the details and review before saving.
          </Alert>
          <RoadmapDraftEditor draft={draft} onChange={setDraft} disabled={saving || !!preview} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
            <Button
              variant="contained"
              onClick={handleReview}
              disabled={saving || !existingMilestones}
            >
              Review proposal
            </Button>
            <Button
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
              disabled={saving}
            >
              Discard proposal
            </Button>
          </Stack>
          {!existingMilestones ? (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Load your current roadmap above before reviewing a replacement.
            </Typography>
          ) : null}
        </Box>
      ) : null}
      <Dialog
        open={!!preview}
        onClose={() => {
          if (!saving) setPreview(null);
        }}
        maxWidth="md"
        fullWidth
        aria-labelledby="roadmap-preview-title"
      >
        <DialogTitle id="roadmap-preview-title">Review your roadmap</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {preview?.milestones.length} milestones ·{' '}
            {preview?.milestones.reduce((sum, m) => sum + m.tasks.length, 0)} tasks selected
          </Typography>
          <Stack spacing={2}>
            {preview?.milestones.map((milestone, index) => (
              <Box key={index} sx={{ p: 2, bgcolor: colorTokens.bg, borderRadius: 2 }}>
                <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                  {index + 1}. {milestone.title}
                </Typography>
                <Typography variant="body2">
                  {milestone.dueDate ? `Deadline: ${milestone.dueDate}` : 'No deadline set'}
                </Typography>
                {milestone.description ? (
                  <Typography variant="body2" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
                    {milestone.description}
                  </Typography>
                ) : null}
                <Box component="ul" sx={{ pl: 2.5, mb: 0 }}>
                  {milestone.tasks.map((task, taskIndex) => (
                    <Box component="li" key={taskIndex} sx={{ mb: 1, overflowWrap: 'anywhere' }}>
                      <Typography variant="body2" sx={{ color: colorTokens.text }}>
                        {task.title}
                      </Typography>
                      <Typography variant="body2">Success metric: {task.metric}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Stack>
          {existingCount > 0 ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This replaces your {existingCount} current milestones and their tasks, including{' '}
              {completedTasks} completed tasks. The new roadmap starts at 0%.
              <FormControlLabel
                sx={{ display: 'flex', mt: 1 }}
                control={
                  <Checkbox
                    checked={replaceConfirmed}
                    disabled={saving}
                    onChange={(event) => setReplaceConfirmed(event.target.checked)}
                  />
                }
                label="I agree to replace my current roadmap and reset its task progress."
              />
            </Alert>
          ) : null}
          {error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ p: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => setPreview(null)} disabled={saving}>
            Back to editing
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSave()}
            disabled={saving || (existingCount > 0 && !replaceConfirmed)}
          >
            {saving ? 'Saving…' : 'Confirm and save roadmap'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
