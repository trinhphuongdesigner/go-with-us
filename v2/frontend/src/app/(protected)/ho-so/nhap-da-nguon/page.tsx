import { redirect } from "next/navigation";

export const metadata = { title: "Nhập hồ sơ từ tài liệu" };

export default function RichImportPage() {
  redirect("/ho-so/import");
}
