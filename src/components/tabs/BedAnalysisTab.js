import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

/**
 * 병상 분석 탭 (스텁 – 로컬 연동 시 구현)
 */
export default function BedAnalysisTab({
  bedStatsData,
  bedGridData,
  shortTermPrediction,
  shortTermError,
  isLoadingShortTerm,
  shortTermHistory,
  shortTermHistoryError,
  patientData,
  patientId,
  admissionId,
  setActiveTab,
  hospitalName,
  hospitalAddress,
}) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>병상 분석</Typography>
      <Paper sx={{ p: 3 }}>
        {hospitalName && <Typography variant="body2" color="text.secondary">병원: {hospitalName}</Typography>}
        {bedStatsData && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            전체 병상: {bedStatsData.totalBeds ?? '-'} / 응급: {bedStatsData.emergencyTotal ?? '-'} / 입원: {bedStatsData.inpatientTotal ?? '-'}
          </Typography>
        )}
        {shortTermError && <Typography color="error" variant="body2">{shortTermError}</Typography>}
        {!bedStatsData && !isLoadingShortTerm && (
          <Typography color="text.secondary">병원을 선택한 뒤 데이터를 불러오세요.</Typography>
        )}
      </Paper>
    </Box>
  );
}
