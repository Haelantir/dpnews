import filterData from '@/lib/filter-data.json';
import areasIndex from '@/lib/areas-index.json';
import { getTradesRange } from '@/lib/server-data';

type Coords = Record<string, { lat: number; lng: number }>;

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const gu = p.get('gu') ?? '';
  const dong = p.get('dong') ?? '';
  const apt = p.get('apt') ?? '';
  const area = Number(p.get('area') ?? 0);

  const coords = (filterData as { coords: Coords }).coords;
  const myKey = `${apt}|${gu}|${dong}`;
  const myCoord = coords[myKey];
  if (!myCoord || !area) return Response.json([]);

  const minArea = area * 0.9;
  const maxArea = area * 1.1;

  const results: { aptNm: string; gu: string; dong: string; area: number; trades: ReturnType<typeof getTradesRange> }[] = [];

  for (const [key, coord] of Object.entries(coords)) {
    if (key === myKey) continue;
    const dist = haversine(myCoord.lat, myCoord.lng, coord.lat, coord.lng);
    if (dist > 1000) continue;

    const [nm, g, d] = key.split('|');
    const aptAreas = (areasIndex as Record<string, number[]>)[key] ?? [];
    const matchingAreas = aptAreas.filter(a => a >= minArea && a <= maxArea);
    if (matchingAreas.length === 0) continue;

    const trades = getTradesRange(g, d, nm, minArea, maxArea);
    if (trades.length > 0) {
      results.push({ aptNm: nm, gu: g, dong: d, area: matchingAreas[0], trades });
    }
  }

  return Response.json(results);
}
