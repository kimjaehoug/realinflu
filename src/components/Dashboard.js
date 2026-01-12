import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Container,
  FormControl,
  Grid,
  IconButton,
  List,
  ListItemButton,
  Link,
  Dialog,
  DialogContent,
  DialogTitle,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  // BarElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { FiChevronRight, FiX } from 'react-icons/fi';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

const PRIMARY_COLOR = '#38bdf8';
const PRIMARY_FILL = 'rgba(56, 189, 248, 0.2)';

const navItems = [
  '대시보드',
  '감염병 뉴스',
  '주간 발생 동향',
  '인플루엔자란?',
  '근처 병원찾기',
];

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

const WEEK_OPTIONS = Array.from({ length: 53 }, (_, i) => (i + 1).toString());

const NEWS_PORTAL_URL = 'https://dportal.kdca.go.kr/pot/bbs/BD_selectBbsList.do?q_bbsSn=1008';
const WEEKLY_REPORT_URL = 'https://dportal.kdca.go.kr/pot/bbs/BD_selectBbsList.do?q_bbsSn=1009';
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

const createLineConfig = (labels, values) => ({
  labels,
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
});

const visitorOptionFactory = (formatter, seasonLabel, unit) => ({
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
      ticks: { color: '#6b7280', font: { size: 10 } },
    },
    y: {
      grid: { color: 'rgba(148, 163, 184, 0.2)', borderDash: [4, 4] },
      ticks: { color: '#6b7280', font: { size: 10 } },
    },
  },
  interaction: { intersect: false, mode: 'index' },
});

const iliWeeks = ['37주', '38주', '39주', '40주', '41주', '42주', '43주', '44주'];
const iliValues = [10.5, 12.3, 14.8, 17.2, 19.5, 15.3, 18.7, 22.8];

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

const graphChoices = [
  {
    id: 'ili',
    shorthand: 'ILI',
    label: '인플루엔자 의사환자 분율',
    description: '외래 의료기관 1,000명당 인플루엔자 의심 환자 분율',
    seasonLabel: '25/26절기',
    unit: '명',
    weeks: iliWeeks,
    values: iliValues,
    data: createLineConfig(iliWeeks, iliValues),
    formatter: value => value.toFixed(1),
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
    formatter: value => value.toFixed(1),
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
    formatter: value => value.toFixed(1),
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

const Dashboard = () => {
  const [selectedGraphId, setSelectedGraphId] = useState(graphChoices[0].id);
  const [selectedSeason, setSelectedSeason] = useState(SEASON_OPTIONS[0]);
  const [selectedWeek, setSelectedWeek] = useState('37');
  const [newsDialogOpen, setNewsDialogOpen] = useState(false);
  const [weeklyReportDialogOpen, setWeeklyReportDialogOpen] = useState(false);
  const [influenzaDialogOpen, setInfluenzaDialogOpen] = useState(false);
  const [hospitalMapDialogOpen, setHospitalMapDialogOpen] = useState(false);

  // 유행단계별 이모지 및 정보 반환 함수
  const getInfluenzaStageInfo = (value) => {
    if (value >= 9.1) {
      return {
        image: '/images/화남.png',
        stage: '현재 유행 단계',
        color: '#ef4444',
        description: '(유행기준 9.1 이상)',
      };
    } else if (value >= 4.5) {
      return {
        image: '/images/보통.png',
        stage: '주의 단계',
        color: '#f59e0b',
        description: '(유행기준 9.1 미만)',
      };
    } else {
      return {
        image: '/images/웃음.png',
        stage: '관심 단계',
        color: '#22c55e',
        description: '(유행기준 9.1 미만)',
      };
    }
  };

  // 주간 유행단계 데이터 (실제로는 API에서 가져와야 함) - 현재 제외
  const weeklyStageData = [
    { week: '1주전', value: 4.9 },
    { week: '2주전', value: 4.6 },
    { week: '4주전', value: 3.1 },
  ];

  const currentStageInfo = getInfluenzaStageInfo(9.5); // 테스트용으로 화남 단계로 설정

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

  // 주간 지표 요약 데이터
  const weeklySummaryMetrics = [
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
      value: '9.5',
      change: '+0.8',
      description: '유행기준(9.1) 초과',
    },
  ];

  const handleNewsDialogOpen = () => {
    setNewsDialogOpen(true);
  };

  const handleNewsDialogClose = () => {
    setNewsDialogOpen(false);
  };

  const handleWeeklyReportDialogOpen = () => {
    setWeeklyReportDialogOpen(true);
  };

  const handleWeeklyReportDialogClose = () => {
    setWeeklyReportDialogOpen(false);
  };

  const handleInfluenzaDialogOpen = () => {
    setInfluenzaDialogOpen(true);
  };

  const handleInfluenzaDialogClose = () => {
    setInfluenzaDialogOpen(false);
  };

  const handleHospitalMapDialogOpen = () => {
    setHospitalMapDialogOpen(true);
  };

  const handleHospitalMapDialogClose = () => {
    setHospitalMapDialogOpen(false);
  };

  // 카카오맵 초기화
  useEffect(() => {
    if (hospitalMapDialogOpen) {
      // 카카오맵 API 로드 확인 및 지도 초기화
      const initializeMap = () => {
        const container = document.getElementById('hospital-map');
        if (container && window.kakao && window.kakao.maps) {
          try {
            const options = {
              center: new window.kakao.maps.LatLng(37.5665, 126.9780), // 서울 중심
              level: 5
            };
            
            const map = new window.kakao.maps.Map(container, options);
            
            // 병원 마커 데이터
            const hospitals = [
              { name: '서울대학교병원', lat: 37.5799, lng: 126.9988 },
              { name: '삼성서울병원', lat: 37.4881, lng: 127.0857 },
              { name: '세브란스병원', lat: 37.5626, lng: 126.9397 },
              { name: '서울아산병원', lat: 37.5262, lng: 127.1085 }
            ];
            
            // 병원 마커 생성
            hospitals.forEach(hospital => {
              const markerPosition = new window.kakao.maps.LatLng(hospital.lat, hospital.lng);
              const marker = new window.kakao.maps.Marker({
                position: markerPosition,
                map: map
              });
              
              // 인포윈도우 생성
              const infowindow = new window.kakao.maps.InfoWindow({
                content: `<div style="padding:5px;font-size:12px;width:80px;text-align:center;">${hospital.name}</div>`
              });
              
              // 마커 클릭 이벤트
              window.kakao.maps.event.addListener(marker, 'click', () => {
                infowindow.open(map, marker);
              });
            });
            
            console.log('카카오맵 초기화 완료');
          } catch (error) {
            console.error('카카오맵 초기화 오류:', error);
          }
        } else {
          console.log('카카오맵 API 또는 컨테이너를 찾을 수 없음');
        }
      };

      // 다이얼로그가 완전히 렌더링된 후 지도 초기화
      const timer = setTimeout(initializeMap, 300);
      
      return () => clearTimeout(timer);
    }
  }, [hospitalMapDialogOpen]);



  const selectedGraph = useMemo(
    () => graphChoices.find(graph => graph.id === selectedGraphId) ?? graphChoices[0],
    [selectedGraphId],
  );

  const visitorOptions = useMemo(
    () => visitorOptionFactory(selectedGraph.formatter, selectedGraph.seasonLabel, selectedGraph.unit),
    [selectedGraph],
  );
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

  return (
    <Box sx={{ backgroundColor: '#f8fafc', minHeight: '100vh', color: '#1f2937', py: 4 }}>
      <Container maxWidth="xl">
        <Box
          sx={{
            borderRadius: 4,
            boxShadow: '0 40px 120px rgba(0, 0, 0, 0.1)',
            background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
            border: '1px solid rgba(203, 213, 225, 0.2)',
            display: 'flex',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              width: 240,
              backgroundColor: 'rgba(248, 250, 252, 0.95)',
              borderRight: '1px solid rgba(203, 213, 225, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              px: 3,
              py: 4,
            }}
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1f2937' }}>Cho Lab</Typography>
            </Box>
            <List sx={{ p: 0 }}>
              {navItems.map((item, index) => (
                <ListItemButton
                  key={item}
                  onClick={() => {
                    if (item === '감염병 뉴스') {
                      handleNewsDialogOpen();
                    } else if (item === '주간 발생 동향') {
                      handleWeeklyReportDialogOpen();
                      return;
                    } else if (item === '인플루엔자란?') {
                      handleInfluenzaDialogOpen();
                      return;
                    } else if (item === '근처 병원찾기') {
                      handleHospitalMapDialogOpen();
                      return;
                    }
                  }}
                  sx={{
                    color: index === 0 ? '#0f172a' : '#374151',
                    mb: 1,
                    borderRadius: 2,
                    backgroundColor: index === 0 ? '#5eead4' : 'transparent',
                    '&:hover': {
                      backgroundColor: index === 0 ? '#5eead4' : 'rgba(94, 234, 212, 0.08)',
                      color: '#1f2937',
                    },
                  }}
                >
                  <ListItemText primary={item} primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }} />
                  {index === 0 && <FiChevronRight color="#0f172a" />}
                </ListItemButton>
              ))}
            </List>
            <Box sx={{ mt: 'auto', p: 2.5, borderRadius: 3, backgroundColor: 'rgba(241, 245, 249, 0.8)' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#1f2937' }}>매주 18시 이후 업데이트</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(107, 114, 128, 0.7)' }}>전주 토-일 자료 수집</Typography>
            </Box>
          </Box>

          <Box sx={{ flex: 1, p: { xs: 3, md: 5 }, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 3 }}>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  color: '#1f2937',
                  fontFamily: 'Pretendard',
                }}
              >
                Influenza Overview
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Typography variant="body2" sx={{ color: '#4b5563', fontWeight: 500 }}>
                    절기 선택
                  </Typography>
                  <FormControl
                    size="small"
                    sx={{
                      minWidth: 120,
                      backgroundColor: 'rgba(255, 255, 255, 0.8)',
                      borderRadius: 1.5,
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { border: '1px solid rgba(203, 213, 225, 0.5)' },
                        '&:hover fieldset': { borderColor: 'rgba(59, 130, 246, 0.4)' },
                        '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                      },
                    }}
                  >
                    <Select
                      value={selectedSeason}
                      onChange={event => setSelectedSeason(event.target.value)}
                      sx={{
                        color: '#374151',
                        fontSize: '0.875rem',
                        '& .MuiSvgIcon-root': { color: '#374151' },
                      }}
                    >
                      {SEASON_OPTIONS.map(option => (
                        <MenuItem key={option} value={option}>
                          {option}절기
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Typography variant="body2" sx={{ color: '#374151', fontWeight: 500 }}>
                    주차 선택
                  </Typography>
                  <FormControl
                    size="small"
                    sx={{
                      minWidth: 100,
                      backgroundColor: 'rgba(248, 250, 252, 0.9)',
                      borderRadius: 1.5,
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { border: '1px solid rgba(203, 213, 225, 0.8)' },
                        '&:hover fieldset': { borderColor: 'rgba(94, 234, 212, 0.4)' },
                        '&.Mui-focused fieldset': { borderColor: '#38bdf8' },
                      },
                    }}
                  >
                    <Select
                      value={selectedWeek}
                      onChange={event => setSelectedWeek(event.target.value)}
                      sx={{
                        color: '#374151',
                        fontSize: '0.875rem',
                        '& .MuiSvgIcon-root': { color: '#374151' },
                      }}
                    >
                      {WEEK_OPTIONS.map(week => (
                        <MenuItem key={week} value={week}>
                          {week}주
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </Box>
            </Box>

            <Grid container spacing={4}>
              <Grid item xs={12} md={4}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: 4,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1f2937', mb: 3 }}>
                    인플루엔자 유행단계
                  </Typography>
                  <Box
                    sx={{
                      backgroundColor: 'rgba(248, 250, 252, 0.9)',
                      borderRadius: 4,
                      p: { xs: 2.5, md: 3 },
                      border: '1px solid rgba(203, 213, 225, 0.8)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                    }}
                  >
                    {/* 현재 단계 표시 */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                      <Box
                        component="img"
                        src={currentStageInfo.image}
                        alt="현재 유행단계"
                        sx={{
                          width: 120,
                          height: 120,
                          mb: 2,
                        }}
                      />
                      <Typography variant="h4" sx={{ color: currentStageInfo.color, fontWeight: 700, mb: 1 }}>
                        9.5
                      </Typography>
                      <Typography variant="body1" sx={{ color: '#1f2937', fontWeight: 600 }}>
                        {currentStageInfo.stage}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(75, 85, 99, 0.8)' }}>
                        {currentStageInfo.description}
                      </Typography>
                    </Box>

                    {/* 주간 추이 */}
                    <Box sx={{ width: '100%' }}>
                      <Typography variant="body2" sx={{ color: '#1f2937', fontWeight: 600, mb: 2, textAlign: 'center' }}>
                        주간 추이
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                        {weeklyStageData.map((data, index) => {
                          const stageInfo = getInfluenzaStageInfo(data.value);
                          return (
                            <Box key={index} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <Box
                                component="img"
                                src={stageInfo.image}
                                alt={data.week}
                                sx={{ width: 40, height: 40, mb: 0.5 }}
                              />
                              <Typography variant="caption" sx={{ color: 'rgba(75, 85, 99, 0.8)' }}>
                                {data.week}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#1f2937', fontWeight: 600 }}>
                                {data.value}
                              </Typography>
                            </Box>
                          );
                        })}
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
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: 4,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* 상단 여백을 줄임 */}
                  <Box sx={{ flex: 0.3 }} />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#1f2937', mt: 0.5 }}>
                        {selectedGraph.label}
                      </Typography>
                      {selectedChange?.valueText ? (
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mt: 1 }}>
                          <Typography variant="h4" sx={{ fontWeight: 700, color: '#1f2937' }}>
                            {selectedChange.valueText}
                          </Typography>
                          {selectedChange?.text ? (
                            <Typography variant="h6" sx={{ fontWeight: 700, color: selectedChange.color }}>
                              {selectedChange.text}
                            </Typography>
                          ) : null}
                        </Box>
                      ) : null}
                    </Box>
                    
                    {/* 그래프 선택 드롭다운 */}
                    <FormControl sx={{ minWidth: 120 }}>
                      <Select
                        value={selectedGraphId}
                        onChange={(e) => setSelectedGraphId(e.target.value)}
                        displayEmpty
                        renderValue={(selected) => {
                          const selectedOption = graphChoices.find(option => option.id === selected);
                          return selectedOption ? selectedOption.shorthand : '';
                        }}
                        sx={{
                          color: '#1f2937',
                          backgroundColor: 'rgba(248, 250, 252, 0.9)',
                          borderRadius: 2,
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(148, 163, 184, 0.3)',
                          },
                          '& .MuiSvgIcon-root': {
                            color: '#374151',
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(56, 189, 248, 0.5)',
                          },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#38bdf8',
                          },
                        }}
                        MenuProps={{
                          PaperProps: {
                            sx: {
                              backgroundColor: 'rgba(255, 255, 255, 0.95)',
                              border: '1px solid rgba(203, 213, 225, 0.8)',
                              borderRadius: 2,
                            },
                          },
                        }}
                      >
                        {graphChoices.map((option) => (
                          <MenuItem 
                            key={option.id} 
                            value={option.id}
                            sx={{ 
                              color: '#1f2937',
                              '&:hover': {
                                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                              },
                              '&.Mui-selected': {
                                backgroundColor: 'rgba(56, 189, 248, 0.2)',
                              },
                            }}
                          >
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {option.shorthand}: {option.label}
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
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
                  <Box sx={{ height: 260, mt: 3 }}>
                    <Line data={selectedGraph.data} options={visitorOptions} />
                  </Box>
                  <Typography variant="caption" sx={{ color: 'rgba(148, 163, 184, 0.7)', display: 'block', mt: 2 }}>
                    {selectedGraph.description}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: 4,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    height: '100%',
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1f2937', mb: 3 }}>
                    주간 지표 요약
                  </Typography>
                  <Grid container spacing={2}>
                    {weeklySummaryMetrics.map((metric, index) => (
                      <Grid item xs={6} key={metric.title}>
                        <Box
                          sx={{
                            p: 2.5,
                            borderRadius: 3,
                            backgroundColor: 'rgba(248, 250, 252, 0.9)',
                            border: '1px solid rgba(203, 213, 225, 0.8)',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                          }}
                        >
                          <Typography variant="body1" sx={{ color: 'rgba(75, 85, 99, 0.8)', fontWeight: 600, mb: 2 }}>
                            {metric.title}
                          </Typography>
                          
                          <Typography variant="h5" sx={{ color: '#1f2937', fontWeight: 700, mb: 1 }}>
                            {metric.value}
                          </Typography>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                color: metric.change.startsWith('+') ? '#22c55e' : '#ef4444',
                                fontWeight: 600 
                              }}
                            >
                              {metric.change}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(107, 114, 128, 0.7)' }}>
                              전 주 대비
                            </Typography>
                          </Box>
                          
                          <Typography variant="caption" sx={{ color: 'rgba(107, 114, 128, 0.7)', fontSize: '0.7rem' }}>
                            {metric.description}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: 4,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    height: '100%',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#1f2937' }}>
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
                            backgroundColor: currentFeaturePage === index ? '#38bdf8' : 'rgba(148, 163, 184, 0.4)',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s ease',
                          }}
                        />
                      ))}
                    </Box>
                  </Box>

                  {/* 테이블 헤더 */}
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 240px 80px', 
                      gap: 2, 
                      p: 2,
                      borderBottom: '1px solid rgba(148, 163, 184, 0.2)'
                    }}>
                      <Typography variant="caption" sx={{ color: 'rgba(107, 114, 128, 0.9)', fontWeight: 600 }}>
                        Feature
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(107, 114, 128, 0.9)', fontWeight: 600 }}>
                        Importance
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(107, 114, 128, 0.9)', fontWeight: 600 }}>
                        Value
                      </Typography>
                    </Box>
                  </Box>

                  {/* 테이블 내용 */}
                  <Stack spacing={1}>
                    {currentFeatures.map((item, index) => {
                      const color = '#38bdf8'; // ili와 같은 파란색으로 통일
                      
                      return (
                        <Box
                          key={item.feature}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 240px 80px',
                            gap: 2,
                            p: 2,
                            borderRadius: 2,
                            backgroundColor: 'rgba(241, 245, 249, 0.7)',
                            border: '1px solid rgba(203, 213, 225, 0.6)',
                            alignItems: 'center',
                          }}
                        >
                          <Box>
                            <Typography variant="body2" sx={{ color: '#1f2937', fontWeight: 600 }}>
                              {item.feature}
                            </Typography>
                          </Box>
                          <Box sx={{ width: '100%' }}>
                            <Box sx={{ 
                              width: '100%', 
                              height: 12, 
                              backgroundColor: 'rgba(226, 232, 240, 0.6)', 
                              borderRadius: 2, 
                              overflow: 'hidden'
                            }}>
                              <Box
                                sx={{
                                  width: `${item.importance * 100}%`,
                                  height: '100%',
                                  backgroundColor: color,
                                  borderRadius: 2,
                                  transition: 'width 0.3s ease-in-out',
                                }}
                              />
                            </Box>
                          </Box>
                          <Box sx={{ 
                            backgroundColor: `${color}20`, 
                            border: `1px solid ${color}40`,
                            borderRadius: 1,
                            px: 1.5,
                            py: 0.5,
                            textAlign: 'center'
                          }}>
                            <Typography variant="caption" sx={{ color: color, fontWeight: 700 }}>
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
        </Box>
      </Container>
      <Dialog
        open={hospitalMapDialogOpen}
        onClose={handleHospitalMapDialogClose}
        maxWidth="md"
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
            근처 병원찾기
          </Typography>
          <IconButton onClick={handleHospitalMapDialogClose} sx={{ color: '#6b7280' }}>
            <FiX size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: 'rgba(248, 250, 252, 0.95)', p: 3 }}>
          <Stack spacing={3}>
            {/* 검색 박스 */}
            <Box
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderRadius: 3,
                border: '1px solid rgba(203, 213, 225, 0.8)',
                p: 3,
              }}
            >
              <Typography variant="body2" sx={{ color: '#1f2937', fontWeight: 600, mb: 2 }}>
                지역을 입력하여 병원을 검색하세요
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Box
                  component="input"
                  type="text"
                  placeholder="지역명을 입력하세요 (예: 강남구, 서초구)"
                  sx={{
                    flex: 1,
                    p: 1.5,
                    border: '1px solid rgba(203, 213, 225, 0.8)',
                    borderRadius: 2,
                    fontSize: '14px',
                    color: '#1f2937',
                    backgroundColor: 'rgba(248, 250, 252, 0.9)',
                    '&:focus': {
                      outline: 'none',
                      borderColor: '#38bdf8',
                    },
                  }}
                />
                <Box
                  component="button"
                  sx={{
                    px: 3,
                    py: 1.5,
                    backgroundColor: '#38bdf8',
                    color: 'white',
                    border: 'none',
                    borderRadius: 2,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '14px',
                    '&:hover': {
                      backgroundColor: '#0ea5e9',
                    },
                  }}
                >
                  검색
                </Box>
              </Box>
            </Box>

            {/* 카카오맵 */}
            <Box
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderRadius: 3,
                border: '1px solid rgba(203, 213, 225, 0.8)',
                overflow: 'hidden',
              }}
            >
              <Typography variant="subtitle2" sx={{ color: '#1f2937', fontWeight: 600, p: 2, borderBottom: '1px solid rgba(203, 213, 225, 0.4)' }}>
                주요 병원 위치
              </Typography>
              
              <Box
                id="hospital-map"
                sx={{
                  width: '100%',
                  height: '400px',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {/* 지도 로딩 중 또는 오류 시 표시될 내용 */}
                <Box
                  sx={{
                    textAlign: 'center',
                    color: '#6b7280',
                    position: 'absolute',
                    zIndex: 1,
                  }}
                >
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    지도를 불러오는 중입니다...
                  </Typography>
                  <Typography variant="caption">
                    지도가 표시되지 않으면 아래 버튼을 이용해주세요
                  </Typography>
                </Box>
              </Box>
              
              <Typography variant="caption" sx={{ display: 'block', p: 2, color: '#6b7280', textAlign: 'center' }}>
                마커를 클릭하면 병원 정보를 확인할 수 있습니다
              </Typography>
            </Box>

          </Stack>
        </DialogContent>
      </Dialog>
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
        <DialogContent sx={{ p: 0, backgroundColor: 'rgba(9, 13, 23, 0.95)' }}>
          <Box
            component="iframe"
            src={NEWS_PORTAL_URL}
            title="KDCA 감염병 뉴스"
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
              href={NEWS_PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              underline="always"
              sx={{ color: '#38bdf8', fontWeight: 600, ml: 0.5 }}
            >
              감염병 뉴스 바로가기
            </Link>
            를 이용해 주세요.
          </Typography>
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
              sx={{ color: '#38bdf8', fontWeight: 600, ml: 0.5 }}
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
