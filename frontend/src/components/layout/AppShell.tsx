'use client';

import * as React from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlineOutlined';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { RequireAuth, useAuth } from '@/contexts/AuthContext';
import { colorTokens } from '@/theme/theme';
import type { Role } from '@/types';

const DRAWER_WIDTH = 260;

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
  { label: 'My Profile', href: '/profile', icon: <PersonOutlineIcon fontSize="small" /> },
  { label: 'My Skills', href: '/skills', icon: <PsychologyOutlinedIcon fontSize="small" /> },
  { label: 'Activity Log', href: '/activity-log', icon: <EventNoteOutlinedIcon fontSize="small" /> },
  { label: 'Peer Reviews', href: '/peer-reviews', icon: <RateReviewOutlinedIcon fontSize="small" /> },
  {
    label: 'Development Plan',
    href: '/development-plan',
    icon: <TrendingUpOutlinedIcon fontSize="small" />,
  },
  { label: 'Settings', href: '/settings', icon: <SettingsOutlinedIcon fontSize="small" /> },
];

function SidebarContent() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ px: 3 }}>
        <Typography variant="h3" sx={{ fontWeight: 600 }}>
          go with us
        </Typography>
      </Toolbar>
      <List sx={{ flex: 1, px: 1.5 }}>
        {visibleItems.map((item) => {
          const selected = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
          return (
            <ListItemButton
              key={item.href}
              component={NextLink}
              href={item.href}
              selected={selected}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                '&.Mui-selected': {
                  backgroundColor: colorTokens.accent900,
                  color: colorTokens.accent300,
                  '& .MuiListItemIcon-root': { color: colorTokens.accent300 },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontSize: 14.5 } } }} />
            </ListItemButton>
          );
        })}
      </List>
      <Box sx={{ p: 2, borderTop: `1px solid ${colorTokens.divider}`, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: colorTokens.accent }}>
          {user?.name?.[0]?.toUpperCase() ?? '?'}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" noWrap sx={{ color: colorTokens.text, fontWeight: 500 }}>
            {user?.name}
          </Typography>
          <Typography variant="body2" noWrap sx={{ fontSize: 12 }}>
            {user?.role}
          </Typography>
        </Box>
        <Tooltip title="Log out">
          <IconButton size="small" onClick={logout}>
            <LogoutOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

/**
 * Bolts sidebar + content together for every authenticated page — mirrors
 * style-concept.md section 4 ("AppShell + sidebar cố định"). Wraps children
 * in RequireAuth, so any page rendering AppShell gets the redirect-to-
 * /login gate for free.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              borderRight: `1px solid ${colorTokens.divider}`,
              backgroundColor: colorTokens.surface,
            },
          }}
        >
          <SidebarContent />
        </Drawer>
        <Box sx={{ flex: 1, minWidth: 0, backgroundColor: colorTokens.bg }}>{children}</Box>
      </Box>
    </RequireAuth>
  );
}
