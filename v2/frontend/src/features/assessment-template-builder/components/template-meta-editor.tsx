"use client";

import { AlertCircle, FileText, Info } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ValidationError } from "../types";

interface TemplateMetaEditorProps {
  name: string;
  description: string;
  onChangeName: (name: string) => void;
  onChangeDescription: (description: string) => void;
  errors: ValidationError[];
}

export function TemplateMetaEditor({
  name,
  description,
  onChangeName,
  onChangeDescription,
  errors,
}: TemplateMetaEditorProps) {
  const nameError = errors.find((e) => e.fieldId === "template-name");
  const descriptionError = errors.find((e) => e.fieldId === "template-description");

  return (
    <Card className="min-w-0 w-full border-border shadow-xs">
      <CardContent className="min-w-0 space-y-4 pt-5 sm:pt-6">
        <div className="flex min-w-0 items-center gap-2 text-primary font-bold text-xs uppercase tracking-[0.12em]">
          <FileText size={16} className="shrink-0" aria-hidden="true" />
          <span>Thông tin chung về mẫu đánh giá</span>
        </div>

        <div className="min-w-0">
          <label htmlFor="template-name" className="block text-sm font-bold text-ink">
            Tên mẫu tiêu chí đánh giá <span className="text-danger" aria-hidden="true">*</span>
          </label>
          <p className="mt-0.5 text-xs text-muted">
            Đặt tên định danh cho khung năng lực (Ví dụ: Khung năng lực Kỹ sư phần mềm, Quản lý dự án,...)
          </p>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="Nhập tên mẫu tiêu chí..."
            aria-required="true"
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? "error-template-name" : undefined}
            className={`mt-1.5 min-w-0 ${nameError ? "border-danger focus:border-danger" : ""}`}
          />
          {nameError ? (
            <p
              id="error-template-name"
              className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger break-words [overflow-wrap:anywhere] [word-break:break-word]"
            >
              <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
              <span>{nameError.message}</span>
            </p>
          ) : null}
        </div>

        <div className="min-w-0">
          <label htmlFor="template-description" className="block text-sm font-bold text-ink">
            Mô tả mục đích & phạm vi áp dụng
          </label>
          <p className="mt-0.5 text-xs text-muted">
            Tóm tắt đối tượng áp dụng, ngữ cảnh đánh giá định kỳ hoặc mục tiêu phát triển nghề nghiệp.
          </p>
          <textarea
            id="template-description"
            rows={3}
            value={description}
            onChange={(e) => onChangeDescription(e.target.value)}
            placeholder="Nhập mô tả tóm tắt..."
            aria-invalid={Boolean(descriptionError)}
            aria-describedby={descriptionError ? "error-template-description" : undefined}
            className={`mt-1.5 min-w-0 w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-ink shadow-[0_1px_2px_rgb(22_32_51_/_4%)] transition-colors placeholder:text-muted/70 hover:border-muted/50 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-background ${
              descriptionError ? "border-danger focus:border-danger" : ""
            }`}
          />
          {descriptionError ? (
            <p
              id="error-template-description"
              className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger break-words [overflow-wrap:anywhere] [word-break:break-word]"
            >
              <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
              <span>{descriptionError.message}</span>
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 items-start gap-2.5 rounded-xl border border-border bg-background/60 p-3 text-xs leading-5 text-muted">
          <Info size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <span className="font-semibold text-ink">Lưu ý về bản xem trước (Local Draft):</span> Mọi thay đổi được lưu tạm trên bộ nhớ trình duyệt, không gửi yêu cầu lưu về máy chủ. Nếu làm mới (F5/Reload) trình duyệt, dữ liệu bản nháp sẽ trở về trạng thái mẫu ban đầu do đặc tính chỉ lưu trong bộ nhớ (in-memory only). Thang điểm và phân bổ trọng số là giả định xem trước phục vụ trải nghiệm người dùng, quy tắc tính điểm chính thức đang chờ phê duyệt theo hợp đồng W3.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

