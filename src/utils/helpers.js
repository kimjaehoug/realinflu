/**
 * 주소 문자열에서 시/도(stage1), 시/군/구(stage2) 추출
 * @param {string} address - 전체 주소
 * @returns {{ stage1?: string, stage2?: string }}
 */
export function parseAddressToStage(address) {
  if (!address || typeof address !== 'string') return { stage1: '', stage2: '' };
  const trimmed = address.trim();
  if (!trimmed) return { stage1: '', stage2: '' };

  const stage1Map = {
    서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천',
    광주광역시: '광주', 대전광역시: '대전', 울산광역시: '울산', 세종특별자치시: '세종',
    경기도: '경기', 강원도: '강원', 충청북도: '충북', 충청남도: '충남',
    전라북도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남',
    제주특별자치도: '제주', 제주도: '제주'
  };

  let stage1 = '';
  let stage2 = '';

  for (const [full, short] of Object.entries(stage1Map)) {
    if (trimmed.startsWith(full)) {
      stage1 = short;
      const rest = trimmed.slice(full.length).trim();
      const spaceIdx = rest.indexOf(' ');
      if (spaceIdx > 0) {
        stage2 = rest.slice(0, spaceIdx).trim();
      } else if (rest) {
        stage2 = rest;
      }
      break;
    }
  }

  if (!stage1 && trimmed) {
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 1) stage1 = parts[0].replace(/시|도|광역시|특별시|특별자치시|특별자치도$/g, '').trim() || parts[0];
    if (parts.length >= 2) stage2 = parts[1];
  }

  const stage3 = '';
  return { stage1, stage2, stage3 };
}

/**
 * 날짜 포맷 (HVI 등 표시용)
 * @param {string} isoString - ISO 날짜 문자열
 * @returns {string}
 */
export function formatHvidate(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    return String(isoString);
  }
}

/**
 * 병상 통계 더미/폴백 데이터 생성
 * @returns {{ body: { data: object } }}
 */
export function generateBedStatsData() {
  return {
    body: {
      data: {
        totalBeds: 501,
        emergencyTotal: 30,
        inpatientTotal: 471,
        availableBeds: 120,
        occupiedBeds: 350,
        cleaningBeds: 31,
      },
    },
  };
}

/**
 * 병상 통계로 그리드 표시용 배열 생성
 * @param {object} stats - 병상 통계 객체
 * @returns {Array}
 */
export function generateBedGridFromStats(stats) {
  if (!stats) return [];
  const total = stats.totalBeds || 0;
  const rows = [];
  const cols = 10;
  for (let i = 0; i < Math.min(total, 100); i++) {
    rows.push({
      id: `bed-${i + 1}`,
      label: `${i + 1}`,
      status: i % 3 === 0 ? 'available' : i % 3 === 1 ? 'occupied' : 'cleaning',
    });
  }
  return rows;
}
