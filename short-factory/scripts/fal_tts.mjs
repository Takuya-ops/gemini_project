// 声クローンTTS: 参照音声からボイスをクローンし、台本の読み(かな)を1本のナレーションにする。
// 使い方:
//   1) 参照音声を short-factory/assets/reference_voice.(wav|mp3|m4a) に置く
//   2) node scripts/fal_tts.mjs
//   出力: public/voice.mp3 と src/assets.json の voice 更新
//
// モデルはfalの minimax voice-clone + speech-02-hd を既定にしている。
// SKILL.md指定のモデルが別にある場合は MODEL_CLONE / MODEL_TTS を差し替えること。
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { falRun, download, getFalKey } from "./fal_client.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL_CLONE = "fal-ai/minimax/voice-clone";
const MODEL_TTS = "fal-ai/minimax/speech-02-hd";

// 参照音声を探す
const refCandidates = ["wav", "mp3", "m4a", "mp4"].map((e) =>
  join(root, `assets/reference_voice.${e}`)
);
const refPath = refCandidates.find((p) => existsSync(p));
if (!refPath)
  throw new Error(
    "参照音声がありません: short-factory/assets/reference_voice.{wav,mp3,m4a,mp4} に配置してください"
  );

// 台本の読みを連結(キュー間は句点で区切って自然なポーズに)
const scriptSrc = readFileSync(join(root, "src/script.ts"), "utf8");
const readings = [...scriptSrc.matchAll(/reading:\s*\n?\s*"([^"]+)"/g)].map((m) => m[1]);
const text = readings.join("。\n") + "。";
console.log(`台本 ${readings.length}キュー / ${text.length}文字`);

// 1. 参照音声をfalストレージにアップロード
const key = getFalKey();
const fileBuf = readFileSync(refPath);
const size = statSync(refPath).size;
console.log(`参照音声: ${refPath} (${(size / 1024 / 1024).toFixed(1)}MB)`);
const initRes = await fetch(
  "https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3",
  {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      file_name: refPath.split("/").pop(),
      content_type: "application/octet-stream",
    }),
  }
);
if (!initRes.ok) throw new Error(`upload initiate: ${initRes.status} ${await initRes.text()}`);
const { upload_url, file_url } = await initRes.json();
const putRes = await fetch(upload_url, { method: "PUT", body: fileBuf });
if (!putRes.ok) throw new Error(`upload put: ${putRes.status}`);
console.log(`アップロード完了: ${file_url}`);

// 2. ボイスクローン
console.log("ボイスクローン中...");
const clone = await falRun(MODEL_CLONE, { audio_url: file_url });
const voiceId = clone.custom_voice_id ?? clone.voice_id;
if (!voiceId) throw new Error(`voice_idが取得できません: ${JSON.stringify(clone)}`);
console.log(`voice_id: ${voiceId}`);

// 3. TTS生成
console.log("TTS生成中...");
const tts = await falRun(
  MODEL_TTS,
  {
    text,
    voice_setting: { custom_voice_id: voiceId, speed: 1.05 },
    output_format: "url",
  },
  { timeoutSec: 600 }
);
const audioUrl = tts.audio?.url ?? tts.audio_url ?? tts.url;
if (!audioUrl) throw new Error(`音声URLが取得できません: ${JSON.stringify(tts)}`);
await download(audioUrl, join(root, "public/voice.mp3"));

// 4. assets.json 更新
const assets = JSON.parse(readFileSync(join(root, "src/assets.json"), "utf8"));
assets.voice = "voice.mp3";
writeFileSync(join(root, "src/assets.json"), JSON.stringify(assets, null, 2));
console.log("public/voice.mp3 を書き出し、assets.json を更新しました");
console.log("次: node scripts/asr_align.mjs でタイミングを実測に合わせてください");
