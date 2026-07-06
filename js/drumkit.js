// 화면 드럼세트 — SVG로 그린 키트. 클릭하면 소리가 나고, 재생 중엔 악보를 따라 반짝인다.
const SVG_NS = 'http://www.w3.org/2000/svg';

function el(name, attrs, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

// 각 악기의 위치·모양 정의 (연주자 반대편에서 본 키트)
function drawCymbal(g, cx, cy, rx, tilt, label) {
  el('line', { x1: cx, y1: cy, x2: cx, y2: 330, class: 'kit-stand' }, g);
  const cym = el('g', { transform: `rotate(${tilt} ${cx} ${cy})` }, g);
  el('ellipse', { cx, cy, rx, ry: rx * 0.16, class: 'kit-cymbal' }, cym);
  el('ellipse', { cx, cy, rx: rx * 0.28, ry: rx * 0.05, class: 'kit-bell' }, cym);
  el('text', { x: cx, y: cy - rx * 0.16 - 10, class: 'kit-label' }, g).textContent = label;
  return g;
}

function drawDrum(g, cx, cy, r, depth, label) {
  el('rect', { x: cx - r, y: cy, width: r * 2, height: depth, rx: 6, class: 'kit-shell' }, g);
  el('ellipse', { cx, cy: cy + depth, rx: r, ry: r * 0.22, class: 'kit-shell-btm' }, g);
  el('ellipse', { cx, cy, rx: r, ry: r * 0.22, class: 'kit-head' }, g);
  el('ellipse', { cx, cy, rx: r, ry: r * 0.22, class: 'kit-rim' }, g);
  el('text', { x: cx, y: cy - 12, class: 'kit-label' }, g).textContent = label;
  return g;
}

export function buildDrumKit(container, onHit) {
  const svg = el('svg', { viewBox: '0 0 560 350', class: 'drumkit' });
  container.appendChild(svg);

  const pieces = {};

  // 킥 (정면 원형 헤드)
  const kick = el('g', { class: 'kit-piece', 'data-inst': 'BD' }, svg);
  el('circle', { cx: 280, cy: 240, r: 78, class: 'kit-kick-shell' }, kick);
  el('circle', { cx: 280, cy: 240, r: 66, class: 'kit-kick-head' }, kick);
  el('text', { x: 280, y: 236, class: 'kit-kick-logo' }, kick).textContent = 'CHANDOL';
  el('text', { x: 280, y: 254, class: 'kit-kick-logo kit-kick-logo-sub' }, kick).textContent = 'DRUM';
  pieces.BD = kick;

  // 하이햇 (겹친 두 장)
  const hh = el('g', { class: 'kit-piece', 'data-inst': 'HH' }, svg);
  el('line', { x1: 92, y1: 160, x2: 92, y2: 330, class: 'kit-stand' }, hh);
  el('ellipse', { cx: 92, cy: 166, rx: 44, ry: 7, class: 'kit-cymbal' }, hh);
  el('ellipse', { cx: 92, cy: 158, rx: 44, ry: 7, class: 'kit-cymbal' }, hh);
  el('text', { x: 92, y: 138, class: 'kit-label' }, hh).textContent = '하이햇';
  pieces.HH = hh;
  pieces.OH = hh; // 오픈 하이햇도 같은 조각이 반짝임

  // 크래시 / 라이드
  const crash = el('g', { class: 'kit-piece', 'data-inst': 'CR' }, svg);
  drawCymbal(crash, 152, 62, 56, -10, '크래시');
  svg.appendChild(crash);
  pieces.CR = crash;

  const ride = el('g', { class: 'kit-piece', 'data-inst': 'RD' }, svg);
  drawCymbal(ride, 434, 74, 62, 8, '라이드');
  svg.appendChild(ride);
  pieces.RD = ride;

  // 탐 (킥 위 하이탐, 오른쪽 플로어탐)
  const t1 = el('g', { class: 'kit-piece', 'data-inst': 'T1' }, svg);
  drawDrum(t1, 238, 118, 36, 30, '하이탐');
  pieces.T1 = t1;

  const t2 = el('g', { class: 'kit-piece', 'data-inst': 'T2' }, svg);
  drawDrum(t2, 402, 188, 46, 44, '플로어탐');
  el('line', { x1: 372, y1: 250, x2: 366, y2: 330, class: 'kit-stand' }, t2);
  el('line', { x1: 432, y1: 250, x2: 438, y2: 330, class: 'kit-stand' }, t2);
  pieces.T2 = t2;

  // 스네어
  const sd = el('g', { class: 'kit-piece', 'data-inst': 'SD' }, svg);
  drawDrum(sd, 168, 196, 40, 22, '스네어');
  el('line', { x1: 168, y1: 240, x2: 168, y2: 330, class: 'kit-stand' }, sd);
  pieces.SD = sd;

  // 클릭/터치로 연주
  for (const piece of new Set(Object.values(pieces))) {
    piece.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const inst = piece.dataset.inst;
      onHit(inst);
      flash(inst);
    });
  }

  const timers = {};
  function flash(inst) {
    const piece = pieces[inst];
    if (!piece) return;
    piece.classList.remove('hit');
    void piece.getBBox(); // 리플로우로 애니메이션 재시작
    piece.classList.add('hit');
    clearTimeout(timers[inst]);
    timers[inst] = setTimeout(() => piece.classList.remove('hit'), 160);
  }

  return { flash };
}
