'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@/components/ui/IconButton';
import Tooltip from '@mui/material/Tooltip';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { mdToHtml } from '@/lib/markdown';
import { colorTokens } from '@/theme/theme';

interface MarkdownSplitEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: number | string;
  onExpand?: () => void;
  readOnly?: boolean;
}

/**
 * Source + rendered-preview split pane with a draggable divider — the
 * shared pattern for every AI-generated Markdown draft (style-concept.md
 * section 4). Mirrors Workflow Pro's MarkdownSplitEditor: left textarea,
 * right mdToHtml-rendered preview, optional expand icon in the preview
 * pane header for a fullscreen dialog.
 */
export default function MarkdownSplitEditor({
  value,
  onChange,
  height = 480,
  onExpand,
  readOnly = false,
}: MarkdownSplitEditorProps) {
  const [splitPct, setSplitPct] = React.useState(50);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const draggingRef = React.useRef(false);

  const onPointerDown = () => {
    draggingRef.current = true;
  };

  React.useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(80, Math.max(20, pct)));
    };
    const onPointerUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  return (
    <Box
      ref={containerRef}
      sx={{
        display: 'flex',
        height,
        border: `1px solid ${colorTokens.border}`,
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Box
        component="textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        sx={{
          width: `${splitPct}%`,
          border: 'none',
          outline: 'none',
          resize: 'none',
          p: 2,
          fontFamily: 'var(--font-mono), ui-monospace, SFMono-Regular, monospace',
          fontSize: 13,
          lineHeight: 1.6,
          backgroundColor: colorTokens.surface,
          color: colorTokens.heading,
        }}
      />
      <Box
        onPointerDown={onPointerDown}
        sx={{
          width: 6,
          cursor: 'col-resize',
          backgroundColor: colorTokens.border,
          flexShrink: 0,
        }}
      />
      <Box sx={{ width: `${100 - splitPct}%`, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {onExpand ? (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 0.5 }}>
            <Tooltip title="Mở rộng">
              <IconButton size="small" onClick={onExpand}>
                <OpenInFullIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : null}
        <Box
          sx={{ flex: 1, overflow: 'auto', p: 2, backgroundColor: colorTokens.canvas }}
          dangerouslySetInnerHTML={{ __html: mdToHtml(value) }}
        />
      </Box>
    </Box>
  );
}
