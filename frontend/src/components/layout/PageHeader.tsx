'use client';

import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { buildBreadcrumbs, getBackUrl } from '@/lib/breadcrumbs';
import { colorTokens } from '@/theme/theme';
import Button from '@/components/ui/Button';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  const pathname = usePathname();
  const { items, isLeaf } = buildBreadcrumbs(pathname);
  const backUrl = getBackUrl(pathname);

  return (
    <Box sx={{ mb: 3 }}>
      {/* Breadcrumb trail */}
      {items.length > 1 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            mb: 1,
            fontSize: 13,
            color: colorTokens.secondary,
          }}
        >
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1;
            return (
              <span key={item.href}>
                {isLast ? (
                  <Typography component="span" sx={{ color: colorTokens.heading, fontWeight: 500 }}>
                    {item.label}
                  </Typography>
                ) : (
                  <Box
                    component={NextLink}
                    href={item.href}
                    sx={{
                      textDecoration: 'none',
                      color: colorTokens.secondary,
                      '&:hover': { color: colorTokens.heading },
                    }}
                  >
                    {item.label}
                  </Box>
                )}
                {!isLast && <span style={{ margin: '0 0.5em', opacity: 0.5 }}>/</span>}
              </span>
            );
          })}
        </Box>
      )}

      {/* Title row with optional back button */}
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h1">{title}</Typography>
          {subtitle ? (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, flexShrink: 0, flexWrap: 'nowrap' }}>
          {/* Back button for leaf pages */}
          {isLeaf && backUrl && (
            <Button
              component={NextLink}
              href={backUrl}
              variant="outlined"
              size="small"
              startIcon={<ArrowBackOutlinedIcon fontSize="small" />}
            >
              Quay lại
            </Button>
          )}
          {actions}
        </Box>
      </Box>
    </Box>
  );
}
