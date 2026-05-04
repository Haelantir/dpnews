// 빌드 전에 실행: 좌표/아파트 CSV → lib/filter-data.json 생성
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function parseLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
    else cur += c;
  }
  result.push(cur);
  return result;
}

function readCSV(fp) {
  const text = fs.readFileSync(fp, 'utf-8').replace(/^﻿/, '').replace(/\r/g, '');
  const lines = text.split('\n').filter(l => l.trim());
  const headers = parseLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]));
  });
}

// ── 1. 거래 건수 집계 (아파트명|구|동 기준) ──────────────────────────────────
const tradeCountMap = {};
const areasMap = {};
const tradeYears = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

for (const year of tradeYears) {
  const fp = path.join(ROOT, 'data', `서울_실거래가_${year}.csv`);
  if (!fs.existsSync(fp)) continue;
  const rows = readCSV(fp);
  for (const r of rows) {
    const key = `${r['아파트명']}|${r['구']}|${r['동']}`;
    tradeCountMap[key] = (tradeCountMap[key] || 0) + 1;
    const area = parseFloat(r['전용면적(㎡)']);
    if (!r['전용면적(㎡)'] || isNaN(area)) continue;
    if (!areasMap[key]) areasMap[key] = new Set();
    areasMap[key].add(area);
  }
}

// 거래 10건 이하 제외
const MIN_TRADES = 10;
const validKeys = new Set(Object.keys(tradeCountMap).filter(k => tradeCountMap[k] > MIN_TRADES));

// ── 2. 좌표 CSV → 구/동/아파트s/coords (유효 키만) ───────────────────────────
const coordRows = readCSV(path.join(ROOT, 'data', '서울_아파트_목록_좌표포함.csv'))
  .filter(r => r['위도'] && r['경도']);

const guSet = new Set();
const dongMap = {};
const aptMap = {};
const coords = {};

for (const r of coordRows) {
  const coordKey = `${r['아파트명']}|${r['구']}|${r['동']}`;
  if (!validKeys.has(coordKey)) continue;   // 거래 10건 이하 제외

  guSet.add(r['구']);
  if (!dongMap[r['구']]) dongMap[r['구']] = new Set();
  dongMap[r['구']].add(r['동']);

  const dongKey = `${r['구']}|${r['동']}`;
  if (!aptMap[dongKey]) aptMap[dongKey] = new Set();
  aptMap[dongKey].add(r['아파트명']);

  coords[coordKey] = { lat: parseFloat(r['위도']), lng: parseFloat(r['경도']) };
}

const result = {
  구s: [...guSet].sort((a, b) => a.localeCompare(b, 'ko')),
  동s: Object.fromEntries(Object.entries(dongMap).map(([g, s]) => [g, [...s].sort((a,b)=>a.localeCompare(b,'ko'))])),
  아파트s: Object.fromEntries(Object.entries(aptMap).map(([k, s]) => [k, [...s].sort((a,b)=>a.localeCompare(b,'ko'))])),
  coords,
};

const outPath = path.join(ROOT, 'lib', 'filter-data.json');
fs.writeFileSync(outPath, JSON.stringify(result));
const aptTotal = Object.values(result.아파트s).reduce((s, a) => s + a.length, 0);
console.log(`✓ filter-data.json 생성: 구 ${result.구s.length}개, 아파트 ${aptTotal}개 (10건 이하 제외)`);

// ── 3. areas-index.json (유효 키만) ─────────────────────────────────────────
const areasResult = Object.fromEntries(
  Object.entries(areasMap)
    .filter(([k]) => validKeys.has(k))
    .map(([k, s]) => [k, [...s].sort((a, b) => a - b)])
);
const areasOutPath = path.join(ROOT, 'lib', 'areas-index.json');
fs.writeFileSync(areasOutPath, JSON.stringify(areasResult));
console.log(`✓ areas-index.json 생성: ${Object.keys(areasResult).length}개 아파트`);
