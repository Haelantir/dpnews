'use client';

import { useState, useEffect, useCallback, useMemo, useTransition, memo, useRef } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
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
interface NewHigh { aptNm: string; gu: string; dong: string; area: number; date: string; price: number; floor: string; }
interface ChartPoint { ts: number; price: number; floor: string; aptNm: string; }
interface OverlayLine { key: string; color: string; points: ChartPoint[]; label: string; }
interface OverlayApt {
  key: string; aptNm: string; gu: string; dong: string;
  area: number; trades: Trade[]; color: string;
}
interface TooltipState { x: number; y: number; price: number; ts: number; floor: string; aptNm: string; }
type ViewMode = 'single' | 'nearby' | 'neighborhood';
interface MapApt {
  key: string; aptNm: string; area: number;
  lat: number; lng: number; color: string;
  latestDate: string; latestPrice: number;
}
interface SelectedApt { aptNm: string; gu: string; dong: string; area: number; }

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

// ── ChartLines ────────────────────────────────────────────────────────────────

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

  const buildPath = useCallback((pts: ChartPoint[]) => {
    if (!xScale || !yScale || pts.length === 0) return '';
    return pts.map((p, i) => {
      const x = (xScale(p.ts) ?? 0).toFixed(1);
      const y = (yScale(p.price) ?? 0).toFixed(1);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join('');
  }, [xScale, yScale]);

  const { normalPath, abnUnderPath } = useMemo(() => {
    if (!mainPoints.length || !xScale || !yScale) return { normalPath: '', abnUnderPath: '' };
    if (isOverlayMode || !abnormalSet.size) return { normalPath: buildPath(mainPoints), abnUnderPath: '' };
    const abnUnderPath = buildPath(mainPoints);
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

  const overlayPaths = useMemo(() =>
    overlayLines.map(o => ({ key: o.key, color: o.color, d: buildPath(o.points) })),
    [overlayLines, buildPath],
  );

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
      {overlayPaths.map(({ key, color, d }) => d && (
        <path key={key} d={d} fill="none"
          stroke={color} strokeWidth={0.8} strokeOpacity={0.45}
          strokeLinecap="round" strokeLinejoin="round"
        />
      ))}
      {abnUnderPath && (
        <path d={abnUnderPath} fill="none"
          stroke="#bbb" strokeWidth={mainLineW} strokeOpacity={0.15}
          strokeLinecap="round" strokeLinejoin="round"
        />
      )}
      {normalPath && (
        <path d={normalPath} fill="none"
          stroke={mainLineColor} strokeWidth={mainLineW} strokeOpacity={mainLineAlpha}
          strokeLinecap="round" strokeLinejoin="round"
        />
      )}
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

// ── MinBtn ────────────────────────────────────────────────────────────────────

function MinBtn({ label, onClick, disabled, active }: {
  label: string; onClick: () => void; disabled?: boolean; active?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'block', width: '100%', height: 36, padding: 0, fontSize: 13, fontWeight: 700,
      border: `1px solid ${active ? '#111' : '#ccc'}`,
      background: active ? '#111' : '#fff',
      color: active ? '#fff' : disabled ? '#bbb' : '#333',
      cursor: disabled ? 'not-allowed' : 'pointer',
      letterSpacing: '0.02em',
    }}>{label}</button>
  );
}

// ── ApartmentMap helpers ──────────────────────────────────────────────────────

const ST_R = 6;
const ST_PAD = 2;

function buildStationMarkerEl(colors: string[], name: string): HTMLElement {
  const size = (ST_R + ST_PAD) * 2;
  const c = ST_R + ST_PAD;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  if (colors.length === 1) {
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', String(c)); circle.setAttribute('cy', String(c));
    circle.setAttribute('r', String(ST_R)); circle.setAttribute('fill', colors[0]);
    circle.setAttribute('stroke', '#fff'); circle.setAttribute('stroke-width', '1.5');
    svg.appendChild(circle);
  } else {
    const n = colors.length;
    for (let i = 0; i < n; i++) {
      const a0 = ((i / n) * 360 - 90) * (Math.PI / 180);
      const a1 = (((i + 1) / n) * 360 - 90) * (Math.PI / 180);
      const x0 = (c + ST_R * Math.cos(a0)).toFixed(3);
      const y0 = (c + ST_R * Math.sin(a0)).toFixed(3);
      const x1 = (c + ST_R * Math.cos(a1)).toFixed(3);
      const y1 = (c + ST_R * Math.sin(a1)).toFixed(3);
      const large = 1 / n > 0.5 ? 1 : 0;
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', `M${c},${c} L${x0},${y0} A${ST_R},${ST_R} 0 ${large},1 ${x1},${y1} Z`);
      path.setAttribute('fill', colors[i]); path.setAttribute('stroke', '#fff');
      path.setAttribute('stroke-width', '0.5');
      svg.appendChild(path);
    }
    const ring = document.createElementNS(ns, 'circle');
    ring.setAttribute('cx', String(c)); ring.setAttribute('cy', String(c));
    ring.setAttribute('r', String(ST_R)); ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', '#fff'); ring.setAttribute('stroke-width', '1.5');
    svg.appendChild(ring);
  }
  const label = document.createElement('div');
  label.className = 'st-label';
  label.textContent = name;
  label.style.cssText =
    'font-size:9px;font-family:system-ui,-apple-system,sans-serif;color:#1a1a2e;' +
    'white-space:nowrap;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 2px #fff;' +
    'line-height:1.2;text-align:center;margin-top:1px;';
  const outer = document.createElement('div');
  outer.style.cssText = 'pointer-events:none;display:flex;flex-direction:column;align-items:center;';
  outer.appendChild(svg);
  outer.appendChild(label);
  return outer;
}

// ── ApartmentMap ──────────────────────────────────────────────────────────────

const ApartmentMap = memo(function ApartmentMap({ apts }: { apts: MapApt[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const stationElsRef = useRef<HTMLElement[]>([]);
  const stationLblsRef = useRef<HTMLElement[]>([]);
  const aptsRef = useRef<MapApt[]>(apts);
  aptsRef.current = apts;

  const placeMarkers = useCallback((mapInst: any, data: MapApt[]) => {
    import('maplibre-gl').then(mgl => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (!data.length) return;
      const bounds = new mgl.LngLatBounds();
      for (const apt of data) {
        const outer = document.createElement('div');
        outer.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:none;';
        const box = document.createElement('div');
        const isMain = apt.color === '#111';
        box.style.cssText =
          `background:#fff;border:${isMain ? '2px' : '1.5px'} solid ${apt.color};` +
          'border-radius:2px;padding:3px 7px;white-space:nowrap;' +
          'font-family:system-ui,-apple-system,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.15);';
        const nm = document.createElement('div');
        nm.style.cssText = `font-size:11px;font-weight:700;color:${isMain ? '#111' : apt.color};line-height:1.45;`;
        nm.textContent = `${apt.aptNm} ${apt.area}㎡`;
        const pr = document.createElement('div');
        pr.style.cssText = 'font-size:10px;color:#555;line-height:1.45;';
        const [, mm, dd] = apt.latestDate.split('-');
        pr.textContent = `${Number(mm)}/${Number(dd)} ${formatPrice(apt.latestPrice)}`;
        const tip = document.createElement('div');
        tip.style.cssText =
          'width:0;height:0;border-left:5px solid transparent;' +
          `border-right:5px solid transparent;border-top:6px solid ${apt.color};`;
        box.append(nm, pr);
        outer.append(box, tip);
        markersRef.current.push(
          new mgl.Marker({ element: outer, anchor: 'bottom' })
            .setLngLat([apt.lng, apt.lat])
            .addTo(mapInst),
        );
        bounds.extend([apt.lng, apt.lat]);
      }
      if (data.length === 1) {
        mapInst.flyTo({ center: [data[0].lng, data[0].lat], zoom: 15, duration: 700 });
      } else {
        mapInst.fitBounds(bounds, { padding: 70, maxZoom: 16, duration: 700 });
      }
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let mapInst: any = null;
    (async () => {
      const mgl = await import('maplibre-gl');
      if (cancelled || !containerRef.current) return;
      mapInst = new mgl.Map({
        container: containerRef.current,
        style: 'https://tiles.openfreemap.org/styles/positron',
        center: [126.978, 37.566],
        zoom: 11,
        attributionControl: false,
        maxZoom: 18,
      });
      mapInst.addControl(new mgl.AttributionControl({ compact: true }), 'bottom-right');
      mapInst.once('load', () => {
        if (cancelled) return;
        for (const id of ['highway-name-path', 'highway-name-minor', 'highway-name-major']) {
          if (mapInst.getLayer(id)) mapInst.setLayoutProperty(id, 'text-field', ['get', 'name']);
        }
        for (const layer of (mapInst.getStyle().layers as any[])) {
          if (layer['source-layer'] === 'place') {
            try { mapInst.setLayoutProperty(layer.id, 'text-field', ['get', 'name']); } catch (_) {}
          }
        }
        for (const id of ['railway_transit', 'railway_transit_dashline']) {
          if (mapInst.getLayer(id)) {
            try { mapInst.setLayoutProperty(id, 'visibility', 'none'); } catch (_) {}
          }
        }
        try {
          mapInst.addLayer({
            id: 'custom-school-label', type: 'symbol', source: 'openmaptiles',
            'source-layer': 'poi',
            filter: ['match', ['get', 'class'], ['school', 'college', 'university', 'kindergarten'], true, false],
            layout: {
              'text-field': ['coalesce', ['get', 'name:ko'], ['get', 'name']],
              'text-font': ['Noto Sans Regular'], 'text-size': 10,
              'text-anchor': 'center', 'text-max-width': 6,
            },
            paint: { 'text-color': '#059669', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
            minzoom: 13,
          });
        } catch (_) {}
        mapRef.current = mapInst;
        const updateStVis = (zoom: number) => {
          const show = zoom >= 10;
          const showLbl = zoom >= 12;
          for (const el of stationElsRef.current) el.style.display = show ? '' : 'none';
          for (const lbl of stationLblsRef.current) lbl.style.display = showLbl ? '' : 'none';
        };
        fetch('/api/stations')
          .then(r => r.json())
          .then((stations: { name: string; lat: number; lng: number; colors: string[] }[]) => {
            if (cancelled) return;
            import('maplibre-gl').then(mgl2 => {
              for (const s of stations) {
                const el = buildStationMarkerEl(s.colors, s.name);
                const lbl = el.querySelector('.st-label') as HTMLElement | null;
                if (lbl) stationLblsRef.current.push(lbl);
                new mgl2.Marker({ element: el, anchor: 'top', offset: [0, -(ST_R + ST_PAD)] })
                  .setLngLat([s.lng, s.lat])
                  .addTo(mapInst);
                stationElsRef.current.push(el);
              }
              updateStVis(mapInst.getZoom());
            });
          })
          .catch(() => {});
        mapInst.on('zoom', () => updateStVis(mapInst.getZoom()));
        placeMarkers(mapInst, aptsRef.current);
      });
    })();
    return () => {
      cancelled = true;
      mapRef.current = null;
      markersRef.current = [];
      stationElsRef.current = [];
      stationLblsRef.current = [];
      mapInst?.remove();
    };
  }, [placeMarkers]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (m.loaded()) placeMarkers(m, apts);
    else m.once('load', () => placeMarkers(m, aptsRef.current));
  }, [apts, placeMarkers]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
});

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NewHighsPage() {
  const [filterData, setFilterData] = useState<FilterData | null>(null);
  const [selectedGu, setSelectedGu] = useState('');
  const [newHighs, setNewHighs] = useState<NewHigh[]>([]);
  const [loadingNewHighs, setLoadingNewHighs] = useState(false);

  const [selectedApt, setSelectedApt] = useState<SelectedApt | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);

  const [sliderStart, setSliderStart] = useState(MIN_TS);
  const [sliderEnd, setSliderEnd] = useState(MAX_TS);
  const [startTs, setStartTs] = useState(MIN_TS);
  const [endTs, setEndTs] = useState(MAX_TS);
  const [, startTransition] = useTransition();

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [overlayApts, setOverlayApts] = useState<OverlayApt[]>([]);
  const [loadingOverlay, setLoadingOverlay] = useState(false);

  const [dongAptList, setDongAptList] = useState<string[]>([]);
  const [checkedApts, setCheckedApts] = useState<Set<string>>(new Set());
  const [dongAptData, setDongAptData] = useState<Map<string, Trade[]>>(new Map());
  const [loadingDong, setLoadingDong] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/filter-data').then(r => r.json()).then(setFilterData);
  }, []);

  const handleGuSelect = async (gu: string) => {
    if (gu === selectedGu) return;
    setSelectedGu(gu);
    setNewHighs([]);
    setSelectedApt(null);
    setTrades([]);
    setViewMode('single');
    setOverlayApts([]);
    setDongAptList([]);
    setCheckedApts(new Set());
    setDongAptData(new Map());
    setLoadingNewHighs(true);
    try {
      const res = await fetch(`/api/new-highs?gu=${encodeURIComponent(gu)}`);
      setNewHighs(await res.json());
    } finally {
      setLoadingNewHighs(false);
    }
  };

  const handleAptSelect = async (nh: NewHigh) => {
    const isSame = selectedApt?.aptNm === nh.aptNm && selectedApt?.gu === nh.gu &&
      selectedApt?.dong === nh.dong && selectedApt?.area === nh.area;
    if (isSame) return;
    setSelectedApt({ aptNm: nh.aptNm, gu: nh.gu, dong: nh.dong, area: nh.area });
    setViewMode('single');
    setOverlayApts([]);
    setDongAptList([]);
    setCheckedApts(new Set());
    setDongAptData(new Map());
    setLoading(true);
    try {
      const res = await fetch(
        `/api/trades?gu=${encodeURIComponent(nh.gu)}&dong=${encodeURIComponent(nh.dong)}&apt=${encodeURIComponent(nh.aptNm)}&area=${nh.area}`
      );
      const data: Trade[] = await res.json();
      setTrades(data);
      setSliderStart(MIN_TS); setSliderEnd(MAX_TS);
      setStartTs(MIN_TS); setEndTs(MAX_TS);
    } finally {
      setLoading(false);
    }
  };

  const resetMode = useCallback(() => {
    setViewMode('single');
    setOverlayApts([]);
    setDongAptList([]);
    setCheckedApts(new Set());
    setDongAptData(new Map());
  }, []);

  const handleRangeChange = useCallback((s: number, e: number) => {
    setSliderStart(s); setSliderEnd(e);
    startTransition(() => { setStartTs(s); setEndTs(e); });
  }, [startTransition]);

  const handleNearby = async () => {
    if (!selectedApt) return;
    if (viewMode === 'nearby') { resetMode(); return; }
    resetMode();
    setViewMode('nearby');
    setLoadingOverlay(true);
    try {
      const { aptNm, gu, dong, area } = selectedApt;
      const res = await fetch(`/api/nearby-trades?gu=${encodeURIComponent(gu)}&dong=${encodeURIComponent(dong)}&apt=${encodeURIComponent(aptNm)}&area=${area}`);
      const data: { aptNm: string; gu: string; dong: string; area: number; trades: Trade[] }[] = await res.json();
      setOverlayApts(data.map((d, i) => ({
        key: `${d.aptNm}|${d.gu}|${d.dong}`,
        ...d, color: OVERLAY_COLORS[i % OVERLAY_COLORS.length],
      })));
    } finally { setLoadingOverlay(false); }
  };

  const handleNeighborhood = () => {
    if (!selectedApt) return;
    if (viewMode === 'neighborhood') { resetMode(); return; }
    resetMode();
    setViewMode('neighborhood');
    if (!filterData) return;
    const { gu, dong, aptNm } = selectedApt;
    setDongAptList((filterData.아파트s[`${gu}|${dong}`] ?? []).filter(a => a !== aptNm));
  };

  const toggleDongApt = async (aptNm: string) => {
    if (!selectedApt) return;
    const next = new Set(checkedApts);
    if (next.has(aptNm)) {
      next.delete(aptNm);
      setCheckedApts(next);
    } else {
      next.add(aptNm);
      setCheckedApts(next);
      if (!dongAptData.has(aptNm)) {
        setLoadingDong(prev => new Set(prev).add(aptNm));
        const areaNum = selectedApt.area;
        try {
          const res = await fetch(`/api/dong-trades?gu=${encodeURIComponent(selectedApt.gu)}&dong=${encodeURIComponent(selectedApt.dong)}&apt=${encodeURIComponent(aptNm)}&minArea=${areaNum * 0.9}&maxArea=${areaNum * 1.1}`);
          const data: Trade[] = await res.json();
          setDongAptData(prev => new Map(prev).set(aptNm, data));
        } finally {
          setLoadingDong(prev => { const s = new Set(prev); s.delete(aptNm); return s; });
        }
      }
    }
  };

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
    overlayApts.map(o => ({
      key: o.key, color: o.color,
      points: toChartPoints(o.trades, startTs, endTs),
      label: `${o.aptNm} (${o.area}㎡)`,
    })),
    [overlayApts, startTs, endTs],
  );

  const dongLines = useMemo((): OverlayLine[] => {
    let ci = 0;
    return Array.from(checkedApts).map(aptNm => {
      const t = dongAptData.get(aptNm) ?? [];
      const firstArea = t[0]?.area;
      return {
        key: aptNm,
        color: OVERLAY_COLORS[ci++ % OVERLAY_COLORS.length],
        points: toChartPoints(t, startTs, endTs),
        label: firstArea ? `${aptNm} (${firstArea}㎡)` : aptNm,
      };
    });
  }, [checkedApts, dongAptData, startTs, endTs]);

  const allOverlayLines = viewMode === 'nearby' ? overlayLines : viewMode === 'neighborhood' ? dongLines : [];

  const yTicks = useMemo(() => {
    const prices = chartData.map(d => d.price);
    for (const o of allOverlayLines) for (const p of o.points) prices.push(p.price);
    if (!prices.length) return [0, 100000];
    return getYTicks(Math.min(...prices), Math.max(...prices));
  }, [chartData, allOverlayLines]);

  const showChart = !!selectedApt && trades.length > 0 && !loading;
  const isOverlayMode = viewMode !== 'single';
  const canUseButtons = showChart;
  const yDomain: [number, number] = [yTicks[0], yTicks[yTicks.length - 1]];

  const mapApts = useMemo((): MapApt[] => {
    if (!selectedApt || !filterData || !showChart) return [];
    const result: MapApt[] = [];
    const mainCoord = filterData.coords[`${selectedApt.aptNm}|${selectedApt.gu}|${selectedApt.dong}`];
    if (mainCoord && trades.length > 0) {
      result.push({
        key: `${selectedApt.aptNm}|${selectedApt.gu}|${selectedApt.dong}`,
        aptNm: selectedApt.aptNm, area: selectedApt.area,
        lat: mainCoord.lat, lng: mainCoord.lng, color: '#111',
        latestDate: trades[0].date, latestPrice: trades[0].price,
      });
    }
    if (viewMode === 'nearby') {
      for (const o of overlayApts) {
        const coord = filterData.coords[o.key];
        if (!coord || !o.trades.length) continue;
        result.push({
          key: o.key, aptNm: o.aptNm, area: o.area,
          lat: coord.lat, lng: coord.lng, color: o.color,
          latestDate: o.trades[0].date, latestPrice: o.trades[0].price,
        });
      }
    } else if (viewMode === 'neighborhood') {
      let ci = 0;
      for (const aptNm of checkedApts) {
        const t = dongAptData.get(aptNm);
        if (!t?.length) continue;
        const coord = filterData.coords[`${aptNm}|${selectedApt.gu}|${selectedApt.dong}`];
        if (!coord) continue;
        result.push({
          key: aptNm, aptNm, area: t[0].area,
          lat: coord.lat, lng: coord.lng,
          color: OVERLAY_COLORS[ci++ % OVERLAY_COLORS.length],
          latestDate: t[0].date, latestPrice: t[0].price,
        });
      }
    }
    return result;
  }, [selectedApt, filterData, showChart, trades, viewMode, overlayApts, checkedApts, dongAptData]);

  const legendNearby = viewMode === 'nearby' ? overlayLines : [];
  const legendDong = viewMode === 'neighborhood' ? dongLines : [];
  const 구s = filterData?.구s ?? [];

  return (
    <div className="page-wrap">

      {/* Title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: 0, marginBottom: 6 }}>우리동네 신고가</h1>
        <p style={{ fontSize: 13, color: '#999', margin: 0 }}>구를 선택하면 최근 거래가 신고가인 아파트 목록을 보여줍니다. 아파트명을 클릭하면 차트가 표시됩니다.</p>
      </div>

      {/* 구 버튼 그리드 */}
      <div className="gu-grid">
        {구s.map(gu => (
          <button
            key={gu}
            onClick={() => handleGuSelect(gu)}
            style={{
              height: 36, padding: '0 8px', border: `1px solid ${selectedGu === gu ? '#111' : '#333'}`,
              background: selectedGu === gu ? '#111' : '#fff',
              color: selectedGu === gu ? '#fff' : '#111',
              fontSize: 13, cursor: 'pointer', appearance: 'none',
              fontFamily: 'inherit', fontWeight: selectedGu === gu ? 700 : 400,
            }}
          >
            {gu}
          </button>
        ))}
      </div>

      {/* 차트 + 버튼 */}
      {selectedApt && (
        <>
          <div className="chart-layout">
            <div className="chart-col">

              {/* 선택된 아파트 정보 */}
              <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
                <b style={{ color: '#111' }}>{selectedApt.aptNm}</b>
                <span style={{ marginLeft: 8, color: '#888' }}>{selectedApt.dong} · {selectedApt.area}㎡</span>
              </div>

              {/* Chart */}
              {loading ? (
                <div style={{ width: '100%', aspectRatio: '2/1', border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 13 }}>
                  불러오는 중...
                </div>
              ) : showChart ? (
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
                        tickFormatter={formatYTick}
                        tick={{ fontSize: 11, fill: '#555' }} width={56}
                      />
                      <Scatter
                        data={chartData.length > 0 ? chartData : [{ ts: startTs, price: yDomain[0] }]}
                        isAnimationActive={false}
                        shape={() => null as unknown as React.ReactElement}
                        opacity={0}
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
              ) : null}

              {showChart && (
                <>
                  {/* Slider */}
                  <div className="slider-wrap">
                    <RangeSlider startTs={sliderStart} endTs={sliderEnd} onChange={handleRangeChange} />
                  </div>

                  {/* Trade count */}
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#888', marginBottom: 8 }}>
                    {chartData.length.toLocaleString()}건 표시 / 전체 {trades.length.toLocaleString()}건
                  </div>

                  {/* Legend */}
                  {(legendNearby.length > 0 || legendDong.length > 0) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 11, color: '#333', marginBottom: 12, paddingLeft: 4 }}>
                      <span><b style={{ color: '#111' }}>●</b> {selectedApt.aptNm} ({selectedApt.area}㎡)</span>
                      {[...legendNearby, ...legendDong].map(o => (
                        <span key={o.key}><b style={{ color: o.color }}>●</b> {o.label}</span>
                      ))}
                    </div>
                  )}

                  {/* 우리동네 checklist */}
                  {viewMode === 'neighborhood' && dongAptList.length > 0 && (
                    <div style={{ border: '1px solid #eee', padding: '10px 12px', marginBottom: 12, maxHeight: 200, overflowY: 'auto' }}>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>{selectedApt.dong} 내 아파트 (체크하면 차트에 추가)</div>
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
                </>
              )}
            </div>

            {/* Buttons */}
            <div className="btn-col">
              <MinBtn label={loadingOverlay ? '로딩중…' : '옆단지 함께보기'} onClick={handleNearby} disabled={!canUseButtons || loadingOverlay} active={viewMode === 'nearby'} />
              <MinBtn label="우리동네 함께보기" onClick={handleNeighborhood} disabled={!canUseButtons} active={viewMode === 'neighborhood'} />
              <MinBtn label="돌아가기" onClick={resetMode} disabled={viewMode === 'single'} />
            </div>
          </div>

          {/* Map */}
          {showChart && (
            <div className="wide-layout" style={{ marginTop: 16 }}>
              <div className="wide-col">
                <div style={{ width: '100%', aspectRatio: '1/1', border: '1px solid #ddd', boxSizing: 'border-box' }}>
                  <ApartmentMap apts={mapApts} />
                </div>
              </div>
              <div className="hidden-mobile" />
            </div>
          )}
        </>
      )}

      {/* 신고가 표 */}
      {selectedGu && (
        <div style={{ marginTop: selectedApt ? 24 : 0 }}>
          {loadingNewHighs ? (
            <div style={{ color: '#888', fontSize: 13 }}>불러오는 중...</div>
          ) : newHighs.length === 0 && !loadingNewHighs ? (
            <div style={{ color: '#aaa', fontSize: 13 }}>신고가 데이터가 없습니다.</div>
          ) : (
            <div className="wide-layout">
              <div className="wide-col">
                <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
                  {selectedGu} 신고가 아파트 {newHighs.length.toLocaleString()}건
                </div>
                <div style={{ overflowY: 'auto', maxHeight: 640 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                      <tr>
                        {['계약일', '아파트명', '층', '실거래가'].map(h => (
                          <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap', borderBottom: '2px solid #111' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {newHighs.map((nh, i) => (
                        <tr
                          key={i}
                          style={{
                            borderBottom: '1px solid #eee',
                            background: selectedApt?.aptNm === nh.aptNm && selectedApt?.dong === nh.dong && selectedApt?.area === nh.area ? '#f8f8f8' : undefined,
                          }}
                        >
                          <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', color: '#555', fontSize: 12 }}>{nh.date}</td>
                          <td style={{ padding: '6px 8px' }}>
                            <button
                              onClick={() => handleAptSelect(nh)}
                              style={{
                                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                color: '#1d4ed8', textDecoration: 'underline',
                                fontSize: 13, fontFamily: 'inherit', textAlign: 'left',
                              }}
                            >
                              {nh.aptNm}
                            </button>
                            <span style={{ fontSize: 11, color: '#aaa', marginLeft: 4 }}>{nh.area}㎡</span>
                          </td>
                          <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{nh.floor}층</td>
                          <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatPrice(nh.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="hidden-mobile" />
            </div>
          )}
        </div>
      )}

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
