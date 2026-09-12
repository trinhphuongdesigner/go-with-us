"use client";

import { Check, CheckCircle2, Info, RotateCcw, ShieldAlert, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { useAppearance } from "./appearance-context";
import { DEFAULT_THEME_ID, THEME_PRESETS, type ThemePresetId } from "./themes";

export function AppearanceSettings() {
  const {
    currentPresetId,
    appliedPresetId,
    previewPresetId,
    isBlocked,
    isEmployee,
    isAdminLocked,
    previewPreset,
    applyPreset,
    cancelPreview,
    restoreDefault,
  } = useAppearance();

  const [liveFeedback, setLiveFeedback] = useState<string>("");

  // Clean up any unapplied preview when leaving this screen (navigation away or remount)
  useEffect(() => {
    return () => {
      cancelPreview();
    };
  }, [cancelPreview]);

  const handleSelectPreset = (presetId: ThemePresetId) => {
    if (!isEmployee) return;
    previewPreset(presetId);
    const preset = THEME_PRESETS.find((p) => p.id === presetId);
    setLiveFeedback(`Đang xem trước giao diện: ${preset?.name ?? presetId}`);
  };

  const handleRadioKeyDown = (e: React.KeyboardEvent) => {
    if (!isEmployee || isAdminLocked) return;
    const currentIndex = THEME_PRESETS.findIndex((p) => p.id === currentPresetId);
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      const nextPreset = THEME_PRESETS[(currentIndex + 1) % THEME_PRESETS.length];
      handleSelectPreset(nextPreset.id);
      document.getElementById(`preset-radio-${nextPreset.id}`)?.focus();
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      const prevPreset = THEME_PRESETS[(currentIndex - 1 + THEME_PRESETS.length) % THEME_PRESETS.length];
      handleSelectPreset(prevPreset.id);
      document.getElementById(`preset-radio-${prevPreset.id}`)?.focus();
    }
  };

  const handleApply = () => {
    if (!isEmployee) return;
    const result = applyPreset(currentPresetId);
    const preset = THEME_PRESETS.find((p) => p.id === currentPresetId);
    const presetName = preset?.name ?? currentPresetId;
    if (result.isBlocked) {
      setLiveFeedback(`Đã áp dụng tạm thời giao diện: ${presetName} (chỉ trong phiên làm việc này do bộ nhớ trình duyệt bị hạn chế)`);
    } else {
      setLiveFeedback(`Đã lưu giao diện: ${presetName}`);
    }
  };

  const handleCancelPreview = () => {
    if (!isEmployee) return;
    cancelPreview();
    const preset = THEME_PRESETS.find((p) => p.id === appliedPresetId);
    setLiveFeedback(`Đã hủy xem trước. Quay lại giao diện: ${preset?.name ?? appliedPresetId}`);
  };

  const handleRestoreDefault = () => {
    if (!isEmployee) return;
    const result = restoreDefault();
    if (result.isBlocked) {
      setLiveFeedback("Đã khôi phục tạm thời giao diện Bright Milo mặc định (chỉ trong phiên làm việc này do bộ nhớ trình duyệt bị hạn chế)");
    } else {
      setLiveFeedback("Đã khôi phục giao diện Bright Milo mặc định");
    }
  };

  const isChanged = currentPresetId !== appliedPresetId;
  const isPreviewing = previewPresetId !== null;
  const isCurrentlyDefault = appliedPresetId === DEFAULT_THEME_ID && !isPreviewing;

  return (
    <div className="space-y-6">
      {/* Screen Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Cá nhân hóa</p>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-ink sm:text-3xl">Giao diện hiển thị</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Tùy chỉnh sắc độ sáng của hệ thống theo ý thích. Tùy chọn giao diện được lưu trữ cục bộ trên trình duyệt của thiết bị này và không đồng bộ qua máy chủ hay thiết bị khác.
        </p>
      </div>

      {/* Screen reader live feedback region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveFeedback}
      </div>

      {/* Storage blocked warning */}
      {isBlocked ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-[#F5D998] bg-[#FFF9ED] p-4 text-[#80520F]"
        >
          <ShieldAlert size={20} className="shrink-0 text-[#C88A2B]" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold">Bộ nhớ trình duyệt bị hạn chế</p>
            <p className="mt-1 leading-5 text-xs text-[#80520F]">
              Trình duyệt đang hạn chế truy cập bộ nhớ. Các thay đổi tạm thời có thể bị mất và hệ thống sẽ áp dụng cài đặt đã lưu thành công gần nhất thay vì đảm bảo quay về mặc định khi bạn tải lại trang.
            </p>
          </div>
        </div>
      ) : null}

      {/* Admin locked notice */}
      {isAdminLocked ? (
        <Card className="flex items-start gap-3 border-border bg-surface p-5">
          <Info size={20} className="shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold text-ink">Giao diện quản trị tiêu chuẩn</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Tài khoản quản trị viên và người quản lý công ty được duy trì giao diện Bright Milo mặc định để bảo đảm tính thống nhất cho toàn bộ hệ thống và quy chuẩn điều hành.
            </p>
          </div>
        </Card>
      ) : null}

      {/* Preset selection section */}
      <section aria-labelledby="appearance-presets-title">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="appearance-presets-title" className="text-base font-bold text-ink">
            Bảng màu chủ đề
          </h2>
          <p className="text-xs text-muted">
            {isAdminLocked
              ? "Chỉ hiển thị giao diện mặc định dành cho quyền quản trị"
              : "Chọn một giao diện để xem trước trực tiếp trên ứng dụng"}
          </p>
        </div>

        {/* Radio group list */}
        <div
          role="radiogroup"
          aria-labelledby="appearance-presets-title"
          onKeyDown={handleRadioKeyDown}
          className="mt-4 grid gap-4 md:grid-cols-3"
        >
          {THEME_PRESETS.map((preset) => {
            const isSelected = currentPresetId === preset.id;
            const isApplied = appliedPresetId === preset.id;
            const isCurrentlyPreviewed = previewPresetId === preset.id;
            const isDisabled = isAdminLocked;

            return (
              <label
                key={preset.id}
                htmlFor={`preset-radio-${preset.id}`}
                className={cn(
                  "relative flex cursor-pointer flex-col justify-between rounded-2xl border p-5 transition-all focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2",
                  isSelected
                    ? "border-primary bg-surface shadow-sm ring-1 ring-primary"
                    : "border-border bg-surface hover:border-ink/30",
                  isDisabled && "cursor-not-allowed opacity-80",
                )}
              >
                <input
                  type="radio"
                  id={`preset-radio-${preset.id}`}
                  name="theme-preset"
                  value={preset.id}
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => handleSelectPreset(preset.id)}
                  className="sr-only"
                  aria-label={`${preset.name}: ${preset.description}`}
                />

                <div>
                  {/* Card header with radio indicator, title and badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "grid size-5 place-items-center rounded-full border transition-colors",
                          isSelected
                            ? "border-primary bg-primary text-white"
                            : "border-muted bg-surface",
                        )}
                        aria-hidden="true"
                      >
                        {isSelected ? <Check size={12} strokeWidth={3} /> : null}
                      </span>
                      <span className="font-bold text-ink text-sm sm:text-base">{preset.name}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {preset.badge ? (
                        <Badge tone="neutral">{preset.badge}</Badge>
                      ) : null}
                      {isApplied && !isCurrentlyPreviewed ? (
                        <Badge tone="success">Đang dùng</Badge>
                      ) : null}
                      {isCurrentlyPreviewed ? (
                        <Badge tone="warning">Xem trước</Badge>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-muted">{preset.description}</p>
                </div>

                {/* Color swatches preview with text labels for accessibility */}
                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                    Sắc độ thành phần
                  </p>
                  <div className="mt-2.5 grid grid-cols-4 gap-2">
                    <div className="space-y-1 text-center">
                      <div
                        className="h-8 w-full rounded-lg border border-black/10 shadow-xs"
                        style={{ backgroundColor: preset.colors.primary }}
                        aria-hidden="true"
                      />
                      <span className="block truncate text-[10px] text-muted">Chính</span>
                    </div>

                    <div className="space-y-1 text-center">
                      <div
                        className="h-8 w-full rounded-lg border border-black/10 shadow-xs"
                        style={{ backgroundColor: preset.colors.primarySubtle }}
                        aria-hidden="true"
                      />
                      <span className="block truncate text-[10px] text-muted">Nhấn phụ</span>
                    </div>

                    <div className="space-y-1 text-center">
                      <div
                        className="h-8 w-full rounded-lg border border-black/10 shadow-xs"
                        style={{ backgroundColor: preset.colors.background }}
                        aria-hidden="true"
                      />
                      <span className="block truncate text-[10px] text-muted">Nền</span>
                    </div>

                    <div className="space-y-1 text-center">
                      <div
                        className="h-8 w-full rounded-lg border border-black/10 shadow-xs"
                        style={{ backgroundColor: preset.colors.ink }}
                        aria-hidden="true"
                      />
                      <span className="block truncate text-[10px] text-muted">Chữ</span>
                    </div>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      {/* Interactive Controls Bar for Employees */}
      {isEmployee ? (
        <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Sparkles size={16} className="shrink-0 text-primary" aria-hidden="true" />
            <span>
              {isPreviewing
                ? "Bạn đang xem trước giao diện mới. Nhấn Lưu để áp dụng hoặc Hủy để quay về."
                : isChanged
                  ? "Có thay đổi chưa lưu. Nhấn Lưu giao diện để áp dụng."
                  : "Giao diện đang được hiển thị đúng theo cài đặt đã lưu."}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Cancel preview button */}
            {isPreviewing ? (
              <Button
                type="button"
                variant="secondary"
                onClick={handleCancelPreview}
                className="h-10 text-xs sm:text-sm"
              >
                Hủy xem trước
              </Button>
            ) : null}

            {/* Restore default button */}
            <Button
              type="button"
              variant="ghost"
              onClick={handleRestoreDefault}
              disabled={isCurrentlyDefault}
              className="h-10 text-xs text-muted hover:text-ink sm:text-sm"
              aria-label="Khôi phục giao diện Bright Milo mặc định"
            >
              <RotateCcw size={15} aria-hidden="true" />
              Khôi phục mặc định
            </Button>

            {/* Apply button: disabled when unchanged */}
            <Button
              type="button"
              variant="primary"
              onClick={handleApply}
              disabled={!isChanged}
              className="h-10 text-xs sm:text-sm"
            >
              <CheckCircle2 size={16} aria-hidden="true" />
              Lưu giao diện
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
