'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type AreaType = '59' | '84' | '100+';

interface RaceApt { dong: string; data: Record<string, number>; }
interface RaceJson { months: string[]; apts: Record<string, RaceApt>; }
interface FrameItem { key: string; aptNm: string; dong: string; price: number; }
interface DisplayItem {
  key: string; aptNm: string; dong: string;
  rank: number;   // fractional (interpolated)
  price: number;  // interpolated 만원/㎡
  opacity: number;
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
const MS_PER_MONTH = 1050;  // 1.05초/월 → 77개월 ≈ 81초
const BAR_H = 36;
const BAR_GAP = 5;
const ROW_H = BAR_H + BAR_GAP;
const CHART_OFFSET_TOP = 48; // 날짜 워터마크와 1등 바가 겹치지 않도록 바를 아래로 밀기
const CHART_H = TOP_N * ROW_H - BAR_GAP + CHART_OFFSET_TOP;
const LABEL_W = 132;

// 스펙트럼 전체를 커버하는 20색 팔레트
// 인접 인덱스끼리 최대한 달라 보이도록 색조를 교차 배치
const PALETTE = [
  '#e11d48', // 빨강
  '#16a34a', // 초록
  '#2563eb', // 파랑
  '#f59e0b', // 주황/노랑
  '#7c3aed', // 보라
  '#0d9488', // 청록
  '#ea580c', // 진주황
  '#4338ca', // 남색
  '#059669', // 에메랄드
  '#db2777', // 분홍
  '#0284c7', // 하늘
  '#65a30d', // 연두
  '#c026d3', // 자주
  '#0f766e', // 짙은청록
  '#be123c', // 진빨강
  '#6d28d9', // 짙은보라
  '#b45309', // 갈색/호박
  '#0e7490', // 짙은하늘
  '#15803d', // 짙은초록
  '#9333ea', // 밝은보라
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function buildFrames(json: RaceJson): FrameItem[][] {
  const lastKnown = new Map<string, number>();
  return json.months.map(ym => {
    for (const [key, apt] of Object.entries(json.apts)) {
      if (apt.data[ym] !== undefined) lastKnown.set(key, apt.data[ym]);
    }
    const items: FrameItem[] = [];
    for (const [key, price] of lastKnown.entries()) {
      items.push({ key, aptNm: key.split('|')[0], dong: json.apts[key].dong, price });
    }
    items.sort((a, b) => b.price - a.price);
    return items.slice(0, TOP_N);
  });
}

// raceJson 로드 시 동→색상 매핑 (정렬 순서로 할당 → 최대 분산)
function buildDongColorMap(json: RaceJson): Record<string, string> {
  const dongs = [...new Set(Object.values(json.apts).map(a => a.dong))].sort();
  return Object.fromEntries(dongs.map((dong, i) => [dong, PALETTE[i % PALETTE.length]]));
}

// frameProgress에서 보간된 DisplayItem 목록을 계산 (매 rAF 프레임 호출)
function computeDisplay(
  frameProgress: number,
  frames: FrameItem[][],
  raceJson: RaceJson,
): { items: DisplayItem[]; ym: string; maxPrice: number } {
  const fi  = Math.max(0, Math.min(Math.floor(frameProgress), frames.length - 2));
  const rawT = Math.max(0, Math.min(frameProgress - fi, 1));
  const t    = easeInOut(rawT);

  const curFrame = frames[fi];
  const nxtFrame = frames[fi + 1] ?? curFrame;

  const cMap = new Map(curFrame.map((x, i) => [x.key, { i, price: x.price, item: x }]));
  const nMap = new Map(nxtFrame.map((x, i) => [x.key, { i, price: x.price, item: x }]));
  const keys = new Set([...cMap.keys(), ...nMap.keys()]);

  const items: DisplayItem[] = [];
  for (const key of keys) {
    const c = cMap.get(key), n = nMap.get(key);
    const base = (c ?? n)!.item;
    let rank: number, price: number, opacity: number;

    if (c && n) {
      rank    = c.i + (n.i - c.i) * t;
      price   = c.price + (n.price - c.price) * t;
      opacity = 1;
    } else if (c) {
      // 퇴장: 현재 rank → 화면 아래
      rank    = c.i + (TOP_N + 1 - c.i) * t;
      price   = c.price;
      opacity = Math.max(0, 1 - t * 3);
    } else {
      // 진입: 화면 아래 → 새 rank
      rank    = (TOP_N + 1) - ((TOP_N + 1) - n!.i) * t;
      price   = n!.price;
      opacity = Math.min(1, t * 3);
    }
    items.push({ key, aptNm: base.aptNm, dong: base.dong, rank, price, opacity });
  }

  items.sort((a, b) => a.rank - b.rank);
  // maxPrice도 보간 → 1등 가격이 급변해도 차트 스케일이 부드럽게 리스케일됨
  const curMax = curFrame[0]?.price ?? 1;
  const nxtMax = nxtFrame[0]?.price ?? 1;
  const maxPrice = curMax + (nxtMax - curMax) * t;
  return { items, ym: raceJson.months[fi] ?? '', maxPrice };
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PriceRaceClient() {
  const [selectedGu, setSelectedGu] = useState('');
  const [areaType,   setAreaType]   = useState<AreaType>('84');
  const [raceJson,   setRaceJson]   = useState<RaceJson | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [loadError,  setLoadError]  = useState(false);
  const [started,    setStarted]    = useState(false);
  const [playing,    setPlaying]    = useState(false);

  // 연속 보간을 위한 float 프레임 인덱스 (0 ~ frames.length-1)
  const [frameProgress, setFrameProgress] = useState(0);

  const framesRef      = useRef<FrameItem[][]>([]);
  const rafRef         = useRef<number | null>(null);
  const startTsRef     = useRef(0);
  const startProgRef   = useRef(0);
  const wrapRef        = useRef<HTMLDivElement>(null);
  const [barAreaW, setBarAreaW] = useState(500);

  // 컨테이너 너비 측정
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new ResizeObserver(e =>
      setBarAreaW(Math.max(e[0].contentRect.width - LABEL_W, 80))
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [started]);

  // 구/면적 변경 시 리셋
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setRaceJson(null);
    framesRef.current = [];
    setStarted(false);
    setPlaying(false);
    setFrameProgress(0);
    setLoadError(false);
  }, [selectedGu, areaType]);

  // ── rAF 루프: playing이 true가 될 때만 시작 ──────────────────────────────
  useEffect(() => {
    if (!playing || !framesRef.current.length) return;

    // playing이 켜지는 시점의 frameProgress를 기준으로 삼음
    startTsRef.current   = performance.now();
    startProgRef.current = frameProgress; // 클로저로 캡처 (최신 값)

    const frames = framesRef.current;
    let id: number;

    const loop = (ts: number) => {
      const elapsed = ts - startTsRef.current;
      const newProg = startProgRef.current + elapsed / MS_PER_MONTH;

      if (newProg >= frames.length - 1) {
        setFrameProgress(frames.length - 1);
        setPlaying(false);
        return;
      }
      setFrameProgress(newProg);
      id = requestAnimationFrame(loop);
    };

    id = requestAnimationFrame(loop);
    rafRef.current = id;
    return () => cancelAnimationFrame(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]); // frameProgress를 deps에서 제외 — 매 프레임 effect 재실행 방지

  // ── 컨트롤 ───────────────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    if (!selectedGu) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPlaying(false);
    setStarted(false);
    setFrameProgress(0);

    let json = raceJson;
    if (!json) {
      setLoading(true);
      setLoadError(false);
      try {
        const safe = areaType.replace('+', 'plus');
        const res  = await fetch(`/data/race/${encodeURIComponent(selectedGu)}_${safe}.json`);
        if (!res.ok) throw new Error();
        json = await res.json() as RaceJson;
        setRaceJson(json);
      } catch {
        setLoadError(true);
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    framesRef.current = buildFrames(json);
    setStarted(true);
    setPlaying(true);
  }, [selectedGu, areaType, raceJson]);

  const handlePause = useCallback(() => {
    setPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const handleResume = useCallback(() => {
    const frames = framesRef.current;
    if (frameProgress >= frames.length - 1) {
      // 처음부터 재시작
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setPlaying(false);
      setFrameProgress(0);
      setTimeout(() => setPlaying(true), 0); // 상태 반영 후 재생
    } else {
      setPlaying(true);
    }
  }, [frameProgress]);

  const handleSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPlaying(false);
    setFrameProgress(Number(e.target.value));
  }, []);

  // ── 동 → 색상 맵 ─────────────────────────────────────────────────────────

  const dongColorMap = useMemo(
    () => (raceJson ? buildDongColorMap(raceJson) : ({} as Record<string, string>)),
    [raceJson],
  );

  // ── 보간된 표시 데이터 계산 (매 렌더 = 60fps 동안 매 프레임) ─────────────

  const frames = framesRef.current;
  const hasFrames = frames.length > 0 && raceJson != null;

  const { items: displayItems, ym: currentYm, maxPrice } = hasFrames
    ? computeDisplay(frameProgress, frames, raceJson!)
    : { items: [] as DisplayItem[], ym: '', maxPrice: 1 };

  const ymDisplay = currentYm
    ? currentYm.slice(0, 4) + '.' + currentYm.slice(5, 7)
    : '';
  const sliderVal = Math.min(frameProgress, frames.length - 1);
  const isFinished = sliderVal >= frames.length - 1 && frames.length > 0;

  const visibleDongs = [...new Set(
    displayItems.filter(x => x.opacity > 0.4).map(x => x.dong)
  )].sort();

  // ── Render ────────────────────────────────────────────────────────────────

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
      {started && hasFrames && (
        <div>
          {/* 컨트롤 바 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <button
              onClick={playing ? handlePause : handleResume}
              style={{
                height: 30, padding: '0 14px',
                border: '1px solid #555', background: '#fff', color: '#333',
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
              }}
            >
              {playing ? '일시정지' : isFinished ? '처음부터' : '재생'}
            </button>
            <input
              type="range"
              min={0}
              max={frames.length - 1}
              step={0.01}
              value={sliderVal}
              onChange={handleSlider}
              style={{ flex: 1 }}
            />
            <span style={{
              fontSize: 12, color: '#888', whiteSpace: 'nowrap',
              minWidth: 50, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
            }}>
              {currentYm.replace('-', '.').replace('-', '.')}
            </span>
          </div>

          {/* 차트 영역 */}
          <div
            ref={wrapRef}
            style={{ position: 'relative', width: '100%', height: CHART_H, overflow: 'hidden' }}
          >
            {/* 날짜 워터마크 */}
            <div style={{
              position: 'absolute', right: 4, top: 0,
              fontSize: 32, fontWeight: 800,
              color: 'rgba(0,0,0,0.07)',
              lineHeight: 1, fontVariantNumeric: 'tabular-nums',
              pointerEvents: 'none', userSelect: 'none', zIndex: 2,
              letterSpacing: '-0.02em',
            }}>
              {ymDisplay}
            </div>

            {/* 바들 — top은 JS 보간값, CSS transition 없음 */}
            {displayItems.map(item => {
              const color  = dongColorMap[item.dong] ?? '#888';
              const fillW  = Math.max(Math.round((item.price / maxPrice) * barAreaW), 3);
              const topPx  = item.rank * ROW_H + CHART_OFFSET_TOP;

              return (
                <div
                  key={item.key}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: topPx,
                    width: '100%',
                    height: BAR_H,
                    opacity: item.opacity,
                    display: 'flex',
                    alignItems: 'center',
                    willChange: 'top, opacity',
                  }}
                >
                  {/* 아파트명 */}
                  <div style={{
                    width: LABEL_W, flexShrink: 0,
                    fontSize: 14, color: '#222',
                    textAlign: 'right', paddingRight: 8,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    lineHeight: `${BAR_H}px`, fontWeight: 600,
                  }} title={item.aptNm}>
                    {item.aptNm}
                  </div>

                  {/* 바 — 가격은 바 오른쪽 안쪽에 */}
                  <div style={{ flex: 1, position: 'relative', height: BAR_H, minWidth: 0 }}>
                    <div style={{
                      position: 'absolute',
                      left: 0, top: 4,
                      height: BAR_H - 8,
                      width: fillW,
                      background: color,
                      borderRadius: '0 3px 3px 0',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                    }}>
                      <span style={{
                        paddingRight: 7,
                        fontSize: 14, fontWeight: 700,
                        color: 'rgba(255,255,255,0.92)',
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {Math.round(item.price).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 동 범례 */}
          <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: '5px 14px' }}>
            {visibleDongs.map(dong => (
              <div key={dong} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 9, height: 9,
                  background: dongColorMap[dong] ?? '#888',
                  borderRadius: 2, flexShrink: 0,
                }} />
                <span style={{ fontSize: 11, color: '#555' }}>{dong}</span>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 14, fontSize: 11, color: '#aaa', margin: '14px 0 0' }}>
            단위: 만원/㎡ (전용면적 기준) · 거래 없는 달은 직전 거래가 유지
          </p>
        </div>
      )}
    </div>
  );
}
