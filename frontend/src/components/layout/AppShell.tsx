'use client';

import * as React from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import IconButton from '@/components/ui/IconButton';
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
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import ForwardToInboxOutlinedIcon from '@mui/icons-material/ForwardToInboxOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined';
import MenuOpenOutlinedIcon from '@mui/icons-material/MenuOpenOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import { RequireAuth, useAuth } from '@/contexts/AuthContext';
import { ROLE_LABEL } from '@/lib/labels';
import { colorTokens, radiusTokens } from '@/theme/theme';
import * as companiesApi from '@/lib/api/companiesApi';
import type { Role } from '@/types';
import { isEmployeeRole } from '@/lib/roles';

const RAIL_WIDTH_COMPACT = 76;
const RAIL_WIDTH_FULL = 248;
/** Shared height so the sidebar's logo row and the TopBar line up exactly. */
const HEADER_HEIGHT = 72;

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** Omit to show for every role. */
  roles?: Role[];
  /** Require an exact pathname match instead of startsWith — for a scope's own root, which would otherwise also match every child route's prefix. */
  exact?: boolean;
  /** Only show while the user currently belongs to a company (companyId set) — e.g. Cross Assessment, which needs a company's assessment template/cycle to mean anything. */
  requiresCompany?: boolean;
}

/**
 * Tier-2 nav for Super Admin's per-company management area — swapped in for
 * the tier-1 NAV_ITEMS list while the URL is under /companies/:id, mirroring
 * how the reference workspace tool swaps in a ProjectSidebar on entering a
 * project. UI-only for now (Đánh giá / Duyệt yêu cầu are mocked screens);
 * real data wiring is a follow-up.
 */
function companyNavItems(companyId: string): NavItem[] {
  const base = `/companies/${companyId}`;
  return [
    { label: 'Tổng quan', href: base, icon: <DashboardOutlinedIcon fontSize="small" />, exact: true },
    { label: 'Nhân sự', href: `${base}/employees`, icon: <GroupsOutlinedIcon fontSize="small" /> },
    { label: 'Đánh giá', href: `${base}/assessments`, icon: <FactCheckOutlinedIcon fontSize="small" /> },
    { label: 'Duyệt yêu cầu', href: `${base}/requests`, icon: <AssignmentTurnedInOutlinedIcon fontSize="small" /> },
    { label: 'Cài đặt', href: `${base}/settings`, icon: <SettingsOutlinedIcon fontSize="small" /> },
  ];
}

/** Extracts :id from /companies/:id(/...) — null outside that scope. */
function matchCompanyScope(pathname: string | null): string | null {
  if (!pathname) return null;
  const match = pathname.match(/^\/companies\/([^/]+)(?:\/|$)/);
  return match ? match[1] : null;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Trang chủ', href: '/', icon: <DashboardOutlinedIcon fontSize="small" />, exact: true },
  {
    label: 'Công ty',
    href: '/companies',
    icon: <ApartmentOutlinedIcon fontSize="small" />,
    roles: ['SUPER_ADMIN'],
  },
  {
    label: 'Nhân sự',
    href: '/employees',
    icon: <GroupsOutlinedIcon fontSize="small" />,
    roles: ['COMPANY_ADMIN', 'HR', 'BOD'],
  },
  {
    label: 'Yêu cầu công việc',
    href: '/job-requirements',
    icon: <WorkOutlineOutlinedIcon fontSize="small" />,
    roles: ['HR', 'BOD'],
  },
  {
    label: 'Trợ lý AI',
    href: '/assistant',
    icon: <AutoAwesomeOutlinedIcon fontSize="small" />,
    roles: ['HR', 'BOD', 'EMPLOYEE'],
  },
  {
    label: 'Đánh giá chéo',
    href: '/assessments',
    icon: <FactCheckOutlinedIcon fontSize="small" />,
    roles: ['HR', 'BOD', 'EMPLOYEE'],
    requiresCompany: true,
  },
  {
    label: 'Yêu cầu năng lực',
    href: '/competency-requests',
    icon: <ForwardToInboxOutlinedIcon fontSize="small" />,
    roles: ['HR', 'BOD', 'COMPANY_ADMIN'],
  },
  {
    label: 'Phân quyền',
    href: '/roles',
    icon: <SecurityOutlinedIcon fontSize="small" />,
    roles: ['COMPANY_ADMIN'],
  },
  {
    label: 'Cài đặt',
    href: '/settings',
    icon: <SettingsOutlinedIcon fontSize="small" />,
    roles: ['SUPER_ADMIN'],
  },
];

/**
 * Compact icon-only rail up to (and including) tablet widths; from `lg`
 * (laptop/desktop) up, widens into a full sidebar with icon + label — the
 * breakpoint mirrors MUI's own tablet/desktop split. The header toggle can
 * also force the compact rail even at `lg`+ widths (`collapsed`), but it
 * never hides the sidebar entirely. Tooltips only kick in while compact,
 * since the label is on-screen once the rail widens.
 *
 * Below `lg` there is no permanent rail at all — the sidebar starts closed
 * and the header toggle opens it as a temporary overlay Drawer (full width,
 * labels shown), closing again on toggle, backdrop click, or picking a nav
 * item, so it never keeps taking up screen space on tablet/mobile.
 */
function Sidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const theme = useTheme();
  const isLg = useMediaQuery(theme.breakpoints.up('lg'));
  // Inside the mobile drawer the rail is always shown "full" (icons + labels).
  const isFull = isLg ? !collapsed : true;

  const companyScopeId = user?.role === 'SUPER_ADMIN' ? matchCompanyScope(pathname) : null;
  const [companyScopeName, setCompanyScopeName] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!companyScopeId) {
      setCompanyScopeName(null);
      return;
    }
    let cancelled = false;
    companiesApi
      .getCompany(companyScopeId)
      .then((company) => {
        if (!cancelled) setCompanyScopeName(company.name);
      })
      .catch(() => {
        if (!cancelled) setCompanyScopeName(null);
      });
    return () => {
      cancelled = true;
    };
  }, [companyScopeId]);

  const visibleItems = companyScopeId
    ? companyNavItems(companyScopeId)
    : NAV_ITEMS.filter(
        (item) =>
          (!item.roles || (user && item.roles.includes(user.role))) &&
          (!item.requiresCompany || Boolean(user?.companyId)),
      );

  const content = (
    <Box
      sx={{
        width: isFull ? RAIL_WIDTH_FULL : RAIL_WIDTH_COMPACT,
        minWidth: 0,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        bgcolor: colorTokens.surface,
        borderRight: isLg ? `1px solid ${colorTokens.border}` : 'none',
        overflow: 'hidden',
        transition: 'width 0.2s ease, border-color 0.2s ease',
      }}
    >
      <Box
        sx={{
          height: HEADER_HEIGHT,
          boxSizing: 'border-box',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: isFull ? 2.5 : 0,
          justifyContent: isFull ? 'flex-start' : 'center',
          borderBottom: `1px solid ${colorTokens.border}`,
        }}
      >
        <Box
          component="img"
          src="/mark-black.svg"
          alt={isFull ? undefined : 'CareerMate'}
          sx={{
            width: 36,
            height: 36,
            flexShrink: 0,
            display: isFull ? 'none' : 'block',
          }}
        />
        <Box
          component="img"
          src="/lockup-black.svg"
          alt="CareerMate"
          sx={{
            height: 28,
            width: 'auto',
            flexShrink: 0,
            display: isFull ? 'block' : 'none',
          }}
        />
      </Box>
      {companyScopeId ? (
        <Box
          sx={{
            px: isFull ? 2.5 : 0,
            py: 1.5,
            display: 'flex',
            flexDirection: 'column',
            alignItems: isFull ? 'stretch' : 'center',
            gap: 0.75,
            borderBottom: `1px solid ${colorTokens.border}`,
            flexShrink: 0,
          }}
        >
          <Tooltip title="Tất cả công ty" placement="right" disableHoverListener={isFull}>
            <Box
              component={NextLink}
              href="/companies"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                color: colorTokens.secondary,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 500,
                '&:hover': { color: colorTokens.heading },
              }}
            >
              <ArrowBackOutlinedIcon fontSize="inherit" sx={{ fontSize: 16 }} />
              {isFull ? 'Tất cả công ty' : null}
            </Box>
          </Tooltip>
          {isFull ? (
            <Typography
              noWrap
              sx={{ fontWeight: 700, fontSize: 14.5, color: colorTokens.heading }}
            >
              {companyScopeName ?? 'Đang tải…'}
            </Typography>
          ) : null}
        </Box>
      ) : null}
      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <List sx={{ py: 2.5, px: isFull ? 1.5 : 0 }}>
          {visibleItems.map((item) => {
            const selected = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
            const button = (
              <ListItemButton
                component={NextLink}
                href={item.href}
                selected={selected}
                onClick={() => {
                  if (!isLg) onCloseMobile();
                }}
                sx={{
                  width: isFull ? '100%' : 44,
                  height: 44,
                  minWidth: 44,
                  gap: isFull ? 1.5 : 0,
                  borderRadius: `${radiusTokens.md}px`,
                  justifyContent: isFull ? 'flex-start' : 'center',
                  px: isFull ? 1.5 : 0,
                  transition: 'padding 0.2s ease',
                  color: colorTokens.secondary,
                  '&.Mui-selected': {
                    backgroundColor: colorTokens.primarySubtle,
                    color: colorTokens.primary,
                    '&:hover': { backgroundColor: colorTokens.primarySubtle },
                  },
                }}
              >
                {item.icon}
                <ListItemText
                  primary={item.label}
                  sx={{
                    m: 0,
                    overflow: 'hidden',
                    opacity: isFull ? 1 : 0,
                    maxWidth: isFull ? 180 : 0,
                    transition: isFull
                      ? 'opacity 0.15s ease 0.08s, max-width 0.2s ease'
                      : 'opacity 0.1s ease, max-width 0.2s ease',
                  }}
                  slotProps={{ primary: { sx: { fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap' } } }}
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
    </Box>
  );

  if (!isLg) {
    return (
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onCloseMobile}
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': {
            width: RAIL_WIDTH_FULL,
            boxSizing: 'border-box',
          },
        }}
      >
        {content}
      </Drawer>
    );
  }

  return content;
}

interface TopBarProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

function TopBar({ sidebarCollapsed, onToggleSidebar }: TopBarProps) {
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const isCompanyAdmin = user?.role === 'COMPANY_ADMIN';
  const identityLabel = isCompanyAdmin ? user?.companyName ?? 'Công ty' : user?.name;
  const identityInitial = (isCompanyAdmin ? user?.companyName : user?.name)?.[0]?.toUpperCase() ?? '?';

  return (
    <Box
      sx={{
        height: HEADER_HEIGHT,
        boxSizing: 'border-box',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
        px: 3,
        borderBottom: `1px solid ${colorTokens.border}`,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        bgcolor: colorTokens.canvas,
      }}
    >
      <Tooltip title={sidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}>
        <IconButton onClick={onToggleSidebar} sx={{ color: colorTokens.secondary }}>
          {sidebarCollapsed ? <MenuOutlinedIcon fontSize="small" /> : <MenuOpenOutlinedIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          {...(isCompanyAdmin
            ? { component: NextLink, href: '/company', sx: { textAlign: 'right', textDecoration: 'none' } }
            : { sx: { textAlign: 'right' } })}
        >
          <Typography variant="body2" noWrap sx={{ color: colorTokens.heading, fontWeight: 500, lineHeight: 1.3 }}>
            {identityLabel}
          </Typography>
          {!isCompanyAdmin && (
            <Typography variant="caption" noWrap sx={{ display: 'block', lineHeight: 1.3 }}>
              {user ? ROLE_LABEL[user.role] : ''}
            </Typography>
          )}
        </Box>
        <IconButton onClick={(event) => setAnchorEl(event.currentTarget)} sx={{ p: 0.5 }}>
          <Avatar
            src={!isCompanyAdmin ? user?.avatarUrl ?? undefined : undefined}
            sx={{ width: 36, height: 36, bgcolor: colorTokens.primary, color: '#ffffff' }}
          >
            {isCompanyAdmin ? <ApartmentOutlinedIcon fontSize="small" /> : identityInitial}
          </Avatar>
        </IconButton>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          {isEmployeeRole(user?.role) && (
            <MenuItem component={NextLink} href="/profile" onClick={() => setAnchorEl(null)}>
              <ListItemIcon>
                <PersonOutlineIcon fontSize="small" />
              </ListItemIcon>
              Hồ sơ của tôi
            </MenuItem>
          )}
          <MenuItem
            onClick={() => {
              setAnchorEl(null);
              logout();
            }}
          >
            <ListItemIcon>
              <LogoutOutlinedIcon fontSize="small" />
            </ListItemIcon>
            Đăng xuất
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}

function isPublicPath(pathname: string | null) {
  return pathname === '/login' || Boolean(pathname?.startsWith('/passport/'));
}

/**
 * Persistent chrome for authenticated routes — mounted from `app/layout.tsx`
 * so the sidebar / top bar stay mounted across in-app navigations. Only the
 * `{children}` page slot remounts. `/login` and the public passport share
 * skip the chrome (and the auth gate) entirely.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const theme = useTheme();
  const isLg = useMediaQuery(theme.breakpoints.up('lg'));
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  if (isPublicPath(pathname)) {
    return <>{children}</>;
  }

  const toggleSidebar = () => {
    if (isLg) {
      setSidebarCollapsed((prev) => !prev);
    } else {
      setMobileNavOpen((prev) => !prev);
    }
  };

  return (
    <RequireAuth>
      <Box sx={{ height: '100vh', display: 'flex', bgcolor: colorTokens.canvas, overflow: 'hidden' }}>
        <Sidebar
          collapsed={sidebarCollapsed}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', bgcolor: colorTokens.canvas, overflow: 'hidden' }}>
          <TopBar
            sidebarCollapsed={isLg ? sidebarCollapsed : !mobileNavOpen}
            onToggleSidebar={toggleSidebar}
          />
          <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>{children}</Box>
        </Box>
      </Box>
    </RequireAuth>
  );
}
