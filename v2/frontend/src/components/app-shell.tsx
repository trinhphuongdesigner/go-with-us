"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Bell, CheckCircle2, LogOut, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/cn";
import { getAllowedNavigation, type NavigationItem } from "@/lib/navigation";

const roleLabels = {
  EMPLOYEE: "Nhân viên",
  COMPANY_ADMIN: "Quản lý công ty",
  SUPER_ADMIN: "Quản trị hệ thống",
} as const;

function NavigationLink({ item, compact, onSelect }: { item: NavigationItem; compact?: boolean; onSelect?: () => void }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      prefetch={false}
      onClick={onSelect}
      aria-label={compact ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      title={compact ? item.label : undefined}
      className={cn(
        "group flex min-h-11 items-center rounded-xl text-sm font-medium transition-colors",
        compact ? "flex-col justify-center gap-1 px-1 py-2 text-center" : "gap-3 px-3",
        active ? "bg-[#EAF1F6] text-primary" : "text-muted hover:bg-background hover:text-ink",
      )}
    >
      <Icon size={20} strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
      {compact ? <span className="w-full text-center text-xs font-semibold leading-[1.2] [overflow-wrap:anywhere]">{item.shortLabel}</span> : <span>{item.label}</span>}
    </Link>
  );
}

function ShellSearch({ items }: { items: NavigationItem[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filteredItems = items.filter((item) => item.label.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label="Tìm kiếm"><Search size={20} aria-hidden="true" /></Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-[12vh] z-50 w-[min(92vw,560px)] -translate-x-1/2 rounded-2xl border border-border bg-surface p-5 shadow-2xl focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-bold text-ink">Tìm trong CareerMate</Dialog.Title>
              <Dialog.Description className="mt-1 text-xs leading-5 text-muted">Kết quả chỉ hiển thị các khu vực bạn có quyền truy cập.</Dialog.Description>
            </div>
            <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Đóng tìm kiếm"><X size={20} /></Button></Dialog.Close>
          </div>
          <label htmlFor="shell-search" className="sr-only">Nhập tên chức năng</label>
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-background px-3">
            <Search size={18} className="shrink-0 text-muted" aria-hidden="true" />
            <input id="shell-search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ví dụ: lộ trình, hồ sơ…" className="h-12 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted" />
          </div>
          <nav aria-label="Kết quả tìm kiếm" className="mt-3 space-y-1">
            {filteredItems.map((item) => {
              const Icon = item.icon;
              return (
                <Dialog.Close asChild key={item.href}>
                  <Link href={item.href} prefetch={false} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink hover:bg-background">
                    <Icon size={18} className="text-primary" aria-hidden="true" /> {item.label}
                  </Link>
                </Dialog.Close>
              );
            })}
            {filteredItems.length === 0 ? <p className="px-3 py-5 text-center text-sm text-muted">Không tìm thấy khu vực phù hợp.</p> : null}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function NotificationsDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label="Thông báo" className="relative">
          <Bell size={20} aria-hidden="true" />
          <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-milo ring-2 ring-white"><span className="sr-only">Có thông báo mới</span></span>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/20" />
        <Dialog.Content className="fixed right-4 top-18 z-50 w-[min(92vw,380px)] rounded-2xl border border-border bg-surface p-5 shadow-2xl focus:outline-none sm:right-6 lg:right-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-bold text-ink">Thông báo</Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-muted">Một cập nhật mới trong dữ liệu mẫu.</Dialog.Description>
            </div>
            <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Đóng thông báo"><X size={20} /></Button></Dialog.Close>
          </div>
          <div className="mt-4 flex gap-3 rounded-xl border border-border bg-background/70 p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#EFF6F0] text-sage-strong" aria-hidden="true"><CheckCircle2 size={18} /></span>
            <div>
              <p className="text-sm font-semibold text-ink">Hồ sơ đã được cập nhật</p>
              <p className="mt-1 text-xs leading-5 text-muted">Một kỹ năng mới đã được xác minh trong dữ liệu demo.</p>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function UserCard({ compact = false }: { compact?: boolean }) {
  const { session } = useAuth();
  if (!session) return null;

  return (
    <div className={cn("flex items-center", compact ? "justify-center" : "gap-3")}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF1F6] text-xs font-bold text-primary">
        {session.user.initials}
      </span>
      {compact ? null : (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">{session.user.name}</span>
          <span className="block truncate text-xs text-muted">{roleLabels[session.user.role]}</span>
        </span>
      )}
    </div>
  );
}

function MobileNavigation({ items }: { items: NavigationItem[] }) {
  const [open, setOpen] = useState(false);
  const { signOut } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    setOpen(false);
    router.replace("/login");
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Mở menu chính">
          <Menu size={22} aria-hidden="true" />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px] data-[state=open]:animate-in" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[min(88vw,340px)] flex-col bg-surface p-5 shadow-2xl focus:outline-none">
          <div className="flex items-center justify-between">
            <div>
              <Dialog.Title className="sr-only">Menu CareerMate</Dialog.Title>
              <BrandLogo />
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Đóng menu chính"><X size={20} aria-hidden="true" /></Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-5 text-xs leading-5 text-muted">
            Chọn khu vực làm việc phù hợp với quyền của bạn.
          </Dialog.Description>
          <nav aria-label="Điều hướng chính" className="mt-6 flex-1 space-y-1.5">
            {items.map((item) => <NavigationLink key={item.href} item={item} onSelect={() => setOpen(false)} />)}
          </nav>
          <div className="border-t border-border pt-4">
            <UserCard />
            <Button variant="ghost" className="mt-4 w-full justify-start text-danger" onClick={handleSignOut}>
              <LogOut size={18} aria-hidden="true" /> Đăng xuất
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { session, status, signOut } = useAuth();
  const router = useRouter();
  const items = useMemo(() => getAllowedNavigation(session?.user.permissions ?? []), [session]);
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [router, status]);

  if (status === "loading" || !session) {
    return (
      <main className="grid min-h-screen place-items-center bg-background" role="status" aria-label="Đang mở CareerMate">
        <div className="text-center">
          <span className="mx-auto block size-10 animate-pulse rounded-xl bg-primary" />
          <p className="mt-4 text-sm text-muted">Đang mở không gian làm việc…</p>
        </div>
      </main>
    );
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="sticky top-0 hidden h-screen w-20 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 md:flex lg:w-68 lg:px-5">
        <BrandLogo compact className="mx-auto lg:hidden" />
        <BrandLogo className="hidden lg:inline-flex" />
        <nav aria-label="Điều hướng chính" className="mt-10 flex-1 space-y-1.5">
          {items.map((item) => (
            <span key={item.href} className="block lg:hidden"><NavigationLink item={item} compact /></span>
          ))}
          {items.map((item) => (
            <span key={`wide-${item.href}`} className="hidden lg:block"><NavigationLink item={item} /></span>
          ))}
        </nav>
        <div className="border-t border-border pt-4">
          <div className="lg:hidden"><UserCard compact /></div>
          <div className="hidden lg:block"><UserCard /></div>
          <Button variant="ghost" size="icon" className="mx-auto mt-3 text-danger lg:hidden" aria-label="Đăng xuất" onClick={handleSignOut}>
            <LogOut size={18} aria-hidden="true" />
          </Button>
          <Button variant="ghost" className="mt-3 hidden w-full justify-start text-danger lg:flex" onClick={handleSignOut}>
            <LogOut size={18} aria-hidden="true" /> Đăng xuất
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6 lg:h-18 lg:px-8">
          <div className="flex items-center gap-2">
            <MobileNavigation items={items} />
            <BrandLogo className="md:hidden" />
            <div className="hidden md:block">
              <p className="text-xs font-medium text-muted">{session.user.companyName}</p>
              <p className="text-sm font-semibold text-ink">Không gian làm việc</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {demoMode ? <span className="rounded-full bg-[#FFF2E8] px-2.5 py-1 text-[11px] font-bold text-[#9A4F18]">Dữ liệu minh hoạ</span> : null}
            <ShellSearch items={items} />
            <NotificationsDialog />
          </div>
        </header>
        <main id="main-content" className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
