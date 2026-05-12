import type { Metadata } from 'next';
import { Suspense } from 'react';
import SeoulRankingClient from './SeoulRankingClient';

export const metadata: Metadata = {
  title: '서울집주인 - 서울 아파트값 순위',
  description: '서울 25개 구 아파트값 순위를 한눈에 비교하세요. 평균 실거래가 기준 구별 순위와 상위 아파트 목록을 제공합니다.',
  openGraph: { title: '서울집주인 - 서울 아파트값 순위', description: '서울 25개 구 아파트값 순위를 한눈에 비교하세요. 평균 실거래가 기준 구별 순위와 상위 아파트 목록을 제공합니다.' },
};

export default function SeoulRankingPage() {
  return <Suspense><SeoulRankingClient /></Suspense>;
}
