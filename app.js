// 원픽 OnePick — 화면 전환(해시 라우팅), 회원가입/로그인, 프로필, 키워드, 매칭 결과
// 데이터는 localStorage에 저장됩니다 (GitHub Pages 같은 정적 호스팅에서도 동작).

const LS_USERS = "onepick_users";
const LS_SESSION = "onepick_session";
const app = document.getElementById("app");
const nav = document.getElementById("nav");

/* ---------------- 저장소 ---------------- */
function safeGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { toast("저장 공간에 접근할 수 없어요"); }
}
const getUsers = () => safeGet(LS_USERS, []);
const saveUsers = (u) => safeSet(LS_USERS, u);
const getSessionId = () => safeGet(LS_SESSION, null);
function currentUser() {
  const id = getSessionId();
  return id ? getUsers().find(u => u.id === id) || null : null;
}
function updateUser(patch) {
  const users = getUsers();
  const i = users.findIndex(u => u.id === getSessionId());
  if (i < 0) return null;
  users[i] = { ...users[i], ...patch };
  saveUsers(users);
  return users[i];
}

async function hashPassword(pw, salt) {
  const text = salt + ":" + pw;
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 0; for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0; // 비보안 환경 대체
  return "x" + (h >>> 0).toString(16);
}

/* ---------------- 유틸 ---------------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const GENDER = { M: "남성", F: "여성", any: "상관없음" };
let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}
const go = (path) => { location.hash = "#" + path; };
const progress = (n) => `<div class="progress">${[1, 2, 3].map(i => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</div>`;

function chipGroups(selected, name) {
  return Object.entries(KEYWORDS).map(([group, list]) => `
    <div class="kw-group">
      <h3>${group}</h3>
      <div class="chips">
        ${list.map(k => `<button type="button" class="chip" data-kw="${esc(k)}" data-name="${name}" aria-pressed="${selected.includes(k)}">${esc(k)}</button>`).join("")}
      </div>
    </div>`).join("");
}
function bindChips(root, onChange, max = 8) {
  root.querySelectorAll(".chip[data-kw]").forEach(btn => btn.addEventListener("click", () => {
    const on = btn.getAttribute("aria-pressed") === "true";
    const count = root.querySelectorAll('.chip[aria-pressed="true"]').length;
    if (!on && count >= max) { toast(`최대 ${max}개까지 고를 수 있어요`); return; }
    btn.setAttribute("aria-pressed", String(!on));
    onChange([...root.querySelectorAll('.chip[aria-pressed="true"]')].map(b => b.dataset.kw));
  }));
}

/* ---------------- 내비게이션 ---------------- */
function renderNav(route) {
  const me = currentUser();
  const link = (p, label) => `<a href="#${p}" class="${route === p ? "active" : ""}">${label}</a>`;
  nav.innerHTML = me
    ? `${me.profile ? `<span class="who">${esc(me.profile.nickname)}님</span>` : ""}
       ${link("/profile", "프로필")}${link("/keywords", "키워드")}${link("/match", "추천")}
       <a href="#" id="logout">로그아웃</a>`
    : `${link("/login", "로그인")}${link("/signup", "가입하기")}`;
  const lo = document.getElementById("logout");
  if (lo) lo.addEventListener("click", (e) => { e.preventDefault(); safeSet(LS_SESSION, null); toast("로그아웃했어요"); go("/"); });
}

/* ---------------- 화면: 시작 ---------------- */
function viewHome() {
  const me = currentUser();
  const next = !me ? "/signup" : !me.profile ? "/profile" : !me.wants?.length ? "/keywords" : "/match";
  app.innerHTML = `
    <section class="hero">
      <h1>여러 명 말고,<br><em>딱 한 사람.</em></h1>
      <p>프로필을 만들고 원하는 키워드를 고르면, 나와 가장 잘 맞는 단 한 명을 골라 드려요.</p>
      <a class="btn" href="#${next}">${me ? "이어서 하기" : "지금 시작하기"} →</a>
    </section>
    <div class="steps">
      <div class="step"><b>01</b><span>이메일로 간단 가입</span></div>
      <div class="step"><b>02</b><span>나를 소개하는 프로필 설정</span></div>
      <div class="step"><b>03</b><span>상대에게 원하는 키워드 선택</span></div>
      <div class="step"><b>04</b><span>궁합 1위, 한 명만 추천</span></div>
    </div>`;
}

/* ---------------- 화면: 가입 / 로그인 ---------------- */
function viewAuth(mode) {
  const isSignup = mode === "signup";
  app.innerHTML = `
    <form class="card" id="authForm" novalidate>
      ${isSignup ? progress(1) : ""}
      <h2>${isSignup ? "회원가입" : "다시 오셨네요"}</h2>
      <p class="sub">${isSignup ? "이메일과 비밀번호만 있으면 돼요." : "이메일과 비밀번호로 로그인하세요."}</p>
      <div class="field"><label for="email">이메일</label>
        <input type="email" id="email" autocomplete="email" placeholder="you@example.com" required></div>
      <div class="field"><label for="pw">비밀번호 ${isSignup ? '<span class="hint">6자 이상</span>' : ""}</label>
        <input type="password" id="pw" autocomplete="${isSignup ? "new-password" : "current-password"}" required></div>
      ${isSignup ? `<div class="field"><label for="pw2">비밀번호 확인</label>
        <input type="password" id="pw2" autocomplete="new-password" required></div>` : ""}
      <p class="error" id="err"></p>
      <button class="btn block" type="submit">${isSignup ? "가입하고 프로필 만들기" : "로그인"}</button>
      <p class="switch">${isSignup ? '이미 계정이 있나요? <a href="#/login">로그인</a>' : '처음이신가요? <a href="#/signup">회원가입</a>'}</p>
    </form>`;

  document.getElementById("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("err");
    const email = document.getElementById("email").value.trim().toLowerCase();
    const pw = document.getElementById("pw").value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return (err.textContent = "이메일 형식을 확인해 주세요.");
    const users = getUsers();
    const found = users.find(u => u.email === email);

    if (isSignup) {
      if (pw.length < 6) return (err.textContent = "비밀번호는 6자 이상이어야 해요.");
      if (pw !== document.getElementById("pw2").value) return (err.textContent = "비밀번호가 서로 달라요.");
      if (found) return (err.textContent = "이미 가입된 이메일이에요.");
      const salt = Math.random().toString(36).slice(2);
      const user = { id: "u-" + Date.now().toString(36), email, salt, pwHash: await hashPassword(pw, salt), profile: null, wants: [], seen: [], likes: [], createdAt: new Date().toISOString() };
      saveUsers([...users, user]);
      safeSet(LS_SESSION, user.id);
      toast("가입 완료! 프로필을 만들어 볼까요?");
      go("/profile");
    } else {
      if (!found || (await hashPassword(pw, found.salt)) !== found.pwHash) return (err.textContent = "이메일 또는 비밀번호가 맞지 않아요.");
      safeSet(LS_SESSION, found.id);
      toast("로그인했어요");
      go(!found.profile ? "/profile" : !found.wants?.length ? "/keywords" : "/match");
    }
  });
}

/* ---------------- 화면: 프로필 ---------------- */
function viewProfile(me) {
  const p = me.profile || { nickname: "", gender: "", age: "", region: "충북", mbti: "", bio: "", traits: [], lookingFor: "", ageMin: 20, ageMax: 30 };
  const opts = (list, val) => list.map(v => `<option ${v === val ? "selected" : ""}>${v}</option>`).join("");
  const seg = (name, items, val) => `<div class="seg">${items.map(([v, l]) =>
    `<label><input type="radio" name="${name}" value="${v}" ${v === val ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>`;
  let traits = [...p.traits];

  app.innerHTML = `
    <form class="card" id="pf" novalidate>
      ${progress(2)}
      <h2>내 프로필</h2>
      <p class="sub">추천받을 상대에게 보여질 정보예요.</p>
      <div class="row">
        <div class="field"><label for="nick">닉네임</label><input type="text" id="nick" maxlength="12" value="${esc(p.nickname)}" placeholder="예: 수경"></div>
        <div class="field"><label for="age">나이</label><input type="number" id="age" min="19" max="60" value="${esc(p.age)}" placeholder="만 나이"></div>
      </div>
      <div class="field"><label for="job">직업</label><input type="text" id="job" maxlength="20" value="${esc(p.job || "")}" placeholder="예: 대학생"></div>
      <div class="field"><span class="label">성별</span>${seg("gender", [["F", "여성"], ["M", "남성"]], p.gender)}</div>      <div class="row">
        <div class="field"><label for="region">지역</label><select id="region">${opts(REGIONS, p.region)}</select></div>
        <div class="field"><label for="mbti">MBTI <span class="hint">선택</span></label>
          <select id="mbti"><option value="">모름</option>${opts(MBTIS, p.mbti)}</select></div>
      </div>
      <div class="field"><label for="bio">한 줄 소개</label><textarea id="bio" maxlength="120" placeholder="나를 한 줄로 소개해 주세요">${esc(p.bio)}</textarea></div>
      <div class="field"><span class="label">찾는 상대 성별</span>${seg("lookingFor", [["M", "남성"], ["F", "여성"], ["any", "상관없음"]], p.lookingFor)}</div>
      <div class="row">
        <div class="field"><label for="amin">상대 최소 나이</label><input type="number" id="amin" min="19" max="60" value="${esc(p.ageMin)}"></div>
        <div class="field"><label for="amax">상대 최대 나이</label><input type="number" id="amax" min="19" max="60" value="${esc(p.ageMax)}"></div>
      </div>
      <div class="field"><span class="label">나를 표현하는 키워드 <span class="hint">3~8개</span></span>
        <div id="traitBox">${chipGroups(traits, "trait")}</div></div>
      <p class="error" id="err"></p>
      <button class="btn block" type="submit">저장하고 원하는 키워드 고르기 →</button>
    </form>`;

  bindChips(document.getElementById("traitBox"), (list) => { traits = list; });

  document.getElementById("pf").addEventListener("submit", (e) => {
    e.preventDefault();
    const err = document.getElementById("err");
    const val = (id) => document.getElementById(id).value.trim();
    const radio = (n) => document.querySelector(`input[name="${n}"]:checked`)?.value;
    const profile = {
      nickname: val("nick"), age: Number(val("age")), job: val("job"), gender: radio("gender"), region: val("region"),
      mbti: val("mbti"), bio: val("bio"), lookingFor: radio("lookingFor"),
      ageMin: Number(val("amin")), ageMax: Number(val("amax")), traits,
      avatar: p.avatar || AVATARS[Math.floor(Math.random() * AVATARS.length)],
      color: p.color || AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
    };
    if (!profile.nickname) return (err.textContent = "닉네임을 입력해 주세요.");
    if (!profile.age || profile.age < 19 || profile.age > 60) return (err.textContent = "나이는 19~60 사이로 입력해 주세요.");
    if (!profile.gender) return (err.textContent = "성별을 선택해 주세요.");
    if (!profile.lookingFor) return (err.textContent = "찾는 상대 성별을 선택해 주세요.");
    if (!profile.ageMin || !profile.ageMax || profile.ageMin > profile.ageMax) return (err.textContent = "상대 나이 범위를 확인해 주세요.");
    if (traits.length < 3) return (err.textContent = "나를 표현하는 키워드를 3개 이상 골라 주세요.");
    updateUser({ profile, seen: [] });
    toast("프로필을 저장했어요");
    go("/keywords");
  });
}

/* ---------------- 화면: 원하는 키워드 ---------------- */
function viewKeywords(me) {
  let wants = [...(me.wants || [])];
  app.innerHTML = `
    <section class="card">
      ${progress(3)}
      <h2>어떤 사람을 원하세요?</h2>
      <p class="sub">상대에게 바라는 키워드를 3~8개 골라 주세요. 많이 겹칠수록 궁합 점수가 올라가요.</p>
      <div id="wantBox">${chipGroups(wants, "want")}</div>
      <div class="counter"><span id="cnt">${wants.length}개 선택</span>
        <button class="btn" id="findBtn" ${wants.length < 3 ? "disabled" : ""}>내 원픽 찾기 ♥</button></div>
    </section>`;
  const cnt = document.getElementById("cnt"), btn = document.getElementById("findBtn");
  bindChips(document.getElementById("wantBox"), (list) => {
    wants = list; cnt.textContent = `${list.length}개 선택`; btn.disabled = list.length < 3;
  });
  btn.addEventListener("click", () => { updateUser({ wants, seen: [] }); go("/match"); });
}

/* ---------------- 화면: 추천 결과 ---------------- */
function viewMatch(me) {
  const pool = [...SAMPLE_USERS, ...getUsers().filter(u => u.profile && u.wants?.length)];
  let seen = me.seen || [];
  const { best, total, restarted } = findBestMatch(me, pool, seen);
  if (restarted) { seen = []; updateUser({ seen }); toast("모든 추천을 다 봤어요. 처음부터 다시 보여 드릴게요"); }

  if (!best) {
    app.innerHTML = `
      <section class="card empty">
        <div class="big">🥲</div>
        <h2>${seen.length ? "추천할 사람을 모두 봤어요" : "조건에 맞는 사람이 없어요"}</h2>
        <p class="sub">찾는 성별·나이 범위를 넓히거나 키워드를 바꿔 보세요.</p>
        <div class="actions">
          ${seen.length ? '<button class="btn" id="reset">처음부터 다시 추천</button>' : ""}
          <a class="btn ghost" href="#/profile">프로필 수정</a><a class="btn ghost" href="#/keywords">키워드 바꾸기</a>
        </div>
      </section>`;
    document.getElementById("reset")?.addEventListener("click", () => { updateUser({ seen: [] }); viewMatch(currentUser()); });
    return;
  }

  const o = best.user.profile;
  const liked = (me.likes || []).includes(best.user.id);
  const chips = (list, hits) => list.map(k => `<span class="chip static ${hits.includes(k) ? "hit" : ""}">${esc(k)}</span>`).join("");

  app.innerHTML = `
    <div class="reveal">
      <div class="kicker">${esc(me.profile.nickname)}님의 원픽</div>
      <h2>당신과 가장 잘 맞는 사람</h2>
    </div>
    <article class="card match">
      ${o.photo
        ? `<figure class="photo"><img src="${esc(o.photo)}" alt="${esc(o.nickname)} 프로필 사진"
             onerror="this.closest('.match').classList.add('no-photo');this.parentNode.outerHTML='<div class=&quot;avatar&quot; style=&quot;background:${o.color}&quot;>${o.avatar}</div>'"></figure>`
        : `<div class="avatar" style="background:${o.color}">${o.avatar}</div>`}
      <h3>${esc(o.nickname)}</h3>
      <p class="meta">${o.age}세 · ${GENDER[o.gender]}${o.job ? " · " + esc(o.job) : ""} · ${esc(o.region)}${o.mbti ? " · " + o.mbti : ""}</p>
      <div class="score-ring" style="--p:${best.score}"><div>${best.score}%</div></div>
      <div class="score-label">궁합 점수 · 후보 ${total}명 중 1위</div>
      <p class="bio">“${esc(o.bio || "아직 소개가 없어요")}”</p>
      <div class="section-title">잘 맞는 이유</div>
      <ul class="reasons">${best.reasons.map(r => `<li>${esc(r)}</li>`).join("") || "<li>조건이 잘 맞아요</li>"}</ul>
      <div class="section-title">${esc(o.nickname)}님의 키워드 <span class="hint">(색칠된 건 내가 원한 키워드)</span></div>
      <div class="chips" style="margin-bottom:20px">${chips(o.traits, best.iWantHit)}</div>
      <div class="actions">
        <button class="btn" id="like" ${liked ? "disabled" : ""}>${liked ? "관심 보냄 ✓" : "♥ 관심 보내기"}</button>
        <button class="btn ghost" id="next">다른 사람 추천받기</button>
      </div>
    </article>
    <p class="switch"><a href="#/keywords">키워드 다시 고르기</a></p>`;

  document.getElementById("like").addEventListener("click", (e) => {
    updateUser({ likes: [...(me.likes || []), best.user.id] });
    e.target.textContent = "관심 보냄 ✓"; e.target.disabled = true;
    toast(`${o.nickname}님에게 관심을 보냈어요 💌`);
  });
  document.getElementById("next").addEventListener("click", () => {
    updateUser({ seen: [...seen, best.user.id] });
    viewMatch(currentUser());
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ---------------- 라우터 ---------------- */
function router() {
  const route = (location.hash.replace(/^#/, "") || "/").split("?")[0];
  const me = currentUser();
  const needAuth = ["/profile", "/keywords", "/match"];
  if (needAuth.includes(route) && !me) { go("/login"); return; }
  if ((route === "/keywords" || route === "/match") && !me.profile) { go("/profile"); return; }
  if (route === "/match" && !(me.wants || []).length) { go("/keywords"); return; }

  renderNav(route);
  switch (route) {
    case "/signup": viewAuth("signup"); break;
    case "/login": viewAuth("login"); break;
    case "/profile": viewProfile(me); break;
    case "/keywords": viewKeywords(me); break;
    case "/match": viewMatch(me); break;
    default: viewHome();
  }
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", router);
router();
