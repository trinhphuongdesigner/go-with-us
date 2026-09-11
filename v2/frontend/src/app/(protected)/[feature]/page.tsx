import { notFound } from "next/navigation";

import { FeatureScreen } from "@/features/navigation/feature-screen";

const features: Record<string, { eyebrow: string; title: string; description: string }> = {
  "ho-so": { eyebrow: "Hồ sơ 360°", title: "Hồ sơ năng lực", description: "Kỹ năng, kinh nghiệm, dự án và chứng chỉ sẽ được tập hợp tại đây." },
  "lo-trinh": { eyebrow: "Đồng hành cùng Milo", title: "Lộ trình phát triển", description: "Lộ trình trực quan, milestone và mind map AI đang được kết nối với backend v2." },
  "danh-gia": { eyebrow: "Cross Assessment", title: "Đánh giá năng lực", description: "Chu kỳ, tiêu chí và các lượt đánh giá chéo sẽ xuất hiện tại đây." },
  "nhan-su": { eyebrow: "People Intelligence", title: "Đội ngũ", description: "Tìm kiếm nhân sự và theo dõi năng lực đội ngũ theo quyền truy cập." },
  "cong-ty": { eyebrow: "Quản trị", title: "Quản lý công ty", description: "Nhân sự, quyền và cấu hình tổ chức sẽ được quản lý tại đây." },
  "he-thong": { eyebrow: "Super Admin", title: "Quản trị hệ thống", description: "Quản lý doanh nghiệp và trạng thái nền tảng CareerMate." },
  "cai-dat": { eyebrow: "Cá nhân hóa", title: "Cài đặt", description: "Tài khoản, thông báo và các kết nối an toàn của bạn." },
};

export default async function FeaturePlaceholderPage({ params }: { params: Promise<{ feature: string }> }) {
  const { feature } = await params;
  const detail = features[feature];
  if (!detail) notFound();

  return <FeatureScreen feature={feature} detail={detail} />;
}
