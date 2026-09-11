import { getSegmentLabel } from './routeLabels';

export interface BreadcrumbItem {
  label: string;
  href: string;
}

export interface BreadcrumbResult {
  items: BreadcrumbItem[];
  /** True if this is a "leaf" page that should show a back button to parent */
  isLeaf: boolean;
}

/** Routes that are considered "roots" — no back button needed */
const ROOT_ROUTES = new Set(['/', '']);

/** Routes that are "list" pages — their children are detail pages */
const LIST_ROUTES = [
  '/companies',
  '/employees',
  '/assessments',
  '/settings',
  '/profile',
];

/** Map a pathname to its parent route for back-button purposes */
function getParentRoute(pathname: string): string | null {
  // /companies/:id/employees → /companies/:id
  if (/^\/companies\/[^/]+\/[^/]+/.test(pathname)) {
    return pathname.split('/').slice(0, 3).join('/');
  }
  // /companies/:id → /companies
  if (/^\/companies\/[^/]+$/.test(pathname)) {
    return '/companies';
  }
  // /employees/:id/passport → /employees/:id
  if (/^\/employees\/[^/]+\/passport$/.test(pathname)) {
    return pathname.split('/').slice(0, 3).join('/');
  }
  // /employees/:id → /employees
  if (/^\/employees\/[^/]+$/.test(pathname)) {
    return '/employees';
  }
  // /assessments/:id → /assessments
  if (/^\/assessments\/[^/]+$/.test(pathname)) {
    return '/assessments';
  }
  // /profile/import → /profile
  if (pathname === '/profile/import') {
    return '/profile';
  }
  // /settings/assessment-templates → /settings
  if (pathname === '/settings/assessment-templates') {
    return '/settings';
  }
  return null;
}

/** Check if a route is a "leaf" (detail/sub) page */
function isLeafRoute(pathname: string): boolean {
  if (ROOT_ROUTES.has(pathname)) return false;
  // Any path with 2+ segments after splitting (ignoring leading /)
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return false;
  // List pages themselves are not leaves
  if (LIST_ROUTES.includes(pathname)) return false;
  // Company-scoped list pages are not leaves
  if (/^\/companies\/[^/]+\/(employees|assessments|requests|settings)$/.test(pathname)) {
    return false;
  }
  // Everything else with depth is a leaf
  return true;
}

export function buildBreadcrumbs(pathname: string | null): BreadcrumbResult {
  if (!pathname) return { items: [], isLeaf: false };

  // Public passport share has no breadcrumbs
  if (pathname.startsWith('/passport/')) {
    return { items: [], isLeaf: false };
  }

  // Login has no breadcrumbs
  if (pathname === '/login') {
    return { items: [], isLeaf: false };
  }

  const parts = pathname.split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [];

  // Always start with home
  items.push({ label: 'Trang chủ', href: '/' });

  let current = '';
  for (let i = 0; i < parts.length; i++) {
    current += '/' + parts[i];

    // Skip ID segments in breadcrumb display — show parent context instead
    // e.g. /companies/abc123/employees → Companies > Nhân sự
    // We still push the href for navigation
    const label = getSegmentLabel(parts[i]);

    // For company-scoped routes, show company name context differently
    // (handled by sidebar "Tất cả công ty" link), so we collapse the :id here
    if (/^\/companies\/[^/]+$/.test(current) && parts[i] !== 'companies') {
      // This is /companies/:id — label as "Công ty" context is in sidebar
      // We still add it so deep children can link back
      items.push({ label: 'Công ty', href: current });
      continue;
    }

    // Skip raw IDs in the label (they're long cuids)
    if (parts[i].length > 8 && /^[a-z0-9]+$/i.test(parts[i])) {
      // Use a contextual label based on parent
      const parentPart = parts[i - 1];
      if (parentPart === 'companies') {
        items.push({ label: 'Chi tiết công ty', href: current });
      } else if (parentPart === 'employees') {
        items.push({ label: 'Chi tiết nhân sự', href: current });
      } else if (parentPart === 'assessments') {
        items.push({ label: 'Bài đánh giá', href: current });
      } else {
        items.push({ label: 'Chi tiết', href: current });
      }
    } else {
      items.push({ label, href: current });
    }
  }

  // Remove duplicate consecutive items (edge case)
  const deduped = items.filter((item, idx, arr) =>
    idx === 0 || item.href !== arr[idx - 1].href
  );

  return {
    items: deduped,
    isLeaf: isLeafRoute(pathname),
  };
}

/** Get the back URL for a leaf page */
export function getBackUrl(pathname: string | null): string | null {
  if (!pathname) return null;
  return getParentRoute(pathname);
}
