// 「ドン」SE をオフライン合成して public/se_don.wav に書き出す(外部API不要)。
// 低域サイン(70→38Hz スイープ)+ノイズトランジェント+指数減衰。
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SR = 44100;
const DUR = 0.7;
const N = Math.floor(SR * DUR);
const samples = new Float64Array(N);

let phase = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const freq = 70 * Math.pow(38 / 70, t / DUR);
  phase += (2 * Math.PI * freq) / SR;
  const body = Math.sin(phase) * Math.exp(-t * 7);
  const punch = (Math.random() * 2 - 1) * Math.exp(-t * 90) * 0.5;
  samples[i] = body * 0.9 + punch;
}
// ソフトクリップで角を取る
const pcm = new Int16Array(N);
for (let i = 0; i < N; i++) {
  const v = Math.tanh(samples[i] * 1.4);
  pcm[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767 * 0.9)));
}

const dataSize = pcm.length * 2;
const buf = Buffer.alloc(44 + dataSize);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + dataSize, 4);
buf.write("WAVE", 8);
buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); // PCM
buf.writeUInt16LE(1, 22); // mono
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 2, 28);
buf.writeUInt16LE(2, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(dataSize, 40);
Buffer.from(pcm.buffer).copy(buf, 44);

const out = join(dirname(fileURLToPath(import.meta.url)), "../public/se_don.wav");
writeFileSync(out, buf);
console.log(`wrote ${out} (${DUR}s, ${SR}Hz)`);
