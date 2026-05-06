import { getUnusualTradesByGu } from '@/lib/server-data';

const HEADERS = { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' };

export async function GET(req: Request) {
  const gu = new URL(req.url).searchParams.get('gu') ?? '';
  if (!gu) return Response.json([], { headers: HEADERS });
  return Response.json(getUnusualTradesByGu(gu), { headers: HEADERS });
}
