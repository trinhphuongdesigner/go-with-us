'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@/components/ui/Button';
import Drawer from '@mui/material/Drawer';
import Fab from '@mui/material/Fab';
import IconButton from '@/components/ui/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import AddCommentOutlinedIcon from '@mui/icons-material/AddCommentOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import SendIcon from '@mui/icons-material/Send';
import MarkdownBlock from '@/components/ui/MarkdownBlock';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api/client';
import { ADMIN_PROMPTS, EMPLOYEE_PROMPTS } from '@/lib/assistantPrompts';
import {
  askAssistant,
  deleteConversation,
  getConversation,
  listConversations,
  updateConversation,
  type AssistantConversation,
  type AssistantMessage,
} from '@/lib/api/assistantApi';
import { colorTokens, radiusTokens, shadowTokens } from '@/theme/theme';

const PANEL_Z_INDEX = 1200;

/**
 * Cross-cutting AI assistant, pinned bottom-right on every authenticated
 * page. Mounted from app/layout.tsx (not AppShell) so its state survives
 * in-app navigation — see the plan note on why. State is intentionally
 * never persisted to localStorage: a reload or new tab is meant to start a
 * fresh session, same as clicking "New chat".
 */
export default function FloatingAssistant() {
  const { ask, dialog } = useConfirmDialog();
  const { user, loading } = useAuth();
  const isAdmin = user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [panelOpen, setPanelOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [conversations, setConversations] = React.useState<AssistantConversation[]>([]);
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<AssistantMessage[]>([]);
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

  const openHistory = () => {
    setHistoryOpen(true);
    void loadConversations();
  };

  const openConversation = async (id: string) => {
    setError(null);
    try {
      const conversation = await getConversation(id);
      setConversationId(conversation.id);
      setMessages(conversation.messages);
      setHistoryOpen(false);
      setPanelOpen(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không mở được cuộc trò chuyện');
    }
  };

  const handleNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setQuestion('');
    setError(null);
    setHistoryOpen(false);
    setPanelOpen(true);
  };

  const handleAsk = async (text?: string) => {
    const value = (text ?? question).trim();
    if (!value) return;

    setBusy(true);
    setError(null);
    pendingKey.current += 1;
    const pending: AssistantMessage = {
      id: `pending-${pendingKey.current}`,
      conversationId: conversationId ?? '',
      role: 'user',
      content: value,
      referencedUserIds: [],
      proposalData: null,
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
      await loadConversations();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== pending.id));
      setQuestion(value);
      setError(err instanceof ApiError ? err.message : 'Trợ lý không trả lời được');
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
      }
      await loadConversations();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không xóa được');
    }
  };

  const handleTogglePin = async (conversation: AssistantConversation) => {
    try {
      await updateConversation(conversation.id, { pinned: !conversation.pinned });
      await loadConversations();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không cập nhật được ghim');
    }
  };

  // Hides on /login and the public /passport/[token] route for free, since
  // there is no authenticated user there.
  if (loading || !user) return null;

  const suggestions = isAdmin ? ADMIN_PROMPTS : EMPLOYEE_PROMPTS;

  return (
    <>
      {!panelOpen ? (
        <Tooltip title="Trợ lý AI" placement="left">
          <Fab
            onClick={() => setPanelOpen(true)}
            sx={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: PANEL_Z_INDEX,
              backgroundColor: colorTokens.primary,
              color: '#fff',
              '&:hover': { backgroundColor: colorTokens.primary },
            }}
          >
            <AutoAwesomeOutlinedIcon />
          </Fab>
        </Tooltip>
      ) : (
        <Box
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: PANEL_Z_INDEX,
            width: { xs: 'calc(100vw - 32px)', sm: 380 },
            height: { xs: 'calc(100vh - 48px)', sm: 'min(640px, 85vh)' },
            maxHeight: { xs: 'calc(100vh - 48px)', sm: '85vh' },
            display: 'flex',
            flexDirection: 'column',
            borderRadius: `${radiusTokens.lg}px`,
            boxShadow: shadowTokens.lg,
            backgroundColor: colorTokens.surface,
            border: `1px solid ${colorTokens.border}`,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 2,
              py: 1.5,
              borderBottom: `1px solid ${colorTokens.border}`,
            }}
          >
            <Tooltip title="Lịch sử">
              <IconButton size="small" onClick={openHistory}>
                <MenuOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Typography sx={{ flex: 1, fontWeight: 600, fontSize: 14.5, color: colorTokens.heading }}>
              Trợ lý AI
            </Typography>
            <Tooltip title="Chat mới">
              <IconButton size="small" onClick={handleNewChat}>
                <AddCommentOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Đóng">
              <IconButton size="small" onClick={() => setPanelOpen(false)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', px: 2, py: 1.5 }}>
            {error ? (
              <Typography variant="body2" sx={{ color: colorTokens.danger, mb: 1.5 }}>
                {error}
              </Typography>
            ) : null}

            {messages.length === 0 ? (
              <Stack spacing={1}>
                <Typography variant="body2">Thử một trong các câu này:</Typography>
                {suggestions.map((prompt) => (
                  <Button
                    key={prompt}
                    variant="outlined"
                    size="small"
                    fullWidth
                    sx={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      textTransform: 'none',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                    }}
                    onClick={() => handleAsk(prompt)}
                    disabled={busy}
                  >
                    {prompt}
                  </Button>
                ))}
              </Stack>
            ) : (
              <Stack spacing={1.5}>
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
                        maxWidth: '88%',
                        minWidth: 0,
                        px: 1.5,
                        py: 1,
                        borderRadius: 2,
                        backgroundColor: message.role === 'user' ? colorTokens.primarySubtle : colorTokens.canvas,
                        border: `1px solid ${colorTokens.border}`,
                        overflowWrap: 'break-word',
                        wordBreak: 'break-word',
                      }}
                    >
                      {message.role === 'user' ? (
                        <Typography variant="body2">{message.content}</Typography>
                      ) : (
                        <MarkdownBlock source={message.content} />
                      )}
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}
            {busy ? <LinearProgress sx={{ mt: 1.5 }} /> : null}
          </Box>

          <Stack
            direction="row"
            spacing={1}
            sx={{ p: 1.5, borderTop: `1px solid ${colorTokens.border}` }}
          >
            <TextField
              placeholder="Hỏi bất cứ điều gì..."
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
            <IconButton
              color="primary"
              onClick={() => handleAsk()}
              disabled={busy || !question.trim()}
            >
              <SendIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>
      )}

      <Drawer anchor="right" open={historyOpen} onClose={() => setHistoryOpen(false)}>
        <Box sx={{ width: 320, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 2,
              borderBottom: `1px solid ${colorTokens.border}`,
            }}
          >
            <Typography sx={{ flex: 1, fontWeight: 600 }}>Lịch sử</Typography>
            <IconButton size="small" onClick={() => setHistoryOpen(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box sx={{ p: 1.5 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<AddCommentOutlinedIcon fontSize="small" />}
              onClick={handleNewChat}
              sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
            >
              Chat mới
            </Button>
          </Box>

          <Stack spacing={0.5} sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1.5 }}>
            {conversations.length === 0 ? (
              <Typography variant="body2" sx={{ px: 0.5 }}>
                Chưa có cuộc trò chuyện nào.
              </Typography>
            ) : (
              conversations.map((conversation) => (
                <Box key={conversation.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <Button
                    size="small"
                    onClick={() => openConversation(conversation.id)}
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      textTransform: 'none',
                      display: 'block',
                    }}
                  >
                    <Typography variant="body2" noWrap>
                      {conversation.title}
                    </Typography>
                    <Typography variant="body2" noWrap sx={{ fontSize: 11, color: colorTokens.secondary }}>
                      {new Date(conversation.updatedAt).toLocaleString('vi-VN')}
                    </Typography>
                  </Button>
                  <IconButton size="small" onClick={() => handleTogglePin(conversation)}>
                    {conversation.pinned ? (
                      <PushPinIcon fontSize="small" color="primary" />
                    ) : (
                      <PushPinOutlinedIcon fontSize="small" />
                    )}
                  </IconButton>
                  <IconButton
                    size="sm"
                    aria-label="Xóa cuộc trò chuyện"
                    onClick={() =>
                      ask({
                        title: 'Xóa cuộc trò chuyện',
                        description: `Xóa “${conversation.title}”? Hành động này không thể hoàn tác.`,
                        confirmLabel: 'Xóa',
                        danger: true,
                        onConfirm: () => handleDelete(conversation.id),
                      })
                    }
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Box>
              ))
            )}
          </Stack>
        </Box>
      </Drawer>
      {dialog}
    </>
  );
}
