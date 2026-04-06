import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Netflix英語フラッシュカード',
  description: 'Netflix作品から学ぶ英語フレーズ - スペース反復学習',
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="dark">
      <body className="bg-[#141414] text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
