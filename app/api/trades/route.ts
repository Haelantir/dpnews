import { getTrades } from '@/lib/server-data';

const HEADERS = { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' };

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const trades = getTrades(
    p.get('gu') ?? '',
    p.get('dong') ?? '',
    p.get('apt') ?? '',
    Number(p.get('area') ?? 0),
  );
  return Response.json(trades, { headers: HEADERS });
}
