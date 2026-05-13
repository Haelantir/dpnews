'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type AreaType = '59' | '84' | '100+';

interface RaceApt {
  dong: string;
  data: Record<string, number>; // ym → avg 만원/㎡
}

interface RaceJson {
  months: string[];
  apts: Record<string, RaceApt>;
}

interface FrameItem {
  key: string;   // "아파트명|동"
  aptNm: string;
  dong: string;
  price: number; // 만원/㎡
}

// exiting 바: 마지막 rank 위치에서 fade-out
interface ExitItem extends FrameItem {
  lastRank: number;
  id: number; // 고유 id (동일 key가 여러 번 exit할 수 있어서)
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AREA_LABELS: Record<AreaType, string> = { '59': '59㎡', '84': '84㎡', '100+': '100㎡ 이상' };

const SEOUL_DISTRICTS = [
  '강남구','강동구','강북구','강서구','관악구','광진구','구로구','금천구',
  '노원구','도봉구','동대문구','동작구','마포구','서대문구','서초구',
  '성동구','성북구','송파구','양천구','영등포구','용산구','은평구',
  '종로구','중구','중랑구',
];

const TOP_N = 20;
const MS_PER_MONTH = 500;
const BAR_H = 30;
const BAR_GAP = 5;
const ROW_H = BAR_H + BAR_GAP;
const CHART_H = TOP_N * ROW_H - BAR_GAP;
const LABEL_W = 132;
const EXIT_DURATION = 380; // ms

const PALETTE = [
  '#2563eb','#dc2626','#16a34a','#d97706','#7c3aed',
  '#0891b2','#be185d','#65a30d','#c2410c','#0f766e',
  '#9333ea','#b45309','#0284c7','#15803d','#b91c1c',
  '#6d28d9','#0369a1','#047857','#92400e','#7e22ce',
];

function dongColor(dong: string): string {
  let h = 0;
  for (let i = 0; i < dong.length; i++) h = (h * 31 + dong.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// ── Pre-process frames ────────────────────────────────────────────────────────

function buildFrames(json: RaceJson): FrameItem[][] {
  const lastKnown = new Map<string, number>();
  return json.months.map(ym => {
    for (const [key, apt] of Object.entries(json.apts)) {
      if (apt.data[ym] !== undefined) lastKnown.set(key, apt.data[ym]);
    }
    const items: FrameItem[] = [];
    for (const [key, price] of lastKnown.entries()) {
      const apt = json.apts[key];
      items.push({ key, aptNm: key.split('|')[0], dong: apt.dong, price });
    }
    items.sort((a, b) => b.price - a.price);
    return items.slice(0, TOP_N);
  });
}

// ── Bar ───────────────────────────────────────────────────────────────────────

function Bar({
  item, rank, maxPrice, barAreaW, isNew, isExit, exitRank,
}: {
  item: FrameItem;
  rank: number;
  maxPrice: number;
  barAreaW: number;
  isNew: boolean;
  isExit: boolean;
  exitRank?: number;
}) {
  const color = dongColor(item.dong);
  const fillW = maxPrice > 0 ? Math.max(Math.round((item.price / maxPrice) * barAreaW), 3) : 3;
  const topPx = (isExit ? (exitRank ?? rank) : rank) * ROW_H;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: topPx,
        width: '100%',
        height: BAR_H,
        display: 'flex',
        alignItems: 'center',
        // 진입: keyframe animation (새 마운트에서 동작)
        // 퇴장: keyframe animation
        // 순위 변동: top transition (안정적 key일 때만 동작)
        animation: isNew
          ? `raceBarEnter 0.35s ease forwards`
          : isExit
          ? `raceBarExit ${EXIT_DURATION}ms ease forwards`
          : 'none',
        transition: !isNew && !isExit ? 'top 0.45s ease' : 'none',
      }}
    >
      {/* 아파트명 */}
      <div
        style={{
          width: LABEL_W,
          flexShrink: 0,
          fontSize: 11,
          color: '#222',
          textAlign: 'right',
          paddingRight: 8,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: `${BAR_H}px`,
          fontWeight: 500,
        }}
        title={item.aptNm}
      >
        {item.aptNm}
      </div>

      {/* 바 + 숫자 */}
      <div style={{ flex: 1, position: 'relative', height: BAR_H, minWidth: 0 }}>
        <div
          style={{
            position: 'absolute',
            left: 0, top: 4,
            height: BAR_H - 8,
            width: fillW,
            background: color,
            borderRadius: '0 3px 3px 0',
            transition: 'width 0.45s ease',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: fillW + 5,
            top: 0,
            height: BAR_H,
            lineHeight: `${BAR_H}px`,
            fontSize: 10,
            color: '#555',
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
            transition: 'left 0.45s ease',
          }}
        >
          {Math.round(item.price).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PriceRaceClient() {
  const [selectedGu, setSelectedGu] = useState('');
  const [areaType, setAreaType]     = useState<AreaType>('84');

  const [frames,    setFrames]    = useState<FrameItem[][]>([]);
  const [raceJson,  setRaceJson]  = useState<RaceJson | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [started,   setStarted]   = useState(false);
  const [playing,   setPlaying]   = useState(false);
  const [frameIdx,  setFrameIdx]  = useState(0);

  // exiting bars 관리
  const [exitItems, setExitItems] = useState<ExitItem[]>([]);
  const exitCounterRef = useRef(0);

  // 이전 프레임 rank map (key → rank)
  const prevRankRef = useRef<Map<string, number>>(new Map());

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const [barAreaW, setBarAreaW] = useState(500);

  // 컨테이너 너비 → barAreaW
  useEffect(() => {
    if (!wrapRef.current) return;
    const obs = new ResizeObserver(e => setBarAreaW(e[0].contentRect.width - LABEL_W));
    obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, []);

  // 구/면적 변경 시 완전 리셋
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setFrames([]); setRaceJson(null); setStarted(false); setPlaying(false);
    setFrameIdx(0); setExitItems([]); setLoadError(false);
    prevRankRef.current = new Map();
  }, [selectedGu, areaType]);

  // 프레임 바뀔 때: exiting 바 계산 및 추가
  useEffect(() => {
    if (frames.length === 0 || frameIdx === 0) return;

    const prev = frames[frameIdx - 1] ?? [];
    const cur  = frames[frameIdx]     ?? [];
    const curKeys = new Set(cur.map(x => x.key));
    const prevMap  = prevRankRef.current;

    const newExits: ExitItem[] = [];
    prev.forEach(item => {
      if (!curKeys.has(item.key)) {
        newExits.push({
          ...item,
          lastRank: prevMap.get(item.key) ?? TOP_N,
          id: exitCounterRef.current++,
        });
      }
    });

    if (newExits.length > 0) {
      setExitItems(prev2 => [...prev2, ...newExits]);
      // EXIT_DURATION 후 제거
      setTimeout(() => {
        setExitItems(prev2 => prev2.filter(e => !newExits.some(n => n.id === e.id)));
      }, EXIT_DURATION + 50);
    }

    // prevRank 갱신
    const newMap = new Map<string, number>();
    cur.forEach((item, rank) => newMap.set(item.key, rank));
    prevRankRef.current = newMap;
  }, [frameIdx, frames]);

  // 시작
  const handleStart = useCallback(async () => {
    if (!selectedGu) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setPlaying(false); setStarted(false); setFrameIdx(0);
    setExitItems([]); prevRankRef.current = new Map();

    let json = raceJson;
    if (!json) {
      setLoading(true); setLoadError(false);
      try {
        const safe = areaType.replace('+', 'plus');
        const res  = await fetch(`/data/race/${encodeURIComponent(selectedGu)}_${safe}.json`);
        if (!res.ok) throw new Error();
        json = await res.json() as RaceJson;
        setRaceJson(json);
      } catch {
        setLoadError(true); setLoading(false); return;
      }
      setLoading(false);
    }

    const f = buildFrames(json);
    setFrames(f);
    setFrameIdx(0);
    setStarted(true);
    setPlaying(true);
  }, [selectedGu, areaType, raceJson]);

  // 타이머
  useEffect(() => {
    if (!playing || frames.length === 0) return;
    timerRef.current = setInterval(() => {
      setFrameIdx(prev => {
        if (prev >= frames.length - 1) { setPlaying(false); clearInterval(timerRef.current!); return prev; }
        return prev + 1;
      });
    }, MS_PER_MONTH);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, frames]);

  const handlePause  = () => { setPlaying(false); if (timerRef.current) clearInterval(timerRef.current); };
  const handleResume = () => {
    if (frameIdx >= frames.length - 1) {
      // 처음부터
      setFrameIdx(0); setExitItems([]); prevRankRef.current = new Map();
      setTimeout(() => setPlaying(true), 0);
    } else {
      setPlaying(true);
    }
  };

  const currentFrame = frames[frameIdx] ?? [];
  const currentYm    = raceJson ? (raceJson.months[frameIdx] ?? '') : '';
  const maxPrice     = currentFrame[0]?.price ?? 1;

  // 이전 프레임에 없던 key = 진입 바
  const prevFrameKeys = useMemo(() => {
    if (frameIdx === 0) return new Set<string>();
    return new Set((frames[frameIdx - 1] ?? []).map(x => x.key));
  }, [frames, frameIdx]);

  // 날짜 display
  const ymDisplay = currentYm ? currentYm.slice(0, 4) + '.' + currentYm.slice(5, 7) : '';

  return (
    <div className="page-wrap">
      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: 0, marginBottom: 6 }}>
          시세 레이스
        </h1>
        <p style={{ fontSize: 13, color: '#999', margin: 0 }}>
          2020년부터 현재까지 구별 아파트의 ㎡당 실거래 단가 순위 변화를 바 차트로 보여줍니다.
          같은 동은 같은 색으로 표시되며, 해당 월에 거래가 없으면 이전 가격을 유지합니다.
        </p>
      </div>

      {/* 필터 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
        <select
          value={selectedGu}
          onChange={e => setSelectedGu(e.target.value)}
          style={{
            height: 36, padding: '0 8px', border: '1px solid #333',
            background: '#fff', color: selectedGu ? '#111' : '#888',
            fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', appearance: 'auto',
          }}
        >
          <option value="">구 선택</option>
          {SEOUL_DISTRICTS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        <select
          value={areaType}
          onChange={e => setAreaType(e.target.value as AreaType)}
          style={{
            height: 36, padding: '0 8px', border: '1px solid #333',
            background: '#fff', color: '#111',
            fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', appearance: 'auto',
          }}
        >
          {(Object.entries(AREA_LABELS) as [AreaType, string][]).map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
      </div>

      {/* 시작 버튼 */}
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={handleStart}
          disabled={!selectedGu || loading}
          style={{
            height: 40, padding: '0 28px',
            border: `1px solid ${!selectedGu || loading ? '#ccc' : '#111'}`,
            background: !selectedGu || loading ? '#f5f5f5' : '#111',
            color: !selectedGu || loading ? '#aaa' : '#fff',
            fontSize: 14, fontWeight: 700,
            cursor: !selectedGu || loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {loading ? '불러오는 중...' : '레이스 시작!'}
        </button>
      </div>

      {loadError && (
        <p style={{ color: '#dc2626', fontSize: 13 }}>
          데이터를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.
        </p>
      )}

      {/* 레이스 */}
      {started && frames.length > 0 && (
        <div>
          {/* 컨트롤 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <button
              onClick={playing ? handlePause : handleResume}
              style={{
                height: 30, padding: '0 14px',
                border: '1px solid #555', background: '#fff', color: '#333',
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
              }}
            >
              {playing ? '일시정지' : frameIdx >= frames.length - 1 ? '처음부터' : '재생'}
            </button>
            <input
              type="range" min={0} max={frames.length - 1} value={frameIdx}
              onChange={e => { handlePause(); setFrameIdx(Number(e.target.value)); }}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap', minWidth: 52, textAlign: 'right' }}>
              {raceJson?.months[frameIdx]?.replace('-', '.').replace('-', '.') ?? ''}
            </span>
          </div>

          {/* 차트 */}
          <div
            ref={wrapRef}
            style={{ position: 'relative', width: '100%', height: CHART_H, overflow: 'hidden' }}
          >
            {/* 날짜 워터마크 */}
            <div
              style={{
                position: 'absolute', right: 4, top: 0,
                fontSize: 32, fontWeight: 800,
                color: 'rgba(0,0,0,0.07)',
                lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                pointerEvents: 'none', userSelect: 'none', zIndex: 2,
                letterSpacing: '-0.02em',
              }}
            >
              {ymDisplay}
            </div>

            {/* 현재 프레임 바들 */}
            {currentFrame.map((item, rank) => (
              <Bar
                key={item.key}
                item={item}
                rank={rank}
                maxPrice={maxPrice}
                barAreaW={Math.max(barAreaW, 100)}
                isNew={frameIdx > 0 && !prevFrameKeys.has(item.key)}
                isExit={false}
              />
            ))}

            {/* 퇴장 바들 */}
            {exitItems.map(exit => (
              <Bar
                key={`exit-${exit.id}`}
                item={exit}
                rank={exit.lastRank}
                maxPrice={maxPrice}
                barAreaW={Math.max(barAreaW, 100)}
                isNew={false}
                isExit={true}
                exitRank={exit.lastRank}
              />
            ))}
          </div>

          {/* 동 범례 */}
          <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: '5px 14px' }}>
            {Array.from(new Set(currentFrame.map(x => x.dong))).sort().map(dong => (
              <div key={dong} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 9, height: 9, background: dongColor(dong), borderRadius: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#555' }}>{dong}</span>
              </div>
            ))}
          </div>

          {/* 단위 안내 */}
          <p style={{ marginTop: 14, fontSize: 11, color: '#aaa', margin: '14px 0 0' }}>
            단위: 만원/㎡ (전용면적 기준) · 거래 없는 달은 직전 거래가 유지
          </p>
        </div>
      )}
    </div>
  );
}
