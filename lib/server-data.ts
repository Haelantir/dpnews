import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

function parseLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQ = !inQ; }
    } else if (c === ',' && !inQ) {
      result.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

function readCSV(filePath: string): Record<string, string>[] {
  const text = fs.readFileSync(filePath, 'utf-8').replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').filter(l => l.trim());
  const headers = parseLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]));
  });
}

// ── Filter data (구/동/아파트) ──────────────────────────────────────────────

export interface FilterData {
  구s: string[];
  동s: Record<string, string[]>;
  아파트s: Record<string, string[]>;  // key: "구|동"
}

let filterCache: FilterData | null = null;

export function getFilterData(): FilterData {
  if (filterCache) return filterCache;

  // 구/동 : 좌표 있는 항목만
  const coordRows = readCSV(path.join(DATA_DIR, '서울_아파트_목록_좌표포함.csv'))
    .filter(r => r['위도'] && r['경도']);

  const 구Set = new Set<string>();
  const 동Map: Record<string, Set<string>> = {};
  for (const r of coordRows) {
    구Set.add(r['구']);
    if (!동Map[r['구']]) 동Map[r['구']] = new Set();
    동Map[r['구']].add(r['동']);
  }

  // 아파트 : 서울_아파트_목록.csv 전체에서
  const aptRows = readCSV(path.join(DATA_DIR, '서울_아파트_목록.csv'));
  const aptMap: Record<string, Set<string>> = {};
  for (const r of aptRows) {
    const key = `${r['구']}|${r['동']}`;
    if (!aptMap[key]) aptMap[key] = new Set();
    aptMap[key].add(r['아파트명']);
  }

  filterCache = {
    구s: [...구Set].sort((a, b) => a.localeCompare(b, 'ko')),
    동s: Object.fromEntries(
      Object.entries(동Map).map(([gu, set]) => [
        gu, [...set].sort((a, b) => a.localeCompare(b, 'ko'))
      ])
    ),
    아파트s: Object.fromEntries(
      Object.entries(aptMap).map(([key, set]) => [
        key, [...set].sort((a, b) => a.localeCompare(b, 'ko'))
      ])
    ),
  };

  return filterCache;
}

// ── Trade data ───────────────────────────────────────────────────────────────

export interface TradeRecord {
  date: string;   // YYYY-MM-DD
  area: number;   // 전용면적(㎡)
  price: number;  // 실거래가(만원)
  floor: string;
  aptNm: string;
}

// key: "아파트명|구|동"
let tradesIndex: Map<string, TradeRecord[]> | null = null;

function loadTrades(): Map<string, TradeRecord[]> {
  if (tradesIndex) return tradesIndex;

  const index = new Map<string, TradeRecord[]>();
  const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

  for (const year of years) {
    const fp = path.join(DATA_DIR, `서울_실거래가_${year}.csv`);
    if (!fs.existsSync(fp)) continue;
    const rows = readCSV(fp);
    for (const r of rows) {
      const key = `${r['아파트명']}|${r['구']}|${r['동']}`;
      if (!index.has(key)) index.set(key, []);
      index.get(key)!.push({
        date: r['계약일'],
        area: Number(r['전용면적(㎡)']),
        price: Number(r['실거래가(만원)']),
        floor: r['층수'],
        aptNm: r['아파트명'],
      });
    }
  }

  tradesIndex = index;
  return index;
}

export function getAreas(gu: string, dong: string, apt: string): number[] {
  const key = `${apt}|${gu}|${dong}`;
  const trades = loadTrades().get(key) ?? [];
  const areas = [...new Set(trades.map(t => t.area))].filter(a => !isNaN(a));
  return areas.sort((a, b) => a - b);
}

export function getTrades(gu: string, dong: string, apt: string, area: number): TradeRecord[] {
  const key = `${apt}|${gu}|${dong}`;
  const trades = loadTrades().get(key) ?? [];
  return trades
    .filter(t => t.area === area)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getTradesRange(gu: string, dong: string, apt: string, minArea: number, maxArea: number): TradeRecord[] {
  const key = `${apt}|${gu}|${dong}`;
  const trades = loadTrades().get(key) ?? [];
  return trades
    .filter(t => t.area >= minArea && t.area <= maxArea)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export interface NewHighRecord {
  aptNm: string;
  gu: string;
  dong: string;
  area: number;
  date: string;
  price: number;
  floor: string;
  prevPrice: number;
}

const newHighsCache = new Map<string, NewHighRecord[]>();

export function getNewHighsByGu(gu: string): NewHighRecord[] {
  if (newHighsCache.has(gu)) return newHighsCache.get(gu)!;
  const index = loadTrades();
  const results: NewHighRecord[] = [];

  for (const [key, trades] of index.entries()) {
    const parts = key.split('|');
    if (parts.length < 3 || parts[1] !== gu) continue;
    const aptNm = parts[0];
    const dong = parts[2];

    const byArea = new Map<number, TradeRecord[]>();
    for (const t of trades) {
      if (!byArea.has(t.area)) byArea.set(t.area, []);
      byArea.get(t.area)!.push(t);
    }

    for (const [area, areaTrades] of byArea.entries()) {
      if (areaTrades.length < 2) continue;
      const sorted = [...areaTrades].sort((a, b) => b.date.localeCompare(a.date));
      const latest = sorted[0];
      const prevPrice = sorted[1].price;
      const maxPrice = Math.max(...areaTrades.map(t => t.price));
      if (latest.price >= maxPrice) {
        results.push({ aptNm, gu, dong, area, date: latest.date, price: latest.price, floor: latest.floor, prevPrice });
      }
    }
  }

  const sorted = results.sort((a, b) => b.date.localeCompare(a.date));
  newHighsCache.set(gu, sorted);
  return sorted;
}

// ── Top Apts by ㎡ price ─────────────────────────────────────────────────────

function generateMonths(startYm: string, endYm: string): string[] {
  const months: string[] = [];
  let [y, m] = startYm.split('-').map(Number);
  const [ey, em] = endYm.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    if (++m > 12) { m = 1; y++; }
  }
  return months;
}

const topAptsCache = new Map<string, TopAptsResponse>();

export interface TopAptChartItem {
  aptNm: string;
  dong: string;
  months: { ts: number; price: number }[];
}

export interface TopAptTableItem {
  aptNm: string;
  dong: string;
  latestPrice: number;
}

export interface TopAptsResponse {
  chart: TopAptChartItem[];
  table: TopAptTableItem[];
}

export function getTopAptsByGu(gu: string): TopAptsResponse {
  if (topAptsCache.has(gu)) return topAptsCache.get(gu)!;
  const index = loadTrades();

  const aptRawMap = new Map<string, { aptNm: string; dong: string; data: Map<string, number[]> }>();

  for (const [key, trades] of index.entries()) {
    const parts = key.split('|');
    if (parts.length < 3 || parts[1] !== gu) continue;
    const aptNm = parts[0];
    const dong = parts[2];
    const aptKey = `${aptNm}|${dong}`;

    if (!aptRawMap.has(aptKey)) aptRawMap.set(aptKey, { aptNm, dong, data: new Map() });
    const { data } = aptRawMap.get(aptKey)!;

    for (const t of trades) {
      if (!t.date || t.area <= 0 || t.price <= 0 || isNaN(t.area) || isNaN(t.price)) continue;
      const ym = t.date.slice(0, 7);
      if (!data.has(ym)) data.set(ym, []);
      data.get(ym)!.push(t.price / t.area);
    }
  }

  // 구 전체에서 가장 최신 월을 기준 월로 삼아 모든 아파트를 동일 시점에서 비교
  let globalLatestYm = '2020-01';
  for (const { data } of aptRawMap.values()) {
    for (const ym of data.keys()) {
      if (ym > globalLatestYm) globalLatestYm = ym;
    }
  }
  const allMonths = generateMonths('2020-01', globalLatestYm);

  // globalLatestYm 기준으로 몇 달 전인지 계산
  const [gly, glm] = globalLatestYm.split('-').map(Number);
  const monthsStaleOf = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return (gly - y) * 12 + (glm - m);
  };

  type Summary = TopAptTableItem & { months: { ts: number; price: number }[]; stale: boolean };
  const summaries: Summary[] = [];

  for (const { aptNm, dong, data } of aptRawMap.values()) {
    if (data.size === 0) continue;

    const avgByYm = new Map<string, number>();
    for (const [ym, vals] of data.entries()) {
      avgByYm.set(ym, vals.reduce((a, b) => a + b, 0) / vals.length);
    }

    const knownYms = [...avgByYm.keys()].sort();
    const firstYm = knownYms[0];
    const lastYm = knownYms[knownYms.length - 1];
    const lastKnownPrice = avgByYm.get(lastYm)!;
    // 12개월 이상 거래 없으면 stale로 분류 → 최신 거래 아파트 아래로
    const stale = monthsStaleOf(lastYm) > 12;

    const months: { ts: number; price: number }[] = [];
    for (const ym of allMonths) {
      if (ym < firstYm) continue;
      const ts = new Date(ym + '-01').getTime();
      if (avgByYm.has(ym)) {
        months.push({ ts, price: avgByYm.get(ym)! });
      } else if (ym > lastYm) {
        months.push({ ts, price: lastKnownPrice });
      } else {
        const prevYm = knownYms.filter(k => k < ym).pop() ?? null;
        const nextYm = knownYms.find(k => k > ym) ?? null;
        if (prevYm && nextYm) {
          const t0 = new Date(prevYm + '-01').getTime();
          const t1 = new Date(nextYm + '-01').getTime();
          const p0 = avgByYm.get(prevYm)!;
          const p1 = avgByYm.get(nextYm)!;
          months.push({ ts, price: p0 + ((ts - t0) / (t1 - t0)) * (p1 - p0) });
        }
      }
    }

    if (months.length === 0) continue;
    const referencePrice = avgByYm.get(globalLatestYm) ?? lastKnownPrice;
    summaries.push({ aptNm, dong, latestPrice: referencePrice, months, stale });
  }

  // 최근 거래 아파트 먼저, 그 안에서 가격 DESC / stale은 뒤로
  summaries.sort((a, b) => {
    if (a.stale !== b.stale) return a.stale ? 1 : -1;
    return b.latestPrice - a.latestPrice;
  });

  const result: TopAptsResponse = {
    chart: summaries.slice(0, 10).map(({ aptNm, dong, months }) => ({ aptNm, dong, months })),
    table: summaries.map(({ aptNm, dong, latestPrice }) => ({ aptNm, dong, latestPrice })),
  };
  topAptsCache.set(gu, result);
  return result;
}

export interface UnusualTradeRecord {
  aptNm: string;
  gu: string;
  dong: string;
  area: number;
  date: string;
  price: number;
  floor: string;
  prevPrice: number;
}

const unusualTradesCache = new Map<string, UnusualTradeRecord[]>();

export function getUnusualTradesByGu(gu: string): UnusualTradeRecord[] {
  if (unusualTradesCache.has(gu)) return unusualTradesCache.get(gu)!;
  const index = loadTrades();

  let latestDateStr = '';
  for (const trades of index.values()) {
    for (const t of trades) {
      if (t.date > latestDateStr) latestDateStr = t.date;
    }
  }
  if (!latestDateStr) return [];

  const latestDate = new Date(latestDateStr);
  const thirtyDaysAgo = new Date(latestDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  const results: UnusualTradeRecord[] = [];

  for (const [key, trades] of index.entries()) {
    const parts = key.split('|');
    if (parts.length < 3 || parts[1] !== gu) continue;
    const aptNm = parts[0];
    const dong = parts[2];

    const byArea = new Map<number, TradeRecord[]>();
    for (const t of trades) {
      if (!byArea.has(t.area)) byArea.set(t.area, []);
      byArea.get(t.area)!.push(t);
    }

    for (const [area, areaTrades] of byArea.entries()) {
      if (areaTrades.length < 2) continue;
      const sorted = [...areaTrades].sort((a, b) => a.date.localeCompare(b.date));

      let best: { trade: TradeRecord; prevPrice: number } | null = null;

      for (let i = 1; i < sorted.length; i++) {
        const curr = sorted[i];
        const prev = sorted[i - 1];
        if (curr.date < thirtyDaysAgoStr) continue;
        if (prev.price <= 0) continue;
        const dropRatio = (prev.price - curr.price) / prev.price;
        if (dropRatio >= 0.05) {
          if (!best || curr.date > best.trade.date) {
            best = { trade: curr, prevPrice: prev.price };
          }
        }
      }

      if (best) {
        results.push({
          aptNm, gu, dong, area,
          date: best.trade.date,
          price: best.trade.price,
          floor: best.trade.floor,
          prevPrice: best.prevPrice,
        });
      }
    }
  }

  const sorted = results.sort((a, b) => b.date.localeCompare(a.date));
  unusualTradesCache.set(gu, sorted);
  return sorted;
}
