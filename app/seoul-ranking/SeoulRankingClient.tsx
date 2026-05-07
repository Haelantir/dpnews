'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type AreaType = '59' | '84' | '100+';

interface RankItem {
  aptNm: string;
  gu: string;
  dong: string;
  latestPrice: number;
}

interface FilterData {
  구s: string[];
  동s: Record<string, string[]>;
  아파트s: Record<string, string[]>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AREA_LABELS: Record<AreaType, string> = { '59': '59㎡', '84': '84㎡', '100+': '100㎡ 이상' };
const PRICE_THRESHOLDS = [7000, 6000, 5000, 4000, 3000, 2000, 1000];

// ── Select component ──────────────────────────────────────────────────────────

function Select({ value, onChange, options, placeholder, disabled }: {
  value: string; onChange: (v: string) => void;
  options: string[]; placeholder: string; disabled: boolean;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      style={{
        width: '100%', height: 36, padding: '0 8px',
        border: '1px solid #333',
        background: disabled ? '#f5f5f5' : '#fff',
        color: disabled ? '#aaa' : '#111',
        fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer', appearance: 'auto',
        fontFamily: 'inherit',
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SeoulRankingClient() {
  const [areaType, setAreaType] = useState<AreaType>('84');
  const [loading, setLoading] = useState(true);
  const [tableData, setTableData] = useState<RankItem[]>([]);
  const [filterData, setFilterData] = useState<FilterData | null>(null);

  // "내 아파트 순위보기" state
  const [searchGu, setSearchGu] = useState('');
  const [searchDong, setSearchDong] = useState('');
  const [searchApt, setSearchApt] = useState('');
  // null = 아직 검색 안 함, 0 = 못 찾음, n (>=1) = 순위
  const [myRank, setMyRank] = useState<number | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());

  useEffect(() => {
    fetch('/api/filter-data').then(r => r.json()).then(setFilterData);
  }, []);

  const fetchRanking = useCallback(async (at: AreaType) => {
    setLoading(true);
    setTableData([]);
    rowRefs.current.clear();
    try {
      const res = await fetch(`/api/seoul-ranking?areaType=${encodeURIComponent(at)}`);
      const data: RankItem[] = await res.json();
      setTableData(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRanking('84'); }, [fetchRanking]);

  const handleAreaType = (at: AreaType) => {
    if (at === areaType) return;
    setAreaType(at);
    setMyRank(null);
    fetchRanking(at);
  };

  // 아파트 선택 시 순위 탐색 + 스크롤
  useEffect(() => {
    if (!searchApt || !searchGu || !searchDong || tableData.length === 0) {
      if (!searchApt) setMyRank(null);
      return;
    }
    const idx = tableData.findIndex(
      d => d.aptNm === searchApt && d.gu === searchGu && d.dong === searchDong,
    );
    if (idx >= 0) {
      setMyRank(idx + 1);
      setTimeout(() => {
        const container = tableContainerRef.current;
        const row = rowRefs.current.get(idx);
        if (!container || !row) return;
        const containerRect = container.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const relTop = rowRect.top - containerRect.top + container.scrollTop;
        const target = relTop - container.clientHeight / 2 + row.clientHeight / 2;
        container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
      }, 80);
    } else {
      setMyRank(0);
    }
  }, [searchApt, searchGu, searchDong, tableData]);

  const handleGuChange = (v: string) => {
    setSearchGu(v); setSearchDong(''); setSearchApt(''); setMyRank(null);
  };
  const handleDongChange = (v: string) => {
    setSearchDong(v); setSearchApt(''); setMyRank(null);
  };
  const handleAptChange = (v: string) => { setSearchApt(v); };

  const dongs = searchGu && filterData ? (filterData.동s[searchGu] ?? []) : [];
  const apts = searchGu && searchDong && filterData
    ? (filterData.아파트s[`${searchGu}|${searchDong}`] ?? []) : [];

  // 테이블 행 렌더링 (경계선 포함)
  const renderRows = () => {
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < tableData.length; i++) {
      const apt = tableData[i];
      const isMyApt = myRank !== null && myRank > 0 && myRank - 1 === i;

      // 경계선 삽입
      if (i > 0) {
        const prevPrice = tableData[i - 1].latestPrice;
        const currPrice = apt.latestPrice;
        for (const threshold of PRICE_THRESHOLDS) {
          if (prevPrice >= threshold && currPrice < threshold) {
            elements.push(
              <tr key={`boundary-${threshold}`}>
                <td
                  colSpan={5}
                  style={{
                    background: '#ffe4e6',
                    color: '#be185d',
                    fontSize: 11,
                    fontWeight: 600,
                    textAlign: 'center',
                    padding: '3px 8px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {threshold.toLocaleString()}만원/㎡ 경계선
                </td>
              </tr>,
            );
          }
        }
      }

      elements.push(
        <tr
          key={`${apt.aptNm}|${apt.gu}|${apt.dong}|${i}`}
          ref={el => {
            if (el) rowRefs.current.set(i, el);
            else rowRefs.current.delete(i);
          }}
          style={{
            borderBottom: '1px solid #eee',
            background: isMyApt ? '#dcfce7' : undefined,
          }}
        >
          <td className="srt-rank" style={{ padding: '6px 8px', color: '#888', fontSize: 12, whiteSpace: 'nowrap' }}>
            {i + 1}
          </td>
          <td style={{ padding: '6px 8px' }}>
            {apt.aptNm}
          </td>
          <td className="srt-gu" style={{ padding: '6px 8px', color: '#555', whiteSpace: 'nowrap' }}>
            {apt.gu}
          </td>
          <td className="srt-dong" style={{ padding: '6px 8px', color: '#555', whiteSpace: 'nowrap' }}>
            {apt.dong}
          </td>
          <td className="srt-price" style={{ padding: '6px 8px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(apt.latestPrice)}
          </td>
        </tr>,
      );
    }

    return elements;
  };

  return (
    <div className="page-wrap">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: 0, marginBottom: 6 }}>
          서울 아파트값 순위
        </h1>
        <p style={{ fontSize: 13, color: '#999', margin: 0 }}>
          서울 전체 아파트를 ㎡당 단가 기준으로 순위를 매겼습니다. 최신 거래 기준이며 모든 면적은 전용면적입니다.
        </p>
      </div>

      {/* 면적 선택 버튼 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 }}>
        {(['59', '84', '100+'] as AreaType[]).map(at => (
          <button
            key={at}
            onClick={() => handleAreaType(at)}
            style={{
              height: 36, padding: '0 8px',
              border: `1px solid ${areaType === at ? '#111' : '#aaa'}`,
              background: areaType === at ? '#111' : '#fff',
              color: areaType === at ? '#fff' : '#555',
              fontSize: 13, cursor: 'pointer', appearance: 'none',
              fontFamily: 'inherit', fontWeight: areaType === at ? 700 : 400,
            }}
          >
            {AREA_LABELS[at]}
          </button>
        ))}
        <div /><div />
      </div>

      {/* 내 아파트 순위보기 */}
      <div style={{
        border: '1px solid #e5e7eb', borderRadius: 4,
        padding: '14px 16px', marginBottom: 24, background: '#fafafa',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 12 }}>
          내 아파트 순위보기
        </div>
        <div className="seoul-rank-search-grid">
          <Select
            value={searchGu}
            onChange={handleGuChange}
            options={filterData?.구s ?? []}
            placeholder="구 선택"
            disabled={!filterData}
          />
          <Select
            value={searchDong}
            onChange={handleDongChange}
            options={dongs}
            placeholder="동 선택"
            disabled={!searchGu}
          />
          <Select
            value={searchApt}
            onChange={handleAptChange}
            options={apts}
            placeholder="아파트 선택"
            disabled={!searchDong}
          />
        </div>
        {myRank !== null && myRank > 0 && (
          <div style={{ marginTop: 12, fontSize: 15, fontWeight: 700, color: '#dc2626' }}>
            서울 {AREA_LABELS[areaType]} 기준 {myRank.toLocaleString()}위
          </div>
        )}
        {myRank === 0 && (
          <div style={{ marginTop: 12, fontSize: 13, color: '#888' }}>
            해당 평형의 거래 데이터를 찾을 수 없습니다.
          </div>
        )}
      </div>

      {/* 테이블 */}
      <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
        서울 전체 {tableData.length.toLocaleString()}개 아파트 · {AREA_LABELS[areaType]} 기준 최신 거래 ㎡당 단가 순위
      </div>

      {loading ? (
        <div style={{ color: '#888', fontSize: 13 }}>불러오는 중...</div>
      ) : (
        <div ref={tableContainerRef} style={{ overflowY: 'auto', overflowX: 'auto', maxHeight: 640 }}>
          <table
            className="seoul-rank-table"
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
          >
            <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <tr>
                {(
                  [
                    ['순위', 'srt-rank'],
                    ['아파트명', ''],
                    ['구', 'srt-gu'],
                    ['동', 'srt-dong'],
                    ['만원/㎡', 'srt-price'],
                  ] as [string, string][]
                ).map(([h, cls]) => (
                  <th
                    key={h}
                    className={cls}
                    style={{
                      padding: '6px 8px', textAlign: 'left', fontWeight: 700,
                      whiteSpace: 'nowrap', borderBottom: '2px solid #111',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{renderRows()}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
