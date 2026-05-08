import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import Script from 'next/script';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';
import NavBar from './components/NavBar';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://seoulowner.co.kr'),
  title: '서울집주인',
  description: '서울 아파트 실거래가, 신고가, 특이거래, 지역별 대장아파트 정보',
  openGraph: {
    siteName: '서울집주인',
    type: 'website',
    locale: 'ko_KR',
  },
  verification: {
    google: 'ji3fpFWWAZpCvbShyiFeM9JUU4e_DUSO1fgAuzxzBQc',
    other: {
      'naver-site-verification': 'ab837b049d203284e4303542dfdb054d2fd876da',
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <NavBar />
        {children}
        <footer className="site-footer">
          <p>서울집주인이 제공하는 정보는 무단 복제·배포·전송 등에 이용할 수 없으며, 이를 무단 이용하는 경우 저작권법 등에 따라 법적 책임을 질 수 있습니다. 광고 문의 karakoram2310@gmail.com</p>
          <p>Copyright © 2026 서울집주인 by 시루콘텐츠파운드리. All Rights Reserved.</p>
        </footer>
        <Analytics />
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
