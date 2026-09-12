import Image from "next/image";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "@/features/auth/login-form";

export const metadata = { title: "Đăng nhập" };

export default function LoginPage() {
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true"
    || process.env.NEXT_PUBLIC_QC_DEMO_LOGIN_ENABLED === "true";
  return (
    <main id="main-content" className="min-h-screen bg-background px-4 py-5 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(440px,560px)] lg:gap-8 lg:p-8">
      <section className="relative hidden min-h-[calc(100vh-64px)] overflow-hidden rounded-[24px] bg-[#EAF1F6] lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14" aria-labelledby="welcome-title">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-white/50 blur-3xl" aria-hidden="true" />
        <div className="relative z-10">
          <BrandLogo />
          <h1 id="welcome-title" className="mt-12 max-w-xl text-balance text-4xl font-bold leading-[1.16] tracking-[-0.035em] text-ink xl:mt-16 xl:text-5xl">
            Nhìn rõ năng lực.<br />Đi đúng lộ trình.
          </h1>
          <ul className="mt-8 space-y-3 text-sm font-medium text-ink">
            {[
              "Mọi gợi ý AI đều gắn với nguồn dữ liệu",
              "Lộ trình rõ ràng, chỉnh sửa được",
              "Quyền truy cập phù hợp với từng vai trò",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <CheckCircle2 className="text-sage" size={20} aria-hidden="true" /> {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative z-10 mt-10 flex items-end justify-between">
          <div className="rounded-2xl border border-white/80 bg-white/70 p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink"><ShieldCheck size={18} className="text-sage" aria-hidden="true" /> Dữ liệu mẫu an toàn</div>
            <p className="mt-1 text-xs text-muted">Không dùng thông tin nhân sự thật.</p>
          </div>
          <div className="relative h-64 w-64 xl:h-72 xl:w-72">
            <Image src="/brand/milo/milo-purple-tablet.webp" alt="Milo chào mừng bạn" fill priority sizes="288px" className="object-contain object-bottom" />
          </div>
        </div>
      </section>

      <section className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-xl items-center py-4 lg:min-h-0 lg:py-8" aria-labelledby="login-title">
        <div className="w-full rounded-2xl border border-border bg-surface p-5 shadow-soft sm:p-8 lg:border-0 lg:p-8 lg:shadow-none xl:p-12">
          <div className="mb-7 flex items-center justify-between gap-4 lg:hidden">
            <BrandLogo />
            <div className="relative size-24 shrink-0 sm:size-28">
              <Image src="/brand/milo/milo-purple-tablet.webp" alt="Milo chào mừng bạn" fill priority sizes="112px" className="object-contain" />
            </div>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Chào mừng trở lại</p>
          <h2 id="login-title" className="mt-2 text-2xl font-bold tracking-[-0.025em] text-ink sm:text-3xl">Mở không gian CareerMate</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            {demoMode ? "Chọn tài khoản mẫu để xem đúng giao diện và quyền của từng vai trò." : "Đăng nhập bằng tài khoản CareerMate do tổ chức của bạn cung cấp."}
          </p>
          <div className="mt-8"><LoginForm /></div>
        </div>
      </section>
    </main>
  );
}
