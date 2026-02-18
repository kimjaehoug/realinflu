/**
 * PatientDashboard 개발/폴백용 더미 데이터
 */

export const dummyPatientNote = `환자 65세 남성, 폐렴 의심으로 내원.
주요 증상: 고열(38.5°C), 기침, 호흡곤란.
체온 38.5°C, 혈압 120/80, 산소포화도 95%.
항생제 투여 중.`;

export const dummyNerData = {
  diseases: [{ text: '폐렴', label: 'disease' }],
  symptoms: [
    { text: '고열', label: 'symptom' },
    { text: '기침', label: 'symptom' },
    { text: '호흡곤란', label: 'symptom' },
  ],
  medications: [],
  measurements: [
    { text: '38.5°C', label: 'measurement' },
    { text: '120/80', label: 'measurement' },
    { text: '95%', label: 'measurement' },
  ],
  etc: [],
  source_text: dummyPatientNote,
};

export const dummyPatientData = {
  severity_score: 0.45,
  severity_score_series: [
    { time: '2024-01-01T00:00:00', prob: 0.4, std: 0.05 },
    { time: '2024-01-01T06:00:00', prob: 0.42, std: 0.06 },
    { time: '2024-01-01T12:00:00', prob: 0.45, std: 0.07 },
  ],
  vitals_series: [
    {
      time: new Date().toISOString(),
      heart_rate: 78,
      respiratory_rate: 18,
      blood_pressure_systolic: 120,
      blood_pressure_diastolic: 80,
      temperature: 37.2,
      oxygen_saturation: 97,
    },
  ],
  report: '중증도 분석 결과 요약.',
  feature_importance: { age: 0.3, heart_rate: 0.25, oxygen_level: 0.22 },
  masked_final_text: '환자는 ___ 의심으로 내원. 주요 증상: ___, ___, ___.',
};
