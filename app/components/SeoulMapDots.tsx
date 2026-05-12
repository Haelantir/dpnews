'use client';

import { useState, useEffect, useMemo } from 'react';

type AreaKey = '59' | '84' | '100';
type AreaType = '59' | '84' | '100+';

interface AptDot {
  lat: number; lng: number;
  '59'?: [number, string]; '84'?: [number, string]; '100'?: [number, string];
}
interface AptMapData { gen: string; d: AptDot[]; }

// ── Projection (Seoul GeoJSON bounds) ─────────────────────────────────────────
const LNG_MIN = 126.767, LNG_MAX = 127.185;
const LAT_MAX = 37.699,  LAT_MIN = 37.4257;
const VW = 1000, VH = 825;
const lx = (lng: number) => (lng - LNG_MIN) / (LNG_MAX - LNG_MIN) * VW;
const ly = (lat: number) => (LAT_MAX - lat) / (LAT_MAX - LAT_MIN) * VH;

// ── 구 이름 라벨 ──────────────────────────────────────────────────────────────
const DISTRICT_LABELS: [string, number, number][] = [
  ['강남구', 737, 637], ['강동구', 920, 454], ['강북구', 587, 185],
  ['강서구', 124, 427], ['관악구', 428, 707], ['광진구', 782, 453],
  ['구로구', 211, 627], ['금천구', 327, 728], ['노원구', 740, 147],
  ['도봉구', 637,  92], ['동대문구', 694, 345], ['동작구', 435, 606],
  ['마포구', 348, 426], ['서대문구', 421, 360], ['서초구', 591, 679],
  ['성동구', 644, 446], ['성북구', 604, 298], ['송파구', 855, 610],
  ['양천구', 211, 545], ['영등포구', 339, 545], ['용산구', 520, 497],
  ['은평구', 383, 258], ['종로구', 493, 315], ['중구', 549, 434],
  ['중랑구', 793, 312],
];

// ── District pairs whose shared boundary is the Han River ─────────────────────
const RIVER_PAIRS: [string, string][] = [
  ['강서구', '마포구'],
  ['마포구', '영등포구'],
  ['영등포구', '용산구'],
  ['용산구', '동작구'],
  ['서초구', '용산구'],
  ['강남구', '용산구'],
  ['강남구', '성동구'],
  ['강남구', '광진구'],
  ['광진구', '송파구'],
  ['강동구', '광진구'],
];

// ── GeoJSON ring → SVG path ───────────────────────────────────────────────────
function ringToPath(ring: number[][]): string {
  return ring.map((pt, i) =>
    `${i ? 'L' : 'M'}${lx(pt[0]).toFixed(1)},${ly(pt[1]).toFixed(1)}`
  ).join('') + 'Z';
}
function featureToPath(geom: { type: string; coordinates: any }): string {
  if (geom.type === 'Polygon')
    return (geom.coordinates as number[][][]).map(ringToPath).join('');
  if (geom.type === 'MultiPolygon')
    return (geom.coordinates as number[][][][]).flatMap((p: number[][][]) => p.map(ringToPath)).join('');
  return '';
}

// ── Extract shared boundary edges between Han River district pairs ─────────────
function buildRiverBoundaryPath(features: any[]): string {
  const ringsByName = new Map<string, number[][][]>();
  for (const f of features) {
    const name: string = f.properties?.name;
    if (!name) continue;
    const geom = f.geometry;
    let rings: number[][][] = [];
    if (geom.type === 'Polygon') rings = geom.coordinates;
    else if (geom.type === 'MultiPolygon') rings = (geom.coordinates as number[][][][]).flat();
    ringsByName.set(name, (ringsByName.get(name) ?? []).concat(rings));
  }

  let path = '';
  const done = new Set<string>();

  for (const [a, b] of RIVER_PAIRS) {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (done.has(key)) continue;
    done.add(key);

    const ringsA = ringsByName.get(a) ?? [];
    const ringsB = ringsByName.get(b) ?? [];

    // Build forward-edge set for A: "lng1,lat1|lng2,lat2"
    const edgesA = new Set<string>();
    for (const ring of ringsA) {
      for (let i = 0; i < ring.length - 1; i++) {
        edgesA.add(`${ring[i][0]},${ring[i][1]}|${ring[i+1][0]},${ring[i+1][1]}`);
      }
    }

    // Find edges in B whose reverse is in A
    for (const ring of ringsB) {
      for (let i = 0; i < ring.length - 1; i++) {
        const rev = `${ring[i+1][0]},${ring[i+1][1]}|${ring[i][0]},${ring[i][1]}`;
        if (edgesA.has(rev)) {
          path += `M${lx(ring[i][0]).toFixed(1)},${ly(ring[i][1]).toFixed(1)}L${lx(ring[i+1][0]).toFixed(1)},${ly(ring[i+1][1]).toFixed(1)}`;
        }
      }
    }
  }

  return path;
}

// ── Color ─────────────────────────────────────────────────────────────────────
function dotColor(r: number): string {
  const t = Math.max(0, Math.min(1, r));
  return `hsl(${Math.round(220 + t * 55)},${Math.round(78 - t * 8)}%,${Math.round(60 - t * 8)}%)`;
}

// ── Module-level cache ────────────────────────────────────────────────────────
let geoCached:  { features: any[] } | null = null;
let dotsCached: AptMapData | null = null;

// ── Component ─────────────────────────────────────────────────────────────────
export function SeoulMapDots({ minP, maxP, areaType, selectedGus, onGuClick }: {
  minP: number; maxP: number; areaType: AreaType;
  selectedGus: Set<string>;
  onGuClick: (gu: string) => void;
}) {
  const [geo,     setGeo]     = useState<typeof geoCached>(geoCached);
  const [mapData, setMapData] = useState<AptMapData | null>(dotsCached);

  useEffect(() => {
    let dead = false;
    async function fetchOnce<T>(
      url: string,
      cache: () => T | null,
      setCache: (v: T) => void,
      setter: (v: T) => void,
    ) {
      const hit = cache();
      if (hit) { setter(hit); return; }
      const v: T = await fetch(url).then(r => r.json());
      if (dead) return;
      setCache(v); setter(v);
    }
    fetchOnce('/data/seoul-geo.json', () => geoCached, v => { geoCached = v; }, setGeo);
    fetchOnce('/data/apt-map.json',   () => dotsCached, v => { dotsCached = v; }, setMapData);
    return () => { dead = true; };
  }, []);

  // District paths with names
  const districts = useMemo(
    () => geo?.features.map((f: any) => ({
      name: f.properties?.name as string,
      d: featureToPath(f.geometry),
    })) ?? [],
    [geo],
  );

  // River boundary path (shared edges between Han River district pairs)
  const riverBoundaryPath = useMemo(
    () => geo ? buildRiverBoundaryPath(geo.features) : '',
    [geo],
  );

  const cutoff = useMemo(() => {
    if (!mapData) return '';
    const d = new Date(mapData.gen);
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, [mapData]);

  const atKey: AreaKey = areaType === '59' ? '59' : areaType === '100+' ? '100' : '84';
  const minMw = Math.round(minP * 10000);
  const maxMw = isFinite(maxP) ? Math.round(maxP * 10000) : Infinity;

  const visibleDots = useMemo(() => {
    if (!mapData || !cutoff) return [];
    const raw = mapData.d.flatMap(dot => {
      const trade = dot[atKey];
      if (!trade) return [];
      const [price, date] = trade;
      if (date < cutoff || price < minMw || price > maxMw) return [];
      return [{ x: lx(dot.lng), y: ly(dot.lat), price }];
    });
    const effectiveMax = maxMw === Infinity
      ? raw.reduce((m, d) => d.price > m ? d.price : m, minMw + 1)
      : maxMw;
    const range = effectiveMax - minMw || 1;
    return raw.map(d => ({ x: d.x, y: d.y, ratio: (d.price - minMw) / range }));
  }, [mapData, cutoff, atKey, minMw, maxMw]);

  const BUCKETS = 5;
  const buckets = useMemo(() => {
    const b: typeof visibleDots[] = Array.from({ length: BUCKETS }, () => []);
    for (const d of visibleDots) b[Math.min(BUCKETS - 1, Math.floor(d.ratio * BUCKETS))].push(d);
    return b;
  }, [visibleDots]);

  return (
    <div style={{ width: '100%', marginBottom: 16 }}>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        overflow="hidden"
        style={{ width: '100%', height: 'auto', display: 'block', background: '#111', borderRadius: 4, border: '1px solid #333', cursor: geo ? 'pointer' : 'default' }}
        aria-hidden
      >
        {/* 구 채우기 (선택 여부에 따라 색상 반전) */}
        {districts.map(({ name, d }) => {
          const selected = selectedGus.has(name);
          return (
            <path key={name} d={d}
              fill={selected ? '#ffd6d6' : '#e8e8e6'}
              stroke="none"
              onClick={() => onGuClick(name)}
              style={{ cursor: 'pointer' }}
            />
          );
        })}

        {/* 구 경계선 */}
        {districts.map(({ name, d }) => (
          <path key={`b${name}`} d={d}
            fill="none" stroke="#bbb" strokeWidth={0.7} strokeLinejoin="round"
            style={{ pointerEvents: 'none' }}
          />
        ))}

        {/* 한강 경계 (인접 구 공유 경계선을 하늘색 굵은 선으로) */}
        {riverBoundaryPath && (
          <path d={riverBoundaryPath}
            fill="none" stroke="#7ab8d4" strokeWidth={2.8}
            strokeLinecap="round" strokeLinejoin="round"
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* 구 이름 */}
        {geo && DISTRICT_LABELS.map(([name, x, y]) => {
          const selected = selectedGus.has(name);
          return (
            <text key={name} x={x} y={y}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={17} fill={selected ? '#333' : '#999'}
              fontWeight={selected ? 700 : 400}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {name}
            </text>
          );
        })}

        {/* 아파트 dot (blur 없음) */}
        {visibleDots.length > 0 && buckets.map((group, bi) => {
          if (!group.length) return null;
          const fill = dotColor((bi + 0.5) / BUCKETS);
          return (
            <g key={bi} opacity={0.85}>
              {group.map((dot, di) => (
                <circle key={di} cx={dot.x.toFixed(1)} cy={dot.y.toFixed(1)} r={5} fill={fill} style={{ pointerEvents: 'none' }} />
              ))}
            </g>
          );
        })}

        {!geo && (
          <text x={VW / 2} y={VH / 2} textAnchor="middle" dominantBaseline="middle" fontSize={50} fill="#555">
            로딩 중…
          </text>
        )}
      </svg>

      {visibleDots.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, fontSize: 11, color: '#888' }}>
          <span>저가</span>
          <div style={{ display: 'flex', height: 10, width: 80, borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i} style={{ flex: 1, background: dotColor(i / 19) }} />
            ))}
          </div>
          <span>고가</span>
          <span style={{ marginLeft: 4, color: '#666' }}>· 최근 30일 거래 {visibleDots.length}건</span>
        </div>
      )}
      {geo && !visibleDots.length && mapData && (
        <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
          해당 가격대에서 최근 30일간 거래된 아파트 없음
        </div>
      )}
    </div>
  );
}
