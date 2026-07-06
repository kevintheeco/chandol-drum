# 시험곡 제작 — 정답 악보를 아는 드럼 음원 생성
# 앱(audio.js)과 같은 방식의 합성음: 킥=사인 스윕, 스네어=노이즈+톤, 하이햇=고역 노이즈
import json
import numpy as np
import soundfile as sf

SR = 44100
BPM = 100
STEP = 60 / BPM / 4  # 16분음표 길이(초)

# 정답 패턴: 8비트 3마디 + 필인 1마디 (앱 커리큘럼 표기법과 동일)
TRUTH = {
    "HH": "x-x-x-x-x-x-x-x-|x-x-x-x-x-x-x-x-|x-x-x-x-x-x-x-x-|x-x-x-x---------",
    "SD": "----x-------x---|----x-------x---|----x-------x---|----x---xxxxxxxx",
    "BD": "x-------x-x-----|x-------x-------|x-------x-x-----|x-------x-------",
}


def env_exp(n, decay):
    t = np.arange(n) / SR
    return np.exp(-t / decay)


def kick(dur=0.3):
    n = int(dur * SR)
    t = np.arange(n) / SR
    freq = 45 + (120 - 45) * np.exp(-t / 0.04)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    return np.sin(phase) * env_exp(n, 0.09) * 1.0


def snare(dur=0.2):
    n = int(dur * SR)
    noise = np.random.randn(n)
    spec = np.fft.rfft(noise)
    f = np.fft.rfftfreq(n, 1 / SR)
    band = np.exp(-((f - 1800) ** 2) / (2 * 900**2))
    noise = np.fft.irfft(spec * band, n)
    noise /= np.abs(noise).max() + 1e-9
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 185 * t) * 0.5
    return (noise * 0.9 + tone) * env_exp(n, 0.045) * 0.6


def hihat(dur=0.1):
    n = int(dur * SR)
    noise = np.random.randn(n)
    spec = np.fft.rfft(noise)
    f = np.fft.rfftfreq(n, 1 / SR)
    spec[f < 7000] *= 0.02
    noise = np.fft.irfft(spec, n)
    noise /= np.abs(noise).max() + 1e-9
    return noise * env_exp(n, 0.018) * 0.35


SYNTH = {"BD": kick, "SD": snare, "HH": hihat}

bars = {k: v.replace(" ", "").split("|") for k, v in TRUTH.items()}
n_bars = len(bars["HH"])
total = int((n_bars * 16 + 8) * STEP * SR)
mix = np.zeros(total)

for lane, lane_bars in bars.items():
    for b, bar in enumerate(lane_bars):
        for s, ch in enumerate(bar):
            if ch == "-":
                continue
            t0 = int((b * 16 + s) * STEP * SR)
            sig = SYNTH[lane]()
            mix[t0 : t0 + len(sig)] += sig

mix /= np.abs(mix).max() * 1.05
sf.write("test.wav", mix, SR)
json.dump({"bpm": BPM, "truth": TRUTH}, open("truth.json", "w"))
print(f"시험곡 생성: {n_bars}마디, {BPM}BPM, {total/SR:.1f}초 → test.wav")
