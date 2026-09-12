import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { SearchInterpretation } from "./search-interpretation-schema";

const missingLabels = { ROLE: "vai trò", SKILLS: "kỹ năng", AVAILABILITY: "trạng thái sẵn sàng", TIMEFRAME: "khoảng thời gian" };

export function SearchInterpretationPanel({ interpretation, needsClarification }: { interpretation?: SearchInterpretation | null; needsClarification: boolean }) {
  if (!interpretation) return null;
  const details = [
    ...(interpretation.minimum_total_years === null ? [] : [`Tổng kinh nghiệm: ${interpretation.minimum_total_years_exclusive ? "trên" : "từ"} ${interpretation.minimum_total_years} năm`]),
    ...(interpretation.availability === "ANY" ? [] : [interpretation.availability === "AVAILABLE" ? "Sẵn sàng ngay" : "Sẵn sàng ngay hoặc sắp sẵn sàng"]),
    ...interpretation.title_keywords.map((title) => `Ưu tiên chức danh: ${title}`),
    ...interpretation.soft_preferences.map((preference) => `Ưu tiên thêm: ${preference}`),
  ];
  return (
    <Card role="region" aria-label="Tiêu chí AI đã phân tích" className="mt-4 min-w-0 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-ink">Tiêu chí AI đã phân tích</h2>
      <p className="mt-1 text-xs leading-5 text-muted">Đối chiếu với nhu cầu của bạn trước khi dùng kết quả. Đây là diễn giải yêu cầu, không phải xác nhận dữ liệu hồ sơ.</p>
      <p className="mt-3 wrap-anywhere text-sm text-ink">{interpretation.normalized_query}</p>
      <ul className="mt-3 space-y-2 text-sm text-ink">
        {interpretation.skills.map((skill, index) => (
          <li key={`${skill.name}-${index}`} className="flex min-w-0 flex-wrap items-start gap-2">
            <Badge tone="neutral">{skill.required ? "Bắt buộc" : "Ưu tiên"}</Badge>
            <span className="min-w-0 wrap-anywhere">{[skill.name, ...(skill.minimum_years === null ? [] : [`${skill.minimum_years_exclusive ? "trên" : "từ"} ${skill.minimum_years} năm`]), ...(skill.minimum_level === null ? [] : [`cấp độ từ ${skill.minimum_level}/5`])].join(" · ")}</span>
            {skill.canonical_skill_id === null ? <span className="text-xs font-semibold text-muted">Chưa xác định trong danh mục</span> : null}
          </li>
        ))}
        {interpretation.required_domains.map((domain, index) => (
          <li key={`${domain.name}-${index}`} className="min-w-0 wrap-anywhere">
            <span>Lĩnh vực bắt buộc: {domain.name}</span>
            {domain.canonical_domain === null ? <span className="ml-2 text-xs font-semibold text-muted">Chưa xác định trong danh mục</span> : null}
          </li>
        ))}
        {details.map((detail, index) => <li key={index} className="wrap-anywhere">{detail}</li>)}
        {interpretation.unsupported_constraints.map((constraint, index) => <li key={`unsupported-${index}`} className="wrap-anywhere font-semibold">Chưa hỗ trợ: {constraint}</li>)}
        {interpretation.missing_fields.map((field, index) => <li key={`missing-${index}`} className="wrap-anywhere font-semibold">Cần bổ sung: {missingLabels[field]}</li>)}
      </ul>
      {needsClarification ? <p className="mt-3 border-t border-border pt-3 text-sm font-semibold text-ink">Chưa áp dụng tìm kiếm; cần làm rõ các tiêu chí chưa xác định.</p> : null}
    </Card>
  );
}
