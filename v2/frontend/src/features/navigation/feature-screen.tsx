"use client";

import { LockKeyhole } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/ui/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-provider";
import { AppearanceSettings } from "@/features/appearance";
import { CareerAiSettings } from "@/features/career-ai/settings";
import { OrganizationWorkspace } from "@/features/organization/organization-workspace";
import { PeopleListView } from "@/features/people/people-view";
import { ProfileView, type CoreUiForcedState } from "@/features/profile/profile-view";
import { RoadmapView } from "@/features/roadmap/roadmap-view";
import { canAccessPath } from "@/lib/navigation";

interface FeatureDetail {
  eyebrow: string;
  title: string;
  description: string;
}

export function FeatureScreen({ feature, detail, forceState, initialCompanyId }: { feature: string; detail: FeatureDetail; forceState?: CoreUiForcedState; initialCompanyId?: string }) {
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

  if (feature === "cai-dat") return <div className="space-y-8"><AppearanceSettings /><CareerAiSettings /></div>;
  if (feature === "cong-ty" || feature === "he-thong" || feature === "tai-khoan") return <OrganizationWorkspace initialCompanyId={initialCompanyId} />;

  if (feature === "lo-trinh") {
    const roadmapOwnerKey = `${session.user.companyId ?? "platform"}:${session.user.id}`;
    return <RoadmapView key={roadmapOwnerKey} />;
  }

  if (feature === "ho-so") {
    return <ProfileView forceState={forceState} />;
  }

  if (feature === "nhan-su") return <PeopleListView key={`${session.user.id}:${initialCompanyId ?? "default"}`} forceState={forceState} initialCompanyId={initialCompanyId} />;

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">{detail.eyebrow}</p>
      <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-ink sm:text-3xl">{detail.title}</h1>
      <p className="mt-2 mb-6 max-w-2xl text-sm leading-6 text-muted">Khu vực chức năng đã sẵn sàng để kết nối dữ liệu nghiệp vụ.</p>
      {feature === "cong-ty" ? (
        <Card className="flex flex-col items-start gap-4 p-6">
          <p className="text-sm leading-6 text-muted">Bản xem trước, chưa lưu lên máy chủ</p>
          <Button asChild>
            <Link href="/cong-ty/tieu-chi/preview" prefetch={false}>Thử trình tạo bộ đánh giá</Link>
          </Button>
        </Card>
      ) : (
        <EmptyState title="Đang chuẩn bị dữ liệu" description={detail.description} />
      )}
    </div>
  );
}
