'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, ResponsiveContainer,
} from 'recharts';

// ── Types ────────────────────────────────────────────────────────────────────

interface FilterData {
  구s: string[];
  동s: Record<string, string[]>;
  아파트s: Record<string, string[]>;
  coords: Record<string, { lat: number; lng: number }>;
}

interface Trade {
  date: string;
  area: number;
  price: number;
  floor: string;
  aptNm: string;
}

interface OverlayApt {
  key: string;
  aptNm: string;
  gu: string;
  dong: string;
  area: number;
  trades: Trade[];
  color: string;
}

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
  const num = Number(v);
  const 억 = Math.floor(num / 10000);
  const 나머지 = num % 10000;
  if (억 === 0) return 나머지 % 1000 === 0 ? `${나머지 / 1000}천만` : `${나머지}만`;
  if (나머지 === 0) return `${억}억`;
  if (나머지 % 1000 === 0) return `${억}억${나머지 / 1000}천만`;
  return `${억}억${나머지.toLocaleString()}만`;
}

function tradesToChartData(trades: Trade[], startTs: number, endTs: number) {
  return trades
    .map(t => ({ ts: new Date(t.date).getTime(), price: t.price, floor: t.floor, aptNm: t.aptNm }))
    .filter(d => !isNaN(d.ts) && d.ts >= startTs && d.ts <= endTs)
    .sort((a, b) => a.ts - b.ts);
}

// ── Range Slider ─────────────────────────────────────────────────────────────

function RangeSlider({ startTs, endTs, onChange }: {
  startTs: number; endTs: number;
  onChange: (start: number, end: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'left' | 'right' | null>(null);
  const tsToRatio = (ts: number) => (ts - MIN_TS) / (MAX_TS - MIN_TS);
  const ratioToTs = (r: number) => Math.round(MIN_TS + r * (MAX_TS - MIN_TS));
  const posToRatio = useCallback((clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);
  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return;
    const r = posToRatio(e.clientX);
    const ts = ratioToTs(r);
    if (dragging.current === 'left') onChange(Math.min(ts, endTs - 86400000), endTs);
    else onChange(startTs, Math.max(ts, startTs + 86400000));
  }, [startTs, endTs, onChange, posToRatio]);
  const onMouseUp = useCallback(() => { dragging.current = null; }, []);
  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [onMouseMove, onMouseUp]);
  const leftPct = tsToRatio(startTs) * 100;
  const rightPct = tsToRatio(endTs) * 100;
  return (
    <div style={{ padding: '8px 0 4px', userSelect: 'none' }}>
      <div ref={trackRef} style={{ position: 'relative', height: 4, background: '#ddd', margin: '12px 0' }}>
        <div style={{ position: 'absolute', top: 0, height: '100%', background: '#333', left: `${leftPct}%`, width: `${rightPct - leftPct}%` }} />
        <div onMouseDown={() => { dragging.current = 'left'; }} style={{ position: 'absolute', top: '50%', left: `${leftPct}%`, transform: 'translate(-50%,-50%)', width: 14, height: 14, background: '#111', cursor: 'ew-resize', border: '2px solid #fff', boxShadow: '0 0 0 1px #111' }} />
        <div onMouseDown={() => { dragging.current = 'right'; }} style={{ position: 'absolute', top: '50%', left: `${rightPct}%`, transform: 'translate(-50%,-50%)', width: 14, height: 14, background: '#111', cursor: 'ew-resize', border: '2px solid #fff', boxShadow: '0 0 0 1px #111' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888' }}>
        <span>{tsToLabel(startTs)}</span>
        <span>{tsToLabel(endTs)}</span>
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

export default function Home() {
  const [filterData, setFilterData] = useState<FilterData | null>(null);
  const [gu, setGu] = useState('');
  const [dong, setDong] = useState('');
  const [apt, setApt] = useState('');
  const [area, setArea] = useState('');
  const [areas, setAreas] = useState<number[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [startTs, setStartTs] = useState(MIN_TS);
  const [endTs, setEndTs] = useState(MAX_TS);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; price: number; ts: number; floor: string; aptNm: string } | null>(null);

  // 모드
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [overlayApts, setOverlayApts] = useState<OverlayApt[]>([]);
  const [loadingOverlay, setLoadingOverlay] = useState(false);

  // 우리동네 전용
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
      .then(r => r.json()).then((data: number[]) => { setAreas(data); setArea(''); setTrades([]); });
  }, [gu, dong, apt]);

  useEffect(() => {
    if (!gu || !dong || !apt || !area) { setTrades([]); return; }
    setLoading(true);
    fetch(`/api/trades?gu=${encodeURIComponent(gu)}&dong=${encodeURIComponent(dong)}&apt=${encodeURIComponent(apt)}&area=${area}`)
      .then(r => r.json())
      .then((data: Trade[]) => { setTrades(data); setStartTs(MIN_TS); setEndTs(MAX_TS); })
      .finally(() => setLoading(false));
  }, [gu, dong, apt, area]);

  const resetMode = () => {
    setViewMode('single');
    setOverlayApts([]);
    setDongAptList([]);
    setCheckedApts(new Set());
    setDongAptData(new Map());
  };

  const handleGuChange = (v: string) => { setGu(v); setDong(''); setApt(''); setArea(''); setTrades([]); resetMode(); };
  const handleDongChange = (v: string) => { setDong(v); setApt(''); setArea(''); setTrades([]); resetMode(); };
  const handleAptChange = (v: string) => { setApt(v); setArea(''); setTrades([]); resetMode(); };
  const handleRangeChange = useCallback((s: number, e: number) => { setStartTs(s); setEndTs(e); }, []);

  // 옆단지 함께보기
  const handleNearby = async () => {
    if (viewMode === 'nearby') { resetMode(); return; }
    resetMode();
    setViewMode('nearby');
    setLoadingOverlay(true);
    try {
      const res = await fetch(
        `/api/nearby-trades?gu=${encodeURIComponent(gu)}&dong=${encodeURIComponent(dong)}&apt=${encodeURIComponent(apt)}&area=${area}`
      );
      const data: { aptNm: string; gu: string; dong: string; area: number; trades: Trade[] }[] = await res.json();
      setOverlayApts(data.map((d, i) => ({
        key: `${d.aptNm}|${d.gu}|${d.dong}`,
        ...d,
        color: OVERLAY_COLORS[i % OVERLAY_COLORS.length],
      })));
    } finally {
      setLoadingOverlay(false);
    }
  };

  // 우리동네 함께보기
  const handleNeighborhood = () => {
    if (viewMode === 'neighborhood') { resetMode(); return; }
    resetMode();
    setViewMode('neighborhood');
    if (!filterData || !gu || !dong) return;
    const allApts = filterData.아파트s[`${gu}|${dong}`] ?? [];
    setDongAptList(allApts.filter(a => a !== apt));
  };

  // 체크박스 토글
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
        const minArea = areaNum * 0.9;
        const maxArea = areaNum * 1.1;
        try {
          const res = await fetch(
            `/api/dong-trades?gu=${encodeURIComponent(gu)}&dong=${encodeURIComponent(dong)}&apt=${encodeURIComponent(aptNm)}&minArea=${minArea}&maxArea=${maxArea}`
          );
          const data: Trade[] = await res.json();
          setDongAptData(prev => new Map(prev).set(aptNm, data));
        } finally {
          setLoadingDong(prev => { const s = new Set(prev); s.delete(aptNm); return s; });
        }
      }
    }
  };

  // 차트 데이터
  const chartData = useMemo(() =>
    tradesToChartData(trades, startTs, endTs),
    [trades, startTs, endTs],
  );

  // 비정상 거래 탐지
  const abnormalSet = useMemo(() => {
    const s = new Set<number>();
    for (let i = 1; i < chartData.length - 1; i++) {
      const prev = chartData[i - 1].price;
      const curr = chartData[i].price;
      const next = chartData[i + 1].price;
      if (Math.abs(curr - prev) / prev >= 0.2 && Math.abs(curr - next) / next >= 0.2) s.add(i);
    }
    return s;
  }, [chartData]);

  // Y축 범위: 메인 + 오버레이 전체 포함
  const yTicks = useMemo(() => {
    const allPrices = chartData.map(d => d.price);
    if (viewMode === 'nearby') {
      for (const o of overlayApts) {
        for (const t of tradesToChartData(o.trades, startTs, endTs)) allPrices.push(t.price);
      }
    } else if (viewMode === 'neighborhood') {
      for (const [nm, tlist] of dongAptData) {
        if (!checkedApts.has(nm)) continue;
        for (const t of tradesToChartData(tlist, startTs, endTs)) allPrices.push(t.price);
      }
    }
    if (!allPrices.length) return [0, 100000];
    return getYTicks(Math.min(...allPrices), Math.max(...allPrices));
  }, [chartData, overlayApts, dongAptData, checkedApts, viewMode, startTs, endTs]);

  // 점 위치 캐시 (키별)
  const dotPosMap = useRef<Map<string, { cx: number; cy: number }[]>>(new Map());
  const chartDataRef = useRef(chartData);
  chartDataRef.current = chartData;
  const overlayAptsRef = useRef(overlayApts);
  overlayAptsRef.current = overlayApts;
  const dongAptDataRef = useRef(dongAptData);
  dongAptDataRef.current = dongAptData;

  useEffect(() => { dotPosMap.current = new Map(); }, [chartData, overlayApts, dongAptData, checkedApts]);

  const makeRenderShape = useCallback((
    aptKey: string,
    color: string,
    isMain: boolean,
    abnSet: Set<number>,
    dataRef: React.MutableRefObject<{ ts: number; price: number; floor: string; aptNm: string }[]>,
    prominent = false,  // 오버레이 모드에서 메인 아파트 강조
  ) => {
    // 선 스타일
    const lineColor  = isMain ? (prominent ? '#111' : '#bbb') : color;
    const lineW      = isMain ? (prominent ? 2.5  : 1.5)  : 0.8;
    const lineAlpha  = isMain ? (prominent ? 1    : 0.85) : 0.45;
    // 점 스타일: 오버레이 모드 메인=완전 검은 원, 다른 아파트=선 굵기/색 그대로
    const dotR       = isMain ? (prominent ? 1.25 : 1.8)  : lineW / 2;
    const dotColor   = isMain ? '#111' : color;
    const dotAlpha   = isMain ? (prominent ? 1    : 0.85) : lineAlpha;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (props: any) => {
      const { cx, cy, index } = props as { cx: number; cy: number; index: number };
      const posMap = dotPosMap.current;
      if (index === 0) posMap.set(aptKey, []);
      const pos = posMap.get(aptKey) ?? [];
      pos[index] = { cx, cy };
      posMap.set(aptKey, pos);

      const prev = index > 0 ? pos[index - 1] : null;
      // 비정상 거래 표시는 싱글 모드 메인에서만
      const isAbnormal    = !prominent && isMain && abnSet.has(index);
      const isAbnormalSeg = !prominent && isMain && !!prev && (abnSet.has(index - 1) || abnSet.has(index));

      return (
        <g>
          {prev && (
            <line
              x1={prev.cx} y1={prev.cy} x2={cx} y2={cy}
              stroke={lineColor}
              strokeWidth={lineW}
              strokeOpacity={isAbnormalSeg ? 0.15 : lineAlpha}
            />
          )}
          <circle cx={cx} cy={cy} r={7} fill="transparent" style={{ cursor: 'crosshair' }}
            onMouseEnter={(e) => {
              const d = dataRef.current[index];
              if (!d) return;
              setTooltip({ x: e.clientX, y: e.clientY, price: d.price, ts: d.ts, floor: d.floor, aptNm: d.aptNm });
            }}
            onMouseLeave={() => setTooltip(null)}
          />
          <circle cx={cx} cy={cy} r={dotR}
            fill={isAbnormal ? '#bbb' : dotColor}
            fillOpacity={isAbnormal ? 0.22 : dotAlpha}
            style={{ pointerEvents: 'none' }}
          />
        </g>
      );
    };
  }, []);

  const dongs = gu && filterData ? (filterData.동s[gu] ?? []) : [];
  const apts = gu && dong && filterData ? (filterData.아파트s[`${gu}|${dong}`] ?? []) : [];
  const showChart = !!area && trades.length > 0;
  const yDomain: [number, number] = [yTicks[0], yTicks[yTicks.length - 1]];
  const canUseButtons = showChart && !loading;

  // 오버레이 데이터 → 차트용 (refs 별도 관리)
  const overlayChartData = useMemo(() =>
    overlayApts.map(o => ({
      ...o,
      chartPoints: tradesToChartData(o.trades, startTs, endTs),
    })),
    [overlayApts, startTs, endTs],
  );

  const dongCheckedData = useMemo(() => {
    const result: { aptNm: string; color: string; chartPoints: ReturnType<typeof tradesToChartData> }[] = [];
    let ci = 0;
    for (const aptNm of checkedApts) {
      const tlist = dongAptData.get(aptNm) ?? [];
      result.push({
        aptNm,
        color: OVERLAY_COLORS[ci % OVERLAY_COLORS.length],
        chartPoints: tradesToChartData(tlist, startTs, endTs),
      });
      ci++;
    }
    return result;
  }, [checkedApts, dongAptData, startTs, endTs]);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Dropdowns */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        <Select value={gu} onChange={handleGuChange} options={filterData?.구s ?? []} placeholder="구 선택" disabled={!filterData} />
        <Select value={dong} onChange={handleDongChange} options={dongs} placeholder="동 선택" disabled={!gu} />
        <Select value={apt} onChange={handleAptChange} options={apts} placeholder="아파트 선택" disabled={!dong} />
        <Select value={area} onChange={v => { setArea(v); resetMode(); }} options={areas.map(String)} placeholder="면적(㎡)" disabled={!apt || areas.length === 0} />
      </div>

      {/* Chart + Buttons layout */}
      {showChart && (
        <>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', maxWidth: 720 }}>
            {/* Chart */}
            <div style={{ flex: 1, minWidth: 0 }}>
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
                      tick={{ fontSize: 11, fill: '#555' }}
                      width={56}
                    />
                    {/* 메인 아파트 */}
                    <Scatter
                      data={chartData}
                      isAnimationActive={false}
                      shape={makeRenderShape('__main__', '#111', true, abnormalSet, chartDataRef, viewMode !== 'single')}
                    />
                    {/* 옆단지 오버레이 */}
                    {viewMode === 'nearby' && overlayChartData.map(o => {
                      const ref = { current: o.chartPoints };
                      return (
                        <Scatter key={o.key} data={o.chartPoints} isAnimationActive={false}
                          shape={makeRenderShape(o.key, o.color, false, new Set(), ref as React.MutableRefObject<typeof o.chartPoints>)}
                        />
                      );
                    })}
                    {/* 우리동네 오버레이 */}
                    {viewMode === 'neighborhood' && dongCheckedData.map(o => {
                      const ref = { current: o.chartPoints };
                      return (
                        <Scatter key={o.aptNm} data={o.chartPoints} isAnimationActive={false}
                          shape={makeRenderShape(o.aptNm, o.color, false, new Set(), ref as React.MutableRefObject<typeof o.chartPoints>)}
                        />
                      );
                    })}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* Range Slider */}
              <div style={{ paddingLeft: 80 }}>
                <RangeSlider startTs={startTs} endTs={endTs} onChange={handleRangeChange} />
              </div>

              {/* Trade count */}
              <div style={{ textAlign: 'right', fontSize: 11, color: '#888', marginBottom: 8 }}>
                {chartData.length.toLocaleString()}건 표시 / 전체 {trades.length.toLocaleString()}건
              </div>

              {/* 범례 */}
              {(viewMode === 'nearby' && overlayChartData.length > 0) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 11, color: '#333', marginBottom: 12, paddingLeft: 4 }}>
                  <span><b style={{ color: '#111' }}>●</b> {apt} ({area}㎡)</span>
                  {overlayChartData.map(o => (
                    <span key={o.key}><b style={{ color: o.color }}>●</b> {o.aptNm} ({o.area}㎡)</span>
                  ))}
                </div>
              )}
              {(viewMode === 'neighborhood' && dongCheckedData.length > 0) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 11, color: '#333', marginBottom: 12, paddingLeft: 4 }}>
                  <span><b style={{ color: '#111' }}>●</b> {apt} ({area}㎡)</span>
                  {dongCheckedData.map(o => (
                    <span key={o.aptNm}><b style={{ color: o.color }}>●</b> {o.aptNm}</span>
                  ))}
                </div>
              )}

              {/* 우리동네 체크리스트 */}
              {viewMode === 'neighborhood' && dongAptList.length > 0 && (
                <div style={{ border: '1px solid #eee', padding: '10px 12px', marginBottom: 12, maxHeight: 200, overflowY: 'auto' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>{dong} 내 아파트 (체크하면 차트에 추가)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {dongAptList.map(aptNm => (
                      <label key={aptNm} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={checkedApts.has(aptNm)}
                          onChange={() => toggleDongApt(aptNm)}
                          disabled={loadingDong.has(aptNm)}
                        />
                        <span style={{ color: loadingDong.has(aptNm) ? '#aaa' : '#222' }}>
                          {aptNm}
                          {loadingDong.has(aptNm) && ' …'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 버튼 패널 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4, width: 120, flexShrink: 0 }}>
              <MinBtn
                label={loadingOverlay ? '로딩중…' : '옆단지 함께보기'}
                onClick={handleNearby}
                disabled={!canUseButtons || loadingOverlay}
                active={viewMode === 'nearby'}
              />
              <MinBtn
                label="우리동네 함께보기"
                onClick={handleNeighborhood}
                disabled={!canUseButtons}
                active={viewMode === 'neighborhood'}
              />
              <MinBtn
                label="돌아가기"
                onClick={resetMode}
                disabled={viewMode === 'single'}
              />
            </div>
          </div>

          {/* Table (항상 메인 아파트만) */}
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
