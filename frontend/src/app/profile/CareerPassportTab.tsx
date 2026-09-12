'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import PageSkeleton from '@/components/ui/PageSkeleton';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import Card from '@/components/ui/Card';
import MarkdownBlock from '@/components/ui/MarkdownBlock';
import PassportView from '@/components/passport/PassportView';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api/client';
import {
  createEmployment,
  createPassportShare,
  generateCareerSummary,
  getCareerPassport,
  listCareerSummaries,
  listPassportShares,
  requestOffboardingSummary,
  revokePassportShare,
  saveCareerSummary,
  updateEmployment,
  type CareerPassport,
  type CareerSummary,
  type CareerSummaryProposal,
  type PassportShare,
} from '@/lib/api/careerPassportApi';
import OffboardingQueue from './OffboardingQueue';
import { isEmployeeRole } from '@/lib/roles';

/**
 * The Career Passport tab within My Profile — employment periods, the AI
 * recap of each one, and the share links that let a new employer read it.
 * Moved in from the old standalone /career-passport page (see AppShell nav
 * cleanup) so an employee has one place for their whole record.
 */
export default function CareerPassportTab() {
  const { user } = useAuth();
  const { ask, dialog } = useConfirmDialog();

  const [passport, setPassport] = React.useState<CareerPassport | null>(null);
  const [shares, setShares] = React.useState<PassportShare[]>([]);
  const [mySummaries, setMySummaries] = React.useState<CareerSummary[]>([]);
  const [requestingFor, setRequestingFor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // AI summary proposal — held in state only; saved on an explicit action.
  const [proposal, setProposal] = React.useState<CareerSummaryProposal | null>(
    null,
  );
  const [proposalFor, setProposalFor] = React.useState<string | null>(null);
  const [generatingFor, setGeneratingFor] = React.useState<string | null>(null);

  const [employmentOpen, setEmploymentOpen] = React.useState(false);
  const [jobTitle, setJobTitle] = React.useState('');
  const [level, setLevel] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [startDate, setStartDate] = React.useState('');

  const [shareLabel, setShareLabel] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, shareList, summaryList] = await Promise.all([
        getCareerPassport(),
        listPassportShares(),
        listCareerSummaries(),
      ]);
      setPassport(data);
      setShares(shareList);
      setMySummaries(summaryList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được hộ chiếu nghề nghiệp');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!user) return;
    // Wrapped so the initial fetch's setState lands after the effect.
    void (async () => {
      await load();
    })();
  }, [user, load]);

  const handleGenerate = async (employmentId: string) => {
    setGeneratingFor(employmentId);
    setError(null);
    setProposal(null);
    try {
      const result = await generateCareerSummary({ employmentId });
      setProposal(result);
      setProposalFor(employmentId);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Không tạo được tóm tắt',
      );
    } finally {
      setGeneratingFor(null);
    }
  };

  const handleSaveSummary = async () => {
    if (!proposal || !proposalFor) return;
    setBusy(true);
    setError(null);
    try {
      await saveCareerSummary({
        employmentId: proposalFor,
        content: proposal.content,
        strengths: proposal.strengths,
        growthAreas: proposal.growthAreas,
      });
      setProposal(null);
      setProposalFor(null);
      setNotice('Đã lưu tóm tắt vào hộ chiếu nghề nghiệp.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được tóm tắt');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestOffboarding = async (employmentId: string) => {
    setRequestingFor(employmentId);
    setError(null);
    try {
      await requestOffboardingSummary(employmentId);
      setNotice(
        'Đã gửi yêu cầu — quản trị sẽ xem và kích hoạt. Bạn có thể kiểm tra trạng thái tại đây.',
      );
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Không gửi được yêu cầu tóm tắt',
      );
    } finally {
      setRequestingFor(null);
    }
  };

  const handleAddEmployment = async () => {
    if (!jobTitle.trim() || !startDate) {
      setError('Cần có chức danh và ngày bắt đầu.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createEmployment({
        jobTitle: jobTitle.trim(),
        level: level.trim() || undefined,
        department: department.trim() || undefined,
        startDate: new Date(startDate).toISOString(),
      });
      setEmploymentOpen(false);
      setJobTitle('');
      setLevel('');
      setDepartment('');
      setStartDate('');
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Không thêm được kỳ làm việc',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleEndEmployment = async (employmentId: string) => {
    setBusy(true);
    setError(null);
    try {
      await updateEmployment(employmentId, {
        status: 'ENDED',
        endDate: new Date().toISOString(),
      });
      setNotice(
        'Đã đóng kỳ. Các đánh giá đã duyệt vẫn nằm trên hồ sơ của bạn.',
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không đóng được kỳ');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateShare = async () => {
    setBusy(true);
    setError(null);
    try {
      await createPassportShare({ label: shareLabel.trim() || undefined });
      setShareLabel('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tạo được liên kết');
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokePassportShare(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thu hồi được liên kết');
    }
  };

  const shareUrl = (token: string) =>
    typeof window === 'undefined'
      ? `/passport/${token}`
      : `${window.location.origin}/passport/${token}`;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setEmploymentOpen(true)}
        >
          Thêm kỳ làm việc
        </Button>
      </Box>

      {error ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      ) : null}
      {notice ? (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      ) : null}
      {loading ? (
        <PageSkeleton variant="cards" />
      ) : (
        <>
      {user?.role === 'HR' || user?.role === 'BOD' || user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN' ? (
        <OffboardingQueue />
      ) : null}

      {proposal ? (
        <Card
          title="Đề xuất tóm tắt AI"
          sx={{ mb: 3 }}
          actions={
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={() => setProposal(null)}>
                Bỏ qua
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleSaveSummary}
                disabled={busy}
              >
                Lưu vào hộ chiếu
              </Button>
            </Stack>
          }
        >
          <Alert severity="info" sx={{ mb: 2 }}>
            Chưa lưu gì cho đến khi bạn nhấn lưu.
          </Alert>
          <MarkdownBlock source={proposal.content} />
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75, mt: 2 }}>
            {proposal.strengths.map((strength) => (
              <Chip key={strength} label={strength} size="small" color="success" variant="outlined" />
            ))}
            {proposal.growthAreas.map((area) => (
              <Chip key={area} label={area} size="small" variant="outlined" />
            ))}
          </Stack>
        </Card>
      ) : null}

      {passport ? (
        <PassportView
          passport={passport}
          actionsFor={(period) => (
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                startIcon={<AutoAwesomeOutlinedIcon />}
                onClick={() => handleGenerate(period.id)}
                disabled={generatingFor === period.id}
              >
                {generatingFor === period.id
                  ? 'Đang viết...'
                  : period.summary
                    ? 'Tạo lại'
                    : 'Tóm tắt AI'}
              </Button>
              {period.status === 'ACTIVE' ? (
                <Button
                  size="small"
                  color="error"
                  onClick={() => handleEndEmployment(period.id)}
                  disabled={busy}
                >
                  Kết thúc kỳ
                </Button>
              ) : null}
              {period.status === 'ENDED'
                ? (() => {
                    const pendingRequest = mySummaries.find(
                      (s) =>
                        s.employmentId === period.id &&
                        s.source === 'ORGANIZATION_OFFBOARDING' &&
                        s.status === 'DRAFT',
                    );
                    if (pendingRequest) {
                      return (
                        <Chip
                          size="small"
                          label={
                            pendingRequest.generatedAt
                              ? 'Tóm tắt tổ chức: chờ quản trị xem'
                              : 'Tóm tắt tổ chức: đã yêu cầu — chờ quản trị'
                          }
                          color="warning"
                        />
                      );
                    }
                    return (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleRequestOffboarding(period.id)}
                        disabled={requestingFor === period.id}
                      >
                        {requestingFor === period.id
                          ? 'Đang gửi...'
                          : 'Yêu cầu tóm tắt tổ chức'}
                      </Button>
                    );
                  })()
                : null}
            </Stack>
          )}
        />
      ) : null}

      <Card title="Liên kết chia sẻ" sx={{ mt: 3 }}>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Gửi nhà tuyển dụng tương lai một liên kết chỉ đọc tới hộ chiếu này.
          Bạn có thể thu hồi bất cứ lúc nào.
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
          <TextField
            label="Nhãn"
            placeholder="Ứng tuyển vào ..."
            value={shareLabel}
            onChange={(e) => setShareLabel(e.target.value)}
            size="small"
            fullWidth
          />
          <Box>
            <Button variant="contained" onClick={handleCreateShare} disabled={busy}>
              Tạo liên kết
            </Button>
          </Box>
        </Stack>

        {shares.length === 0 ? (
          <Typography variant="body2">Chưa tạo liên kết chia sẻ nào.</Typography>
        ) : (
          <Stack divider={<Divider />} spacing={1.5}>
            {shares.map((share) => (
              <Box
                key={share.id}
                sx={{
                  pt: 1,
                  display: 'flex',
                  alignItems: { sm: 'center' },
                  justifyContent: 'space-between',
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 1,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {share.label ?? 'Liên kết chưa đặt tên'}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontSize: 12.5, wordBreak: 'break-all' }}
                  >
                    {shareUrl(share.token)}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Chip
                    label={share.revokedAt ? 'Đã thu hồi' : `${share.viewCount} lượt xem`}
                    size="small"
                    color={share.revokedAt ? 'default' : 'success'}
                  />
                  <Button
                    size="small"
                    startIcon={<ContentCopyOutlinedIcon />}
                    onClick={() => {
                      navigator.clipboard?.writeText(shareUrl(share.token));
                      setNotice('Đã sao chép liên kết.');
                    }}
                  >
                    Sao chép
                  </Button>
                  {!share.revokedAt ? (
                    <Button
                      size="sm"
                      color="error"
                      onClick={() =>
                        ask({
                          title: 'Thu hồi liên kết',
                          description: 'Ai đang có liên kết này sẽ mất quyền truy cập ngay.',
                          confirmLabel: 'Thu hồi',
                          danger: true,
                          onConfirm: () => handleRevoke(share.id),
                        })
                      }
                    >
                      Thu hồi
                    </Button>
                  ) : null}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Card>
        </>
      )}

      <Dialog
        open={employmentOpen}
        onClose={() => setEmploymentOpen(false)}
        title="Thêm kỳ làm việc"
        actions={
          <>
            <Button variant="text" onClick={() => setEmploymentOpen(false)}>
              Hủy
            </Button>
            <Button variant="contained" onClick={handleAddEmployment} disabled={busy}>
              {busy ? 'Đang lưu...' : 'Thêm'}
            </Button>
          </>
        }
      >
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Chức danh"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              required
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Cấp bậc"
                placeholder="Junior / Middle / Senior"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                fullWidth
              />
              <TextField
                label="Phòng ban"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                fullWidth
              />
            </Stack>
            <TextField
              label="Ngày bắt đầu"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              required
              fullWidth
            />
          </Stack>
      </Dialog>
      {dialog}
    </Box>
  );
}
