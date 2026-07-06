// 드럼 사운드(웹오디오 합성) + 메트로놈 + 시퀀서
// 샘플 파일 없이 브라우저가 직접 소리를 만든다 — 어디서나 즉시 재생.

export class DrumKit {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = this.ctx.createDynamicsCompressor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      // 화이트노이즈 1초 버퍼 (스네어·심벌 공용)
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  now() {
    return this.ensure().currentTime;
  }

  _env(t, peak, decay) {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
    gain.connect(this.master);
    return gain;
  }

  _noise(t, dur, filterType, freq, q, peak, decay) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.value = freq;
    filt.Q.value = q;
    src.connect(filt);
    filt.connect(this._env(t, peak, decay));
    src.start(t);
    src.stop(t + dur);
  }

  _tone(t, type, f0, f1, sweep, peak, decay) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1) osc.frequency.exponentialRampToValueAtTime(f1, t + sweep);
    osc.connect(this._env(t, peak, decay));
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }

  kick(t, accent) {
    this._tone(t, 'sine', 120, 45, 0.1, accent ? 1.25 : 1.0, 0.28);
    this._noise(t, 0.03, 'lowpass', 900, 0.5, 0.4, 0.03); // 비터 어택
  }

  snare(t, { accent, ghost } = {}) {
    const peak = ghost ? 0.13 : accent ? 0.95 : 0.55;
    this._noise(t, 0.25, 'bandpass', 1800, 0.7, peak, accent ? 0.18 : 0.13);
    this._noise(t, 0.18, 'highpass', 4500, 0.6, peak * 0.5, 0.09); // 스냅(와이어 소리)
    if (!ghost) {
      this._tone(t, 'triangle', 185, 140, 0.05, peak * 0.55, 0.07);
      this._tone(t, 'sine', 330, 280, 0.04, peak * 0.25, 0.05); // 몸통 울림
    }
  }

  // 금속성 심벌 톤 — 비화성 배음 6개(사각파)를 겹쳐 진짜 금속 울림을 만든다 (808 계열 기법)
  _metal(t, baseFreq, hpFreq, peak, decay) {
    const env = this._env(t, peak, decay);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = hpFreq;
    hp.connect(env);
    for (const ratio of [1.0, 1.342, 1.2312, 1.6532, 1.9523, 2.1523]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = baseFreq * ratio;
      const g = this.ctx.createGain();
      g.gain.value = 1 / 6;
      osc.connect(g);
      g.connect(hp);
      osc.start(t);
      osc.stop(t + decay + 0.05);
    }
  }

  hihat(t, { open, accent } = {}) {
    this._metal(t, 3200, 7000, accent ? 0.42 : 0.28, open ? 0.45 : 0.055);
    this._noise(t, open ? 0.5 : 0.08, 'highpass', 8500, 0.8, accent ? 0.2 : 0.13, open ? 0.35 : 0.04);
  }

  ride(t, { accent } = {}) {
    this._metal(t, 2100, 5000, accent ? 0.25 : 0.17, 0.7);
    this._tone(t, 'triangle', 880, null, 0, 0.1, 0.35); // 핑(스틱 끝 타격음)
    this._noise(t, 0.8, 'bandpass', 7000, 1.0, accent ? 0.12 : 0.08, 0.6);
  }

  crash(t, { accent } = {}) {
    this._metal(t, 2600, 4200, accent ? 0.5 : 0.38, 1.2);
    this._noise(t, 1.4, 'highpass', 4500, 0.6, accent ? 0.45 : 0.32, 1.0);
  }

  tom(t, high, { accent } = {}) {
    const f = high ? 210 : 130;
    this._tone(t, 'sine', f, f * 0.55, 0.18, accent ? 1.0 : 0.8, 0.3);
  }

  click(t, downbeat) {
    this._tone(t, 'sine', downbeat ? 1600 : 1050, null, 0, 0.4, 0.035);
  }

  play(inst, t, flags = {}) {
    switch (inst) {
      case 'BD': return this.kick(t, flags.accent);
      case 'SD': return this.snare(t, flags);
      case 'HH': return this.hihat(t, { ...flags, open: false });
      case 'OH': return this.hihat(t, { ...flags, open: true });
      case 'RD': return this.ride(t, flags);
      case 'CR': return this.crash(t, flags);
      case 'T1': return this.tom(t, true, flags);
      case 'T2': return this.tom(t, false, flags);
    }
  }
}

// 시퀀서 — lookahead 방식으로 정확한 타이밍에 예약 재생
export class Player {
  constructor(kit) {
    this.kit = kit;
    this.bars = [];
    this.bpm = 60;
    this.loop = true;
    this.metronome = true;
    this.countIn = true;
    this.playing = false;
    this.onStep = null;   // (전체 스텝 index, 음수 = 카운트인) 시각 표시용
    this.onStop = null;
    this._timer = null;
    this._raf = null;
    this._queue = [];
  }

  get stepDur() {
    return 60 / this.bpm / 4; // 16분음표 길이
  }

  start() {
    if (this.playing || this.bars.length === 0) return;
    const ctx = this.kit.ensure();
    this.playing = true;
    this._queue = [];
    const startAt = ctx.currentTime + 0.12;
    this._pos = this.countIn ? -4 : 0; // 카운트인 = 4분음표 4번
    this._nextTime = startAt;
    this._totalSteps = this.bars.length * 16;
    this._timer = setInterval(() => this._schedule(), 25);
    this._visualLoop();
  }

  stop(fireCallback = true) {
    this.playing = false;
    clearInterval(this._timer);
    cancelAnimationFrame(this._raf);
    this._queue = [];
    if (fireCallback && this.onStop) this.onStop();
  }

  _schedule() {
    const ctx = this.kit.ctx;
    const ahead = ctx.currentTime + 0.12;
    while (this._nextTime < ahead) {
      if (this._pos < 0) {
        // 카운트인: 4분음표 클릭
        this.kit.click(this._nextTime, this._pos === -4);
        this._queue.push({ step: this._pos, time: this._nextTime });
        this._pos++;
        this._nextTime += this.stepDur * 4;
        continue;
      }
      const stepIdx = this._pos;
      const bar = this.bars[Math.floor(stepIdx / 16)];
      const step = bar.steps[stepIdx % 16];
      if (this.metronome && stepIdx % 4 === 0) {
        this.kit.click(this._nextTime, stepIdx % 16 === 0);
      }
      for (const hit of step.hits) {
        this.kit.play(hit.inst, this._nextTime, { accent: hit.accent, ghost: hit.ghost });
      }
      this._queue.push({ step: stepIdx, time: this._nextTime });
      this._pos++;
      this._nextTime += this.stepDur;
      if (this._pos >= this._totalSteps) {
        if (this.loop) this._pos = 0;
        else {
          const endTime = this._nextTime;
          setTimeout(() => { if (this.playing) this.stop(); },
            Math.max(0, (endTime - ctx.currentTime) * 1000) + 150);
          clearInterval(this._timer);
          return;
        }
      }
    }
  }

  _visualLoop() {
    if (!this.playing) return;
    const now = this.kit.ctx.currentTime;
    while (this._queue.length && this._queue[0].time <= now) {
      const ev = this._queue.shift();
      if (this.onStep) this.onStep(ev.step);
    }
    this._raf = requestAnimationFrame(() => this._visualLoop());
  }
}
