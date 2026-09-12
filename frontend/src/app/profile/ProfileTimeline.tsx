'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import { colorTokens } from '@/theme/theme';
import type { TimelineEntry, TimelineKind } from '@/lib/api/competencyProfileApi';

const KIND_META: Record<
  TimelineKind,
  { label: string; icon: React.ReactNode; color: string }
> = {
  EMPLOYMENT: {
    label: 'Làm việc',
    icon: <WorkOutlineOutlinedIcon fontSize="small" />,
    color: colorTokens.primary,
  },
  PROJECT: {
    label: 'Dự án',
    icon: <FolderOutlinedIcon fontSize="small" />,
    color: '#4C8DF6',
  },
  CERTIFICATION: {
    label: 'Chứng chỉ',
    icon: <SchoolOutlinedIcon fontSize="small" />,
    color: '#8E7CF0',
  },
  AWARD: {
    label: 'Thành tích',
    icon: <EmojiEventsOutlinedIcon fontSize="small" />,
    color: '#E0A32E',
  },
  ACTIVITY: {
    label: 'Hoạt động',
    icon: <EventNoteOutlinedIcon fontSize="small" />,
    color: '#5FAE8C',
  },
};

function formatRange(date: string, endDate: string | null) {
  const start = new Date(date).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'short',
  });
  if (!endDate) return start;
  const end = new Date(endDate).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'short',
  });
  return `${start} — ${end}`;
}

/**
 * The merged career timeline — employments, projects, certifications, awards
 * and activities on one vertical rail, newest first.
 */
export default function ProfileTimeline({
  entries,
}: {
  entries: TimelineEntry[];
}) {
  if (entries.length === 0) {
    return (
      <Typography variant="body2">
        Chưa có gì trên dòng thời gian. Thêm dự án hoặc nhập CV để bắt đầu.
      </Typography>
    );
  }

  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        sx={{
          position: 'absolute',
          left: { xs: 11, md: '50%' },
          top: 8,
          bottom: 8,
          width: '2px',
          transform: { md: 'translateX(-1px)' },
          backgroundColor: colorTokens.border,
        }}
      />
      <Stack spacing={3}>
        {entries.map((entry, index) => {
          const meta = KIND_META[entry.kind];
          const techStack = Array.isArray(entry.meta.techStack)
            ? (entry.meta.techStack as string[])
            : [];
          const isLeft = index % 2 === 0;
          return (
            <Box
              key={`${entry.kind}-${entry.id}`}
              sx={{
                position: 'relative',
                display: { md: 'grid' },
                gridTemplateColumns: { md: 'minmax(0, 1fr) 48px minmax(0, 1fr)' },
                pl: { xs: 3.5, md: 0 },
              }}
            >
              <Box
                sx={{
                  position: { xs: 'absolute', md: 'relative' },
                  left: { xs: 0, md: 'auto' },
                  top: { xs: 2, md: 'auto' },
                  gridColumn: { md: 2 },
                  gridRow: { md: 1 },
                  justifySelf: { md: 'center' },
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colorTokens.surface,
                  border: `2px solid ${meta.color}`,
                  color: meta.color,
                  zIndex: 1,
                  '& svg': { fontSize: 13 },
                }}
              >
                {meta.icon}
              </Box>

              <Box
                sx={{
                  gridColumn: { md: isLeft ? 1 : 3 },
                  gridRow: { md: 1 },
                  px: { md: 2 },
                  textAlign: { md: isLeft ? 'right' : 'left' },
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    alignItems: 'center',
                    justifyContent: { md: isLeft ? 'flex-end' : 'flex-start' },
                    flexWrap: 'wrap',
                    mb: 0.25,
                  }}
                >
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {entry.title}
                  </Typography>
                  <Chip
                    label={meta.label}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: 11 }}
                  />
                </Stack>

                <Typography variant="body2" sx={{ fontSize: 12.5 }}>
                  {formatRange(entry.date, entry.endDate)}
                  {entry.subtitle ? ` · ${entry.subtitle}` : ''}
                </Typography>

                {typeof entry.meta.contribution === 'string' ? (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {entry.meta.contribution}
                  </Typography>
                ) : null}
                {typeof entry.meta.description === 'string' ? (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {entry.meta.description}
                  </Typography>
                ) : null}
                {typeof entry.meta.score === 'string' && entry.meta.score ? (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    Điểm: {entry.meta.score}
                  </Typography>
                ) : null}

                {techStack.length > 0 ? (
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{
                      justifyContent: { md: isLeft ? 'flex-end' : 'flex-start' },
                      flexWrap: 'wrap',
                      gap: 0.75,
                      mt: 1,
                    }}
                  >
                    {techStack.map((tech) => (
                      <Chip
                        key={tech}
                        label={tech}
                        size="small"
                        sx={{ height: 22, fontSize: 11.5 }}
                      />
                    ))}
                  </Stack>
                ) : null}
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
