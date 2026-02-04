/**
 * 데이터셋 메타데이터
 * ID(dsid)와 서비스명(dataname) 매핑 정보
 */

/**
 * 데이터셋 메타데이터 객체
 * @typedef {Object} DatasetMetadata
 * @property {string} dsid - 데이터셋 ID
 * @property {string} dataname - 서비스명/데이터명
 * @property {string} provider - 제공기관명
 */

/**
 * 모든 데이터셋의 메타데이터
 * @type {Object<string, DatasetMetadata>}
 */
export const DATASET_METADATA = {
  // 질병관리청 감염병 포털
  ds_0101: {
    dsid: 'ds_0101',
    dataname: '인플루엔자 의사환자 비율',
    provider: '질병관리청 감염병 포털',
  },
  ds_0102: {
    dsid: 'ds_0102',
    dataname: '인플루엔자 유행단계',
    provider: '질병관리청 감염병 포털',
  },
  ds_0103: {
    dsid: 'ds_0103',
    dataname: '급성호흡기감염증 환자 중 인플루엔자 환자 수(ARI)',
    provider: '질병관리청 감염병 포털',
  },
  ds_0104: {
    dsid: 'ds_0104',
    dataname: '중증급성호흡기감염증 환자 중 인플루엔자 환자 수(SARI)',
    provider: '질병관리청 감염병 포털',
  },
  ds_0105: {
    dsid: 'ds_0105',
    dataname: '의원급 의료기관 인플루엔자 검출률(K-RISS)-아형별',
    provider: '질병관리청 감염병 포털',
  },
  ds_0106: {
    dsid: 'ds_0106',
    dataname: '의원급 의료기관 인플루엔자 검출률(K-RISS)-연령대별',
    provider: '질병관리청 감염병 포털',
  },
  ds_0107: {
    dsid: 'ds_0107',
    dataname: '검사기관 인플루엔자 검출률-아형별',
    provider: '질병관리청 감염병 포털',
  },
  ds_0108: {
    dsid: 'ds_0108',
    dataname: '검사기관 인플루엔자 검출률-연령대별',
    provider: '질병관리청 감염병 포털',
  },
  ds_0109: {
    dsid: 'ds_0109',
    dataname: '응급실 인플루엔자 환자 수(NEDIS)',
    provider: '질병관리청 감염병 포털',
  },
  ds_0110: {
    dsid: 'ds_0110',
    dataname: '인플루엔자 예방접종률-어르신',
    provider: '질병관리청 감염병 포털',
  },
  ds_0111: {
    dsid: 'ds_0111',
    dataname: '인플루엔자 예방접종률-어린이',
    provider: '질병관리청 감염병 포털',
  },

  // 보건의료빅데이터개방시스템
  ds_0201: {
    dsid: 'ds_0201',
    dataname: '의료통계정보-지역별 종별 의료인력(의사 등)',
    provider: '보건의료빅데이터개방시스템',
  },
  ds_0202: {
    dsid: 'ds_0202',
    dataname: '질병 세분류(4단 상병) 통계-성별/연령5세구간별',
    provider: '보건의료빅데이터개방시스템',
  },

  // 국가통계포털
  ds_0301: {
    dsid: 'ds_0301',
    dataname: '성별 및 연령별 인구와 인구밀도',
    provider: '국가통계포털',
  },

  // 통계지리정보서비스
  ds_0401: {
    dsid: 'ds_0401',
    dataname: '전국 지역별 인구밀도',
    provider: '통계지리정보서비스',
  },

  // 공공데이터 포털
  ds_0501: {
    dsid: 'ds_0501',
    dataname: '전국 응급의료기관 실시간 현황 정보',
    provider: '공공데이터 포털',
  },
  ds_0502: {
    dsid: 'ds_0502',
    dataname: '감염성질환(인플루엔자) 의료이용정보',
    provider: '공공데이터 포털',
  },
  ds_0503: {
    dsid: 'ds_0503',
    dataname: '대기오염 통계',
    provider: '공공데이터 포털',
  },
  ds_0504: {
    dsid: 'ds_0504',
    dataname: '국경일(국경일, 공휴일, 대체공유일) 정보',
    provider: '공공데이터 포털',
  },
  ds_0505: {
    dsid: 'ds_0505',
    dataname: '지점별 종관기상관측(ASOS) 시간자료 데이터',
    provider: '공공데이터 포털',
  },
  ds_0506: {
    dsid: 'ds_0506',
    dataname: '의약품사용정보',
    provider: '공공데이터 포털',
  },
  ds_0507: {
    dsid: 'ds_0507',
    dataname: '인플루엔자 시군구별 국가예방접종 현황',
    provider: '공공데이터 포털',
  },

  // WHO
  ds_0601: {
    dsid: 'ds_0601',
    dataname: 'flunet',
    provider: 'WHO',
  },

  // 외부 트렌드 데이터
  ds_0701: {
    dsid: 'ds_0701',
    dataname: '구글 트렌드',
    provider: '구글',
  },
  ds_0801: {
    dsid: 'ds_0801',
    dataname: '네이버 트렌드',
    provider: '네이버',
  },
  ds_0901: {
    dsid: 'ds_0901',
    dataname: 'X 트렌드',
    provider: 'X',
  },
};

/**
 * dsid로 데이터셋 메타데이터 조회
 * @param {string} dsid - 데이터셋 ID
 * @returns {DatasetMetadata|null} 메타데이터 또는 null
 */
export const getDatasetMetadata = (dsid) => {
  return DATASET_METADATA[dsid] || null;
};

/**
 * dsid로 데이터명(dataname) 조회
 * @param {string} dsid - 데이터셋 ID
 * @returns {string|null} 데이터명 또는 null
 */
export const getDatasetName = (dsid) => {
  const metadata = getDatasetMetadata(dsid);
  return metadata ? metadata.dataname : null;
};

/**
 * dsid로 제공기관명 조회
 * @param {string} dsid - 데이터셋 ID
 * @returns {string|null} 제공기관명 또는 null
 */
export const getDatasetProvider = (dsid) => {
  const metadata = getDatasetMetadata(dsid);
  return metadata ? metadata.provider : null;
};

/**
 * 모든 데이터셋 ID 목록 조회
 * @returns {string[]} 데이터셋 ID 배열
 */
export const getAllDatasetIds = () => {
  return Object.keys(DATASET_METADATA);
};

/**
 * 제공기관별로 데이터셋 그룹화
 * @returns {Object<string, DatasetMetadata[]>} 제공기관별 데이터셋 배열
 */
export const getDatasetsByProvider = () => {
  const grouped = {};
  Object.values(DATASET_METADATA).forEach((metadata) => {
    const provider = metadata.provider;
    if (!grouped[provider]) {
      grouped[provider] = [];
    }
    grouped[provider].push(metadata);
  });
  return grouped;
};
