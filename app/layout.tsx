import type { Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}<Analytics /></body>
    </html>
  );
}
