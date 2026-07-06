# 밴드 시험곡 — 같은 드럼 정답 위에 베이스·건반을 섞어 '진짜 노래처럼' 만든다
import numpy as np
import soundfile as sf

SR = 44100
BPM = 100
STEP = 60 / BPM / 4

drums, _ = sf.read("test.wav")
n = len(drums)
t = np.arange(n) / SR

# 베이스: 마디마다 근음 변경 (A-F-C-G), 8분음표 리듬
roots = [55.0, 43.65, 65.41, 49.0]
bass = np.zeros(n)
bar_len = 16 * STEP
for b, f in enumerate(roots):
    for e in range(8):  # 8분음표 8개
        s0 = int((b * 16 + e * 2) * STEP * SR)
        dur = int(STEP * 1.6 * SR)
        seg = np.arange(min(dur, n - s0)) / SR
        env = np.exp(-seg / 0.18)
        bass[s0 : s0 + len(seg)] += np.sin(2 * np.pi * f * seg) * env * 0.5

# 건반: 온음표 화음 (사각파 비슷하게 배음 포함)
chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]]
keys = np.zeros(n)
for b, notes in enumerate(chords):
    s0 = int(b * 16 * STEP * SR)
    dur = int(bar_len * SR)
    seg = np.arange(min(dur, n - s0)) / SR
    env = np.minimum(seg / 0.02, 1) * np.exp(-seg / 1.2)
    for f in notes:
        for h, amp in [(1, 1), (2, 0.4), (3, 0.25)]:
            keys[s0 : s0 + len(seg)] += np.sin(2 * np.pi * f * h * seg) * env * 0.06 * amp

mix = drums * 0.8 + bass + keys
# 간단한 잔향: 감쇠 에코 3개
for d, g in [(0.06, 0.25), (0.11, 0.15), (0.19, 0.08)]:
    k = int(d * SR)
    mix[k:] += mix[: n - k] * g
mix /= np.abs(mix).max() * 1.05
sf.write("band_test.wav", mix, SR)
print(f"밴드 시험곡 생성: {n/SR:.1f}초 → band_test.wav (드럼+베이스+건반+잔향)")
