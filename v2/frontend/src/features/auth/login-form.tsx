"use client";

import { ArrowRight, BriefcaseBusiness, Building2, Check, LoaderCircle, RefreshCw, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-provider";
import { demoAccounts, type DemoAccount } from "@/features/auth/demo-accounts";
import { ApiError, DEMO_MODE } from "@/lib/api";
import { cn } from "@/lib/cn";

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

export function LoginForm() {
  const router = useRouter();
  const { signIn, status, logoutState, logoutError, retryLogout } = useAuth();
  const [selected, setSelected] = useState<DemoAccount>(demoAccounts[0]);
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

      <div className={cn("grid gap-4", DEMO_MODE && "border-t border-border pt-5")}>
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
