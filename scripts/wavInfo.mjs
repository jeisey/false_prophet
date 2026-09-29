/**
 * Tiny RIFF/WAVE header parser shared by the verifier script and the tests.
 * @param {Buffer} buf
 */
export function parseWavHeader(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a RIFF/WAVE file');
  }
  let offset = 12;
  let fmt = null;
  let dataOffset = -1;
  let dataSize = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      fmt = {
        format: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bitsPerSample: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      dataOffset = body;
      dataSize = size;
      break;
    }
    offset = body + size + (size % 2);
  }
  if (!fmt || dataOffset < 0) throw new Error('Missing fmt or data chunk');
  const bytesPerFrame = fmt.channels * (fmt.bitsPerSample / 8);
  const frames = dataSize / bytesPerFrame;
  return { ...fmt, dataOffset, dataSize, frames, duration: frames / fmt.sampleRate };
}
