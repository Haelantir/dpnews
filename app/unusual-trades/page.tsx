import type { Metadata } from 'next';
import { Suspense } from 'react';
import UnusualTradesClient from './UnusualTradesClient';

type SP = Promise<{ gu?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const { gu } = await searchParams;
  const title = gu ? `서울집주인 - 우리동네 특이거래 - ${gu}` : '서울집주인 - 우리동네 특이거래';
  const description = '서울 아파트 이상 하락 거래를 구별로 확인하세요. 직전 거래 대비 큰 폭으로 하락한 특이거래 아파트 목록을 제공합니다.';
  return { title, description, openGraph: { title, description } };
}

export default function UnusualTradesPage() {
  return <Suspense><UnusualTradesClient /></Suspense>;
}
