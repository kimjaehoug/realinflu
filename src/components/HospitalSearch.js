import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  IconButton,
  Typography,
  Chip,
  TextField,
  InputAdornment,
} from '@mui/material';
import { Close as CloseIcon, ArrowBack as ArrowBackIcon, Search as SearchIcon } from '@mui/icons-material';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { geoMercator, geoPath, geoCentroid } from 'd3-geo';
import { feature as topojsonFeature } from 'topojson-client';
import 'leaflet/dist/leaflet.css';
import provincesGeo from '../data/skorea_provinces_geo_simple.json';

// GeoJSON 시/도명 → 앱 지역 키 (클릭 시 setSelectedRegion용)
const GEO_NAME_TO_REGION = {
  서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천',
  광주광역시: '광주', 대전광역시: '대전', 울산광역시: '울산', 세종특별자치시: '세종',
  경기도: '경기', 강원도: '강원', 충청북도: '충북', 충청남도: '충남',
  전라북도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남',
  제주특별자치도: '제주'
};

// 지역별 대략 중심 좌표 (시/도 → [lat, lng])
const REGION_CENTERS = {
  서울: [37.57, 127.0], 인천: [37.46, 126.71], 경기: [37.4, 127.1], 강원: [37.8, 128.2],
  충북: [36.6, 127.5], 충남: [36.5, 127.0], 대전: [36.35, 127.38], 세종: [36.48, 127.29],
  경북: [36.5, 128.7], 대구: [35.87, 128.6], 울산: [35.54, 129.3], 경남: [35.2, 128.7],
  부산: [35.18, 129.08], 전북: [35.8, 127.1], 광주: [35.16, 126.91], 전남: [34.8, 126.9],
  제주: [33.5, 126.5]
};

// 시/도 → TopoJSON 행정코드 앞 2자리 (시/군/구 필터용)
const REGION_TO_CODE_PREFIX = {
  서울: '11', 부산: '21', 대구: '22', 인천: '23', 광주: '24', 대전: '25', 울산: '26', 세종: '29',
  경기: '31', 강원: '32', 충북: '33', 충남: '34', 전북: '35', 전남: '36', 경북: '37', 경남: '38', 제주: '39'
};

// GeoJSON 시/군/구명 정규화 (병원 데이터 없이 지도용)
function normalizeDistrictName(geoName) {
  if (!geoName || typeof geoName !== 'string') return '';
  return geoName.replace(/시/g, '').trim();
}

// 대한민국 시/도 지도 (SVG, d3-geo, 클릭 시 지역 선택)
function KoreaGeoMap({ geoData, onSelectRegion }) {
  const width = 480;
  const height = 560;
  const { projection, path, features } = useMemo(() => {
    if (!geoData?.features?.length) return { projection: null, path: null, features: [] };
    const projection = geoMercator().fitSize([width, height], geoData);
    const path = geoPath().projection(projection);
    return { projection, path, features: geoData.features };
  }, [geoData]);

  if (!projection || !path || !features.length) return null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto" style={{ maxWidth: width, filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.18))' }}>
      <g>
        {features.map((feature, i) => {
          const name = feature.properties?.name;
          const regionKey = name ? (GEO_NAME_TO_REGION[name] || name) : null;
          const d = path(feature);
          if (!d) return null;
          return (
            <path
              key={feature.properties?.code ?? i}
              d={d}
              fill="#e8e8e8"
              stroke="#9a9a9a"
              strokeWidth="0.9"
              style={{ cursor: regionKey ? 'pointer' : 'default' }}
              onClick={() => regionKey && onSelectRegion(regionKey)}
            />
          );
        })}
      </g>
      <g style={{ pointerEvents: 'none' }}>
        {features.map((feature, i) => {
          const name = feature.properties?.name;
          if (!name) return null;
          let [x, y] = [0, 0];
          try {
            const c = geoCentroid(feature);
            [x, y] = projection(c) || [0, 0];
          } catch (_) {}
          if (name === '경기도') { x = 200; y = 98; } else if (name === '충청남도') { x = 168; y = 238; }
          const inBounds = x >= 0 && x <= width && y >= 0 && y <= height;
          if (!inBounds) return null;
          return (
            <text key={`label-${i}`} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="#222" fontSize="10" fontWeight="600">
              {name}
            </text>
          );
        })}
      </g>
    </svg>
  );
}

// 선택한 도 내 시/군/구 SVG 지도 (클릭 시 구 선택)
const DISTRICT_MAP_WIDTH = 480;
const DISTRICT_MAP_HEIGHT = 520;

function ProvinceDistrictMap({ districtGeoData, onSelectDistrict }) {
  const { projection, path, features } = useMemo(() => {
    if (!districtGeoData?.features?.length) return { projection: null, path: null, features: [] };
    const projection = geoMercator().fitSize([DISTRICT_MAP_WIDTH, DISTRICT_MAP_HEIGHT], districtGeoData);
    const path = geoPath().projection(projection);
    return { projection, path, features: districtGeoData.features };
  }, [districtGeoData]);

  if (!projection || !path || !features.length) return null;

  return (
    <svg viewBox={`0 0 ${DISTRICT_MAP_WIDTH} ${DISTRICT_MAP_HEIGHT}`} width="100%" height="auto" style={{ maxWidth: DISTRICT_MAP_WIDTH, filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.18))' }}>
      <g>
        {features.map((feature, i) => {
          const name = feature.properties?.name;
          const d = path(feature);
          if (!d) return null;
          return (
            <path
              key={feature.properties?.code ?? i}
              d={d}
              fill="#e8e8e8"
              stroke="#9a9a9a"
              strokeWidth="0.9"
              style={{ cursor: 'pointer' }}
              onClick={() => name && onSelectDistrict(name)}
            />
          );
        })}
      </g>
      <g style={{ pointerEvents: 'none' }}>
        {features.map((feature, i) => {
          const name = feature.properties?.name;
          if (!name) return null;
          let [x, y] = [0, 0];
          try {
            const c = geoCentroid(feature);
            [x, y] = projection(c) || [0, 0];
          } catch (_) {}
          const inBounds = x >= 0 && x <= DISTRICT_MAP_WIDTH && y >= 0 && y <= DISTRICT_MAP_HEIGHT;
          if (!inBounds) return null;
          return (
            <text key={`label-${i}`} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="#222" fontSize="9" fontWeight="600">
              {name.length > 6 ? name.slice(0, 5) + '…' : name}
            </text>
          );
        })}
      </g>
    </svg>
  );
}

// GeoJSON geometry → Leaflet bounds
function boundsFromGeometry(geometry) {
  if (!geometry?.coordinates) return null;
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  const addPoint = (p) => {
    if (Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number') {
      const [lng, lat] = p;
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        minLng = Math.min(minLng, lng); minLat = Math.min(minLat, lat);
        maxLng = Math.max(maxLng, lng); maxLat = Math.max(maxLat, lat);
      }
    }
  };
  const walk = (arr) => {
    if (!Array.isArray(arr)) return;
    if (arr.length >= 2 && typeof arr[0] === 'number' && typeof arr[1] === 'number') {
      addPoint(arr);
      return;
    }
    arr.forEach(walk);
  };
  walk(geometry.coordinates);
  if (minLng === Infinity) return null;
  return L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
}

function extractOuterRings(geometry) {
  if (!geometry?.coordinates) return [];
  const toLatLngRing = (ring) => ring.map(([lng, lat]) => [lat, lng]);
  if (geometry.type === 'Polygon') {
    return Array.isArray(geometry.coordinates[0]) ? [toLatLngRing(geometry.coordinates[0])] : [];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .map((polygon) => (Array.isArray(polygon?.[0]) ? toLatLngRing(polygon[0]) : null))
      .filter(Boolean);
  }
  return [];
}

// 선택한 시/군/구 경계 강조 + 외부 블러 마스크
function DistrictBoundaryOverlay({ districtFeature }) {
  const map = useMap();
  const layersRef = useRef({ mask: null, outline: null });

  useEffect(() => {
    const paneMask = map.getPane('district-mask') || map.createPane('district-mask');
    paneMask.style.zIndex = 450;
    paneMask.style.pointerEvents = 'none';
    paneMask.style.backdropFilter = 'blur(10px)';
    paneMask.style.webkitBackdropFilter = 'blur(10px)';
    paneMask.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';

    const paneOutline = map.getPane('district-outline') || map.createPane('district-outline');
    paneOutline.style.zIndex = 460;
    paneOutline.style.pointerEvents = 'none';

    if (layersRef.current.mask) {
      map.removeLayer(layersRef.current.mask);
      layersRef.current.mask = null;
    }
    if (layersRef.current.outline) {
      map.removeLayer(layersRef.current.outline);
      layersRef.current.outline = null;
    }

    if (!districtFeature?.geometry) return undefined;

    const worldRing = [[-90, -180], [-90, 180], [90, 180], [90, -180]];
    const holes = extractOuterRings(districtFeature.geometry);
    const maskLayer = L.polygon([worldRing, ...holes], {
      pane: 'district-mask',
      stroke: false,
      fillColor: '#ffffff',
      fillOpacity: 0.45
    }).addTo(map);

    const outlineLayer = L.geoJSON(districtFeature, {
      pane: 'district-outline',
      style: { color: 'rgb(45, 90, 255)', weight: 2, opacity: 1, fillOpacity: 0 }
    }).addTo(map);

    layersRef.current = { mask: maskLayer, outline: outlineLayer };

    return () => {
      if (layersRef.current.mask) map.removeLayer(layersRef.current.mask);
      if (layersRef.current.outline) map.removeLayer(layersRef.current.outline);
      layersRef.current = { mask: null, outline: null };
    };
  }, [map, districtFeature]);

  return null;
}

// 지도 뷰포트: 시/군/구 bounds 또는 지역 중심으로 확대
function MapViewport({ districtBounds, regionCenter, hasDistrictSelected }) {
  const map = useMap();
  useEffect(() => {
    const apply = () => {
      if (districtBounds) {
        map.fitBounds(districtBounds, { padding: [40, 40], maxZoom: 14 });
      } else if (hasDistrictSelected && regionCenter) {
        map.setView(regionCenter, 11, { animate: false });
      }
    };
    if (typeof map.whenReady === 'function') map.whenReady(apply);
    else apply();
  }, [map, districtBounds, hasDistrictSelected, regionCenter]);
  return null;
}

// 지도 데이터: https://github.com/southkorea/southkorea-maps (시/도는 번들 JSON 사용, 시군구는 타임아웃 적용)
const MUNICIPALITIES_TOPOLOGY_URL = 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-municipalities-2018-topo-simple.json';
const MUNICIPALITIES_OBJECT_NAME = 'skorea_municipalities_2018_geo';
const BASE_MUNICIPALITIES_BY_REGION_URL = 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/by-province';
const FETCH_TIMEOUT_MS = 6000;

function fetchWithTimeout(url, ms = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal })
    .then((r) => {
      clearTimeout(id);
      return r;
    })
    .catch((err) => {
      clearTimeout(id);
      throw err;
    });
}

export default function HospitalSearch({ open, onClose }) {
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [showMapForRegion, setShowMapForRegion] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [geoData] = useState(() => (provincesGeo?.features ? provincesGeo : null));
  const [municipalityTopo, setMunicipalityTopo] = useState(null);
  const [municipalityTopoLoading, setMunicipalityTopoLoading] = useState(false);
  const [districtGeoByRegion, setDistrictGeoByRegion] = useState(null);
  const [districtGeoByRegionLoading, setDistrictGeoByRegionLoading] = useState(false);

  const detailEnterStyle = {
    animation: 'districtEnter 320ms ease-out',
    '@keyframes districtEnter': {
      '0%': { opacity: 0, transform: 'translateY(10px) scale(0.985)' },
      '100%': { opacity: 1, transform: 'translateY(0) scale(1)' }
    }
  };

  // 전국 시/군/구 TopoJSON 로드 (타임아웃으로 무한 로딩 방지)
  useEffect(() => {
    if (!open) return;
    setMunicipalityTopoLoading(true);
    fetchWithTimeout(MUNICIPALITIES_TOPOLOGY_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((data) => data && setMunicipalityTopo(data))
      .catch(() => setMunicipalityTopo(null))
      .finally(() => setMunicipalityTopoLoading(false));
  }, [open]);

  // 선택한 시/도에 해당하는 시/군/구 GeoJSON (도별 파일 우선, 타임아웃 적용)
  useEffect(() => {
    if (!open || !selectedRegion) {
      setDistrictGeoByRegion(null);
      return;
    }
    const code = REGION_TO_CODE_PREFIX[selectedRegion];
    if (!code) {
      setDistrictGeoByRegion(null);
      return;
    }
    setDistrictGeoByRegionLoading(true);
    const url = `${BASE_MUNICIPALITIES_BY_REGION_URL}/${code}.json`;
    fetchWithTimeout(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((data) => {
        if (data?.type === 'FeatureCollection' && Array.isArray(data.features) && data.features.length > 0) {
          setDistrictGeoByRegion(data);
        } else {
          setDistrictGeoByRegion(null);
        }
      })
      .catch(() => setDistrictGeoByRegion(null))
      .finally(() => setDistrictGeoByRegionLoading(false));
  }, [open, selectedRegion]);

  // 현재 단계에서 쓰는 시/군/구 GeoJSON (도별 파일 없으면 TopoJSON에서 코드로 필터)
  const districtGeoDataForRegion = useMemo(() => {
    if (!selectedRegion) return null;
    if (districtGeoByRegion?.features?.length > 0) return districtGeoByRegion;
    if (!municipalityTopo) return null;
    const prefix = REGION_TO_CODE_PREFIX[selectedRegion];
    if (!prefix) return null;
    const object = municipalityTopo.objects?.[MUNICIPALITIES_OBJECT_NAME];
    if (!object) return null;
    const full = topojsonFeature(municipalityTopo, object);
    const fullCollection = full?.type === 'FeatureCollection' ? full : (full ? { type: 'FeatureCollection', features: [full] } : null);
    if (!fullCollection?.features) return null;
    const filtered = fullCollection.features.filter((f) => (String(f.properties?.code || '')).startsWith(prefix));
    return filtered.length ? { type: 'FeatureCollection', features: filtered } : null;
  }, [selectedRegion, municipalityTopo, districtGeoByRegion]);

  const selectedDistrictFeature = useMemo(() => {
    if (!selectedDistrict || !districtGeoDataForRegion?.features) return null;
    const norm = normalizeDistrictName(selectedDistrict);
    return districtGeoDataForRegion.features.find(
      (f) => (f.properties?.name || '') === selectedDistrict || normalizeDistrictName(f.properties?.name) === norm
    );
  }, [selectedDistrict, districtGeoDataForRegion]);

  const selectedDistrictBounds = useMemo(() => {
    if (!selectedDistrictFeature?.geometry) return null;
    return boundsFromGeometry(selectedDistrictFeature.geometry);
  }, [selectedDistrictFeature]);

  const handleClose = () => {
    setSelectedRegion(null);
    setSelectedDistrict(null);
    setShowMapForRegion(false);
    setSearchQuery('');
    onClose();
  };

  const handleBack = () => {
    if (showMapForRegion) {
      setShowMapForRegion(false);
      setSelectedDistrict(null);
    } else {
      setSelectedRegion(null);
    }
  };

  const handleSelectDistrict = (district) => {
    setSelectedDistrict(district);
    setShowMapForRegion(true);
  };

  const handleSelectAll = () => {
    setSelectedDistrict(null);
    setShowMapForRegion(true);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          border: '1px solid #e8e8e9'
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#252525',
          borderBottom: '1px solid #e8e8e9',
          py: 2,
          fontFamily: "'PyeojinGothic', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
          fontWeight: 700
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {(selectedRegion || showMapForRegion) && (
            <IconButton onClick={handleBack} sx={{ color: '#626262', mr: 0.5 }} size="small">
              <ArrowBackIcon />
            </IconButton>
          )}
          <span>
            {selectedRegion
              ? showMapForRegion
                ? selectedDistrict
                  ? `${selectedRegion} > ${selectedDistrict}`
                  : selectedRegion
                : `${selectedRegion} - 시/군/구 선택`
              : '근처 병원찾기'}
          </span>
        </Box>
        <IconButton onClick={handleClose} sx={{ color: '#626262' }} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, backgroundColor: '#fbfbfc', minHeight: 560 }}>
        {!selectedRegion ? (
          <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                placeholder="병원명 또는 주소 검색 (예: 강남구, 서울아산병원)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#9ca3af' }} />
                    </InputAdornment>
                  ),
                  sx: {
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e5e7eb' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#cbd5e1' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3b82f6', borderWidth: 2 },
                  },
                }}
              />
            </Box>
            <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderRadius: '12px', p: 1.5, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
              {geoData?.features?.length ? (
                <KoreaGeoMap geoData={geoData} onSelectRegion={setSelectedRegion} />
              ) : (
                <Box sx={{ width: '100%', maxWidth: 560, aspectRatio: '4/5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '0.9rem' }}>
                  지도 데이터를 불러올 수 없습니다.
                </Box>
              )}
            </Box>
          </Box>
        ) : !showMapForRegion ? (
          <Box sx={{ width: '100%', p: 3 }}>
            <Typography sx={{ color: '#555', mb: 2, fontSize: '0.9rem' }}>
              시/군/구를 선택하면 해당 지역이 지도에서 확대됩니다.
            </Typography>
            {districtGeoDataForRegion ? (
              <>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2 }}>
                  <Chip label="전체" size="medium" onClick={handleSelectAll} variant="outlined" color="primary" sx={{ fontSize: '0.9rem' }} />
                </Box>
                <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderRadius: '12px', p: 1.5, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
                  <ProvinceDistrictMap
                    districtGeoData={districtGeoDataForRegion}
                    onSelectDistrict={handleSelectDistrict}
                  />
                </Box>
              </>
            ) : municipalityTopoLoading || districtGeoByRegionLoading ? (
              <Box sx={{ py: 3, color: '#888', fontSize: '0.875rem' }}>시/군/구 지도 불러오는 중…</Box>
            ) : (
              <Box sx={{ py: 3, color: '#888', fontSize: '0.875rem' }}>해당 지역 시/군/구 데이터를 불러올 수 없습니다.</Box>
            )}
          </Box>
        ) : (
          <Box key={`detail-${selectedRegion}-${selectedDistrict || 'all'}`} sx={{ width: '100%', ...detailEnterStyle }}>
            <Box sx={{ height: 460, width: '100%' }}>
              <MapContainer
                key={`map-${selectedRegion}-${selectedDistrict || 'all'}`}
                center={REGION_CENTERS[selectedRegion] || [36.5, 127.5]}
                zoom={10}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapViewport
                  districtBounds={selectedDistrictBounds}
                  regionCenter={REGION_CENTERS[selectedRegion]}
                  hasDistrictSelected={!!selectedDistrict}
                />
                {selectedDistrictFeature && (
                  <DistrictBoundaryOverlay districtFeature={selectedDistrictFeature} />
                )}
              </MapContainer>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
