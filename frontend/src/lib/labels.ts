import type { Role } from '@/types';

export const DATE_LOCALE = 'vi-VN';

export function formatDate(iso: string, options?: Intl.DateTimeFormatOptions): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(DATE_LOCALE, options ?? { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatMonth(iso: string | null, empty = 'nay'): string {
  if (!iso) return empty;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(DATE_LOCALE, { year: 'numeric', month: 'short' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(DATE_LOCALE);
}

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Quản trị nền tảng',
  COMPANY_ADMIN: 'Quản trị công ty',
  BOD: 'Ban giám đốc',
  HR: 'Nhân sự',
  EMPLOYEE: 'Nhân sự',
};

export const ASSESSMENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  SUBMITTED: 'Đã gửi',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

export const ASSESSMENT_TYPE_LABEL: Record<string, string> = {
  SELF: 'Tự đánh giá',
  PEER: 'Đồng nghiệp',
};

export const GOAL_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Chưa bắt đầu',
  IN_PROGRESS: 'Đang thực hiện',
  ACHIEVED: 'Đã đạt',
  DONE: 'Hoàn thành',
};

export const EMPLOYMENT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Đang làm việc',
  ENDED: 'Đã kết thúc',
};

export const CYCLE_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Đang mở',
  CLOSED: 'Đã đóng',
};

export const TEMPLATE_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  ACTIVE: 'Đang dùng',
  ARCHIVED: 'Đã lưu trữ',
};

export const CERT_TYPE_LABEL: Record<string, string> = {
  DEGREE: 'Bằng cấp',
  LANGUAGE: 'Ngoại ngữ',
  PROFESSIONAL: 'Chuyên môn',
  OTHER: 'Khác',
};

export const JOB_STATUS_LABEL: Record<string, string> = {
  open: 'Đang mở',
  closed: 'Đã đóng',
};

export const MOOD_LABEL: Record<string, string> = {
  Energised: 'Tràn năng lượng',
  Steady: 'Ổn định',
  Stretched: 'Căng sức',
  Tired: 'Mệt',
  Frustrated: 'Bức bối',
};
