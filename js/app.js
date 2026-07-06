// 찬돌드럼 — 화면 구성과 컨트롤 연결

import { COURSES } from './curriculum.js';
import { parsePattern, usedInstruments, INSTRUMENTS } from './pattern.js';
import { renderNotation } from './notation.js';
import { DrumKit, Player } from './audio.js';
import { buildDrumKit } from './drumkit.js';

const kit = new DrumKit();
const player = new Player(kit);
const stageKit = buildDrumKit(document.querySelector('#drumkitBox'), (inst) => {
  kit.play(inst, kit.now());
});

const $ = (sel) => document.querySelector(sel);
const DONE_KEY = 'chandol-done';

let current = null; // { course, lesson, bars, layout }

function getDone() {
  try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || '[]')); }
  catch { return new Set(); }
}
function setDone(set) {
  localStorage.setItem(DONE_KEY, JSON.stringify([...set]));
}

// ---------- 레슨 목록 ----------
function buildNav() {
  const nav = $('#lessonNav');
  nav.innerHTML = '';
  const done = getDone();
  for (const course of COURSES) {
    const sec = document.createElement('div');
    sec.className = 'nav-course';
    const h = document.createElement('h3');
    h.textContent = course.title;
    const p = document.createElement('p');
    p.className = 'nav-desc';
    p.textContent = course.desc;
    sec.appendChild(h);
    sec.appendChild(p);
    for (const lesson of course.lessons) {
      const btn = document.createElement('button');
      btn.className = 'nav-lesson';
      btn.dataset.course = course.id;
      btn.dataset.lesson = lesson.id;
      const isDone = done.has(`${course.id}/${lesson.id}`);
      btn.innerHTML = `<span class="nav-check">${isDone ? '✓' : ''}</span><span>${lesson.title}</span>`;
      if (isDone) btn.classList.add('done');
      btn.addEventListener('click', () => selectLesson(course.id, lesson.id));
      sec.appendChild(btn);
    }
    nav.appendChild(sec);
  }
}

function markActive() {
  document.querySelectorAll('.nav-lesson').forEach((b) => {
    b.classList.toggle('active',
      current && b.dataset.course === current.course.id && b.dataset.lesson === current.lesson.id);
  });
}

// ---------- 레슨 표시 ----------
function selectLesson(courseId, lessonId) {
  player.stop(false);
  resetPlayButton();

  const course = COURSES.find((c) => c.id === courseId);
  const lesson = course.lessons.find((l) => l.id === lessonId);
  const bars = parsePattern(lesson.pattern);

  $('#lessonTitle').textContent = lesson.title;
  $('#lessonGoal').textContent = lesson.goal;
  $('#courseName').textContent = course.title;

  // 범례
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

  // 팁
  const tips = $('#tips');
  tips.innerHTML = '';
  for (const tip of lesson.tips || []) {
    const li = document.createElement('li');
    li.textContent = tip;
    tips.appendChild(li);
  }

  // BPM 초기화
  $('#bpm').value = lesson.bpm;
  $('#bpmValue').textContent = lesson.bpm;
  player.bpm = lesson.bpm;
  player.bars = bars;

  current = { course, lesson, bars, layout };
  updateDoneButton();
  markActive();
  location.hash = `${courseId}/${lessonId}`;
}

function makePlayhead(layout) {
  const svg = $('#notation');
  const ns = 'http://www.w3.org/2000/svg';
  const ph = document.createElementNS(ns, 'rect');
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
    // 무대 드럼세트도 악보를 따라 반짝인다
    const bar = current.bars[Math.floor(stepIdx / 16)];
    for (const hit of bar.steps[stepIdx % 16].hits) stageKit.flash(hit.inst);
  }
  if (stepIdx < 0) {
    // 카운트인 표시
    ph.style.display = 'none';
    $('#countBadge').textContent = ['하나', '둘', '셋', '넷'][stepIdx + 4];
    $('#countBadge').classList.add('show');
    return;
  }
  $('#countBadge').classList.remove('show');
  ph.style.display = '';
  ph.setAttribute('x', current.layout.stepsX[stepIdx] - current.layout.stepW / 2);
}

// ---------- 컨트롤 ----------
function resetPlayButton() {
  const btn = $('#playBtn');
  btn.textContent = '재생';
  btn.classList.remove('playing');
  const ph = $('#playhead');
  if (ph) ph.style.display = 'none';
  $('#countBadge').classList.remove('show');
}

function wireControls() {
  const playBtn = $('#playBtn');
  playBtn.addEventListener('click', () => {
    if (player.playing) {
      player.stop();
    } else {
      player.bpm = Number($('#bpm').value);
      player.start();
      playBtn.textContent = '정지';
      playBtn.classList.add('playing');
    }
  });
  player.onStep = movePlayhead;
  player.onStop = resetPlayButton;

  $('#bpm').addEventListener('input', (e) => {
    $('#bpmValue').textContent = e.target.value;
    player.bpm = Number(e.target.value);
  });
  $('#metronome').addEventListener('change', (e) => { player.metronome = e.target.checked; });
  $('#countIn').addEventListener('change', (e) => { player.countIn = e.target.checked; });
  $('#loop').addEventListener('change', (e) => { player.loop = e.target.checked; });

  $('#doneBtn').addEventListener('click', () => {
    if (!current) return;
    const key = `${current.course.id}/${current.lesson.id}`;
    const done = getDone();
    if (done.has(key)) done.delete(key);
    else done.add(key);
    setDone(done);
    buildNav();
    markActive();
    updateDoneButton();
  });

  // 스페이스바로 재생/정지
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      playBtn.click();
    }
  });
}

function updateDoneButton() {
  if (!current) return;
  const done = getDone().has(`${current.course.id}/${current.lesson.id}`);
  const btn = $('#doneBtn');
  btn.textContent = done ? '✓ 완료함' : '완료 표시';
  btn.classList.toggle('is-done', done);
}

// ---------- 시작 ----------
buildNav();
wireControls();

const [hc, hl] = location.hash.replace('#', '').split('/');
const first = COURSES[0];
if (hc && hl && COURSES.some((c) => c.id === hc && c.lessons.some((l) => l.id === hl))) {
  selectLesson(hc, hl);
} else {
  selectLesson(first.id, first.lessons[0].id);
}
