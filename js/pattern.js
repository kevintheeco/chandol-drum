// 패턴 DSL 파서 — 커리큘럼의 문자열 패턴을 스텝 데이터로 변환
// 한 마디 = 16분음표 16칸. 레인별 문자열, 마디 구분은 '|', 공백은 무시.
// 문자: '-' 쉼 / 'x','o' 일반 타격 / 'X','O' 악센트 / 'g' 고스트(스네어)
// ST 레인: 'R','L' 스티킹, '-' 없음

export const INSTRUMENTS = {
  CR: { name: '크래시',   y: 30, head: 'x',    ledger: true,  voice: 'hands' },
  RD: { name: '라이드',   y: 40, head: 'x',    ledger: false, voice: 'hands' },
  OH: { name: '오픈 하이햇', y: 35, head: 'x', ledger: false, voice: 'hands', open: true },
  HH: { name: '하이햇',   y: 35, head: 'x',    ledger: false, voice: 'hands' },
  T1: { name: '하이탐',   y: 45, head: 'note', ledger: false, voice: 'hands' },
  MT: { name: '미드탐',   y: 50, head: 'note', ledger: false, voice: 'hands' },
  SD: { name: '스네어',   y: 55, head: 'note', ledger: false, voice: 'hands' },
  T2: { name: '플로어탐', y: 65, head: 'note', ledger: false, voice: 'hands' },
  BD: { name: '킥(베이스)', y: 75, head: 'note', ledger: false, voice: 'feet' },
};

export const LANE_ORDER = ['CR', 'RD', 'OH', 'HH', 'T1', 'MT', 'SD', 'T2', 'BD'];

function cleanLane(str) {
  return str.replace(/\s+/g, '');
}

// pattern: { HH: 'x-x-...|...', SD: ..., ST: 'RLRL...' }
// 반환: bars = [{ steps: [{hits:[{inst,accent,ghost}], sticking}] x16 }]
export function parsePattern(pattern) {
  const lanes = {};
  let barCount = 1;
  for (const [lane, raw] of Object.entries(pattern)) {
    const bars = cleanLane(raw).split('|');
    lanes[lane] = bars;
    barCount = Math.max(barCount, bars.length);
  }
  const result = [];
  for (let b = 0; b < barCount; b++) {
    const steps = [];
    for (let s = 0; s < 16; s++) {
      const hits = [];
      let sticking = null;
      for (const lane of Object.keys(lanes)) {
        const barStr = lanes[lane][b] || '';
        const ch = barStr[s] || '-';
        if (ch === '-') continue;
        if (lane === 'ST') {
          if (ch === 'R' || ch === 'L') sticking = ch;
          continue;
        }
        if (!INSTRUMENTS[lane]) continue;
        hits.push({
          inst: lane,
          accent: ch === 'X' || ch === 'O',
          ghost: ch === 'g',
        });
      }
      steps.push({ hits, sticking });
    }
    result.push({ steps });
  }
  return result;
}

// 레슨에 등장하는 악기 목록 (범례용)
export function usedInstruments(bars) {
  const set = new Set();
  for (const bar of bars) {
    for (const step of bar.steps) {
      for (const h of step.hits) set.add(h.inst);
    }
  }
  return LANE_ORDER.filter((k) => set.has(k));
}
