import { useState, useEffect } from 'react';
import { getETLDataByDateRange } from '../api/etlDataApi';
import { getDateRangeFromSeason } from '../utils/dateUtils';
import { processETLData } from '../utils/dataProcessors';
import { loadHistoricalCSVData, convertCSVToETLFormat } from '../utils/csvDataLoader';

// 기본 더미 데이터
const defaultIliWeeks = ['37주', '38주', '39주', '40주', '41주', '42주', '43주', '44주'];
const defaultIliValues = [10.5, 12.3, 14.8, 17.2, 19.5, 15.3, 18.7, 22.8];

const defaultAriWeeks = ['34주', '35주', '36주', '37주'];
const defaultAriValues = [18, 23, 28, 34];

const defaultSariWeeks = ['34주', '35주', '36주', '37주'];
const defaultSariValues = [8, 5, 4, 3];

const defaultIrissWeeks = ['37주', '38주', '39주', '40주', '41주', '42주'];
const defaultIrissValues = [2.4, 3.1, 4.2, 5.6, 6.9, 7.8];

const defaultKrissWeeks = ['40주', '41주', '42주', '43주'];
const defaultKrissValues = [3.5, 5.1, 6.8, 9.7];

const defaultNedisWeeks = ['40주', '41주', '42주', '43주'];
const defaultNedisValues = [456, 623, 892, 1231];

const defaultInfluenzaData = {
  ili: { weeks: defaultIliWeeks, values: defaultIliValues },
  ari: { weeks: defaultAriWeeks, values: defaultAriValues },
  sari: { weeks: defaultSariWeeks, values: defaultSariValues },
  iriss: { weeks: defaultIrissWeeks, values: defaultIrissValues },
  kriss: { weeks: defaultKrissWeeks, values: defaultKrissValues },
  nedis: { weeks: defaultNedisWeeks, values: defaultNedisValues },
};

/**
 * 인플루엔자 데이터를 가져오는 커스텀 훅
 * @param {string} selectedSeason - 선택된 절기 (예: '25/26')
 * @param {string} selectedWeek - 선택된 주차 (예: '37')
 * @param {string} dsid - 데이터셋 ID (기본값: 'ds_0101')
 * @returns {Object} {influenzaData, loading, error}
 */
export const useInfluenzaData = (selectedSeason, selectedWeek, dsid = 'ds_0101') => {
  const [influenzaData, setInfluenzaData] = useState(defaultInfluenzaData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInfluenzaData = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1. CSV 데이터 로드 (2017년 36주 ~ 2025년 47주)
        console.log('📂 [useInfluenzaData] CSV 데이터 로드 시작 (2017년 36주 ~ 2025년 47주)');
        const csvData = await loadHistoricalCSVData(dsid);
        const csvETLData = convertCSVToETLFormat(csvData);
        console.log('📂 [useInfluenzaData] CSV 데이터 변환 완료:', {
          원본건수: csvData.length,
          변환건수: csvETLData.length,
          샘플: csvETLData.slice(0, 2),
        });
        
        // 2. API 데이터 가져오기 (2025년 48주 ~ 현재)
        console.log('📡 [useInfluenzaData] API 데이터 로드 시작 (2025년 48주 ~ 현재)');
        const dateRange = getDateRangeFromSeason(selectedSeason, selectedWeek);
        // 2025년 48주부터 시작하도록 날짜 범위 조정
        const apiStartDate = '2025-11-25'; // 2025년 48주 시작일 (대략)
        const apiEndDate = dateRange.to;
        console.log('📡 [useInfluenzaData] API 호출:', { dsid, from: apiStartDate, to: apiEndDate });
        
        let apiRawData = [];
        try {
          const apiData = await getETLDataByDateRange(dsid, apiStartDate, apiEndDate);
          console.log('📡 [useInfluenzaData] API 응답:', JSON.stringify(apiData, null, 2));
          
          // API 응답 데이터 파싱
          apiRawData = apiData?.body?.data || apiData?.data || apiData;
          
          // 2025년 48주 이상의 데이터만 필터링 (API 응답에 47주 이하 데이터가 포함될 수 있음)
          if (Array.isArray(apiRawData)) {
            const beforeFilter = apiRawData.length;
            apiRawData = apiRawData.filter(item => {
              try {
                const parsedData = JSON.parse(item.parsedData || '[]');
                if (Array.isArray(parsedData) && parsedData.length > 0) {
                  const firstRow = parsedData[0];
                  const year = parseInt(firstRow['연도'] || firstRow['﻿연도'] || '0');
                  const week = parseInt(firstRow['주차'] || '0');
                  // 2025년 48주 이상만 포함
                  return year === 2025 && week >= 48;
                }
              } catch (e) {
                return true; // 파싱 실패 시 포함
              }
              return true;
            });
            console.log(`📡 [useInfluenzaData] API 데이터 필터링: ${beforeFilter}건 -> ${apiRawData.length}건 (2025년 48주 이상)`);
          }
          
          console.log('📡 [useInfluenzaData] API 데이터 파싱 완료 (2025년 48주 이상 필터링):', {
            타입: typeof apiRawData,
            isArray: Array.isArray(apiRawData),
            length: apiRawData?.length,
            샘플: Array.isArray(apiRawData) ? apiRawData.slice(0, 2) : null,
          });
        } catch (apiError) {
          console.warn('📡 [useInfluenzaData] API 데이터 로드 실패 (CSV 데이터만 사용):', apiError);
          apiRawData = [];
        }
        
        // 3. CSV 데이터와 API 데이터 병합
        const allRawData = [...csvETLData, ...(Array.isArray(apiRawData) ? apiRawData : [])];
        console.log('📊 [useInfluenzaData] 데이터 병합 완료:', {
          CSV건수: csvETLData.length,
          API건수: Array.isArray(apiRawData) ? apiRawData.length : 0,
          전체건수: allRawData.length,
        });
        
        if (allRawData && Array.isArray(allRawData)) {
          if (allRawData.length === 0) {
            // 빈 배열인 경우
            console.warn('📊 [useInfluenzaData] 데이터가 없습니다. 기본 데이터를 사용합니다.');
            // 기본 데이터 유지 (이미 useState 초기값으로 설정됨)
          } else {
            // 데이터가 있는 경우 처리
            console.log(`📊 [useInfluenzaData] 데이터 ${allRawData.length}건 발견. 데이터 처리 중...`);
            const processedData = processETLData(allRawData);
            
          if (processedData && processedData.weeks && processedData.values) {
            console.log('데이터 처리 성공:', processedData);
            
            // processETLData가 반환한 데이터를 대시보드 형식으로 변환
            // processedData 형식: { weeks: ['32주', ...], values: { '0세': [...], ... } }
            // 대시보드 형식: { ili: { weeks: [...], values: [...] }, ... }
            
            // 연령대별 데이터를 대시보드 지표로 매핑
            // ds_0101은 "의사환자 분율" 데이터이므로 ili (인플루엔자 유사 질환)로 매핑
            // 주차를 숫자 기준으로 다시 정렬 (안전장치)
            const weeks = [...processedData.weeks].sort((a, b) => {
              const weekAStr = a.toString().replace(/주/g, '').trim();
              const weekBStr = b.toString().replace(/주/g, '').trim();
              const weekA = parseInt(weekAStr) || 0;
              const weekB = parseInt(weekBStr) || 0;
              
              if (isNaN(weekA) || isNaN(weekB)) {
                return a.toString().localeCompare(b.toString());
              }
              
              return weekA - weekB;
            });
            
            console.log('📊 [useInfluenzaData] 정렬된 주차:', weeks);
            
            // 모든 연령대의 평균값을 계산하여 ILI 데이터로 사용 (기본값)
            const allAgeGroups = Object.keys(processedData.values).filter(ageGroup => {
              // 절기 형식 제외
              const isSeason = /^\d{2}\/\d{2}$/.test(ageGroup);
              return !isSeason;
            });
            
            console.log('📊 [useInfluenzaData] 연령대 목록:', allAgeGroups);
            console.log('📊 [useInfluenzaData] 주차 목록:', weeks);
            
            const iliValues = weeks.map((week, index) => {
              // 모든 연령대의 평균값 계산 (null 값 제외)
              const validValues = allAgeGroups
                .map(ageGroup => {
                  const values = processedData.values[ageGroup];
                  return values && values[index] !== null && values[index] !== undefined ? values[index] : null;
                })
                .filter(val => val !== null);
              
              if (validValues.length === 0) {
                return null;
              }
              
              const sum = validValues.reduce((acc, val) => acc + val, 0);
              const avg = sum / validValues.length;
              
              console.log(`  주차 ${week} (인덱스 ${index}):`, {
                연령대수: allAgeGroups.length,
                유효값수: validValues.length,
                값들: validValues,
                평균: avg,
              });
              
              return avg;
            });
            
            console.log('📊 [useInfluenzaData] 계산된 ILI 값들:', iliValues);
            
            // 연령대별 데이터도 함께 저장 (필터링용)
            const ageGroupData = {};
            allAgeGroups.forEach((ageGroup) => {
              ageGroupData[ageGroup] = {
                weeks,
                values: processedData.values[ageGroup] || [],
              };
            });
            
            // 절기별 데이터 저장
            const seasonData = processedData.seasons || {};
            
            // 절기별 데이터만 asdf로 로그 출력
            console.log('asdf:', JSON.stringify(seasonData, null, 2));
            
            setInfluenzaData({
              ili: { 
                weeks, 
                values: iliValues, 
                ageGroups: ageGroupData, // 연령대별 데이터 추가
                seasons: seasonData, // 절기별 데이터 추가
              },
              // 다른 지표들은 기본값 유지 (추후 다른 DSID로 데이터 가져올 수 있음)
              ari: defaultInfluenzaData.ari,
              sari: defaultInfluenzaData.sari,
              iriss: defaultInfluenzaData.iriss,
              kriss: defaultInfluenzaData.kriss,
              nedis: defaultInfluenzaData.nedis,
            });
          } else {
            console.warn('데이터 처리 실패: processETLData가 null을 반환했습니다.');
            console.warn('allRawData 샘플:', allRawData[0]); // 첫 번째 항목 로그
          }
          }
        } else {
          console.error('API 응답 형식이 올바르지 않습니다.');
          console.error('예상: 배열, 실제:', typeof allRawData, allRawData);
        }
      } catch (err) {
        // API 호출 실패 시 기본값 유지 (하드코딩된 데이터)
        console.error('API 데이터 로딩 실패:', err);
        
        let errorMessage = '데이터를 불러오는데 실패했습니다. 기본 데이터를 표시합니다.';
        
        if (err.response) {
          // 서버 응답이 있는 경우
          if (err.response.status === 401) {
            errorMessage = '인증에 실패했습니다. 환경 변수를 확인하세요.';
          } else if (err.response.status === 404) {
            errorMessage = 'API 엔드포인트를 찾을 수 없습니다.';
          } else {
            errorMessage = `서버 오류 (${err.response.status}): ${err.response.data?.message || err.message || '알 수 없는 오류'}`;
          }
        } else if (err.request) {
          // 요청은 보냈지만 응답이 없는 경우 (CORS 등)
          if (err.message && (err.message.includes('CORS') || err.message.includes('Network Error'))) {
            errorMessage = 'CORS 오류: 개발 서버를 재시작하거나 백엔드에서 CORS 설정이 필요합니다. 기본 데이터를 표시합니다.';
          } else {
            errorMessage = '서버에 연결할 수 없습니다. 네트워크 연결을 확인하세요.';
          }
        } else if (err.message) {
          // 기타 에러
          if (err.message.includes('인증 설정')) {
            errorMessage = '인증 설정이 완료되지 않았습니다. .env 파일을 확인하세요.';
          } else {
            errorMessage = err.message;
          }
        }
        
        setError(errorMessage);
        // 기본값은 이미 useState 초기값으로 설정되어 있음
      } finally {
        setLoading(false);
      }
    };

    fetchInfluenzaData();
  }, [selectedSeason, selectedWeek, dsid]);

  return { influenzaData, loading, error };
};

