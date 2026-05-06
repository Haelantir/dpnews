'use client';

import { useState, useEffect, useCallback, useMemo, useTransition, memo, useRef } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  useXAxisScale, useYAxisScale, usePlotArea,
} from 'recharts';

// ── Types ────────────────────────────────────────────────────────────────────

type AreaType = '59' | '84' | '100+';

interface FilterData { 구s: string[]; }
interface MonthPoint { ts: number; price: number; }
interface ChartApt { aptNm: string; dong: string; months: MonthPoint[]; }
interface TableApt { aptNm: string; dong: string; latestPrice: number; }
interface TopAptsData { chart: ChartApt[]; table: TableApt[]; }
interface TooltipState { x: number; y: number; price: number; ts: number; aptNm: string; dong: string; color: string; }

const AREA_LABELS: Record<AreaType, string> = { '59': '59㎡', '84': '84㎡', '100+': '100㎡ 이상' };

interface ChartLine {
  key: string; color: string;
  points: MonthPoint[];
  aptNm: string; dong: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MIN_TS = new Date('2020-01-01').getTime();
const MAX_TS = Date.now();

const LINE_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed',
  '#0891b2', '#be185d', '#65a30d', '#c2410c', '#0f766e',
];

const RANK_BG: Record<number, string> = {
  0: '#a7f3d0', // 1등 에메랄드
  1: '#fde68a', // 2등 금색
  2: '#e2e8f0', // 3등 은색
  3: '#fed7aa', // 4등 동색
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function tsToLabel(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getM2YTicks(minP: number, maxP: number): number[] {
  const range = maxP - minP;
  let step: number;
  if (range < 100) step = 20;
  else if (range < 300) step = 50;
  else if (range < 1000) step = 100;
  else if (range < 2000) step = 200;
  else if (range < 5000) step = 500;
  else step = 1000;
  const first = Math.floor(minP / step) * step;
  const last = Math.ceil(maxP / step) * step;
  const ticks: number[] = [];
  for (let t = first; t <= last; t += step) ticks.push(t);
  return ticks;
}

// ── TopAptChartLines ──────────────────────────────────────────────────────────

const TopAptChartLines = memo(function TopAptChartLines({
  lines, setTooltip,
}: {
  lines: ChartLine[];
  setTooltip: (t: TooltipState | null) => void;
}) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  const plotArea = usePlotArea();

  const buildPath = useCallback((pts: MonthPoint[]) => {
    if (!xScale || !yScale || pts.length === 0) return '';
    return pts.map((p, i) => {
      const x = (xScale(p.ts) ?? 0).toFixed(1);
      const y = (yScale(p.price) ?? 0).toFixed(1);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join('');
  }, [xScale, yScale]);

  const paths = useMemo(() =>
    lines.map(l => ({ key: l.key, color: l.color, d: buildPath(l.points) })),
    [lines, buildPath],
  );

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    if (!xScale || !yScale) return;
    const svg = (e.currentTarget as Element).closest('svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let bestD = Infinity;
    let bestPt: MonthPoint | null = null;
    let bestLine: ChartLine | null = null;
    for (const line of lines) {
      for (const p of line.points) {
        const dx = (xScale(p.ts) ?? 0) - mx;
        const dy = (yScale(p.price) ?? 0) - my;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; bestPt = p; bestLine = line; }
      }
    }
    if (bestPt && bestLine && Math.sqrt(bestD) < 22) {
      setTooltip({ x: e.clientX, y: e.clientY, price: bestPt.price, ts: bestPt.ts, aptNm: bestLine.aptNm, dong: bestLine.dong, color: bestLine.color });
    } else {
      setTooltip(null);
    }
  }, [xScale, yScale, lines, setTooltip]);

  if (!xScale || !yScale || !plotArea) return null;

  return (
    <g>
      {paths.map(({ key, color, d }) => d && (
        <path key={key} d={d} fill="none"
          stroke={color} strokeWidth={1.5} strokeOpacity={0.82}
          strokeLinecap="round" strokeLinejoin="round"
        />
      ))}
      <rect
        x={plotArea.x} y={plotArea.y}
        width={plotArea.width} height={plotArea.height}
        fill="transparent" style={{ cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />
    </g>
  );
});

// ── RangeSlider ───────────────────────────────────────────────────────────────

function RangeSlider({ startTs, endTs, onChange }: {
  startTs: number; endTs: number;
  onChange: (s: number, e: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'left' | 'right' | null>(null);
  const tsToRatio = (ts: number) => (ts - MIN_TS) / (MAX_TS - MIN_TS);
  const ratioToTs = (r: number) => Math.round(MIN_TS + r * (MAX_TS - MIN_TS));
  const posToRatio = useCallback((cx: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return 0;
    return Math.max(0, Math.min(1, (cx - r.left) / r.width));
  }, []);
  const move = useCallback((cx: number) => {
    if (!dragging.current) return;
    const ts = ratioToTs(posToRatio(cx));
    if (dragging.current === 'left') onChange(Math.min(ts, endTs - 86400000), endTs);
    else onChange(startTs, Math.max(ts, startTs + 86400000));
  }, [startTs, endTs, onChange, posToRatio]);
  const onMM = useCallback((e: MouseEvent) => move(e.clientX), [move]);
  const onTM = useCallback((e: TouchEvent) => { if (!dragging.current) return; e.preventDefault(); move(e.touches[0].clientX); }, [move]);
  const onMU = useCallback(() => { dragging.current = null; }, []);
  useEffect(() => {
    window.addEventListener('mousemove', onMM);
    window.addEventListener('mouseup', onMU);
    window.addEventListener('touchmove', onTM, { passive: false });
    window.addEventListener('touchend', onMU);
    return () => {
      window.removeEventListener('mousemove', onMM);
      window.removeEventListener('mouseup', onMU);
      window.removeEventListener('touchmove', onTM);
      window.removeEventListener('touchend', onMU);
    };
  }, [onMM, onTM, onMU]);
  const lp = tsToRatio(startTs) * 100;
  const rp = tsToRatio(endTs) * 100;
  const handleStyle = (left: number): React.CSSProperties => ({
    position: 'absolute', top: '50%', left: `${left}%`,
    transform: 'translate(-50%,-50%)', width: 14, height: 14,
    background: '#111', cursor: 'ew-resize',
    border: '2px solid #fff', boxShadow: '0 0 0 1px #111',
  });
  return (
    <div style={{ padding: '8px 0 4px', userSelect: 'none' }}>
      <div ref={trackRef} style={{ position: 'relative', height: 4, background: '#ddd', margin: '12px 0' }}>
        <div style={{ position: 'absolute', top: 0, height: '100%', background: '#333', left: `${lp}%`, width: `${rp - lp}%` }} />
        <div onMouseDown={() => { dragging.current = 'left'; }} onTouchStart={() => { dragging.current = 'left'; }} style={handleStyle(lp)} />
        <div onMouseDown={() => { dragging.current = 'right'; }} onTouchStart={() => { dragging.current = 'right'; }} style={handleStyle(rp)} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888' }}>
        <span>{tsToLabel(startTs)}</span><span>{tsToLabel(endTs)}</span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TopAptsPage() {
  const [filterData, setFilterData] = useState<FilterData | null>(null);
  const [selectedGu, setSelectedGu] = useState('');
  const [areaType, setAreaType] = useState<AreaType>('84');
  const [loading, setLoading] = useState(false);
  const [aptData, setAptData] = useState<TopAptsData | null>(null);
  const [sliderStart, setSliderStart] = useState(MIN_TS);
  const [sliderEnd, setSliderEnd] = useState(MAX_TS);
  const [startTs, setStartTs] = useState(MIN_TS);
  const [endTs, setEndTs] = useState(MAX_TS);
  const [, startTransition] = useTransition();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    fetch('/api/filter-data').then(r => r.json()).then(setFilterData);
  }, []);

  const fetchData = useCallback(async (gu: string, at: AreaType) => {
    setAptData(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/top-apts?gu=${encodeURIComponent(gu)}&areaType=${at}`);
      const data: TopAptsData = await res.json();
      setAptData(data);
      setSliderStart(MIN_TS); setSliderEnd(MAX_TS);
      setStartTs(MIN_TS); setEndTs(MAX_TS);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGuSelect = (gu: string) => {
    if (gu === selectedGu) return;
    setSelectedGu(gu);
    fetchData(gu, areaType);
  };

  const handleAreaType = (at: AreaType) => {
    if (at === areaType) return;
    setAreaType(at);
    if (selectedGu) fetchData(selectedGu, at);
  };

  const handleRangeChange = useCallback((s: number, e: number) => {
    setSliderStart(s); setSliderEnd(e);
    startTransition(() => { setStartTs(s); setEndTs(e); });
  }, [startTransition]);

  const chartLines = useMemo((): ChartLine[] =>
    (aptData?.chart ?? []).map((apt, i) => ({
      key: `${apt.aptNm}|${apt.dong}`,
      color: LINE_COLORS[i % LINE_COLORS.length],
      points: apt.months.filter(m => m.ts >= startTs && m.ts <= endTs),
      aptNm: apt.aptNm,
      dong: apt.dong,
    })),
    [aptData, startTs, endTs],
  );

  const yTicks = useMemo(() => {
    const prices: number[] = [];
    for (const l of chartLines) for (const p of l.points) prices.push(p.price);
    if (!prices.length) return [0, 1000];
    return getM2YTicks(Math.min(...prices), Math.max(...prices));
  }, [chartLines]);

  const yDomain: [number, number] = [yTicks[0], yTicks[yTicks.length - 1]];
  const dummyData = [{ ts: startTs, price: yDomain[0] }];

  const 구s = filterData?.구s ?? [];
  const showChart = !!aptData && aptData.chart.length > 0 && !loading;

  return (
    <div className="page-wrap">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: 0, marginBottom: 6 }}>지역별 대장아파트</h1>
        <p style={{ fontSize: 13, color: '#999', margin: 0 }}>이 지역의 평당 단가로 계산된 대장 순위입니다.</p>
      </div>

      <div className="gu-grid" style={{ marginBottom: 8 }}>
        {구s.map(gu => (
          <button
            key={gu}
            onClick={() => handleGuSelect(gu)}
            style={{
              height: 36, padding: '0 8px',
              border: `1px solid ${selectedGu === gu ? '#111' : '#333'}`,
              background: selectedGu === gu ? '#111' : '#fff',
              color: selectedGu === gu ? '#fff' : '#111',
              fontSize: 13, cursor: 'pointer', appearance: 'none',
              fontFamily: 'inherit', fontWeight: selectedGu === gu ? 700 : 400,
            }}
          >{gu}</button>
        ))}
      </div>

      {/* 면적 선택 버튼 — 구 그리드 왼쪽 3칸에 정렬 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 28 }}>
        {(['59', '84', '100+'] as AreaType[]).map(at => (
          <button
            key={at}
            onClick={() => handleAreaType(at)}
            style={{
              height: 36, padding: '0 8px',
              border: `1px solid ${areaType === at ? '#111' : '#aaa'}`,
              background: areaType === at ? '#111' : '#fff',
              color: areaType === at ? '#fff' : '#555',
              fontSize: 13, cursor: 'pointer', appearance: 'none',
              fontFamily: 'inherit', fontWeight: areaType === at ? 700 : 400,
            }}
          >{AREA_LABELS[at]}</button>
        ))}
        <div /><div />
      </div>

      {selectedGu && (
        loading ? (
          <div style={{ color: '#888', fontSize: 13 }}>불러오는 중...</div>
        ) : showChart ? (
          <>
            {/* Chart */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
                <b style={{ color: '#111' }}>{selectedGu}</b>
                <span style={{ marginLeft: 8, color: '#888' }}>상위 10개 아파트 · 월별 1㎡당 평균 단가 (만원/㎡)</span>
              </div>

              <div style={{ width: '100%', aspectRatio: '2/1', border: '1px solid #ddd', boxSizing: 'border-box' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 16, right: 16, bottom: 8, left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis
                      dataKey="ts" type="number"
                      domain={[startTs, endTs]}
                      tickFormatter={ts => tsToLabel(Number(ts))}
                      tick={{ fontSize: 11, fill: '#555' }}
                      tickCount={6} minTickGap={40}
                    />
                    <YAxis
                      dataKey="price" type="number"
                      domain={yDomain} ticks={yTicks}
                      tickFormatter={v => Number(v).toLocaleString()}
                      tick={{ fontSize: 11, fill: '#555' }} width={56}
                    />
                    <Scatter
                      data={dummyData}
                      isAnimationActive={false}
                      shape={() => null as unknown as React.ReactElement}
                      opacity={0}
                    />
                    <TopAptChartLines lines={chartLines} setTooltip={setTooltip} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              <div className="slider-wrap">
                <RangeSlider startTs={sliderStart} endTs={sliderEnd} onChange={handleRangeChange} />
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 11, color: '#333', marginTop: 8, paddingLeft: 4 }}>
                {(aptData?.chart ?? []).map((apt, i) => (
                  <span key={`${apt.aptNm}|${apt.dong}`}>
                    <b style={{ color: LINE_COLORS[i % LINE_COLORS.length] }}>●</b>{' '}
                    {apt.aptNm} ({apt.dong})
                  </span>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="wide-layout">
              <div className="wide-col">
                <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
                  {selectedGu} 전체 {aptData!.table.length.toLocaleString()}개 아파트 · 최신 거래 기준 ㎡당 단가 순위
                </div>
                <div style={{ overflowY: 'auto', maxHeight: 640 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                      <tr>
                        {['순위', '아파트명', '동', '㎡당 단가 (만원/㎡)'].map(h => (
                          <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap', borderBottom: '2px solid #111' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {aptData!.table.map((apt, i) => (
                        <tr key={`${apt.aptNm}|${apt.dong}`}
                          style={{
                            borderBottom: '1px solid #eee',
                            background: RANK_BG[i] ?? undefined,
                          }}>
                          <td style={{ padding: '6px 8px', color: '#888', fontSize: 12, width: 44 }}>{i + 1}</td>
                          <td style={{ padding: '6px 8px', fontWeight: i < 3 ? 700 : 400 }}>{apt.aptNm}</td>
                          <td style={{ padding: '6px 8px', color: '#555' }}>{apt.dong}</td>
                          <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                            {Math.round(apt.latestPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="hidden-mobile" />
            </div>
          </>
        ) : (
          <div style={{ color: '#aaa', fontSize: 13 }}>데이터가 없습니다.</div>
        )
      )}

      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x + 14, top: tooltip.y - 14,
          background: '#fff', border: '1px solid #333', padding: '6px 10px',
          fontSize: 12, lineHeight: 1.6, pointerEvents: 'none', zIndex: 1000, whiteSpace: 'nowrap',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 2, color: tooltip.color }}>
            {tooltip.aptNm} ({tooltip.dong})
          </div>
          <div>{tsToLabel(tooltip.ts)}</div>
          <div>{Math.round(tooltip.price)} 만원/㎡</div>
        </div>
      )}
    </div>
  );
}
