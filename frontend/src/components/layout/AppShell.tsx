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
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined';
import MenuOpenOutlinedIcon from '@mui/icons-material/MenuOpenOutlined';
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
 * breakpoint mirrors MUI's own tablet/desktop split. The header toggle can
 * also force the compact rail even at `lg`+ widths (`collapsed`), but it
 * never hides the sidebar entirely. Tooltips only kick in while compact,
 * since the label is on-screen once the rail widens.
 */
function Sidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const theme = useTheme();
  const isLg = useMediaQuery(theme.breakpoints.up('lg'));
  const isFull = isLg && !collapsed;

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  return (
    <Box
      sx={{
        width: isFull ? RAIL_WIDTH_FULL : RAIL_WIDTH_COMPACT,
        minWidth: 0,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
        py: 2.5,
        borderRight: `1px solid ${colorTokens.divider}`,
        overflowX: 'hidden',
        overflowY: 'auto',
        transition: 'width 0.2s ease, border-color 0.2s ease',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: isFull ? 2.5 : 0,
          justifyContent: isFull ? 'flex-start' : 'center',
        }}
      >
        <Avatar
          sx={{
            width: 40,
            height: 40,
            bgcolor: colorTokens.accent,
            color: colorTokens.text,
            fontWeight: 600,
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          C
        </Avatar>
        <Typography sx={{ display: isFull ? 'block' : 'none', fontWeight: 700, fontSize: 16, color: colorTokens.text }}>
          CareerMate
        </Typography>
      </Box>
      <Divider sx={{ mx: isFull ? 2.5 : 2 }} />
      <List sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, px: isFull ? 1.5 : 0, alignItems: isFull ? 'stretch' : 'center' }}>
        {visibleItems.map((item) => {
          const selected = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
          const button = (
            <ListItemButton
              component={NextLink}
              href={item.href}
              selected={selected}
              sx={{
                width: isFull ? '100%' : 44,
                height: 44,
                minWidth: 44,
                gap: 1.5,
                borderRadius: `${radiusTokens.md}px`,
                justifyContent: isFull ? 'flex-start' : 'center',
                px: isFull ? 1.5 : 0,
                color: colorTokens.neutral400,
                '&.Mui-selected': {
                  backgroundColor: colorTokens.accent900,
                  color: colorTokens.accentInk,
                  '&:hover': { backgroundColor: colorTokens.accent900 },
                },
              }}
            >
              {item.icon}
              <ListItemText
                primary={item.label}
                sx={{ display: isFull ? 'block' : 'none', m: 0 }}
                slotProps={{ primary: { sx: { fontSize: 14.5, fontWeight: 700 } } }}
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

interface TopBarProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

function TopBar({ sidebarCollapsed, onToggleSidebar }: TopBarProps) {
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
        px: 3,
        py: 2,
        borderBottom: `1px solid ${colorTokens.divider}`,
      }}
    >
      <Tooltip title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        <IconButton onClick={onToggleSidebar} sx={{ color: colorTokens.neutral400 }}>
          {sidebarCollapsed ? <MenuOutlinedIcon fontSize="small" /> : <MenuOpenOutlinedIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="body2" noWrap sx={{ color: colorTokens.text, fontWeight: 500, lineHeight: 1.3 }}>
            {user?.name}
          </Typography>
          <Typography variant="body2" noWrap sx={{ fontSize: 12, lineHeight: 1.3 }}>
            {user?.role}
          </Typography>
        </Box>
        <IconButton onClick={(event) => setAnchorEl(event.currentTarget)} sx={{ p: 0.5 }}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: colorTokens.accent, color: colorTokens.text }}>
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
    </Box>
  );
}

/**
 * Bolts sidebar + content together for every authenticated page, edge-to-edge
 * across the full viewport. Sidebar is a compact icon-only rail up to tablet
 * widths and a full icon+label sidebar from laptop/desktop (`lg`) up — see
 * Sidebar() above. A toggle at the start of the header (TopBar) can force
 * that same compact rail at `lg`+ widths too — it never hides the sidebar
 * entirely. User avatar/logout live in a top-right menu. Wraps children in
 * RequireAuth, so any page rendering AppShell gets the redirect-to-/login
 * gate for free.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  return (
    <RequireAuth>
      <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: colorTokens.surface }}>
        <Sidebar collapsed={sidebarCollapsed} />
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <TopBar sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)} />
          <Box sx={{ flex: 1 }}>{children}</Box>
        </Box>
      </Box>
    </RequireAuth>
  );
}
