// 드럼 오선보 SVG 렌더링
// parsePattern이 만든 bars 데이터를 받아 오선보를 그린다.
// 반환값: { stepsX: 전체 스텝의 x좌표 배열, width, height } — 재생 헤드용

import { INSTRUMENTS, LANE_ORDER } from './pattern.js?v=17';

const STEP_W = 27;
const MARGIN_X = 16;
const STAFF_TOP = 35;
const STAFF_BOTTOM = 75;
const HAND_BEAM_Y = 14;
const FOOT_BEAM_Y = 96;
const COUNT_Y = 112;
const STICK_Y = 126;
const HEIGHT = 134;
const LYRIC_Y = 147;          // 가사 줄(카운트·스티킹 아래)
const LYRIC_EXTRA = 20;       // 가사 있을 때 늘리는 세로 여유

const SVG_NS = 'http://www.w3.org/2000/svg';
const COUNT_LABEL = ['1', 'e', '&', 'a', '2', 'e', '&', 'a', '3', 'e', '&', 'a', '4', 'e', '&', 'a'];

function el(name, attrs) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function drawHead(g, inst, x, y, hit) {
  const spec = INSTRUMENTS[inst];
  if (spec.head === 'x') {
    const r = 4.2;
    g.appendChild(el('line', { x1: x - r, y1: y - r, x2: x + r, y2: y + r, class: 'nt-x' }));
    g.appendChild(el('line', { x1: x - r, y1: y + r, x2: x + r, y2: y - r, class: 'nt-x' }));
    if (spec.open) g.appendChild(el('circle', { cx: x, cy: y - 11, r: 2.8, class: 'nt-open' }));
  } else {
    g.appendChild(el('ellipse', {
      cx: x, cy: y, rx: 4.8, ry: 3.5,
      transform: `rotate(-14 ${x} ${y})`,
      class: hit.ghost ? 'nt-head nt-ghost-head' : 'nt-head',
    }));
  }
  if (spec.ledger) {
    g.appendChild(el('line', { x1: x - 7.5, y1: y, x2: x + 7.5, y2: y, class: 'nt-ledger' }));
  }
  if (hit.ghost) {
    const t1 = el('text', { x: x - 8.5, y: y + 3.5, class: 'nt-paren' });
    t1.textContent = '(';
    const t2 = el('text', { x: x + 5.5, y: y + 3.5, class: 'nt-paren' });
    t2.textContent = ')';
    g.appendChild(t1);
    g.appendChild(t2);
  }
}

function drawAccent(g, x, y) {
  // '>' 모양
  g.appendChild(el('polyline', {
    points: `${x - 4.5},${y - 3} ${x + 4.5},${y} ${x - 4.5},${y + 3}`,
    class: 'nt-accent',
  }));
}

// ── 악보 표기: 쉼표·음길이·이음줄 (16분음표 칸 단위) ──
const STD_VALS = [16, 12, 8, 6, 4, 3, 2, 1];
function decompose(d) {
  const parts = [];
  while (d > 0) {
    for (const v of STD_VALS) { if (v <= d) { parts.push(v); d -= v; break; } }
  }
  return parts;
}

// 한 보이스(hands/feet)의 타격 칸 → 쉼표·음표 이벤트.
// 손=다음 타격까지 지속(연속), 발(킥)=8분 최대 짧게+나머지 쉼표.
function voiceEvents(bar, voice) {
  const onsets = [];
  for (let s = 0; s < 16; s++) {
    if (bar.steps[s].hits.some((h) => INSTRUMENTS[h.inst] && INSTRUMENTS[h.inst].voice === voice)) {
      onsets.push(s);
    }
  }
  const events = [];
  let pos = 0;
  for (let k = 0; k < onsets.length; k++) {
    const i = onsets[k];
    if (i > pos) events.push({ type: 'rest', pos, dur: i - pos });
    const nxt = k + 1 < onsets.length ? onsets[k + 1] : 16;
    const gap = nxt - i;
    const ndur = voice === 'feet' ? Math.min(gap, 2) : gap;
    events.push({ type: 'note', pos: i, dur: ndur });
    pos = i + Math.min(ndur, gap);
  }
  if (pos < 16) events.push({ type: 'rest', pos, dur: 16 - pos });
  return events;
}

function drawRest(g, x, dur, region) {
  // 표준 음악 쉼표 글리프 (채보 악보 기준). region으로 세로 위치.
  const y = region === 'hands' ? 48 : 68;
  const s = 1.1;
  const base = ({ 3: 2, 6: 4, 12: 8 })[dur] || dur;
  const dotted = dur === 3 || dur === 6 || dur === 12;
  const stroke = (d, w) => g.appendChild(el('path', { d, class: 'nt-rest-stroke', 'stroke-width': w.toFixed(1) }));
  const fill = (d) => g.appendChild(el('path', { d, class: 'nt-rest' }));
  if (base >= 16) {           // 온쉼표: 선 아래 매달린 사각
    g.appendChild(el('rect', { x: x - 5 * s, y: y + s, width: 10 * s, height: 3.4 * s, class: 'nt-rest' }));
  } else if (base === 8) {    // 2분쉼표: 선 위 사각
    g.appendChild(el('rect', { x: x - 5 * s, y: y - 4.4 * s, width: 10 * s, height: 3.4 * s, class: 'nt-rest' }));
  } else if (base === 4) {    // 4분쉼표: 지그재그 + 하단 갈고리
    stroke(`M ${x - 2.6 * s},${y - 8 * s} L ${x + 2.4 * s},${y - 2.4 * s} L ${x - 2.2 * s},${y + 2.2 * s} L ${x + 2.8 * s},${y + 8 * s}`, 2.0 * s);
    stroke(`M ${x + 2.8 * s},${y + 8 * s} C ${x - 1.2 * s},${y + 5.4 * s} ${x - 1.6 * s},${y + 9.5 * s} ${x + 1.6 * s},${y + 10.5 * s}`, 1.5 * s);
  } else if (base === 2) {    // 8분쉼표: 물방울 깃발 + 사선
    fill(`M ${x + 2.2 * s},${y - 6 * s} C ${x + 3.6 * s},${y - 6.6 * s} ${x + 3.8 * s},${y - 4.3 * s} ${x + 1.8 * s},${y - 4.1 * s} C ${x + 0.2 * s},${y - 4 * s} ${x - 0.8 * s},${y - 5.2 * s} ${x + 0.4 * s},${y - 6 * s} Z`);
    stroke(`M ${x + 3.0 * s},${y - 6.2 * s} L ${x - 2.2 * s},${y + 6 * s}`, 1.4 * s);
  } else {                    // 16분쉼표: 깃발 2개 + 사선
    fill(`M ${x + 2.4 * s},${y - 7 * s} C ${x + 3.8 * s},${y - 7.6 * s} ${x + 4.0 * s},${y - 5.3 * s} ${x + 2.0 * s},${y - 5.1 * s} C ${x + 0.4 * s},${y - 5 * s} ${x - 0.6 * s},${y - 6.2 * s} ${x + 0.6 * s},${y - 7 * s} Z`);
    fill(`M ${x + 1.4 * s},${y - 2.2 * s} C ${x + 2.8 * s},${y - 2.8 * s} ${x + 3.0 * s},${y - 0.5 * s} ${x + 1.0 * s},${y - 0.3 * s} C ${x - 0.6 * s},${y - 0.2 * s} ${x - 1.6 * s},${y - 1.4 * s} ${x - 0.4 * s},${y - 2.2 * s} Z`);
    stroke(`M ${x + 3.2 * s},${y - 7 * s} L ${x - 2.6 * s},${y + 6.5 * s}`, 1.4 * s);
  }
  if (dotted) g.appendChild(el('circle', { cx: x + 6.5 * s, cy: y, r: 1.5, class: 'nt-rest' }));
}

function drawTie(g, x1, x2, above) {
  const mx = (x1 + x2) / 2;
  const y = above ? 24 : 86;
  const cy = above ? y - 8 : y + 8;
  g.appendChild(el('path', { d: `M ${x1},${y} Q ${mx},${cy} ${x2},${y}`, class: 'nt-tie' }));
}

function drawFlam(g, x, y) {
  // 꾸밈음(작은 헤드 + 슬래시)
  g.appendChild(el('ellipse', { cx: x - 8, cy: y, rx: 3, ry: 2.2, transform: `rotate(-14 ${x - 8} ${y})`, class: 'nt-grace' }));
  g.appendChild(el('line', { x1: x - 5.6, y1: y, x2: x - 5.6, y2: y - 11, class: 'nt-grace-stem' }));
  g.appendChild(el('line', { x1: x - 9.5, y1: y - 7, x2: x - 2, y2: y - 11, class: 'nt-grace-stem' }));
}

// 한 박(4스텝) 안에서 스템·빔을 그린다.
// stemXs: [{x, headY}] — 그 박에서 손(또는 발) 타격이 있는 스텝들
function drawBeamGroup(g, group, beamY, dir) {
  if (group.length === 0) return;
  const side = dir === 'up' ? 4.6 : -4.6;
  for (const s of group) {
    g.appendChild(el('line', {
      x1: s.x + side, y1: s.headY, x2: s.x + side, y2: beamY, class: 'nt-stem',
    }));
  }
  if (group.length >= 2) {
    const x1 = group[0].x + side;
    const x2 = group[group.length - 1].x + side;
    const h = dir === 'up' ? 3.4 : -3.4;
    g.appendChild(el('rect', {
      x: Math.min(x1, x2), y: Math.min(beamY, beamY + h),
      width: Math.abs(x2 - x1), height: Math.abs(h), class: 'nt-beam',
    }));
    // 16분음표끼리(바로 옆 칸)만 두 번째 빔
    const second = dir === 'up' ? beamY + 5.2 : beamY - 5.2;
    for (let i = 0; i < group.length - 1; i++) {
      if (group[i + 1].stepIdx - group[i].stepIdx === 1) {
        g.appendChild(el('rect', {
          x: Math.min(group[i].x, group[i + 1].x) + side,
          y: Math.min(second, second + h),
          width: Math.abs(group[i + 1].x - group[i].x), height: Math.abs(h), class: 'nt-beam',
        }));
      }
    }
  }
}

export function renderNotation(svg, bars, opts = {}) {
  svg.innerHTML = '';
  const { lyrics, barOffset = 0 } = opts;
  const barW = 16 * STEP_W;
  const width = MARGIN_X * 2 + bars.length * barW;
  // 이 화면 구간에 얹을 가사가 하나라도 있으면 아래 여유를 준다
  const hasLyric = lyrics && bars.some((_, b) => lyrics[barOffset + b + 1]);
  const height = HEIGHT + (hasLyric ? LYRIC_EXTRA : 0);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);

  const g = el('g', {});
  svg.appendChild(g);

  // 오선 5줄
  for (let y = STAFF_TOP; y <= STAFF_BOTTOM; y += 10) {
    g.appendChild(el('line', { x1: MARGIN_X, y1: y, x2: width - MARGIN_X, y2: y, class: 'nt-staff' }));
  }
  // 마디선
  for (let b = 0; b <= bars.length; b++) {
    const x = MARGIN_X + b * barW;
    g.appendChild(el('line', { x1: x, y1: STAFF_TOP, x2: x, y2: STAFF_BOTTOM, class: 'nt-barline' }));
  }

  const stepsX = [];

  bars.forEach((bar, b) => {
    // 박 배경(1·3박 살짝 밝게) + 박 시작 안내선
    for (let beat = 0; beat < 4; beat++) {
      const bx = MARGIN_X + b * barW + beat * 4 * STEP_W;
      if (beat > 0) {
        g.appendChild(el('line', { x1: bx, y1: STAFF_TOP, x2: bx, y2: STAFF_BOTTOM, class: 'nt-beatline' }));
      }
    }

    bar.steps.forEach((step, s) => {
      const x = MARGIN_X + b * barW + (s + 0.5) * STEP_W;
      stepsX.push(x);

      // 카운트(1 e & a) — 박 머리는 진하게
      const cnt = el('text', { x, y: COUNT_Y, class: s % 4 === 0 ? 'nt-count nt-count-beat' : 'nt-count' });
      cnt.textContent = COUNT_LABEL[s];
      g.appendChild(cnt);

      if (step.sticking) {
        const st = el('text', { x, y: STICK_Y, class: 'nt-stick' });
        st.textContent = step.sticking;
        g.appendChild(st);
      }

      if (step.hits.length === 0) return;

      let accent = false;
      for (const hit of step.hits) {
        const spec = INSTRUMENTS[hit.inst];
        drawHead(g, hit.inst, x, spec.y, hit);
        if (hit.flam) drawFlam(g, x, spec.y);
        if (hit.accent) accent = true;
      }
      if (accent) {
        const topY = Math.min(...step.hits.map((h) => INSTRUMENTS[h.inst].y));
        drawAccent(g, x, Math.min(topY - 16, 6) + 2);
      }
    });

    // 스템·빔 — 손은 위로, 발은 아래로, 박 단위로 묶기
    for (let beat = 0; beat < 4; beat++) {
      const hands = [];
      const feet = [];
      for (let i = 0; i < 4; i++) {
        const s = beat * 4 + i;
        const step = bar.steps[s];
        const x = MARGIN_X + b * barW + (s + 0.5) * STEP_W;
        const handHits = step.hits.filter((h) => INSTRUMENTS[h.inst].voice === 'hands');
        const footHits = step.hits.filter((h) => INSTRUMENTS[h.inst].voice === 'feet');
        if (handHits.length) {
          hands.push({ x, stepIdx: s, headY: Math.max(...handHits.map((h) => INSTRUMENTS[h.inst].y)) - 2 });
        }
        if (footHits.length) {
          feet.push({ x, stepIdx: s, headY: Math.min(...footHits.map((h) => INSTRUMENTS[h.inst].y)) + 2 });
        }
      }
      drawBeamGroup(g, hands, HAND_BEAM_Y, 'up');
      drawBeamGroup(g, feet, FOOT_BEAM_Y, 'down');
    }

    // 쉼표 — 손·발 보이스별로 쉬는 곳에 쉼표 기호
    for (const voice of ['hands', 'feet']) {
      for (const e of voiceEvents(bar, voice)) {
        if (e.type !== 'rest') continue;
        let p = e.pos;
        for (const v of decompose(e.dur)) {
          drawRest(g, MARGIN_X + b * barW + (p + 0.5) * STEP_W, v, voice);
          p += v;
        }
      }
    }

    // 이음줄(밀어치기 푸시) — 마디 끝 크래시가 다음 마디 첫박으로 이어짐
    if (b + 1 < bars.length) {
      for (const c of [14, 15]) {
        const crHere = bar.steps[c].hits.some((h) => h.inst === 'CR');
        if (!crHere) continue;
        const crNext = bars[b + 1].steps[0].hits.some((h) => h.inst === 'CR');
        if (crNext) continue;
        const x1 = MARGIN_X + b * barW + (c + 0.5) * STEP_W;
        const x2 = MARGIN_X + (b + 1) * barW + 0.5 * STEP_W;
        drawTie(g, x1, x2, true);
        if (bar.steps[c].hits.some((h) => h.inst === 'BD')) drawTie(g, x1, x2, false);
      }
    }

    // 가사 — 구절이 시작되는 마디 아래에 표시(람쥐드럼 악보 관례)
    const lyric = lyrics && lyrics[barOffset + b + 1];
    if (lyric) {
      const t = el('text', { x: MARGIN_X + b * barW + 6, y: LYRIC_Y, class: 'nt-lyric' });
      t.textContent = lyric;
      g.appendChild(t);
    }
  });

  return { stepsX, width, height, stepW: STEP_W };
}

// 범례용: 레슨에 나오는 악기 이름 목록
export function legendNames(insts) {
  return insts.map((k) => INSTRUMENTS[k].name);
}

export { LANE_ORDER };
