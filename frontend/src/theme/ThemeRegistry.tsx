'use client';

import * as React from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';

/**
 * Wraps the whole app in MUI's App Router emotion cache + the DEFAULT
 * theme (style-concept.md). Employee-only "concept" reskinning (anime/
 * film/gather-town) is layered on top of this later — Admin routes never
 * leave this provider's theme.
 */
export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: 'mui' }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
