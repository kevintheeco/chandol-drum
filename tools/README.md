# 채보 프로토타입 (2026-07-07)

음원 → 드럼 악보 자동 추출 실험 코드. 파이썬 필요 (librosa, soundfile, torch, demucs).

## 흐름

```
노래.wav → sep_run.py (드럼만 분리, Demucs) → drums_only.wav
         → transcribe.py (타격 감지→악기 분류→격자 양자화) → 패턴 문자열(HH/SD/BD)
```

출력 패턴은 앱 커리큘럼(js/curriculum.js)과 같은 표기법 — 그대로 붙여넣으면 악보로 뜬다.

## 사용법

```
python sep_run.py 노래.wav drums_only.wav   # 1) 드럼만 분리
python transcribe.py drums_only.wav         # 2) 채보 (BPM 자동감지, 두 번째 인자로 BPM 지정 가능)
```

## 검증 결과 (합성 시험곡, 정답지 채점)

- 깨끗한 드럼 음원: 킥·스네어·하이햇 F1 100점
- 베이스+건반+잔향 섞은 밴드 음원 → 분리 → 채보: F1 100점
- make_test.py / make_band.py 가 정답지 있는 시험곡 생성기

## 알려진 한계 (다음 과제)

- 실제 녹음(진짜 드럼킷)은 미검증 — 합성음은 쉬운 모드
- 분류는 킥/스네어/하이햇 3종만 — 탐·크래시·라이드·오픈하이햇 미지원
- 템포 변화(사람 연주 흔들림) 미대응 — 격자가 고정 BPM 가정
- 마디 시작점(위상)은 자동으로 못 잡음 — 편집 화면에서 사람이 지정 필요
- Demucs 모델은 ~/.cache/torch/hub/checkpoints/955717e8-8726e21a.th (SHA256 지문 검증 완료)
