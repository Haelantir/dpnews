import type { Metadata } from 'next';
import { Suspense } from 'react';
import TopAptsClient from './TopAptsClient';

type SP = Promise<{ gu?: string; areaType?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const { gu, areaType } = await searchParams;
  const parts: string[] = [];
  if (gu) parts.push(gu);
  if (areaType) parts.push(areaType === '100+' ? '100㎡ 이상' : `${areaType}㎡`);
  const sub = parts.length ? ` - ${parts.join(' ')}` : '';
  const title = `서울집주인 - 지역별 대장아파트${sub}`;
  const description = '서울 각 구·동의 대장아파트와 최고 실거래가를 확인하세요. 지역별 시세를 이끄는 대표 아파트 정보를 제공합니다.';
  return { title, description, openGraph: { title, description } };
}

export default function TopAptsPage() {
  return <Suspense><TopAptsClient /></Suspense>;
}
