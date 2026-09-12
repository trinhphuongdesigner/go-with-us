'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { colorTokens } from '@/theme/theme';

export interface MilestoneItem {
  id: string;
  order: number;
  title: string;
  status: 'done' | 'in_progress' | 'upcoming';
}

export interface CustomizationSettings {
  companion: 'milo' | 'an' | 'none';
  outfitColor: string;
  reducedMotion: boolean;
}

function CustomizationContent({
  milestones,
  onSaveMilestones,
  settings,
  onSaveSettings,
  onClose,
}: {
  milestones: MilestoneItem[];
  onSaveMilestones: (newMilestones: MilestoneItem[]) => void;
  settings: CustomizationSettings;
  onSaveSettings: (newSettings: CustomizationSettings) => void;
  onClose: () => void;
}) {
  const [localMilestones, setLocalMilestones] = React.useState<MilestoneItem[]>(milestones);
  const [localCompanion, setLocalCompanion] = React.useState<'milo' | 'an' | 'none'>(settings.companion);
  const [localOutfitColor, setLocalOutfitColor] = React.useState<string>(settings.outfitColor);
  const [localReducedMotion, setLocalReducedMotion] = React.useState<boolean>(settings.reducedMotion);

  const moveMilestone = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= localMilestones.length) return;
    const updated = [...localMilestones];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setLocalMilestones(updated.map((item, idx) => ({ ...item, order: idx + 1 })));
  };

  const handleSave = () => {
    onSaveMilestones(localMilestones);
    onSaveSettings({
      companion: localCompanion,
      outfitColor: localOutfitColor,
      reducedMotion: localReducedMotion,
    });
    onClose();
  };

  const outfitColors = [
    { label: 'Tím CareerMate', hex: '#6d5bd0' },
    { label: 'Xanh ngọc', hex: '#10b981' },
    { label: 'Cam năng động', hex: '#f59e0b' },
  ];

  return (
    <>
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '12px',
              bgcolor: '#faf5ff',
              color: '#6d5bd0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TuneRoundedIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: colorTokens.text }}>
              Tùy chỉnh lộ trình phát triển
            </Typography>
            <Typography sx={{ fontSize: 12, color: colorTokens.neutral400 }}>
              Điều chỉnh thứ tự và trải nghiệm tương tác với nhân vật đồng hành
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} size="small" sx={{ color: colorTokens.neutral400 }}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ py: 2.5 }}>
        <Stack spacing={3.5}>
          {/* Section 1: Reorder milestones */}
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: colorTokens.text, mb: 1 }}>
              1. Sắp xếp thứ tự các cột mốc
            </Typography>
            <Typography sx={{ fontSize: 12, color: colorTokens.neutral400, mb: 2 }}>
              Thay đổi thứ tự ưu tiên các bước học tập và rèn luyện của bạn.
            </Typography>

            <Stack spacing={1.5}>
              {localMilestones.map((item, index) => (
                <Box
                  key={item.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1.5,
                    borderRadius: '12px',
                    bgcolor: '#fafafc',
                    border: '1px solid #e8e7f0',
                  }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        bgcolor: item.status === 'done' ? '#dcfce7' : item.status === 'in_progress' ? '#faf5ff' : '#f1f5f9',
                        color: item.status === 'done' ? '#15803d' : item.status === 'in_progress' ? '#6d5bd0' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {index + 1}
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: colorTokens.text }}>
                        {item.title}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: colorTokens.neutral400 }}>
                        {item.status === 'done' ? 'Đã hoàn thành' : item.status === 'in_progress' ? 'Đang thực hiện' : 'Sắp tới'}
                      </Typography>
                    </Box>
                  </Stack>

                  <Stack direction="row" spacing={0.5}>
                    <IconButton
                      size="small"
                      disabled={index === 0}
                      onClick={() => moveMilestone(index, 'up')}
                      sx={{ color: colorTokens.neutral400 }}
                    >
                      <ArrowUpwardRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      disabled={index === localMilestones.length - 1}
                      onClick={() => moveMilestone(index, 'down')}
                      sx={{ color: colorTokens.neutral400 }}
                    >
                      <ArrowDownwardRoundedIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>

          {/* Section 2: Companion Selector */}
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: colorTokens.text, mb: 1 }}>
              2. Chọn bạn đồng hành AI (Companion)
            </Typography>
            <Typography sx={{ fontSize: 12, color: colorTokens.neutral400, mb: 2 }}>
              Chọn nhân vật hướng dẫn mang phong cách phù hợp nhất với bạn.
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
              {/* Option 1: Milo */}
              <Box
                onClick={() => setLocalCompanion('milo')}
                sx={{
                  p: 2,
                  borderRadius: '16px',
                  border: `2px solid ${localCompanion === 'milo' ? '#6d5bd0' : '#e8e7f0'}`,
                  bgcolor: localCompanion === 'milo' ? '#faf5ff' : '#ffffff',
                  textAlign: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                  '&:hover': { borderColor: '#6d5bd0' },
                }}
              >
                {localCompanion === 'milo' && (
                  <CheckCircleRoundedIcon
                    sx={{ position: 'absolute', top: 8, right: 8, fontSize: 18, color: '#6d5bd0' }}
                  />
                )}
                <Box
                  component="img"
                  src="/milo-avatar.png"
                  alt="Milo"
                  sx={{ width: 52, height: 52, borderRadius: '50%', mx: 'auto', mb: 1, objectFit: 'cover' }}
                />
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: colorTokens.text }}>
                  Milo (Cáo)
                </Typography>
                <Typography sx={{ fontSize: 11, color: colorTokens.neutral400, mt: 0.5 }}>
                  Năng động, động viên tích cực
                </Typography>
              </Box>

              {/* Option 2: An */}
              <Box
                onClick={() => setLocalCompanion('an')}
                sx={{
                  p: 2,
                  borderRadius: '16px',
                  border: `2px solid ${localCompanion === 'an' ? '#6d5bd0' : '#e8e7f0'}`,
                  bgcolor: localCompanion === 'an' ? '#faf5ff' : '#ffffff',
                  textAlign: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                  '&:hover': { borderColor: '#6d5bd0' },
                }}
              >
                {localCompanion === 'an' && (
                  <CheckCircleRoundedIcon
                    sx={{ position: 'absolute', top: 8, right: 8, fontSize: 18, color: '#6d5bd0' }}
                  />
                )}
                <Box
                  component="img"
                  src="/an-avatar.png"
                  alt="An"
                  sx={{ width: 52, height: 52, borderRadius: '50%', mx: 'auto', mb: 1, objectFit: 'cover' }}
                />
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: colorTokens.text }}>
                  An (Mèo)
                </Typography>
                <Typography sx={{ fontSize: 11, color: colorTokens.neutral400, mt: 0.5 }}>
                  Điềm tĩnh, phân tích sâu sắc
                </Typography>
              </Box>

              {/* Option 3: None */}
              <Box
                onClick={() => setLocalCompanion('none')}
                sx={{
                  p: 2,
                  borderRadius: '16px',
                  border: `2px solid ${localCompanion === 'none' ? '#6d5bd0' : '#e8e7f0'}`,
                  bgcolor: localCompanion === 'none' ? '#faf5ff' : '#ffffff',
                  textAlign: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  '&:hover': { borderColor: '#6d5bd0' },
                }}
              >
                {localCompanion === 'none' && (
                  <CheckCircleRoundedIcon
                    sx={{ position: 'absolute', top: 8, right: 8, fontSize: 18, color: '#6d5bd0' }}
                  />
                )}
                <Box
                  sx={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    bgcolor: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    mx: 'auto',
                    mb: 1,
                  }}
                >
                  🚫
                </Box>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: colorTokens.text }}>
                  Không dùng
                </Typography>
                <Typography sx={{ fontSize: 11, color: colorTokens.neutral400, mt: 0.5 }}>
                  Chỉ hiển thị biểu đồ
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Section 3: Costume / Theme Color */}
          {localCompanion !== 'none' && (
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: colorTokens.text, mb: 1 }}>
                3. Màu trang phục & chủ đề
              </Typography>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                {outfitColors.map((col) => (
                  <Box
                    key={col.hex}
                    onClick={() => setLocalOutfitColor(col.hex)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 2,
                      py: 1,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      border: `2px solid ${localOutfitColor === col.hex ? col.hex : '#e8e7f0'}`,
                      bgcolor: localOutfitColor === col.hex ? '#fafafc' : '#ffffff',
                    }}
                  >
                    <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: col.hex }} />
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: colorTokens.text }}>
                      {col.label}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Section 4: Reduced motion toggle */}
          <Box
            sx={{
              p: 2,
              borderRadius: '14px',
              bgcolor: '#fafafc',
              border: '1px solid #e8e7f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: colorTokens.text }}>
                Chế độ giảm chuyển động (Reduced Motion)
              </Typography>
              <Typography sx={{ fontSize: 11, color: colorTokens.neutral400, mt: 0.25 }}>
                Tắt hiệu ứng nhấp nhô của nhân vật và luồng sáng chuyển động để tăng khả năng tập trung.
              </Typography>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={localReducedMotion}
                  onChange={(e) => setLocalReducedMotion(e.target.checked)}
                  color="primary"
                />
              }
              label=""
              sx={{ m: 0 }}
            />
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ color: colorTokens.neutral400, textTransform: 'none', fontWeight: 600 }}>
          Hủy bỏ
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          sx={{
            bgcolor: '#6d5bd0',
            '&:hover': { bgcolor: '#5847be' },
            borderRadius: '12px',
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
          }}
        >
          Lưu thay đổi
        </Button>
      </DialogActions>
    </>
  );
}

export default function CustomizationModal({
  open,
  onClose,
  milestones,
  onSaveMilestones,
  settings,
  onSaveSettings,
}: {
  open: boolean;
  onClose: () => void;
  milestones: MilestoneItem[];
  onSaveMilestones: (newMilestones: MilestoneItem[]) => void;
  settings: CustomizationSettings;
  onSaveSettings: (newSettings: CustomizationSettings) => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: '24px',
            p: 1,
            boxShadow: '0 20px 48px rgba(28,27,46,0.16)',
          },
        },
      }}
    >
      {open && (
        <CustomizationContent
          key={String(open)}
          milestones={milestones}
          onSaveMilestones={onSaveMilestones}
          settings={settings}
          onSaveSettings={onSaveSettings}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}
