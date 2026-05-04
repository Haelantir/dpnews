import { getNewHighsByGu } from '@/lib/server-data';

export async function GET(req: Request) {
  const gu = new URL(req.url).searchParams.get('gu') ?? '';
  if (!gu) return Response.json([]);
  return Response.json(getNewHighsByGu(gu));
}
