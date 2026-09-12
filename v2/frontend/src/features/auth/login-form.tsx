"use client";

import { ArrowRight, BriefcaseBusiness, Building2, Check, ChevronDown, LoaderCircle, RefreshCw, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-provider";
import { demoAccounts, type DemoAccount } from "@/features/auth/demo-accounts";
import { ApiError, DEMO_MODE, listQcDemoAccounts, QC_DEMO_LOGIN_ENABLED, type QcDemoAccount } from "@/lib/api";
import { cn } from "@/lib/cn";
import { roleLabels, type UserRole } from "@/lib/types";

const loginSchema = z.object({
  email: z.email("Nhập email hợp lệ."),
  password: z.string().min(1, "Nhập mật khẩu."),
});

type LoginValues = z.infer<typeof loginSchema>;

const accountIcons = {
  EMPLOYEE: UserRound,
  HR: UsersRound,
  BOD: BriefcaseBusiness,
  COMPANY_ADMIN: Building2,
  SUPER_ADMIN: ShieldCheck,
} as const;

const accentStyles = {
  blue: "border-primary bg-[#F4F8FB] text-primary",
  sage: "border-sage bg-[#F3F7F4] text-sage",
  violet: "border-violet bg-[#F7F5FF] text-violet",
} as const;

export function DemoAccountPicker({ selectedId, onSelect }: { selectedId: string; onSelect: (account: DemoAccount) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink">Chọn góc nhìn để khám phá</legend>
      <p className="mt-1 text-xs leading-5 text-muted">Dữ liệu bên dưới hoàn toàn là dữ liệu mẫu.</p>
      <div className="mt-4 grid gap-3">
        {demoAccounts.map((account) => {
          const selected = account.id === selectedId;
          const Icon = accountIcons[account.user.role];
          return (
            <button
              type="button"
              key={account.id}
              aria-pressed={selected}
              onClick={() => onSelect(account)}
              className={cn(
                "flex min-h-18 w-full cursor-pointer items-center gap-3 rounded-2xl border bg-white p-3 text-left transition-colors",
                selected ? accentStyles[account.accent] : "border-border hover:border-muted/60 hover:bg-background/70",
              )}
            >
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", selected ? "bg-white/80" : "bg-background text-muted")}>
                <Icon size={19} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{account.label}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted">{account.description}</span>
              </span>
              {selected ? <Check className="shrink-0" size={18} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

const qcAccountGroups: Array<{ label: string; roles: UserRole[] }> = [
  { label: "Nhân sự", roles: ["EMPLOYEE"] },
  { label: "Công ty", roles: ["COMPANY_ADMIN", "HR", "BOD"] },
  { label: "Hệ thống", roles: ["SUPER_ADMIN"] },
];

function QcDemoAccountPicker({
  pendingEmail,
  onSelect,
}: {
  pendingEmail: string | null;
  onSelect: (account: QcDemoAccount) => Promise<void>;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [accounts, setAccounts] = useState<QcDemoAccount[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    if (!QC_DEMO_LOGIN_ENABLED) return;
    let cancelled = false;
    void listQcDemoAccounts()
      .then((items) => {
        if (cancelled) return;
        setAccounts(items);
        setLoadState(items.length > 0 ? "ready" : "unavailable");
      })
      .catch(() => {
        if (!cancelled) setLoadState("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!QC_DEMO_LOGIN_ENABLED) return null;
  if (loadState === "unavailable") {
    return (
      <p role="status" className="rounded-xl border border-border bg-background px-4 py-3 text-xs leading-5 text-muted">
        Không tải được tài khoản demo. Bạn vẫn có thể đăng nhập bằng email và mật khẩu bên dưới.
      </p>
    );
  }

  return (
    <section aria-labelledby="qc-demo-account-label">
      <label id="qc-demo-account-label" className="mb-2 block text-sm font-semibold text-ink">
        Tài khoản demo
      </label>
      <details ref={detailsRef} className="group relative">
        <summary
          className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-primary/60 bg-white px-4 text-sm font-semibold text-ink shadow-[0_4px_18px_rgb(39_94_128_/_8%)] transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden"
        >
          <span>{loadState === "loading" ? "Đang tải tài khoản demo…" : "Chọn người muốn đăng nhập"}</span>
          {loadState === "loading"
            ? <LoaderCircle className="motion-safe:animate-spin text-primary" size={18} aria-hidden="true" />
            : <ChevronDown className="text-primary transition-transform group-open:rotate-180 motion-reduce:transition-none" size={18} aria-hidden="true" />}
        </summary>
        {loadState === "ready" ? (
          <div className="absolute left-0 right-0 z-30 mt-2 max-h-[min(420px,55vh)] overflow-y-auto rounded-2xl border border-border bg-white p-2 shadow-[0_18px_55px_rgb(22_32_51_/_18%)]">
            <button
              type="button"
              className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold text-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              onClick={() => {
                detailsRef.current?.removeAttribute("open");
                document.getElementById("email")?.focus();
              }}
            >
              Dùng tài khoản của tôi
            </button>
            {qcAccountGroups.map((group, groupIndex) => {
              const groupAccounts = accounts.filter((account) => group.roles.includes(account.role));
              if (groupAccounts.length === 0) return null;
              return (
                <div key={group.label} className={cn("mt-2", groupIndex > 0 && "border-t border-border pt-2")}>
                  <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{group.label}</p>
                  <div className="grid gap-1">
                    {groupAccounts.map((account) => {
                      const isPending = pendingEmail === account.email;
                      return (
                        <button
                          key={account.email}
                          type="button"
                          disabled={pendingEmail !== null}
                          className="flex min-h-16 w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[#F3F8F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-wait disabled:opacity-60"
                          onClick={() => {
                            detailsRef.current?.removeAttribute("open");
                            void onSelect(account);
                          }}
                        >
                          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#EAF6EF] text-sm font-bold text-sage">
                            {isPending ? <LoaderCircle className="motion-safe:animate-spin" size={18} aria-hidden="true" /> : account.initials}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-ink">{account.name}</span>
                            <span className="mt-0.5 block truncate text-xs text-muted">{account.title} · {account.companyName}</span>
                          </span>
                          <span className="shrink-0 rounded-full bg-[#EAF6EF] px-2.5 py-1 text-[11px] font-semibold text-sage">
                            {roleLabels[account.role]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </details>
      <p className="mt-2 text-xs leading-5 text-muted">Chọn một người để vào thẳng dữ liệu mẫu, không cần nhập mật khẩu.</p>
    </section>
  );
}

export function LoginForm() {
  const router = useRouter();
  const { signIn, signInDemo, status, logoutState, logoutError, retryLogout } = useAuth();
  const [selected, setSelected] = useState<DemoAccount>(demoAccounts[0]);
  const [pendingDemoEmail, setPendingDemoEmail] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    defaultValues: DEMO_MODE
      ? { email: selected.email, password: selected.password }
      : { email: "", password: "" },
  });

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [router, status]);

  function selectAccount(account: DemoAccount) {
    setSelected(account);
    setValue("email", account.email, { shouldValidate: false });
    setValue("password", account.password, { shouldValidate: false });
    setFormError(null);
  }

  async function selectQcDemoAccount(account: QcDemoAccount) {
    setFormError(null);
    setPendingDemoEmail(account.email);
    try {
      await signInDemo(account.email);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Không thể đăng nhập tài khoản demo lúc này.");
      requestAnimationFrame(() => document.getElementById("login-error-summary")?.focus());
    } finally {
      setPendingDemoEmail(null);
    }
  }

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "email" || field === "password") setError(field, { message: issue.message });
      }
      requestAnimationFrame(() => document.getElementById("login-error-summary")?.focus());
      return;
    }

    try {
      await signIn(parsed.data.email, parsed.data.password);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Không thể đăng nhập lúc này. Vui lòng thử lại.");
      requestAnimationFrame(() => document.getElementById("login-error-summary")?.focus());
    }
  });

  return (
    <form className="space-y-5" noValidate onSubmit={submit}>
      {logoutState !== "idle" ? (
        <div
          role={logoutState === "failed" ? "alert" : "status"}
          className="rounded-xl border border-[#E8D7B8] bg-[#FFF9ED] p-3 text-sm text-ink"
        >
          <p className="font-semibold">Trạng thái đăng xuất</p>
          <p className="mt-1 leading-5">
            {logoutState === "revoking" ? "Đang thu hồi phiên trên máy chủ…" : logoutError}
          </p>
          {logoutState === "failed" ? (
            <Button type="button" variant="ghost" className="mt-2 h-9 px-2 text-primary" onClick={() => void retryLogout()}>
              <RefreshCw size={16} aria-hidden="true" /> Thử thu hồi lại
            </Button>
          ) : null}
        </div>
      ) : null}

      {(formError || errors.email || errors.password) ? (
        <div id="login-error-summary" tabIndex={-1} role="alert" aria-labelledby="login-error-title" className="rounded-xl border border-[#F6D5D2] bg-danger-soft p-3 text-sm text-danger">
          <p id="login-error-title" className="font-semibold">Kiểm tra lại thông tin đăng nhập</p>
          {formError ? <p className="mt-1 leading-5">{formError}</p> : null}
          <ul className="mt-1 list-inside list-disc">
            {errors.email?.message ? <li><a href="#email" className="underline">{errors.email.message}</a></li> : null}
            {errors.password?.message ? <li><a href="#password" className="underline">{errors.password.message}</a></li> : null}
          </ul>
        </div>
      ) : null}

      {DEMO_MODE ? <DemoAccountPicker selectedId={selected.id} onSelect={selectAccount} /> : null}
      {!DEMO_MODE ? <QcDemoAccountPicker pendingEmail={pendingDemoEmail} onSelect={selectQcDemoAccount} /> : null}

      <div className={cn("grid gap-4", (DEMO_MODE || QC_DEMO_LOGIN_ENABLED) && "border-t border-border pt-5")}>
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-semibold text-ink">Email</label>
          <Input id="email" type="email" autoComplete="username" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} {...register("email")} />
          {errors.email?.message ? <p id="email-error" className="mt-1.5 text-xs text-danger">{errors.email.message}</p> : null}
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-4">
            <label htmlFor="password" className="text-sm font-semibold text-ink">Mật khẩu</label>
            {DEMO_MODE ? <span className="text-xs text-muted">Tài khoản mẫu đã điền sẵn</span> : null}
          </div>
          <Input id="password" type="password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "password-error" : undefined} {...register("password")} />
          {errors.password?.message ? <p id="password-error" className="mt-1.5 text-xs text-danger">{errors.password.message}</p> : null}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <LoaderCircle className="motion-safe:animate-spin" size={18} aria-hidden="true" /> : null}
        {isSubmitting ? "Đang đăng nhập…" : DEMO_MODE ? `Tiếp tục với vai trò ${selected.label}` : "Đăng nhập"}
        {isSubmitting ? null : <ArrowRight size={18} aria-hidden="true" />}
      </Button>
      {DEMO_MODE ? (
        <p className="text-center text-xs leading-5 text-muted">Đây là môi trường demo. Không nhập dữ liệu nhân sự hoặc mật khẩu thật.</p>
      ) : null}
    </form>
  );
}
