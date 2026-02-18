import React from 'react';
import { Box, Typography, TextField, Button, Paper } from '@mui/material';

/**
 * 중증도 분석 탭 (스텁 – 로컬 연동 시 구현)
 */
export default function SeverityAnalysisTab({
  patientId,
  setPatientId,
  admissionId,
  setAdmissionId,
  patientNote,
  setPatientNote,
  xrayimage,
  setXrayImage,
  patientData,
  nerData,
  finalMaskedText,
  xrayData,
  xrayImageSrc,
  xrayToken,
  vqaInput,
  setVqaInput,
  vqaChats,
  isLoading,
  error,
  onSearch,
  onAnalyzeNote,
  onAnalyzeXray,
  onSendVQA,
  isSendingVQA,
}) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>중증도 분석</Typography>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 480 }}>
          <TextField label="환자 ID" value={patientId} onChange={(e) => setPatientId(e.target.value)} size="small" fullWidth />
          <TextField label="입원 ID" value={admissionId} onChange={(e) => setAdmissionId(e.target.value)} size="small" fullWidth />
          <TextField label="임상 노트" value={patientNote} onChange={(e) => setPatientNote(e.target.value)} multiline rows={3} size="small" fullWidth />
          <TextField label="X-ray 이미지 번호" value={xrayimage} onChange={(e) => setXrayImage(e.target.value)} size="small" fullWidth placeholder="예: 1" />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" onClick={onSearch} disabled={isLoading}>환자 정보 조회</Button>
            <Button variant="outlined" onClick={onAnalyzeNote} disabled={isLoading}>임상 노트 분석</Button>
            <Button variant="outlined" onClick={onAnalyzeXray} disabled={isLoading}>X-ray 분석</Button>
          </Box>
          {error && <Typography color="error" variant="body2">{error}</Typography>}
          {patientData && <Typography variant="body2" color="text.secondary">중증도 점수: {(patientData.severity_score * 100)?.toFixed(1)}%</Typography>}
        </Box>
      </Paper>
    </Box>
  );
}
