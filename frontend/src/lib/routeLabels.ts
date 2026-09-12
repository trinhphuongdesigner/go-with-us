export const ROUTE_SEGMENT_LABELS: Record<string, string> = {
  '': 'Trang chủ',
  companies: 'Công ty',
  'my-companies': 'Công ty',
  employees: 'Nhân sự',
  'job-requirements': 'Careers',
  'competency-requests': 'Yêu cầu',
  assistant: 'Trợ lý AI',
  assessments: 'Đánh giá chéo',
  profile: 'Hồ sơ của tôi',
  import: 'Cập nhật hồ sơ',
  settings: 'Cài đặt',
  'assessment-templates': 'Tiêu chí đánh giá',
  roles: 'Phân quyền',
  company: 'Quản lý công ty',
  passport: 'Hộ chiếu nghề nghiệp',
};

export function getSegmentLabel(segment: string): string {
  if (ROUTE_SEGMENT_LABELS[segment]) return ROUTE_SEGMENT_LABELS[segment];
  // ID-like segments (long alphanum cuids, uuids, etc.)
  if (segment.length > 8 && /^[a-z0-9]+$/i.test(segment)) return 'Chi tiết';
  return segment;
}
