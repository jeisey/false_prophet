export interface WavInfo {
  format: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataOffset: number;
  dataSize: number;
  frames: number;
  duration: number;
}
export function parseWavHeader(buf: Buffer): WavInfo;
