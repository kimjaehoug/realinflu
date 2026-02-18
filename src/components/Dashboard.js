import React, { useMemo, useRef, useState, useEffect } from 'react';
import { alpha } from '@mui/material/styles';
import {
  Box,
  Button,
  Container,
  FormControl,
  Grid,
  IconButton,
  Link,
  Dialog,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
  CircularProgress,
  Alert,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
// API 호출은 커스텀 훅에서 처리됨
import { useInfluenzaData } from '../hooks/useInfluenzaData';
import { getETLDataBySeason, getETLDataByDateRange } from '../api/etlDataApi';
import apiClient from '../api/config';
import { processETLData } from '../utils/dataProcessors';
import { loadHistoricalCSVData, convertCSVToETLFormat } from '../utils/csvDataLoader';
import { getPrediction } from '../api/predictionApi';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  // BarElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import { FiX } from 'react-icons/fi';
import { sortWeeksBySeason } from '../utils/seasonUtils';
import HospitalSearch from './HospitalSearch';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
);

// Chart brand color (keep the original cyan-blue tone)
const PRIMARY_COLOR = '#38bdf8';
const PRIMARY_FILL = 'rgba(56, 189, 248, 0.2)';

const SEASON_OPTIONS = [
  '25/26',
  '24/25',
  '23/24',
  '22/23',
  '21/22',
  '20/21',
  '19/20',
  '18/19',
  '17/18',
];

const WEEKLY_REPORT_URL = 'https://dportal.kdca.go.kr/pot/bbs/BD_selectBbsList.do?q_bbsSn=1009';

function clampNumber(n, min, max) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function formatStageValue(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(1);
}

function buildGaugeConfig({ threshold, value }) {
  const t = Number.isFinite(threshold) ? threshold : 9.1;
  const current = Number.isFinite(value) ? value : 0;

  const t5 = t * 5;
  const t10 = t * 10;
  const min = 0;
  const computedMax = Math.max(t10 * 1.2, current * 1.1, t10 + 0.01);
  const max = computedMax;

  const seg1 = t; // 0 ~ T
  const seg2 = Math.max(0, t5 - t); // T ~ 5T
  const seg3 = Math.max(0, t10 - t5); // 5T ~ 10T
  const seg4 = Math.max(0.01, max - t10); // 10T ~ max (ensure >0)

  return {
    min,
    max,
    t,
    t5,
    t10,
    segments: [seg1, seg2, seg3, seg4],
  };
}

function createNeedlePlugin({ color = '#0f172a' }) {
  return {
    id: 'gaugeNeedle',
    afterDatasetsDraw(chart) {
      const meta = chart.getDatasetMeta(0);
      const arcs = meta?.data;
      if (!arcs || arcs.length === 0) return;

      // NOTE:
      // - Chart.js는 plugins를 id로 디듀프/캐시하는 경우가 있어 클로저로 value를 들고 있으면
      //   렌더 이후 값 변경이 needle에 반영되지 않을 수 있다.
      // - 그래서 needle 값은 options.plugins.gaugeNeedle에서 읽는다.
      const needleConfig = chart?.options?.plugins?.gaugeNeedle || {};
      const min = Number.isFinite(needleConfig.min) ? needleConfig.min : 0;
      const max = Number.isFinite(needleConfig.max) ? needleConfig.max : 1;
      const value = Number.isFinite(needleConfig.value) ? needleConfig.value : 0;

      const firstArc = arcs[0];
      const lastArc = arcs[arcs.length - 1];
      const centerX = firstArc.x;
      const centerY = firstArc.y;
      const outerRadius = firstArc.outerRadius;
      const startAngle = firstArc.startAngle;
      const endAngle = lastArc.endAngle;

      const denom = max - min;
      const ratio = denom > 0 ? clampNumber((value - min) / denom, 0, 1) : 0;
      const angle = startAngle + ratio * (endAngle - startAngle);

      const ctx = chart.ctx;
      const len = outerRadius * 0.82;
      const x = centerX + Math.cos(angle) * len;
      const y = centerY + Math.sin(angle) * len;

      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.stroke();

      // needle cap
      ctx.beginPath();
      ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
      ctx.fill();

      // tip dot
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  };
}

function EpidemicGauge({ threshold, value }) {
  const gauge = buildGaugeConfig({ threshold, value });
  const needle = createNeedlePlugin({ color: '#6b7280' });

  const data = {
    labels: ['비유행', '보통', '높음', '매우 높음'],
    datasets: [
      {
        data: gauge.segments,
        backgroundColor: ['#2dd4bf', '#fde68a', '#fb923c', '#fb7185'],
        borderWidth: 0,
        hoverOffset: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    rotation: -90,
    circumference: 180,
    // 반원 "막대(arc)"가 너무 두껍게 보이면 cutout을 키워서(=안쪽을 더 파서) 얇게 만든다.
    cutout: '80%',
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
      // needle plugin이 참조하는 동적 값
      gaugeNeedle: {
        min: gauge.min,
        max: gauge.max,
        value: Number.isFinite(value) ? value : 0,
      },
    },
  };

  return (
    // 게이지 높이(=막대그래프 크기) 조절
    <Box sx={{ position: 'relative', width: '100%', height: 160 }}>
      <Doughnut data={data} options={options} plugins={[needle]} />
      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          top: '60%',
          transform: 'translate(-50%, -50%)',
          width: 88,
          height: 40,
          borderRadius: 999,
          bgcolor: 'rgba(148, 163, 184, 0.24)',
          border: '1px solid rgba(148, 163, 184, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.02em' }}>
          {formatStageValue(value)}
        </Typography>
      </Box>
    </Box>
  );
}

function EpidemicLegend({ seasonLabel, threshold, currentStage }) {
  const t = Number.isFinite(threshold) ? threshold : 9.1;
  const t5 = t * 5;
  const t10 = t * 10;

  const rows = [
    { key: '비유행', swatch: '#2dd4bf', range: `${t.toFixed(1)} 이하` },
    { key: '보통', swatch: '#fde68a', range: `${t.toFixed(1)} 초과 ~ ${t5.toFixed(1)} 이하` },
    { key: '높음', swatch: '#fb923c', range: `${t5.toFixed(1)} 초과 ~ ${t10.toFixed(1)} 이하` },
    { key: '매우 높음', swatch: '#fb7185', range: `${t10.toFixed(1)} 초과` },
  ];

  return (
    // "25/26절기 유행기준"을 감싸는 큰 네모칸(Paper) 제거: 내용만 노출
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 900, textAlign: 'center' }}>
        {seasonLabel} 유행기준 : {t.toFixed(1)}
      </Typography>
      {/* range(예: "9.5 이하") ↔ 단계 pill(예: "비유행 ...")이 같은 줄에서 짝이 맞도록 row 단위로 렌더 */}
      <Box sx={{ mt: 1.75, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
        {rows.map((r) => {
          const isActive = currentStage === r.key;
          return (
            <Box
              key={r.key}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Box sx={{ width: 16, height: 16, bgcolor: r.swatch, borderRadius: 0.5, flex: '0 0 auto' }} />
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 800,
                    color: 'text.primary',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.range}
                </Typography>
              </Box>

              {/* 단계 칸(비유행/보통/높음/매우높음): 4개 동일한 작은 사이즈로 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: '0 0 auto' }}>
                <Box
                  sx={(theme) => ({
                    px: 0.75,
                    borderRadius: 1,
                    border: `1px solid ${alpha(r.swatch, isActive ? 0.55 : 0.25)}`,
                    bgcolor: alpha(r.swatch, isActive ? (theme.palette.mode === 'dark' ? 0.22 : 0.12) : 0.06),
                    width: 80,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: '0 0 auto',
                  })}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: isActive ? 900 : 800,
                      whiteSpace: 'nowrap',
                      fontSize: '0.82rem',
                      lineHeight: 1.15,
                    }}
                  >
                    {r.key}
                  </Typography>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
// 사용하지 않는 데이터 주석 처리
// const vaccinationStats = [
//   {
//     group: '어르신 (65세 이상)',
//     current: '86%',
//     change: '+0.8%p',
//   },
//   {
//     group: '어린이 (6~59개월)',
//     current: '81%',
//     change: '+1.2%p',
//   },
// ];

// const getChangeColor = change => (change.trim().startsWith('-') ? '#f87171' : '#22c55e');

// 사용하지 않는 차트 데이터 주석 처리
// const levelChart = {
//   labels: ['서울', '부산', '대구', '광주', '대전'],
//   datasets: [
//     {
//       label: 'Volume',
//       data: [18, 24, 21, 20, 17],
//       backgroundColor: PRIMARY_FILL,
//       borderRadius: 6,
//       barThickness: 18,
//     },
//     {
//       label: 'Service',
//       data: [14, 18, 16, 17, 13],
//       backgroundColor: 'rgba(148, 163, 184, 0.4)',
//       borderRadius: 6,
//       barThickness: 18,
//     },
//   ],
// };

// const levelOptions = {
//   responsive: true,
//   maintainAspectRatio: false,
//   plugins: { legend: { display: false } },
//   scales: {
//     x: {
//       stacked: true,
//       grid: { display: false },
//       ticks: { color: '#374151', font: { size: 11 } },
//     },
//     y: {
//       stacked: true,
//       grid: { color: 'rgba(148, 163, 184, 0.15)', borderDash: [4, 4] },
//       ticks: { color: '#6b7280', font: { size: 11 } },
//     },
//   },
// };

/**
 * 대시보드 "단일 지표 라인차트"의 공통 데이터 포맷 생성기
 *
 * - X축(labels): 주차(1~53). 화면에서는 "주"를 제거하고 숫자만 표시합니다. (예: "32주" → "32")
 *   - 주차 정렬은 화면에서 별도로 `sortWeeksBySeason`를 사용합니다.
 *   - `sortWeeksBySeason`: 인플루엔자 절기 기준(36주~53주 → 다음 해 1주~35주)으로 정렬
 * - Y축(values): 선택된 지표의 값 배열(라벨 인덱스와 1:1 매칭)
 *   - ILI(ds_0101): "의사환자 분율" (외래 1,000명당 의사환자 분율) → 소수점 2자리로 표시
 *   - ARI/SARI 등: 데이터셋별 핵심 필드(예: "입원환자 수") → 툴팁/카드에서 단위(unit)와 함께 표시
 *
 * 참고: 실제 값은 `useInfluenzaData`에서 가공되어 들어오며,
 * 기본 모드는 "전체 평균(연령대별 값의 평균)"로 계산됩니다.
 */
const createLineConfig = (labels, values) => {
  // labels에서 "주" 제거하여 숫자만 표시 (예: "32주" -> "32")
  const formattedLabels = labels?.map(label => {
    if (typeof label === 'string' && label.includes('주')) {
      return label.replace('주', '');
    }
    return label;
  }) || labels;
  
  return {
    labels: formattedLabels,
    datasets: [
      {
        data: values,
        borderColor: PRIMARY_COLOR,
        backgroundColor: PRIMARY_FILL,
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: PRIMARY_COLOR,
        pointBorderColor: '#0f172a',
        pointBorderWidth: 1.5,
      },
    ],
  };
};

/**
 * 절기 비교/연령대 비교처럼 "여러 시리즈"를 한 그래프에 그릴 때 사용하는 데이터 포맷
 *
 * - X축(labels): 주차(표시는 숫자만)
 * - datasets: 시리즈 배열(각 시리즈의 label/색상/values 포함)
 */
// 여러 데이터셋을 비교하는 차트 설정 생성
const createComparisonChartConfig = (labels, datasets) => {
  // labels에서 "주" 제거하여 숫자만 표시 (예: "32주" -> "32")
  const formattedLabels = labels?.map(label => {
    if (typeof label === 'string' && label.includes('주')) {
      return label.replace('주', '');
    }
    return label;
  }) || labels;
  
  return {
    labels: formattedLabels,
    datasets,
  };
};

// 절기별 색상 매핑 (고정)
const seasonColorMap = {
  '17/18절기': { border: 'rgba(147, 197, 253, 0.9)', fill: 'rgba(147, 197, 253, 0.28)' },
  '18/19절기': { border: 'rgba(96, 165, 250, 0.9)', fill: 'rgba(96, 165, 250, 0.28)' },
  '19/20절기': { border: 'rgba(139, 92, 246, 0.9)', fill: 'rgba(139, 92, 246, 0.28)' },
  '20/21절기': { border: 'rgba(167, 139, 250, 0.9)', fill: 'rgba(167, 139, 250, 0.28)' },
  '21/22절기': { border: 'rgba(94, 234, 212, 0.9)', fill: 'rgba(94, 234, 212, 0.28)' },
  '22/23절기': { border: 'rgba(134, 239, 172, 0.9)', fill: 'rgba(134, 239, 172, 0.28)' },
  '23/24절기': { border: 'rgba(59, 130, 246, 0.9)', fill: 'rgba(59, 130, 246, 0.28)' },
  '24/25절기': { border: 'rgba(30, 58, 138, 0.9)', fill: 'rgba(30, 58, 138, 0.28)' },
  '25/26절기': { border: 'rgba(239, 68, 68, 0.9)', fill: 'rgba(239, 68, 68, 0.28)' },
};

// 절기별 색상 팔레트 (기본값용)
const seasonColors = [
  { border: 'rgba(147, 197, 253, 0.9)', fill: 'rgba(147, 197, 253, 0.28)' }, // 17/18
  { border: 'rgba(96, 165, 250, 0.9)', fill: 'rgba(96, 165, 250, 0.28)' }, // 18/19
  { border: 'rgba(139, 92, 246, 0.9)', fill: 'rgba(139, 92, 246, 0.28)' }, // 19/20
  { border: 'rgba(167, 139, 250, 0.9)', fill: 'rgba(167, 139, 250, 0.28)' }, // 20/21
  { border: 'rgba(94, 234, 212, 0.9)', fill: 'rgba(94, 234, 212, 0.28)' }, // 21/22
  { border: 'rgba(134, 239, 172, 0.9)', fill: 'rgba(134, 239, 172, 0.28)' }, // 22/23
  { border: 'rgba(59, 130, 246, 0.9)', fill: 'rgba(59, 130, 246, 0.28)' }, // 23/24
  { border: 'rgba(30, 58, 138, 0.9)', fill: 'rgba(30, 58, 138, 0.28)' }, // 24/25
  { border: 'rgba(239, 68, 68, 0.9)', fill: 'rgba(239, 68, 68, 0.28)' }, // 25/26
];

// 연령대별 색상 매핑 (고정)
const ageGroupColorMap = {
  '0세': { border: 'rgba(147, 197, 253, 0.9)', fill: 'rgba(147, 197, 253, 0.28)' },
  '1-6세': { border: 'rgba(30, 58, 138, 0.9)', fill: 'rgba(30, 58, 138, 0.28)' },
  '7-12세': { border: 'rgba(96, 165, 250, 0.9)', fill: 'rgba(96, 165, 250, 0.28)' },
  '13-18세': { border: 'rgba(139, 92, 246, 0.9)', fill: 'rgba(139, 92, 246, 0.28)' },
  '19-49세': { border: 'rgba(94, 234, 212, 0.9)', fill: 'rgba(94, 234, 212, 0.28)' },
  '50-64세': { border: 'rgba(134, 239, 172, 0.9)', fill: 'rgba(134, 239, 172, 0.28)' },
  '65세이상': { border: 'rgba(239, 68, 68, 0.9)', fill: 'rgba(239, 68, 68, 0.28)' },
};

// 연령대별 색상 팔레트 (기본값용)
const ageGroupColors = [
  { border: 'rgba(147, 197, 253, 0.9)', fill: 'rgba(147, 197, 253, 0.28)' }, // 0세
  { border: 'rgba(30, 58, 138, 0.9)', fill: 'rgba(30, 58, 138, 0.28)' }, // 1-6세
  { border: 'rgba(96, 165, 250, 0.9)', fill: 'rgba(96, 165, 250, 0.28)' }, // 7-12세
  { border: 'rgba(139, 92, 246, 0.9)', fill: 'rgba(139, 92, 246, 0.28)' }, // 13-18세
  { border: 'rgba(94, 234, 212, 0.9)', fill: 'rgba(94, 234, 212, 0.28)' }, // 19-49세
  { border: 'rgba(134, 239, 172, 0.9)', fill: 'rgba(134, 239, 172, 0.28)' }, // 50-64세
  { border: 'rgba(239, 68, 68, 0.9)', fill: 'rgba(239, 68, 68, 0.28)' }, // 65세이상
];

// 연령대 정렬 함수: ageGroupColorMap의 키 순서를 기준으로 정렬
const sortAgeGroups = (ageGroups) => {
  const orderedKeys = Object.keys(ageGroupColorMap);
  return [...ageGroups].sort((a, b) => {
    const indexA = orderedKeys.indexOf(a);
    const indexB = orderedKeys.indexOf(b);
    
    // 정의된 연령대는 순서대로 정렬
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    // 정의되지 않은 연령대는 마지막에 배치
    if (indexA === -1 && indexB === -1) {
      return a.localeCompare(b);
    }
    return indexA === -1 ? 1 : -1;
  });
};

/**
 * 비교 차트(절기/연령대 다중선)의 공통 옵션
 *
 * - X축: 주차(모든 주차 표시, 회전 허용)
 * - Y축: 현재는 ILI 설명 문구가 기본으로 들어가 있음
 *   - ILI: "/1,000명 당 의사환자 분율"
 *   - 다른 지표는 `visitorOptionFactory`의 unit/formatter로 툴팁에서 구분
 */
const getYAxisTitleText = (graphId, unit) => {
  switch (graphId) {
    case 'ili':
      return '의사환자 분율 (/1,000명당)';
    case 'iriss':
    case 'kriss':
      return `인플루엔자 검출률${unit ? ` (${unit})` : ''}`;
    case 'ari':
    case 'sari':
    case 'nedis':
      return `환자 수${unit ? ` (${unit})` : ''}`;
    default:
      return unit ? `값 (${unit})` : '값';
  }
};

/**
 * 비교 차트 옵션(절기/연령대 다중선)
 * - Y축 title은 "현재 선택된 지표"에 맞춰 동적으로 바뀜
 */
const comparisonChartOptionFactory = (yAxisTitleText) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: {
        usePointStyle: true,
        padding: 15,
        font: {
          size: 11,
        },
        color: '#374151',
      },
    },
    tooltip: {
      backgroundColor: '#0f172a',
      titleColor: '#f8fafc',
      bodyColor: '#f8fafc',
      borderColor: 'rgba(148, 163, 184, 0.4)',
      borderWidth: 1,
      padding: 10,
      callbacks: {
        title: contexts => {
          if (!contexts?.length) return '';
          const label = contexts[0].label ?? '';
          return `< ${label} >`;
        },
        label: context => {
          const value = context.parsed.y;
          if (value == null) return '데이터 없음';
          // ILI인 경우 소수점 둘째 자리까지, 나머지는 첫째 자리까지
          const isILI = yAxisTitleText?.includes('의사환자 분율');
          return `${context.dataset.label}: ${isILI ? value.toFixed(2) : value.toFixed(1)}`;
        },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        color: '#6b7280',
        font: { size: 10 },
        maxRotation: 45,
        minRotation: 0,
        autoSkip: false, // 모든 주차 표시
      },
      title: {
        display: true,
        text: '주차 (Week)',
        color: '#6b7280',
        font: { size: 11 },
      },
    },
    y: {
      grid: { color: 'rgba(148, 163, 184, 0.2)', borderDash: [4, 4] },
      ticks: { color: '#6b7280', font: { size: 10 } },
      title: {
        display: true,
        text: yAxisTitleText || '값',
        color: '#6b7280',
        font: { size: 11 },
      },
    },
  },
  interaction: { intersect: false, mode: 'index' },
});

/**
 * 단일 지표 차트 옵션 팩토리
 *
 * - X축: 주차(labels를 그대로 사용; "주" 제거는 createLineConfig/createComparisonChartConfig에서 처리)
 * - Y축: 지표 값
 * - Tooltip: formatter와 unit을 통해 "값 + 단위"를 일관되게 표기
 */
const visitorOptionFactory = (formatter, seasonLabel, unit, yAxisTitleText) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0f172a',
      titleColor: '#f8fafc',
      bodyColor: '#f8fafc',
      borderColor: 'rgba(148, 163, 184, 0.4)',
      borderWidth: 1,
      padding: 10,
      callbacks: {
        title: contexts => {
          if (!contexts?.length) return '';
          const label = contexts[0].label ?? '';
          return `< ${label} >`;
        },
        label: context => {
          const value = formatter(context.parsed.y);
          return unit ? `${value} ${unit}` : value;
        },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { 
        color: '#6b7280', 
        font: { size: 10 },
        maxRotation: 45,
        minRotation: 0,
        autoSkip: false, // 모든 주차 표시
        callback: function(value, index) {
          // labels 배열에서 해당 인덱스의 값을 반환
          return this.getLabelForValue(value);
        },
      },
      title: {
        display: true,
        text: '주차 (Week)',
        color: '#6b7280',
        font: { size: 11 },
      },
    },
    y: {
      grid: { color: 'rgba(148, 163, 184, 0.2)', borderDash: [4, 4] },
      ticks: { color: '#6b7280', font: { size: 10 } },
      title: {
        display: true,
        text: yAxisTitleText || (unit ? `값 (${unit})` : '값'),
        color: '#6b7280',
        font: { size: 11 },
      },
    },
  },
  interaction: { intersect: false, mode: 'index' },
});

const ariWeeks = ['34주', '35주', '36주', '37주'];
const ariValues = [18, 23, 28, 34];

const sariWeeks = ['34주', '35주', '36주', '37주'];
const sariValues = [8, 5, 4, 3];

const irissWeeks = ['37주', '38주', '39주', '40주', '41주', '42주'];
const irissValues = [2.4, 3.1, 4.2, 5.6, 6.9, 7.8];

const krissWeeks = ['40주', '41주', '42주', '43주'];
const krissValues = [3.5, 5.1, 6.8, 9.7];

const nedisWeeks = ['40주', '41주', '42주', '43주'];
const nedisValues = [456, 623, 892, 1231];

const calculateWeekChange = series => {
  if (!Array.isArray(series) || series.length === 0) {
    return null;
  }
  let lastIdx = series.length - 1;
  while (lastIdx >= 0 && (series[lastIdx] == null || Number.isNaN(series[lastIdx]))) {
    lastIdx -= 1;
  }
  if (lastIdx <= 0) {
    return null;
  }
  let prevIdx = lastIdx - 1;
  while (prevIdx >= 0 && (series[prevIdx] == null || Number.isNaN(series[prevIdx]))) {
    prevIdx -= 1;
  }
  if (prevIdx < 0) {
    return null;
  }
  const last = series[lastIdx];
  const prev = series[prevIdx];
  if (!Number.isFinite(last) || !Number.isFinite(prev) || prev === 0) {
    return null;
  }
  return ((last - prev) / Math.abs(prev)) * 100;
};

// 사용하지 않는 데이터 주석 처리
// const stageWeeks = [
//   '37주', '38주', '39주', '40주', '41주', '42주', '43주', '44주', '45주', '46주', '47주', '48주', '49주',
//   '50주', '51주', '52주', '53주', '1주', '2주', '3주', '4주', '5주', '6주', '7주', '8주', '9주', '10주', '11주',
//   '12주', '13주', '14주', '15주', '16주', '17주', '18주', '19주', '20주', '21주', '22주', '23주', '24주', '25주',
//   '26주', '27주', '28주', '29주', '30주', '31주', '32주', '33주', '34주',
// ];

// 사용하지 않는 데이터 주석 처리
// const stageSeason2425 = [
//   0.4, 0.5, 0.6, 0.8, 1.1, 1.3, 1.5, 1.8, 2.5, 3.2, 4.6, 6.8, 9.4, 12.5, 16.1, 19.8, 24.9, 28.7, 30.5, 29.2, 27.1,
//   23.8, 19.4, 15.2, 11.6, 8.9, 6.8, 5.3, 4.1, 3.4, 3, 2.7, 2.4, 2.2, 2.1, 1.9, 1.8, 1.7, 1.6, 1.5, 1.4, 1.3, 1.2,
//   1.2, 1.1, 1.1, 1, 0.95, 0.9,
// ];

// const stageSeason2526 = [
//   0.42, 0.44, 0.48, 0.54, 0.52, 0.47, 0.45, 0.51, 0.64, 0.78, 0.94, 1.15, 1.62, 2.24, 3.08, 4.05, 4.68, 4.92, 5.2, null,
//   null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
//   null, null, null, null, null, null, null, null, null,
// ];

// const stageThreshold = new Array(stageWeeks.length).fill(9.1);

// 사용하지 않는 데이터 주석 처리
// const stageChartData = {
//   labels: stageWeeks,
//   datasets: [
//     {
//       label: '24/25절기',
//       data: stageSeason2425,
//       borderColor: 'rgba(147, 197, 253, 0.9)',
//       backgroundColor: 'rgba(147, 197, 253, 0.28)',
//       fill: true,
//       tension: 0.25,
//       borderWidth: 2,
//       pointRadius: 0,
//       order: 3,
//     },
//     {
//       label: '25/26절기',
//       data: stageSeason2526,
//       borderColor: '#0f172a',
//       backgroundColor: 'transparent',
//       fill: false,
//       tension: 0.3,
//       borderWidth: 3,
//       pointRadius: ctx => (ctx.dataIndex === 18 ? 6 : 0),
//       pointBackgroundColor: '#38bdf8',
//       pointBorderColor: '#0f172a',
//       pointBorderWidth: 2,
//       spanGaps: true,
//       order: 1,
//     },
//     {
//       label: '25/26절기 유행기준',
//       data: stageThreshold,
//       borderColor: '#c084fc',
//       borderWidth: 2,
//       borderDash: [6, 6],
//       fill: false,
//       pointRadius: 0,
//       order: 0,
//     },
//   ],
// // };

// const stageChartOptions = {
//   responsive: true,
//   maintainAspectRatio: false,
//   plugins: {
//     legend: {
//       position: 'top',
//       labels: {
//         color: '#374151',
//         usePointStyle: true,
//         padding: 18,
//       },
//     },
//     tooltip: {
//       backgroundColor: '#0f172a',
//       titleColor: '#f8fafc',
//       bodyColor: '#f8fafc',
//       borderColor: 'rgba(148, 163, 184, 0.4)',
//       borderWidth: 1,
//       padding: 10,
//       callbacks: {
//         title: contexts => {
//           if (!contexts?.length) return '';
//           const label = contexts[0].label ?? '';
//           return `< ${label} >`;
//         },
//         label: context => {
//           const value = context.parsed.y;
//           if (value == null) return '데이터 없음';
//           return `${value}`;
//         },
//       },
//     },
//   },
//   scales: {
//     x: {
//       grid: { display: false },
//       ticks: { color: '#6b7280', maxRotation: 0, minRotation: 0, font: { size: 9 } },
//     },
//     y: {
//       grid: { color: 'rgba(148, 163, 184, 0.15)', borderDash: [4, 4] },
//       ticks: { color: '#6b7280' },
//       suggestedMin: 0,
//       suggestedMax: 32,
//     },
//   },
//   interaction: { intersect: false, mode: 'index' },
// };

// 사용하지 않는 컴포넌트 주석 처리
// const InfluenzaStageChart = () => (
//   <Box sx={{ width: '100%', height: 260 }}>
//     <Line data={stageChartData} options={stageChartOptions} />
//   </Box>
// );

/**
 * 그래프 선택지(대시보드 상단 드롭다운) 정의
 *
 * - weeks: X축(주차)
 * - values: Y축(지표 값)
 * - unit: 툴팁/카드에 함께 표시될 단위
 * - label/description: "무슨 지표인지" 사용자 설명 문구
 *
 * 값 산출 방식(중요):
 * - `useInfluenzaData`에서 API/CSV 원자료를 가져온 뒤,
 *   (연령대가 있는 지표의 경우) "연령대별 값들의 평균"을 주차별 대표값으로 계산해 `values`로 제공합니다.
 * - ILI는 추가로 연령대별 시리즈(`ageGroups`)도 제공하며, 연령대를 선택하면 그 시리즈로 대체 표시됩니다.
 * - 25/26절기 ILI는 예측(주황색 라인)이 추가로 표시될 수 있습니다.
 */
const graphChoices = [
  {
    id: 'ili',
    shorthand: 'ILI',
    label: '인플루엔자 의사환자 분율',
    description: '외래 의료기관 1,000명당 인플루엔자 의심 환자 분율',
    seasonLabel: '25/26절기',
    unit: '명',
    weeks: [],
    values: [],
    data: createLineConfig([], []),
    formatter: value => value.toFixed(2),
  },
  {
    id: 'ari',
    shorthand: 'ARI',
    label: '급성호흡기감염증 환자 중 인플루엔자 환자 수',
    description: '급성호흡기감염증 신고 환자 가운데 인플루엔자로 분류된 환자 수',
    seasonLabel: '25/26절기',
    unit: '명',
    weeks: ariWeeks,
    values: ariValues,
    data: createLineConfig(ariWeeks, ariValues),
    formatter: value => value.toLocaleString(),
  },
  {
    id: 'sari',
    shorthand: 'SARI',
    label: '중증급성호흡기감염증 환자 중 인플루엔자 환자 수',
    description: '중증급성호흡기감염증 입원 환자 가운데 인플루엔자 확진 환자 수',
    seasonLabel: '25/26절기',
    unit: '명',
    weeks: sariWeeks,
    values: sariValues,
    data: createLineConfig(sariWeeks, sariValues),
    formatter: value => value.toLocaleString(),
  },
  {
    id: 'iriss',
    shorthand: 'I-RISS',
    label: '검사기관 인플루엔자 검출률',
    description: '검사기관 표본검사에서 확인된 인플루엔자 검출 비율',
    seasonLabel: '25/26절기',
    unit: '%',
    weeks: irissWeeks,
    values: irissValues,
    data: createLineConfig(irissWeeks, irissValues),
    formatter: value => value.toFixed(2),
  },
  {
    id: 'kriss',
    shorthand: 'K-RISS',
    label: '의원급 의료기관 인플루엔자 검출률',
    description: '의원급 의료기관 표본검사에서 확인된 인플루엔자 검출 비율',
    seasonLabel: '25/26절기',
    unit: '%',
    weeks: krissWeeks,
    values: krissValues,
    data: createLineConfig(krissWeeks, krissValues),
    formatter: value => value.toFixed(2),
  },
  {
    id: 'nedis',
    shorthand: 'NEDIS',
    label: '응급실 인플루엔자 환자 수',
    description: '전국 응급실 감시체계에서 집계된 인플루엔자 환자 수',
    seasonLabel: '25/26절기',
    unit: '명',
    weeks: nedisWeeks,
    values: nedisValues,
    data: createLineConfig(nedisWeeks, nedisValues),
    formatter: value => value.toLocaleString(),
  },
];

const Dashboard = ({ isOpen = true, shouldOpenHospitalMap = false, onHospitalMapOpened, activeMenuId = 'dashboard' }) => {
  const [selectedGraphId, setSelectedGraphId] = useState(graphChoices[0].id);
  const [selectedSeason, setSelectedSeason] = useState('25/26'); // 최신 절기로 초기화
  const [selectedWeek] = useState('37'); // 2024년 37주 - 실제 데이터가 있는 주차
  const [selectedAgeGroup, setSelectedAgeGroup] = useState(null); // 선택된 연령대 (null이면 전체 평균)
  const [viewMode, setViewMode] = useState('single'); // 'single', 'season', 'ageGroup' - 그래프 표시 모드
  const [selectedSeasons, setSelectedSeasons] = useState(['24/25', '25/26']); // 절기별 비교용 선택된 절기들
  const [selectedAgeGroups, setSelectedAgeGroups] = useState(['0세', '1-6세', '7-12세', '13-18세', '19-49세', '50-64세', '65세이상']); // 연령대별 비교용 선택된 연령대들
  const [newsDialogOpen, setNewsDialogOpen] = useState(false);
  const [newsItems, setNewsItems] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState(null);
  const [newsSelected, setNewsSelected] = useState(null);
  const newsIframeLoadedRef = useRef(false);
  const newsFallbackTimerRef = useRef(null);
  const [weeklyReportDialogOpen, setWeeklyReportDialogOpen] = useState(false);
  const [influenzaDialogOpen, setInfluenzaDialogOpen] = useState(false);
  const [hospitalSearchOpen, setHospitalSearchOpen] = useState(false);

  // 환경 변수에서 DSID 가져오기
  const defaultDSID = process.env.REACT_APP_DSID || 'ds_0101';

  // API 데이터 가져오기 (커스텀 훅 사용)
  const { influenzaData, loading, error: apiError } = useInfluenzaData(
    selectedSeason,
    selectedWeek,
    defaultDSID
  );

  // 절기별 비교용 데이터 (체크박스로 선택된 절기들의 데이터)
  const [seasonComparisonData, setSeasonComparisonData] = useState({});

  // 예측 데이터 (25/26절기용)
  const [predictionData, setPredictionData] = useState(null);
  const [, setPredictionLoading] = useState(false);

  // 에러 상태 관리 (사용자가 닫을 수 있도록)
  const [error, setError] = useState(null);

  // API 에러가 변경되면 로컬 error state 업데이트
  useEffect(() => {
    if (apiError) {
      setError(apiError);
    }
  }, [apiError]);

  // 감염병 뉴스 로드 (뉴스 페이지 또는 Dialog 열릴 때)
  useEffect(() => {
    let cancelled = false;

    async function loadNews() {
      setNewsLoading(true);
      setNewsError(null);
      try {
        const res = await apiClient.get('/news', { params: { limit: 60 } });
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        if (!cancelled) setNewsItems(items);
      } catch (e) {
        if (!cancelled) {
          setNewsError('뉴스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
          setNewsItems([]);
        }
      } finally {
        if (!cancelled) setNewsLoading(false);
      }
    }

    const shouldLoadNews = newsDialogOpen || activeMenuId === 'news';

    if (shouldLoadNews) {
      setNewsSelected(null);
      newsIframeLoadedRef.current = false;
      if (newsFallbackTimerRef.current) {
        clearTimeout(newsFallbackTimerRef.current);
        newsFallbackTimerRef.current = null;
      }
      loadNews();
    }

    return () => {
      cancelled = true;
    };
  }, [newsDialogOpen, activeMenuId]);

  const openNewsItem = (item) => {
    if (!item?.link) return;
    // 많은 언론사가 iframe을 막으므로, 바로 새 탭에서 원문을 여는 방식으로 단순화
    window.open(item.link, '_blank', 'noopener,noreferrer');
  };

  const formatNewsTime = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    // eslint-disable-next-line no-restricted-globals
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 25/26절기 선택 시 예측 API 호출
  useEffect(() => {
    const fetchPrediction = async () => {
      // 25/26절기이고 ILI 데이터가 있는 경우만 예측 (selectedGraphId 조건 제거 - 메인 대시보드에서 항상 예측 표시)
      if (selectedSeason !== '25/26' || !influenzaData?.ili) {
        setPredictionData(null);
        return;
      }

      const iliValues = influenzaData.ili.values || [];

      // 최소 2주차까지 데이터가 있어야 예측 가능
      if (iliValues.length < 2) {
        setPredictionData(null);
        return;
      }

      // 최신 2주차 데이터를 예측 API에 전달
      const inputData = iliValues.slice(-2); // 마지막 2개 값

      setPredictionLoading(true);
      try {
        const prediction = await getPrediction(inputData, 3);
        if (prediction && prediction.success && prediction.predictions) {
          setPredictionData(prediction);
          console.log('✅ [예측] 25/26절기 예측 데이터 받음:', prediction);
        } else {
          // API 응답이 없거나 실패한 경우 샘플값 사용
          console.warn('⚠️ [예측] API 응답 없음, 샘플값 사용');
          setPredictionData({
            success: true,
            predictions: [42.0, 43.5, 44.0], // 40~45 범위의 샘플값
            prediction_length: 3,
            input_length: 2,
            unit: '명',
          });
        }
      } catch (err) {
        console.error('⚠️ [예측] 예측 API 호출 실패, 샘플값 사용:', err);
        // API 호출 실패 시 샘플값 사용
        setPredictionData({
          success: true,
          predictions: [42.0, 43.5, 44.0], // 40~45 범위의 샘플값
          prediction_length: 3,
          input_length: 2,
          unit: '명',
        });
      } finally {
        setPredictionLoading(false);
      }
    };

    fetchPrediction();
  }, [selectedSeason, selectedGraphId, influenzaData]);

  // selectedSeasons 변경 시 각 절기 데이터를 API로 불러오기
  useEffect(() => {
    const loadSeasonData = async () => {
      const newSeasonData = { ...seasonComparisonData };
      const initialKeyCount = Object.keys(newSeasonData).length;
      
      for (const season of selectedSeasons) {
        // 이미 로드된 데이터가 있으면 스킵
        if (newSeasonData[`${season}절기`]) {
          continue;
        }

        // 25/26절기만 API로 불러오고, 나머지는 CSV 사용
        const isLatestSeason = season === '25/26';
        
        if (!isLatestSeason) {
          // 24/25절기 이하는 CSV 데이터 사용
          try {
            console.log(`📂 [절기별 비교] ${season}절기 CSV 데이터 로드 시작`);
            const csvData = await loadHistoricalCSVData(defaultDSID);
            const csvETLData = convertCSVToETLFormat(csvData);
            
            // 절기에 해당하는 데이터만 필터링
            const [year1, year2] = season.split('/').map(y => parseInt('20' + y));
            const filteredCSVData = csvETLData.filter(item => {
              try {
                const parsedData = JSON.parse(item.parsedData || '[]');
                if (Array.isArray(parsedData) && parsedData.length > 0) {
                  const firstRow = parsedData[0];
                  const year = parseInt(firstRow['연도'] || firstRow['﻿연도'] || '0');
                  const week = parseInt(firstRow['주차'] || '0');
                  
                  // 절기 범위: XX년 36주 ~ YY년 35주
                  if (year === year1 && week >= 36) return true;
                  if (year === year2 && week <= 35) return true;
                  return false;
                }
              } catch (e) {
                return false;
              }
              return false;
            });
            
            if (filteredCSVData.length > 0) {
              const processedData = processETLData(filteredCSVData);
              const seasonKey = `${season}절기`;
              
              if (processedData && processedData.seasons && processedData.seasons[seasonKey]) {
                newSeasonData[seasonKey] = processedData.seasons[seasonKey];
                console.log(`✅ [절기별 비교] ${season}절기 CSV 데이터 로드 완료`, processedData.seasons[seasonKey]);
              } else if (processedData && processedData.weeks && processedData.values) {
                const allAgeGroups = Object.keys(processedData.values).filter(ageGroup => {
                  const isSeason = /^\d{2}\/\d{2}절기$/.test(ageGroup);
                  return !isSeason;
                });
                
                const weeks = processedData.weeks;
                const values = weeks.map((week, index) => {
                  const validValues = allAgeGroups
                    .map(ageGroup => processedData.values[ageGroup]?.[index])
                    .filter(val => val !== null && val !== undefined);
                  
                  if (validValues.length === 0) return null;
                  return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
                });
                
                newSeasonData[seasonKey] = { weeks, values };
                console.log(`✅ [절기별 비교] ${season}절기 CSV 데이터 로드 완료 (직접 계산)`, {
                  weeks: weeks.length,
                  values: values.length,
                });
              }
            } else {
              console.warn(`⚠️ [절기별 비교] ${season}절기 CSV 데이터 없음`);
            }
          } catch (csvErr) {
            console.warn(`⚠️ [절기별 비교] ${season}절기 CSV 데이터 로드 실패:`, csvErr.message);
          }
          continue;
        }

        // 25/26절기만 API로 불러옴 (origin별로 요청)
        try {
          console.log(`📡 [절기별 비교] ${season}절기 API 데이터 로드 시작`);
          
          // 먼저 날짜 범위로 origin 목록 가져오기
          // 절기 정의: XX/YY절기 = XX년 36주 ~ YY년 35주
          const [year1, year2] = season.split('/').map(y => parseInt('20' + y));
          const startDate = new Date(year1, 8, 1); // 9월 1일
          const endDate = new Date(year2, 7, 31); // 8월 31일
          const dateRange = {
            from: startDate.toISOString().split('T')[0],
            to: endDate.toISOString().split('T')[0],
          };
          
          const tempApiData = await getETLDataByDateRange(defaultDSID, dateRange.from, dateRange.to);
          const tempApiRawData = tempApiData?.body?.data || tempApiData?.data || tempApiData;
          
          // origin 목록 추출 (중복 제거)
          const origins = [];
          if (Array.isArray(tempApiRawData)) {
            tempApiRawData.forEach(item => {
              if (item.origin && !origins.includes(item.origin)) {
                origins.push(item.origin);
              }
            });
          }
          
          console.log(`📋 [${season}절기] 발견된 origin 목록:`, origins);
          
          // origin별로 데이터 요청
          const apiData = await getETLDataBySeason(defaultDSID, season, origins);
          const apiRawData = apiData?.body?.data || apiData?.data || apiData;

          // 25/26절기 원본 데이터 출력
          if (season === '25/26') {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`📦 [${season}절기] 원본 API 응답 데이터`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('전체 응답:', JSON.stringify(apiData, null, 2));
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('원본 데이터 배열:', apiRawData);
            console.log('데이터 개수:', Array.isArray(apiRawData) ? apiRawData.length : 'N/A');
            if (Array.isArray(apiRawData) && apiRawData.length > 0) {
              console.log('첫 번째 항목 샘플:', JSON.stringify(apiRawData[0], null, 2));
              if (apiRawData[0]?.parsedData) {
                try {
                  const parsed = JSON.parse(apiRawData[0].parsedData);
                  console.log('첫 번째 항목의 parsedData:', JSON.stringify(parsed, null, 2));
                } catch (e) {
                  console.log('parsedData 파싱 실패:', e);
                }
              }
            }
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          }

          if (Array.isArray(apiRawData) && apiRawData.length > 0) {
            // parsedData가 있으면 그것을 우선 사용 (origin별 요청 데이터)
            const hasParsedData = apiRawData.some(item => item.parsedData);
            
            if (hasParsedData) {
              // parsedData 형식: processETLData로 처리
              console.log(`📊 [${season}절기] parsedData 형식 데이터 감지`);
              const processedData = processETLData(apiRawData);
              
              // 25/26절기 처리된 데이터 출력
              if (season === '25/26') {
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log(`📊 [${season}절기] 처리된 데이터 (parsedData 형식)`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('전체 processedData:', JSON.stringify(processedData, null, 2));
                if (processedData?.seasons) {
                  console.log('절기별 데이터:', Object.keys(processedData.seasons));
                  const seasonKey = `${season}절기`;
                  console.log(`${season}절기 데이터:`, JSON.stringify(processedData.seasons[seasonKey], null, 2));
                }
                if (processedData?.weeks) {
                  console.log('주차 목록:', processedData.weeks);
                }
                if (processedData?.values) {
                  console.log('연령대별 데이터 키:', Object.keys(processedData.values));
                }
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              }
              
              const seasonKey = `${season}절기`;
              
              // 방법 1: processETLData가 반환한 seasons 객체에서 찾기
              if (processedData && processedData.seasons && processedData.seasons[seasonKey]) {
                newSeasonData[seasonKey] = processedData.seasons[seasonKey];
                console.log(`✅ [절기별 비교] ${season}절기 데이터 로드 완료 (seasons 객체에서)`, processedData.seasons[seasonKey]);
              } 
              // 방법 2: 전체 데이터에서 해당 절기 데이터 추출
              else if (processedData && processedData.weeks && processedData.values) {
                // 모든 연령대의 평균값 계산하여 절기별 데이터 생성
                const allAgeGroups = Object.keys(processedData.values).filter(ageGroup => {
                  const isSeason = /^\d{2}\/\d{2}절기$/.test(ageGroup);
                  return !isSeason;
                });
                
                // 주차를 절기별로 정렬 (36주부터 시작해서 다음 해 35주까지)
                const weeks = [...processedData.weeks].sort((a, b) => sortWeeksBySeason(a, b));
                
                // 정렬된 주차에 맞춰 값도 재정렬
                // 주차별로 그룹화된 데이터를 다시 매핑
                const weekValueMap = new Map();
                
                // 먼저 각 주차별로 모든 연령대의 평균값 계산
                processedData.weeks.forEach((week, index) => {
                  const validValues = allAgeGroups
                    .map(ageGroup => processedData.values[ageGroup]?.[index])
                    .filter(val => val !== null && val !== undefined);
                  
                  if (validValues.length > 0) {
                    const avgValue = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
                    weekValueMap.set(week, avgValue);
                  }
                });
                
                // 정렬된 주차 순서대로 값 매핑
                const values = weeks.map(week => weekValueMap.get(week) ?? null);
                
                newSeasonData[seasonKey] = { weeks, values };
                console.log(`✅ [절기별 비교] ${season}절기 데이터 로드 완료 (직접 계산)`, {
                  weeks: weeks.length,
                  values: values.length,
                  주차값쌍: weeks.slice(0, 5).map((w, i) => ({ week: w, value: values[i] }))
                });
              } else {
                console.warn(`⚠️ [절기별 비교] ${season}절기 데이터 처리 실패: processedData 구조 확인 필요`, processedData);
              }
            } else {
              // parsedData가 없고 id + collectedAt만 있는 경우 (다른 형식)
              const hasNewFormat = apiRawData.some(item => item.id !== undefined && item.collectedAt !== undefined && !item.parsedData);
              
              if (hasNewFormat) {
                // 새로운 형식: id가 ILI 값, collectedAt이 날짜
                console.log(`📊 [${season}절기] 새로운 형식 데이터 감지 (id + collectedAt, parsedData 없음)`);
                
                // 날짜에서 주차 추출 함수
                const getWeekFromDate = (dateString) => {
                  const date = new Date(dateString);
                  const year = date.getFullYear();
                  const startOfYear = new Date(year, 0, 1);
                  const days = Math.floor((date - startOfYear) / (1000 * 60 * 60 * 24));
                  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
                  return { year, week };
                };
                
                // 주차별로 그룹화
                const weekDataMap = new Map();
                
                apiRawData.forEach(item => {
                  if (item.id !== undefined && item.collectedAt) {
                    const { year, week } = getWeekFromDate(item.collectedAt);
                    const weekKey = `${year}_${week}주`;
                    
                    if (!weekDataMap.has(weekKey)) {
                      weekDataMap.set(weekKey, {
                        year,
                        week: `${week}주`,
                        values: [],
                      });
                    }
                    
                    weekDataMap.get(weekKey).values.push(item.id);
                  }
                });
                
                // 주차별 평균값 계산
                const weeks = [];
                const values = [];
                
                Array.from(weekDataMap.entries())
                  .sort(([keyA], [keyB]) => {
                    const [yearA, weekA] = keyA.split('_');
                    const [yearB, weekB] = keyB.split('_');
                    const weekNumA = parseInt(weekA.replace('주', ''));
                    const weekNumB = parseInt(weekB.replace('주', ''));
                    
                    if (yearA !== yearB) return parseInt(yearA) - parseInt(yearB);
                    return weekNumA - weekNumB;
                  })
                  .forEach(([key, data]) => {
                    const avgValue = data.values.reduce((sum, val) => sum + val, 0) / data.values.length;
                    weeks.push(data.week);
                    values.push(avgValue);
                  });
                
                const seasonKey = `${season}절기`;
                newSeasonData[seasonKey] = { weeks, values };
                
                console.log(`✅ [절기별 비교] ${season}절기 데이터 로드 완료 (새로운 형식)`, {
                  weeks: weeks.length,
                  values: values.length,
                  sample: { week: weeks[0], value: values[0] }
                });
              } else {
                console.warn(`⚠️ [절기별 비교] ${season}절기 데이터 형식을 알 수 없음`);
              }
            }
          } else {
            // API 응답이 비어있으면 CSV 데이터로 폴백
            console.log(`📂 [절기별 비교] ${season}절기 API 응답이 비어있음, CSV 데이터로 폴백`);
            try {
              const csvData = await loadHistoricalCSVData(defaultDSID);
              const csvETLData = convertCSVToETLFormat(csvData);
              
              // 절기에 해당하는 데이터만 필터링
              const [year1, year2] = season.split('/').map(y => parseInt('20' + y));
              const filteredCSVData = csvETLData.filter(item => {
                try {
                  const parsedData = JSON.parse(item.parsedData || '[]');
                  if (Array.isArray(parsedData) && parsedData.length > 0) {
                    const firstRow = parsedData[0];
                    const year = parseInt(firstRow['연도'] || firstRow['﻿연도'] || '0');
                    const week = parseInt(firstRow['주차'] || '0');
                    
                    // 절기 범위: XX년 36주 ~ YY년 35주
                    if (year === year1 && week >= 36) return true;
                    if (year === year2 && week <= 35) return true;
                    return false;
                  }
                } catch (e) {
                  return false;
                }
                return false;
              });
              
              if (filteredCSVData.length > 0) {
                const processedData = processETLData(filteredCSVData);
                const seasonKey = `${season}절기`;
                
                if (processedData && processedData.seasons && processedData.seasons[seasonKey]) {
                  newSeasonData[seasonKey] = processedData.seasons[seasonKey];
                  console.log(`✅ [절기별 비교] ${season}절기 CSV 데이터 로드 완료`, processedData.seasons[seasonKey]);
                } else if (processedData && processedData.weeks && processedData.values) {
                  const allAgeGroups = Object.keys(processedData.values).filter(ageGroup => {
                    const isSeason = /^\d{2}\/\d{2}절기$/.test(ageGroup);
                    return !isSeason;
                  });
                  
                  const weeks = processedData.weeks;
                  const values = weeks.map((week, index) => {
                    const validValues = allAgeGroups
                      .map(ageGroup => processedData.values[ageGroup]?.[index])
                      .filter(val => val !== null && val !== undefined);
                    
                    if (validValues.length === 0) return null;
                    return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
                  });
                  
                  newSeasonData[seasonKey] = { weeks, values };
                  console.log(`✅ [절기별 비교] ${season}절기 CSV 데이터 로드 완료 (직접 계산)`, {
                    weeks: weeks.length,
                    values: values.length,
                  });
                }
              } else {
                console.warn(`⚠️ [절기별 비교] ${season}절기 CSV 데이터도 없음`);
              }
            } catch (csvErr) {
              console.warn(`⚠️ [절기별 비교] ${season}절기 CSV 데이터 로드 실패:`, csvErr.message);
            }
          }
        } catch (err) {
          console.warn(`⚠️ [절기별 비교] ${season}절기 데이터 로드 실패:`, err.message);
          
          // API 실패 시 CSV로 폴백
          try {
            console.log(`📂 [절기별 비교] ${season}절기 API 실패, CSV 데이터로 폴백`);
            const csvData = await loadHistoricalCSVData(defaultDSID);
            const csvETLData = convertCSVToETLFormat(csvData);
            
            const [year1, year2] = season.split('/').map(y => parseInt('20' + y));
            const filteredCSVData = csvETLData.filter(item => {
              try {
                const parsedData = JSON.parse(item.parsedData || '[]');
                if (Array.isArray(parsedData) && parsedData.length > 0) {
                  const firstRow = parsedData[0];
                  const year = parseInt(firstRow['연도'] || firstRow['﻿연도'] || '0');
                  const week = parseInt(firstRow['주차'] || '0');
                  
                  if (year === year1 && week >= 36) return true;
                  if (year === year2 && week <= 35) return true;
                  return false;
                }
              } catch (e) {
                return false;
              }
              return false;
            });
            
            if (filteredCSVData.length > 0) {
              const processedData = processETLData(filteredCSVData);
              const seasonKey = `${season}절기`;
              
              if (processedData && processedData.seasons && processedData.seasons[seasonKey]) {
                newSeasonData[seasonKey] = processedData.seasons[seasonKey];
                console.log(`✅ [절기별 비교] ${season}절기 CSV 데이터 로드 완료 (폴백)`, processedData.seasons[seasonKey]);
              } else if (processedData && processedData.weeks && processedData.values) {
                const allAgeGroups = Object.keys(processedData.values).filter(ageGroup => {
                  const isSeason = /^\d{2}\/\d{2}절기$/.test(ageGroup);
                  return !isSeason;
                });
                
                const weeks = processedData.weeks;
                const values = weeks.map((week, index) => {
                  const validValues = allAgeGroups
                    .map(ageGroup => processedData.values[ageGroup]?.[index])
                    .filter(val => val !== null && val !== undefined);
                  
                  if (validValues.length === 0) return null;
                  return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
                });
                
                newSeasonData[seasonKey] = { weeks, values };
                console.log(`✅ [절기별 비교] ${season}절기 CSV 데이터 로드 완료 (폴백, 직접 계산)`, {
                  weeks: weeks.length,
                  values: values.length,
                });
              }
            }
          } catch (csvErr) {
            console.warn(`⚠️ [절기별 비교] ${season}절기 CSV 폴백도 실패:`, csvErr.message);
          }
        }
      }

      // 이미 로드된 키만 있는 경우에는 setState를 하지 않아 루프/불필요 렌더링을 방지
      if (Object.keys(newSeasonData).length !== initialKeyCount) {
        setSeasonComparisonData(newSeasonData);
      }
    };

    // 절기별 비교 모드일 때만 데이터 로드
    if (viewMode === 'season' && selectedSeasons.length > 0) {
      loadSeasonData();
    }
  }, [selectedSeasons, viewMode, defaultDSID, seasonComparisonData]);

  // 유행단계 및 주간 요약 데이터 상태 (향후 API 연동 예정)
  const stageData = null;
  const weeklySummaryData = null;

  // 유행기준 상태
  const [epidemicThreshold, setEpidemicThreshold] = useState(9.1);

  // 유행기준 계산 함수 (과거 3년간 비유행기간의 ILI 분율 평균 + 2×표준편차)
  useEffect(() => {
    const calculateThreshold = async () => {
      try {
        // 과거 3년간 데이터 수집 (현재 연도 기준 3년 전부터)
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - 3;
        
        // 1. ILI 데이터 로드 (ds_0101)
        const iliCsvData = await loadHistoricalCSVData('ds_0101');
        if (!iliCsvData || iliCsvData.length === 0) {
          setEpidemicThreshold(9.1); // 기본값
          return;
        }
        
        // 2. 검출률 데이터 로드 (ds_0106)
        const detectionCsvData = await loadHistoricalCSVData('ds_0106');
        if (!detectionCsvData || detectionCsvData.length === 0) {
          console.warn('⚠️ [유행기준 계산] 검출률 데이터가 없어 모든 기간의 ILI 데이터를 사용합니다.');
        }
        
        // 3. ILI 데이터를 연도-주차별로 그룹화
        const iliDataByYearWeek = new Map();
        iliCsvData.forEach(row => {
          const year = parseInt(row['연도'] || row['연도 '] || '0');
          const week = parseInt(row['주차'] || row['주차 '] || '0');
          const iliValue = parseFloat(row['의사환자 분율'] || row['의사환자 분율 '] || '0');
          
          if (year >= startYear && week >= 1 && week <= 53 && !isNaN(iliValue) && iliValue > 0) {
            const key = `${year}-${week}`;
            if (!iliDataByYearWeek.has(key)) {
              iliDataByYearWeek.set(key, { year, week, iliValues: [] });
            }
            iliDataByYearWeek.get(key).iliValues.push(iliValue);
          }
        });
        
        // 4. 검출률 데이터를 연도-주차별로 그룹화하고 평균 계산
        const detectionRateByYearWeek = new Map();
        if (detectionCsvData && detectionCsvData.length > 0) {
          detectionCsvData.forEach(row => {
            const year = parseInt(row['연도'] || row['연도 '] || '0');
            const week = parseInt(row['주차'] || row['주차 '] || '0');
            const detectionRate = parseFloat(row['인플루엔자 검출률'] || row['인플루엔자 검출률 '] || '0');
            
            if (year >= startYear && week >= 1 && week <= 53 && !isNaN(detectionRate)) {
              const key = `${year}-${week}`;
              if (!detectionRateByYearWeek.has(key)) {
                detectionRateByYearWeek.set(key, { year, week, rates: [] });
              }
              detectionRateByYearWeek.get(key).rates.push(detectionRate);
            }
          });
        }
        
        // 5. 각 주차별 검출률 평균 계산
        const avgDetectionRateByWeek = new Map();
        detectionRateByYearWeek.forEach((data, key) => {
          const avgRate = data.rates.reduce((sum, val) => sum + val, 0) / data.rates.length;
          avgDetectionRateByWeek.set(key, { year: data.year, week: data.week, avgRate });
        });
        
        // 6. 연속된 2주 이상 검출률이 2% 미만인 기간 찾기
        const nonEpidemicWeeks = new Set();
        
        if (avgDetectionRateByWeek.size > 0) {
          // 주차를 정렬 (연도 -> 주차 순서)
          const sortedWeeks = Array.from(avgDetectionRateByWeek.entries())
            .map(([key, data]) => ({ key, ...data }))
            .sort((a, b) => {
              if (a.year !== b.year) return a.year - b.year;
              return a.week - b.week;
            });
          
          // 연속된 주차 찾기 (2주 이상 2% 미만)
          let consecutiveCount = 0;
          let consecutiveStartIndex = -1;
          
          for (let i = 0; i < sortedWeeks.length; i++) {
            const { avgRate } = sortedWeeks[i];
            
            if (avgRate < 2.0) {
              if (consecutiveCount === 0) {
                consecutiveStartIndex = i;
              }
              consecutiveCount++;
            } else {
              // 검출률이 2% 이상이면 연속 카운트 리셋
              if (consecutiveCount >= 2) {
                // 2주 이상 연속이면 해당 기간을 비유행기간으로 추가
                for (let j = consecutiveStartIndex; j < i; j++) {
                  nonEpidemicWeeks.add(sortedWeeks[j].key);
                }
              }
              consecutiveCount = 0;
              consecutiveStartIndex = -1;
            }
          }
          
          // 마지막 연속 기간 처리
          if (consecutiveCount >= 2) {
            for (let j = consecutiveStartIndex; j < sortedWeeks.length; j++) {
              nonEpidemicWeeks.add(sortedWeeks[j].key);
            }
          }
        }
        
        // 7. 비유행기간의 ILI 분율만 수집
        const iliValues = [];
        iliDataByYearWeek.forEach((data, key) => {
          // 검출률 데이터가 있고, 비유행기간에 포함된 경우만 사용
          if (detectionCsvData && detectionCsvData.length > 0) {
            if (nonEpidemicWeeks.has(key)) {
              const avgIli = data.iliValues.reduce((sum, val) => sum + val, 0) / data.iliValues.length;
              iliValues.push(avgIli);
            }
          } else {
            // 검출률 데이터가 없으면 모든 기간 사용
            const avgIli = data.iliValues.reduce((sum, val) => sum + val, 0) / data.iliValues.length;
            iliValues.push(avgIli);
          }
        });
        
        if (iliValues.length === 0) {
          console.warn('⚠️ [유행기준 계산] 비유행기간 ILI 데이터가 없어 기본값을 사용합니다.');
          setEpidemicThreshold(9.1); // 기본값
          return;
        }
        
        // 8. 평균 계산
        const mean = iliValues.reduce((sum, val) => sum + val, 0) / iliValues.length;
        
        // 9. 표준편차 계산
        const variance = iliValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / iliValues.length;
        const stdDev = Math.sqrt(variance);
        
        // 10. 유행기준 = 평균 + (2 × 표준편차)
        const threshold = mean + (2 * stdDev);
        
        console.log(`📊 [유행기준 계산] 과거 3년간 비유행기간 데이터: ${iliValues.length}주차, 평균: ${mean.toFixed(2)}, 표준편차: ${stdDev.toFixed(2)}, 유행기준: ${threshold.toFixed(2)}`);
        if (detectionCsvData && detectionCsvData.length > 0) {
          console.log(`✅ [유행기준 계산] 검출률 데이터 기반 필터링 완료 (2주 이상 2% 미만 기간: ${nonEpidemicWeeks.size}주차)`);
        }
        
        setEpidemicThreshold(threshold);
      } catch (error) {
        console.error('유행기준 계산 실패:', error);
        setEpidemicThreshold(9.1); // 기본값
      }
    };
    
    calculateThreshold();
  }, [defaultDSID]);

  // 유행단계별 이모지 및 정보 반환 함수
  // 기준: 비유행(유행기준 이하), 보통(유행기준 5배 이하), 높음(유행기준 10배 이하), 매우 높음(유행기준 10배 초과)
  const getInfluenzaStageInfo = (value, threshold = null) => {
    const thresholdValue = threshold || epidemicThreshold;
    const threshold5x = thresholdValue * 5;
    const threshold10x = thresholdValue * 10;
    
    if (value > threshold10x) {
      // 매우 높음: 유행기준 10배 초과
      return {
        image: '/images/화남.png',
        stage: '매우 높음',
        color: '#dc2626',
        description: `(유행기준 ${threshold10x.toFixed(2)} 초과)`,
      };
    } else if (value > threshold5x) {
      // 높음: 유행기준 5배 초과 ~ 유행기준 10배 이하
      return {
        image: '/images/화남.png',
        stage: '높음',
        color: '#ef4444',
        description: `(유행기준 ${threshold5x.toFixed(2)} 초과 ~ ${threshold10x.toFixed(2)} 이하)`,
      };
    } else if (value > thresholdValue) {
      // 보통: 유행기준 초과 ~ 유행기준 5배 이하
      return {
        image: '/images/보통.png',
        stage: '보통',
        color: '#f59e0b',
        description: `(유행기준 ${thresholdValue.toFixed(2)} 초과 ~ ${threshold5x.toFixed(2)} 이하)`,
      };
    } else {
      // 비유행: 유행기준 이하
      return {
        image: '/images/웃음.png',
        stage: '비유행',
        color: '#22c55e',
        description: `(유행기준 ${thresholdValue.toFixed(2)} 이하)`,
      };
    }
  };

  // 최신 ILI 데이터와 예측값을 반영한 유행 단계 계산
  const calculateCurrentStageValue = useMemo(() => {
    // 최신 ILI 값 가져오기
    const iliValues = influenzaData?.ili?.values || [];
    const latestIliValue = iliValues.length > 0 ? iliValues[iliValues.length - 1] : null;
    
    // 예측값이 있으면 예측값 중 최대값 사용, 없으면 최신 ILI 값 사용
    let stageValue = null;
    
    if (predictionData && predictionData.predictions && predictionData.predictions.length > 0) {
      // 예측값 중 최대값 사용 (향후 유행 가능성 고려)
      const maxPrediction = Math.max(...predictionData.predictions);
      // 최신 ILI 값과 예측 최대값 중 큰 값 사용
      stageValue = latestIliValue !== null 
        ? Math.max(latestIliValue, maxPrediction)
        : maxPrediction;
    } else if (latestIliValue !== null) {
      // 예측값이 없으면 최신 ILI 값 사용
      stageValue = latestIliValue;
    }
    
    // 값이 없으면 기본값 사용
    return stageValue !== null ? stageValue : (stageData?.current || 9.5);
  }, [influenzaData, predictionData, stageData]);

  // 주간 유행단계 데이터 (최신 ILI 데이터 기반으로 계산)
  const weeklyStageData = useMemo(() => {
    const iliValues = influenzaData?.ili?.values || [];
    
    if (iliValues.length === 0) {
      return stageData?.weekly || [
        { week: '1주전', value: 4.9 },
        { week: '2주전', value: 4.6 },
        { week: '4주전', value: 3.1 },
      ];
    }
    
    // 최근 4주 데이터 사용 (데이터가 있으면)
    const recentCount = Math.min(4, iliValues.length);
    const weeklyData = [];
    
    for (let i = recentCount - 1; i >= 0; i--) {
      const weekIndex = iliValues.length - 1 - i;
      if (weekIndex >= 0 && iliValues[weekIndex] !== null && iliValues[weekIndex] !== undefined) {
        const weekLabel = recentCount - i === 1 ? '현재' : `${recentCount - i}주전`;
        weeklyData.push({
          week: weekLabel,
          value: iliValues[weekIndex],
        });
      }
    }
    
    // 데이터가 부족하면 기본값으로 채움
    while (weeklyData.length < 3) {
      weeklyData.push({
        week: `${weeklyData.length + 1}주전`,
        value: weeklyData.length > 0 ? weeklyData[weeklyData.length - 1].value : 4.9,
      });
    }
    
    return weeklyData;
  }, [influenzaData, stageData]);

  const currentStageValue = calculateCurrentStageValue;
  const currentStageInfo = getInfluenzaStageInfo(currentStageValue, epidemicThreshold);

  // Feature Importance 데이터
  const featureImportanceData = [
    { feature: 'tidx', description: '시계열 분석을 위한 전체 기간 내 고유 시간 인덱스', importance: 0.28 },
    { feature: 'ili', description: '인플루엔자 유사 질환 발생률 또는 보고 건수', importance: 0.24 },
    { feature: 'vaccine_rate', description: '해당 주차 또는 시즌의 인플루엔자 백신 접종률(%)', importance: 0.18 },
    { feature: 'case_count', description: '중증급성호흡기감염증, 급성호흡기감염증 환자 중 인플루엔자 환자 수', importance: 0.15 },
    { feature: 'week_avg_temp', description: '해당 주차의 평균 기온(℃)', importance: 0.08 },
    { feature: 'week_avg_rain', description: '해당 주차의 평균 강수량(mm)', importance: 0.04 },
    { feature: 'week_avg_humidity', description: '해당 주차의 평균 습도(%)', importance: 0.03 },
  ];

  // Feature Importance 페이지네이션
  const [currentFeaturePage, setCurrentFeaturePage] = useState(0);
  const itemsPerPage = 4;
  const totalPages = Math.ceil(featureImportanceData.length / itemsPerPage);
  const currentFeatures = featureImportanceData.slice(
    currentFeaturePage * itemsPerPage,
    (currentFeaturePage + 1) * itemsPerPage
  );

  // 주간 지표 요약 데이터 (최신 ILI 데이터와 예측값 반영)
  const weeklySummaryMetrics = useMemo(() => {
    const baseMetrics = weeklySummaryData || [
      {
        title: '주간 신규 환자',
        value: '324명',
        change: '+18.2%',
        description: '이번 주 신규 확진자',
      },
      {
        title: '주간 평균 기온',
        value: '4.2°C',
        change: '-2.1°C',
        description: '지난주 대비 기온 변화',
      },
      {
        title: '주간 접종 완료',
        value: '2,156명',
        change: '+5.4%',
        description: '이번 주 백신 접종자',
      },
      {
        title: '주간 유행 지수',
        value: currentStageValue.toFixed(2),
        change: weeklyStageData.length > 1 && weeklyStageData[0]?.value && weeklyStageData[1]?.value
          ? (weeklyStageData[0].value - weeklyStageData[1].value >= 0 ? '+' : '') + 
            (weeklyStageData[0].value - weeklyStageData[1].value).toFixed(1)
          : '+0.0',
        description: currentStageValue >= epidemicThreshold ? `유행기준(${epidemicThreshold.toFixed(2)}) 초과` : `유행기준(${epidemicThreshold.toFixed(2)}) 미만`,
      },
    ];
    
    // 유행 지수 항목만 업데이트
    const updatedMetrics = [...baseMetrics];
    const stageIndex = updatedMetrics.findIndex(m => m.title === '주간 유행 지수');
    if (stageIndex !== -1) {
      updatedMetrics[stageIndex] = {
        title: '주간 유행 지수',
        value: currentStageValue.toFixed(2),
        change: weeklyStageData.length > 1 && weeklyStageData[0]?.value && weeklyStageData[1]?.value
          ? (weeklyStageData[0].value - weeklyStageData[1].value >= 0 ? '+' : '') + 
            (weeklyStageData[0].value - weeklyStageData[1].value).toFixed(1)
          : '+0.0',
        description: currentStageValue >= epidemicThreshold ? `유행기준(${epidemicThreshold.toFixed(2)}) 초과` : `유행기준(${epidemicThreshold.toFixed(2)}) 미만`,
      };
    }
    
    return updatedMetrics;
  }, [weeklySummaryData, currentStageValue, weeklyStageData, epidemicThreshold]);

  const handleNewsDialogClose = () => {
    setNewsDialogOpen(false);
    setNewsSelected(null);
    newsIframeLoadedRef.current = false;
    if (newsFallbackTimerRef.current) {
      clearTimeout(newsFallbackTimerRef.current);
      newsFallbackTimerRef.current = null;
    }
  };

  const handleWeeklyReportDialogClose = () => {
    setWeeklyReportDialogOpen(false);
  };

  const handleInfluenzaDialogClose = () => {
    setInfluenzaDialogOpen(false);
  };

  const handleHospitalSearchClose = () => {
    setHospitalSearchOpen(false);
  };

  // API 데이터 로딩은 useInfluenzaData 훅에서 처리됨

  // 사이드바 메뉴에서 병원 찾기 클릭 시 다이얼로그 열기
  useEffect(() => {
    if (shouldOpenHospitalMap) {
      setHospitalSearchOpen(true);
      if (onHospitalMapOpened) {
        onHospitalMapOpened();
      }
    }
  }, [shouldOpenHospitalMap, onHospitalMapOpened]);

  // 사이드바 메뉴 클릭 시 다이얼로그 열기
  useEffect(() => {
    if (activeMenuId === 'weekly') {
      setWeeklyReportDialogOpen(true);
    } else if (activeMenuId === 'influenza') {
      setInfluenzaDialogOpen(true);
    }
  }, [activeMenuId]);



  // API 데이터로 graphChoices 업데이트
  const updatedGraphChoices = useMemo(() => {
    return graphChoices.map(choice => {
      const dataKey = choice.id;
      const apiData = influenzaData[dataKey];
      
      if (apiData && apiData.weeks && apiData.values) {
        // ILI 데이터이고 연령대 필터가 선택된 경우
        let displayValues = apiData.values;
        let displayWeeks = apiData.weeks;
        
        if (dataKey === 'ili' && selectedAgeGroup && apiData.ageGroups && apiData.ageGroups[selectedAgeGroup]) {
          // 선택된 연령대의 데이터 사용
          displayValues = apiData.ageGroups[selectedAgeGroup].values;
          displayWeeks = apiData.ageGroups[selectedAgeGroup].weeks;
        }
        
        // 주차/값 쌍을 먼저 만들고, 유효한 것만 정렬/필터링한다.
        // (일부 절기/연령대에서 weeks에 undefined가 섞이면 sortWeeksBySeason 내부 a.toString()이 크래시 날 수 있음)
        const weekValuePairs = (Array.isArray(displayWeeks) ? displayWeeks : []).map((week, index) => ({
          week,
          value: Array.isArray(displayValues) ? displayValues[index] : undefined,
        }));

        const validWeekValuePairs = weekValuePairs
          .filter(pair => pair.week !== null && pair.week !== undefined && pair.week !== '')
          .filter(pair => pair.value !== null && pair.value !== undefined)
          .sort((a, b) => sortWeeksBySeason(a.week, b.week));

        const finalWeeks = validWeekValuePairs.map(pair => pair.week);
        const finalValues = validWeekValuePairs.map(pair => pair.value);
        
        return {
          ...choice,
          weeks: finalWeeks,
          values: finalValues,
          data: createLineConfig(finalWeeks, finalValues),
        };
      }
      return choice;
    });
  }, [influenzaData, selectedAgeGroup]);

  const selectedGraph = useMemo(
    () => updatedGraphChoices.find(graph => graph.id === selectedGraphId) ?? updatedGraphChoices[0],
    [selectedGraphId, updatedGraphChoices],
  );

  // 예측값이 포함된 차트 데이터 생성 (25/26절기 ILI만)
  const chartDataWithPrediction = useMemo(() => {
    // 25/26절기이고 ILI 그래프이고 예측 데이터가 있는 경우만 예측값 표시
    if (selectedSeason !== '25/26' || selectedGraphId !== 'ili' || !predictionData || !selectedGraph) {
      return null; // 예측값이 없으면 null 반환 (기본 차트 사용)
    }

    const weeks = selectedGraph.weeks || [];
    const values = selectedGraph.values || [];
    const predictions = predictionData.predictions || [];

    if (predictions.length === 0) {
      return selectedGraph.data;
    }

    // 주차/값이 없으면 예측 주차를 계산할 수 없으므로 기본 차트로 폴백
    if (!Array.isArray(weeks) || weeks.length === 0 || !Array.isArray(values) || values.length === 0) {
      return selectedGraph.data;
    }

    // 마지막 주차에서 다음 주차들 계산
    const lastWeek = weeks[weeks.length - 1];
    if (lastWeek === null || lastWeek === undefined) {
      return selectedGraph.data;
    }
    const lastWeekStr = lastWeek.toString().replace(/주/g, '').trim();
    let lastWeekNum = parseInt(lastWeekStr) || 0;

    // 예측 주차 생성 (3주차, 4주차, 5주차)
    const predictionWeeks = [];
    for (let i = 1; i <= predictions.length; i++) {
      let weekNum = lastWeekNum + i;
      // 53주를 넘어가면 다음 해 1주로
      if (weekNum > 53) {
        weekNum = weekNum - 53;
      }
      predictionWeeks.push(`${weekNum}주`);
    }

    // 전체 주차 결합 (x축)
    const allWeeks = [...weeks, ...predictionWeeks];

    // 실제 데이터와 예측 데이터 구분
    const actualData = [...values, ...new Array(predictions.length).fill(null)];
    const predictedData = [
      ...new Array(values.length - 1).fill(null),
      values[values.length - 1], // 마지막 실제 값 (연결점)
      ...predictions
    ];

    // 주황색 정의
    const PREDICTION_COLOR = '#f97316'; // 주황색
    const PREDICTION_FILL = 'rgba(249, 115, 22, 0.2)';

    return {
      labels: allWeeks.map(label => {
        if (typeof label === 'string' && label.includes('주')) {
          return label.replace('주', '');
        }
        return label;
      }),
      datasets: [
        {
          label: '실제 의사환자 분율',
          data: actualData,
          borderColor: PRIMARY_COLOR,
          backgroundColor: PRIMARY_FILL,
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: PRIMARY_COLOR,
          pointBorderColor: '#0f172a',
          pointBorderWidth: 1.5,
        },
        {
          label: 'AI 예측',
          data: predictedData,
          borderColor: PREDICTION_COLOR,
          backgroundColor: PREDICTION_FILL,
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 4,
          pointBackgroundColor: PREDICTION_COLOR,
          pointBorderColor: '#0f172a',
          pointBorderWidth: 1.5,
        },
      ],
    };
  }, [selectedSeason, selectedGraphId, predictionData, selectedGraph]);

  const visitorOptions = useMemo(() => {
    const yAxisTitleText = getYAxisTitleText(selectedGraphId, selectedGraph.unit);
    const baseOptions = visitorOptionFactory(
      selectedGraph.formatter,
      selectedGraph.seasonLabel,
      selectedGraph.unit,
      yAxisTitleText
    );
    
    // 예측값이 있으면 범례 표시
    if (selectedSeason === '25/26' && selectedGraphId === 'ili' && predictionData) {
      return {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: {
                size: 11,
              },
              color: '#374151',
            },
          },
        },
      };
    }
    
    return baseOptions;
  }, [selectedGraph, selectedSeason, selectedGraphId, predictionData]);
  const selectedChange = useMemo(() => {
    const change = calculateWeekChange(selectedGraph?.values);
    const lastValue =
      selectedGraph?.values && selectedGraph.values.length
        ? selectedGraph.values[selectedGraph.values.length - 1]
        : null;
    if (change == null) {
      return {
        text: '전 주 대비 데이터 없음',
        color: 'rgba(107, 114, 128, 0.9)',
        valueText: '',
      };
    }
    const rounded = Number.isFinite(change) ? change : 0;
    const valueText =
      lastValue != null
        ? selectedGraph?.unit === '명'
          ? `${lastValue.toLocaleString()}명`
          : `${lastValue}${selectedGraph?.unit ?? ''}`
        : '';
    return {
      raw: rounded,
      text: `${rounded >= 0 ? '+' : ''}${rounded.toFixed(1)}%`,
      color: rounded >= 0 ? '#22c55e' : '#f87171',
      valueText,
    };
  }, [selectedGraph]);

  // 감염병 뉴스 전체 페이지 (Sidebar에서 '감염병 뉴스' 선택 시)
  if (activeMenuId === 'news') {
    return (
      <Box
        sx={{
          bgcolor: 'background.paper',
          minHeight: '100vh',
          pt: 2,
          pb: 4,
          marginLeft: isOpen ? '240px' : '64px',
          marginTop: '60px',
          transition: 'margin-left 0.3s ease',
        }}
      >
        <Container maxWidth="xl">
          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              감염병 뉴스
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Google News 기반으로 감염병 관련 최신 뉴스를 모아서 보여줍니다.
            </Typography>
          </Box>
          <Box sx={{ px: { xs: 0, md: 0 }, py: 1, height: { xs: 'calc(100vh - 140px)', md: 'calc(100vh - 150px)' }, overflow: 'auto' }}>
            {newsLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
                <CircularProgress size={28} sx={{ mr: 2 }} />
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                  뉴스를 불러오는 중...
                </Typography>
              </Box>
            ) : newsError ? (
              <Alert severity="warning">{newsError}</Alert>
            ) : newsItems.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 8 }}>
                표시할 뉴스가 없습니다.
              </Typography>
            ) : (
              <Stack spacing={1.25}>
                {newsItems.map((item) => (
                  <Paper
                    key={item.link}
                    elevation={0}
                    onClick={() => openNewsItem(item)}
                    sx={(theme) => ({
                      p: 2,
                      // 뉴스 카드는 둥근 모서리 대신 각지게
                      borderRadius: 0,
                      border: `1px solid ${theme.palette.divider}`,
                      bgcolor:
                        theme.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.04)'
                          : 'rgba(15, 23, 42, 0.02)',
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.06),
                      },
                    })}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 900, color: 'text.primary' }}>
                      {item.title}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.75 }}>
                      {item.source ? (
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>
                          {item.source}
                        </Typography>
                      ) : null}
                      {item.publishedAt ? (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {formatNewsTime(item.publishedAt)}
                        </Typography>
                      ) : null}
                      {item.keyword ? (
                        <Typography
                          variant="caption"
                          sx={(theme) => ({
                            color: 'text.secondary',
                            fontWeight: 800,
                            px: 1,
                            py: 0.25,
                            borderRadius: 1,
                            border: `1px solid ${theme.palette.divider}`,
                            bgcolor:
                              theme.palette.mode === 'dark'
                                ? alpha('#ffffff', 0.04)
                                : alpha('#0f172a', 0.02),
                          })}
                        >
                          {item.keyword}
                        </Typography>
                      ) : null}
                    </Box>
                  </Paper>
                ))}
              </Stack>
            )}
          </Box>
        </Container>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        bgcolor: 'background.default',
        minHeight: '100vh',
        pt: 2,
        pb: 4,
        marginLeft: isOpen ? '240px' : '64px',
        marginTop: '60px',
        transition: 'margin-left 0.3s ease',
      }}
    >
      <Container maxWidth="xl">
        {/* 로딩 상태 표시 */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
            <CircularProgress sx={{ mr: 2 }} />
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              데이터를 불러오는 중...
            </Typography>
          </Box>
        )}

        {/* 에러 상태 표시 */}
        {error && (
          <Alert 
            severity="info" 
            sx={{ mb: 3 }}
            onClose={() => setError(null)}
          >
            {error}
            <Box sx={{ mt: 1, fontSize: '0.875rem', color: '#6b7280' }}>
              브라우저 개발자 도구(F12)의 콘솔에서 자세한 에러 정보를 확인할 수 있습니다.
            </Box>
          </Alert>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box />
          </Box>

          {/* 같은 row(그래프/카드)의 높낮이를 맞추기 위해 stretch 적용 */}
          <Grid container spacing={3} alignItems="stretch">
              <Grid item xs={12} md={4}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    bgcolor: 'background.paper',
                    borderRadius: 3,
                    boxShadow: 2,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 2.5 }}>
                    인플루엔자 유행단계
                  </Typography>
                  <Box
                    sx={(theme) => ({
                      // 유행단계 카드 내부의 "회색 칸(배경/테두리)" 제거
                      bgcolor: 'transparent',
                      borderRadius: 0,
                      p: { xs: 2, md: 2.5 },
                      border: 'none',
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                    })}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                      {/* 1) 게이지: 항상 최상단 */}
                      <EpidemicGauge threshold={epidemicThreshold} value={currentStageValue} />

                      {/* 2) 현재 단계/설명 */}
                      <Box sx={{ textAlign: 'center', mt: -0.75 }}>
                        <Typography variant="body2" sx={{ fontWeight: 900, color: 'text.primary' }}>
                          {currentStageInfo.stage}
                        </Typography>
                      </Box>

                      {/* 3) 유행기준/범례: 게이지 아래 */}
                      <EpidemicLegend
                        seasonLabel={`${selectedSeason}절기`}
                        threshold={epidemicThreshold}
                        currentStage={currentStageInfo.stage}
                      />

                      {/* 4) 주간 추이: 원래 위치(유행단계 카드 하단)로 복귀 */}
                      <Box sx={{ mt: 2 }}>
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.secondary', fontWeight: 900, display: 'block', mb: 0.75 }}
                        >
                          주간 추이
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                          {(weeklyStageData || []).slice(0, 4).map((d) => (
                            <Typography
                              key={d.week}
                              variant="body2"
                              sx={{ color: 'text.secondary', fontWeight: 800, whiteSpace: 'nowrap' }}
                            >
                              {d.week} {typeof d.value === 'number' ? d.value.toFixed(2) : '-'}
                            </Typography>
                          ))}
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} md={8}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    bgcolor: 'background.paper',
                    borderRadius: 3,
                    boxShadow: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 800 }}>
                        {selectedGraph.label}
                      </Typography>
                      {selectedChange?.valueText ? (
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
                          <Typography variant="h4" sx={{ fontWeight: 900, color: 'text.primary', letterSpacing: '-0.02em' }}>
                            {selectedChange.valueText}
                          </Typography>
                          {selectedChange?.text ? (
                            <Typography variant="body1" sx={{ fontWeight: 800, color: selectedChange.color }}>
                              {selectedChange.text}
                            </Typography>
                          ) : null}
                        </Box>
                      ) : null}
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {/* 절기 선택 */}
                      <FormControl sx={{ minWidth: 110 }}>
                        <Select
                          value={selectedSeason}
                          onChange={(e) => {
                            setSelectedSeason(e.target.value);
                          }}
                          displayEmpty
                          size="small"
                        >
                          {SEASON_OPTIONS.map((season) => (
                            <MenuItem 
                              key={season} 
                              value={season}
                            >
                              {season}절기
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      {/* 연령대별 필터: 절기 옆 드롭다운 바(ILI 단일 모드) */}
                      {selectedGraphId === 'ili' && viewMode === 'single' && influenzaData.ili && influenzaData.ili.ageGroups ? (
                        <FormControl sx={{ minWidth: 130 }}>
                          <Select
                            value={selectedAgeGroup ?? 'all'}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSelectedAgeGroup(v === 'all' ? null : v);
                            }}
                            size="small"
                            renderValue={(selected) => (selected === 'all' ? '전체 평균' : selected)}
                          >
                            <MenuItem value="all">전체 평균</MenuItem>
                            {sortAgeGroups(
                              Object.keys(influenzaData.ili.ageGroups).filter((ageGroup) => {
                                const isSeason = /^\d{2}\/\d{2}$/.test(ageGroup);
                                return (
                                  !isSeason &&
                                  (ageGroup.includes('세') || ageGroup === '0세' || ageGroup === '연령미상')
                                );
                              }),
                            ).map((ageGroup) => (
                              <MenuItem key={ageGroup} value={ageGroup}>
                                {ageGroup}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : null}
                      
                      {/* 지표 선택 */}
                      <FormControl sx={{ minWidth: 130 }}>
                        <Select
                          value={selectedGraphId}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === 'main') {
                              // 메인페이지로 리셋
                              setSelectedGraphId('ili');
                              setViewMode('single');
                              setSelectedSeason(SEASON_OPTIONS[0]);
                              setSelectedAgeGroup(null);
                            } else {
                              setSelectedGraphId(value);
                            }
                          }}
                          displayEmpty
                          renderValue={(selected) => {
                            if (selected === 'main') {
                              return '메인페이지';
                            }
                            const selectedOption = graphChoices.find(option => option.id === selected);
                            return selectedOption ? selectedOption.shorthand : '';
                          }}
                        >
                          <MenuItem 
                            value="main"
                          >
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                메인페이지
                              </Typography>
                            </Box>
                          </MenuItem>
                          {graphChoices.map((option) => (
                            <MenuItem 
                              key={option.id} 
                              value={option.id}
                            >
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {option.shorthand}: {option.label}
                                </Typography>
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                    
                    {/* 절기별 비교 차트 선택 UI (viewMode가 'season'일 때만 표시) */}
                    {selectedGraphId === 'ili' && viewMode === 'season' && influenzaData.ili && influenzaData.ili.seasons && (
                      <Box sx={{ mt: 2, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {Object.keys(influenzaData.ili.seasons)
                          .sort()
                          .map((season) => {
                            const seasonKey = season.replace('절기', '');
                            return (
                              <FormControlLabel
                                key={season}
                                control={
                                  <Checkbox
                                    checked={selectedSeasons.includes(seasonKey)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedSeasons([...selectedSeasons, seasonKey]);
                                      } else {
                                        setSelectedSeasons(selectedSeasons.filter(s => s !== seasonKey));
                                      }
                                    }}
                                    size="small"
                                  />
                                }
                                label={season}
                                sx={{ fontSize: '0.875rem' }}
                              />
                            );
                          })}
                      </Box>
                    )}

                    {/* 연령대별 비교 차트 선택 UI (viewMode가 'ageGroup'일 때만 표시) */}
                    {selectedGraphId === 'ili' && viewMode === 'ageGroup' && influenzaData.ili && influenzaData.ili.ageGroups && (
                      <Box sx={{ mt: 2, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {sortAgeGroups(Object.keys(influenzaData.ili.ageGroups)
                          .filter(ageGroup => {
                            const isSeason = /^\d{2}\/\d{2}$/.test(ageGroup);
                            return !isSeason && (ageGroup.includes('세') || ageGroup === '0세' || ageGroup === '연령미상');
                          }))
                          .map((ageGroup) => (
                            <FormControlLabel
                              key={ageGroup}
                              control={
                                <Checkbox
                                  checked={selectedAgeGroups.includes(ageGroup)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedAgeGroups([...selectedAgeGroups, ageGroup]);
                                    } else {
                                      setSelectedAgeGroups(selectedAgeGroups.filter(a => a !== ageGroup));
                                    }
                                  }}
                                  size="small"
                                />
                              }
                              label={ageGroup}
                              sx={{ fontSize: '0.875rem' }}
                            />
                          ))}
                      </Box>
                    )}

                  </Box>

                  {(!selectedChange?.valueText || !selectedChange?.text) && (
                    <Typography
                      variant="body1"
                      sx={{
                        color: selectedChange?.color ?? 'rgba(148, 163, 184, 0.8)',
                        mt: 2,
                        display: 'block',
                        fontWeight: 600,
                      }}
                    >
                      {selectedChange?.text ?? '전 주 대비 변화 데이터 없음'}
                    </Typography>
                  )}
                  {/* 아래 빈공간이 생기지 않도록: 늘어난 높이는 차트 영역이 가져가게 한다 */}
                  {/* 필터 안내문구 제거로 확보된 세로 공간만큼 차트 영역을 조금 더 키움 */}
                  {/* 위/아래 여백을 늘려 차트가 덜 커 보이게 */}
                  <Box sx={{ flex: 1, minHeight: 200, mt: 5 }}>
                    {loading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        <CircularProgress size={40} />
                        <Typography variant="body2" sx={{ color: 'rgba(148, 163, 184, 0.7)', ml: 2 }}>
                          데이터를 불러오는 중...
                        </Typography>
                      </Box>
                    ) : selectedGraphId === 'ili' && viewMode === 'season' ? (
                      // 절기별 비교 차트
                      (() => {
                        // 절기별 데이터 처리 (기존 데이터 + 체크박스로 로드한 데이터 병합)
                        const allSeasons = {
                          ...(influenzaData.ili?.seasons || {}),
                          ...seasonComparisonData,
                        };
                        
                        const seasonKeys = Object.keys(allSeasons)
                          .filter(season => selectedSeasons.includes(season.replace('절기', '')))
                          .sort();
                        
                        if (seasonKeys.length === 0) {
                          return (
                            <Typography variant="body2" sx={{ color: 'rgba(148, 163, 184, 0.7)', textAlign: 'center', py: 8 }}>
                              비교할 절기를 선택해주세요.
                            </Typography>
                          );
                        }
                        
                        // 데이터가 있는 절기만 필터링
                        const validSeasonKeys = seasonKeys.filter(season => {
                          const seasonData = allSeasons[season];
                          return seasonData && seasonData.weeks && seasonData.weeks.length > 0;
                        });
                        
                        if (validSeasonKeys.length === 0) {
                          return (
                            <Typography variant="body2" sx={{ color: 'rgba(148, 163, 184, 0.7)', textAlign: 'center', py: 8 }}>
                              절기별 데이터를 불러오는 중...
                            </Typography>
                          );
                        }
                        
                        const allWeeks = new Set();
                        validSeasonKeys.forEach(season => {
                          const seasonData = allSeasons[season];
                          if (seasonData && seasonData.weeks) {
                            seasonData.weeks.forEach(week => allWeeks.add(week));
                          }
                        });
                        
                        // 절기별 주차 정렬: 36주부터 시작해서 다음 해 35주까지
                        const sortedWeeks = Array.from(allWeeks).sort((a, b) => sortWeeksBySeason(a, b));
                        
                        const datasets = validSeasonKeys.map((season, index) => {
                          const seasonData = allSeasons[season];
                          // 절기별 고정 색상 사용
                          const color = seasonColorMap[season] || seasonColors[index % seasonColors.length];
                          
                          const values = sortedWeeks.map(week => {
                            const weekIndex = seasonData.weeks.indexOf(week);
                            return weekIndex >= 0 ? (seasonData.values[weekIndex] ?? null) : null;
                          });
                          
                          return {
                            label: season,
                            data: values,
                            borderColor: color.border,
                            backgroundColor: color.fill,
                            fill: false,
                            tension: 0.35,
                            borderWidth: 2,
                            pointRadius: 2,
                            pointBackgroundColor: color.border,
                            pointBorderColor: '#0f172a',
                            pointBorderWidth: 1,
                          };
                        });
                        
                        return (
                          <Line
                            data={createComparisonChartConfig(sortedWeeks, datasets)}
                            options={comparisonChartOptionFactory(getYAxisTitleText(selectedGraphId, selectedGraph?.unit))}
                          />
                        );
                      })()
                    ) : selectedGraphId === 'ili' && viewMode === 'ageGroup' ? (
                      // 연령대별 비교 차트
                      (() => {
                        if (!influenzaData.ili || !influenzaData.ili.ageGroups) {
                          return (
                            <Typography variant="body2" sx={{ color: 'rgba(148, 163, 184, 0.7)', textAlign: 'center', py: 8 }}>
                              연령대별 데이터를 불러오는 중...
                            </Typography>
                          );
                        }
                        const ageGroupKeys = sortAgeGroups(Object.keys(influenzaData.ili.ageGroups)
                          .filter(ageGroup => {
                            const isSeason = /^\d{2}\/\d{2}$/.test(ageGroup);
                            return !isSeason && (ageGroup.includes('세') || ageGroup === '0세' || ageGroup === '연령미상');
                          }))
                          .filter(ageGroup => selectedAgeGroups.includes(ageGroup));
                        
                        if (ageGroupKeys.length === 0) {
                          return (
                            <Typography variant="body2" sx={{ color: 'rgba(148, 163, 184, 0.7)', textAlign: 'center', py: 8 }}>
                              비교할 연령대를 선택해주세요.
                            </Typography>
                          );
                        }
                        
                        const allWeeks = new Set();
                        ageGroupKeys.forEach(ageGroup => {
                          const ageData = influenzaData.ili.ageGroups[ageGroup];
                          if (ageData && ageData.weeks) {
                            ageData.weeks.forEach(week => allWeeks.add(week));
                          }
                        });
                        const sortedWeeks = Array.from(allWeeks).sort((a, b) => {
                          // "32주" 형식에서 숫자만 추출
                          const weekAStr = a.toString().replace(/주/g, '').trim();
                          const weekBStr = b.toString().replace(/주/g, '').trim();
                          const weekA = parseInt(weekAStr) || 0;
                          const weekB = parseInt(weekBStr) || 0;
                          
                          if (isNaN(weekA) || isNaN(weekB)) {
                            return a.toString().localeCompare(b.toString());
                          }
                          
                          return weekA - weekB;
                        });
                        
                        const datasets = ageGroupKeys.map((ageGroup, index) => {
                          const ageData = influenzaData.ili.ageGroups[ageGroup];
                          // 연령대별 고정 색상 사용
                          const color = ageGroupColorMap[ageGroup] || ageGroupColors[index % ageGroupColors.length];
                          const values = sortedWeeks.map(week => {
                            const weekIndex = ageData.weeks.indexOf(week);
                            return weekIndex >= 0 ? (ageData.values[weekIndex] ?? null) : null;
                          });
                          
                          return {
                            label: ageGroup,
                            data: values,
                            borderColor: color.border,
                            backgroundColor: color.fill,
                            fill: false,
                            tension: 0.35,
                            borderWidth: 2,
                            pointRadius: 2,
                            pointBackgroundColor: color.border,
                            pointBorderColor: '#0f172a',
                            pointBorderWidth: 1,
                          };
                        });
                        
                        return (
                          <Line
                            data={createComparisonChartConfig(sortedWeeks, datasets)}
                            options={comparisonChartOptionFactory(getYAxisTitleText(selectedGraphId, selectedGraph?.unit))}
                          />
                        );
                      })()
                    ) : (
                      // 기본 단일 그래프 (예측값 포함 가능)
                      <Line 
                        data={chartDataWithPrediction || selectedGraph.data} 
                        options={visitorOptions} 
                      />
                    )}
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 3 }}>
                    {selectedGraph.description}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* 절기별 비교 차트 선택 UI (viewMode가 'season'일 때만 표시) */}
            {selectedGraphId === 'ili' && viewMode === 'season' && (
              <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {(() => {
                  // 기존 데이터와 체크박스로 로드한 데이터 병합
                  const allSeasons = {
                    ...(influenzaData.ili?.seasons || {}),
                    ...seasonComparisonData,
                  };
                  
                  // 사용 가능한 모든 절기 목록 (SEASON_OPTIONS 기반)
                  const availableSeasons = SEASON_OPTIONS.map(s => `${s}절기`);
                  
                  return availableSeasons
                  .filter(season => {
                    // 16/17절기는 데이터가 없으므로 제외
                    const seasonKey = season.replace('절기', '');
                    return seasonKey !== '16/17';
                  })
                  .map((season) => {
                    const seasonKey = season.replace('절기', '');
                      const hasData = !!allSeasons[season];
                      
                    return (
                      <FormControlLabel
                        key={season}
                        control={
                          <Checkbox
                            checked={selectedSeasons.includes(seasonKey)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSeasons([...selectedSeasons, seasonKey]);
                              } else {
                                setSelectedSeasons(selectedSeasons.filter(s => s !== seasonKey));
                              }
                            }}
                            size="small"
                          />
                        }
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography sx={{ fontSize: '0.875rem' }}>{season}</Typography>
                              {!hasData && selectedSeasons.includes(seasonKey) && (
                                <CircularProgress size={12} sx={{ ml: 0.5 }} />
                              )}
                            </Box>
                          }
                        sx={{ fontSize: '0.875rem' }}
                      />
                    );
                    });
                })()}
              </Box>
            )}

            {/* 연령대별 비교 차트 선택 UI (viewMode가 'ageGroup'일 때만 표시) */}
            {selectedGraphId === 'ili' && viewMode === 'ageGroup' && influenzaData.ili && influenzaData.ili.ageGroups && (
              <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {sortAgeGroups(Object.keys(influenzaData.ili.ageGroups)
                  .filter(ageGroup => {
                    const isSeason = /^\d{2}\/\d{2}$/.test(ageGroup);
                    return !isSeason && (ageGroup.includes('세') || ageGroup === '0세' || ageGroup === '연령미상');
                  }))
                  .map((ageGroup) => (
                    <FormControlLabel
                      key={ageGroup}
                      control={
                        <Checkbox
                          checked={selectedAgeGroups.includes(ageGroup)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAgeGroups([...selectedAgeGroups, ageGroup]);
                            } else {
                              setSelectedAgeGroups(selectedAgeGroups.filter(a => a !== ageGroup));
                            }
                          }}
                          size="small"
                        />
                      }
                      label={ageGroup}
                      sx={{ fontSize: '0.875rem' }}
                    />
                  ))}
              </Box>
            )}

            {/* 주간 지표 요약 + Feature Importance: 같은 row로 배치(디자인 유지, 배치만 변경) */}
            <Grid container spacing={3} alignItems="stretch" sx={{ mt: 0.5, mb: 0.5 }}>
              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    bgcolor: 'background.paper',
                    borderRadius: 3,
                    boxShadow: 2,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 2.5, fontSize: '1.35rem' }}>
                    주간 지표 요약
                  </Typography>
                  {/* 아래 빈공간이 생기면 KPI 카드들이 세로로 늘어나서 채우도록(Feature Importance 높이에 맞춰짐) */}
                  <Box
                    sx={{
                      flex: 1,
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                      gap: 2.5,
                      gridAutoRows: '1fr',
                    }}
                  >
                    {weeklySummaryMetrics.slice(0, 4).map((metric) => (
                      <Paper
                        key={metric.title}
                        elevation={0}
                        sx={{
                          p: 2.5,
                          borderRadius: 2,
                          bgcolor: 'background.paper',
                          height: '100%',
                          boxShadow: 2,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1.25,
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            sx={{ color: 'text.secondary', fontWeight: 700, fontSize: '1rem' }}
                          >
                            {metric.title}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800, mt: 1, fontSize: '2.1rem' }}>
                            {metric.value}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                          <Typography
                            variant="body2"
                            sx={{
                              color: metric.change?.toString().trim().startsWith('-') ? 'error.main' : 'success.main',
                              fontWeight: 800,
                              fontSize: '1rem',
                            }}
                          >
                            {metric.change}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
                            from last week
                          </Typography>
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    bgcolor: 'background.paper',
                    borderRadius: 3,
                    boxShadow: 2,
                    height: '100%',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      Feature Importance
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {Array.from({ length: totalPages }, (_, index) => (
                        <Box
                          key={index}
                          onClick={() => setCurrentFeaturePage(index)}
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: (theme) =>
                              currentFeaturePage === index ? theme.palette.primary.main : theme.palette.divider,
                            cursor: 'pointer',
                            transition: 'background-color 0.2s ease',
                          }}
                        />
                      ))}
                    </Box>
                  </Box>

                  {/* 테이블 헤더 */}
                  <Box sx={{ mb: 2 }}>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 240px 80px',
                        gap: 2,
                        p: 2,
                        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                        Feature
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                        Importance
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                        Value
                      </Typography>
                    </Box>
                  </Box>

                  {/* 테이블 내용 */}
                  <Stack spacing={1}>
                    {currentFeatures.map((item) => {
                      return (
                        <Box
                          key={item.feature}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 240px 80px',
                            gap: 2,
                            p: 2,
                            borderRadius: 2,
                            backgroundColor: (theme) =>
                              theme.palette.mode === 'dark'
                                ? 'rgba(255, 255, 255, 0.04)'
                                : 'rgba(15, 23, 42, 0.02)',
                            border: (theme) => `1px solid ${theme.palette.divider}`,
                            alignItems: 'center',
                          }}
                        >
                          <Box>
                            <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 700 }}>
                              {item.feature}
                            </Typography>
                          </Box>
                          <Box sx={{ width: '100%' }}>
                            <Box
                              sx={{
                                width: '100%',
                                height: 12,
                                backgroundColor: (theme) =>
                                  theme.palette.mode === 'dark'
                                    ? 'rgba(255, 255, 255, 0.06)'
                                    : 'rgba(148, 163, 184, 0.25)',
                                borderRadius: 2,
                                overflow: 'hidden',
                              }}
                            >
                              <Box
                                sx={(theme) => ({
                                  width: `${item.importance * 100}%`,
                                  height: '100%',
                                  backgroundColor: theme.palette.primary.main,
                                  borderRadius: 2,
                                  transition: 'width 0.3s ease-in-out',
                                })}
                              />
                            </Box>
                          </Box>
                          <Box
                            sx={{
                              backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.10),
                              border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.28)}`,
                              borderRadius: 1,
                              px: 1.5,
                              py: 0.5,
                              textAlign: 'center',
                            }}
                          >
                            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 800 }}>
                              {(item.importance * 100).toFixed(1)}%
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          </Box>
      </Container>
      <HospitalSearch open={hospitalSearchOpen} onClose={handleHospitalSearchClose} />
      <Dialog
        open={influenzaDialogOpen}
        onClose={handleInfluenzaDialogClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            borderRadius: 3,
            border: '1px solid rgba(203, 213, 225, 0.5)',
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pr: 2.5,
            pl: 3,
            py: 2,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderBottom: '1px solid rgba(203, 213, 225, 0.4)',
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1f2937' }}>
            인플루엔자란?
          </Typography>
          <IconButton onClick={handleInfluenzaDialogClose} sx={{ color: '#6b7280' }}>
            <FiX size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: 'rgba(255, 255, 255, 0.98)', px: { xs: 3, md: 5 }, py: { xs: 3, md: 4 } }}>
          <Stack spacing={4}>
            {/* YouTube 동영상 */}
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                paddingTop: '56.25%', // 16:9 비율
                borderRadius: 2,
                overflow: 'hidden',
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(203, 213, 225, 0.3)',
              }}
            >
              <Box
                component="iframe"
                src="https://www.youtube.com/embed/50AMRHyugwc"
                title="인플루엔자란?"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 0,
                }}
              />
            </Box>
            <Typography
              variant="body1"
              sx={{
                color: '#374151',
                lineHeight: 1.85,
                fontSize: { xs: '1.05rem', md: '1.125rem' },
                fontWeight: 600,
              }}
            >
              ▸ 인플루엔자(Influenza) 또는 인플루엔자바이러스 감염증(Influenza viruses disease)은 인플루엔자바이러스 감염에 의해 발생하는 급성 호흡기 질환으로, 갑작스러운 고열, 두통, 근육통, 오한 등이 특징이다. 주로 인플루엔자 A·B형 바이러스가 원인으로, 항원 변이와 계절적 요인에 따라 매년 반복적인 유행을 일으킨다.
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: 'rgba(75, 85, 99, 0.9)',
                lineHeight: 1.9,
                fontSize: { xs: '1.02rem', md: '1.08rem' },
              }}
            >
              ▸ 전파 경로: 감염자의 기침·재채기에 포함된 비말과 손·물체를 통한 접촉이 주요 경로이며, 잠복기는 평균 1~3일로 짧아 빠르게 확산된다. 건조한 겨울철 실내 환경이나 밀폐된 공간에서 전파 위험이 커지므로 환기와 손 위생이 필수적이다.<br />
              ▸ 임상 증상: 38℃ 이상의 발열, 전신 피로감과 함께 기침, 인후통, 콧물 등 호흡기 증상이 동반되며, 소아에서는 구토·설사가, 고령자와 만성질환자에게서는 폐렴, 심근염, 중이염 같은 합병증이 나타날 수 있다.
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: 'rgba(75, 85, 99, 0.9)',
                lineHeight: 1.9,
                fontSize: { xs: '1.02rem', md: '1.08rem' },
              }}
            >
              ▸ 고위험군 관리: 65세 이상 노인, 5세 미만 영유아, 임신부, 만성 심폐질환·당뇨·면역저하 환자는 중증으로 진행될 가능성이 높아 조기 진단과 치료가 중요하다.<br />
              ▸ 예방 및 치료: 유행 직전(가을) 매년 맞는 예방접종이 가장 효과적인 예방법이며, 마스크 착용·기침 예절·손 씻기 등 기본 방역수칙을 병행해야 한다. 증상 발생 48시간 이내 항바이러스제 투여는 증상 기간 단축과 합병증 감소에 도움이 되며, 충분한 휴식과 수분 섭취가 권장된다.
            </Typography>
          </Stack>
        </DialogContent>
      </Dialog>
      <Dialog
        open={newsDialogOpen}
        onClose={handleNewsDialogClose}
        fullWidth
        maxWidth="lg"
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            borderRadius: 3,
            border: '1px solid rgba(203, 213, 225, 0.5)',
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pr: 2.5,
            pl: 3,
            py: 2,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderBottom: '1px solid rgba(203, 213, 225, 0.4)',
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1f2937' }}>
            감염병 뉴스
          </Typography>
          <IconButton onClick={handleNewsDialogClose} sx={{ color: '#6b7280' }}>
            <FiX size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: 'background.paper' }}>
          {newsSelected ? (
            <Box sx={{ height: { xs: '70vh', md: '80vh' }, display: 'flex', flexDirection: 'column' }}>
              <Box
                sx={(theme) => ({
                  px: 3,
                  py: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  bgcolor: 'background.paper',
                })}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 800,
                    color: 'text.primary',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {newsSelected.title}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: '0 0 auto' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setNewsSelected(null);
                      newsIframeLoadedRef.current = false;
                      if (newsFallbackTimerRef.current) {
                        clearTimeout(newsFallbackTimerRef.current);
                        newsFallbackTimerRef.current = null;
                      }
                    }}
                  >
                    목록
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => window.open(newsSelected.link, '_blank', 'noopener,noreferrer')}
                  >
                    새 탭
                  </Button>
                </Box>
              </Box>

              <Box
                component="iframe"
                src={newsSelected.link}
                title={newsSelected.title}
                onLoad={() => {
                  newsIframeLoadedRef.current = true;
                  if (newsFallbackTimerRef.current) {
                    clearTimeout(newsFallbackTimerRef.current);
                    newsFallbackTimerRef.current = null;
                  }
                }}
                sx={{
                  flex: 1,
                  width: '100%',
                  border: 0,
                  backgroundColor: '#fff',
                }}
              />
              <Typography
                variant="caption"
                sx={(theme) => ({
                  display: 'block',
                  py: 1.25,
                  px: 3,
                  color: 'text.secondary',
                  bgcolor: 'background.paper',
                  borderTop: `1px solid ${theme.palette.divider}`,
                })}
              >
                원문이 앱 안에서 열리지 않으면 자동으로 새 탭으로 이동합니다. (필요 시{' '}
                <Link
                  href={newsSelected.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="always"
                  sx={{ color: 'primary.main', fontWeight: 800, ml: 0.5 }}
                >
                  새 탭으로 열기
                </Link>
                )
              </Typography>
            </Box>
          ) : (
            <Box sx={{ px: { xs: 2.5, md: 3 }, py: 2, height: { xs: '70vh', md: '80vh' }, overflow: 'auto' }}>
              {newsLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
                  <CircularProgress size={28} sx={{ mr: 2 }} />
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                    뉴스를 불러오는 중...
                  </Typography>
                </Box>
              ) : newsError ? (
                <Alert severity="warning">{newsError}</Alert>
              ) : newsItems.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 8 }}>
                  표시할 뉴스가 없습니다.
                </Typography>
              ) : (
                <Stack spacing={1.25}>
                  {newsItems.map((item) => (
                    <Paper
                      key={item.link}
                      elevation={0}
                      onClick={() => openNewsItem(item)}
                      sx={(theme) => ({
                        p: 2,
                        borderRadius: 2,
                        border: `1px solid ${theme.palette.divider}`,
                        bgcolor:
                          theme.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.04)'
                            : 'rgba(15, 23, 42, 0.02)',
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.06),
                        },
                      })}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 900, color: 'text.primary' }}>
                        {item.title}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.75 }}>
                        {item.source ? (
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>
                            {item.source}
                          </Typography>
                        ) : null}
                        {item.publishedAt ? (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {formatNewsTime(item.publishedAt)}
                          </Typography>
                        ) : null}
                        {item.keyword ? (
                          <Typography
                            variant="caption"
                            sx={(theme) => ({
                              color: 'text.secondary',
                              fontWeight: 800,
                              px: 1,
                              py: 0.25,
                              borderRadius: 1,
                              border: `1px solid ${theme.palette.divider}`,
                              bgcolor:
                                theme.palette.mode === 'dark'
                                  ? alpha('#ffffff', 0.04)
                                  : alpha('#0f172a', 0.02),
                            })}
                          >
                            {item.keyword}
                          </Typography>
                        ) : null}
                      </Box>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* 주간 발생 동향 Dialog */}
      <Dialog
        open={weeklyReportDialogOpen}
        onClose={handleWeeklyReportDialogClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            borderRadius: 3,
            border: '1px solid rgba(203, 213, 225, 0.5)',
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pr: 2.5,
            pl: 3,
            py: 2,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderBottom: '1px solid rgba(203, 213, 225, 0.4)',
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1f2937' }}>
            주간 발생 동향
          </Typography>
          <IconButton onClick={handleWeeklyReportDialogClose} sx={{ color: '#6b7280' }}>
            <FiX size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, backgroundColor: 'rgba(9, 13, 23, 0.95)' }}>
          <Box
            component="iframe"
            src={WEEKLY_REPORT_URL}
            title="KDCA 주간 발생 동향"
            sx={{
              width: '100%',
              height: { xs: '70vh', md: '80vh' },
              border: 0,
              backgroundColor: '#fff',
            }}
          />
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              py: 1.5,
              px: 3,
              color: 'rgba(148, 163, 184, 0.7)',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderTop: '1px solid rgba(148, 163, 184, 0.1)',
            }}
          >
            외부 페이지가 보이지 않을 경우 새 창에서{' '}
            <Link
              href={WEEKLY_REPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              underline="always"
              sx={{ color: 'primary.main', fontWeight: 800, ml: 0.5 }}
            >
              주간 발생 동향 바로가기
            </Link>
            를 이용해 주세요.
          </Typography>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default Dashboard;
