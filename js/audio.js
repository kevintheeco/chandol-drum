// 드럼 사운드(스튜디오 녹음 샘플 + 웹오디오 합성) + 메트로놈 + 시퀀서
// 기본 킷 = 살라만더 드럼킷(Alexander Holm, CC0) 실제 녹음.
// 샘플이 로딩되기 전이나 '일렉트로닉' 킷 선택 시에는 합성음으로 재생.

// 악기별 샘플: 세기(accent/normal/ghost)마다 파일 목록, 같은 세기는 무작위 로테이션
const SAMPLE_DIR = 'sounds/salamander/';
const SAMPLE_MAP = {
  BD: { accent: [['kick_OH_FF_1', 1.0], ['kick_OH_FF_2', 1.0]],
        normal: [['kick_OH_FF_1', 0.7], ['kick_OH_FF_2', 0.7]],
        ghost:  [['kick_OH_P_1', 0.6]] },
  SD: { accent: [['snare_OH_FF_1', 1.0], ['snare_OH_FF_2', 1.0]],
        normal: [['snare_OH_MP_1', 1.0]],
        ghost:  [['snare_OH_Ghost_1', 0.9]] },
  HH: { accent: [['hihatClosed_OH_F_1', 1.0], ['hihatClosed_OH_F_2', 1.0]],
        normal: [['hihatClosed_OH_F_1', 0.65], ['hihatClosed_OH_F_2', 0.65]],
        ghost:  [['hihatClosed_OH_P_1', 0.7]] },
  // 오픈햇은 완전 개방음이 징처럼 울려서 반개방(semi-open) 녹음 사용
  OH: { accent: [['hihatSemiOpen4_OH_F_1', 0.9]],
        normal: [['hihatSemiOpen2_OH_F_1', 0.8], ['hihatSemiOpen4_OH_F_1', 0.75]],
        ghost:  [['hihatSemiOpen2_OH_P_1', 0.7]] },
  CR: { accent: [['crash1_OH_FF_1', 1.0], ['crash1_OH_FF_2', 1.0]],
        normal: [['crash1_OH_FF_1', 0.7], ['crash1_OH_FF_2', 0.7]],
        ghost:  [['crash1_OH_P_1', 0.7]] },
  RD: { accent: [['ride1_OH_FF_1', 0.9]],
        normal: [['ride1_OH_MP_1', 1.0]],
        ghost:  [['ride1_OH_MP_1', 0.6]] },
  T1: { accent: [['hiTom_OH_FF_1', 1.0]],
        normal: [['hiTom_OH_F_1', 1.0]],
        ghost:  [['hiTom_OH_F_1', 0.6]] },
  // 미드탐: 살라만더에 없어서 하이탐 샘플을 낮게 재생(피치 시프트)
  MT: { accent: [['hiTom_OH_FF_1', 1.0, 0.8]],
        normal: [['hiTom_OH_F_1', 1.0, 0.8]],
        ghost:  [['hiTom_OH_F_1', 0.6, 0.8]] },
  T2: { accent: [['loTom_OH_FF_1', 1.0]],
        normal: [['loTom_OH_MP_1', 1.0]],
        ghost:  [['loTom_OH_MP_1', 0.6]] },
};

export class DrumKit {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.kit = 'acoustic';        // 'acoustic'(녹음 샘플) | 'electronic'(합성)
    this.samples = null;          // 파일명 → AudioBuffer
    this._fetched = null;         // 파일명 → ArrayBuffer (디코딩 전)
    this._openHatSources = [];    // 열린 하이햇 초크용
    this._prefetch();
  }

  // 페이지가 뜨자마자 샘플 파일을 미리 받아둔다 (디코딩은 첫 재생 때)
  async _prefetch() {
    const names = new Set();
    for (const inst of Object.values(SAMPLE_MAP))
      for (const layer of Object.values(inst))
        for (const [name] of layer) names.add(name);
    const fetched = {};
    await Promise.all([...names].map(async (name) => {
      try {
        const res = await fetch(SAMPLE_DIR + name + '.mp3');
        if (res.ok) fetched[name] = await res.arrayBuffer();
      } catch { /* 오프라인 등 실패 시 합성음으로 폴백 */ }
    }));
    this._fetched = fetched;
    if (this.ctx) this._decodeAll();
  }

  async _decodeAll() {
    if (this.samples || !this._fetched) return;
    const samples = {};
    await Promise.all(Object.entries(this._fetched).map(async ([name, buf]) => {
      try { samples[name] = await this.ctx.decodeAudioData(buf.slice(0)); } catch {}
    }));
    this.samples = samples;
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
      this._decodeAll();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  // 녹음 샘플 재생. 재생했으면 true, 아직 준비 전이면 false(합성음 폴백)
  _playSample(inst, t, flags = {}) {
    if (!this.samples) return false;
    const layers = SAMPLE_MAP[inst];
    if (!layers) return false;
    const level = flags.ghost ? 'ghost' : flags.accent ? 'accent' : 'normal';
    const pool = layers[level];
    const [name, gainVal, rate = 1] = pool[Math.floor(Math.random() * pool.length)];
    const buf = this.samples[name];
    if (!buf) return false;

    // 닫힌 하이햇을 치면 울리던 열린 하이햇을 잡는다 (실제 페달 동작)
    if (inst === 'HH') {
      for (const g of this._openHatSources) {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0.0001, t + 0.04);
      }
      this._openHatSources = [];
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    gain.gain.value = gainVal;
    src.connect(gain);
    gain.connect(this.master);
    src.start(t);
    if (inst === 'OH') this._openHatSources.push(gain);
    return true;
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

  tom(t, freq, { accent } = {}) {
    this._tone(t, 'sine', freq, freq * 0.55, 0.18, accent ? 1.0 : 0.8, 0.3);
  }

  click(t, downbeat) {
    this._tone(t, 'sine', downbeat ? 1600 : 1050, null, 0, 0.4, 0.035);
  }

  play(inst, t, flags = {}) {
    this.ensure();
    if (this.kit === 'acoustic' && this._playSample(inst, t, flags)) return;
    switch (inst) {
      case 'BD': return this.kick(t, flags.accent);
      case 'SD': return this.snare(t, flags);
      case 'HH': return this.hihat(t, { ...flags, open: false });
      case 'OH': return this.hihat(t, { ...flags, open: true });
      case 'RD': return this.ride(t, flags);
      case 'CR': return this.crash(t, flags);
      case 'T1': return this.tom(t, 210, flags);
      case 'MT': return this.tom(t, 160, flags);
      case 'T2': return this.tom(t, 128, flags);
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

  start(fromStep = 0) {
    if (this.playing || this.bars.length === 0) return;
    const ctx = this.kit.ensure();
    this.playing = true;
    this._queue = [];
    const startAt = ctx.currentTime + 0.12;
    this._totalSteps = this.bars.length * 16;
    this._startStep = Math.max(0, Math.min(fromStep, this._totalSteps - 1));
    this._pos = this.countIn ? -4 : this._startStep; // 카운트인 = 4분음표 4번
    this._nextTime = startAt;
    this._timer = setInterval(() => this._schedule(), 25);
    this._visualLoop();
  }

  // 재생 중 원하는 위치로 점프
  jumpTo(step) {
    if (!this.playing) return;
    this.stop(false);
    this.start(step);
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
        if (this._pos === 0) this._pos = this._startStep; // 카운트인 후 시작 위치로
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
        if (this.loop) this._pos = this._startStep; // 반복 시 시작 표시 지점부터
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
