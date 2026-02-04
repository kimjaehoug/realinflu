# 인플루엔자 정보 포털

질병관리청 인플루엔자 정보 포털의 React 프론트엔드 애플리케이션입니다.

## 기능

- 📊 인플루엔자 신고 건수 및 유행률 통계 대시보드
- 📈 주간/월간/연간 추이 차트
- 🗺️ 지역별 통계 현황
- 👥 연령대별 통계 분석
- 🤖 AI 기반 인플루엔자 예측
- 🏥 근처 병원 찾기 (카카오맵 연동)
- 📱 반응형 디자인
- 🔐 Keycloak 인증 시스템

## 설치 및 실행

### 필수 요구사항

- Node.js 16.x 이상
- npm 또는 yarn

### 설치

```bash
npm install
```

### 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 환경 변수를 설정하세요:

```env
# Keycloak 인증 설정
REACT_APP_KEYCLOAK_SERVER_URL=https://keycloak.211.238.12.60.nip.io:8100
REACT_APP_KEYCLOAK_REALM=gfid-api
REACT_APP_CLIENT_ID=Vital_Analyzer_accessor
REACT_APP_CLIENT_SECRET=XbY2WJJZ6eA43hlipQg772dZ8hdOeKLE

# API 설정
REACT_APP_API_URL=http://211.238.12.60:8084/data/api/v1
REACT_APP_DSID=ds_0101
```

### 개발 서버 실행

```bash
npm start
```

브라우저에서 [http://localhost:5090](http://localhost:5090)을 열어 확인하세요.

### 빌드

```bash
npm run build
```

프로덕션 빌드가 `build` 폴더에 생성됩니다.

## 사용된 기술

- React 18.3.1
- Material-UI (MUI) 5.14.20
- Chart.js 4.5.1 & react-chartjs-2 5.3.1
- Recharts 2.10.3
- Axios 1.6.2
- react-icons 5.5.0
- http-proxy-middleware 2.0.6

## 프로젝트 구조

```
src/
├── api/                    # API 관련 파일
│   ├── auth.js            # Keycloak 인증 로직
│   ├── config.js          # Axios 설정 및 인터셉터
│   ├── etlDataApi.js      # ETL 데이터 API 함수
│   ├── influenzaApi.js    # 인플루엔자 데이터 API 함수
│   └── predictionApi.js   # AI 예측 API 함수
│
├── components/            # React 컴포넌트
│   ├── Dashboard.js       # 메인 대시보드 컴포넌트
│   ├── Prediction.js      # AI 예측 컴포넌트
│   ├── HospitalSearch.js  # 병원 찾기 컴포넌트
│   ├── Header.js          # 헤더 컴포넌트
│   ├── Sidebar.js         # 사이드바 네비게이션 컴포넌트
│   └── Footer.js          # 푸터 컴포넌트
│
├── hooks/                 # 커스텀 React 훅
│   └── useInfluenzaData.js  # 인플루엔자 데이터 페칭 훅
│
├── utils/                 # 유틸리티 함수
│   ├── csvDataLoader.js   # CSV 데이터 로더
│   ├── dataProcessors.js  # 데이터 처리 유틸리티
│   ├── datasetMetadata.js # 데이터셋 메타데이터 (ID-서비스명 매핑)
│   ├── dateUtils.js       # 날짜 계산 유틸리티
│   └── seasonUtils.js     # 절기 계산 유틸리티
│
├── App.js                 # 메인 앱 컴포넌트
├── App.css                # 앱 스타일
├── index.js               # 진입점
├── index.css              # 글로벌 스타일
└── setupProxy.js          # 개발 서버 프록시 설정
```

## 주요 기능 설명

### 대시보드
- 총 신고 건수, 최근 주 신고 건수, 평균 유행률, 최근 주 유행률 등 주요 지표를 카드 형태로 표시
- ILI, ARI, SARI, IRISS, KRISS, NEDIS 등 다양한 지표를 차트로 시각화
- 절기/주차별 데이터 필터링
- 주간 변화율 계산 및 표시
- 유행 단계 표시 (관심/주의/유행)
- Feature Importance 정보 표시

### AI 예측
- 최근 12주차의 실제 데이터와 AI 모델이 예측한 향후 3주차의 의사환자 분율을 시각화
- 실제 데이터와 예측 데이터를 구분하여 표시
- 예측 정보 (입력 길이, 예측 길이, 단위) 표시

### 병원 찾기
- 카카오맵 API를 활용한 근처 병원 검색
- 위치 기반 병원 검색 기능
- 지도 상에서 병원 위치 표시

### 사이드바 네비게이션
- 접기/펼치기 기능이 있는 사이드바
- 메뉴 항목: 대시보드, AI 예측, 감염병 뉴스, 주간 발생 동향, 인플루엔자란?, 근처 병원찾기
- 접힌 상태에서도 툴팁으로 메뉴 이름 확인 가능

### 필터링
- 절기 선택 (예: 24/25, 25/26)
- 주차 선택 (1주차 ~ 53주차)
- 데이터셋 ID 선택

## API 연동

### 인증 플로우
1. Keycloak Client Credentials Grant를 통해 액세스 토큰 발급
2. 토큰은 localStorage에 저장되며 만료 시간도 함께 저장
3. 토큰 만료 시 자동 갱신
4. 모든 API 요청에 Bearer 토큰 자동 포함

### API 엔드포인트
- ETL 데이터 조회: `GET /etl_data/id/{dsid}/from/{from}/to/{to}`
- 최근 데이터 조회: `GET /etl_data/id/{dsid}/recent/{cnt}`
- AI 예측: `GET /predict` (예측 서버)

## 개발 가이드

### 코드 구조 원칙
1. **관심사 분리**: API 로직과 UI 로직을 분리
2. **재사용 가능한 훅**: 데이터 페칭 로직을 커스텀 훅으로 분리
3. **유틸리티 함수**: 공통 로직을 `utils/` 디렉토리에 분리

### 데이터셋 메타데이터 (datasetMetadata.js)

데이터셋 ID와 서비스명을 매핑하는 중앙화된 메타데이터 시스템입니다.

**주요 기능:**
- `getDatasetName(dsid)`: 데이터셋 ID로 서비스명 조회
- `getDatasetMetadata(dsid)`: 전체 메타데이터 조회 (dsid, dataname, provider)
- `getDatasetProvider(dsid)`: 제공기관명 조회
- `getAllDatasetIds()`: 모든 데이터셋 ID 목록 조회
- `getDatasetsByProvider()`: 제공기관별로 그룹화된 데이터셋 목록

**사용 예시:**
```javascript
import { getDatasetName } from './utils/datasetMetadata';

// CSV 로더에서 사용
const dataname = getDatasetName(dsid);
console.log(`📂 ${dataname} 데이터 로드 중...`);

// API 호출 시 로그에 포함
console.log(`🔵 [API] ${dataname} (${dsid}) 요청 시작`);
```

**지원하는 데이터셋:**
- 질병관리청 감염병 포털: `ds_0101` ~ `ds_0111`
- 보건의료빅데이터개방시스템: `ds_0201` ~ `ds_0202`
- 국가통계포털: `ds_0301`
- 통계지리정보서비스: `ds_0401`
- 공공데이터 포털: `ds_0501` ~ `ds_0507`
- WHO: `ds_0601`
- 외부 트렌드: `ds_0701` (구글), `ds_0801` (네이버), `ds_0901` (X)

이 메타데이터는 로그 메시지, 에러 처리, 디버깅에서 데이터셋을 명확하게 식별하는 데 사용됩니다.

### 데이터 흐름
```
사용자 액션 (절기/주차 선택)
    ↓
useInfluenzaData 훅
    ↓
dateUtils.js (날짜 범위 계산)
    ↓
etlDataApi.js (API 호출)
    ↓
auth.js (인증 토큰 추가)
    ↓
config.js (Axios 인터셉터)
    ↓
API 서버
    ↓
dataProcessors.js (데이터 처리)
    ↓
컴포넌트 (UI 렌더링)
```

## 문제 해결

### CORS 오류
개발 환경에서 CORS 오류가 발생하면:
1. 개발 서버를 재시작하세요 (`Ctrl+C` 후 `npm start`)
2. `setupProxy.js`가 올바르게 설정되었는지 확인하세요

### 인증 오류
인증 관련 오류가 발생하면:
1. `.env` 파일의 환경 변수가 올바르게 설정되었는지 확인하세요
2. Keycloak 서버가 정상적으로 동작하는지 확인하세요

## 라이선스

이 프로젝트는 교육 목적으로 제작되었습니다.

