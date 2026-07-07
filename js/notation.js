// 드럼 오선보 SVG 렌더링
// parsePattern이 만든 bars 데이터를 받아 오선보를 그린다.
// 반환값: { stepsX: 전체 스텝의 x좌표 배열, width, height } — 재생 헤드용

import { INSTRUMENTS, LANE_ORDER } from './pattern.js?v=12';

const STEP_W = 27;
const MARGIN_X = 16;
const STAFF_TOP = 35;
const STAFF_BOTTOM = 75;
const HAND_BEAM_Y = 14;
const FOOT_BEAM_Y = 96;
const COUNT_Y = 112;
const STICK_Y = 126;
const HEIGHT = 134;

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

export function renderNotation(svg, bars) {
  svg.innerHTML = '';
  const barW = 16 * STEP_W;
  const width = MARGIN_X * 2 + bars.length * barW;
  svg.setAttribute('viewBox', `0 0 ${width} ${HEIGHT}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', HEIGHT);

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
  });

  return { stepsX, width, height: HEIGHT, stepW: STEP_W };
}

// 범례용: 레슨에 나오는 악기 이름 목록
export function legendNames(insts) {
  return insts.map((k) => INSTRUMENTS[k].name);
}

export { LANE_ORDER };
