import areasIndex from '@/lib/areas-index.json';

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const gu = p.get('gu') ?? '';
  const dong = p.get('dong') ?? '';
  const apt = p.get('apt') ?? '';
  const key = `${apt}|${gu}|${dong}`;
  const areas = (areasIndex as Record<string, number[]>)[key] ?? [];
  return Response.json(areas);
}
