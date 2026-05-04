import { getAreas } from '@/lib/server-data';

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const areas = getAreas(p.get('gu') ?? '', p.get('dong') ?? '', p.get('apt') ?? '');
  return Response.json(areas);
}
