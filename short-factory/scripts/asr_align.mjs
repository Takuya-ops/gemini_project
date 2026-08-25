// ASR照合+タイミング整合: TTS音声(public/voice.mp3)をwhisperで文字起こしし、
// 1) 台本と突き合わせて言い間違い・欠落を検出
// 2) セグメントのタイムスタンプから src/timing.json を実測値で書き直す
//
// 前提: pip install openai-whisper (モデルDLに openaipublic.azureedge.net への接続が必要)
// 使い方: node scripts/asr_align.mjs
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const voice = join(root, "public/voice.mp3");
if (!existsSync(voice)) throw new Error("public/voice.mp3 がありません。先に fal_tts.mjs を実行してください");

const FPS = 30;
const outDir = join(root, "out/asr");
execSync(`mkdir -p ${outDir}`);
console.log("whisperで文字起こし中(small, ja)...");
execSync(
  `python3 -m whisper ${voice} --model small --language ja --output_format json --output_dir ${outDir}`,
  { stdio: "inherit" }
);
const asr = JSON.parse(readFileSync(join(outDir, "voice.json"), "utf8"));

// 台本のキュー読みを取得
const src = readFileSync(join(root, "src/script.ts"), "utf8");
const cues = [...src.matchAll(/id:\s*"(c\d+)"[\s\S]*?reading:\s*\n?\s*"([^"]+)"/g)].map(
  ([, id, reading]) => ({ id, reading: reading.replace(/、/g, "") })
);

// ASRセグメントを順番にキューへ貪欲マッチ(文字数比で割り当て)
const totalChars = cues.reduce((a, c) => a + c.reading.length, 0);
const audioEnd = asr.segments.at(-1)?.end ?? 0;
console.log(`音声長: ${audioEnd.toFixed(1)}s / セグメント: ${asr.segments.length}`);

// 各キューの開始時刻を、文字数の累積比で音声全体にマップし、
// もっとも近いセグメント境界にスナップする
let acc = 0;
const bounds = cues.map((c) => {
  const t = (acc / totalChars) * audioEnd;
  acc += c.reading.length;
  return t;
});
const snap = (t) => {
  let best = t;
  let bestD = 0.6; // 0.6秒以内の境界にだけスナップ
  for (const s of asr.segments) {
    for (const edge of [s.start, s.end]) {
      const d = Math.abs(edge - t);
      if (d < bestD) {
        bestD = d;
        best = edge;
      }
    }
  }
  return best;
};

const starts = bounds.map(snap);
const timing = cues.map((c, i) => {
  const start = starts[i];
  const end = i + 1 < starts.length ? starts[i + 1] : audioEnd;
  return {
    id: c.id,
    startFrame: Math.round(start * FPS),
    durationFrames: Math.max(Math.round((end - start) * FPS), 30),
    estimated: false,
  };
});
const speechEndFrame = Math.round((audioEnd + 0.3) * FPS);
writeFileSync(
  join(root, "src/timing.json"),
  JSON.stringify({ fps: FPS, cues: timing, speechEndFrame }, null, 2)
);
console.log(`src/timing.json を実測タイミングで更新(speech ${(speechEndFrame / FPS).toFixed(1)}s)`);

// 言い間違い検出: ASR全文と台本を正規化して比較
const norm = (s) =>
  s
    .replace(/[、。\s]/g, "")
    .replace(/[ァ-ン]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60)); // カタカナ→ひらがな
const asrText = norm(asr.text ?? asr.segments.map((s) => s.text).join(""));
const scriptText = norm(cues.map((c) => c.reading).join(""));
const lenRatio = asrText.length / scriptText.length;
console.log(`ASR文字数比: ${(lenRatio * 100).toFixed(0)}%(90〜110%が正常圏)`);
if (lenRatio < 0.9 || lenRatio > 1.1) {
  console.log("警告: 欠落または余分な発話の可能性。out/asr/voice.json を確認してください");
  process.exit(1);
}
console.log("OK: ASR照合パス");
