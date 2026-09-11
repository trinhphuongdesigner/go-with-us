'use client';

import * as React from 'react';
import NextLink from 'next/link';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SendIcon from '@mui/icons-material/Send';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import MarkdownBlock from '@/components/ui/MarkdownBlock';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api/client';
import {
  askAssistant,
  deleteConversation,
  getConversation,
  listConversations,
  type AssistantConversation,
  type AssistantMessage,
  type ReferencedPerson,
} from '@/lib/api/assistantApi';
import { colorTokens } from '@/theme/theme';

const ADMIN_PROMPTS = [
  'Ai có kinh nghiệm React trên 2 năm và từng làm domain bất động sản?',
  'Who is the strongest backend candidate for a fintech project?',
  'List people with an English certificate above TOEIC 600.',
];

const EMPLOYEE_PROMPTS = [
  'Tôi nên trau dồi kỹ năng gì để lên Senior?',
  'What should my next development goal be?',
  'Summarise how I have grown this year.',
];

/**
 * M5 — one assistant, two audiences. Admins/sales get roster search grounded
 * in competency profiles; employees get a companion that only ever sees
 * their own record (the backend decides which, from the caller's role).
 */
export default function AssistantPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [conversations, setConversations] = React.useState<
    AssistantConversation[]
  >([]);
  const [conversationId, setConversationId] = React.useState<string | null>(
    null,
  );
  const [messages, setMessages] = React.useState<AssistantMessage[]>([]);
  const [referenced, setReferenced] = React.useState<ReferencedPerson[]>([]);
  const [question, setQuestion] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /** Keys the optimistic user bubble; a counter keeps render pure. */
  const pendingKey = React.useRef(0);

  const loadConversations = React.useCallback(async () => {
    try {
      setConversations(await listConversations());
    } catch {
      // The list is a convenience; a failure here should not block asking.
    }
  }, []);

  React.useEffect(() => {
    if (!user) return;
    // Wrapped so the initial fetch's setState lands after the effect.
    void (async () => {
      await loadConversations();
    })();
  }, [user, loadConversations]);

  const openConversation = async (id: string) => {
    setError(null);
    try {
      const conversation = await getConversation(id);
      setConversationId(conversation.id);
      setMessages(conversation.messages);
      setReferenced([]);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to open conversation',
      );
    }
  };

  const handleAsk = async (text?: string) => {
    const value = (text ?? question).trim();
    if (!value) return;

    setBusy(true);
    setError(null);
    // Optimistically show what was asked, so the thread reads naturally
    // while the model is still thinking.
    pendingKey.current += 1;
    const pending: AssistantMessage = {
      id: `pending-${pendingKey.current}`,
      conversationId: conversationId ?? '',
      role: 'user',
      content: value,
      referencedUserIds: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, pending]);
    setQuestion('');

    try {
      const result = await askAssistant({
        question: value,
        conversationId: conversationId ?? undefined,
      });
      setConversationId(result.conversationId);
      setMessages((prev) => [...prev, result.message]);
      setReferenced(result.referenced);
      await loadConversations();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== pending.id));
      setQuestion(value);
      setError(err instanceof ApiError ? err.message : 'The assistant failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteConversation(id);
      if (conversationId === id) {
        setConversationId(null);
        setMessages([]);
        setReferenced([]);
      }
      await loadConversations();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete');
    }
  };

  const startNew = () => {
    setConversationId(null);
    setMessages([]);
    setReferenced([]);
    setError(null);
  };

  const suggestions = isAdmin ? ADMIN_PROMPTS : EMPLOYEE_PROMPTS;

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="AI Assistant"
          subtitle={
            isAdmin
              ? 'Ask in plain language who fits a project — answers come from real competency profiles.'
              : 'Your personal career companion — grounded in your own record.'
          }
          actions={
            <Button variant="outlined" onClick={startNew}>
              New conversation
            </Button>
          }
        />

        {error ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        ) : null}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Card sx={{ mb: 3 }}>
              {messages.length === 0 ? (
                <Box sx={{ py: 2 }}>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Try one of these:
                  </Typography>
                  <Stack spacing={1}>
                    {suggestions.map((prompt) => (
                      <Button
                        key={prompt}
                        variant="outlined"
                        size="small"
                        sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
                        onClick={() => handleAsk(prompt)}
                        disabled={busy}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </Stack>
                </Box>
              ) : (
                <Stack spacing={2}>
                  {messages.map((message) => (
                    <Box
                      key={message.id}
                      sx={{
                        display: 'flex',
                        justifyContent:
                          message.role === 'user' ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <Box
                        sx={{
                          maxWidth: '85%',
                          px: 2,
                          py: 1.25,
                          borderRadius: 2,
                          backgroundColor:
                            message.role === 'user'
                              ? colorTokens.accent900
                              : colorTokens.bg,
                          border: `1px solid ${colorTokens.divider}`,
                        }}
                      >
                        {message.role === 'user' ? (
                          <Typography variant="body2">
                            {message.content}
                          </Typography>
                        ) : (
                          <MarkdownBlock source={message.content} />
                        )}
                      </Box>
                    </Box>
                  ))}
                </Stack>
              )}

              {busy ? <LinearProgress sx={{ mt: 2 }} /> : null}

              <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }}>
                <TextField
                  placeholder="Ask anything..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAsk();
                    }
                  }}
                  fullWidth
                  multiline
                  maxRows={4}
                  size="small"
                />
                <Box>
                  <Button
                    variant="contained"
                    endIcon={<SendIcon />}
                    onClick={() => handleAsk()}
                    disabled={busy || !question.trim()}
                  >
                    Ask
                  </Button>
                </Box>
              </Stack>
            </Card>

            {referenced.length > 0 ? (
              <Card title="People mentioned">
                <Stack spacing={1.5}>
                  {referenced.map((person) => (
                    <Box
                      key={person.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                      }}
                    >
                      <Avatar
                        src={person.avatarUrl ?? undefined}
                        sx={{ width: 36, height: 36, bgcolor: colorTokens.accent }}
                      >
                        {person.name?.[0]?.toUpperCase() ?? '?'}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {person.name}
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: 12.5 }}>
                          {person.jobTitle ?? 'No title'}
                        </Typography>
                      </Box>
                      <Button
                        component={NextLink}
                        href={`/employees/${person.id}`}
                        size="small"
                      >
                        Profile
                      </Button>
                      <Button
                        component={NextLink}
                        href={`/employees/${person.id}/passport`}
                        size="small"
                      >
                        Passport
                      </Button>
                    </Box>
                  ))}
                </Stack>
              </Card>
            ) : null}
          </Box>

          <Box sx={{ width: { xs: '100%', md: 280 }, flexShrink: 0 }}>
            <Card title="History">
              {conversations.length === 0 ? (
                <Typography variant="body2">No conversation yet.</Typography>
              ) : (
                <Stack spacing={0.5}>
                  {conversations.map((conversation) => (
                    <Box
                      key={conversation.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      <Button
                        size="small"
                        onClick={() => openConversation(conversation.id)}
                        sx={{
                          flex: 1,
                          justifyContent: 'flex-start',
                          textAlign: 'left',
                          textTransform: 'none',
                        }}
                      >
                        <Typography variant="body2" noWrap>
                          {conversation.title}
                        </Typography>
                      </Button>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(conversation.id)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>
              )}
              {conversationId ? (
                <Chip
                  label="Continuing this thread"
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ mt: 2 }}
                />
              ) : null}
            </Card>
          </Box>
        </Stack>
      </PageContainer>
    </AppShell>
  );
}
