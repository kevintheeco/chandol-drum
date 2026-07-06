# Demucs 분리 실행기 — torchaudio/torchcodec 우회 (soundfile로 직접 읽고 씀)
import sys
import numpy as np
import soundfile as sf
import torch
from demucs.pretrained import get_model
from demucs.apply import apply_model

src = sys.argv[1] if len(sys.argv) > 1 else "band_test.wav"
out = sys.argv[2] if len(sys.argv) > 2 else "drums_only.wav"

audio, sr = sf.read(src, always_2d=True)  # (샘플, 채널)
model = get_model("htdemucs")
model.eval()

# 모델 기대 형식: (배치, 채널2, 샘플), 44.1kHz
wav = torch.tensor(audio.T, dtype=torch.float32)
if wav.shape[0] == 1:
    wav = wav.repeat(2, 1)
ref = wav.mean(0)
wav = (wav - ref.mean()) / (ref.std() + 1e-8)

with torch.no_grad():
    sources = apply_model(model, wav[None], device="cpu", progress=False)[0]
sources = sources * ref.std() + ref.mean()

drums = sources[model.sources.index("drums")].numpy().T
sf.write(out, drums, sr)
print(f"드럼 분리 완료: {src} → {out} ({len(drums)/sr:.1f}초)")
