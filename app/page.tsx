'use client';

import { useState, useEffect, useCallback, useMemo, useTransition, memo } from 'react';
import {
  ScatterChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  useXAxisScale, useYAxisScale, usePlotArea,
} from 'recharts';

// ── Types ────────────────────────────────────────────────────────────────────

interface FilterData {
  구s: string[];
  동s: Record<string, string[]>;
  아파트s: Record<string, string[]>;
  coords: Record<string, { lat: number; lng: number }>;
}
interface Trade { date: string; area: number; price: number; floor: string; aptNm: string; }
interface ChartPoint { ts: number; price: number; floor: string; aptNm: string; }
interface OverlayLine { key: string; color: string; points: ChartPoint[]; }
interface OverlayApt {
  key: string; aptNm: string; gu: string; dong: string;
  area: number; trades: Trade[]; color: string;
}
interface TooltipState { x: number; y: number; price: number; ts: number; floor: string; aptNm: string; }
type ViewMode = 'single' | 'nearby' | 'neighborhood';

// ── Constants ────────────────────────────────────────────────────────────────

const MIN_TS = new Date('2020-01-01').getTime();
const MAX_TS = Date.now();
const OVERLAY_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed',
  '#0891b2', '#be185d', '#65a30d', '#c2410c', '#0f766e',
  '#9333ea', '#b45309', '#0284c7', '#15803d', '#b91c1c',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(만원: number): string {
  const 억 = Math.floor(만원 / 10000);
  const 나머지 = 만원 % 10000;
  if (억 === 0) return `${만원.toLocaleString()}만`;
  if (나머지 === 0) return `${억}억`;
  return `${억}억 ${나머지.toLocaleString()}만`;
}

function tsToLabel(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getYTicks(minP: number, maxP: number): number[] {
  const range = maxP - minP;
  let step: number;
  if (range === 0) step = 10000;
  else if (range < 2000) step = 500;
  else if (range < 5000) step = 1000;
  else if (range < 15000) step = 2000;
  else if (range < 50000) step = 5000;
  else if (range < 150000) step = 10000;
  else step = 50000;
  const first = Math.floor(minP / step) * step;
  const last = Math.ceil(maxP / step) * step;
  const ticks: number[] = [];
  for (let t = first; t <= last; t += step) ticks.push(t);
  return ticks;
}

function formatYTick(v: number): string {
  const n = Number(v);
  const 억 = Math.floor(n / 10000);
  const 나머지 = n % 10000;
  if (억 === 0) return 나머지 % 1000 === 0 ? `${나머지 / 1000}천만` : `${나머지}만`;
  if (나머지 === 0) return `${억}억`;
  if (나머지 % 1000 === 0) return `${억}억${나머지 / 1000}천만`;
  return `${억}억${나머지.toLocaleString()}만`;
}

function toChartPoints(trades: Trade[], s: number, e: number): ChartPoint[] {
  return trades
    .map(t => ({ ts: new Date(t.date).getTime(), price: t.price, floor: t.floor, aptNm: t.aptNm }))
    .filter(d => !isNaN(d.ts) && d.ts >= s && d.ts <= e)
    .sort((a, b) => a.ts - b.ts);
}

// ── ChartLines (rendered inside ScatterChart, uses recharts 3.x hooks) ────────

const ChartLines = memo(function ChartLines({
  mainPoints, overlayLines, abnormalSet, isOverlayMode, setTooltip,
}: {
  mainPoints: ChartPoint[];
  overlayLines: OverlayLine[];
  abnormalSet: Set<number>;
  isOverlayMode: boolean;
  setTooltip: (t: TooltipState | null) => void;
}) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  const plotArea = usePlotArea();

  // Build SVG path string from points array
  const buildPath = useCallback((pts: ChartPoint[]) => {
    if (!xScale || !yScale || pts.length === 0) return '';
    return pts.map((p, i) => {
      const x = (xScale(p.ts) ?? 0).toFixed(1);
      const y = (yScale(p.price) ?? 0).toFixed(1);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join('');
  }, [xScale, yScale]);

  // Main line: split normal segments from abnormal segments
  const { normalPath, abnUnderPath } = useMemo(() => {
    if (!mainPoints.length || !xScale || !yScale) return { normalPath: '', abnUnderPath: '' };
    if (isOverlayMode || !abnormalSet.size) return { normalPath: buildPath(mainPoints), abnUnderPath: '' };

    // abnUnderPath = full path drawn at low opacity (shows abnormal segments)
    const abnUnderPath = buildPath(mainPoints);
    // normalPath = only non-abnormal segments (M instead of L for abnormal gaps)
    let norm = '';
    for (let i = 0; i < mainPoints.length; i++) {
      const x = (xScale(mainPoints[i].ts) ?? 0).toFixed(1);
      const y = (yScale(mainPoints[i].price) ?? 0).toFixed(1);
      if (i === 0) { norm += `M${x},${y}`; continue; }
      const isAbnSeg = abnormalSet.has(i - 1) || abnormalSet.has(i);
      norm += isAbnSeg ? ` M${x},${y}` : `L${x},${y}`;
    }
    return { normalPath: norm, abnUnderPath };
  }, [mainPoints, abnormalSet, isOverlayMode, buildPath, xScale, yScale]);

  // Overlay paths (memoised per-line)
  const overlayPaths = useMemo(() =>
    overlayLines.map(o => ({ key: o.key, color: o.color, d: buildPath(o.points) })),
    [overlayLines, buildPath],
  );

  // Nearest-point hover on single rect (no per-point hit circles)
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    if (!xScale || !yScale) return;
    const svg = (e.currentTarget as Element).closest('svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let bestD = Infinity;
    let bestPt: ChartPoint | null = null;

    const scan = (pts: ChartPoint[]) => {
      for (const p of pts) {
        const dx = (xScale(p.ts) ?? 0) - mx;
        const dy = (yScale(p.price) ?? 0) - my;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; bestPt = p; }
      }
    };
    scan(mainPoints);
    for (const o of overlayLines) scan(o.points);

    if (bestPt && Math.sqrt(bestD) < 18) {
      const p = bestPt as ChartPoint;
      setTooltip({ x: e.clientX, y: e.clientY, price: p.price, ts: p.ts, floor: p.floor, aptNm: p.aptNm });
    } else {
      setTooltip(null);
    }
  }, [xScale, yScale, mainPoints, overlayLines, setTooltip]);

  if (!xScale || !yScale || !plotArea) return null;

  const mainLineColor = isOverlayMode ? '#111' : '#bbb';
  const mainLineW = isOverlayMode ? 2.5 : 1.5;
  const mainLineAlpha = isOverlayMode ? 1 : 0.85;
  const mainDotR = isOverlayMode ? 3 : 1.8;

  return (
    <g>
      {/* Overlay lines (behind main) */}
      {overlayPaths.map(({ key, color, d }) => d && (
        <path key={key} d={d} fill="none"
          stroke={color} strokeWidth={0.8} strokeOpacity={0.45}
          strokeLinecap="round" strokeLinejoin="round"
        />
      ))}

      {/* Main: abnormal underlay */}
      {abnUnderPath && (
        <path d={abnUnderPath} fill="none"
          stroke="#bbb" strokeWidth={mainLineW} strokeOpacity={0.15}
          strokeLinecap="round" strokeLinejoin="round"
        />
      )}

      {/* Main: normal path */}
      {normalPath && (
        <path d={normalPath} fill="none"
          stroke={mainLineColor} strokeWidth={mainLineW} strokeOpacity={mainLineAlpha}
          strokeLinecap="round" strokeLinejoin="round"
        />
      )}

      {/* Main: visible dots */}
      {mainPoints.map((p, i) => {
        const isAbn = !isOverlayMode && abnormalSet.has(i);
        return (
          <circle key={i}
            cx={xScale(p.ts) ?? 0} cy={yScale(p.price) ?? 0}
            r={mainDotR}
            fill={isAbn ? '#bbb' : '#111'}
            fillOpacity={isAbn ? 0.22 : (isOverlayMode ? 1 : 0.85)}
            style={{ pointerEvents: 'none' }}
          />
        );
      })}

      {/* Single hover rect — replaces all per-point hit circles */}
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

// ── Range Slider ─────────────────────────────────────────────────────────────

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
  const onMM = useCallback((e: MouseEvent) => {
    if (!dragging.current) return;
    const ts = ratioToTs(posToRatio(e.clientX));
    if (dragging.current === 'left') onChange(Math.min(ts, endTs - 86400000), endTs);
    else onChange(startTs, Math.max(ts, startTs + 86400000));
  }, [startTs, endTs, onChange, posToRatio]);
  const onMU = useCallback(() => { dragging.current = null; }, []);
  useEffect(() => {
    window.addEventListener('mousemove', onMM);
    window.addEventListener('mouseup', onMU);
    return () => { window.removeEventListener('mousemove', onMM); window.removeEventListener('mouseup', onMU); };
  }, [onMM, onMU]);
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
        <div onMouseDown={() => { dragging.current = 'left'; }} style={handleStyle(lp)} />
        <div onMouseDown={() => { dragging.current = 'right'; }} style={handleStyle(rp)} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888' }}>
        <span>{tsToLabel(startTs)}</span><span>{tsToLabel(endTs)}</span>
      </div>
    </div>
  );
}

// ── Dropdown ─────────────────────────────────────────────────────────────────

function Select({ value, onChange, options, placeholder, disabled }: {
  value: string; onChange: (v: string) => void;
  options: string[]; placeholder: string; disabled: boolean;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      style={{ flex: 1, height: 36, padding: '0 8px', border: '1px solid #333', background: disabled ? '#f5f5f5' : '#fff', color: disabled ? '#aaa' : '#111', fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer', appearance: 'auto' }}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ── Minimal Button ────────────────────────────────────────────────────────────

function MinBtn({ label, onClick, disabled, active }: {
  label: string; onClick: () => void; disabled?: boolean; active?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'block', width: '100%', padding: '7px 0', fontSize: 12,
      border: `1px solid ${active ? '#111' : '#ccc'}`,
      background: active ? '#111' : '#fff',
      color: active ? '#fff' : disabled ? '#bbb' : '#333',
      cursor: disabled ? 'not-allowed' : 'pointer',
      letterSpacing: '0.02em',
    }}>{label}</button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

// RangeSlider needs a non-null ref import
import { useRef } from 'react';

export default function Home() {
  const [filterData, setFilterData] = useState<FilterData | null>(null);
  const [gu, setGu] = useState('');
  const [dong, setDong] = useState('');
  const [apt, setApt] = useState('');
  const [area, setArea] = useState('');
  const [areas, setAreas] = useState<number[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);

  // Slider state: immediate (visual) vs deferred (chart data)
  const [sliderStart, setSliderStart] = useState(MIN_TS);
  const [sliderEnd, setSliderEnd] = useState(MAX_TS);
  const [startTs, setStartTs] = useState(MIN_TS);
  const [endTs, setEndTs] = useState(MAX_TS);
  const [, startTransition] = useTransition();

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Mode
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [overlayApts, setOverlayApts] = useState<OverlayApt[]>([]);
  const [loadingOverlay, setLoadingOverlay] = useState(false);

  // 우리동네
  const [dongAptList, setDongAptList] = useState<string[]>([]);
  const [checkedApts, setCheckedApts] = useState<Set<string>>(new Set());
  const [dongAptData, setDongAptData] = useState<Map<string, Trade[]>>(new Map());
  const [loadingDong, setLoadingDong] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/filter-data').then(r => r.json()).then(setFilterData);
  }, []);

  useEffect(() => {
    if (!gu || !dong || !apt) { setAreas([]); setArea(''); setTrades([]); return; }
    fetch(`/api/areas?gu=${encodeURIComponent(gu)}&dong=${encodeURIComponent(dong)}&apt=${encodeURIComponent(apt)}`)
      .then(r => r.json()).then((d: number[]) => { setAreas(d); setArea(''); setTrades([]); });
  }, [gu, dong, apt]);

  useEffect(() => {
    if (!gu || !dong || !apt || !area) { setTrades([]); return; }
    setLoading(true);
    fetch(`/api/trades?gu=${encodeURIComponent(gu)}&dong=${encodeURIComponent(dong)}&apt=${encodeURIComponent(apt)}&area=${area}`)
      .then(r => r.json())
      .then((d: Trade[]) => {
        setTrades(d);
        setSliderStart(MIN_TS); setSliderEnd(MAX_TS);
        setStartTs(MIN_TS); setEndTs(MAX_TS);
      })
      .finally(() => setLoading(false));
  }, [gu, dong, apt, area]);

  const resetMode = useCallback(() => {
    setViewMode('single');
    setOverlayApts([]);
    setDongAptList([]);
    setCheckedApts(new Set());
    setDongAptData(new Map());
  }, []);

  const handleGuChange = (v: string) => { setGu(v); setDong(''); setApt(''); setArea(''); setTrades([]); resetMode(); };
  const handleDongChange = (v: string) => { setDong(v); setApt(''); setArea(''); setTrades([]); resetMode(); };
  const handleAptChange = (v: string) => { setApt(v); setArea(''); setTrades([]); resetMode(); };

  // Slider: handle moves immediately, chart data updates deferred
  const handleRangeChange = useCallback((s: number, e: number) => {
    setSliderStart(s); setSliderEnd(e);
    startTransition(() => { setStartTs(s); setEndTs(e); });
  }, [startTransition]);

  const handleNearby = async () => {
    if (viewMode === 'nearby') { resetMode(); return; }
    resetMode();
    setViewMode('nearby');
    setLoadingOverlay(true);
    try {
      const res = await fetch(`/api/nearby-trades?gu=${encodeURIComponent(gu)}&dong=${encodeURIComponent(dong)}&apt=${encodeURIComponent(apt)}&area=${area}`);
      const data: { aptNm: string; gu: string; dong: string; area: number; trades: Trade[] }[] = await res.json();
      setOverlayApts(data.map((d, i) => ({
        key: `${d.aptNm}|${d.gu}|${d.dong}`,
        ...d, color: OVERLAY_COLORS[i % OVERLAY_COLORS.length],
      })));
    } finally { setLoadingOverlay(false); }
  };

  const handleNeighborhood = () => {
    if (viewMode === 'neighborhood') { resetMode(); return; }
    resetMode();
    setViewMode('neighborhood');
    if (!filterData || !gu || !dong) return;
    setDongAptList((filterData.아파트s[`${gu}|${dong}`] ?? []).filter(a => a !== apt));
  };

  const toggleDongApt = async (aptNm: string) => {
    const next = new Set(checkedApts);
    if (next.has(aptNm)) {
      next.delete(aptNm);
      setCheckedApts(next);
    } else {
      next.add(aptNm);
      setCheckedApts(next);
      if (!dongAptData.has(aptNm)) {
        setLoadingDong(prev => new Set(prev).add(aptNm));
        const areaNum = Number(area);
        try {
          const res = await fetch(`/api/dong-trades?gu=${encodeURIComponent(gu)}&dong=${encodeURIComponent(dong)}&apt=${encodeURIComponent(aptNm)}&minArea=${areaNum * 0.9}&maxArea=${areaNum * 1.1}`);
          const data: Trade[] = await res.json();
          setDongAptData(prev => new Map(prev).set(aptNm, data));
        } finally {
          setLoadingDong(prev => { const s = new Set(prev); s.delete(aptNm); return s; });
        }
      }
    }
  };

  // Chart data (deferred via startTs/endTs)
  const chartData = useMemo(() => toChartPoints(trades, startTs, endTs), [trades, startTs, endTs]);

  const abnormalSet = useMemo(() => {
    const s = new Set<number>();
    for (let i = 1; i < chartData.length - 1; i++) {
      const prev = chartData[i - 1].price, curr = chartData[i].price, next = chartData[i + 1].price;
      if (Math.abs(curr - prev) / prev >= 0.2 && Math.abs(curr - next) / next >= 0.2) s.add(i);
    }
    return s;
  }, [chartData]);

  const overlayLines = useMemo((): OverlayLine[] =>
    overlayApts.map(o => ({ key: o.key, color: o.color, points: toChartPoints(o.trades, startTs, endTs) })),
    [overlayApts, startTs, endTs],
  );

  const dongLines = useMemo((): OverlayLine[] => {
    let ci = 0;
    return Array.from(checkedApts).map(aptNm => ({
      key: aptNm,
      color: OVERLAY_COLORS[ci++ % OVERLAY_COLORS.length],
      points: toChartPoints(dongAptData.get(aptNm) ?? [], startTs, endTs),
    }));
  }, [checkedApts, dongAptData, startTs, endTs]);

  const allOverlayLines = viewMode === 'nearby' ? overlayLines : viewMode === 'neighborhood' ? dongLines : [];

  const yTicks = useMemo(() => {
    const prices = chartData.map(d => d.price);
    for (const o of allOverlayLines) for (const p of o.points) prices.push(p.price);
    if (!prices.length) return [0, 100000];
    return getYTicks(Math.min(...prices), Math.max(...prices));
  }, [chartData, allOverlayLines]);

  const dongs = gu && filterData ? (filterData.동s[gu] ?? []) : [];
  const apts = gu && dong && filterData ? (filterData.아파트s[`${gu}|${dong}`] ?? []) : [];
  const showChart = !!area && trades.length > 0;
  const isOverlayMode = viewMode !== 'single';
  const canUseButtons = showChart && !loading;
  const yDomain: [number, number] = [yTicks[0], yTicks[yTicks.length - 1]];

  // Legend data
  const legendNearby = viewMode === 'nearby' ? overlayLines : [];
  const legendDong = viewMode === 'neighborhood' ? dongLines : [];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Dropdowns */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        <Select value={gu} onChange={handleGuChange} options={filterData?.구s ?? []} placeholder="구 선택" disabled={!filterData} />
        <Select value={dong} onChange={handleDongChange} options={dongs} placeholder="동 선택" disabled={!gu} />
        <Select value={apt} onChange={handleAptChange} options={apts} placeholder="아파트 선택" disabled={!dong} />
        <Select value={area} onChange={v => { setArea(v); resetMode(); }} options={areas.map(String)} placeholder="면적(㎡)" disabled={!apt || areas.length === 0} />
      </div>

      {/* Chart + Buttons */}
      {showChart && (
        <>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', maxWidth: 720 }}>
            <div style={{ flex: 1, minWidth: 0 }}>

              {/* Chart */}
              <div style={{ width: '100%', aspectRatio: '2/1', border: '1px solid #ddd' }}>
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
                      tickFormatter={formatYTick}
                      tick={{ fontSize: 11, fill: '#555' }} width={56}
                    />
                    <ChartLines
                      mainPoints={chartData}
                      overlayLines={allOverlayLines}
                      abnormalSet={abnormalSet}
                      isOverlayMode={isOverlayMode}
                      setTooltip={setTooltip}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* Slider */}
              <div style={{ paddingLeft: 80 }}>
                <RangeSlider startTs={sliderStart} endTs={sliderEnd} onChange={handleRangeChange} />
              </div>

              {/* Trade count */}
              <div style={{ textAlign: 'right', fontSize: 11, color: '#888', marginBottom: 8 }}>
                {chartData.length.toLocaleString()}건 표시 / 전체 {trades.length.toLocaleString()}건
              </div>

              {/* Legend */}
              {(legendNearby.length > 0 || legendDong.length > 0) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 11, color: '#333', marginBottom: 12, paddingLeft: 4 }}>
                  <span><b style={{ color: '#111' }}>●</b> {apt} ({area}㎡)</span>
                  {[...legendNearby, ...legendDong].map(o => (
                    <span key={o.key}><b style={{ color: o.color }}>●</b> {o.points.length > 0 ? o.key.split('|')[0] : o.key}</span>
                  ))}
                </div>
              )}

              {/* 우리동네 checklist */}
              {viewMode === 'neighborhood' && dongAptList.length > 0 && (
                <div style={{ border: '1px solid #eee', padding: '10px 12px', marginBottom: 12, maxHeight: 200, overflowY: 'auto' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>{dong} 내 아파트 (체크하면 차트에 추가)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {dongAptList.map(aptNm => (
                      <label key={aptNm} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, cursor: 'pointer' }}>
                        <input type="checkbox" checked={checkedApts.has(aptNm)} onChange={() => toggleDongApt(aptNm)} disabled={loadingDong.has(aptNm)} />
                        <span style={{ color: loadingDong.has(aptNm) ? '#aaa' : '#222' }}>
                          {aptNm}{loadingDong.has(aptNm) ? ' …' : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4, width: 120, flexShrink: 0 }}>
              <MinBtn label={loadingOverlay ? '로딩중…' : '옆단지 함께보기'} onClick={handleNearby} disabled={!canUseButtons || loadingOverlay} active={viewMode === 'nearby'} />
              <MinBtn label="우리동네 함께보기" onClick={handleNeighborhood} disabled={!canUseButtons} active={viewMode === 'neighborhood'} />
              <MinBtn label="돌아가기" onClick={resetMode} disabled={viewMode === 'single'} />
            </div>
          </div>

          {/* Table */}
          <div style={{ maxWidth: 640, marginTop: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #111' }}>
                  {['계약일', '아파트명', '층', '실거래가'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades
                  .filter(t => { const ts = new Date(t.date).getTime(); return ts >= startTs && ts <= endTs; })
                  .map((t, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', color: '#555', fontSize: 12 }}>{t.date}</td>
                      <td style={{ padding: '6px 8px' }}>{t.aptNm}</td>
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{t.floor}층</td>
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatPrice(t.price)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {loading && <div style={{ color: '#888', fontSize: 13 }}>불러오는 중...</div>}

      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x + 14, top: tooltip.y - 14,
          background: '#fff', border: '1px solid #333', padding: '6px 10px',
          fontSize: 12, lineHeight: 1.6, pointerEvents: 'none', zIndex: 1000, whiteSpace: 'nowrap',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{tooltip.aptNm}</div>
          <div>{new Date(tooltip.ts).toLocaleDateString('ko-KR')}</div>
          <div>{formatPrice(tooltip.price)}</div>
          <div>{tooltip.floor}층</div>
        </div>
      )}
    </div>
  );
}
