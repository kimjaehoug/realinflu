import apiClient from './config';

/**
 * 자동수집 데이터중 특정 id의 최근 n건 데이터 조회
 * @param {string} dsid - 데이터셋 ID
 * @param {number} cnt - 조회할 데이터 건수
 * @returns {Promise} 최근 데이터
 */
export const getRecentETLData = async (dsid, cnt) => {
  try {
    const response = await apiClient.get(`/etl_data/id/${dsid}/recent/${cnt}`);
    return response.data;
  } catch (error) {
    console.error(`ETL 데이터 조회 실패 (dsid: ${dsid}, cnt: ${cnt}):`, error);
    throw error;
  }
};

/**
 * 자동수집 데이터중 특정 id의 특정 기간 데이터 조회
 * @param {string} dsid - 데이터셋 ID
 * @param {string} from - 시작 날짜 (YYYY-MM-DD 형식)
 * @param {string} to - 종료 날짜 (YYYY-MM-DD 형식)
 * @returns {Promise} 기간별 데이터
 */
export const getETLDataByDateRange = async (dsid, from, to) => {
  try {
    const response = await apiClient.get(`/etl_data/id/${dsid}/from/${from}/to/${to}`);
    return response.data;
  } catch (error) {
    console.error(`ETL 데이터 조회 실패 (dsid: ${dsid}, from: ${from}, to: ${to}):`, error);
    throw error;
  }
};

/**
 * 자동수집 데이터중 id별 총 데이터 수 조회
 * @returns {Promise} 통계 데이터
 */
export const getETLDataStatistics = async () => {
  try {
    const response = await apiClient.get('/etl_data/statistics');
    return response.data;
  } catch (error) {
    console.error('ETL 데이터 통계 조회 실패:', error);
    throw error;
  }
};

/**
 * 자동수집 데이터중 id별 특정 기간내 총 데이터 수 조회
 * @param {string} from - 시작 날짜 (YYYY-MM-DD 형식)
 * @param {string} to - 종료 날짜 (YYYY-MM-DD 형식)
 * @returns {Promise} 기간별 통계 데이터
 */
export const getETLDataStatisticsByDateRange = async (from, to) => {
  try {
    const response = await apiClient.get(`/etl_data/statistics/from/${from}/to/${to}`);
    return response.data;
  } catch (error) {
    console.error(`ETL 데이터 통계 조회 실패 (from: ${from}, to: ${to}):`, error);
    throw error;
  }
};


