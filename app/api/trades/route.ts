import { getTrades } from '@/lib/server-data';

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const trades = getTrades(
    p.get('gu') ?? '',
    p.get('dong') ?? '',
    p.get('apt') ?? '',
    Number(p.get('area') ?? 0),
  );
  return Response.json(trades);
}
