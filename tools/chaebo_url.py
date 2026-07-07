# 유튜브 링크 → 드럼 악보 (개인 연습용 로컬 도구, 웹 공개 기능 아님)
# 흐름: 오디오 내려받기(yt-dlp) → 구간 자르기 → 드럼 분리(Demucs) → 채보 → 악보 링크
#
# 사용: python chaebo_url.py <유튜브URL> [--start 초] [--dur 초] [--bpm 숫자] [--full]
#   기본은 시작 0초부터 75초 구간. --full이면 곡 전체(느림).
import argparse
import os
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from transcribe import transcribe, make_link  # noqa: E402

FFMPEG_DIR = os.path.expandvars(
    r"%LOCALAPPDATA%\Microsoft\WinGet\Packages"
    r"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin"
)


def download_audio(url, workdir):
    out = os.path.join(workdir, "song.%(ext)s")
    cmd = [
        sys.executable, "-m", "yt_dlp",
        "-f", "bestaudio",
        "--extract-audio", "--audio-format", "wav",
        "--ffmpeg-location", FFMPEG_DIR,
        "--no-playlist",
        "-o", out,
        "--print", "after_move:title",
        "--no-simulate",
        url,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        raise RuntimeError("다운로드 실패:\n" + (r.stderr or "")[-800:])
    title = (r.stdout or "").strip().splitlines()[-1] if r.stdout else "유튜브 곡"
    return os.path.join(workdir, "song.wav"), title


def separate_drums(src, dst):
    import torch
    from demucs.pretrained import get_model
    from demucs.apply import apply_model

    audio, sr = sf.read(src, always_2d=True)
    model = get_model("htdemucs")
    model.eval()
    wav = torch.tensor(audio.T, dtype=torch.float32)
    if wav.shape[0] == 1:
        wav = wav.repeat(2, 1)
    ref = wav.mean(0)
    wav = (wav - ref.mean()) / (ref.std() + 1e-8)
    with torch.no_grad():
        sources = apply_model(model, wav[None], device="cpu", progress=True)[0]
    sources = sources * ref.std() + ref.mean()
    drums = sources[model.sources.index("drums")].numpy().T
    sf.write(dst, drums, sr)


def trim_empty_bars(pattern):
    # 드럼이 나오기 전(전주)과 끝난 뒤의 빈 마디를 잘라낸다
    lanes = {k: v.split("|") for k, v in pattern.items()}
    n = max(len(b) for b in lanes.values())
    def bar_has_hit(i):
        return any(i < len(b) and set(b[i]) - {"-"} for b in lanes.values())
    first = next((i for i in range(n) if bar_has_hit(i)), 0)
    last = next((i for i in range(n - 1, -1, -1) if bar_has_hit(i)), n - 1)
    return {k: "|".join(b[first : last + 1]) for k, b in lanes.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--start", type=float, default=0.0, help="분석 시작(초)")
    ap.add_argument("--dur", type=float, default=75.0, help="분석 길이(초)")
    ap.add_argument("--full", action="store_true", help="곡 전체 분석")
    ap.add_argument("--bpm", type=float, default=None, help="BPM을 알면 지정(정확도 상승)")
    args = ap.parse_args()

    workdir = tempfile.mkdtemp(prefix="chaebo_")
    print("1/4 오디오 내려받는 중...")
    wav_path, title = download_audio(args.url, workdir)

    print("2/4 구간 자르는 중...")
    y, sr = sf.read(wav_path, always_2d=True)
    if not args.full:
        i0 = int(args.start * sr)
        i1 = min(len(y), i0 + int(args.dur * sr))
        y = y[i0:i1]
    clip = os.path.join(workdir, "clip.wav")
    sf.write(clip, y, sr)
    print(f"   대상: {title} / {len(y)/sr:.0f}초")

    print("3/4 드럼만 분리하는 중... (몇 분 걸릴 수 있음)")
    drums = os.path.join(workdir, "drums.wav")
    separate_drums(clip, drums)

    print("4/4 채보하는 중...")
    pattern, bpm, n_on = transcribe(drums, args.bpm)
    pattern = trim_empty_bars(pattern)
    print(f"   감지 BPM {bpm:.1f} / 타격 {n_on}개 / {len(pattern['HH'].split('|'))}마디")
    link = make_link(pattern, bpm, f"{title} (자동 채보)")
    print("\n악보 링크:\n" + link)
    print(f"\n작업 폴더(음원·드럼 트랙): {workdir}")


if __name__ == "__main__":
    main()
