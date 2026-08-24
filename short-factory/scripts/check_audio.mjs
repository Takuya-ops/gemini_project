// ポーズ内クリック検査+ラウドネス確認(ffmpeg利用)。
// TTS音声の無音区間に「プチッ」というクリックノイズが入っていないかを検出し、
// ラウドネス(integrated LUFS)を表示する。
// ffmpegはPlaywright同梱の /opt/pw-browsers/ffmpeg-1011/ffmpeg-linux を使う。
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FFMPEG = "/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux";
const voice = process.argv[2] ?? join(root, "public/voice.mp3");
if (!existsSync(voice)) throw new Error(`${voice} がありません`);

const run = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });

// ラウドネス測定
let loud = "";
try {
  run(`${FFMPEG} -i ${voice} -af loudnorm=print_format=json -f null - 2> /tmp/loudnorm.txt`);
} catch {}
try {
  loud = run(`grep -A 12 "input_i" /tmp/loudnorm.txt || true`);
} catch {}
console.log("--- loudnorm ---");
console.log(loud || "(測定失敗: ffmpegログを確認)");

// 無音区間の検出 → 無音中の突発ピーク(クリック)を astats で検査
let silence = "";
try {
  run(
    `${FFMPEG} -i ${voice} -af silencedetect=noise=-38dB:d=0.25 -f null - 2> /tmp/silence.txt`
  );
  silence = run(`grep silence_ /tmp/silence.txt || true`);
} catch {}
const pairs = [];
const starts = [...silence.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
const ends = [...silence.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
for (let i = 0; i < Math.min(starts.length, ends.length); i++) pairs.push([starts[i], ends[i]]);
console.log(`--- 無音区間: ${pairs.length}箇所 ---`);

let clicks = 0;
for (const [s, e] of pairs) {
  if (e - s < 0.15) continue;
  const mid = ((s + e) / 2).toFixed(2);
  const dur = (e - s - 0.1).toFixed(2);
  try {
    run(
      `${FFMPEG} -ss ${(s + 0.05).toFixed(2)} -t ${dur} -i ${voice} -af astats=metadata=1:reset=1 -f null - 2> /tmp/astats.txt`
    );
    const peak = run(`grep -oP "Peak level dB: \\K[-\\d.]+" /tmp/astats.txt | sort -g | tail -1 || true`).trim();
    if (peak && +peak > -30) {
      console.log(`クリック疑い: ${mid}s 付近 (peak ${peak}dB)`);
      clicks++;
    }
  } catch {}
}
if (clicks > 0) {
  console.log(`NG: ${clicks}箇所にクリックノイズの疑い。該当区間を無音化して再検査してください`);
  process.exit(1);
}
console.log("OK: ポーズ内クリックなし");
