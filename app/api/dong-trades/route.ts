import { getTradesRange } from '@/lib/server-data';

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const gu = p.get('gu') ?? '';
  const dong = p.get('dong') ?? '';
  const apt = p.get('apt') ?? '';
  const minArea = Number(p.get('minArea') ?? 0);
  const maxArea = Number(p.get('maxArea') ?? 0);

  if (!gu || !dong || !apt || !minArea || !maxArea) return Response.json([]);
  const trades = getTradesRange(gu, dong, apt, minArea, maxArea);
  return Response.json(trades);
}
