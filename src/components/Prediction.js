import React, { useMemo, useState } from 'react';
import {
  Box,
  Container,
  FormControl,
  Grid,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useInfluenzaData } from '../hooks/useInfluenzaData';
import { usePredictionBacktest } from '../hooks/usePredictionBacktest';

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
const PREDICTION_COLOR = '#ef4444';
const PREDICTION_FILL = 'rgba(239, 68, 68, 0.2)';

function getHorizonText(h) {
  if (h === 1) return '1주 뒤 예측';
  if (h === 2) return '2주 뒤 예측';
  return '3주 뒤 예측';
}

const Prediction = ({ isOpen = true }) => {
  // 환경 변수에서 DSID 가져오기
  const defaultDSID = process.env.REACT_APP_DSID || 'ds_0101';
  const [season, setSeason] = useState('24/25');
  const [selectedHorizon, setSelectedHorizon] = useState(3); // H=1/2/3
  const defaultWeek = '37'; // only used for useInfluenzaData internal branching

  const windowSize = 12;
  const steps = 3;

  // 최근 데이터 가져오기 (12스텝)
  const { influenzaData, loading: dataLoading, error: dataError } = useInfluenzaData(season, defaultWeek, defaultDSID);
  const iliSeries = influenzaData?.ili ?? { weeks: [], values: [] };

  const {
    status: backtestStatus,
    error: backtestError,
    progress,
    result,
    run: runBacktest,
    cancel: cancelBacktest,
  } = usePredictionBacktest({
    season,
    dsid: defaultDSID,
    weeks: iliSeries.weeks,
    values: iliSeries.values,
    windowSize,
    steps,
  });

  const active = useMemo(() => {
    if (!result?.horizons?.[selectedHorizon]) return null;
    return {
      weeks: result.weeks || [],
      actual: result.values || [],
      predicted: result.horizons[selectedHorizon]?.predicted || [],
      metrics: result.horizons[selectedHorizon]?.metrics || null,
      meta: result.meta || null,
    };
  }, [result, selectedHorizon]);

  // 차트 데이터 생성 (절기 전체 실제값 + 선택 H 예측값)
  const chartData = useMemo(() => {
    if (!active?.weeks?.length) return null;

    return {
      labels: active.weeks,
      datasets: [
        {
          label: '실제 의사환자 분율',
          data: active.actual,
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
          label: `AI 예측 (${getHorizonText(selectedHorizon)})`,
          data: active.predicted,
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
  }, [active, selectedHorizon]);

  const chartOptions = {
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
          color: '#64748b',
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
            return `${context.dataset.label}: ${value.toFixed(2)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        title: { display: true, text: '주차 (Week)', color: '#64748b', font: { size: 11 } },
        ticks: {
          color: '#6b7280',
          font: { size: 10 },
          maxRotation: 45,
          minRotation: 0,
        },
      },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.2)', borderDash: [4, 4] },
        ticks: { color: '#6b7280', font: { size: 10 } },
        title: {
          display: true,
          text: '인플루엔자 의사환자 분율(/1,000명 당)',
          color: '#6b7280',
          font: { size: 11 },
        },
      },
    },
    interaction: { intersect: false, mode: 'index' },
  };

  const rows = useMemo(() => {
    if (!active?.weeks?.length) return [];
    const out = [];
    for (let i = 0; i < active.weeks.length; i += 1) {
      const a = active.actual?.[i];
      const p = active.predicted?.[i];
      if (p == null || a == null) continue;
      const error = p - a;
      out.push({
        week: active.weeks[i],
        actual: a,
        predicted: p,
        absError: Math.abs(error),
      });
    }
    return out.slice(-30).reverse(); // show latest 30 rows
  }, [active]);

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
        <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3, boxShadow: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: '-0.02em' }}>
                AI 예측 성능 평가
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                선택한 절기 전체 구간에서 rolling backtest(입력 {windowSize}주, {steps}주 ahead)를 수행합니다.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select value={season} onChange={(e) => setSeason(e.target.value)}>
                  {['25/26', '24/25', '23/24', '22/23', '21/22', '20/21', '19/20', '18/19', '17/18'].map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}절기
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select value={selectedHorizon} onChange={(e) => setSelectedHorizon(Number(e.target.value) || 3)}>
                  <MenuItem value={1}>1주 뒤 예측</MenuItem>
                  <MenuItem value={2}>2주 뒤 예측</MenuItem>
                  <MenuItem value={3}>3주 뒤 예측</MenuItem>
                </Select>
              </FormControl>

              {backtestStatus === 'running' ? (
                <Button variant="outlined" onClick={() => cancelBacktest()}>
                  중지
                </Button>
              ) : (
                <Button variant="contained" onClick={() => runBacktest()}>
                  평가 실행
                </Button>
              )}
            </Box>
          </Box>

          {(dataLoading || backtestStatus === 'running') && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
              <CircularProgress size={18} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {dataLoading ? '실제 데이터를 불러오는 중...' : `백테스트 실행 중... (${progress.current}/${progress.total})`}
              </Typography>
            </Box>
          )}

          {(dataError || backtestError) && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {dataError || backtestError}
              <Box sx={{ mt: 0.5, fontSize: '0.875rem', color: 'text.secondary' }}>
                예측 서버가 필요합니다. (`REACT_APP_PREDICTION_API_URL` 또는 기본: `http://210.117.143.172:6302`)
              </Box>
            </Alert>
          )}

          {active?.metrics && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {[
                { label: 'MAE', value: active.metrics.mae == null ? '-' : active.metrics.mae.toFixed(3) },
                { label: 'RMSE', value: active.metrics.rmse == null ? '-' : active.metrics.rmse.toFixed(3) },
                { label: 'MAPE', value: active.metrics.mape == null ? '-' : `${active.metrics.mape.toFixed(2)}%` },
                { label: '샘플 수', value: active.metrics.count ?? '-' },
              ].map((kpi) => (
                <Grid item xs={12} sm={6} md={3} key={kpi.label}>
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, boxShadow: 1, bgcolor: 'background.paper' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>
                      {kpi.label}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.75 }}>
                      {kpi.value}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}

          {active?.meta && (
            <Box
              sx={(theme) => ({
                mt: 2,
                p: 2,
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
                bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.primary.main, 0.06),
              })}
            >
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                성공 호출: {active.meta.successCount} / 실패: {active.meta.failCount} · 생성: {active.meta.createdAt}
              </Typography>
            </Box>
          )}

          {chartData && (
            <Paper elevation={0} sx={{ mt: 2.5, p: { xs: 2.5, md: 3 }, borderRadius: 3, boxShadow: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                실제값 vs 예측값
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                예측은 각 주차 시점에서 과거 {windowSize}주 데이터를 입력으로 다음 {steps}주를 예측한 결과입니다.
              </Typography>
              <Box sx={{ height: 420, mt: 2 }}>
                <Line data={chartData} options={chartOptions} />
              </Box>
            </Paper>
          )}

          {rows.length > 0 && (
            <Paper elevation={0} sx={{ mt: 2.5, p: { xs: 2.5, md: 3 }, borderRadius: 3, boxShadow: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                최근 오차(최대 30주)
              </Typography>
              <Box sx={{ mt: 1.5, overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 640 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>주차</TableCell>
                      <TableCell sx={{ fontWeight: 800 }} align="right">
                        실제
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800 }} align="right">
                      예측({getHorizonText(selectedHorizon)})
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800 }} align="right">
                        |오차|
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={`${r.week}`}>
                        <TableCell>{r.week}</TableCell>
                        <TableCell align="right">{Number(r.actual).toFixed(2)}</TableCell>
                        <TableCell align="right">{Number(r.predicted).toFixed(2)}</TableCell>
                        <TableCell align="right">{Number(r.absError).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Paper>
          )}

          {!chartData && backtestStatus === 'done' && !backtestError && (
            <Alert severity="info" sx={{ mt: 2 }}>
              결과가 없습니다. 데이터 길이({iliSeries.values?.length ?? 0}주) 또는 예측 서버 응답을 확인해 주세요.
            </Alert>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

export default Prediction;
