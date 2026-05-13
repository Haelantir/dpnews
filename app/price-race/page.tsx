import type { Metadata } from 'next';
import { Suspense } from 'react';
import PriceRaceClient from './PriceRaceClient';

export const metadata: Metadata = {
  title: '서울집주인 - 시세 레이스',
  description: '2020년부터 현재까지 아파트 ㎡당 단가 변화를 바 차트 레이스로 확인하세요. 구·면적별로 아파트 순위 변동을 한눈에 볼 수 있습니다.',
  openGraph: {
    title: '서울집주인 - 시세 레이스',
    description: '2020년부터 현재까지 아파트 ㎡당 단가 변화를 바 차트 레이스로 확인하세요.',
  },
};

export default function PriceRacePage() {
  return <Suspense><PriceRaceClient /></Suspense>;
}
