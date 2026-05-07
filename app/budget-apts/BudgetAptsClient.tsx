'use client';

import { useState, useEffect, useCallback, useMemo, useRef, useTransition } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type AreaType = '59' | '84' | '100+';

interface BudgetAptItem {
  aptNm: string;
  gu: string;
  dong: string;
  area: number;
  price: number;
  date: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AREA_LABELS: Record<AreaType, string> = { '59': '59㎡', '84': '84㎡', '100+': '100㎡ 이상' };

const SEOUL_GUS = [
  '강남구', '강동구', '강북구', '강서구', '관악구',
  '광진구', '구로구', '금천구', '노원구', '도봉구',
  '동대문구', '동작구', '마포구', '서대문구', '서초구',
  '성동구', '성북구', '송파구', '양천구', '영등포구',
  '용산구', '은평구', '종로구', '중구', '중랑구',
];

const MAX_DISPLAY = 500;

// ── Non-linear scale ──────────────────────────────────────────────────────────
// r ∈ [0, 2/3]: price 0→20억 (linear)
// r ∈ [2/3,  1]: price 20→100억 (power-4, gives ~40억 at r=0.9)
// r = 1: 무제한 (Infinity)

const BP_R = 2 / 3;
const BP_P = 20; // 억

function ratioToPrice(r: number): number {
  if (r >= 1) return Infinity;
  let p: number;
  if (r <= BP_R) {
    p = (r / BP_R) * BP_P;
  } else {
    const t = (r - BP_R) / (1 - BP_R);
    p = BP_P + 80 * Math.pow(t, 4);
  }
  return Math.round(p * 10) / 10; // snap to 1000만원 (0.1억)
}

function priceToRatio(p: number): number {
  if (!isFinite(p) || p >= 100) return 1;
  if (p <= BP_P) return (p / BP_P) * BP_R;
  const t = Math.pow(Math.min((p - BP_P) / 80, 1), 0.25);
  return Math.min(BP_R + t * (1 - BP_R), 0.9999);
}

// ── Format helpers ────────────────────────────────────────────────────────────

function fmtBudget(억: number): string {
  if (!isFinite(억)) return '무제한';
  const a = Math.floor(억);
  const m = Math.round((억 - a) * 10) * 1000;
  if (a === 0 && m === 0) return '0억';
  if (m === 0) return `${a}억`;
  if (a === 0) return `${m.toLocaleString()}만`;
  return `${a}억 ${m.toLocaleString()}만`;
}

function fmtPrice(만원: number): string {
  const 억 = Math.floor(만원 / 10000);
  const 나머지 = 만원 % 10000;
  if (억 === 0) return `${나머지.toLocaleString()}만`;
  if (나머지 === 0) return `${억}억`;
  return `${억}억 ${나머지.toLocaleString()}만`;
}

function fmtDate(d: string): string {
  const p = d.split('-');
  return p.length >= 3 ? `${Number(p[1])}/${Number(p[2])} 거래됨` : d;
}

// ── Gu affordability color ────────────────────────────────────────────────────
// ratio 0 → red (hsl 0), ratio 1 → green (hsl 120)
// Lightness kept dark enough for white text

function guColor(ratio: number): string {
  const hue = Math.round(ratio * 120);
  // slightly darker in the yellow-ish midrange for legibility
  const lit = Math.round(50 - Math.sin(ratio * Math.PI) * 5);
  return `hsl(${hue},65%,${lit}%)`;
}

// ── Budget Range Slider ───────────────────────────────────────────────────────

function BudgetSlider({ minR, maxR, onChange }: {
  minR: number; maxR: number;
  onChange: (min: number, max: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'left' | 'right' | null>(null);

  const posToRatio = useCallback((cx: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return 0;
    return Math.max(0, Math.min(1, (cx - r.left) / r.width));
  }, []);

  const move = useCallback((cx: number) => {
    if (!dragging.current) return;
    const r = posToRatio(cx);
    if (dragging.current === 'left') onChange(Math.min(r, maxR - 0.005), maxR);
    else onChange(minR, Math.max(r, minR + 0.005));
  }, [minR, maxR, onChange, posToRatio]);

  const onMM = useCallback((e: MouseEvent) => move(e.clientX), [move]);
  const onTM = useCallback((e: TouchEvent) => {
    if (!dragging.current) return;
    e.preventDefault();
    move(e.touches[0].clientX);
  }, [move]);
  const onUp = useCallback(() => { dragging.current = null; }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMM);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTM, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMM);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTM);
      window.removeEventListener('touchend', onUp);
    };
  }, [onMM, onTM, onUp]);

  const lp = minR * 100;
  const rp = maxR * 100;

  const knob = (left: number, side: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute', top: '50%', left: `${left}%`,
    transform: 'translate(-50%,-50%)',
    width: 18, height: 18,
    background: '#111', border: '2.5px solid #fff',
    boxShadow: '0 0 0 1.5px #111',
    cursor: 'ew-resize', userSelect: 'none', touchAction: 'none',
    zIndex: side === 'right' ? 2 : 1,
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#bbb', marginBottom: 4 }}>
        <span>0원</span><span>무제한</span>
      </div>
      <div ref={trackRef} style={{ position: 'relative', height: 4, background: '#ddd', margin: '14px 0 10px' }}>
        <div style={{
          position: 'absolute', top: 0, height: '100%', background: '#333',
          left: `${lp}%`, width: `${rp - lp}%`,
        }} />
        <div
          onMouseDown={() => { dragging.current = 'left'; }}
          onTouchStart={() => { dragging.current = 'left'; }}
          style={knob(lp, 'left')}
        />
        <div
          onMouseDown={() => { dragging.current = 'right'; }}
          onTouchStart={() => { dragging.current = 'right'; }}
          style={knob(rp, 'right')}
        />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const INIT_MIN = 5;  // 억
const INIT_MAX = 30; // 억

export default function BudgetAptsClient() {
  const [areaType, setAreaType] = useState<AreaType>('84');
  const [minR, setMinR] = useState(() => priceToRatio(INIT_MIN));
  const [maxR, setMaxR] = useState(() => priceToRatio(INIT_MAX));
  const [tableData, setTableData] = useState<BudgetAptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGus, setSelectedGus] = useState<Set<string>>(new Set());

  // Input field strings
  const [minInput, setMinInput] = useState(String(INIT_MIN));
  const [maxInput, setMaxInput] = useState(String(INIT_MAX));
  const [editingMin, setEditingMin] = useState(false);
  const [editingMax, setEditingMax] = useState(false);

  // Deferred ratios for table (keeps slider+gu colors responsive)
  const [, startTransition] = useTransition();
  const [tableMinR, setTableMinR] = useState(minR);
  const [tableMaxR, setTableMaxR] = useState(maxR);

  // Derived prices (immediate, for gu coloring)
  const minP = ratioToPrice(minR);   // 억
  const maxP = ratioToPrice(maxR);   // 억 or Infinity

  // Sync input boxes from slider (only when not editing)
  useEffect(() => {
    if (!editingMin) setMinInput(isFinite(minP) ? String(minP) : '');
  }, [minP, editingMin]);
  useEffect(() => {
    if (!editingMax) setMaxInput(isFinite(maxP) ? String(maxP) : '');
  }, [maxP, editingMax]);

  // Fetch data
  const fetchData = useCallback(async (at: AreaType) => {
    setLoading(true);
    setTableData([]);
    try {
      const res = await fetch(`/api/budget-apts?areaType=${encodeURIComponent(at)}`);
      setTableData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData('84'); }, [fetchData]);

  const handleAreaType = (at: AreaType) => {
    if (at === areaType) return;
    setAreaType(at);
    fetchData(at);
  };

  const handleSliderChange = useCallback((newMin: number, newMax: number) => {
    setMinR(newMin);
    setMaxR(newMax);
    startTransition(() => {
      setTableMinR(newMin);
      setTableMaxR(newMax);
    });
  }, [startTransition]);

  const commitMinInput = () => {
    setEditingMin(false);
    const val = parseFloat(minInput);
    if (!isNaN(val) && val >= 0) {
      const r = priceToRatio(val);
      const clamped = Math.min(r, maxR - 0.005);
      setMinR(clamped);
      startTransition(() => setTableMinR(clamped));
    } else {
      setMinInput(isFinite(minP) ? String(minP) : '');
    }
  };

  const commitMaxInput = () => {
    setEditingMax(false);
    if (maxInput.trim() === '') {
      setMaxR(1); startTransition(() => setTableMaxR(1)); return;
    }
    const val = parseFloat(maxInput);
    if (!isNaN(val) && val >= 0) {
      const r = val >= 100 ? 1 : Math.max(priceToRatio(val), minR + 0.005);
      setMaxR(r); startTransition(() => setTableMaxR(r));
    } else {
      setMaxInput(isFinite(maxP) ? String(maxP) : '');
    }
  };

  const toggleGu = (gu: string) => {
    setSelectedGus(prev => {
      const next = new Set(prev);
      next.has(gu) ? next.delete(gu) : next.add(gu);
      return next;
    });
  };

  // Per-gu affordability (immediate — drives button colors)
  const guStats = useMemo(() => {
    const minPrice = Math.round(minP * 10000);
    const maxPrice = isFinite(maxP) ? Math.round(maxP * 10000) : Infinity;
    const m = new Map<string, { total: number; inBudget: number }>();
    for (const d of tableData) {
      if (!m.has(d.gu)) m.set(d.gu, { total: 0, inBudget: 0 });
      const s = m.get(d.gu)!;
      s.total++;
      if (d.price >= minPrice && d.price <= maxPrice) s.inBudget++;
    }
    return m;
  }, [tableData, minP, maxP]);

  // Filtered data (deferred — drives table)
  const filteredData = useMemo(() => {
    const minPrice = Math.round(ratioToPrice(tableMinR) * 10000);
    const maxPrice = isFinite(ratioToPrice(tableMaxR))
      ? Math.round(ratioToPrice(tableMaxR) * 10000) : Infinity;
    return tableData.filter(d =>
      d.price >= minPrice && d.price <= maxPrice &&
      (selectedGus.size === 0 || selectedGus.has(d.gu)),
    );
  }, [tableData, tableMinR, tableMaxR, selectedGus]);

  const displayData = filteredData.slice(0, MAX_DISPLAY);
  const truncated = filteredData.length > MAX_DISPLAY;

  const inputBox = (
    value: string,
    onChange: (v: string) => void,
    onFocus: () => void,
    onBlur: () => void,
    isMax: boolean,
  ) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      border: '1px solid #ccc', padding: '5px 10px',
      background: '#fff', minWidth: 110,
    }}>
      <input
        type="number"
        min="0"
        step="0.1"
        value={value}
        placeholder={isMax ? '무제한' : '0'}
        onChange={e => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        style={{
          width: 64, border: 'none', outline: 'none',
          fontSize: 13, fontFamily: 'inherit',
          fontVariantNumeric: 'tabular-nums', background: 'transparent',
        }}
      />
      <span style={{ fontSize: 13, color: (isMax && maxR >= 1) ? '#ccc' : '#555', flexShrink: 0 }}>억</span>
    </div>
  );

  return (
    <div className="page-wrap">

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: 0, marginBottom: 6 }}>
          예산에 맞는 아파트
        </h1>
        <p style={{ fontSize: 13, color: '#999', margin: 0 }}>
          내 돈으로 갈 수 있는 지역일수록 초록색으로 표시됩니다. 모든 면적은 전용면적입니다.
        </p>
      </div>

      {/* Budget slider */}
      <div style={{ marginBottom: 24 }}>
        <BudgetSlider minR={minR} maxR={maxR} onChange={handleSliderChange} />

        {/* Input boxes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          {inputBox(
            minInput,
            setMinInput,
            () => setEditingMin(true),
            commitMinInput,
            false,
          )}
          <span style={{ fontSize: 14, color: '#aaa' }}>~</span>
          {inputBox(
            maxInput,
            setMaxInput,
            () => setEditingMax(true),
            commitMaxInput,
            true,
          )}
        </div>
        <div style={{ fontSize: 11, color: '#bbb', marginTop: 6 }}>
          숫자로 직접 입력 가능 (소수점 허용 · 예: 15.5 = 15억 5000만) · 오른쪽 빈칸 = 무제한
        </div>
      </div>

      {/* Area type buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 }}>
        {(['59', '84', '100+'] as AreaType[]).map(at => (
          <button key={at} onClick={() => handleAreaType(at)}
            style={{
              height: 36, padding: '0 8px',
              border: `1px solid ${areaType === at ? '#111' : '#aaa'}`,
              background: areaType === at ? '#111' : '#fff',
              color: areaType === at ? '#fff' : '#555',
              fontSize: 13, cursor: 'pointer', appearance: 'none',
              fontFamily: 'inherit', fontWeight: areaType === at ? 700 : 400,
            }}>
            {AREA_LABELS[at]}
          </button>
        ))}
        <div /><div />
      </div>

      {/* Gu buttons */}
      <div className="gu-grid" style={{ marginBottom: 20 }}>
        {SEOUL_GUS.map(gu => {
          const stat = guStats.get(gu);
          const ratio = (stat && stat.total > 0) ? stat.inBudget / stat.total : -1;
          const isSelected = selectedGus.has(gu);
          let bg: string;
          let fg: string;
          if (isSelected) {
            bg = '#111'; fg = '#fff';
          } else if (loading || ratio < 0) {
            bg = '#e8e8e8'; fg = '#999';
          } else {
            bg = guColor(ratio); fg = '#fff';
          }
          return (
            <button key={gu} onClick={() => toggleGu(gu)}
              style={{
                height: 36, padding: '0 4px',
                border: `2px solid ${isSelected ? '#111' : 'transparent'}`,
                background: bg, color: fg,
                fontSize: 12, cursor: 'pointer', appearance: 'none',
                fontFamily: 'inherit', fontWeight: isSelected ? 700 : 500,
                transition: 'background 0.15s',
              }}>
              {gu}
            </button>
          );
        })}
      </div>

      {/* Table info row */}
      <div style={{ fontSize: 12, color: '#888', marginBottom: 6, minHeight: 18 }}>
        {loading ? '불러오는 중...' : (
          <>
            <span>
              {selectedGus.size > 0
                ? [...selectedGus].join('·') + ' '
                : '서울 전체 '}
            </span>
            <b>{filteredData.length.toLocaleString()}</b>개
            {' · '}
            {fmtBudget(ratioToPrice(tableMinR))}
            {' ~ '}
            {fmtBudget(ratioToPrice(tableMaxR))}
            {' · '}
            {AREA_LABELS[areaType]}
            {truncated && (
              <span style={{ color: '#dc2626', marginLeft: 6 }}>
                · 상위 {MAX_DISPLAY}개 표시 중 — 범위를 좁혀주세요
              </span>
            )}
          </>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 640 }}>
        <table className="budget-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 460 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
            <tr>
              {(['아파트명', '구', '동', '면적', '실거래가'] as const).map(h => (
                <th key={h} style={{
                  padding: '6px 8px', textAlign: 'left',
                  fontWeight: 700, whiteSpace: 'nowrap',
                  borderBottom: '2px solid #111',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && displayData.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '28px 8px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>
                  예산 범위에 맞는 아파트가 없습니다.
                </td>
              </tr>
            )}
            {displayData.map((d, i) => (
              <tr key={`${d.aptNm}|${d.gu}|${d.dong}|${i}`}
                style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '6px 8px' }}>{d.aptNm}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', color: '#555' }}>{d.gu}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', color: '#555' }}>{d.dong}</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', color: '#555' }}>{d.area}㎡</td>
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtPrice(d.price)}
                  <span style={{ fontSize: 11, color: '#bbb', marginLeft: 6 }}>
                    ({fmtDate(d.date)})
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
