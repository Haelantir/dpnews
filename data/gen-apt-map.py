#!/usr/bin/env python3
"""
apt-map.json 생성 스크립트
서울_아파트_목록_좌표포함.csv + 실거래가 CSV → public/data/apt-map.json

각 아파트(좌표 있는)의 면적 타입별(59/84/100+) 최신 실거래가와 날짜를 포함.
클라이언트에서 슬라이더 가격 범위 + 지난 30일 필터링에 사용.
"""

import csv, json, os, sys
from datetime import datetime

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DATA_DIR = os.path.join(DATA_DIR, '..', 'public', 'data')
OUT_FILE = os.path.join(PUBLIC_DATA_DIR, 'apt-map.json')

AREA_RANGES = {
    '59':  (53.1, 64.9),
    '84':  (75.6, 92.4),
    '100': (100.0, float('inf')),
}


def read_csv(path: str) -> list[dict]:
    with open(path, encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))


def main():
    # ── 좌표 로드 ──────────────────────────────────────────────────
    coord_rows = read_csv(os.path.join(DATA_DIR, '서울_아파트_목록_좌표포함.csv'))
    coords: dict[tuple, tuple] = {}
    for r in coord_rows:
        if r.get('위도') and r.get('경도'):
            try:
                lat = float(r['위도'])
                lng = float(r['경도'])
                # 서울 범위 밖 좌표 제외
                if not (37.40 <= lat <= 37.72 and 126.73 <= lng <= 127.23):
                    continue
                coords[(r['아파트명'], r['구'], r['동'])] = (lat, lng)
            except (ValueError, TypeError):
                pass

    print(f'좌표 있는 아파트: {len(coords)}개')

    # ── 실거래가 로드 (전체 연도) ──────────────────────────────────
    # key: (aptNm, gu, dong, area_type) → (price, date)  최신 거래
    trades: dict[tuple, tuple] = {}

    for year in range(2020, 2027):
        path = os.path.join(DATA_DIR, f'서울_실거래가_{year}.csv')
        if not os.path.exists(path):
            continue
        for r in read_csv(path):
            base_key = (r.get('아파트명', ''), r.get('구', ''), r.get('동', ''))
            if base_key not in coords:
                continue
            try:
                area = float(r['전용면적(㎡)'])
                price = int(float(r['실거래가(만원)']))
                date = r['계약일'].strip()
                if not date or price <= 0:
                    continue
            except (ValueError, TypeError, KeyError):
                continue

            at = None
            for at_name, (lo, hi) in AREA_RANGES.items():
                if lo <= area <= hi:
                    at = at_name
                    break
            if at is None:
                continue

            key = base_key + (at,)
            existing = trades.get(key)
            if existing is None or date > existing[1]:
                trades[key] = (price, date)

    # ── 아파트별 데이터 병합 ────────────────────────────────────────
    dots = []
    for (aptNm, gu, dong), (lat, lng) in coords.items():
        entry: dict = {
            'lat': round(lat, 5),
            'lng': round(lng, 5),
        }
        for at in ('59', '84', '100'):
            key = (aptNm, gu, dong, at)
            if key in trades:
                price, date = trades[key]
                entry[at] = [price, date]

        if any(at in entry for at in ('59', '84', '100')):
            dots.append(entry)

    print(f'지도 dot 아파트: {len(dots)}개')

    # ── 출력 ──────────────────────────────────────────────────────
    os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)
    out = {
        'gen': datetime.now().strftime('%Y-%m-%d'),
        'd': dots,
    }
    with open(OUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))

    size_kb = os.path.getsize(OUT_FILE) / 1024
    print(f'생성 완료: {OUT_FILE} ({size_kb:.0f} KB)')


if __name__ == '__main__':
    main()
