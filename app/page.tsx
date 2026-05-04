'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const BUTTONS: ({ label: string; href: string } | null)[] = [
  { label: '우리동네 실거래가', href: '/trades' },
  { label: '우리동네 신고가', href: '/new-highs' },
  null,
  null, null, null,
  null, null, null,
];

export default function Home() {
  const [hovered, setHovered] = useState<number | null>(null);
  const router = useRouter();

  return (
    <div style={{
      minHeight: '100vh', background: '#fff',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <img src="/logo.png" alt="로고" style={{ maxWidth: 220, marginBottom: 48, display: 'block' }} />

      <div className="main-btn-grid">
        {BUTTONS.map((btn, i) => {
          const active = hovered === i && btn !== null;
          return (
            <div
              key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => btn && router.push(btn.href)}
              className="main-btn"
              style={{
                border: '1px solid #111',
                background: active ? '#111' : '#fff',
                color: active ? '#fff' : '#111',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 500,
                cursor: btn ? 'pointer' : 'default',
                userSelect: 'none',
              }}
            >
              {btn?.label ?? ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
