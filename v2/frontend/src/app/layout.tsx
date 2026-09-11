import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import type { Metadata } from "next";

import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CareerMate", template: "%s · CareerMate" },
  description: "Nền tảng phát triển năng lực và lộ trình nghề nghiệp đáng tin cậy.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <head>
        <meta name="careermate-build-sha" content={process.env.NEXT_PUBLIC_BUILD_SHA ?? "unknown"} />
      </head>
      <body>
        <a href="#main-content" className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-transform focus:translate-y-0">
          Bỏ qua đến nội dung chính
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
