import type { Metadata } from 'next';
import { Be_Vietnam_Pro, JetBrains_Mono } from 'next/font/google';
import ThemeRegistry from '@/theme/ThemeRegistry';
import { AuthProvider } from '@/contexts/AuthContext';
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
  description: 'CareerMate — competency & HR profile management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${beVietnamPro.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <ThemeRegistry>
          <AuthProvider>
            {children}
            <FloatingAssistant />
          </AuthProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
