'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: '우리동네 실거래가', href: '/trades' },
  { label: '우리동네 신고가', href: '/new-highs' },
  { label: '우리동네 특이거래', href: '/unusual-trades' },
  { label: '지역별 대장아파트', href: '/top-apts' },
  { label: '공지사항', href: '/notices' },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <header className="navbar-root">
      <div className="navbar-inner">
        <Link href="/trades" className="navbar-brand">
          <img src="/logo2.png" alt="서울집주인" className="navbar-logo2" />
        </Link>
        <nav className="navbar-tabs">
          {TABS.map(tab => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`navbar-tab${isActive ? ' active' : ''}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
