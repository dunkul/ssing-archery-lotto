// 효과음·배경음악: 음원 파일 없이 Web Audio 로 합성한다.

type Wave = OscillatorType;

const DING = [523, 587, 659, 784, 880, 1047, 1319];

// 배경음악: 작은 축제풍 루프, C–Am–F–G, 8분음표 (숫자는 MIDI 음 번호, 0 은 쉼표)
const BGM_TEMPO = 128;
const BGM_STEP = 60 / BGM_TEMPO / 2;
const BGM_CHORDS = [
  [48, 52, 55],
  [45, 48, 52],
  [41, 45, 48],
  [43, 47, 50],
];
const BGM_MELODY = [
  72, 0, 76, 79, 76, 0, 74, 72, 69, 0, 72, 76, 74, 72, 69, 0, 69, 72, 77, 0, 76, 72, 74, 0, 71,
  74, 79, 0, 77, 76, 74, 71,
];

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export type SfxName = keyof SoundSystem["sfx"];

export class SoundSystem {
  sfxOn = true;
  private ctx: AudioContext | null = null;
  private fxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private bgmTime = 0;
  private bgmStep = 0;
  private bgmTimer: ReturnType<typeof setInterval> | null = null;

  /** 브라우저 정책상 첫 사용자 입력 이후에만 만들 수 있다 */
  private context() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const c = new Ctor();
      const master = c.createGain();
      master.gain.value = 0.7;
      master.connect(c.destination);
      this.fxBus = c.createGain();
      this.fxBus.connect(master);
      this.musicBus = c.createGain();
      this.musicBus.gain.value = 0.5;
      this.musicBus.connect(master);
      this.ctx = c;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  unlock() {
    this.context();
  }

  setHidden(hidden: boolean) {
    if (!this.ctx) return;
    void (hidden ? this.ctx.suspend() : this.ctx.resume());
  }

  private tone(type: Wave, f0: number, f1: number | null, dur: number, vol: number, when = 0, dest?: AudioNode) {
    const c = this.ctx!;
    const t = c.currentTime + Math.max(0, when);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest ?? this.fxBus);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  private noise(dur: number, vol: number, ftype: BiquadFilterType, f0: number, f1: number | null, when = 0, q = 1, dest?: AudioNode) {
    const c = this.ctx!;
    if (!this.noiseBuf) {
      this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = c.currentTime + Math.max(0, when);
    const s = c.createBufferSource();
    const fl = c.createBiquadFilter();
    const g = c.createGain();
    s.buffer = this.noiseBuf;
    fl.type = ftype;
    fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t);
    if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl);
    fl.connect(g);
    g.connect(dest ?? this.fxBus);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  readonly sfx = {
    grab: () => this.noise(0.07, 0.18, "highpass", 2500, null, 0, 1),
    creak: () => {
      this.noise(0.55, 0.1, "bandpass", 260, 900, 0, 9);
      this.tone("sawtooth", 70, 120, 0.55, 0.025);
    },
    twang: () => {
      this.tone("triangle", 196, 98, 0.4, 0.4);
      this.tone("square", 392, 160, 0.1, 0.07);
      this.noise(0.06, 0.25, "highpass", 2500, null);
    },
    whoosh: () => this.noise(0.4, 0.22, "bandpass", 500, 2600, 0.02, 2.5),
    pop: () => {
      this.noise(0.22, 0.7, "lowpass", 5000, 300);
      this.tone("sine", 170, 45, 0.22, 0.55);
    },
    miss: () => this.tone("triangle", 440, 220, 0.3, 0.15),
    bounce: (v: number) => this.tone("sine", 220 + v * 260, 150, 0.09, 0.12 + v * 0.2),
    ding: (i: number) => {
      const f = DING[i] ?? 1047;
      this.tone("sine", f, null, 0.7, 0.22);
      this.tone("triangle", f * 2, null, 0.25, 0.06);
    },
    tweet: () => {
      this.tone("sine", 1700, 2600, 0.07, 0.12);
      this.tone("sine", 1900, 2900, 0.07, 0.12, 0.1);
    },
    fanfare: () => {
      [523, 659, 784].forEach((f, i) => this.tone("square", f, null, 0.18, 0.1, i * 0.13));
      this.tone("square", 1047, null, 0.7, 0.11, 0.42);
      this.tone("triangle", 523, null, 0.9, 0.22, 0.42);
      this.tone("triangle", 659, null, 0.9, 0.15, 0.42);
    },
    /** 역대 1·2등: 두 옥타브 올라가는 아르페지오 + 긴 화음 + 반짝이 */
    jackpot: () => {
      const arp = [523, 659, 784, 1047, 1319, 1568, 2093];
      arp.forEach((f, i) => this.tone("square", f, null, 0.16, 0.09, i * 0.08));
      const end = arp.length * 0.08;
      [523, 659, 784, 1047].forEach((f) => this.tone("triangle", f, null, 1.6, 0.16, end));
      this.tone("square", 1047, null, 1.2, 0.06, end);
      for (let i = 0; i < 10; i++) this.tone("sine", 2400 + Math.random() * 1600, null, 0.12, 0.05, end + 0.1 + i * 0.12);
    },
    launch: () => {
      this.noise(0.5, 0.1, "bandpass", 800, 3000, 0, 3);
      this.tone("sine", 600, 1800, 0.5, 0.04);
    },
    boom: () => {
      this.noise(0.9, 0.55, "lowpass", 1200, 100);
      this.tone("sine", 90, 40, 0.5, 0.4);
      for (let i = 0; i < 6; i++) this.noise(0.03, 0.12, "highpass", 5000, null, 0.25 + Math.random() * 0.5);
    },
  };

  play<K extends SfxName>(name: K, ...args: Parameters<SoundSystem["sfx"][K]>) {
    if (!this.sfxOn || !this.context()) return;
    try {
      (this.sfx[name] as (...a: unknown[]) => void)(...args);
    } catch {
      /* 오디오 오류는 게임 진행에 영향 없게 무시 */
    }
  }

  // ---------- 배경음악 ----------
  startBgm() {
    if (this.bgmTimer || !this.context()) return;
    this.bgmTime = this.ctx!.currentTime + 0.08;
    this.bgmTimer = setInterval(() => this.scheduleBgm(), 40);
  }

  stopBgm() {
    if (this.bgmTimer) clearInterval(this.bgmTimer);
    this.bgmTimer = null;
  }

  /** 0.25초 앞까지의 음을 미리 예약 */
  private scheduleBgm() {
    const c = this.ctx!;
    const bus = this.musicBus;
    while (this.bgmTime < c.currentTime + 0.25) {
      const s = this.bgmStep % 32;
      const chord = BGM_CHORDS[Math.floor(s / 8)];
      const w = this.bgmTime - c.currentTime;
      if (s % 2 === 0) this.tone("triangle", mtof(chord[s % 4 === 0 ? 0 : 2] - 12), null, BGM_STEP * 1.7, 0.55, w, bus); // 베이스
      if (s % 4 === 2) chord.forEach((m) => this.tone("square", mtof(m + 12), null, BGM_STEP * 0.5, 0.07, w, bus)); // 화음
      if (BGM_MELODY[s]) this.tone("square", mtof(BGM_MELODY[s]), null, BGM_STEP * 0.9, 0.16, w, bus); // 멜로디
      if (s % 2 === 1) this.noise(0.04, 0.12, "highpass", 7000, null, w, 1, bus); // 하이햇
      if (s % 8 === 0) this.tone("sine", 120, 45, 0.15, 0.5, w, bus); // 킥
      this.bgmTime += BGM_STEP;
      this.bgmStep++;
    }
  }
}
