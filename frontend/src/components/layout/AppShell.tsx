'use client';

import * as React from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlineOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { RequireAuth, useAuth } from '@/contexts/AuthContext';
import { colorTokens, radiusTokens } from '@/theme/theme';
import type { Role } from '@/types';

const RAIL_WIDTH_COMPACT = 76;
const RAIL_WIDTH_FULL = 248;

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** Omit to show for every role. */
  roles?: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: <DashboardOutlinedIcon fontSize="small" /> },
  {
    label: 'Companies',
    href: '/companies',
    icon: <ApartmentOutlinedIcon fontSize="small" />,
    roles: ['SUPER_ADMIN'],
  },
  {
    label: 'Employees',
    href: '/employees',
    icon: <GroupsOutlinedIcon fontSize="small" />,
    roles: ['COMPANY_ADMIN'],
  },
  {
    label: 'Job Requirements',
    href: '/job-requirements',
    icon: <WorkOutlineOutlinedIcon fontSize="small" />,
    roles: ['COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  { label: 'AI Assistant', href: '/assistant', icon: <AutoAwesomeOutlinedIcon fontSize="small" /> },
  {
    label: 'My Profile',
    href: '/profile',
    icon: <PersonOutlineIcon fontSize="small" />,
  },
  {
    label: 'Cross Assessment',
    href: '/assessments',
    icon: <FactCheckOutlinedIcon fontSize="small" />,
  },
  { label: 'Activity Log', href: '/activity-log', icon: <EventNoteOutlinedIcon fontSize="small" /> },
  { label: 'Peer Reviews', href: '/peer-reviews', icon: <RateReviewOutlinedIcon fontSize="small" /> },
  {
    label: 'Development Plan',
    href: '/development-plan',
    icon: <TrendingUpOutlinedIcon fontSize="small" />,
  },
  { label: 'Settings', href: '/settings', icon: <SettingsOutlinedIcon fontSize="small" /> },
];

/**
 * Compact icon-only rail up to (and including) tablet widths; from `lg`
 * (laptop/desktop) up, widens into a full sidebar with icon + label — the
 * breakpoint mirrors MUI's own tablet/desktop split. Tooltips only kick in
 * while compact, since the label is on-screen once the rail widens.
 */
function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const theme = useTheme();
  const isFull = useMediaQuery(theme.breakpoints.up('lg'));

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  return (
    <Box
      sx={{
        width: { xs: RAIL_WIDTH_COMPACT, lg: RAIL_WIDTH_FULL },
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
        py: 2.5,
        borderRight: `1px solid ${colorTokens.divider}`,
        overflowY: 'auto',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: { xs: 0, lg: 2.5 },
          justifyContent: { xs: 'center', lg: 'flex-start' },
        }}
      >
        <Avatar
          sx={{
            width: 40,
            height: 40,
            bgcolor: colorTokens.accent,
            fontWeight: 600,
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          C
        </Avatar>
        <Typography sx={{ display: { xs: 'none', lg: 'block' }, fontWeight: 600, fontSize: 16, color: colorTokens.text }}>
          CareerMate
        </Typography>
      </Box>
      <Divider sx={{ mx: { xs: 2, lg: 2.5 } }} />
      <List sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, px: { xs: 0, lg: 1.5 }, alignItems: { xs: 'center', lg: 'stretch' } }}>
        {visibleItems.map((item) => {
          const selected = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
          const button = (
            <ListItemButton
              component={NextLink}
              href={item.href}
              selected={selected}
              sx={{
                width: { xs: 44, lg: '100%' },
                height: 44,
                minWidth: 44,
                gap: 1.5,
                borderRadius: `${radiusTokens.md}px`,
                justifyContent: { xs: 'center', lg: 'flex-start' },
                px: { xs: 0, lg: 1.5 },
                color: colorTokens.neutral400,
                '&.Mui-selected': {
                  backgroundColor: colorTokens.accent900,
                  color: colorTokens.accent300,
                  '&:hover': { backgroundColor: colorTokens.accent900 },
                },
              }}
            >
              {item.icon}
              <ListItemText
                primary={item.label}
                sx={{ display: { xs: 'none', lg: 'block' }, m: 0 }}
                slotProps={{ primary: { sx: { fontSize: 14.5 } } }}
              />
            </ListItemButton>
          );
          return (
            <Tooltip key={item.href} title={item.label} placement="right" disableHoverListener={isFull}>
              {button}
            </Tooltip>
          );
        })}
      </List>
    </Box>
  );
}

function TopBar() {
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 1.5,
        px: 3,
        py: 2,
        borderBottom: `1px solid ${colorTokens.divider}`,
      }}
    >
      <Box sx={{ textAlign: 'right' }}>
        <Typography variant="body2" noWrap sx={{ color: colorTokens.text, fontWeight: 500, lineHeight: 1.3 }}>
          {user?.name}
        </Typography>
        <Typography variant="body2" noWrap sx={{ fontSize: 12, lineHeight: 1.3 }}>
          {user?.role}
        </Typography>
      </Box>
      <IconButton onClick={(event) => setAnchorEl(event.currentTarget)} sx={{ p: 0.5 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: colorTokens.accent }}>
          {user?.name?.[0]?.toUpperCase() ?? '?'}
        </Avatar>
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            logout();
          }}
        >
          <ListItemIcon>
            <LogoutOutlinedIcon fontSize="small" />
          </ListItemIcon>
          Log out
        </MenuItem>
      </Menu>
    </Box>
  );
}

/**
 * Bolts sidebar + content together for every authenticated page, edge-to-edge
 * across the full viewport. Sidebar is a compact icon-only rail up to tablet
 * widths and a full icon+label sidebar from laptop/desktop (`lg`) up — see
 * Sidebar() above. User avatar/logout live in a top-right menu. Wraps
 * children in RequireAuth, so any page rendering AppShell gets the
 * redirect-to-/login gate for free.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: colorTokens.surface }}>
        <Sidebar />
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <TopBar />
          <Box sx={{ flex: 1 }}>{children}</Box>
        </Box>
      </Box>
    </RequireAuth>
  );
}
