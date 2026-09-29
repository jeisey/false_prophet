/**
 * Minimal Web Audio fakes that record scheduling calls, so the transport and
 * stem logic can be tested without a browser.
 */

export interface ParamEvent {
  type: 'set' | 'linear' | 'exp' | 'cancel';
  value?: number;
  time: number;
}

export class FakeParam {
  value: number;
  events: ParamEvent[] = [];
  constructor(v = 1) {
    this.value = v;
  }
  setValueAtTime(value: number, time: number) {
    this.events.push({ type: 'set', value, time });
    return this;
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.events.push({ type: 'linear', value, time });
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.events.push({ type: 'exp', value, time });
    return this;
  }
  cancelScheduledValues(time: number) {
    this.events.push({ type: 'cancel', time });
    return this;
  }
}

class FakeNode {
  connections: unknown[] = [];
  connect(n: unknown) {
    this.connections.push(n);
    return n;
  }
  disconnect() {
    this.connections = [];
  }
}

export class FakeGain extends FakeNode {
  gain = new FakeParam(1);
}

export class FakeSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  playbackRate = new FakeParam(1);
  startedAt: number | null = null;
  startOffset: number | null = null;
  stoppedAt: number | null = null;
  onended: (() => void) | null = null;
  start(when = 0, offset = 0) {
    this.startedAt = when;
    this.startOffset = offset;
  }
  stop(when = 0) {
    this.stoppedAt = when;
  }
}

export class FakeBuffer {
  constructor(public numberOfChannels: number, public length: number, public sampleRate: number) {}
  private data = new Map<number, Float32Array>();
  getChannelData(c: number) {
    if (!this.data.has(c)) this.data.set(c, new Float32Array(this.length));
    return this.data.get(c)!;
  }
  get duration() {
    return this.length / this.sampleRate;
  }
}

export class FakeAudioContext {
  currentTime = 0;
  sampleRate = 48000;
  baseLatency = 0;
  outputLatency = 0;
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  destination = new FakeNode();
  sources: FakeSource[] = [];
  gains: FakeGain[] = [];

  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createDynamicsCompressor() {
    const n = new FakeNode() as any;
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new FakeParam(0);
    return n;
  }
  createBiquadFilter() {
    const n = new FakeNode() as any;
    n.type = 'lowpass';
    n.frequency = new FakeParam(20000);
    return n;
  }
  createAnalyser() {
    const n = new FakeNode() as any;
    n.fftSize = 256;
    n.frequencyBinCount = 128;
    n.getByteFrequencyData = () => undefined;
    return n;
  }
  createStereoPanner() {
    const n = new FakeNode() as any;
    n.pan = new FakeParam(0);
    return n;
  }
  createBufferSource() {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  createBuffer(ch: number, len: number, sr: number) {
    return new FakeBuffer(ch, len, sr);
  }
  decodeAudioData(_data: ArrayBuffer, ok?: (b: FakeBuffer) => void) {
    const b = new FakeBuffer(2, 1_440_000, 48000);
    ok?.(b);
    return Promise.resolve(b);
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}
