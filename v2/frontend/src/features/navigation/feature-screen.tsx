"use client";

import { LockKeyhole } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/ui/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-provider";
import { RoadmapView } from "@/features/roadmap/roadmap-view";
import { canAccessPath } from "@/lib/navigation";

interface FeatureDetail {
  eyebrow: string;
  title: string;
  description: string;
}

export function FeatureScreen({ feature, detail }: { feature: string; detail: FeatureDetail }) {
  const { session } = useAuth();
  const pathname = `/${feature}`;

  if (!session || !canAccessPath(pathname, session.user.permissions)) {
    return (
      <Card role="alert" className="mx-auto flex min-h-80 max-w-2xl flex-col items-center justify-center p-8 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-[#FFF7E8] text-[#80520F]" aria-hidden="true">
          <LockKeyhole size={24} />
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[#80520F]">Không có quyền truy cập</p>
        <h1 className="mt-2 text-xl font-bold text-ink">Khu vực này không thuộc vai trò của bạn</h1>
        <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
          CareerMate đã chặn đường dẫn trực tiếp. Nếu cần sử dụng chức năng này, hãy liên hệ người quản trị công ty.
        </p>
        <Button asChild className="mt-6"><Link href="/dashboard" prefetch={false}>Về trang tổng quan</Link></Button>
      </Card>
    );
  }

  if (feature === "lo-trinh") {
    const roadmapOwnerKey = `${session.user.companyId ?? "platform"}:${session.user.id}`;
    return <RoadmapView key={roadmapOwnerKey} />;
  }

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">{detail.eyebrow}</p>
      <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-ink sm:text-3xl">{detail.title}</h1>
      <p className="mt-2 mb-6 max-w-2xl text-sm leading-6 text-muted">Khu vực chức năng đã sẵn sàng để kết nối dữ liệu nghiệp vụ.</p>
      <EmptyState title="Đang chuẩn bị dữ liệu" description={detail.description} />
    </div>
  );
}
