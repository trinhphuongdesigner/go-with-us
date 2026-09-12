"use client";

import { LockKeyhole } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AssessmentBuilderView } from "@/features/assessment-template-builder";
import { useAuth } from "@/features/auth/auth-provider";
import { canAccessPath } from "@/lib/navigation";

export default function AssessmentBuilderPage() {
  const { session, status } = useAuth();
  const pathname = "/cong-ty/tieu-chi/preview";

  if (status === "loading") {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <p className="text-sm font-semibold text-muted">Đang xác thực quyền truy cập...</p>
      </div>
    );
  }

  const isAuthorized = Boolean(
    session &&
      canAccessPath(pathname, session.user.permissions) &&
      session.user.permissions.includes("company:manage"),
  );

  if (!isAuthorized) {
    return (
      <Card
        role="alert"
        className="mx-auto flex min-h-80 max-w-2xl flex-col items-center justify-center p-8 text-center"
      >
        <span
          className="grid size-12 place-items-center rounded-2xl bg-[#FFF7E8] text-[#80520F]"
          aria-hidden="true"
        >
          <LockKeyhole size={24} />
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[#80520F]">
          Không có quyền truy cập
        </p>
        <h1 className="mt-2 text-xl font-bold text-ink">
          Khu vực này không thuộc vai trò của bạn
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
          CareerMate đã chặn đường dẫn trực tiếp. Nếu cần sử dụng chức năng này, hãy liên hệ người quản trị công ty.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dashboard" prefetch={false}>
            Về trang tổng quan
          </Link>
        </Button>
      </Card>
    );
  }

  return <AssessmentBuilderView />;
}
