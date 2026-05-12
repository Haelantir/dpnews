import type { Metadata } from 'next';
import { Suspense } from 'react';
import BudgetAptsClient from './BudgetAptsClient';

export const metadata: Metadata = {
  title: '서울집주인 - 예산에 맞는 아파트',
  description: '예산에 맞는 서울 아파트를 찾아보세요. 원하는 가격 범위와 면적을 설정하면 조건에 맞는 최근 실거래 아파트 목록을 보여줍니다.',
  openGraph: { title: '서울집주인 - 예산에 맞는 아파트', description: '예산에 맞는 서울 아파트를 찾아보세요. 원하는 가격 범위와 면적을 설정하면 조건에 맞는 최근 실거래 아파트 목록을 보여줍니다.' },
};

export default function BudgetAptsPage() {
  return <Suspense><BudgetAptsClient /></Suspense>;
}
