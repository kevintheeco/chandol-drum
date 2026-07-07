# 채보 프로토타입 v2 — 드럼 음원(wav) → 패턴 문자열
# 1) 타격 시점 감지  2) '직전 대비 새로 늘어난' 대역 에너지로 분류 (동시타격 분리)
# 3) 16분음표 격자 최소제곱 보정  4) 채점은 마디 위상(시작점) 모호성을 허용해 최적 쉬프트로
import sys
import json
import numpy as np
import librosa

WIN = 0.06  # 타격 직후 분석 창(초)
BANDS = {"low": (0, 150), "mid": (150, 800), "noise": (1000, 5000), "high": (6000, 99999)}
# 악기별 판정: (대역, 그 악기 평소 크기 대비 문턱)
RULES = {"BD": ("low", 0.30), "SD": ("noise", 0.30), "HH": ("high", 0.25)}


def band_deltas(y, sr, t):
    # 타격 직후 창의 스펙트럼에서 직전 창을 빼서 '새로 생긴 소리'만 남긴다
    n = int(WIN * sr)
    i0 = int(t * sr)
    def spec_of(start):
        seg = y[max(start, 0) : max(start, 0) + n]
        if len(seg) < 256:
            return None
        spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
        f = np.fft.rfftfreq(len(seg), 1 / sr)
        return {k: spec[(f >= lo) & (f < hi)].sum() for k, (lo, hi) in BANDS.items()}
    after = spec_of(i0)
    before = spec_of(i0 - n)
    if after is None:
        return None
    if before is None:
        before = {k: 0.0 for k in after}
    return {k: max(after[k] - before[k], 0.0) for k in after}


def high_energy_at(y, sr, t, dur=0.06):
    # t 시점의 고역(6kHz+) 절대 에너지 — 심벌 여운 측정용
    i0 = int(t * sr)
    seg = y[i0 : i0 + int(dur * sr)]
    if len(seg) < 256:
        return 0.0
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    f = np.fft.rfftfreq(len(seg), 1 / sr)
    return float(spec[f >= 6000].sum())


def transcribe(path, bpm_hint=None, cymbal_detail=False):
    y, sr = librosa.load(path, sr=None, mono=True)
    y = np.concatenate([np.zeros(int(0.15 * sr)), y])  # 곡 첫 타격도 감지되게 침묵 패딩

    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onsets = librosa.onset.onset_detect(
        onset_envelope=onset_env, sr=sr, units="time", backtrack=False, delta=0.03, wait=1
    )
    onsets = np.maximum(onsets - 0.012, 0)

    if bpm_hint:
        bpm = float(bpm_hint)
    else:
        tempo, _ = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
        bpm = float(np.atleast_1d(tempo)[0])
    step = 60 / bpm / 4
    t0 = onsets[0] if len(onsets) else 0.0

    # 격자 보정: 최소제곱으로 시작점·간격 재추정 (누적 밀림 제거)
    for _ in range(2):
        idxs = np.round((onsets - t0) / step)
        A = np.vstack([np.ones_like(idxs), idxs]).T
        (t0, step), *_ = np.linalg.lstsq(A, onsets, rcond=None)
    bpm = 60 / (step * 4)

    # 전체 타격의 대역 변화량 수집 후, 대역별로 로그 크기 분포를 두 무리(타격 있음/없음)로
    # 군집 분리해 문턱을 데이터가 스스로 정하게 한다
    deltas = []
    for t in onsets:
        d = band_deltas(y, sr, t)
        deltas.append(d)

    # 문턱 = '진짜 타격 크기(상위 5% 수준)'의 일정 비율.
    # 실측: 진짜 타격과 가짜(잔향·찌꺼기)는 같은 대역에서 수십~수천 배 차이 → 비율로 확실히 갈림
    DIV = {"low": 10, "mid": 10, "noise": 10, "high": 80}  # 하이햇은 여린 타격 허용 폭을 넓게(크래시가 기준을 끌어올림)
    thr = {}
    for band in BANDS:
        vals = [d[band] for d in deltas if d]
        thr[band] = (np.percentile(vals, 95) / DIV[band]) if vals else np.inf

    events = {}
    for t, d in zip(onsets, deltas):
        if d is None:
            continue
        hits = {inst for inst, (band, _) in RULES.items() if d[band] > thr[band]}
        # 오픈 하이햇/심벌의 광대역 잔향이 스네어로 오인되는 것 방지: 고역이 압도하면 SD 제외
        if "SD" in hits and d["high"] > 3 * d["noise"]:
            hits.discard("SD")
        # 심벌 세분화(실험 기능): 여운으로 닫힌햇/오픈햇/크래시 구분
        # 분리 스템에선 아직 부정확(크래시 재현율 14%) → 기본 꺼짐, --cymbals로 활성화
        if cymbal_detail and "HH" in hits:
            e0 = high_energy_at(y, sr, t)
            e3 = high_energy_at(y, sr, t + 0.10)  # 다음 타격 전, 닫힌햇은 이미 죽는 시점
            ring = e3 / (e0 + 1e-12)
            if ring > 0.30 and d["high"] > 0.5 * thr["high"] * DIV["high"]:
                hits.discard("HH"); hits.add("CR")   # 크게 치고 오래 울림 = 크래시
            elif ring > 0.30:
                hits.discard("HH"); hits.add("OH")   # 울리지만 크지 않음 = 오픈햇
        # 킥은 어택 클릭이 저음 대비 아주 조금이라도 있어야 함 — 순수 저음(베이스 새어듦)과 구분
        if "BD" in hits and (d["mid"] + d["noise"]) / (d["low"] + 1e-12) < 3e-5:
            hits.discard("BD")
        idx = round((t - t0) / step)
        if hits and idx >= 0:
            events.setdefault(idx, set()).update(hits)

    n_steps = (max(events) // 16 + 1) * 16 if events else 16
    lanes = {k: ["-"] * n_steps for k in ("HH", "OH", "CR", "SD", "BD")}
    for idx, hits in events.items():
        for h in hits:
            lanes[h][idx] = "x"
    pattern = {
        k: "|".join("".join(v[b : b + 16]) for b in range(0, n_steps, 16))
        for k, v in lanes.items()
    }
    return pattern, bpm, len(onsets)


def merge_cym(pattern):
    lanes = [pattern.get(k, "").replace("|", "") for k in ("HH", "OH", "CR")]
    n = max((len(x) for x in lanes), default=0)
    out = ["-"] * n
    for s in lanes:
        for i, ch in enumerate(s):
            if ch != "-":
                out[i] = "x"
    return "".join(out)


def score_at_shift(pattern, truth, shift):
    out = {}
    for lane in ("HH", "SD", "BD"):
        got = merge_cym(pattern) if lane == "HH" else pattern.get(lane, "").replace("|", "")
        exp = truth[lane].replace(" ", "").replace("|", "")
        n = max(len(got) + shift, len(exp))
        got = ("-" * shift + got).ljust(n, "-")
        exp = exp.ljust(n, "-")
        tp = sum(1 for a, b in zip(got, exp) if a != "-" and b != "-")
        fp = sum(1 for a, b in zip(got, exp) if a != "-" and b == "-")
        fn = sum(1 for a, b in zip(got, exp) if a == "-" and b != "-")
        prec = tp / (tp + fp) if tp + fp else 0
        rec = tp / (tp + fn) if tp + fn else 0
        f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0
        out[lane] = {"정확": round(prec * 100), "재현": round(rec * 100), "F1": round(f1 * 100)}
    return out


def score(pattern, truth):
    # 마디 시작점은 채보가 알 수 없으니(위상 모호) 0~15칸 쉬프트 중 최적으로 채점
    best, best_shift, best_avg = None, 0, -1
    for shift in range(16):
        s = score_at_shift(pattern, truth, shift)
        avg = sum(v["F1"] for v in s.values()) / 3
        if avg > best_avg:
            best, best_shift, best_avg = s, shift, avg
    return best, best_shift, round(best_avg)


def make_link(pattern, bpm, title, base="https://kevintheeco.github.io/chandol-drum/"):
    # 앱이 바로 열 수 있는 #score= 링크 생성 (base64url JSON)
    import base64
    payload = json.dumps(
        {"title": title, "bpm": round(bpm, 1), "pattern": pattern},
        ensure_ascii=False, separators=(",", ":"),
    ).encode("utf-8")
    b64 = base64.urlsafe_b64encode(payload).decode().rstrip("=")
    return f"{base}#score={b64}"


if __name__ == "__main__":
    import os
    cym = "--cymbals" in sys.argv
    argv = [a for a in sys.argv if a != "--cymbals"]
    sys.argv = argv
    path = sys.argv[1] if len(sys.argv) > 1 else "test.wav"
    bpm_hint = sys.argv[2] if len(sys.argv) > 2 else None
    pattern, bpm, n_on = transcribe(path, bpm_hint, cymbal_detail=cym)
    print(f"감지 BPM: {bpm:.1f} / 타격 {n_on}개")
    for k, v in pattern.items():
        print(f"  {k}: {v}")
    try:
        truth = json.load(open("truth.json"))["truth"]
        s, shift, avg = score(pattern, truth)
        print(f"채점(쉬프트 {shift}칸): 평균 F1 {avg}점 / {json.dumps(s, ensure_ascii=False)}")
    except FileNotFoundError:
        pass
    title = os.path.splitext(os.path.basename(path))[0] + " (자동 채보)"
    print("악보 링크:", make_link(pattern, bpm, title))
