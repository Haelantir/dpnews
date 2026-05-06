import type { Metadata } from 'next';
import { Suspense } from 'react';
import UnusualTradesClient from './UnusualTradesClient';

type SP = Promise<{ gu?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const { gu } = await searchParams;
  const title = gu ? `서울집주인 - 우리동네 특이거래 - ${gu}` : '서울집주인 - 우리동네 특이거래';
  return { title, openGraph: { title } };
}

export default function UnusualTradesPage() {
  return <Suspense><UnusualTradesClient /></Suspense>;
}
