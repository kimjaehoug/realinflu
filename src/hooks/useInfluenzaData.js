import { useState, useEffect } from 'react';
import { getETLDataByDateRange, getETLDataBySeason, getETLDataByOrigin } from '../api/etlDataApi';
import { getDateRangeFromSeason } from '../utils/dateUtils';
import { processETLData } from '../utils/dataProcessors';
import { loadHistoricalCSVData, convertCSVToETLFormat } from '../utils/csvDataLoader';
import { sortWeeksBySeason } from '../utils/seasonUtils';
import { getDatasetName } from '../utils/datasetMetadata';

// 지표별 설정
const INDICATOR_CONFIG = {
  ili: { dsid: 'ds_0101', preferredField: '의사환자 분율', excludedFields: ['입원환자 수'] },
  ari: { dsid: 'ds_0103', preferredField: '입원환자 수', excludedFields: [] },
  sari: { dsid: 'ds_0104', preferredField: '입원환자 수', excludedFields: [] },
  iriss: { dsid: 'ds_0108', preferredField: '인플루엔자 검출률', excludedFields: [] },
  kriss: { dsid: 'ds_0106', preferredField: '인플루엔자 검출률', excludedFields: [] },
  nedis: { dsid: 'ds_0109', preferredField: '응급실 인플루엔자 환자', excludedFields: [] },
};

// 기본 더미 데이터 (빈 배열로 초기화)
const defaultInfluenzaData = {
  ili: { weeks: [], values: [] },
  ari: { weeks: [], values: [] },
  sari: { weeks: [], values: [] },
  iriss: { weeks: [], values: [] },
  kriss: { weeks: [], values: [] },
  nedis: { weeks: [], values: [] },
};

/**
 * 단일 지표의 데이터를 가져오는 헬퍼 함수
 */
const fetchIndicatorData = async (indicatorKey, config, selectedSeason, selectedWeek) => {
  const { dsid, preferredField, excludedFields } = config;
  const dataname = getDatasetName(dsid) || dsid;
  const isLatestSeason = selectedSeason === '25/26';
  
  try {
    let allRawData = [];
    
    if (isLatestSeason) {
      // 25/26절기: CSV(36~42주) + API(43주~) 조합
      
      // 1. CSV에서 36주~42주 데이터 가져오기 (2025년 36주~42주)
      try {
        const csvData = await loadHistoricalCSVData(dsid);
        const csvETLData = convertCSVToETLFormat(csvData, dsid);
        
        // 2025년 36주~42주만 필터링
        const csvFiltered = csvETLData.filter(item => {
          try {
            const parsedData = JSON.parse(item.parsedData || '[]');
            if (Array.isArray(parsedData) && parsedData.length > 0) {
              const firstRow = parsedData[0];
              const year = parseInt(firstRow['연도'] || firstRow['﻿연도'] || '0');
              const week = parseInt(firstRow['주차'] || '0');
              
              // 2025년 36주~42주만 포함
              if (year === 2025 && week >= 36 && week <= 42) {
                return true;
              }
            }
          } catch (e) {
            return false;
          }
          return false;
        });
        
        if (csvFiltered.length > 0) {
          allRawData.push(...csvFiltered);
          console.log(`📂 [${indicatorKey}] ${dataname} CSV 데이터 (36~42주) 로드 완료: ${csvFiltered.length}건`);
        }
      } catch (csvErr) {
        console.warn(`⚠️ [${indicatorKey}] ${dataname} CSV 데이터 로드 실패 (36~42주):`, csvErr.message);
      }
      
      // 2. API에서 43주~ 데이터 가져오기
      const dateRange = getDateRangeFromSeason(selectedSeason, selectedWeek);
      const tempApiData = await getETLDataByDateRange(dsid, '2025-09-01', dateRange.to);
      const tempApiRawData = tempApiData?.body?.data || tempApiData?.data || tempApiData;
      
      const origins = [];
      if (Array.isArray(tempApiRawData)) {
        tempApiRawData.forEach(item => {
          if (item.origin && !origins.includes(item.origin)) {
            origins.push(item.origin);
          }
        });
      }
      
      // 각 origin별로 요청
      for (const origin of origins) {
        try {
          const originData = await getETLDataByOrigin(dsid, origin);
          const originRawData = originData?.body?.data || originData?.data || originData;
          
          if (Array.isArray(originRawData)) {
            allRawData.push(...originRawData);
          } else if (originRawData) {
            allRawData.push(originRawData);
          }
        } catch (err) {
          console.error(`❌ [${indicatorKey}] ${dataname} origin 요청 실패:`, origin, err.message);
        }
      }
      
      console.log(`📡 [${indicatorKey}] ${dataname} API 데이터 로드 완료`);
    } else {
      // CSV 데이터 로드 (25/26절기가 아닌 경우)
      const csvData = await loadHistoricalCSVData(dsid);
      console.log(`📂 [${indicatorKey}] ${dataname} CSV 원본 데이터: ${csvData.length}건`);

      let csvETLData = convertCSVToETLFormat(csvData, dsid);
      console.log(`📂 [${indicatorKey}] ${dataname} CSV ETL 변환: ${csvETLData.length}건`);

      // 해당 절기의 데이터만 필터링
      const [year1, year2] = selectedSeason.split('/').map(y => parseInt('20' + y));
      console.log(`📂 [${indicatorKey}] ${dataname} ${selectedSeason}절기 필터링 범위: ${year1}년 36주 이상 또는 ${year2}년 35주 이하`);

      const beforeFilterCount = csvETLData.length;
      csvETLData = csvETLData.filter(item => {
        try {
          const parsedData = JSON.parse(item.parsedData || '[]');
          if (Array.isArray(parsedData) && parsedData.length > 0) {
            const firstRow = parsedData[0];
            const year = parseInt(firstRow['연도'] || firstRow['﻿연도'] || '0');
            const week = parseInt(firstRow['주차'] || '0');

            // 절기 범위: XX년 36주 ~ YY년 35주
            const isInRange = (year === year1 && week >= 36) || (year === year2 && week <= 35);

            if (isInRange) {
              console.log(`✅ [${indicatorKey}] ${dataname} 포함: ${year}년 ${week}주`);
              return true;
            } else {
              console.log(`❌ [${indicatorKey}] ${dataname} 제외: ${year}년 ${week}주`);
              return false;
            }
          }
        } catch (e) {
          console.warn(`⚠️ [${indicatorKey}] ${dataname} 파싱 실패:`, e);
          return false;
        }
        return false;
      });

      console.log(`📂 [${indicatorKey}] ${dataname} 절기 필터링 결과: ${beforeFilterCount}건 → ${csvETLData.length}건`);

      allRawData = csvETLData;
    }
    
    if (!allRawData || allRawData.length === 0) {
      return { weeks: [], values: [] };
    }
    
    // 데이터 처리 (preferredField와 excludedFields 전달)
    const processedData = processETLData(allRawData, preferredField, excludedFields);
    
    if (!processedData || !processedData.weeks || !processedData.values) {
      return { weeks: [], values: [] };
    }
    
    // 주차 정렬
    const weeks = [...processedData.weeks].sort((a, b) => sortWeeksBySeason(a, b));
    
    // 모든 연령대의 평균값 계산
    const allAgeGroups = Object.keys(processedData.values).filter(ageGroup => {
      const isSeason = /^\d{2}\/\d{2}$/.test(ageGroup);
      return !isSeason;
    });
    
    const weekValueMap = new Map();
    processedData.weeks.forEach((week, index) => {
      // 연령대가 없는 경우 (예: ARI - "전체" 키만 있음)
      if (allAgeGroups.length === 0) {
        // "전체" 키가 있으면 직접 사용
        if (processedData.values['전체'] && processedData.values['전체'][index] !== null && processedData.values['전체'][index] !== undefined) {
          weekValueMap.set(week, processedData.values['전체'][index]);
        }
      } else {
        // 연령대가 있는 경우 평균값 계산
        const validValues = allAgeGroups
          .map(ageGroup => processedData.values[ageGroup]?.[index])
          .filter(val => val !== null && val !== undefined);
        
        if (validValues.length > 0) {
          const avgValue = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
          weekValueMap.set(week, avgValue);
        }
      }
    });
    
    // 주차-값 쌍 생성
    let weekValuePairs = weeks
      .map(week => ({ week, value: weekValueMap.get(week) }))
      .filter(pair => pair.value !== null && pair.value !== undefined);
    
    // 25/26절기의 경우 43주부터만 표시 (36~42주는 필터링)
    if (isLatestSeason) {
      weekValuePairs = weekValuePairs.filter(pair => {
        const weekNum = parseInt(pair.week.replace('주', ''));
        return weekNum >= 43; // 43주 이상만 포함
      });
      console.log(`✂️ [${indicatorKey}] ${dataname} 25/26절기 필터링 완료: 43주 이상만 표시 (${weekValuePairs.length}주차)`);
    }
    
    const finalWeeks = weekValuePairs.map(pair => pair.week);
    const values = weekValuePairs.map(pair => pair.value);

    console.log(`✅ [${indicatorKey}] ${dataname} 데이터 처리 완료:`, {
      주차수: finalWeeks.length,
      값수: values.length,
      첫주차: finalWeeks[0],
      마지막주차: finalWeeks[finalWeeks.length - 1],
      첫값: values[0],
      마지막값: values[values.length - 1],
    });

    // ILI의 경우 연령대별 데이터와 절기별 데이터도 포함
    if (indicatorKey === 'ili') {
      const ageGroupData = {};
      allAgeGroups.forEach((ageGroup) => {
        const weekValueMapForAge = new Map();
        processedData.weeks.forEach((week, index) => {
          const value = processedData.values[ageGroup]?.[index];
          if (value !== null && value !== undefined) {
            weekValueMapForAge.set(week, value);
          }
        });
        
        const ageWeekValuePairs = finalWeeks
          .map(week => ({ week, value: weekValueMapForAge.get(week) }))
          .filter(pair => pair.value !== null && pair.value !== undefined);
        
        ageGroupData[ageGroup] = {
          weeks: ageWeekValuePairs.map(pair => pair.week),
          values: ageWeekValuePairs.map(pair => pair.value),
        };
      });
      
      return {
        weeks: finalWeeks,
        values: values,
        ageGroups: ageGroupData,
        seasons: processedData.seasons || {},
      };
    }
    
    return { weeks: finalWeeks, values: values };
  } catch (err) {
    const dataname = getDatasetName(config.dsid) || config.dsid;
    console.error(`❌ [${indicatorKey}] ${dataname} 데이터 로드 실패:`, err.message);
    return { weeks: [], values: [] };
  }
};

/**
 * 인플루엔자 데이터를 가져오는 커스텀 훅
 * @param {string} selectedSeason - 선택된 절기 (예: '25/26')
 * @param {string} selectedWeek - 선택된 주차 (예: '37')
 * @param {string} dsid - 데이터셋 ID (사용하지 않음, 모든 지표를 로드)
 * @returns {Object} {influenzaData, loading, error}
 */
export const useInfluenzaData = (selectedSeason, selectedWeek, dsid = 'ds_0101') => {
  const [influenzaData, setInfluenzaData] = useState(defaultInfluenzaData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('🔄 [useInfluenzaData] useEffect 실행 - 절기:', selectedSeason, '주차:', selectedWeek);
    
    const fetchInfluenzaData = async () => {
      console.log(`🚀 [${selectedSeason}절기] 모든 지표 데이터 로드 시작`);
      
      setLoading(true);
      setError(null);

      try {
        // 모든 지표를 병렬로 가져오기
        const indicatorPromises = Object.keys(INDICATOR_CONFIG).map(async (indicatorKey) => {
          const config = INDICATOR_CONFIG[indicatorKey];
          const dataname = getDatasetName(config.dsid) || config.dsid;
          console.log(`📊 [${indicatorKey}] ${dataname} (${config.dsid}) 데이터 로드 시작`);
          const data = await fetchIndicatorData(indicatorKey, config, selectedSeason, selectedWeek);
          console.log(`✅ [${indicatorKey}] ${dataname} 데이터 로드 완료:`, {
            주차수: data.weeks?.length || 0,
            값수: data.values?.length || 0,
          });
          return { indicatorKey, data };
        });
        
        const results = await Promise.all(indicatorPromises);
        
        // 결과를 객체로 변환
        const newInfluenzaData = { ...defaultInfluenzaData };
        results.forEach(({ indicatorKey, data }) => {
          newInfluenzaData[indicatorKey] = data;
        });
        
        console.log(`✅ [${selectedSeason}절기] 모든 지표 데이터 로드 완료`);
        setInfluenzaData(newInfluenzaData);
      } catch (err) {
        console.error(`❌ [${selectedSeason}절기] 데이터 로드 실패:`, err.message);
        
        let errorMessage = '데이터를 불러오는데 실패했습니다. 기본 데이터를 표시합니다.';
        
        if (err.response) {
          if (err.response.status === 401) {
            errorMessage = '인증에 실패했습니다. 환경 변수를 확인하세요.';
          } else if (err.response.status === 404) {
            errorMessage = 'API 엔드포인트를 찾을 수 없습니다.';
          } else {
            errorMessage = `서버 오류 (${err.response.status}): ${err.response.data?.message || err.message || '알 수 없는 오류'}`;
          }
        } else if (err.request) {
          if (err.message && (err.message.includes('CORS') || err.message.includes('Network Error'))) {
            errorMessage = 'CORS 오류: 개발 서버를 재시작하거나 백엔드에서 CORS 설정이 필요합니다. 기본 데이터를 표시합니다.';
          } else {
            errorMessage = '서버에 연결할 수 없습니다. 네트워크 연결을 확인하세요.';
          }
        } else if (err.message) {
          if (err.message.includes('인증 설정')) {
            errorMessage = '인증 설정이 완료되지 않았습니다. .env 파일을 확인하세요.';
          } else {
            errorMessage = err.message;
          }
        }
        
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchInfluenzaData();
  }, [selectedSeason, selectedWeek]);

  return { influenzaData, loading, error };
};

