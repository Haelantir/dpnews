import { getTopAptsByGu, type AreaType } from '@/lib/server-data';

const HEADERS = { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=3600' };

const VALID_AREA_TYPES: AreaType[] = ['59', '84', '100+'];

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const gu = p.get('gu') ?? '';
  const raw = p.get('areaType') ?? '84';
  const areaType: AreaType = (VALID_AREA_TYPES.includes(raw as AreaType) ? raw : '84') as AreaType;
  if (!gu) return Response.json({ chart: [], table: [] }, { headers: HEADERS });
  return Response.json(getTopAptsByGu(gu, areaType), { headers: HEADERS });
}
