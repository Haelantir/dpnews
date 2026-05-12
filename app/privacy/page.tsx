import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '서울집주인 - 개인정보처리방침',
  description: '서울집주인 개인정보처리방침',
  robots: { index: false },
};

export default function PrivacyPage() {
  return (
    <div className="page-wrap" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', lineHeight: 1.8, color: '#333' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 8 }}>개인정보처리방침</h1>
      <p style={{ fontSize: 13, color: '#999', marginBottom: 32 }}>최종 수정일: 2026년 5월 12일</p>

      <Section title="1. 수집하는 개인정보">
        <p>서울집주인(이하 "사이트")은 다음과 같은 정보를 수집할 수 있습니다.</p>
        <ul>
          <li>공지사항 댓글 작성 시: 작성자명, 댓글 내용, 비밀번호(암호화 저장)</li>
          <li>사이트 이용 시 자동 수집: IP 주소, 브라우저 종류, 방문 페이지, 접속 시간, 기기 정보, 쿠키</li>
        </ul>
      </Section>

      <Section title="2. 개인정보 수집 및 이용 목적">
        <ul>
          <li>댓글 서비스 제공 및 본인 확인</li>
          <li>서비스 이용 현황 파악 및 통계 분석</li>
          <li>맞춤형 광고 제공 (제3자 광고 서비스)</li>
        </ul>
      </Section>

      <Section title="3. 제3자 서비스">
        <p>사이트는 다음의 제3자 서비스를 사용합니다. 각 서비스는 자체적인 개인정보처리방침에 따라 데이터를 수집·처리합니다.</p>
        <ul>
          <li>
            <strong>Google Analytics</strong> — 방문자 통계 분석 목적으로 쿠키 및 이용 데이터를 수집합니다.{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#1d4ed8' }}>Google 개인정보처리방침</a>
          </li>
          <li>
            <strong>Google AdSense</strong> — 맞춤형 광고 제공 목적으로 쿠키, IP 주소, 기기 정보, 브라우징 행동 등을 수집합니다.{' '}
            <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer" style={{ color: '#1d4ed8' }}>Google 광고 정책</a>
          </li>
        </ul>
      </Section>

      <Section title="4. 맞춤형 광고 거부 방법">
        <p>Google의 맞춤형 광고를 원하지 않으시면 아래 페이지에서 설정을 변경하실 수 있습니다.</p>
        <ul>
          <li><a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" style={{ color: '#1d4ed8' }}>Google 광고 설정 페이지</a></li>
          <li><a href="https://optout.aboutads.info" target="_blank" rel="noopener noreferrer" style={{ color: '#1d4ed8' }}>디지털 광고 연합 광고 거부 페이지</a></li>
        </ul>
      </Section>

      <Section title="5. 쿠키 관리">
        <p>브라우저 설정에서 쿠키를 차단하거나 삭제할 수 있습니다. 다만 쿠키를 차단하면 일부 서비스 이용이 제한될 수 있습니다.</p>
      </Section>

      <Section title="6. 개인정보 보유 및 파기">
        <p>댓글은 사용자가 직접 삭제하거나 운영자가 삭제 요청을 받은 경우 즉시 파기합니다. 자동 수집 정보는 Google Analytics 정책에 따라 처리됩니다.</p>
      </Section>

      <Section title="7. 운영자 연락처">
        <p>개인정보 관련 문의는 아래로 연락주시기 바랍니다.</p>
        <ul>
          <li>운영자: 시루콘텐츠파운드리</li>
          <li>이메일: karakoram2310@gmail.com</li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 10, marginTop: 0 }}>{title}</h2>
      <div style={{ fontSize: 14, color: '#444', lineHeight: 1.8 }}>{children}</div>
    </section>
  );
}
