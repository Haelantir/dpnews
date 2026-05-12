'use client';

import { useState, useEffect, useMemo } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

type AreaKey = '59' | '84' | '100';
type AreaType = '59' | '84' | '100+';

interface AptDot {
  lat: number;
  lng: number;
  '59'?: [number, string];
  '84'?: [number, string];
  '100'?: [number, string];
}

interface AptMapData {
  gen: string;
  d: AptDot[];
}

// ── Projection ─────────────────────────────────────────────────────────────────
// Seoul GeoJSON bounds: lng 126.767~127.185, lat 37.4257~37.699

const LNG_MIN = 126.767, LNG_MAX = 127.185;
const LAT_MAX = 37.699, LAT_MIN = 37.4257;
// Aspect ratio with cos-correction at lat 37.56°
// (0.418° lng × cos(37.56°)) / 0.2733° lat ≈ 1.212
const VW = 1000, VH = 825;

const lx = (lng: number) => (lng - LNG_MIN) / (LNG_MAX - LNG_MIN) * VW;
const ly = (lat: number) => (LAT_MAX - lat) / (LAT_MAX - LAT_MIN) * VH;

// ── Han River polygon (simplified, embedded) ───────────────────────────────────

const HAN_NORTH: [number, number][] = [
  [126.800, 37.530], [126.840, 37.527], [126.870, 37.527],
  [126.910, 37.527], [126.940, 37.527], [126.960, 37.524],
  [126.990, 37.521], [127.020, 37.521], [127.040, 37.521],
  [127.065, 37.526], [127.090, 37.524], [127.110, 37.524],
  [127.135, 37.524], [127.155, 37.534], [127.185, 37.549],
];
const HAN_SOUTH: [number, number][] = [
  [126.800, 37.517], [126.840, 37.515], [126.870, 37.514],
  [126.910, 37.514], [126.940, 37.513], [126.960, 37.511],
  [126.990, 37.508], [127.020, 37.508], [127.040, 37.508],
  [127.065, 37.509], [127.090, 37.507], [127.110, 37.509],
  [127.135, 37.509], [127.155, 37.519], [127.185, 37.535],
];

function buildHanRiverPath(): string {
  const pts = [...HAN_NORTH, ...[...HAN_SOUTH].reverse()];
  return pts.map((p, i) => `${i ? 'L' : 'M'}${lx(p[0]).toFixed(1)},${ly(p[1]).toFixed(1)}`).join('') + 'Z';
}

const HAN_PATH = buildHanRiverPath();

// ── GeoJSON → SVG path ─────────────────────────────────────────────────────────

function ringToPath(ring: number[][]): string {
  return ring.map((pt, i) =>
    `${i ? 'L' : 'M'}${lx(pt[0]).toFixed(1)},${ly(pt[1]).toFixed(1)}`
  ).join('') + 'Z';
}

function featureToPath(feature: { geometry: { type: string; coordinates: number[][][] | number[][][][] } }): string {
  const { type, coordinates } = feature.geometry;
  if (type === 'Polygon') {
    return (coordinates as number[][][]).map(ringToPath).join('');
  }
  if (type === 'MultiPolygon') {
    return (coordinates as number[][][][]).flatMap(poly => poly.map(ringToPath)).join('');
  }
  return '';
}

// ── Color ──────────────────────────────────────────────────────────────────────

function dotColor(priceRatio: number): string {
  const r = Math.max(0, Math.min(1, priceRatio));
  const hue = Math.round(220 + r * 55);       // 220=blue → 275=purple
  const sat = Math.round(78 - r * 8);          // 78% → 70%
  const lit = Math.round(60 - r * 8);          // 60% → 52%
  return `hsl(${hue},${sat}%,${lit}%)`;
}

// ── Module-level cache (survives re-renders) ───────────────────────────────────

let geoCached: { type: string; features: any[] } | null = null;
let dotsCached: AptMapData | null = null;

// ── Component ──────────────────────────────────────────────────────────────────

export function SeoulMapDots({
  minP,
  maxP,
  areaType,
}: {
  minP: number;   // 억 (최솟값)
  maxP: number;   // 억 (Infinity = 무제한)
  areaType: AreaType;
}) {
  const [geo, setGeo] = useState<typeof geoCached>(geoCached);
  const [mapData, setMapData] = useState<AptMapData | null>(dotsCached);

  useEffect(() => {
    let cancelled = false;

    const loadGeo = async () => {
      if (geoCached) { setGeo(geoCached); return; }
      const res = await fetch('/data/seoul-geo.json');
      if (cancelled) return;
      const d = await res.json();
      geoCached = d;
      setGeo(d);
    };

    const loadDots = async () => {
      if (dotsCached) { setMapData(dotsCached); return; }
      const res = await fetch('/data/apt-map.json');
      if (cancelled) return;
      const d = await res.json();
      dotsCached = d;
      setMapData(d);
    };

    loadGeo();
    loadDots();
    return () => { cancelled = true; };
  }, []);

  // Pre-compute district SVG paths (stable — only depends on geo)
  const districtPaths = useMemo(() => {
    if (!geo) return [];
    return geo.features.map((f: any) => featureToPath(f));
  }, [geo]);

  // Cutoff: 30 days before generation date (prevents showing stale dots as "recent")
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
      if (date < cutoff) return [];
      if (price < minMw) return [];
      if (price > maxMw) return [];
      return [{ x: lx(dot.lng), y: ly(dot.lat), price }];
    });

    // Normalize price to color ratio
    let effectiveMax: number;
    if (maxMw === Infinity) {
      effectiveMax = raw.reduce((m, d) => d.price > m ? d.price : m, minMw + 1);
    } else {
      effectiveMax = maxMw;
    }
    const range = effectiveMax - minMw || 1;

    return raw.map(d => ({
      x: d.x,
      y: d.y,
      ratio: (d.price - minMw) / range,
    }));
  }, [mapData, cutoff, atKey, minMw, maxMw]);

  // Group dots by color bucket for layered blur effect (blue → purple)
  const BUCKETS = 5;
  const buckets = useMemo(() => {
    const b: typeof visibleDots[] = Array.from({ length: BUCKETS }, () => []);
    for (const d of visibleDots) {
      b[Math.min(BUCKETS - 1, Math.floor(d.ratio * BUCKETS))].push(d);
    }
    return b;
  }, [visibleDots]);

  const hasDots = visibleDots.length > 0;

  return (
    <div style={{ width: '100%', marginBottom: 16 }}>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          background: '#c9dff0',   // 한강/바다 색
          borderRadius: 4,
          border: '1px solid #ddd',
        }}
        aria-hidden
      >
        <defs>
          {Array.from({ length: BUCKETS }, (_, i) => (
            <filter key={i} id={`df${i}`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          ))}
        </defs>

        {/* 구 경계 + 서울 바깥 경계 */}
        {districtPaths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="#f7f7f5"
            stroke="#c8c8c4"
            strokeWidth={0.8}
            strokeLinejoin="round"
          />
        ))}

        {/* 한강 */}
        <path d={HAN_PATH} fill="#c9dff0" stroke="#aac8e0" strokeWidth={0.5} />

        {/* 구 경계선 재적용 (한강 위에) */}
        {districtPaths.map((d, i) => (
          <path
            key={`s${i}`}
            d={d}
            fill="none"
            stroke="#c0c0bc"
            strokeWidth={0.8}
            strokeLinejoin="round"
          />
        ))}

        {/* 아파트 dot 레이어 — 컬러별 그룹으로 블러 */}
        {hasDots && buckets.map((group, bi) => {
          if (group.length === 0) return null;
          const midRatio = (bi + 0.5) / BUCKETS;
          const fill = dotColor(midRatio);
          return (
            <g key={bi} filter={`url(#df${bi})`} opacity={0.85}>
              {group.map((dot, di) => (
                <circle
                  key={di}
                  cx={dot.x.toFixed(1)}
                  cy={dot.y.toFixed(1)}
                  r={14}
                  fill={fill}
                />
              ))}
            </g>
          );
        })}

        {/* 로딩 중 — SVG 내부는 큰 폰트로 */}
        {!geo && (
          <text x={VW / 2} y={VH / 2} textAnchor="middle" fontSize={60} fill="#bbb">
            로딩 중…
          </text>
        )}
      </svg>

      {/* 범례 & 상태 메시지 — HTML로 분리하여 모바일에서도 읽기 가능 */}
      {hasDots && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginTop: 5, fontSize: 11, color: '#888',
        }}>
          <span>저가</span>
          <div style={{
            display: 'flex', height: 10, width: 80, borderRadius: 2, overflow: 'hidden', flexShrink: 0,
          }}>
            {Array.from({ length: 20 }, (_, i) => (
              <div
                key={i}
                style={{ flex: 1, background: dotColor(i / 19) }}
              />
            ))}
          </div>
          <span>고가</span>
          <span style={{ marginLeft: 4, color: '#bbb' }}>
            · 최근 30일 거래 {visibleDots.length}건
          </span>
        </div>
      )}
      {geo && !hasDots && mapData && (
        <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>
          해당 가격대에서 최근 30일간 거래된 아파트 없음
        </div>
      )}
    </div>
  );
}
