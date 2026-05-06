import type { Metadata } from 'next';
import { Suspense } from 'react';
import NewHighsClient from './NewHighsClient';

type SP = Promise<{ gu?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const { gu } = await searchParams;
  const title = gu ? `서울집주인 - 우리동네 신고가 - ${gu}` : '서울집주인 - 우리동네 신고가';
  return { title, openGraph: { title } };
}

export default function NewHighsPage() {
  return <Suspense><NewHighsClient /></Suspense>;
}
