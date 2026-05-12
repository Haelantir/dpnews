import type { Metadata } from 'next';
import { Suspense } from 'react';
import NewHighsClient from './NewHighsClient';

type SP = Promise<{ gu?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const { gu } = await searchParams;
  const title = gu ? `서울집주인 - 우리동네 신고가 - ${gu}` : '서울집주인 - 우리동네 신고가';
  const description = '서울 아파트 신고가 거래를 구별로 확인하세요. 최근 신고가를 기록한 아파트 목록과 가격 차트를 제공합니다.';
  return { title, description, openGraph: { title, description } };
}

export default function NewHighsPage() {
  return <Suspense><NewHighsClient /></Suspense>;
}
