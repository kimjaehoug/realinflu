import React from 'react';
import { Box, Typography, Paper, Button, TextField } from '@mui/material';

/**
 * AI 의사결정 탭 (스텁 – 로컬 연동 시 구현)
 */
export default function AIDecisionTab({
  patientData,
  patientId,
  admissionId,
  patientNote,
  nerData,
  xrayData,
  xrayToken,
  setXrayToken,
  isLoadingDoctorAgent,
  error,
  setError,
  doctorAgentResponse,
  doctorAgentChats,
  doctorAgentInput,
  setDoctorAgentInput,
  doctorAgentReasoning,
  reasoningExpanded,
  setReasoningExpanded,
  isSendingDoctorAgent,
  callDoctorAgent,
  sendDoctorAgentMessage,
  generatePDFReport,
}) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>AI 의사결정</Typography>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">환자 ID: {patientId || '-'} / 입원 ID: {admissionId || '-'}</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="contained" onClick={callDoctorAgent} disabled={isLoadingDoctorAgent}>AI 분석 실행</Button>
            <Button variant="outlined" onClick={generatePDFReport}>PDF 보고서</Button>
          </Box>
          {doctorAgentChats?.length > 0 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              {doctorAgentChats.map((chat, i) => (
                <Typography key={i} variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1 }}>
                  {chat.role === 'user' ? '[사용자] ' : '[AI] '}{chat.content?.slice(0, 200)}{chat.content?.length > 200 ? '…' : ''}
                </Typography>
              ))}
            </Box>
          )}
          <TextField label="추가 질문" value={doctorAgentInput} onChange={(e) => setDoctorAgentInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendDoctorAgentMessage()} size="small" fullWidth />
          <Button variant="outlined" onClick={sendDoctorAgentMessage} disabled={isSendingDoctorAgent}>전송</Button>
          {error && <Typography color="error" variant="body2">{error}</Typography>}
        </Box>
      </Paper>
    </Box>
  );
}
