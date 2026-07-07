// 찬돌드럼 — 화면 라우팅(홈/레슨/콘티/채보)과 컨트롤 연결

import { COURSES } from './curriculum.js?v=11';
import { SONGS } from './songs.js?v=11';
import { parsePattern, usedInstruments, INSTRUMENTS } from './pattern.js?v=11';
import { renderNotation } from './notation.js?v=11';
import { DrumKit, Player } from './audio.js?v=11';
import { buildDrumKit } from './drumkit.js?v=11';

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

  // 채보 링크 붙여넣기
  $('#openScoreBtn').addEventListener('click', () => {
    const raw = $('#scoreLinkInput').value.trim();
    const m = raw.match(/score=[A-Za-z0-9_\-=]+/);
    if (m) location.hash = m[0];
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && !$('#practiceView').hidden) {
      e.preventDefault();
      playBtn.click();
    }
  });

  window.addEventListener('hashchange', route);
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
