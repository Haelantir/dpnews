import fs from 'fs';
import path from 'path';

const ROUTE_COLOR: Record<string, string> = {
  '1호선': '#263C96', '경인선': '#263C96',
  '2호선': '#3ab449',
  '3호선': '#f77636', '일산선': '#f77636',
  '4호선': '#2c9ede', '과천선': '#2c9ede', '안산선': '#2c9ede', '진접선': '#2c9ede',
  '5호선': '#833edb',
  '6호선': '#b5500c',
  '7호선': '#697215', '7호선(인천)': '#697215',
  '8호선': '#e41e6e', '별내선': '#e41e6e',
  '9호선': '#c9a754', '9호선(연장)': '#c9a754',
  '경의중앙선': '#7dc5a8', '중앙선': '#7dc5a8', '경원선': '#7dc5a8',
  '경춘선': '#4fc39e',
  '신분당선': '#b5283b', '신분당선(연장)': '#b5283b', '신분당선(연장2)': '#b5283b',
  '공항철도1호선': '#73b6e4',
  '수인선': '#f3d81f', '분당선': '#f3d81f',
  '경강선': '#1d86dd',
  '서해선': '#8bc53f',
  '우이신설선': '#bdb93f',
  '신림선': '#4e67a5',
  '김포골드라인': '#96710A',
  '에버라인선': '#77c371',
  '의정부선': '#ff9d27',
  '인천1호선': '#6f99d0',
  '인천2호선': '#fca92f',
  '수도권 광역급행철도': '#905A89',
  '경부선': '#CECECE', '장항선': '#CECECE',
};

interface RawStation { bldn_id: string; route: string; lot: string; bldn_nm: string; lat: string; }
export interface StationMarker { name: string; lat: number; lng: number; colors: string[]; }

let cache: StationMarker[] | null = null;

export async function GET() {
  if (cache) return Response.json(cache);

  const raw = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data', '서울시_역사마스터_정보.json'), 'utf-8')
  );
  const items: RawStation[] = raw.DATA;

  const groups = new Map<string, { lats: number[]; lngs: number[]; colors: Set<string> }>();
  for (const item of items) {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lot);
    if (isNaN(lat) || isNaN(lng)) continue;
    if (!groups.has(item.bldn_nm)) groups.set(item.bldn_nm, { lats: [], lngs: [], colors: new Set() });
    const g = groups.get(item.bldn_nm)!;
    g.lats.push(lat);
    g.lngs.push(lng);
    g.colors.add(ROUTE_COLOR[item.route] ?? '#D6D6D6');
  }

  cache = [];
  for (const [name, g] of groups) {
    cache.push({
      name,
      lat: g.lats.reduce((a, b) => a + b, 0) / g.lats.length,
      lng: g.lngs.reduce((a, b) => a + b, 0) / g.lngs.length,
      colors: [...g.colors],
    });
  }

  return Response.json(cache);
}
