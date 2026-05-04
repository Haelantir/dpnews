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
}

export function getNewHighsByGu(gu: string): NewHighRecord[] {
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
      const maxPrice = Math.max(...areaTrades.map(t => t.price));
      if (latest.price >= maxPrice) {
        results.push({ aptNm, gu, dong, area, date: latest.date, price: latest.price, floor: latest.floor });
      }
    }
  }

  return results.sort((a, b) => b.date.localeCompare(a.date));
}
