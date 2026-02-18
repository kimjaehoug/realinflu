/* eslint-disable no-console */
/**
 * Local backend (proxy/relay)
 *
 * NOTE: This server uses `fetch()` (Node.js 18+).
 */
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { parseStringPromise } = require('xml2js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// 미들웨어
app.use(
  cors({
    origin: [
      'http://210.117.143.172:3001',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3306',
      'http://210.117.143.180:12020',
      'http://210.117.143.180:8000',
      'http://210.117.143.180:3001',
      // CRA dev server in this repo
      'http://localhost:5090',
      'http://127.0.0.1:5090',
      // Sometimes CRA picks a different port
      'http://localhost:5091',
      'http://127.0.0.1:5091',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// MySQL 연결 설정
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'asdf',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'doctor_pt',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// MySQL 풀 생성
const pool = mysql.createPool(dbConfig);

// 임상 노트 CSV 경로
const CLINICAL_NOTE_CSV_PATH =
  process.env.CLINICAL_NOTE_CSV_PATH ||
  '/home/jbnu/AIserver/Vital/testserver/chartevents_progression_72h_binary_100MB_up_with_mock_note.csv';
const CLINICAL_NOTE_DEBUG = process.env.CLINICAL_NOTE_DEBUG === 'true';

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  result.push(current);
  return result;
}

function normalizeCsvHeader(header) {
  if (!header) return '';
  return header.replace(/^\uFEFF/, '').trim();
}

// JWT 시크릿 키
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 데이터베이스 초기화
async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();

    // 사용자 테이블 생성
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 채팅 세션 테이블 생성
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) DEFAULT '새 대화',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 메시지 테이블 생성
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id INT NOT NULL,
        sender ENUM('user', 'assistant') NOT NULL,
        text TEXT NOT NULL,
        data JSON,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
      )
    `);

    connection.release();
    console.log('데이터베이스 초기화 완료');
  } catch (error) {
    console.error('데이터베이스 초기화 오류:', error);
    console.log('MySQL 연결 없이 서버가 실행됩니다. 일부 기능이 제한될 수 있습니다.');
  }
}

// JWT 토큰 검증 미들웨어
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '액세스 토큰이 필요합니다' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '유효하지 않은 토큰입니다' });
    }
    req.user = user;
    next();
  });
};

// 회원가입
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: '모든 필드를 입력해주세요' });
    }

    const connection = await pool.getConnection();

    // 중복 확인
    const [existingUsers] = await connection.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      connection.release();
      return res.status(400).json({ error: '이미 존재하는 사용자명 또는 이메일입니다' });
    }

    // 비밀번호 해시화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자 생성
    const [result] = await connection.execute(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    connection.release();

    // JWT 토큰 생성
    const token = jwt.sign({ userId: result.insertId, username }, JWT_SECRET, {
      expiresIn: '24h',
    });

    res.status(201).json({
      message: '회원가입이 완료되었습니다',
      token,
      user: { id: result.insertId, username, email },
    });
  } catch (error) {
    console.error('회원가입 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 로그인
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '사용자명과 비밀번호를 입력해주세요' });
    }

    const connection = await pool.getConnection();

    // 사용자 조회
    const [users] = await connection.execute('SELECT * FROM users WHERE username = ?', [
      username,
    ]);

    connection.release();

    if (users.length === 0) {
      return res.status(401).json({ error: '사용자명 또는 비밀번호가 올바르지 않습니다' });
    }

    const user = users[0];

    // 비밀번호 확인
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: '사용자명 또는 비밀번호가 올바르지 않습니다' });
    }

    // JWT 토큰 생성
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: '24h',
    });

    res.json({
      message: '로그인이 완료되었습니다',
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 임상 노트 목록 조회 (CSV 기반)
app.get('/api/patient/notes', async (req, res) => {
  try {
    const subjectId = String(req.query.subject_id || '').trim();
    const hadmId = String(req.query.hadm_id || '').trim();
    const limit = Math.min(Number(req.query.limit || 50), 200);

    if (!subjectId || !hadmId) {
      return res.status(400).json({ error: 'subject_id, hadm_id가 필요합니다.' });
    }

    if (!fs.existsSync(CLINICAL_NOTE_CSV_PATH)) {
      return res.status(500).json({ error: '임상 노트 CSV 파일을 찾을 수 없습니다.' });
    }

    const stream = fs.createReadStream(CLINICAL_NOTE_CSV_PATH, { encoding: 'utf-8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    let headers = null;
    const notes = [];
    const seen = new Set();

    for await (const line of rl) {
      if (!headers) {
        headers = parseCsvLine(line);
        if (CLINICAL_NOTE_DEBUG) {
          console.log('[notes] headers:', headers);
        }
        continue;
      }
      const cols = parseCsvLine(line);
      if (cols.length !== headers.length) continue;

      const row = {};
      for (let i = 0; i < headers.length; i += 1) {
        row[headers[i]] = cols[i];
      }

      if (String(row.subject_id) !== subjectId || String(row.hadm_id) !== hadmId) {
        continue;
      }

      const note = (row.clinical_note || '').trim();
      if (!note) continue;
      if (seen.has(note)) continue;
      seen.add(note);

      notes.push({
        id: `${notes.length + 1}`,
        charttime: row.charttime || null,
        clinical_note: note,
      });

      if (CLINICAL_NOTE_DEBUG && notes.length === 1) {
        console.log('[notes] first match:', {
          subject_id: row.subject_id,
          hadm_id: row.hadm_id,
          charttime: row.charttime,
          note_len: note.length,
        });
      }

      if (notes.length >= limit) break;
    }

    if (CLINICAL_NOTE_DEBUG) {
      console.log('[notes] query result', { subjectId, hadmId, count: notes.length });
    }
    return res.json({ subject_id: subjectId, hadm_id: hadmId, items: notes });
  } catch (error) {
    console.error('임상 노트 조회 오류:', error);
    return res.status(500).json({ error: '임상 노트 조회 중 오류가 발생했습니다.' });
  }
});

// 채팅 세션 목록 조회
app.get('/api/chat-sessions', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [sessions] = await connection.execute(
      'SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC',
      [req.user.userId]
    );

    connection.release();
    res.json(sessions);
  } catch (error) {
    console.error('채팅 세션 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 새 채팅 세션 생성
app.post('/api/chat-sessions', authenticateToken, async (req, res) => {
  try {
    const { title } = req.body;
    const connection = await pool.getConnection();

    const [result] = await connection.execute(
      'INSERT INTO chat_sessions (user_id, title) VALUES (?, ?)',
      [req.user.userId, title || '새 대화']
    );

    connection.release();
    res.status(201).json({ id: result.insertId, title: title || '새 대화' });
  } catch (error) {
    console.error('채팅 세션 생성 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 채팅 세션 이름 변경
app.put('/api/chat-sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title } = req.body;
    const connection = await pool.getConnection();

    // 세션 소유권 확인
    const [sessions] = await connection.execute(
      'SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?',
      [sessionId, req.user.userId]
    );

    if (sessions.length === 0) {
      connection.release();
      return res.status(404).json({ error: '채팅 세션을 찾을 수 없습니다' });
    }

    // 세션 이름 업데이트
    await connection.execute('UPDATE chat_sessions SET title = ? WHERE id = ?', [
      title,
      sessionId,
    ]);

    connection.release();
    res.json({ message: '대화 이름이 변경되었습니다' });
  } catch (error) {
    console.error('채팅 세션 이름 변경 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 채팅 세션 삭제
app.delete('/api/chat-sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const connection = await pool.getConnection();

    // 세션 소유권 확인
    const [sessions] = await connection.execute(
      'SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?',
      [sessionId, req.user.userId]
    );

    if (sessions.length === 0) {
      connection.release();
      return res.status(404).json({ error: '채팅 세션을 찾을 수 없습니다' });
    }

    // 세션 삭제 (CASCADE로 인해 관련 메시지도 자동 삭제됨)
    await connection.execute('DELETE FROM chat_sessions WHERE id = ?', [sessionId]);

    connection.release();
    res.json({ message: '대화가 삭제되었습니다' });
  } catch (error) {
    console.error('채팅 세션 삭제 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 채팅 세션의 메시지 조회
app.get('/api/chat-sessions/:sessionId/messages', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const connection = await pool.getConnection();

    // 세션 소유권 확인
    const [sessions] = await connection.execute(
      'SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?',
      [sessionId, req.user.userId]
    );

    if (sessions.length === 0) {
      connection.release();
      return res.status(404).json({ error: '채팅 세션을 찾을 수 없습니다' });
    }

    const [messages] = await connection.execute(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC',
      [sessionId]
    );

    // data 필드를 JSON으로 파싱
    const parsedMessages = messages.map((message) => ({
      ...message,
      data: message.data ? JSON.parse(message.data) : null,
    }));

    connection.release();
    res.json(parsedMessages);
  } catch (error) {
    console.error('메시지 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 메시지 저장
app.post('/api/chat-sessions/:sessionId/messages', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { sender, text, data } = req.body;
    const connection = await pool.getConnection();

    // 세션 소유권 확인
    const [sessions] = await connection.execute(
      'SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?',
      [sessionId, req.user.userId]
    );

    if (sessions.length === 0) {
      connection.release();
      return res.status(404).json({ error: '채팅 세션을 찾을 수 없습니다' });
    }

    // 메시지 저장
    const [result] = await connection.execute(
      'INSERT INTO messages (session_id, sender, text, data) VALUES (?, ?, ?, ?)',
      [sessionId, sender, text, data ? JSON.stringify(data) : null]
    );

    // 세션 업데이트 시간 갱신
    await connection.execute('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      sessionId,
    ]);

    connection.release();
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error('메시지 저장 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// AI 서버로 프록시하는 /predict 엔드포인트
app.post('/predict', async (req, res) => {
  try {
    const response = await fetch('http://210.117.143.172:3878/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      throw new Error(`AI 서버 오류: ${response.status}`);
    }

    const data = await response.json();
    console.log('[predict] raw response:', JSON.stringify(data));
    res.json(data);
  } catch (error) {
    console.error('AI 서버 프록시 오류:', error);
    res.status(500).json({
      error: 'AI 서버와의 통신 중 오류가 발생했습니다',
      details: error.message,
    });
  }
});

// NER 추출 API (프록시)
app.post('/analyze', async (req, res) => {
  try {
    const response = await fetch('http://210.117.143.180:8000/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      throw new Error(`AI 서버 오류: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('NER 추출 오류:', error);
    res.status(500).json({ error: 'NER 추출 중 오류가 발생했습니다.' });
  }
});

// 공공데이터포털 병상 정보 프록시
app.get('/api/beds', async (req, res) => {
  const {
    STAGE1 = '서울특별시',
    STAGE2 = '영등포구',
    pageNo = 1,
    numOfRows = 20,
    hospitalName = '',
    hpid = '',
  } = req.query;

  const SERVICE_KEY = process.env.EMERGENCY_BED_API_KEY;

  try {
    if (!SERVICE_KEY) {
      return res
        .status(500)
        .json({ error: 'EMERGENCY_BED_API_KEY 환경변수가 설정되지 않았습니다.' });
    }

    const apiUrl = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${encodeURIComponent(
      SERVICE_KEY
    )}&STAGE1=${encodeURIComponent(STAGE1)}&STAGE2=${encodeURIComponent(
      STAGE2
    )}&pageNo=${pageNo}&numOfRows=${numOfRows}`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`);
    }

    const xmlText = await response.text();
    const parsed = await parseStringPromise(xmlText);
    const items = parsed?.response?.body?.[0]?.items?.[0]?.item || [];

    const normalizeHospitalName = (name = '') =>
      String(name).replace(/\s+/g, '').replace(/[()\-]/g, '').trim().toLowerCase();
    const normalizedTarget = normalizeHospitalName(hospitalName);
    const target =
      Array.isArray(items) && items.length > 0
        ? items.find((item) => hpid && item.hpid?.[0] === hpid) ||
          items.find(
            (item) => normalizedTarget && normalizeHospitalName(item.dutyName?.[0]) === normalizedTarget
          ) ||
          items.find(
            (item) =>
              normalizedTarget && normalizeHospitalName(item.dutyName?.[0]).includes(normalizedTarget)
          ) ||
          items[0]
        : null;

    if (!target) {
      return res.status(404).json({ error: '병원 데이터를 찾을 수 없습니다.' });
    }

    const emergencyTotal = Number(target.hvs01?.[0] || 0);
    const inpatientTotal = Number(target.hvs38?.[0] || 0);
    const hvec = Number(target.hvec?.[0] || 0); // 응급 가용
    const hvgc = Number(target.hvgc?.[0] || 0); // 일반 가용

    const stats = {
      dutyName: target.dutyName?.[0] || '',
      hpid: target.hpid?.[0] || '',
      totalBeds: emergencyTotal + inpatientTotal,
      availableBeds: hvec + hvgc,
      occupiedBeds: emergencyTotal - hvec + (inpatientTotal - hvgc),
      emergencyAvailable: hvec > 0 ? 'Y' : 'N',
      inpatientAvailable: hvgc > 0 ? 'Y' : 'N',
      emergencyTotal,
      emergencyAvailableCount: hvec,
      emergencyOccupiedCount: emergencyTotal - hvec,
      inpatientTotal,
      inpatientAvailableCount: hvgc,
      inpatientOccupiedCount: inpatientTotal - hvgc,
      hvidate: target.hvidate?.[0] || '',
    };

    const equipment = {
      ct: target.hvctayn?.[0] || 'N',
      mri: target.hvmriayn?.[0] || 'N',
      ventilator: target.hvventiayn?.[0] || 'N',
      ventilatorNeonatal: target.hvventisoayn?.[0] || 'N',
      angiography: target.hvangioayn?.[0] || 'N',
      hyperbaricOxygen: target.hvoxyayn?.[0] || 'N',
      incubator: target.hvincuayn?.[0] || 'N',
    };

    res.json({
      dutyName: target.dutyName?.[0] || '',
      dutyTel3: target.dutyTel3?.[0] || '',
      hpid: target.hpid?.[0] || '',
      stats,
      equipment,
      raw: {
        hvec,
        hvgc,
        hvidate: target.hvidate?.[0] || '',
      },
    });
  } catch (error) {
    console.error('병상 데이터 조회 오류:', error);
    res.status(500).json({ error: '병상 데이터 조회에 실패했습니다.', details: error.message });
  }
});

// 공공데이터포털 장비 정보 API 프록시
app.get('/api/equipment', async (req, res) => {
  const { pageNo = 1, numOfRows = 100, ykiho = '' } = req.query;

  const SERVICE_KEY = process.env.EMERGENCY_BED_API_KEY;
  const YKIHO =
    ykiho ||
    process.env.DEFAULT_EQUIPMENT_YKIHO ||
    'JDQ4MTg4MSM1MSMkMSMkMCMkODkkMzgxMzUxIzExIyQyIyQzIyQwMCQyNjE0ODEjNTEjJDEjJDYjJDgz';

  try {
    if (!SERVICE_KEY) {
      return res
        .status(500)
        .json({ error: 'EMERGENCY_BED_API_KEY 환경변수가 설정되지 않았습니다.' });
    }

    const apiUrl = `https://apis.data.go.kr/B551182/MadmDtlInfoService2.7/getMedOftInfo2.7?serviceKey=${encodeURIComponent(
      SERVICE_KEY
    )}&ykiho=${encodeURIComponent(YKIHO)}&pageNo=${pageNo}&numOfRows=${numOfRows}&_type=json`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`);
    }

    const data = await response.json();

    // API 응답 구조 확인
    if (data?.response?.body?.items?.item) {
      const items = Array.isArray(data.response.body.items.item)
        ? data.response.body.items.item
        : [data.response.body.items.item];

      const payload = {
        success: true,
        items: items.map((item) => ({
          code: item.oftCd || '',
          name: item.oftCdNm || '',
          count: parseInt(item.oftCnt, 10) || 0,
        })),
        totalCount: data.response.body.totalCount || items.length,
        pageNo: data.response.body.pageNo || pageNo,
        numOfRows: data.response.body.numOfRows || numOfRows,
      };
      console.log('[equipment] payload:', payload);
      res.json(payload);
    } else {
      const payload = {
        success: true,
        items: [],
        totalCount: 0,
        pageNo,
        numOfRows,
      };
      console.log('[equipment] empty payload:', payload);
      res.json(payload);
    }
  } catch (error) {
    console.error('장비 데이터 조회 오류:', error);
    res.status(500).json({ error: '장비 데이터 조회에 실패했습니다.', details: error.message });
  }
});

// 병원 위치 정보 CSV 경로 (여러 후보 시도)
function getHospitalCsvPath() {
  if (process.env.HOSPITAL_CSV_PATH && fs.existsSync(process.env.HOSPITAL_CSV_PATH)) {
    return process.env.HOSPITAL_CSV_PATH;
  }
  const candidates = [
    path.join(__dirname, '..', 'public', 'data', '병원위치정보.csv'),
    path.join(process.cwd(), 'public', 'data', '병원위치정보.csv'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

// 병원 위치 정보 API (지도 마커용)
app.get('/api/hospitals', (req, res) => {
  try {
    const HOSPITAL_CSV_PATH = getHospitalCsvPath();
    if (!fs.existsSync(HOSPITAL_CSV_PATH)) {
      return res.status(404).json({
        error: '병원 위치 CSV를 찾을 수 없습니다.',
        path: HOSPITAL_CSV_PATH,
      });
    }
    const content = fs.readFileSync(HOSPITAL_CSV_PATH, 'utf-8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      return res.json([]);
    }
    const header = parseCsvLine(lines[0]).map(normalizeCsvHeader);
    const rows = [];
    for (let i = 1; i < lines.length; i += 1) {
      const cells = parseCsvLine(lines[i]);
      const row = {};
      header.forEach((h, j) => {
        row[h] = cells[j] !== undefined ? String(cells[j]).trim() : '';
      });
      const x = parseFloat(row['X좌표']);
      const y = parseFloat(row['Y좌표']);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      rows.push({
        병원이름: row['병원이름'],
        X좌표: x,
        Y좌표: y,
        '시/도': row['시/도'],
        '시/군/구': row['시/군/구'],
        주소: row['주소'],
        전화번호: row['전화번호'] || '',
        암호화요양기호: row['암호화요양기호'] || '',
        hpid: row['hpid'] || '',
      });
    }
    res.json(rows);
  } catch (error) {
    console.error('병원 위치 조회 오류:', error);
    res.status(500).json({ error: '병원 위치 데이터 조회에 실패했습니다.', details: error.message });
  }
});

/**
 * Local ETL mock API (serves `../data/ds_XXXX_page_N.json` as Data API)
 *
 * Frontend expects baseURL like: http://localhost:5001/data/api/v1
 * and calls:
 * - GET /etl_data/statistics
 * - GET /etl_data/id/:dsid/recent/:cnt
 * - GET /etl_data/id/:dsid/from/:from/to/:to
 * - GET /etl_data/id/:dsid/origin/:origin
 */
const DATA_API_BASE = '/data/api/v1';
const ETL_DATA_DIR = process.env.ETL_DATA_DIR || path.join(__dirname, '..', 'data');

// ---------------------------------------------------------------------------
// Infectious-disease news feed (Google News RSS aggregator)
// ---------------------------------------------------------------------------
const NEWS_KEYWORDS_DEFAULT = [
  '감염병',
  '전염병',
  '인플루엔자',
  '독감',
  '코로나',
  'RSV',
  '홍역',
  '백일해',
  '노로바이러스',
  '식중독',
];

function safeText(v) {
  if (v == null) return '';
  return String(v).trim();
}

function parseGoogleNewsRssItems(xmlText, keyword) {
  return parseStringPromise(xmlText, { explicitArray: true, trim: true })
    .then((parsed) => {
      const items = parsed?.rss?.channel?.[0]?.item || [];
      if (!Array.isArray(items)) return [];
      return items
        .map((it) => {
          const title = safeText(it?.title?.[0]);
          const link = safeText(it?.link?.[0]);
          const pubDateRaw = safeText(it?.pubDate?.[0]);
          const pubDate = pubDateRaw ? new Date(pubDateRaw) : null;
          // toISOString() can throw on invalid date
          const publishedAt =
            pubDate && Number.isFinite(pubDate.getTime()) ? pubDate.toISOString() : null;

          // Google News RSS often has <source url="...">매체</source>
          const sourceNode = it?.source?.[0];
          const source =
            typeof sourceNode === 'string'
              ? safeText(sourceNode)
              : safeText(sourceNode?._);
          const sourceUrl = safeText(sourceNode?.$?.url);

          if (!title || !link) return null;
          return {
            title,
            link,
            source: source || null,
            sourceUrl: sourceUrl || null,
            publishedAt,
            keyword,
          };
        })
        .filter(Boolean);
    })
    .catch(() => []);
}

async function fetchWithTimeout(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

let newsCache = { ts: 0, items: [] };

app.get(`${DATA_API_BASE}/news`, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 60), 1), 200);
    const keywords =
      typeof req.query.keywords === 'string' && req.query.keywords.trim()
        ? req.query.keywords
            .split(',')
            .map((s) => safeText(s))
            .filter(Boolean)
            .slice(0, 30)
        : NEWS_KEYWORDS_DEFAULT;
    const cacheKey = keywords.join(',');

    // simple in-memory cache to reduce RSS calls
    const now = Date.now();
    const ttlMs = 1000 * 60 * 5; // 5 min
    // IMPORTANT: cache must not depend on previously requested `limit`
    if (
      newsCache.items.length > 0 &&
      newsCache.key === cacheKey &&
      now - newsCache.ts < ttlMs
    ) {
      return res.json({ items: newsCache.items.slice(0, limit), cached: true });
    }

    const rssUrls = keywords.map((kw) => {
      const q = encodeURIComponent(kw);
      return {
        keyword: kw,
        url: `https://news.google.com/rss/search?q=${q}&hl=ko&gl=KR&ceid=KR:ko`,
      };
    });

    const results = await Promise.allSettled(
      rssUrls.map(async ({ keyword, url }) => {
        const xml = await fetchWithTimeout(url, 7000);
        const items = await parseGoogleNewsRssItems(xml, keyword);
        return items;
      })
    );

    const all = [];
    results.forEach((r) => {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        all.push(...r.value);
      }
    });

    // dedupe by link (fallback: title+source)
    const seen = new Set();
    const deduped = [];
    for (const it of all) {
      const key = it.link || `${it.title}__${it.source || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(it);
    }

    deduped.sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));

    const cacheMax = 200;
    const cachedItems = deduped.slice(0, cacheMax);
    newsCache = { ts: now, key: cacheKey, items: cachedItems };
    return res.json({ items: cachedItems.slice(0, limit), cached: false });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

function normalizeDsid(dsid) {
  const s = String(dsid || '').trim();
  if (!s) return '';
  return s.startsWith('ds_') ? s : `ds_${s}`;
}

function extractRows(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.body?.data)) return json.body.data;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.items)) return json.items;
  return [];
}

function toDate(v) {
  const d = new Date(v);
  // eslint-disable-next-line no-restricted-globals
  return isNaN(d.getTime()) ? null : d;
}

function endOfDay(dateOnly) {
  const d = toDate(dateOnly);
  if (!d) return null;
  d.setHours(23, 59, 59, 999);
  return d;
}

function listDatasetFiles(dsid) {
  const prefix = `${normalizeDsid(dsid)}_page_`;
  if (!fs.existsSync(ETL_DATA_DIR)) return [];
  return fs
    .readdirSync(ETL_DATA_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .sort((a, b) => {
      const pa = Number(a.slice(prefix.length, -'.json'.length));
      const pb = Number(b.slice(prefix.length, -'.json'.length));
      return pa - pb;
    })
    .map((f) => path.join(ETL_DATA_DIR, f));
}

function loadDatasetRows(dsid) {
  const files = listDatasetFiles(dsid);
  const all = [];
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf-8');
    const json = JSON.parse(raw);
    all.push(...extractRows(json));
  }
  return all;
}

// datasets statistics
app.get(`${DATA_API_BASE}/etl_data/statistics`, (req, res) => {
  try {
    if (!fs.existsSync(ETL_DATA_DIR)) {
      return res.status(500).json({ error: 'ETL_DATA_DIR not found', ETL_DATA_DIR });
    }
    const files = fs.readdirSync(ETL_DATA_DIR);
    const dsids = Array.from(
      new Set(
        files
          .filter((f) => /^ds_\d+_page_\d+\.json$/.test(f))
          .map((f) => f.split('_page_')[0])
      )
    ).sort();
    const stats = dsids.map((dsId) => ({ dsId, recordCount: loadDatasetRows(dsId).length }));
    return res.json({ body: { data: stats } });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

// recent
app.get(`${DATA_API_BASE}/etl_data/id/:dsid/recent/:cnt`, (req, res) => {
  try {
    const dsid = normalizeDsid(req.params.dsid);
    const cnt = Math.min(Math.max(Number(req.params.cnt || 0), 0), 1000);
    const rows = loadDatasetRows(dsid)
      .slice()
      .sort((a, b) => String(b.collectedAt || '').localeCompare(String(a.collectedAt || '')))
      .slice(0, cnt);
    return res.json({ body: { data: rows } });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

// date range (by collectedAt)
app.get(`${DATA_API_BASE}/etl_data/id/:dsid/from/:from/to/:to`, (req, res) => {
  try {
    const dsid = normalizeDsid(req.params.dsid);
    const fromD = toDate(req.params.from);
    const toD = endOfDay(req.params.to);
    if (!fromD || !toD) return res.status(400).json({ error: 'Invalid from/to date' });
    const rows = loadDatasetRows(dsid).filter((r) => {
      const d = toDate(r?.collectedAt);
      return d && d >= fromD && d <= toD;
    });
    return res.json({ body: { data: rows } });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

// origin
app.get(`${DATA_API_BASE}/etl_data/id/:dsid/origin/:origin`, (req, res) => {
  try {
    const dsid = normalizeDsid(req.params.dsid);
    const origin = String(req.params.origin || '');
    const rows = loadDatasetRows(dsid).filter((r) => String(r?.origin || '') === origin);
    return res.json({ body: { data: rows } });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다`);
  initializeDatabase();
});

