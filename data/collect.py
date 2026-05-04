import requests
import xml.etree.ElementTree as ET
import pandas as pd
import numpy as np
from datetime import datetime
import os
import time
import json

SERVICE_KEY = "451484086586a28fc9ac26724a24e8a16f574b724d09b8a0eb1b262ffdfc8c39"
START_YM = "202001"
DATA_DIR = os.path.dirname(__file__)
CHECKPOINT_PATH = os.path.join(DATA_DIR, ".checkpoint.json")

BASE_URL = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev"

COLUMNS = ["아파트명", "구", "동", "준공년도", "전용면적(㎡)", "실거래가(만원)", "층수", "계약일"]

SEOUL_DISTRICT_CODES = {
    "종로구": "11110", "중구":    "11140", "용산구":   "11170", "성동구":  "11200",
    "광진구": "11215", "동대문구": "11230", "중랑구":   "11260", "성북구":  "11290",
    "강북구": "11305", "도봉구":  "11320", "노원구":   "11350", "은평구":  "11380",
    "서대문구":"11410", "마포구":  "11440", "양천구":   "11470", "강서구":  "11500",
    "구로구": "11530", "금천구":  "11545", "영등포구":  "11560", "동작구":  "11590",
    "관악구": "11620", "서초구":  "11650", "강남구":   "11680", "송파구":  "11710",
    "강동구": "11740",
}


def csv_path(year: int) -> str:
    return os.path.join(DATA_DIR, f"서울_실거래가_{year}.csv")


def months_range(start_ym: str, end_ym: str) -> list[str]:
    cur = datetime.strptime(start_ym + "01", "%Y%m%d")
    end = datetime.strptime(end_ym + "01", "%Y%m%d")
    months = []
    while cur <= end:
        months.append(cur.strftime("%Y%m"))
        if cur.month == 12:
            cur = cur.replace(year=cur.year + 1, month=1)
        else:
            cur = cur.replace(month=cur.month + 1)
    return months


def fetch_month(lawd_cd: str, ym: str, retries: int = 3) -> list[dict]:
    page = 1
    items_all = []
    while True:
        params = {
            "serviceKey": SERVICE_KEY,
            "LAWD_CD": lawd_cd,
            "DEAL_YMD": ym,
            "pageNo": page,
            "numOfRows": 100,
        }
        for attempt in range(retries):
            try:
                resp = requests.get(BASE_URL, params=params, timeout=15)
                root = ET.fromstring(resp.content)

                # header가 response 하위에 있는 경우와 루트에 있는 경우 모두 처리
                code = root.findtext("header/resultCode") or root.findtext("resultCode")
                if code is None:
                    # 응답 구조 확인용
                    print(f"    [경고] 응답 파싱 실패 (attempt {attempt+1}): {resp.content[:300]}", flush=True)
                    if attempt < retries - 1:
                        time.sleep(2 ** attempt)
                        continue
                    return items_all  # 실패 시 빈 결과로 넘어감

                if code != "000":
                    msg = root.findtext("header/resultMsg") or root.findtext("resultMsg") or ""
                    # 일시적 오류면 재시도
                    if attempt < retries - 1 and code in ("500", "999", "03"):
                        time.sleep(2 ** attempt)
                        continue
                    print(f"    [API 오류 {code}] {msg} — 건너뜀", flush=True)
                    return items_all

                items = root.findall("body/items/item")
                if not items:
                    return items_all

                for item in items:
                    def g(tag):
                        return (item.findtext(tag) or "").strip()
                    items_all.append({
                        "aptNm":      g("aptNm"),
                        "umdNm":      g("umdNm"),
                        "excluUseAr": g("excluUseAr"),
                        "dealAmount": g("dealAmount"),
                        "floor":      g("floor"),
                        "dealYear":   g("dealYear"),
                        "dealMonth":  g("dealMonth"),
                        "dealDay":    g("dealDay"),
                        "buildYear":  g("buildYear"),
                        "cdealType":  g("cdealType"),
                    })

                total = int(root.findtext("body/totalCount") or 0)
                if page * 100 >= total:
                    return items_all
                page += 1
                break  # 페이지 성공, 다음 페이지로
            except (requests.RequestException, ET.ParseError) as e:
                if attempt < retries - 1:
                    print(f"    [재시도 {attempt+1}] {e}", flush=True)
                    time.sleep(2 ** attempt)
                else:
                    print(f"    [실패] {ym} {lawd_cd}: {e} — 건너뜀", flush=True)
                    return items_all

    return items_all


def rows_to_df(raw: list[dict]) -> pd.DataFrame:
    if not raw:
        return pd.DataFrame(columns=COLUMNS)

    df = pd.DataFrame(raw)
    df = df[df["cdealType"].str.strip() == ""].copy()

    df["계약일"] = pd.to_datetime(
        df["dealYear"] + df["dealMonth"].str.zfill(2) + df["dealDay"].str.zfill(2),
        format="%Y%m%d", errors="coerce",
    )
    df = df[df["계약일"].notna()].copy()

    df["전용면적(㎡)"] = pd.to_numeric(df["excluUseAr"], errors="coerce").apply(
        lambda x: int(np.floor(x)) if pd.notna(x) else pd.NA
    ).astype("Int64")
    df["실거래가(만원)"] = df["dealAmount"].str.replace(",", "", regex=False).str.strip()
    df["준공년도"] = df["buildYear"].where(df["buildYear"] != "", None)

    result = df[["aptNm", "구", "umdNm", "준공년도", "전용면적(㎡)", "실거래가(만원)", "floor", "계약일"]].copy()
    result.columns = COLUMNS
    return result


def append_to_year_csvs(df: pd.DataFrame):
    """DataFrame을 연도별 CSV에 추가 저장 (기존 내용에 append)."""
    if df.empty:
        return
    for year, df_year in df.groupby(df["계약일"].dt.year):
        path = csv_path(year)
        write_header = not os.path.exists(path)
        df_year.to_csv(path, mode="a", index=False, header=write_header, encoding="utf-8-sig")


def load_checkpoint() -> dict:
    if os.path.exists(CHECKPOINT_PATH):
        with open(CHECKPOINT_PATH) as f:
            return json.load(f)
    return {}


def save_checkpoint(data: dict):
    with open(CHECKPOINT_PATH, "w") as f:
        json.dump(data, f)


def fetch_full(months: list[str], start_from_gu: str = None):
    """구 단위로 처리하고 체크포인트 저장."""
    district_list = list(SEOUL_DISTRICT_CODES.items())
    skip = start_from_gu is not None

    for gu, code in district_list:
        if skip:
            if gu == start_from_gu:
                skip = False
            else:
                continue

        print(f"\n[{gu}] {len(months)}개월 조회 중...", flush=True)
        raw = []
        for i, ym in enumerate(months):
            print(f"  {ym} ({i+1}/{len(months)})", flush=True)
            rows = fetch_month(code, ym)
            for r in rows:
                r["구"] = gu
            raw.extend(rows)
            time.sleep(0.1)  # 호출 간격

        df_gu = rows_to_df(raw)
        if not df_gu.empty:
            append_to_year_csvs(df_gu)
            print(f"  → {len(df_gu):,}건 저장", flush=True)

        save_checkpoint({"last_completed_gu": gu, "months": months})

    # 완료 후 각 연도 CSV 정렬
    print("\n연도별 정렬 중...", flush=True)
    for year in range(int(months[0][:4]), int(months[-1][:4]) + 1):
        path = csv_path(year)
        if os.path.exists(path):
            df = pd.read_csv(path, parse_dates=["계약일"])
            df = df.sort_values(["구", "동", "아파트명", "전용면적(㎡)", "계약일"]).reset_index(drop=True)
            df.to_csv(path, index=False, encoding="utf-8-sig")
            print(f"  {year}년: {len(df):,}건", flush=True)


def main():
    today = datetime.today()
    end_ym = today.strftime("%Y%m")

    existing_years = sorted([
        int(f[8:12]) for f in os.listdir(DATA_DIR)
        if f.startswith("서울_실거래가_") and f.endswith(".csv") and f[8:12].isdigit()
    ])

    checkpoint = load_checkpoint()

    if existing_years and not checkpoint:
        # 일반 증분 업데이트
        latest_year = max(existing_years)
        df_latest = pd.read_csv(csv_path(latest_year), parse_dates=["계약일"])
        last_ym = df_latest["계약일"].max().strftime("%Y%m")
        fetch_months = months_range(last_ym, end_ym)
        cutoff = pd.Timestamp(last_ym + "01")
        print(f"기존 데이터({existing_years}) 발견. {last_ym}월부터 재조회 ({len(fetch_months)}개월)...")

        # 재조회 범위 연도의 기존 데이터에서 해당 월 이후 제거
        affected_years = sorted(set(
            int(ym[:4]) for ym in fetch_months
        ))
        for year in affected_years:
            path = csv_path(year)
            if os.path.exists(path):
                df_year = pd.read_csv(path, parse_dates=["계약일"])
                df_year = df_year[df_year["계약일"] < cutoff]
                df_year.to_csv(path, index=False, encoding="utf-8-sig")
                # append 모드를 위해 헤더 포함 재작성

        fetch_full(fetch_months)

    elif checkpoint:
        # 이전 실행 이어서
        last_gu = checkpoint.get("last_completed_gu")
        months = checkpoint.get("months")
        district_list = list(SEOUL_DISTRICT_CODES.keys())
        idx = district_list.index(last_gu) + 1 if last_gu in district_list else 0
        next_gu = district_list[idx] if idx < len(district_list) else None

        if next_gu is None:
            print("체크포인트: 모든 구 완료. 체크포인트 삭제.")
            os.remove(CHECKPOINT_PATH)
        else:
            print(f"체크포인트 재개: {next_gu}부터 ({months[0]}~{months[-1]})")
            fetch_full(months, start_from_gu=next_gu)
            os.remove(CHECKPOINT_PATH)

    else:
        # 초기 전체 로드
        fetch_months = months_range(START_YM, end_ym)
        print(f"CSV 없음 — 전체 초기 로드 ({START_YM}~{end_ym}, {len(fetch_months)}개월)")
        fetch_full(fetch_months)
        if os.path.exists(CHECKPOINT_PATH):
            os.remove(CHECKPOINT_PATH)

    print("\n완료")


if __name__ == "__main__":
    main()
