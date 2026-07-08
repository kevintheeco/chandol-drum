// 찬돌드럼 — 화면 라우팅(홈/레슨/콘티/채보)과 컨트롤 연결

import { COURSES } from './curriculum.js?v=16';
import { SONGS } from './songs.js?v=16';
import { parsePattern, usedInstruments, INSTRUMENTS } from './pattern.js?v=16';
import { renderNotation } from './notation.js?v=16';
import { DrumKit, Player } from './audio.js?v=16';
import { buildDrumKit } from './drumkit.js?v=16';

const kit = new DrumKit();
const player = new Player(kit);
const stageKit = buildDrumKit(document.querySelector('#drumkitBox'), (inst) => {
  kit.play(inst, kit.now());
});

const $ = (sel) => document.querySelector(sel);
const DONE_KEY = 'chandol-done';

let current = null; // { doneKey, bars, layout, bpm }
let navMode = null; // 'lessons' | 'songs'

function getDone() {
  try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || '[]')); }
  catch { return new Set(); }
}
function setDone(set) {
  localStorage.setItem(DONE_KEY, JSON.stringify([...set]));
}

// ---------- 화면 전환 ----------
function showView(id) {
  for (const v of document.querySelectorAll('.view, #practiceView')) {
    v.hidden = v.id !== id;
  }
  if (id !== 'practiceView') {
    player.stop(false);
    resetPlayButton();
  }
  window.scrollTo(0, 0);
}

// ---------- 목록(사이드바) ----------
function buildNav(mode) {
  navMode = mode;
  const nav = $('#lessonNav');
  nav.innerHTML = '';
  const done = getDone();

  const groups = mode === 'songs'
    ? [{ title: '콘티', desc: '곡 악보로 연습합니다. 곡 추가는 요나단에게.', items: SONGS.map((s) => ({ key: `song/${s.id}`, hash: `songs/${s.id}`, title: s.title, sub: s.artist })) }]
    : COURSES.map((c) => ({ title: c.title, desc: c.desc, items: c.lessons.map((l) => ({ key: `${c.id}/${l.id}`, hash: `${c.id}/${l.id}`, title: l.title })) }));

  for (const group of groups) {
    const sec = document.createElement('div');
    sec.className = 'nav-course';
    const h = document.createElement('h3');
    h.textContent = group.title;
    const p = document.createElement('p');
    p.className = 'nav-desc';
    p.textContent = group.desc;
    sec.appendChild(h);
    sec.appendChild(p);
    for (const item of group.items) {
      const btn = document.createElement('button');
      btn.className = 'nav-lesson';
      btn.dataset.key = item.key;
      const isDone = done.has(item.key);
      const sub = item.sub ? `<span class="nav-sub">${item.sub}</span>` : '';
      btn.innerHTML = `<span class="nav-check">${isDone ? '✓' : ''}</span><span>${item.title}${sub}</span>`;
      if (isDone) btn.classList.add('done');
      btn.addEventListener('click', () => { location.hash = item.hash; });
      sec.appendChild(btn);
    }
    nav.appendChild(sec);
  }
}

function markActive() {
  document.querySelectorAll('.nav-lesson').forEach((b) => {
    b.classList.toggle('active', current && b.dataset.key === current.doneKey);
  });
}

// ---------- 악보 표시 (레슨/곡/채보 공용) ----------
function showItem({ groupLabel, title, goal, bpm, pattern, tips, doneKey }) {
  player.stop(false);
  resetPlayButton();

  const bars = parsePattern(pattern);
  $('#lessonTitle').textContent = title;
  $('#lessonGoal').textContent = goal || '';
  $('#courseName').textContent = groupLabel || '';

  const legend = $('#legend');
  legend.innerHTML = '';
  for (const inst of usedInstruments(bars)) {
    const chip = document.createElement('span');
    chip.className = 'legend-chip';
    chip.textContent = INSTRUMENTS[inst].name;
    legend.appendChild(chip);
  }

  const layout = renderNotation($('#notation'), bars);
  makePlayhead(layout);

  const tipsEl = $('#tips');
  tipsEl.innerHTML = '';
  for (const tip of tips || []) {
    const li = document.createElement('li');
    li.textContent = tip;
    tipsEl.appendChild(li);
  }

  const safeBpm = Math.min(200, Math.max(40, Math.round(bpm || 60)));
  $('#bpm').value = safeBpm;
  $('#bpmValue').textContent = safeBpm;
  player.bpm = safeBpm;
  player.bars = bars;

  current = { doneKey, bars, layout, startStep: 0, title, groupLabel };
  updateDoneButton();
  markActive();
  showView('practiceView');
}

// ---------- PDF 저장 (인쇄용 4마디 줄바꿈 악보) ----------
function saveAsPdf() {
  if (!current) return;
  let sheet = document.querySelector('#printSheet');
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'printSheet';
    document.body.appendChild(sheet);
  }
  sheet.innerHTML = '';
  const h = document.createElement('h1');
  h.textContent = current.title;
  const sub = document.createElement('p');
  sub.textContent = `${current.groupLabel || ''} · ${$('#bpmValue').textContent} BPM · 찬돌드럼`;
  sheet.appendChild(h);
  sheet.appendChild(sub);
  for (let i = 0; i < current.bars.length; i += 4) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    sheet.appendChild(svg);
    renderNotation(svg, current.bars.slice(i, i + 4));
    svg.removeAttribute('height');
    svg.removeAttribute('width');
  }
  window.print();
}

// ---------- 시작 위치(악보 클릭) ----------
function stepFromClick(e) {
  const svg = $('#notation');
  const rect = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const x = (e.clientX - rect.left) * (vb.width / rect.width);
  let best = 0, bestDist = Infinity;
  current.layout.stepsX.forEach((sx, i) => {
    const d = Math.abs(sx - x);
    if (d < bestDist) { bestDist = d; best = i; }
  });
  return best - (best % 4); // 박 단위로 스냅
}

function showStartMarker() {
  const ph = $('#playhead');
  if (!ph || !current) return;
  if (current.startStep > 0 && !player.playing) {
    ph.style.display = '';
    ph.setAttribute('x', current.layout.stepsX[current.startStep] - current.layout.stepW / 2);
  }
}

function openLesson(courseId, lessonId) {
  const course = COURSES.find((c) => c.id === courseId);
  const lesson = course && course.lessons.find((l) => l.id === lessonId);
  if (!lesson) return false;
  if (navMode !== 'lessons') buildNav('lessons');
  showItem({
    groupLabel: course.title, title: lesson.title, goal: lesson.goal,
    bpm: lesson.bpm, pattern: lesson.pattern, tips: lesson.tips,
    doneKey: `${course.id}/${lesson.id}`,
  });
  return true;
}

function openSong(songId) {
  const song = SONGS.find((s) => s.id === songId) || SONGS[0];
  if (!song) return false;
  if (navMode !== 'songs') buildNav('songs');
  showItem({
    groupLabel: song.artist, title: song.title, goal: song.goal,
    bpm: song.bpm, pattern: song.pattern, tips: song.tips,
    doneKey: `song/${song.id}`,
  });
  return true;
}

function openScoreLink(hash) {
  try {
    const b64 = hash.slice(6).replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    buildNav('songs');
    showItem({
      groupLabel: '채보', title: data.title || '채보 악보',
      goal: data.goal || '음원에서 자동으로 추출한 드럼 악보입니다.',
      bpm: data.bpm || 90, pattern: data.pattern,
      tips: data.tips || ['자동 채보 결과는 참고용입니다. 귀로 들으며 어색한 곳을 다듬어 보세요.'],
      doneKey: 'score/link',
    });
    return true;
  } catch {
    return false;
  }
}

// ---------- 라우터 ----------
function route() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (h.startsWith('score=')) { if (openScoreLink(h)) return; }
  if (h === '' || h === 'home') return showView('homeView');
  if (h === 'transcribe') return showView('transcribeView');
  if (h === 'lessons') { openLesson(COURSES[0].id, COURSES[0].lessons[0].id); return; }
  if (h === 'songs') { openSong(SONGS[0] && SONGS[0].id); return; }
  if (h.startsWith('songs/')) { openSong(h.slice(6)); return; }
  const [c, l] = h.split('/');
  if (openLesson(c, l)) return;
  showView('homeView');
}

// ---------- 재생 헤드 ----------
function makePlayhead(layout) {
  const svg = $('#notation');
  const ph = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  ph.setAttribute('id', 'playhead');
  ph.setAttribute('y', 4);
  ph.setAttribute('width', layout.stepW);
  ph.setAttribute('height', layout.height - 8);
  ph.setAttribute('rx', 5);
  ph.style.display = 'none';
  svg.insertBefore(ph, svg.firstChild);
}

function movePlayhead(stepIdx) {
  const ph = $('#playhead');
  if (!ph || !current) return;
  if (stepIdx >= 0) {
    const bar = current.bars[Math.floor(stepIdx / 16)];
    for (const hit of bar.steps[stepIdx % 16].hits) stageKit.flash(hit.inst);
  }
  if (stepIdx < 0) {
    ph.style.display = 'none';
    $('#countBadge').textContent = ['하나', '둘', '셋', '넷'][stepIdx + 4];
    $('#countBadge').classList.add('show');
    return;
  }
  $('#countBadge').classList.remove('show');
  ph.style.display = '';
  ph.setAttribute('x', current.layout.stepsX[stepIdx] - current.layout.stepW / 2);
  // 긴 곡: 재생 헤드를 따라 악보를 옆으로 스크롤
  const scroller = document.querySelector('.notation-scroll');
  const x = current.layout.stepsX[stepIdx];
  if (x < scroller.scrollLeft + 60 || x > scroller.scrollLeft + scroller.clientWidth - 120) {
    scroller.scrollTo({ left: Math.max(0, x - 100), behavior: 'auto' });
  }
}

// ---------- 컨트롤 ----------
function resetPlayButton() {
  const btn = $('#playBtn');
  btn.textContent = '재생';
  btn.classList.remove('playing');
  const ph = $('#playhead');
  if (ph) ph.style.display = 'none';
  $('#countBadge').classList.remove('show');
  showStartMarker(); // 시작 표시는 유지
}

function wireControls() {
  const playBtn = $('#playBtn');
  playBtn.addEventListener('click', () => {
    if (player.playing) {
      player.stop();
    } else {
      player.bpm = Number($('#bpm').value);
      player.start(current ? current.startStep : 0);
      playBtn.textContent = '정지';
      playBtn.classList.add('playing');
    }
  });

  // 악보 클릭 = 그 박부터 재생(재생 중이면 그 자리로 점프)
  $('#notation').addEventListener('click', (e) => {
    if (!current) return;
    const step = stepFromClick(e);
    current.startStep = step;
    if (player.playing) {
      player.bpm = Number($('#bpm').value);
      player.jumpTo(step);
    } else {
      showStartMarker();
    }
  });
  player.onStep = movePlayhead;
  player.onStop = resetPlayButton;

  $('#bpm').addEventListener('input', (e) => {
    $('#bpmValue').textContent = e.target.value;
    player.bpm = Number(e.target.value);
  });

  const kitSelect = $('#kitSelect');
  kitSelect.value = localStorage.getItem('chandol-kit') || 'acoustic';
  kit.kit = kitSelect.value;
  kitSelect.addEventListener('change', (e) => {
    kit.kit = e.target.value;
    localStorage.setItem('chandol-kit', e.target.value);
    kit.play('SD', kit.now());
  });

  $('#metronome').addEventListener('change', (e) => { player.metronome = e.target.checked; });
  $('#countIn').addEventListener('change', (e) => { player.countIn = e.target.checked; });
  $('#loop').addEventListener('change', (e) => { player.loop = e.target.checked; });

  $('#pdfBtn').addEventListener('click', saveAsPdf);

  $('#doneBtn').addEventListener('click', () => {
    if (!current) return;
    const done = getDone();
    if (done.has(current.doneKey)) done.delete(current.doneKey);
    else done.add(current.doneKey);
    setDone(done);
    buildNav(navMode);
    markActive();
    updateDoneButton();
  });

  // 채보 링크 붙여넣기 (버튼 클릭 또는 엔터키)
  function trySubmitScoreLink() {
    const input = $('#scoreLinkInput');
    const errEl = $('#scoreLinkError');
    const raw = input.value.trim();
    errEl.hidden = true;

    if (!raw) {
      errEl.textContent = '악보 링크를 먼저 붙여넣어 주세요.';
      errEl.hidden = false;
      return;
    }
    const m = raw.match(/score=[A-Za-z0-9_\-=]+/);
    if (!m) {
      errEl.textContent = '이 링크는 악보 링크가 아니에요. 유튜브 링크가 아니라, 요나단이 채보 후 보내준 "#score="로 시작하는 링크를 붙여넣어 주세요.';
      errEl.hidden = false;
      return;
    }
    const before = location.hash;
    location.hash = m[0];
    if (location.hash === before) route(); // 같은 곡을 다시 열면 해시가 안 바뀌어 라우터가 안 불릴 수 있음
  }
  $('#openScoreBtn').addEventListener('click', trySubmitScoreLink);
  $('#scoreLinkInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') trySubmitScoreLink();
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && !$('#practiceView').hidden) {
      e.preventDefault();
      playBtn.click();
    }
  });

  window.addEventListener('hashchange', route);
  wireLiveTranscribe();
}

// ---------- 실시간 채보 (유튜브 링크 → 서버 처리 → 진행 상태 표시) ----------
// API_BASE가 비어 있으면 이 기능은 숨겨지고 '링크 붙여넣기'만 동작한다.
const API_BASE = 'https://chandol-drum-api.soomin020114.workers.dev'; // 배포된 채보 워커
const PASSCODE_KEY = 'chandol-passcode';

function wireLiveTranscribe() {
  if (!API_BASE) return; // 서버 준비 전에는 수동 붙여넣기만 노출

  const gate = $('#passcodeGate');
  const form = $('#chaeboForm');
  const saved = localStorage.getItem(PASSCODE_KEY);

  function unlock() {
    gate.hidden = true;
    form.hidden = false;
  }
  if (saved) unlock();
  else gate.hidden = false;

  $('#passcodeBtn').addEventListener('click', async () => {
    const code = $('#passcodeInput').value.trim();
    const errEl = $('#passcodeError');
    errEl.hidden = true;
    if (!code) return;
    try {
      const r = await fetch(API_BASE + '/api/health', { headers: { 'x-passcode': code } });
      if (!r.ok) throw new Error();
      localStorage.setItem(PASSCODE_KEY, code);
      unlock();
    } catch {
      errEl.textContent = '암호가 틀렸어요. 대표님께 다시 확인해 주세요.';
      errEl.hidden = false;
    }
  });
  $('#passcodeInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#passcodeBtn').click();
  });

  $('#fullSongCheck').addEventListener('change', (e) => {
    $('#rangeRow').style.display = e.target.checked ? 'none' : '';
  });

  $('#chaeboSubmitBtn').addEventListener('click', async () => {
    const url = $('#ytUrlInput').value.trim();
    const errEl = $('#chaeboError');
    const progressBox = $('#chaeboProgress');
    const resultBox = $('#chaeboResult');
    errEl.hidden = true;
    resultBox.hidden = true;
    if (!url) {
      errEl.textContent = '유튜브 링크를 넣어주세요.';
      errEl.hidden = false;
      return;
    }
    $('#chaeboSubmitBtn').disabled = true;
    progressBox.hidden = false;
    $('#progressMsg').textContent = '시작하는 중...';

    try {
      const res = await fetch(API_BASE + '/api/transcribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-passcode': localStorage.getItem(PASSCODE_KEY) || '' },
        body: JSON.stringify({
          url,
          full: $('#fullSongCheck').checked,
          start: Number($('#startInput').value) || 0,
          dur: Number($('#durInput').value) || 75,
        }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop();
        for (const part of parts) {
          const line = part.replace(/^data: /, '').trim();
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.stage === 'error') {
            progressBox.hidden = true;
            errEl.textContent = ev.message || '처리 중 문제가 생겼어요.';
            errEl.hidden = false;
          } else if (ev.stage === 'done') {
            progressBox.hidden = true;
            resultBox.hidden = false;
            $('#resultTitle').textContent = `${ev.title} (${ev.bpm} BPM) 악보가 준비됐어요.`;
            $('#openResultBtn').onclick = () => {
              const h = ev.link.split('#')[1];
              const before = location.hash;
              location.hash = h;
              if (location.hash === before) route();
            };
          } else {
            $('#progressMsg').textContent = ev.message || '처리 중...';
          }
        }
      }
    } catch (e) {
      progressBox.hidden = true;
      errEl.textContent = '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';
      errEl.hidden = false;
    } finally {
      $('#chaeboSubmitBtn').disabled = false;
    }
  });
}

function updateDoneButton() {
  if (!current) return;
  const done = getDone().has(current.doneKey);
  const btn = $('#doneBtn');
  btn.textContent = done ? '✓ 완료함' : '완료 표시';
  btn.classList.toggle('is-done', done);
}

// ---------- 시작 ----------
wireControls();
route();
