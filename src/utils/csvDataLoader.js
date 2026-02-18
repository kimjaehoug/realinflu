/**
 * CSV 파일에서 데이터를 로드하는 유틸리티 함수
 */

import { getDatasetName } from './datasetMetadata';

/**
 * CSV 파일을 읽어서 파싱하는 함수
 * @param {string} filePath - CSV 파일 경로
 * @returns {Promise<Array>} 파싱된 데이터 배열
 */
export const loadCSVFile = async (filePath) => {
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to load CSV: ${response.statusText}`);
    }
    const text = await response.text();
    return parseCSV(text);
  } catch (error) {
    console.error(`CSV 파일 로드 실패 (${filePath}):`, error);
    return [];
  }
};

/**
 * CSV 텍스트를 파싱하는 함수
 * @param {string} csvText - CSV 텍스트
 * @returns {Array} 파싱된 데이터 배열
 */
const parseCSV = (csvText) => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  
  // 첫 번째 줄이 헤더인지 확인 (BOM 문자 제거)
  const headerLine = lines[0].replace(/^\uFEFF/, '');
  const headers = headerLine.split(',').map(h => h.trim());
  
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    if (values.length !== headers.length) {
      console.warn(`CSV 라인 ${i + 1}의 컬럼 수가 헤더와 일치하지 않음:`, line);
      continue;
    }
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    data.push(row);
  }
  
  return data;
};

/**
 * CSV 라인을 파싱하는 함수 (쉼표로 구분, 따옴표 처리)
 * @param {string} line - CSV 라인
 * @returns {Array} 파싱된 값 배열
 */
const parseCSVLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // 이스케이프된 따옴표
        current += '"';
        i++;
      } else {
        // 따옴표 시작/끝
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // 쉼표로 구분
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // 마지막 값 추가
  values.push(current.trim());
  
  return values;
};

/**
 * 2017년 36주부터 2025년 47주까지의 CSV 데이터를 로드하는 함수
 * @param {string} dsid - 데이터셋 ID (예: 'ds_0101')
 * @returns {Promise<Array>} 로드된 데이터 배열
 */
export const loadHistoricalCSVData = async (dsid = 'ds_0101') => {
  const dataname = getDatasetName(dsid) || dsid;
  console.log(`📂 [CSV 로더] ${dataname} (${dsid}) CSV 데이터 로드 시작`);
  
  const allData = [];
  const startYear = 2017;
  const endYear = 2025;
  const startWeek = 36; // 2017년 36주부터
  const endWeek = 47; // 2025년 47주까지
  
  // dsid에서 숫자 추출 (예: 'ds_0101' -> '0101')
  const dsidNumber = dsid.replace('ds_', '');
  
  let loadedYears = [];
  for (let year = startYear; year <= endYear; year++) {
    const fileName = `flu-${dsidNumber}-${year}.csv`;
    // public 폴더 기준 경로
    const filePath = process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}/data/before/${fileName}` : `/data/before/${fileName}`;
    
    try {
      const yearData = await loadCSVFile(filePath);
      
      if (yearData.length > 0) {
        // CSV 파일의 연도 필드를 기준으로 필터링 (파일명의 연도가 아닌 실제 데이터의 연도 사용)
        const filteredData = yearData.filter(row => {
          const rowYear = parseInt(row['연도'] || row['연도 '] || '0');
          const week = parseInt(row['주차'] || row['주차 '] || '0');
          
          // 연도나 주차가 유효하지 않으면 제외
          if (!rowYear || !week || week < 1 || week > 53) {
            return false;
          }
          
          // 2017년 데이터: 36주 이상만 포함
          if (rowYear === startYear && week < startWeek) return false;
          
          // 2025년 데이터: 47주 이하만 포함 (48주 이상은 API에서 가져옴)
          if (rowYear === endYear && week > endWeek) {
            return false;
          }
          
          // 2017년 이전 또는 2025년 이후 데이터는 제외
          if (rowYear < startYear || rowYear > endYear) {
            return false;
          }
          
          return true;
        });
        
        if (filteredData.length > 0) {
          allData.push(...filteredData);
          loadedYears.push(year);
        }
      }
    } catch (error) {
      // CSV 파일 로드 실패 시 해당 연도만 건너뜀
      console.warn(`⚠️ [CSV 로더] ${dataname} ${year}년 데이터 로드 실패:`, error.message);
    }
  }
  
  console.log(`✅ [CSV 로더] ${dataname} (${dsid}) CSV 데이터 로드 완료: ${allData.length}건 (${loadedYears.join(', ')}년)`);
  return allData;
};

/**
 * CSV 데이터를 processETLData 형식으로 변환하는 함수
 * @param {Array} csvData - CSV 데이터 배열
 * @param {string} dsid - 데이터셋 ID (예: 'ds_0101')
 * @returns {Array} processETLData 형식의 데이터 배열
 */
export const convertCSVToETLFormat = (csvData, dsid = 'ds_0101') => {
  return csvData.map((row, index) => {
    // 기본 필드 추출 (공백 변형 대응)
    const year = row['연도'] || row['연도 '] || row['﻿연도'] || row['﻿연도 '] || '';
    const week = row['주차'] || row['주차 '] || '';
    
    // 연령대 또는 아형 필드 확인
    const ageGroup = row['연령대'] || row['연령대 '] || '';
    const subtype = row['아형'] || row['아형 '] || '';
    
    // CSV 파일의 모든 필드를 그대로 유지 (의사환자 분율, 입원환자 수, 인플루엔자 검출률 등)
    // processETLData에서 preferredField로 찾을 수 있도록 모든 필드를 포함
    const parsedRow = {
      '연도': year,
      '주차': week,
    };
    
    // 연령대 필드가 있으면 추가
    if (ageGroup) {
      parsedRow['연령대'] = ageGroup;
    }
    
    // I-RISS (ds_0106)와 K-RISS (ds_0108)의 경우 특별 처리
    if ((dsid === 'ds_0106' || dsid === 'ds_0108')) {
      // 연령대 필드가 있으면 연령대별 데이터로 처리 (2017년 등 구버전 CSV)
      if (ageGroup) {
        // 모든 필드를 그대로 포함
        Object.keys(row).forEach(key => {
          if (key !== '연도' && key !== '주차' && key !== '연령대' && key !== '아형' &&
              key !== '연도 ' && key !== '주차 ' && key !== '연령대 ' && key !== '아형 ') {
            parsedRow[key] = row[key];
          }
        });
        
        return {
          id: `csv_${dsid}_${index}`,
          dsId: dsid,
          parsedData: JSON.stringify([parsedRow]),
          originalData: Object.values(row).join(','),
          collectedAt: new Date().toISOString(),
        };
      }
      
      // 아형 필드만 있는 경우 (2025년 등 신버전 CSV)
      if (subtype) {
        // "검출률" 아형이 있으면 전체 검출률로 사용
        if (subtype === '검출률') {
          parsedRow['연령대'] = '전체';
          // 인플루엔자 검출률 필드 추가
          parsedRow['인플루엔자 검출률'] = row['인플루엔자 검출률'] || row['인플루엔자 검출률 '] || '';
          
          return {
            id: `csv_${dsid}_${index}`,
            dsId: dsid,
            parsedData: JSON.stringify([parsedRow]),
            originalData: Object.values(row).join(','),
            collectedAt: new Date().toISOString(),
          };
        } else {
          // 다른 아형은 건너뜀 (A, B, A(H1N1)pdm09, A(H3N2) 등)
          return null;
        }
      }
    }
    
    // 일반적인 경우: CSV의 모든 필드를 그대로 포함
    // 연령대 필드가 있으면 사용, 없으면 "전체"
    if (!ageGroup) {
      parsedRow['연령대'] = '전체';
    }
    
    // CSV의 모든 값 필드를 그대로 포함 (의사환자 분율, 입원환자 수, 인플루엔자 검출률, 응급실 인플루엔자 환자 등)
    Object.keys(row).forEach(key => {
      if (key !== '연도' && key !== '주차' && key !== '연령대' && key !== '아형' &&
          key !== '연도 ' && key !== '주차 ' && key !== '연령대 ' && key !== '아형 ' &&
          !key.includes('﻿')) {
        parsedRow[key] = row[key];
      }
    });
    
    return {
      id: `csv_${dsid}_${index}`,
      dsId: dsid,
      parsedData: JSON.stringify([parsedRow]),
      originalData: Object.values(row).join(','),
      collectedAt: new Date().toISOString(),
    };
  }).filter(item => item !== null); // null 항목 제거
};

