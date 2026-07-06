// ============================================================
// 찬돌드럼 커리큘럼 — 찬돌쌤이 이 파일만 고치면 레슨이 늘어납니다.
//
// 패턴 쓰는 법 (한 마디 = 16칸, 16분음표 기준):
//   -  쉼            x  일반 타격        X  악센트(세게)
//   g  고스트(스네어 살짝)               |  마디 구분
//   칸을 셀 때: 1e&a 2e&a 3e&a 4e&a  → 1박 = 4칸
//
// 레인(악기) 이름:
//   HH 하이햇 / OH 오픈하이햇 / SD 스네어 / BD 킥 / T1 하이탐
//   T2 플로어탐 / CR 크래시 / RD 라이드 / ST 스티킹(R/L 손 표시)
//
// 레슨 하나의 모양:
//   { id: '고유이름', title: '제목', goal: '이 레슨의 목표 한 줄',
//     bpm: 시작 빠르기, pattern: { 레인: '패턴' }, tips: ['팁', ...] }
// ============================================================

export const COURSES = [
  {
    id: 'basic-rhythm',
    title: '기초 리듬',
    desc: '메트로놈과 친해지고, 8비트 기본 그루브까지 갑니다.',
    lessons: [
      {
        id: 'quarter-hh',
        title: '4분음표 하이햇',
        goal: '메트로놈 클릭과 정확히 겹치게 하이햇을 칩니다.',
        bpm: 60,
        pattern: {
          HH: 'x---x---x---x---',
          ST: 'R---R---R---R---',
        },
        tips: [
          '클릭 소리가 안 들릴 정도로 겹치면 성공입니다.',
          '팔에 힘을 빼고 스틱이 튕겨 나오게 두세요.',
        ],
      },
      {
        id: 'eighth-hh',
        title: '8분음표 하이햇',
        goal: '한 박에 두 번, 일정한 간격으로 하이햇을 칩니다.',
        bpm: 60,
        pattern: {
          HH: 'x-x-x-x-x-x-x-x-',
          ST: 'R-R-R-R-R-R-R-R-',
        },
        tips: ['입으로 "원 앤 투 앤" 세면서 치면 간격이 고릅니다.'],
      },
      {
        id: 'add-kick',
        title: '킥 넣기',
        goal: '하이햇을 유지하면서 1박과 3박에 킥을 넣습니다.',
        bpm: 60,
        pattern: {
          HH: 'x-x-x-x-x-x-x-x-',
          BD: 'x-------x-------',
        },
        tips: [
          '킥이 들어가는 순간 하이햇이 빨라지지 않게 조심하세요.',
          '발뒤꿈치를 들고(힐업) 무릎으로 밟는 느낌.',
        ],
      },
      {
        id: 'add-snare',
        title: '스네어 넣기',
        goal: '하이햇을 유지하면서 2박과 4박에 스네어를 넣습니다.',
        bpm: 60,
        pattern: {
          HH: 'x-x-x-x-x-x-x-x-',
          SD: '----x-------x---',
        },
        tips: ['스네어는 손목 스냅으로 짧고 단단하게.'],
      },
      {
        id: 'basic-8beat',
        title: '8비트 기본 그루브',
        goal: '하이햇 + 킥(1,3) + 스네어(2,4)를 동시에 굴립니다.',
        bpm: 60,
        pattern: {
          HH: 'x-x-x-x-x-x-x-x-',
          SD: '----x-------x---',
          BD: 'x-------x-------',
        },
        tips: [
          '모든 8비트 음악의 뼈대입니다. 60에서 완벽해지면 5씩 올리세요.',
          '두 손과 한 발이 만나는 순간이 흔들리면 다시 느리게.',
        ],
      },
      {
        id: '8beat-var1',
        title: '8비트 변형: 킥 더하기',
        goal: '3박 뒤(앤)에 킥을 하나 더 넣어 그루브를 굴립니다.',
        bpm: 65,
        pattern: {
          HH: 'x-x-x-x-x-x-x-x-',
          SD: '----x-------x---',
          BD: 'x-------x-x-----',
        },
        tips: ['추가된 킥은 하이햇 사이에 정확히 끼워 넣는 느낌으로.'],
      },
    ],
  },
  {
    id: 'fill-basic',
    title: '필인 기초',
    desc: '마디 끝을 채우는 필인, 스네어에서 탐으로.',
    lessons: [
      {
        id: 'fill-16th-snare',
        title: '16분음표 스네어 필인',
        goal: '한 마디를 16분음표로 고르게 채웁니다. 손 순서 RLRL.',
        bpm: 60,
        pattern: {
          SD: 'xxxxxxxxxxxxxxxx',
          ST: 'RLRLRLRLRLRLRLRL',
        },
        tips: [
          '오른손과 왼손의 소리 크기가 같아지는 게 목표입니다.',
          '빨라지려는 관성을 메트로놈으로 붙잡으세요.',
        ],
      },
      {
        id: 'fill-tom-move',
        title: '탐 이동 필인',
        goal: '스네어 → 하이탐 → 플로어탐으로 내려갑니다.',
        bpm: 60,
        pattern: {
          SD: 'xxxx------------',
          T1: '----xxxx--------',
          T2: '--------xxxxxxxx',
          ST: 'RLRLRLRLRLRLRLRL',
        },
        tips: ['이동할 때 팔 전체로 움직이고, 시선은 다음 북으로 먼저.'],
      },
      {
        id: 'groove-plus-fill',
        title: '그루브 + 필인 조합',
        goal: '한 마디 그루브를 치고, 다음 마디 후반을 필인으로 채웁니다.',
        bpm: 65,
        pattern: {
          HH: 'x-x-x-x-x-x-x-x-|x-x-x-x---------',
          SD: '----x-------x---|----x---xxxxxxxx',
          BD: 'x-------x-------|x-------x-------',
          ST: '----------------|--------RLRLRLRL',
        },
        tips: [
          '필인에 들어가고 나올 때 템포가 출렁이지 않게.',
          '필인이 끝나면 바로 1박 그루브로 돌아올 준비.',
        ],
      },
    ],
  },
  {
    id: 'pad-practice',
    title: '패드 연습 (루디먼트)',
    desc: '연습패드나 스네어 하나로 하는 손 훈련.',
    lessons: [
      {
        id: 'single-stroke',
        title: '싱글 스트로크',
        goal: 'RLRL을 일정한 크기와 간격으로.',
        bpm: 60,
        pattern: {
          SD: 'xxxxxxxxxxxxxxxx',
          ST: 'RLRLRLRLRLRLRLRL',
        },
        tips: ['느리게 크게 → 익숙해지면 빠르게 작게.'],
      },
      {
        id: 'double-stroke',
        title: '더블 스트로크',
        goal: 'RRLL, 한 손에 두 번씩. 두 번째 타격도 또렷하게.',
        bpm: 55,
        pattern: {
          SD: 'xxxxxxxxxxxxxxxx',
          ST: 'RRLLRRLLRRLLRRLL',
        },
        tips: ['두 번째 타격이 뭉개지면 아직 빠른 겁니다. 더 느리게.'],
      },
      {
        id: 'accent-tap',
        title: '악센트 컨트롤',
        goal: '첫 타만 세게(악센트), 나머지는 작게(탭).',
        bpm: 55,
        pattern: {
          SD: 'XxxxXxxxXxxxXxxx',
          ST: 'RLRLRLRLRLRLRLRL',
        },
        tips: [
          '악센트는 높은 위치에서, 탭은 낮은 위치에서 시작하세요.',
          '큰 소리와 작은 소리의 차이가 클수록 좋습니다.',
        ],
      },
    ],
  },
];

export function findLesson(courseId, lessonId) {
  const course = COURSES.find((c) => c.id === courseId);
  if (!course) return null;
  const lesson = course.lessons.find((l) => l.id === lessonId);
  return lesson ? { course, lesson } : null;
}
