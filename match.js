// 매칭 알고리즘
// 점수(100점 만점) 구성
//  - 50점: 내가 원하는 키워드를 상대가 얼마나 가지고 있는지
//  - 20점: 상대가 원하는 키워드를 내가 얼마나 가지고 있는지 (쌍방향 매칭)
//  - 15점: 서로 겹치는 나의 키워드(공통점)
//  -  8점: 같은 지역 (인접 지역은 4점)
//  -  7점: MBTI 궁합
// 성별·나이 조건은 탈락이 아니라 감점 → 어떤 키워드를 골라도 항상 한 명이 추천됨
// 화면에 보이는 궁합 점수는 rawScore 를 90~100% 로 환산한 값

const NEAR_REGIONS = {
  "서울": ["경기","인천"], "경기": ["서울","인천","강원","충북","충남"], "인천": ["서울","경기"],
  "충북": ["경기","강원","충남","대전","세종","경북","전북"], "충남": ["경기","충북","대전","세종","전북"],
  "대전": ["충북","충남","세종"], "세종": ["충북","충남","대전"], "강원": ["경기","충북","경북"],
  "경북": ["강원","충북","대구","경남","울산"], "대구": ["경북","경남"], "경남": ["경북","대구","부산","울산","전남"],
  "부산": ["경남","울산"], "울산": ["경북","경남","부산"], "전북": ["충북","충남","전남","광주"],
  "전남": ["전북","광주","경남"], "광주": ["전북","전남"], "제주": []
};

function genderOk(seeker, target) {
  return seeker.lookingFor === "any" || seeker.lookingFor === target.gender;
}

function mbtiScore(a, b) {
  if (!a || !b) return 0;
  let s = 0;
  if (a[0] !== b[0]) s += 2;          // E/I 는 서로 달라야 보완
  if (a[1] === b[1]) s += 3;          // N/S 는 같아야 대화가 잘 통함
  if (a[2] !== b[2]) s += 1;          // T/F 보완
  if (a[3] === b[3]) s += 1;          // J/P 생활 리듬
  return s;                           // 최대 7
}

function ratio(part, whole) { return whole > 0 ? part / whole : 0; }

function scoreCandidate(me, other) {
  const mp = me.profile, op = other.profile;
  // 성별·나이 조건은 탈락시키지 않고 감점만 → 어떤 키워드를 골라도 반드시 누군가 추천됨
  const condOk = genderOk(mp, op) && genderOk(op, mp) && op.age >= mp.ageMin && op.age <= mp.ageMax;

  const myWants = me.wants || [];
  const theirWants = other.wants || [];

  const iWantHit = myWants.filter(k => op.traits.includes(k));
  const theyWantHit = theirWants.filter(k => mp.traits.includes(k));
  const shared = mp.traits.filter(k => op.traits.includes(k));

  const regionPts = mp.region === op.region ? 8 : ((NEAR_REGIONS[mp.region] || []).includes(op.region) ? 4 : 0);
  const mbtiPts = mbtiScore(mp.mbti, op.mbti);
  const theirAgeOk = mp.age >= op.ageMin && mp.age <= op.ageMax;

  let score =
    50 * ratio(iWantHit.length, myWants.length) +
    20 * ratio(theyWantHit.length, theirWants.length) +
    15 * ratio(shared.length, Math.min(mp.traits.length, op.traits.length)) +
    regionPts + mbtiPts;
  if (!theirAgeOk) score *= 0.85; // 상대가 원하는 나이대가 아니면 감점
  if (!condOk) score *= 0.6;       // 찾는 성별·나이 조건이 안 맞으면 감점 (조건 맞는 사람이 항상 먼저)

  const reasons = [];
  if (iWantHit.length) reasons.push(`내가 원한 키워드 ${iWantHit.length}개(${iWantHit.map(k => `'${k}'`).join(", ")})를 가지고 있어요`);
  if (theyWantHit.length) reasons.push(`상대도 나의 '${theyWantHit.join("', '")}' 모습을 원하고 있어요`);
  if (shared.length) reasons.push(`공통점 ${shared.length}개: ${shared.join(", ")}`);
  if (regionPts === 8) reasons.push(`같은 ${op.region} 지역이라 만나기 쉬워요`);
  else if (regionPts === 4) reasons.push(`가까운 지역(${op.region})에 살고 있어요`);
  if (mbtiPts >= 5) reasons.push(`${mp.mbti} × ${op.mbti}, MBTI 궁합이 좋은 편이에요`);
  if (!reasons.length) reasons.push("겹치는 키워드는 없지만, 서로 다른 매력이 새로운 자극이 될 수 있어요");

  // rawScore(0~100)는 순위 매기기에만 쓰고, 화면에 보이는 궁합 점수는 항상 90~100% 로 환산
  const rawScore = Math.min(score, 100);
  const displayScore = Math.min(100, Math.max(90, Math.round(90 + rawScore / 10)));
  return { user: other, score: displayScore, rawScore, iWantHit, theyWantHit, shared, reasons };
}

// 가장 잘 맞는 한 명 반환 (exclude: 이미 본 사람 id 목록)
// 이미 모두 봤다면 처음부터 다시 추천 (restarted: true) → 항상 한 명은 나옴
function findBestMatch(me, pool, exclude = []) {
  const rank = (ex) => pool
    .filter(u => u.id !== me.id && u.profile && !ex.includes(u.id))
    .map(u => scoreCandidate(me, u))
    .sort((a, b) => b.rawScore - a.rawScore || b.iWantHit.length - a.iWantHit.length);
  let ranked = rank(exclude), restarted = false;
  if (!ranked.length && exclude.length) { ranked = rank([]); restarted = true; }
  return { best: ranked[0] || null, total: ranked.length, restarted };
}

if (typeof module !== "undefined") module.exports = { scoreCandidate, findBestMatch, mbtiScore };
