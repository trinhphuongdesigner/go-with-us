'use client';

import Box from '@mui/material/Box';
import { mdToHtml } from '@/lib/markdown';
import { colorTokens } from '@/theme/theme';

/**
 * Inline rendering for AI-authored Markdown (career summaries, plans) that
 * should read as part of the page rather than sit in a fixed-height frame —
 * same mdToHtml path MarkdownSplitEditor's preview pane uses.
 */
export default function MarkdownBlock({ source }: { source: string }) {
  return (
    <Box
      sx={{
        color: colorTokens.text,
        fontSize: 14.5,
        lineHeight: 1.65,
        '& h1, & h2, & h3': { fontSize: 16, fontWeight: 600, mt: 2, mb: 1 },
        '& p': { my: 1 },
        '& ul, & ol': { pl: 3, my: 1 },
        '& li': { mb: 0.5 },
        '& code': {
          backgroundColor: colorTokens.accent900,
          px: 0.5,
          borderRadius: 1,
        },
        '& a': { color: colorTokens.accent },
        '& :first-of-type': { mt: 0 },
      }}
      dangerouslySetInnerHTML={{ __html: mdToHtml(source) }}
    />
  );
}
