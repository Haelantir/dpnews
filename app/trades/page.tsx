import type { Metadata } from 'next';
import { Suspense } from 'react';
import TradesClient from './TradesClient';

type SP = Promise<{ gu?: string; dong?: string; apt?: string; area?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const { gu, dong, apt, area } = await searchParams;
  const parts: string[] = [];
  if (gu) parts.push(gu);
  if (dong) parts.push(dong);
  if (apt) parts.push(apt);
  if (area) parts.push(`${area}㎡`);
  const sub = parts.length ? ` - ${parts.join(' ')}` : '';
  const title = `서울집주인 - 우리동네 실거래가${sub}`;
  return { title, openGraph: { title } };
}

export default function TradesPage() {
  return <Suspense><TradesClient /></Suspense>;
}
