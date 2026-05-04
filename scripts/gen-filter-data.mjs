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

const coordRows = readCSV(path.join(ROOT, 'data', '서울_아파트_목록_좌표포함.csv'))
  .filter(r => r['위도'] && r['경도']);

const guSet = new Set();
const dongMap = {};
for (const r of coordRows) {
  guSet.add(r['구']);
  if (!dongMap[r['구']]) dongMap[r['구']] = new Set();
  dongMap[r['구']].add(r['동']);
}

const aptRows = readCSV(path.join(ROOT, 'data', '서울_아파트_목록.csv'));
const aptMap = {};
for (const r of aptRows) {
  const key = `${r['구']}|${r['동']}`;
  if (!aptMap[key]) aptMap[key] = new Set();
  aptMap[key].add(r['아파트명']);
}

const result = {
  구s: [...guSet].sort((a, b) => a.localeCompare(b, 'ko')),
  동s: Object.fromEntries(Object.entries(dongMap).map(([g, s]) => [g, [...s].sort((a,b)=>a.localeCompare(b,'ko'))])),
  아파트s: Object.fromEntries(Object.entries(aptMap).map(([k, s]) => [k, [...s].sort((a,b)=>a.localeCompare(b,'ko'))])),
};

const outPath = path.join(ROOT, 'lib', 'filter-data.json');
fs.writeFileSync(outPath, JSON.stringify(result));
console.log(`✓ filter-data.json 생성: 구 ${result.구s.length}개, 동 ${Object.keys(result.동s).length}개`);
