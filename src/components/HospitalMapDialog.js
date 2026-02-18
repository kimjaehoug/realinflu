import React from 'react';
import HospitalSearch from './HospitalSearch';

/**
 * PatientDashboard용 병원 선택 다이얼로그.
 * HospitalSearch(근처 병원찾기)를 래핑하고, onSelectHospital 인터페이스를 제공합니다.
 * 병원 선택 연동은 추후 HospitalSearch에 선택 콜백을 추가하면 연결할 수 있습니다.
 */
export default function HospitalMapDialog({ open, onClose, onSelectHospital }) {
  return (
    <HospitalSearch
      open={open}
      onClose={() => {
        if (typeof onClose === 'function') onClose();
      }}
    />
  );
}
