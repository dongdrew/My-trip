/* 보라카이 가족여행 관리 앱
 * - 서버 없이 브라우저(localStorage + IndexedDB)에 저장
 * - 가족 간 공유는 JSON 파일 내보내기/가져오기(합치기)로 처리
 */
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KEY = 'boracay-trip-v1';
const COLS = ['schedule', 'bookings', 'expenses', 'places', 'memories', 'checklist'];

/* ---------- 날짜 ---------- */
const parseDate = (s) => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const prettyDate = (s) => { const d = parseDate(s); return d ? `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})` : ''; };
const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const dayDiff = (a, b) => Math.round((a - b) / 86400000);

/* ---------- 기본 데이터 ---------- */
function seed() {
  // 예시 데이터는 고정 id를 써서 두 폰의 데이터를 합칠 때 중복되지 않게 함
  const mk = (col, arr) => arr.map((o, i) => ({ id: `seed-${col}-${i}`, updatedAt: 1, ...o }));
  return {
    trip: {
      title: '보라카이 가족여행', start: '', end: '', nights: 4,
      families: { A: '우리 가족', B: '처제네' },
      members: { A: '나, 와이프, 딸(6살)', B: '처제, 동서, 조카' },
      rates: { PHP: 24, USD: 1380 },
      updatedAt: 0,
    },
    deleted: {},
    schedule: mk('schedule', [
      { day: 1, time: '09:00', title: '인천공항 출발', place: '인천국제공항', memo: '탑승 2~3시간 전 도착' },
      { day: 1, time: '13:00', title: '칼리보/카티클란 공항 도착 → 픽업', place: '칼리보 국제공항', memo: '픽업 기사 연락처 확인' },
      { day: 1, time: '16:00', title: '제티포트 → 보라카이 입도, 숙소 체크인', place: '카티클란 제티포트', memo: '환경세·터미널피 현금 준비, 숙소 바우처 제시' },
      { day: 1, time: '18:30', title: '화이트비치 산책 & 저녁', place: '화이트 비치', memo: '' },
      { day: 2, time: '09:00', title: '화이트비치 물놀이', place: '스테이션 1', memo: '오전이 덜 뜨거워요' },
      { day: 2, time: '12:00', title: '디몰 점심 & 망고셰이크', place: '디몰', memo: '' },
      { day: 2, time: '14:00', title: '숙소 수영장 & 아이들 낮잠', place: '숙소', memo: '' },
      { day: 2, time: '17:30', title: '선셋 세일링(파라우)', place: '화이트 비치', memo: '아이 구명조끼 필수' },
      { day: 3, time: '09:30', title: '호핑투어 (스노클링·점심 포함)', place: '크리스탈 코브 섬', memo: '멀미약, 방수팩, 아쿠아슈즈' },
      { day: 3, time: '18:30', title: '디탈리파파 시장 해산물 저녁', place: '디탈리파파', memo: '시장에서 사서 근처 식당에 조리 맡기기' },
      { day: 4, time: '10:00', title: '푸카쉘 비치', place: '푸카쉘 비치', memo: '한적하고 파도 주의' },
      { day: 4, time: '15:00', title: '마사지 (어른 교대로)', place: '', memo: '한 가족씩 교대하며 아이 돌보기' },
      { day: 4, time: '19:30', title: '해변 불쇼 구경', place: '화이트 비치', memo: '' },
      { day: 5, time: '10:00', title: '체크아웃 & 기념품 쇼핑', place: '디몰', memo: '' },
      { day: 5, time: '13:00', title: '공항 이동 → 귀국', place: '카티클란 제티포트', memo: '' },
    ]),
    bookings: mk('bookings', [
      { type: '항공', title: '인천 ↔ 칼리보/카티클란 왕복 (6명)', date: '', time: '', provider: '', confirmation: '', price: '', currency: 'KRW', status: '예약 필요', link: '', memo: '아이 좌석 같이 배정' },
      { type: '숙소', title: '리조트 (패밀리룸 2개 / 커넥팅룸)', date: '', time: '', provider: '', confirmation: '', price: '', currency: 'KRW', status: '예약 필요', link: '', memo: '키즈풀·조식 포함 여부 확인' },
      { type: '픽업·샌딩', title: '공항 ↔ 리조트 픽업·샌딩', date: '', time: '', provider: '', confirmation: '', price: '', currency: 'KRW', status: '예약 필요', link: '', memo: '밴 1대로 6명 + 짐' },
      { type: '투어·액티비티', title: '호핑투어 (프라이빗 보트)', date: '', time: '', provider: '', confirmation: '', price: '', currency: 'PHP', status: '예약 필요', link: '', memo: '' },
      { type: '스파·마사지', title: '마사지', date: '', time: '', provider: '', confirmation: '', price: '', currency: 'PHP', status: '예약 필요', link: '', memo: '' },
    ]),
    expenses: [],
    places: mk('places', [
      { name: '화이트 비치', en: 'White Beach Boracay', category: '해변', memo: '보라카이 대표 해변, 일몰 명소. 스테이션 1~3로 구분', visited: false },
      { name: '스테이션 1', en: 'Station 1 Boracay', category: '해변', memo: '모래가 가장 곱고 한적한 편', visited: false },
      { name: '윌리스 락', en: "Willy's Rock Boracay", category: '해변', memo: '스테이션 1의 바위 성모상, 사진 명소', visited: false },
      { name: '푸카쉘 비치', en: 'Puka Shell Beach Boracay', category: '해변', memo: '섬 북쪽의 조용한 해변', visited: false },
      { name: '디니위드 비치', en: 'Diniwid Beach Boracay', category: '해변', memo: '작고 조용한 해변', visited: false },
      { name: '불라복 비치', en: 'Bulabog Beach Boracay', category: '해변', memo: '동쪽 해변, 카이트서핑', visited: false },
      { name: '루호산 전망대', en: 'Mount Luho View Park Boracay', category: '관광', memo: '섬 전체가 보이는 전망대', visited: false },
      { name: '크리스탈 코브 섬', en: 'Crystal Cove Island Boracay', category: '관광', memo: '호핑투어 코스', visited: false },
      { name: '디몰', en: "D'Mall Boracay", category: '쇼핑', memo: '스테이션 2 쇼핑·식당 거리', visited: false },
      { name: '버짓마트', en: "Budget Mart D'Mall Boracay", category: '쇼핑', memo: '생수·간식·기저귀 등 마트', visited: false },
      { name: '디탈리파파', en: "D'Talipapa Boracay", category: '맛집', memo: '해산물 시장 + 조리 식당', visited: false },
      { name: '조나스 프루트셰이크', en: "Jonah's Fruit Shake Boracay", category: '맛집', memo: '망고셰이크로 유명 (스테이션 1)', visited: false },
      { name: '카티클란 제티포트', en: 'Caticlan Jetty Port', category: '교통', memo: '보라카이로 가는 배 타는 곳', visited: false },
      { name: '카티클란 공항', en: 'Godofredo P. Ramos Airport Caticlan', category: '교통', memo: '제티포트와 가까운 공항', visited: false },
      { name: '칼리보 국제공항', en: 'Kalibo International Airport', category: '교통', memo: '제티포트까지 차로 약 1.5~2시간', visited: false },
    ]),
    memories: [],
    checklist: mk('checklist', [
      { text: '여권 (유효기간 6개월 이상)', cat: '서류', done: false },
      { text: 'eTravel 등록 (출국 72시간 이내, 6명 모두)', cat: '서류', done: false },
      { text: '숙소 바우처 출력/캡처 (입도 시 확인)', cat: '서류', done: false },
      { text: '항공권 e-티켓', cat: '서류', done: false },
      { text: '아이 영문 가족관계증명서', cat: '서류', done: false },
      { text: '여행자 보험', cat: '서류', done: false },
      { text: '래시가드·수영복', cat: '아이', done: false },
      { text: '아쿠아슈즈', cat: '아이', done: false },
      { text: '구명조끼/암링', cat: '아이', done: false },
      { text: '어린이 선크림·모자', cat: '아이', done: false },
      { text: '해열제·상비약·멀미약', cat: '아이', done: false },
      { text: '모기 기피제', cat: '아이', done: false },
      { text: '간식·태블릿·장난감', cat: '아이', done: false },
      { text: '페소 환전 / 트래블카드', cat: '기타', done: false },
      { text: '멀티어댑터', cat: '기타', done: false },
      { text: '방수팩·보조배터리', cat: '기타', done: false },
    ]),
  };
}

/* ---------- 저장 ---------- */
let S;
try { S = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { S = seed(); }
for (const c of COLS) S[c] ||= [];
S.deleted ||= {};
S.patches ||= [];

// 예전 버전(랜덤 id)으로 만든 예시 항목을 고정 id로 바꿔서, 두 폰을 합칠 때 중복되지 않게 함
(function migrateSeedIds() {
  const keyOf = { schedule: (x) => `${x.day}|${x.title}`, bookings: (x) => x.title, places: (x) => x.name, checklist: (x) => x.text };
  const base = seed();
  for (const [col, key] of Object.entries(keyOf)) {
    const seedIds = new Map(base[col].map((x) => [key(x), x.id]));
    const used = new Set(S[col].map((x) => x.id));
    for (const x of S[col]) {
      const sid = seedIds.get(key(x));
      if (sid && !String(x.id).startsWith('seed-') && !used.has(sid)) { used.delete(x.id); x.id = sid; used.add(sid); }
    }
  }
})();

/* ---------- 확정된 예약 반영 (앱을 열면 한 번 자동 적용) ----------
 * 고정 id + 고정 시간으로 넣어서 두 폰에서 각각 적용돼도 합칠 때 중복되지 않음 */
const PATCH_TS = Date.parse('2026-10-19T00:00:00Z');
const putFixed = (col, item, ts = PATCH_TS) => { S[col] = S[col].filter((x) => x.id !== item.id); delete S.deleted[item.id]; S[col].push({ updatedAt: ts, ...item }); };
const put = putFixed;
const PATCHES = [
  {
    id: 'flight-NMHUN2',
    apply() {
      Object.assign(S.trip, { start: '2026-11-26', end: '2026-11-30', updatedAt: Date.now() });
      // 예시로 넣어 둔 항공 예약과 첫날/마지막날 이동 일정은 실제 항공편으로 교체
      for (const id of ['seed-bookings-0']) remove('bookings', id);
      for (const id of ['seed-schedule-0', 'seed-schedule-1', 'seed-schedule-13', 'seed-schedule-14']) remove('schedule', id);
      put('bookings', {
        id: 'bk-flight-NMHUN2', type: '항공', title: '티웨이 TW125/TW126 인천 ↔ 칼리보 왕복',
        date: '2026-11-26', time: '09:20', provider: '티웨이항공', confirmation: 'NMHUN2', price: '', currency: 'KRW', status: '결제 완료', link: '',
        memo: '가는 편 TW125 · 11/26(목) 09:20 인천 T1 → 12:55 칼리보 (4시간 35분, 직항)\n오는 편 TW126 · 11/30(월) 13:55 칼리보 → 19:05 인천 T1 (4시간 10분, 직항)\n※ 이 예약번호는 1명분 — 다른 가족 예약번호도 확인해서 추가하세요',
      });
      const sch = [
        { id: 'sc-fl-1', day: 1, time: '06:20', title: '인천공항 T1 도착 (출발 3시간 전)', place: '인천국제공항 제1터미널', memo: '티웨이 카운터 체크인, 짐 부치기' },
        { id: 'sc-fl-2', day: 1, time: '09:20', title: '✈️ TW125 인천 출발', place: '인천국제공항 제1터미널', memo: '예약번호 NMHUN2 · 비행 4시간 35분' },
        { id: 'sc-fl-3', day: 1, time: '12:55', title: '칼리보 공항 도착 → 픽업', place: '칼리보 국제공항', memo: 'eTravel QR 준비 · 제티포트까지 차로 1.5~2시간' },
        { id: 'sc-fl-4', day: 5, time: '07:30', title: '체크아웃 & 픽업 출발', place: '숙소', memo: '전날 밤 짐 싸 두기, 기념품은 Day 4에' },
        { id: 'sc-fl-5', day: 5, time: '08:30', title: '제티포트 → 칼리보 공항 이동', place: '카티클란 제티포트', memo: '배 + 차로 약 2~2.5시간' },
        { id: 'sc-fl-6', day: 5, time: '11:30', title: '칼리보 공항 체크인', place: '칼리보 국제공항', memo: '출발 2시간 전까지 도착' },
        { id: 'sc-fl-7', day: 5, time: '13:55', title: '✈️ TW126 칼리보 출발', place: '칼리보 국제공항', memo: '비행 4시간 10분' },
        { id: 'sc-fl-8', day: 5, time: '19:05', title: '인천공항 T1 도착 🏠', place: '인천국제공항 제1터미널', memo: '' },
      ];
      for (const x of sch) put('schedule', x);
    },
  },
  {
    id: 'meals-v1',
    apply() {
      const TS = Date.parse('2026-10-19T12:00:00Z');
      // 예시의 '산책 & 저녁', '디몰 점심', '디탈리파파' 일정은 식당 정보가 들어간 일정으로 교체
      for (const id of ['seed-schedule-3', 'seed-schedule-5', 'seed-schedule-9']) remove('schedule', id);
      const meals = [
        { id: 'sc-walk-d1', day: 1, time: '18:00', title: '화이트비치 산책 & 일몰', place: '화이트 비치', memo: '' },
        { id: 'sc-meal-d1-dinner', day: 1, time: '19:00', title: '🍕 저녁: 아리아 (이탈리안)', place: '디몰', map: "Aria Cucina Italiana D'Mall Boracay",
          menu: '화덕 피자, 토마토 파스타, 젤라토 — 첫날 피곤할 때 아이들도 무난', memo: '디몰 입구 쪽, 숙소 가까우면 걸어서' },
        { id: 'sc-meal-d2-snack', day: 2, time: '10:30', title: '🥭 간식: 조나스 망고셰이크', place: '스테이션 1', map: "Jonah's Fruit Shake Boracay",
          menu: '망고셰이크, 바나나·망고 믹스, 과일 셰이크 40여 종', memo: '물놀이 후 쉬어가기' },
        { id: 'sc-meal-d2-lunch', day: 2, time: '12:00', title: '🍖 점심: 아이 러브 바비큐', place: '디몰', map: "I Love BBQ D'Mall Boracay",
          menu: '폭립, 어니언링, 꼬치구이 + 망고셰이크', memo: '한국인에게 유명, 가격 부담 적음' },
        { id: 'sc-meal-d2-dinner', day: 2, time: '19:00', title: '🌅 저녁: 차차스 비치 카페', place: '스테이션 2 (코스트 보라카이)', map: "Cha Cha's Beach Cafe Boracay",
          menu: '해산물 그릴, 필리핀식 바비큐, 칵테일 / 아이: 파스타·감자튀김', memo: '해변 자리는 미리 예약 추천 (6명)' },
        { id: 'sc-meal-d3-dinner', day: 3, time: '18:30', title: '🦐 저녁: 디탈리파파 해산물 시장', place: '디탈리파파', map: "D'Talipapa Boracay",
          menu: '갈릭버터 새우, 오징어구이, 크랩, 망고 / 아이: 새우튀김·볶음밥', memo: '시장에서 무게 단위로 사고 옆 식당(파루토)에 조리 맡기기 · 흥정 필수' },
        { id: 'sc-meal-d4-brunch', day: 4, time: '08:30', title: '☕ 브런치: 리얼 커피 & 티 카페', place: '스테이션 1', map: 'Real Coffee and Tea Cafe Boracay',
          menu: '칼라만시 머핀(대표 메뉴), 커피, 브런치', memo: '머핀은 선물용으로 포장도 인기' },
        { id: 'sc-meal-d4-lunch', day: 4, time: '12:30', title: '🍛 점심: 스모크 (필리핀 가정식)', place: '디몰', map: "Smoke Resto D'Mall Boracay",
          menu: '시시그, 아도보, 칼라마리 / 아이: 치킨·갈릭라이스', memo: '저렴한 필리핀 음식 체험' },
        { id: 'sc-meal-d4-dinner', day: 4, time: '17:30', title: '🌇 저녁: 스파이더 하우스 (선셋)', place: '디니위드 비치', map: 'Spider House Boracay',
          menu: '피자, 파스타, 해산물 + 일몰', memo: '절벽 위 구조라 아이 손 꼭 잡기 · 해 지기 전 도착' },
      ];
      for (const x of meals) putFixed('schedule', x, TS);
      const places = [
        { id: 'pl-aria', name: '아리아 (이탈리안)', en: "Aria Cucina Italiana D'Mall Boracay", category: '맛집', memo: '화덕 피자, 파스타, 젤라토' },
        { id: 'pl-ilovebbq', name: '아이 러브 바비큐', en: "I Love BBQ D'Mall Boracay", category: '맛집', memo: '폭립, 어니언링' },
        { id: 'pl-chachas', name: '차차스 비치 카페', en: "Cha Cha's Beach Cafe Boracay", category: '맛집', memo: '해변 선셋 디너' },
        { id: 'pl-realcoffee', name: '리얼 커피 & 티 카페', en: 'Real Coffee and Tea Cafe Boracay', category: '카페', memo: '칼라만시 머핀' },
        { id: 'pl-smoke', name: '스모크 (필리핀 가정식)', en: "Smoke Resto D'Mall Boracay", category: '맛집', memo: '시시그, 아도보 — 저렴' },
        { id: 'pl-spider', name: '스파이더 하우스', en: 'Spider House Boracay', category: '맛집', memo: '디니위드 절벽 위 선셋 레스토랑' },
      ];
      for (const x of places) putFixed('places', { visited: false, ...x }, TS);
    },
  },
];
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('저장 공간이 부족해요'); } };

function upsert(col, item) {
  item.updatedAt = Date.now();
  if (!item.id) { item.id = uid(); S[col].push(item); }
  else { const i = S[col].findIndex((x) => x.id === item.id); if (i >= 0) S[col][i] = item; else S[col].push(item); }
  save();
}
function remove(col, id) {
  S[col] = S[col].filter((x) => x.id !== id);
  S.deleted[id] = Date.now();
  save();
}

for (const p of PATCHES) if (!S.patches.includes(p.id)) { p.apply(); S.patches.push(p.id); }
save();

/* ---------- 사진 (IndexedDB) ---------- */
const photoDB = (() => {
  let dbp;
  const open = () => (dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('boracay-photos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('photos');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('photos', mode);
      const req = fn(t.objectStore('photos'));
      t.oncomplete = () => res(req?.result);
      t.onerror = () => rej(t.error);
    });
  };
  return {
    put: (id, data) => run('readwrite', (s) => s.put(data, id)),
    get: (id) => run('readonly', (s) => s.get(id)),
    del: (id) => run('readwrite', (s) => s.delete(id)),
  };
})();
const photoCache = new Map();
async function loadPhotos(root) {
  for (const img of $$('img[data-photo]', root)) {
    const id = img.dataset.photo;
    if (!photoCache.has(id)) photoCache.set(id, await photoDB.get(id).catch(() => null));
    if (photoCache.get(id)) img.src = photoCache.get(id);
  }
}
async function compress(file, max = 1280, q = 0.8) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q);
  } finally { URL.revokeObjectURL(url); }
}

/* ---------- 공통 계산 ---------- */
function tripDays() {
  const s = parseDate(S.trip.start), e = parseDate(S.trip.end);
  if (s && e && e >= s) return dayDiff(e, s) + 1;
  return (Number(S.trip.nights) || 4) + 1;
}
function dateOfDay(day) {
  const s = parseDate(S.trip.start);
  if (!s) return '';
  const d = new Date(s); d.setDate(d.getDate() + day - 1); return fmtDate(d);
}
function currentDay() {
  const s = parseDate(S.trip.start);
  if (!s) return null;
  const n = dayDiff(today(), s) + 1;
  return n >= 1 && n <= tripDays() ? n : null;
}
const toKRW = (amount, cur) => (Number(amount) || 0) * (cur === 'KRW' ? 1 : Number(S.trip.rates[cur]) || 0);
const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const money = (n, cur) => `${(Number(n) || 0).toLocaleString('ko-KR')} ${cur === 'KRW' ? '원' : cur === 'PHP' ? '₱' : '$'}`;
const famName = (k) => S.trip.families[k] || k;

function settlement() {
  const paid = { A: 0, B: 0 }, owe = { A: 0, B: 0 };
  let total = 0;
  for (const e of S.expenses) {
    const v = toKRW(e.amount, e.currency);
    total += v;
    paid[e.payer] = (paid[e.payer] || 0) + v;
    if (e.split === 'A' || e.split === 'B') owe[e.split] += v;
    else { owe.A += v / 2; owe.B += v / 2; }
  }
  const balA = paid.A - owe.A; // 양수면 B가 A에게 줘야 함
  return { total, paid, owe, balA };
}

/* ---------- 토스트 / 모달 ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2200);
}

const modalEl = $('#modal');
// iOS Safari의 <dialog> 버그(닫은 뒤 탭이 안 먹힘)를 피하려고 직접 만든 팝업 사용
const modal = {
  get open() { return !modalEl.hidden; },
  showModal() { modalEl.hidden = false; document.body.classList.add('modal-open'); $('#modalBody').scrollTop = 0; },
  close() {
    if (document.activeElement && modalEl.contains(document.activeElement)) document.activeElement.blur();
    modalEl.hidden = true; document.body.classList.remove('modal-open');
  },
};
modalEl.addEventListener('click', (e) => { if (e.target === modalEl) modal.close(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.open) modal.close(); });
let modalHandlers = {};
function openForm({ title, fields, values = {}, onSave, onDelete, okText = '저장' }) {
  $('#modalTitle').textContent = title;
  $('#modalOk').textContent = okText;
  $('#modalOk').hidden = !onSave;
  $('#modalDelete').hidden = !onDelete;
  $('#modalBody').innerHTML = renderFields(fields, values);
  modalHandlers = { fields, onSave, onDelete };
  modal.showModal();
}
function renderFields(fields, v) {
  let html = '', buf = [];
  const one = (f) => {
    if (f.type === 'html') return f.html;
    const val = v[f.k] ?? f.default ?? '';
    let input;
    if (f.type === 'select') input = `<select name="${f.k}">${f.options.map((o) => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${String(ov) === String(val) ? 'selected' : ''}>${esc(ol)}</option>`; }).join('')}</select>`;
    else if (f.type === 'textarea') input = `<textarea name="${f.k}" placeholder="${esc(f.ph || '')}">${esc(val)}</textarea>`;
    else if (f.type === 'checkbox') return `<label class="check"><input type="checkbox" name="${f.k}" ${val ? 'checked' : ''}/><span>${esc(f.label)}</span></label>`;
    else if (f.type === 'file') input = `<input type="file" name="${f.k}" accept="image/*" multiple />`;
    else input = `<input type="${f.type || 'text'}" name="${f.k}" value="${esc(val)}" placeholder="${esc(f.ph || '')}" ${f.type === 'number' ? 'inputmode="decimal" step="any"' : ''} ${f.required ? 'required' : ''}/>`;
    return `<label class="field"><span>${esc(f.label)}</span>${input}</label>`;
  };
  for (const f of fields) {
    if (f.half) { buf.push(one(f)); if (buf.length === 2) { html += `<div class="row2">${buf.join('')}</div>`; buf = []; } }
    else { if (buf.length) { html += `<div class="row2">${buf.join('')}</div>`; buf = []; } html += one(f); }
  }
  if (buf.length) html += `<div class="row2">${buf.join('')}</div>`;
  return html;
}
function readFields(fields) {
  const out = {};
  for (const f of fields) {
    if (!f.k) continue;
    const el = $(`[name="${f.k}"]`, modalEl);
    if (!el) continue;
    if (f.type === 'checkbox') out[f.k] = el.checked;
    else if (f.type === 'file') out[f.k] = el.files;
    else if (f.type === 'number') out[f.k] = el.value === '' ? '' : Number(el.value);
    else out[f.k] = el.value.trim();
  }
  return out;
}
$('#modalForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const { fields, onSave } = modalHandlers;
  if (!onSave) return modal.close();
  const missing = fields.find((f) => f.required && !String($(`[name="${f.k}"]`, modalEl)?.value || '').trim());
  if (missing) { toast(`${missing.label}을(를) 입력해 주세요`); $(`[name="${missing.k}"]`, modalEl)?.focus(); return; }
  const btn = $('#modalOk'); btn.disabled = true;
  try { if ((await onSave(readFields(fields))) !== false) { modal.close(); render(); } }
  finally { btn.disabled = false; }
});
$('#modalCancel').onclick = () => modal.close();
$('#modalDelete').onclick = async () => {
  if (!confirm('삭제할까요?')) return;
  await modalHandlers.onDelete(); modal.close(); render();
};

/* ---------- 폼 정의 ---------- */
const dayOptions = () => Array.from({ length: tripDays() }, (_, i) => [i + 1, `Day ${i + 1}${dateOfDay(i + 1) ? ' · ' + prettyDate(dateOfDay(i + 1)) : ''}`]);
const CURS = [['PHP', '페소 ₱'], ['KRW', '원 ₩'], ['USD', '달러 $']];
const famOptions = () => [['A', famName('A')], ['B', famName('B')]];

const forms = {
  schedule: () => [
    { k: 'day', label: '날짜', type: 'select', options: dayOptions(), half: true },
    { k: 'time', label: '시간', type: 'time', half: true },
    { k: 'title', label: '할 일', ph: '예) 호핑투어', required: true },
    { k: 'place', label: '장소', ph: '예) 화이트 비치' },
    { k: 'menu', label: '추천 메뉴 (식사일 때)', ph: '예) 망고셰이크, 폭립' },
    { k: 'map', label: '지도 검색어 (영문 추천)', ph: "ex) I Love BBQ D'Mall Boracay" },
    { k: 'link', label: '링크', type: 'url', ph: 'https:// (메뉴판, 예약 페이지 등)' },
    { k: 'memo', label: '메모', type: 'textarea' },
    { k: 'done', label: '완료', type: 'checkbox' },
  ],
  bookings: () => [
    { k: 'type', label: '종류', type: 'select', options: ['항공', '숙소', '픽업·샌딩', '투어·액티비티', '식당', '스파·마사지', '기타'], half: true },
    { k: 'status', label: '상태', type: 'select', options: ['예약 필요', '예약 완료', '결제 완료', '취소'], half: true },
    { k: 'title', label: '이름', required: true },
    { k: 'date', label: '이용 날짜', type: 'date', half: true },
    { k: 'time', label: '시간', type: 'time', half: true },
    { k: 'provider', label: '업체/사이트', ph: '예) 대한항공, 아고다', half: true },
    { k: 'confirmation', label: '예약번호', half: true },
    { k: 'price', label: '금액', type: 'number', half: true },
    { k: 'currency', label: '통화', type: 'select', options: CURS, half: true },
    { k: 'link', label: '링크 (바우처·예약페이지)', type: 'url', ph: 'https://' },
    { k: 'memo', label: '메모', type: 'textarea', ph: '연락처, 미팅 장소, 포함 사항 등' },
  ],
  expenses: () => [
    { k: 'title', label: '내용', ph: '예) 디몰 점심', required: true },
    { k: 'amount', label: '금액', type: 'number', required: true, half: true },
    { k: 'currency', label: '통화', type: 'select', options: CURS, half: true },
    { k: 'category', label: '분류', type: 'select', options: ['식비', '숙소', '교통', '투어', '쇼핑', '마사지', '기타'], half: true },
    { k: 'date', label: '날짜', type: 'date', half: true },
    { k: 'payer', label: '누가 냈나요?', type: 'select', options: famOptions(), half: true },
    { k: 'split', label: '누구 몫?', type: 'select', options: [['half', '두 가족 반반'], ['A', `${famName('A')}만`], ['B', `${famName('B')}만`]], half: true },
    { k: 'memo', label: '메모' },
  ],
  places: () => [
    { k: 'name', label: '이름', required: true },
    { k: 'en', label: '지도 검색어 (영문 추천)', ph: 'ex) White Beach Boracay' },
    { k: 'category', label: '분류', type: 'select', options: ['해변', '맛집', '카페', '관광', '쇼핑', '숙소', '교통', '기타'] },
    { k: 'memo', label: '메모', type: 'textarea' },
    { k: 'visited', label: '가 봤어요', type: 'checkbox' },
  ],
  memories: () => [
    { k: 'date', label: '날짜', type: 'date', half: true },
    { k: 'who', label: '작성자', ph: '예) 아빠', half: true },
    { k: 'title', label: '제목', ph: '예) 첫 스노클링!' },
    { k: 'text', label: '이야기', type: 'textarea', ph: '오늘 있었던 일, 아이가 한 말…' },
    { k: 'files', label: '사진 추가', type: 'file' },
  ],
  checklist: () => [
    { k: 'text', label: '항목', required: true },
    { k: 'cat', label: '분류', type: 'select', options: ['서류', '아이', '옷', '세면', '전자기기', '기타'] },
    { k: 'done', label: '챙겼어요', type: 'checkbox' },
  ],
};
const FORM_TITLES = { schedule: '일정', bookings: '예약', expenses: '지출', places: '장소', memories: '추억', checklist: '준비물' };

function edit(col, id, defaults = {}) {
  const item = id ? S[col].find((x) => x.id === id) : null;
  const values = item ? { ...item } : defaults;
  openForm({
    title: `${FORM_TITLES[col]} ${item ? '수정' : '추가'}`,
    fields: forms[col](),
    values,
    onSave: async (v) => {
      const next = { ...(item || {}), ...v };
      if (col === 'schedule') next.day = Number(next.day);
      if (col === 'memories') {
        delete next.files;
        next.photos = [...(item?.photos || [])];
        for (const f of v.files || []) {
          try { const data = await compress(f); const pid = uid(); await photoDB.put(pid, data); photoCache.set(pid, data); next.photos.push(pid); }
          catch { toast('사진 하나를 불러오지 못했어요'); }
        }
      }
      upsert(col, next);
    },
    onDelete: item ? async () => {
      if (col === 'memories') for (const p of item.photos || []) await photoDB.del(p).catch(() => {});
      remove(col, id);
    } : null,
  });
}

/* ---------- 화면 ---------- */
let tab = location.hash.slice(1) || 'home';
const ui = { day: 'all', expCat: 'all', bookStatus: 'all', placeCat: 'all' };

function render() {
  if (!views[tab]) tab = 'home';
  $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $('#tripTitle').textContent = S.trip.title || '보라카이 가족여행';
  const s = S.trip.start, e = S.trip.end;
  $('#tripSub').textContent = s ? `${prettyDate(s)} ~ ${prettyDate(e || dateOfDay(tripDays()))} · ${tripDays() - 1}박 ${tripDays()}일 · 6명` : '여행 날짜를 설정해 주세요 (⚙️)';
  const view = $('#view');
  view.innerHTML = views[tab]();
  loadPhotos(view);
}

const fab = (col, label = '+') => `<button class="fab" data-action="add" data-col="${col}" aria-label="추가">${label}</button>`;
const filterBar = (key, opts) => `<div class="filters">${opts.map(([v, l]) => `<button data-action="filter" data-key="${key}" data-val="${esc(v)}" class="${String(ui[key]) === String(v) ? 'active' : ''}">${esc(l)}</button>`).join('')}</div>`;
const reviewUrl = (q) => `https://m.search.naver.com/search.naver?query=${encodeURIComponent('보라카이 ' + q)}`;
const linkBtns = (mapQ, reviewQ, link) => `<div class="links">${mapQ ? `<a class="btn sm" href="${mapUrl(mapQ)}" target="_blank" rel="noopener" data-stop>🗺️ 지도</a>` : ''}${reviewQ ? `<a class="btn sm" href="${reviewUrl(reviewQ)}" target="_blank" rel="noopener" data-stop>📝 후기</a>` : ''}${link ? `<a class="btn sm" href="${esc(link)}" target="_blank" rel="noopener" data-stop>🔗 링크</a>` : ''}</div>`;
const mapUrl = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const BOOK_EMOJI = { '항공': '✈️', '숙소': '🏨', '픽업·샌딩': '🚐', '투어·액티비티': '🚤', '식당': '🍽️', '스파·마사지': '💆', '기타': '📌' };
const PLACE_EMOJI = { '해변': '🏖️', '맛집': '🍽️', '카페': '☕', '관광': '🗺️', '쇼핑': '🛍️', '숙소': '🏨', '교통': '⛴️', '기타': '📍' };
const statusChip = (s) => `<span class="chip ${s === '예약 필요' ? 'warn' : s === '취소' ? '' : 'ok'}">${esc(s)}</span>`;

const views = {
  home() {
    const s = parseDate(S.trip.start);
    let hero;
    if (!s) hero = `<div class="dday">✈️</div><p>⚙️ 설정에서 여행 날짜를 입력하면<br/>D-day와 날짜별 일정이 표시돼요.</p><button class="btn primary" data-action="settings">여행 날짜 설정</button>`;
    else {
      const d = dayDiff(s, today()), cd = currentDay();
      if (d > 0) hero = `<div class="dday">D-${d}</div><p class="muted">보라카이까지 ${d}일 남았어요 🏝️</p>`;
      else if (cd) hero = `<div class="dday">Day ${cd}</div><p class="muted">즐거운 여행 중! ☀️</p>`;
      else hero = `<div class="dday">🌅</div><p class="muted">여행이 끝났어요. 추억을 정리해 보세요!</p>`;
    }
    const showDay = currentDay() || 1;
    const todays = S.schedule.filter((x) => x.day === showDay).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const pending = S.bookings.filter((b) => b.status === '예약 필요');
    const { total, balA } = settlement();
    const ck = S.checklist, ckDone = ck.filter((c) => c.done).length;
    const cats = [...new Set(ck.map((c) => c.cat))];
    return `
      <section class="card hero">${hero}</section>

      <section class="card">
        <h3>${currentDay() ? '오늘 일정' : 'Day 1 일정'} <button class="btn sm" data-tab-go="schedule">전체 보기</button></h3>
        ${todays.length ? `<ul class="list">${todays.map(schedItem).join('')}</ul>` : '<p class="empty">일정이 없어요</p>'}
      </section>

      <section class="card">
        <h3>예약 현황 <button class="btn sm" data-tab-go="bookings">관리</button></h3>
        <div class="grid2">
          <div class="stat"><span class="muted small">예약 필요</span><b style="color:var(--accent)">${pending.length}건</b></div>
          <div class="stat"><span class="muted small">완료</span><b style="color:var(--ok)">${S.bookings.filter((b) => b.status === '예약 완료' || b.status === '결제 완료').length}건</b></div>
        </div>
        ${pending.length ? `<p class="small muted" style="margin:8px 0 0">아직: ${pending.map((b) => esc(b.title)).join(', ')}</p>` : ''}
      </section>

      <section class="card">
        <h3>비용 <button class="btn sm" data-tab-go="expenses">자세히</button></h3>
        <div class="grid2">
          <div class="stat"><span class="muted small">총 지출</span><b>${won(total)}</b></div>
          <div class="stat"><span class="muted small">1인당 (6명)</span><b>${won(total / 6)}</b></div>
        </div>
        <p class="settle" style="margin:10px 0 0">${settleText(balA)}</p>
      </section>

      <section class="card">
        <h3>준비물 체크 <span class="muted small">${ckDone}/${ck.length}</span></h3>
        <div class="bar"><i style="width:${ck.length ? (ckDone / ck.length) * 100 : 0}%"></i></div>
        ${cats.map((c) => `<p class="small muted" style="margin:12px 0 0;font-weight:700">${esc(c)}</p>${ck.filter((x) => x.cat === c).map((x) => `
          <div class="check ${x.done ? 'done' : ''}">
            <input type="checkbox" id="ck-${x.id}" data-action="toggle-check" data-id="${x.id}" ${x.done ? 'checked' : ''}/>
            <label for="ck-${x.id}">${esc(x.text)}</label>
            <button class="btn ghost sm" data-action="edit" data-col="checklist" data-id="${x.id}" aria-label="수정">✏️</button>
          </div>`).join('')}`).join('')}
        <div class="btn-row" style="margin-top:10px"><button class="btn sm" data-action="add" data-col="checklist">+ 준비물 추가</button></div>
      </section>

      <section class="card">
        <h3>가족과 공유하기</h3>
        <p class="small muted" style="margin:0 0 10px">이 앱은 각자 폰에 저장돼요. 백업 파일을 카톡으로 보내고, 받은 사람이 <b>가져오기</b>를 누르면 두 폰의 내용이 <b>합쳐져요</b>.</p>
        <div class="btn-row">
          <button class="btn primary" data-action="export">📤 백업 보내기</button>
          <button class="btn" data-action="import">📥 가져오기</button>
          <button class="btn" data-action="share-text">💬 일정 텍스트 공유</button>
        </div>
      </section>

      <section class="card">
        <h3>보라카이 가족여행 팁</h3>
        <ul class="small" style="margin:0;padding-left:18px">
          <li>필리핀 입국 전 <b>eTravel</b> 온라인 등록 (가족 모두)</li>
          <li>보라카이 입도 때 <b>숙소 예약 확인서</b>를 보여줘야 해요</li>
          <li>제티포트에서 환경세·터미널피 등 내야 하니 <b>페소 현금</b> 준비</li>
          <li>한낮 햇볕이 강해요 — 아이들 물놀이는 오전/늦은 오후에</li>
          <li>바다 수영 땐 아이 구명조끼, 해파리 주의</li>
          <li>두 가족이 교대로 아이 보면 어른들 마사지 가능!</li>
        </ul>
      </section>`;
  },

  schedule() {
    const n = tripDays();
    const days = ui.day === 'all' ? Array.from({ length: n }, (_, i) => i + 1) : [Number(ui.day)];
    const extra = [...new Set(S.schedule.map((x) => x.day).filter((d) => d > n))];
    return `
      <div class="section-head"><h2>일정</h2><button class="btn sm" data-action="share-text">💬 공유</button></div>
      ${filterBar('day', [['all', '전체'], ...Array.from({ length: n }, (_, i) => [i + 1, `Day ${i + 1}`])])}
      ${[...days, ...(ui.day === 'all' ? extra : [])].map((d) => {
        const items = S.schedule.filter((x) => x.day === d).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        return `<section class="card">
          <div class="day-head"><h3>Day ${d}</h3><span class="muted">${prettyDate(dateOfDay(d))}${currentDay() === d ? ' · 오늘' : ''}</span></div>
          ${items.length ? `<ul class="list">${items.map(schedItem).join('')}</ul>` : '<p class="empty">일정을 추가해 보세요</p>'}
          <button class="btn sm" data-action="add" data-col="schedule" data-day="${d}">+ Day ${d} 일정</button>
        </section>`;
      }).join('')}
      <p class="small muted">💡 탭하면 수정할 수 있어요. 예시 일정은 자유롭게 바꾸세요.</p>
      ${fab('schedule')}`;
  },

  bookings() {
    const list = S.bookings
      .filter((b) => ui.bookStatus === 'all' || b.status === ui.bookStatus)
      .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.time || '').localeCompare(b.time || ''));
    const sum = S.bookings.filter((b) => b.status !== '취소').reduce((t, b) => t + toKRW(b.price, b.currency), 0);
    return `
      <div class="section-head"><h2>예약 · 예매</h2><span class="muted small">예약 금액 합계 ${won(sum)}</span></div>
      ${filterBar('bookStatus', [['all', '전체'], ['예약 필요', '예약 필요'], ['예약 완료', '예약 완료'], ['결제 완료', '결제 완료'], ['취소', '취소']])}
      <section class="card">
        ${list.length ? `<ul class="list">${list.map((b) => `
          <li class="item" data-action="edit" data-col="bookings" data-id="${b.id}">
            <span class="emoji">${BOOK_EMOJI[b.type] || '📌'}</span>
            <div class="body">
              <div class="title">${esc(b.title)}</div>
              <div class="meta">${statusChip(b.status)}${b.date ? prettyDate(b.date) : '날짜 미정'}${b.time ? ' ' + esc(b.time) : ''}${b.provider ? ' · ' + esc(b.provider) : ''}</div>
              ${b.confirmation ? `<div class="meta">예약번호 <b>${esc(b.confirmation)}</b> <button class="btn ghost sm" data-action="copy" data-text="${esc(b.confirmation)}">복사</button></div>` : ''}
              ${b.memo ? `<div class="meta" style="white-space:pre-wrap">${esc(b.memo)}</div>` : ''}
              ${b.link ? `<div class="meta"><a href="${esc(b.link)}" target="_blank" rel="noopener" data-stop>바우처/예약 페이지 열기 ↗</a></div>` : ''}
            </div>
            <div class="right">${b.price !== '' && b.price != null ? money(b.price, b.currency) : ''}</div>
          </li>`).join('')}</ul>` : '<p class="empty">예약이 없어요</p>'}
      </section>
      <p class="small muted">💡 결제한 예약은 <b>비용</b> 탭에도 추가하면 가족 간 정산에 반영돼요.</p>
      ${fab('bookings')}`;
  },

  expenses() {
    const { total, paid, balA } = settlement();
    const byCat = {};
    for (const e of S.expenses) byCat[e.category || '기타'] = (byCat[e.category || '기타'] || 0) + toKRW(e.amount, e.currency);
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const list = S.expenses.filter((e) => ui.expCat === 'all' || e.category === ui.expCat)
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.updatedAt - a.updatedAt);
    return `
      <div class="section-head"><h2>비용 · 정산</h2><span class="muted small">₱1 = ${S.trip.rates.PHP}원</span></div>
      <section class="card">
        <div class="grid2">
          <div class="stat"><span class="muted small">총 지출</span><b>${won(total)}</b></div>
          <div class="stat"><span class="muted small">가족당 (반반 기준)</span><b>${won(total / 2)}</b></div>
          <div class="stat"><span class="chip famA">${esc(famName('A'))}</span><b>${won(paid.A)}</b><span class="muted small">냄</span></div>
          <div class="stat"><span class="chip famB">${esc(famName('B'))}</span><b>${won(paid.B)}</b><span class="muted small">냄</span></div>
        </div>
        <p class="settle" style="margin:10px 0 0">${settleText(balA)}</p>
        ${cats.length ? `<div style="margin-top:12px">${cats.map(([c, v]) => `
          <div class="small" style="display:flex;justify-content:space-between;margin-top:6px"><span>${esc(c)}</span><span>${won(v)}</span></div>
          <div class="bar"><i style="width:${total ? (v / total) * 100 : 0}%"></i></div>`).join('')}</div>` : ''}
      </section>
      ${filterBar('expCat', [['all', '전체'], ...['식비', '숙소', '교통', '투어', '쇼핑', '마사지', '기타'].map((c) => [c, c])])}
      <section class="card">
        ${list.length ? `<ul class="list">${list.map((e) => `
          <li class="item" data-action="edit" data-col="expenses" data-id="${e.id}">
            <div class="body">
              <div class="title">${esc(e.title)}</div>
              <div class="meta"><span class="chip fam${esc(e.payer)}">${esc(famName(e.payer))} 결제</span>${e.split === 'half' ? '반반' : esc(famName(e.split)) + '만'} · ${esc(e.category || '')}${e.date ? ' · ' + prettyDate(e.date) : ''}</div>
            </div>
            <div class="right"><b>${money(e.amount, e.currency)}</b>${e.currency !== 'KRW' ? `<div class="meta">${won(toKRW(e.amount, e.currency))}</div>` : ''}</div>
          </li>`).join('')}</ul>` : '<p class="empty">아래 + 버튼으로 지출을 기록하세요</p>'}
      </section>
      ${fab('expenses')}`;
  },

  places() {
    const list = S.places.filter((p) => ui.placeCat === 'all' || p.category === ui.placeCat);
    const cats = [...new Set(S.places.map((p) => p.category))];
    return `
      <div class="section-head"><h2>장소</h2><a class="btn sm" href="${mapUrl('Boracay')}" target="_blank" rel="noopener">지도 앱 열기 ↗</a></div>
      <section class="card" style="padding:0;overflow:hidden">
        <iframe title="보라카이 지도" src="https://maps.google.com/maps?q=${encodeURIComponent(ui.mapQ || 'Boracay Island')}&z=${ui.mapQ ? 15 : 13}&output=embed" style="width:100%;height:240px;border:0;display:block" loading="lazy"></iframe>
      </section>
      ${filterBar('placeCat', [['all', '전체'], ...cats.map((c) => [c, c])])}
      <section class="card">
        ${list.length ? `<ul class="list">${list.map((p) => `
          <li class="item ${p.visited ? 'done' : ''}" data-action="edit" data-col="places" data-id="${p.id}">
            <span class="emoji">${PLACE_EMOJI[p.category] || '📍'}</span>
            <div class="body">
              <div class="title">${esc(p.name)} ${p.visited ? '✅' : ''}</div>
              ${p.memo ? `<div class="meta">${esc(p.memo)}</div>` : ''}
            </div>
            <div class="right">
              <button class="btn sm" data-action="show-map" data-q="${esc(p.en || p.name + ' Boracay')}">지도</button>
              <a class="btn sm" href="${mapUrl(p.en || p.name + ' Boracay')}" target="_blank" rel="noopener" data-stop>길찾기</a>
              ${p.category === '맛집' || p.category === '카페' ? `<a class="btn sm" href="${reviewUrl(p.name.replace(/\s*\(.*\)$/, ''))}" target="_blank" rel="noopener" data-stop>후기</a>` : ''}
            </div>
          </li>`).join('')}</ul>` : '<p class="empty">장소가 없어요</p>'}
      </section>
      ${fab('places')}`;
  },

  memories() {
    const list = [...S.memories].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.updatedAt - a.updatedAt);
    return `
      <div class="section-head"><h2>추억</h2><span class="muted small">사진 ${list.reduce((t, m) => t + (m.photos?.length || 0), 0)}장</span></div>
      ${list.length ? list.map((m) => `
        <section class="card">
          <h3><span>${esc(m.title || '오늘의 기록')}</span><button class="btn ghost sm" data-action="edit" data-col="memories" data-id="${m.id}">✏️</button></h3>
          <div class="meta small muted">${m.date ? prettyDate(m.date) : ''}${m.who ? ' · ' + esc(m.who) : ''}</div>
          ${m.text ? `<p style="white-space:pre-wrap;margin:8px 0 0">${esc(m.text)}</p>` : ''}
          ${m.photos?.length ? `<div class="photos">${m.photos.map((p) => `<img data-photo="${p}" data-action="view-photo" data-mem="${m.id}" alt="" />`).join('')}</div>` : ''}
        </section>`).join('') : `<section class="card empty">📸<br/>사진과 이야기를 남겨 보세요.<br/>아이들이 한 말도 적어 두면 좋아요!</section>`}
      ${fab('memories')}`;
  },
};

function schedItem(x) {
  return `<li class="item ${x.done ? 'done' : ''}" data-action="edit" data-col="schedule" data-id="${x.id}">
    <span class="time">${esc(x.time || '--:--')}</span>
    <div class="body">
      <div class="title">${esc(x.title)}</div>
      ${x.place || x.memo ? `<div class="meta">${x.place ? '📍' + esc(x.place) : ''}${x.place && x.memo ? ' · ' : ''}${esc(x.memo || '')}</div>` : ''}
      ${x.menu ? `<div class="meta menu">🍽️ ${esc(x.menu)}</div>` : ''}
      ${x.map || x.link ? linkBtns(x.map, x.map ? x.title.replace(/^[^\p{L}]*(저녁|점심|간식|브런치|아침)?:?\s*/u, '').replace(/\s*\(.*\)$/, '') : '', x.link) : ''}
    </div>
  </li>`;
}
function settleText(balA) {
  if (Math.abs(balA) < 1) return '✅ 정산할 금액이 없어요';
  return balA > 0
    ? `💸 ${esc(famName('B'))} → ${esc(famName('A'))}: ${won(balA)}`
    : `💸 ${esc(famName('A'))} → ${esc(famName('B'))}: ${won(-balA)}`;
}

/* ---------- 설정 ---------- */
function openSettings() {
  const t = S.trip;
  openForm({
    title: '여행 설정',
    fields: [
      { k: 'title', label: '여행 이름' },
      { k: 'start', label: '출발일', type: 'date', half: true },
      { k: 'end', label: '도착일', type: 'date', half: true },
      { k: 'famA', label: '가족 1 이름', half: true },
      { k: 'famB', label: '가족 2 이름', half: true },
      { k: 'memA', label: '가족 1 구성원', half: true },
      { k: 'memB', label: '가족 2 구성원', half: true },
      { k: 'PHP', label: '환율: 1페소 = ?원', type: 'number', half: true },
      { k: 'USD', label: '환율: 1달러 = ?원', type: 'number', half: true },
      { type: 'html', html: `<div class="btn-row"><button type="button" class="btn sm danger" data-action="reset">전체 초기화</button></div>` },
    ],
    values: { title: t.title, start: t.start, end: t.end, famA: t.families.A, famB: t.families.B, memA: t.members.A, memB: t.members.B, PHP: t.rates.PHP, USD: t.rates.USD },
    onSave: (v) => {
      if (v.start && v.end && v.end < v.start) { toast('도착일이 출발일보다 빨라요'); return false; }
      Object.assign(t, { title: v.title, start: v.start, end: v.end });
      t.families = { A: v.famA || '우리 가족', B: v.famB || '처제네' };
      t.members = { A: v.memA, B: v.memB };
      t.rates = { PHP: Number(v.PHP) || 0, USD: Number(v.USD) || 0 };
      t.updatedAt = Date.now();
      save();
    },
  });
}

/* ---------- 공유 / 백업 ---------- */
async function exportData() {
  const withPhotos = S.memories.some((m) => m.photos?.length) && confirm('사진도 함께 보낼까요?\n(사진이 많으면 파일이 커져요)');
  const data = { app: 'boracay-trip', version: 1, exportedAt: Date.now(), state: S, photos: {} };
  if (withPhotos) for (const m of S.memories) for (const p of m.photos || []) { const d = await photoDB.get(p).catch(() => null); if (d) data.photos[p] = d; }
  const name = `보라카이여행_${fmtDate(new Date())}.json`;
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: '보라카이 여행 백업' }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('백업 파일을 저장했어요');
}

function mergeState(cur, inc) {
  const deleted = { ...cur.deleted };
  for (const [k, v] of Object.entries(inc.deleted || {})) deleted[k] = Math.max(deleted[k] || 0, v);
  const out = { ...cur, deleted };
  if ((inc.trip?.updatedAt || 0) > (cur.trip?.updatedAt || 0)) out.trip = inc.trip;
  for (const c of COLS) {
    const m = new Map((cur[c] || []).map((x) => [x.id, x]));
    for (const x of inc[c] || []) { const ex = m.get(x.id); if (!ex || (x.updatedAt || 0) > (ex.updatedAt || 0)) m.set(x.id, x); }
    out[c] = [...m.values()].filter((x) => !(deleted[x.id] >= (x.updatedAt || 0)));
  }
  return out;
}

async function importData(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'boracay-trip' || !data.state) throw new Error('bad file');
    for (const [id, d] of Object.entries(data.photos || {})) { await photoDB.put(id, d); photoCache.set(id, d); }
    S = mergeState(S, data.state);
    save(); render();
    toast('가져오기 완료! 내용이 합쳐졌어요');
  } catch { toast('이 앱의 백업 파일이 아니에요'); }
}

function scheduleText() {
  const lines = [`🏝️ ${S.trip.title}`];
  if (S.trip.start) lines.push(`${prettyDate(S.trip.start)} ~ ${prettyDate(S.trip.end || dateOfDay(tripDays()))}`);
  for (let d = 1; d <= tripDays(); d++) {
    const items = S.schedule.filter((x) => x.day === d).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    if (!items.length) continue;
    lines.push('', `📅 Day ${d} ${prettyDate(dateOfDay(d))}`);
    for (const x of items) lines.push(`${x.time || ''} ${x.title}${x.place ? ` (${x.place})` : ''}`.trim());
  }
  return lines.join('\n');
}
async function shareText() {
  const text = scheduleText();
  if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  await copy(text);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('복사했어요'); } catch { prompt('복사해서 쓰세요', text); }
}

/* ---------- 사진 크게 보기 ---------- */
function viewPhoto(memId, pid) {
  const m = S.memories.find((x) => x.id === memId);
  openForm({
    title: m?.title || '사진',
    fields: [{ type: 'html', html: `<img src="${photoCache.get(pid) || ''}" style="width:100%;border-radius:10px" alt=""/>
      <div class="btn-row"><a class="btn sm" href="${photoCache.get(pid) || '#'}" download="boracay_${pid}.jpg">💾 저장</a>
      <button type="button" class="btn sm danger" data-action="del-photo" data-mem="${memId}" data-id="${pid}">이 사진 삭제</button></div>` }],
  });
}

/* ---------- 이벤트 ---------- */
document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-stop]')) return; // 링크는 그대로 열기
  const go = e.target.closest('[data-tab-go], #tabs button');
  if (go) { tab = go.dataset.tabGo || go.dataset.tab; location.hash = tab; window.scrollTo(0, 0); return render(); }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, col, id } = el.dataset;
  switch (action) {
    case 'add': {
      const d = {};
      if (col === 'schedule') d.day = Number(el.dataset.day) || (ui.day !== 'all' ? Number(ui.day) : currentDay() || 1);
      if (col === 'expenses') { d.currency = 'PHP'; d.payer = 'A'; d.split = 'half'; d.category = '식비'; d.date = fmtDate(today()); }
      if (col === 'bookings') { d.status = '예약 필요'; d.currency = 'KRW'; }
      if (col === 'memories') d.date = fmtDate(today());
      if (col === 'places') d.category = ui.placeCat !== 'all' ? ui.placeCat : '맛집';
      if (col === 'checklist') d.cat = '기타';
      return edit(col, null, d);
    }
    case 'edit': if (e.target.closest('button') && e.target.closest('button') !== el) return; return edit(col, id);
    case 'filter': ui[el.dataset.key] = el.dataset.val; return render();
    case 'toggle-check': { const c = S.checklist.find((x) => x.id === id); if (c) { c.done = el.checked; c.updatedAt = Date.now(); save(); render(); } return; }
    case 'show-map': e.stopPropagation(); ui.mapQ = el.dataset.q; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return;
    case 'copy': e.stopPropagation(); return copy(el.dataset.text);
    case 'settings': return openSettings();
    case 'reset':
      if (confirm('모든 데이터를 지우고 처음 상태로 돌릴까요?\n(먼저 백업을 권장해요)')) { S = seed(); save(); modal.close(); render(); toast('초기화했어요'); }
      return;
    case 'export': return exportData();
    case 'import': return $('#importFile').click();
    case 'share-text': return shareText();
    case 'view-photo': return viewPhoto(el.dataset.mem, el.dataset.photo);
    case 'del-photo': {
      if (!confirm('사진을 삭제할까요?')) return;
      const m = S.memories.find((x) => x.id === el.dataset.mem);
      if (m) { m.photos = m.photos.filter((p) => p !== id); upsert('memories', m); await photoDB.del(id).catch(() => {}); }
      modal.close(); return render();
    }
  }
});
$('#importFile').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importData(f); e.target.value = ''; });
window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (t && t !== tab && views[t]) { tab = t; render(); } });

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

render();
