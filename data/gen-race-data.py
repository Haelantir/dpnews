"""
아파트 시세 레이스용 정적 JSON 생성.
collect.py 완료 후 자동 실행되거나 단독 실행 가능.

출력: public/data/race/{구}_{areaType}.json  (25구 × 3 = 75파일)
"""

import os
import json
import math
from collections import defaultdict

DATA_DIR = os.path.dirname(__file__)
OUT_DIR = os.path.join(DATA_DIR, '..', 'public', 'data', 'race')

YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026]

AREA_CONFIGS = {
    '59':   (59 * 0.9,  59 * 1.1),
    '84':   (84 * 0.9,  84 * 1.1),
    '100+': (100,       math.inf),
}

SEOUL_DISTRICTS = [
    '종로구','중구','용산구','성동구','광진구','동대문구','중랑구','성북구',
    '강북구','도봉구','노원구','은평구','서대문구','마포구','양천구','강서구',
    '구로구','금천구','영등포구','동작구','관악구','서초구','강남구','송파구','강동구',
]


def read_csv(path):
    with open(path, encoding='utf-8-sig') as f:
        lines = f.read().splitlines()
    if not lines:
        return []
    headers = lines[0].split(',')
    rows = []
    for line in lines[1:]:
        if not line.strip():
            continue
        vals = line.split(',')
        rows.append({h: (vals[i].strip() if i < len(vals) else '') for i, h in enumerate(headers)})
    return rows


def months_range(start_ym, end_ym):
    from datetime import datetime, timedelta
    cur = datetime.strptime(start_ym + '-01', '%Y-%m-%d')
    end = datetime.strptime(end_ym + '-01', '%Y-%m-%d')
    result = []
    while cur <= end:
        result.append(cur.strftime('%Y-%m'))
        if cur.month == 12:
            cur = cur.replace(year=cur.year + 1, month=1)
        else:
            cur = cur.replace(month=cur.month + 1)
    return result


def load_all_trades():
    """전체 거래 데이터 로드: {구: [(아파트명, 동, 면적, 가격, 계약일), ...]}"""
    by_gu = defaultdict(list)
    for year in YEARS:
        path = os.path.join(DATA_DIR, f'서울_실거래가_{year}.csv')
        if not os.path.exists(path):
            continue
        rows = read_csv(path)
        for r in rows:
            try:
                gu = r.get('구', '').strip()
                apt = r.get('아파트명', '').strip()
                dong = r.get('동', '').strip()
                area = float(r.get('전용면적(㎡)', '0') or '0')
                price_str = r.get('실거래가(만원)', '0').replace(',', '')
                price = float(price_str or '0')
                date = r.get('계약일', '').strip()
                if not (gu and apt and dong and area > 0 and price > 0 and len(date) == 10):
                    continue
                ym = date[:7]
                by_gu[gu].append((apt, dong, area, price, ym))
            except (ValueError, KeyError):
                continue
    return by_gu


def build_race_json(trades, area_type):
    """
    trades: [(아파트명, 동, 면적, 가격, ym), ...]
    반환: {months: [...], apts: {key: {dong, data: {ym: avg_price_per_m2}}}}
    """
    a_min, a_max = AREA_CONFIGS[area_type]

    # 아파트별 월별 가격/m2 수집
    apt_raw = defaultdict(lambda: defaultdict(list))
    all_yms = set()

    for apt, dong, area, price, ym in trades:
        if area < a_min or area > a_max:
            continue
        key = f'{apt}|{dong}'
        apt_raw[key]['dong'] = dong
        apt_raw[key]['yms'].append(ym)
        apt_raw[key][ym].append(price / area)
        all_yms.add(ym)

    if not all_yms:
        return None

    start_ym = '2020-01'
    end_ym = max(all_yms)
    months = months_range(start_ym, end_ym)

    apts = {}
    for key, raw in apt_raw.items():
        if not isinstance(raw, dict) or 'dong' not in raw:
            continue
        dong = raw['dong']
        monthly = {}
        for ym in months:
            if ym in raw and isinstance(raw[ym], list) and raw[ym]:
                vals = raw[ym]
                monthly[ym] = round(sum(vals) / len(vals), 1)
        if len(monthly) < 1:
            continue
        apts[key] = {'dong': dong, 'data': monthly}

    if not apts:
        return None

    return {'months': months, 'apts': apts}


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print('거래 데이터 로드 중...')
    by_gu = load_all_trades()

    total = 0
    for gu in SEOUL_DISTRICTS:
        trades = by_gu.get(gu, [])
        if not trades:
            print(f'  {gu}: 데이터 없음')
            continue
        for area_type in AREA_CONFIGS:
            result = build_race_json(trades, area_type)
            if result is None:
                continue
            safe_name = area_type.replace('+', 'plus')
            out_path = os.path.join(OUT_DIR, f'{gu}_{safe_name}.json')
            with open(out_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, separators=(',', ':'))
            total += 1
        print(f'  {gu}: 완료')

    print(f'\n총 {total}개 파일 생성 → {OUT_DIR}')


if __name__ == '__main__':
    main()
