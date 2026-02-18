import React from 'react';
import { Box, Typography, Paper, Button } from '@mui/material';

/**
 * 장비 현황 탭 (스텁 – 로컬 연동 시 구현)
 */
export default function EquipmentStatusTab({ equipmentData, equipmentError, onRetry }) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>장비 현황</Typography>
      <Paper sx={{ p: 3 }}>
        {equipmentError && (
          <Typography color="error" variant="body2" sx={{ mb: 2 }}>{equipmentError}</Typography>
        )}
        <Button variant="outlined" onClick={onRetry}>다시 불러오기</Button>
        {equipmentData && Array.isArray(equipmentData) && (
          <Typography variant="body2" sx={{ mt: 2 }}>장비 {equipmentData.length}건</Typography>
        )}
        {!equipmentData?.length && !equipmentError && (
          <Typography color="text.secondary" variant="body2" sx={{ mt: 2 }}>장비 데이터가 없습니다.</Typography>
        )}
      </Paper>
    </Box>
  );
}
