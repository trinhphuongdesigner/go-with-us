import type { Metadata } from 'next';
import { Be_Vietnam_Pro, JetBrains_Mono } from 'next/font/google';
import ThemeRegistry from '@/theme/ThemeRegistry';
import { AuthProvider } from '@/contexts/AuthContext';
import AppShell from '@/components/layout/AppShell';
import FloatingAssistant from '@/components/assistant/FloatingAssistant';
import './globals.css';

// One sans family for title/body/button (agent.md §6). Mono is code-only.
const beVietnamPro = Be_Vietnam_Pro({
  variable: '--font-be-vietnam-pro',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'CareerMate',
  description: 'CareerMate — nền tảng hồ sơ năng lực và quản trị nhân sự',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      className={`${beVietnamPro.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <ThemeRegistry>
          <AuthProvider>
            <AppShell>{children}</AppShell>
            <FloatingAssistant />
          </AuthProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
