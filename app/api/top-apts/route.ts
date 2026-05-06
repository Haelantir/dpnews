import { getTopAptsByGu } from '@/lib/server-data';

const HEADERS = { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' };

export async function GET(req: Request) {
  const gu = new URL(req.url).searchParams.get('gu') ?? '';
  if (!gu) return Response.json({ chart: [], table: [] }, { headers: HEADERS });
  return Response.json(getTopAptsByGu(gu), { headers: HEADERS });
}
