import type { Metadata } from 'next';
import { Suspense } from 'react';
import SeoulRankingClient from './SeoulRankingClient';

export const metadata: Metadata = {
  title: '서울집주인 - 서울 아파트값 순위',
  openGraph: { title: '서울집주인 - 서울 아파트값 순위' },
};

export default function SeoulRankingPage() {
  return <Suspense><SeoulRankingClient /></Suspense>;
}
