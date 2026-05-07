import type { Metadata } from 'next';
import { Suspense } from 'react';
import BudgetAptsClient from './BudgetAptsClient';

export const metadata: Metadata = {
  title: '서울집주인 - 예산에 맞는 아파트',
  openGraph: { title: '서울집주인 - 예산에 맞는 아파트' },
};

export default function BudgetAptsPage() {
  return <Suspense><BudgetAptsClient /></Suspense>;
}
