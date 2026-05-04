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
}

interface Trade {
  date: string;
  area: number;
  price: number;
  floor: string;
  aptNm: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const MIN_TS = new Date('2020-01-01').getTime();
const MAX_TS = Date.now();

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

// Y축: 정확한 억/천만 단위 tick 계산
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
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
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
  const [tooltip, setTooltip] = useState<{ x: number; y: number; price: number; ts: number; floor: string } | null>(null);

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

  const handleGuChange = (v: string) => { setGu(v); setDong(''); setApt(''); setArea(''); setTrades([]); };
  const handleDongChange = (v: string) => { setDong(v); setApt(''); setArea(''); setTrades([]); };
  const handleAptChange = (v: string) => { setApt(v); setArea(''); setTrades([]); };
  const handleRangeChange = useCallback((s: number, e: number) => { setStartTs(s); setEndTs(e); }, []);

  const chartData = useMemo(() =>
    trades
      .map(t => ({ ts: new Date(t.date).getTime(), price: t.price, floor: t.floor }))
      .filter(d => !isNaN(d.ts) && d.ts >= startTs && d.ts <= endTs)
      .sort((a, b) => a.ts - b.ts),
    [trades, startTs, endTs],
  );

  // 비정상 거래 탐지: 앞뒤 거래 대비 20% 이상 이격된 중간값
  const abnormalSet = useMemo(() => {
    const s = new Set<number>();
    for (let i = 1; i < chartData.length - 1; i++) {
      const prev = chartData[i - 1].price;
      const curr = chartData[i].price;
      const next = chartData[i + 1].price;
      if (Math.abs(curr - prev) / prev >= 0.2 && Math.abs(curr - next) / next >= 0.2) {
        s.add(i);
      }
    }
    return s;
  }, [chartData]);

  // Y축 tick: 정확한 억/천만 경계값
  const yTicks = useMemo(() => {
    if (!chartData.length) return [0, 100000];
    const prices = chartData.map(d => d.price);
    return getYTicks(Math.min(...prices), Math.max(...prices));
  }, [chartData]);

  // 점 위치 캐시 (같은 render 내에서 이전 점 좌표를 선 그리기에 활용)
  const dotPos = useRef<{ cx: number; cy: number }[]>([]);
  // 이벤트 핸들러에서 최신 chartData를 참조하기 위한 ref
  const chartDataRef = useRef(chartData);
  chartDataRef.current = chartData;

  // shape: 선(이전 점→현재 점) + 점을 한 번에 렌더
  const renderShape = useCallback((props: {
    cx: number; cy: number; index: number;
  }) => {
    const { cx, cy, index } = props;
    if (index === 0) dotPos.current = [];
    dotPos.current[index] = { cx, cy };

    const isAbnormal = abnormalSet.has(index);
    const prev = index > 0 ? dotPos.current[index - 1] : null;
    const isAbnormalSeg = !!prev && (abnormalSet.has(index - 1) || abnormalSet.has(index));

    return (
      <g>
        {prev && (
          <line
            x1={prev.cx} y1={prev.cy} x2={cx} y2={cy}
            stroke="#bbb" strokeWidth={1}
            strokeOpacity={isAbnormalSeg ? 0.18 : 0.85}
          />
        )}
        <circle cx={cx} cy={cy} r={5}
          fill="transparent"
          style={{ cursor: 'crosshair' }}
          onMouseEnter={(e) => {
            const d = chartDataRef.current[index];
            if (!d) return;
            setTooltip({ x: e.clientX, y: e.clientY, price: d.price, ts: d.ts, floor: d.floor });
          }}
          onMouseLeave={() => setTooltip(null)}
        />
        <circle cx={cx} cy={cy} r={1.8}
          fill={isAbnormal ? '#bbb' : '#111'}
          fillOpacity={isAbnormal ? 0.22 : 0.85}
          style={{ pointerEvents: 'none' }}
        />
      </g>
    );
  }, [abnormalSet, setTooltip]);

  const dongs = gu && filterData ? (filterData.동s[gu] ?? []) : [];
  const apts = gu && dong && filterData ? (filterData.아파트s[`${gu}|${dong}`] ?? []) : [];
  const showChart = !!area && trades.length > 0;
  const yDomain: [number, number] = [yTicks[0], yTicks[yTicks.length - 1]];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Dropdowns */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        <Select value={gu} onChange={handleGuChange} options={filterData?.구s ?? []} placeholder="구 선택" disabled={!filterData} />
        <Select value={dong} onChange={handleDongChange} options={dongs} placeholder="동 선택" disabled={!gu} />
        <Select value={apt} onChange={handleAptChange} options={apts} placeholder="아파트 선택" disabled={!dong} />
        <Select value={area} onChange={setArea} options={areas.map(String)} placeholder="면적(㎡)" disabled={!apt || areas.length === 0} />
      </div>

      {/* Chart */}
      {showChart && (
        <>
          <div style={{ width: '100%', aspectRatio: '2/1', maxWidth: 640, border: '1px solid #ddd' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 16, right: 16, bottom: 8, left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={[startTs, endTs]}
                  tickFormatter={ts => tsToLabel(Number(ts))}
                  tick={{ fontSize: 11, fill: '#555' }}
                  tickCount={6}
                  minTickGap={40}
                />
                <YAxis
                  dataKey="price"
                  type="number"
                  domain={yDomain}
                  ticks={yTicks}
                  tickFormatter={formatYTick}
                  tick={{ fontSize: 11, fill: '#555' }}
                  width={56}
                />
                <Scatter
                  data={chartData}
                  isAnimationActive={false}
                  shape={(props: any) => renderShape(props)}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Range Slider */}
          <div style={{ maxWidth: 640, paddingLeft: 80 }}>
            <RangeSlider startTs={startTs} endTs={endTs} onChange={handleRangeChange} />
          </div>

          {/* Trade count */}
          <div style={{ maxWidth: 640, textAlign: 'right', fontSize: 11, color: '#888', marginBottom: 24 }}>
            {chartData.length.toLocaleString()}건 표시 / 전체 {trades.length.toLocaleString()}건
          </div>

          {/* Table */}
          <div style={{ maxWidth: 640 }}>
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
          position: 'fixed',
          left: tooltip.x + 14,
          top: tooltip.y - 14,
          background: '#fff',
          border: '1px solid #333',
          padding: '6px 10px',
          fontSize: 12,
          lineHeight: 1.6,
          pointerEvents: 'none',
          zIndex: 1000,
          whiteSpace: 'nowrap',
        }}>
          <div>{new Date(tooltip.ts).toLocaleDateString('ko-KR')}</div>
          <div>{formatPrice(tooltip.price)}</div>
          <div>{tooltip.floor}층</div>
        </div>
      )}
    </div>
  );
}
