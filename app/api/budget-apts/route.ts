import { getBudgetApts, type AreaType } from '@/lib/server-data';

const HEADERS = { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' };
const VALID: AreaType[] = ['59', '84', '100+'];

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('areaType') ?? '84';
  const areaType = (VALID.includes(raw as AreaType) ? raw : '84') as AreaType;
  return Response.json(getBudgetApts(areaType), { headers: HEADERS });
}
