import type { AssessmentGroup, AssessmentQuestion, AssessmentTemplate } from "./types";

export const SAMPLE_ASSESSMENT_TEMPLATE: AssessmentTemplate = {
  id: "template-tech-competency-v1",
  name: "Khung năng lực Kỹ sư Phần mềm (Frontend & Fullstack)",
  description:
    "Bộ tiêu chuẩn đánh giá năng lực chuyên môn, tư duy giải quyết vấn đề và tinh thần cộng tác trong chu kỳ đánh giá định kỳ.",
  groups: [
    {
      id: "group-technical",
      name: "Năng lực chuyên môn & Kỹ thuật",
      description: "Đánh giá kiến trúc mã nguồn, chất lượng giải pháp kỹ thuật và hiệu năng ứng dụng.",
      weight: 40,
      questions: [
        {
          id: "q-tech-code-quality",
          title: "Chất lượng mã nguồn và tư duy kiến trúc",
          helpText:
            "Viết mã mạch lạc, tuân thủ nguyên lý Clean Code/SOLID, xử lý ngoại lệ chặt chẽ và có unit test đầy đủ.",
          weight: 50,
        },
        {
          id: "q-tech-performance",
          title: "Hiệu năng và trải nghiệm người dùng",
          helpText:
            "Tối ưu tải trang, kiểm soát kích thước bundle, giảm thiểu re-render thừa và tuân thủ chuẩn Web Accessibility.",
          weight: 50,
        },
      ],
    },
    {
      id: "group-problem-solving",
      name: "Tư duy giải quyết vấn đề & Phân tích",
      description: "Khả năng phân rã bài toán phức tạp, phát hiện rủi ro và xử lý sự cố có hệ thống.",
      weight: 35,
      questions: [
        {
          id: "q-prob-analysis",
          title: "Phân tích yêu cầu và định hình giải pháp",
          helpText:
            "Làm rõ các yêu cầu phi chức năng, đánh giá trade-off kỹ thuật và đề xuất lộ trình triển khai khả thi.",
          weight: 60,
        },
        {
          id: "q-prob-troubleshoot",
          title: "Kỹ năng khắc phục sự cố (Troubleshooting & RCA)",
          helpText:
            "Khoanh vùng sự cố nhanh chóng, phân tích nguyên nhân gốc rễ và đưa ra giải pháp phòng ngừa tái diễn.",
          weight: 40,
        },
      ],
    },
    {
      id: "group-collaboration",
      name: "Giao tiếp & Tinh thần cộng tác",
      description: "Phối hợp liên chức năng, chia sẻ tri thức và văn hóa phản hồi mang tính xây dựng.",
      weight: 25,
      questions: [
        {
          id: "q-collab-feedback",
          title: "Văn hóa phản hồi và tiếp nhận đóng góp",
          helpText:
            "Giao tiếp cởi mở trong code review, lắng nghe ý kiến phản biện và tích cực đóng góp vào mục tiêu chung của đội ngũ.",
          weight: 50,
        },
        {
          id: "q-collab-mentoring",
          title: "Chia sẻ tri thức và hỗ trợ đồng nghiệp",
          helpText:
            "Chủ động tài liệu hóa quy trình, hướng dẫn thành viên mới và thúc đẩy văn hóa học tập liên tục.",
          weight: 50,
        },
      ],
    },
  ],
};

export function createEmptyTemplate(): AssessmentTemplate {
  return {
    id: `template-${Date.now()}`,
    name: "",
    description: "",
    groups: [],
  };
}

export function createNewGroup(index: number): AssessmentGroup {
  return {
    id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: `Nhóm tiêu chí ${index + 1}`,
    description: "",
    weight: 10,
    questions: [],
  };
}

export function createNewQuestion(groupIndex: number, questionIndex: number): AssessmentQuestion {
  return {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: `Tiêu chí ${questionIndex + 1}`,
    helpText: "",
    weight: 10,
  };
}
