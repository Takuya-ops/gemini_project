// 台本の読み(かな)長からキューごとの推定尺を計算し src/timing.json に書き出す。
// TTS音声が出来たら scripts/asr_align.mjs が実測タイミングで同じファイルを上書きする。
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/script.ts"), "utf8");

// script.ts から reading と id を素朴に抽出(ビルド不要で回すため)
const cueBlocks = [...src.matchAll(/id:\s*"(c\d+)"[\s\S]*?reading:\s*\n?\s*"([^"]+)"/g)];
if (cueBlocks.length === 0) throw new Error("no cues parsed from script.ts");

const FPS = 30;
const TOTAL_SPEECH_SEC = 56.5; // 全読み上げの目標尺(CTAカード除く)
const GAP_SEC = 0.12; // キュー間の間

const lens = cueBlocks.map(([, , reading]) => reading.replace(/、/g, "").length);
const totalLen = lens.reduce((a, b) => a + b, 0);
const speechSec = TOTAL_SPEECH_SEC - GAP_SEC * cueBlocks.length;

const timing = [];
let cursor = 0;
cueBlocks.forEach(([, id], i) => {
  const sec = (lens[i] / totalLen) * speechSec + GAP_SEC;
  const frames = Math.max(Math.round(sec * FPS), 45); // 最低1.5秒
  timing.push({ id, startFrame: cursor, durationFrames: frames, estimated: true });
  cursor += frames;
});

writeFileSync(
  join(root, "src/timing.json"),
  JSON.stringify({ fps: FPS, cues: timing, speechEndFrame: cursor }, null, 2)
);
console.log(
  `wrote src/timing.json: ${timing.length} cues, speech ${(cursor / FPS).toFixed(1)}s`
);
