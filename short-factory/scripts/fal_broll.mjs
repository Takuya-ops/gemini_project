// Bロール画像生成: 指定キューの背景画像をfalで生成し public/broll/<id>.png に保存、
// src/assets.json の broll リストを更新する。
// 使い方: node scripts/fal_broll.mjs   (BROLL_PLAN のキューを全生成)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { falRun, download } from "./fal_client.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL = "fal-ai/flux/schnell";

// キューごとの画像プロンプト(縦9:16・テキスト無し・テロップの邪魔をしない構図)
const BROLL_PLAN = {
  c01: "sleek MacBook on a minimal dark desk, glowing screen, moody cinematic lighting, no network cables, offline concept, vertical composition, no text",
  c03: "abstract app interface floating above a laptop, purple neon accents, clean tech aesthetic, vertical composition, no text",
  c04: "digital shield hologram protecting a laptop, dark green tones, privacy concept, cinematic, vertical composition, no text",
  c06: "single yen coin on dark surface with soft golden light, minimalism, cost-free concept, vertical composition, no text",
  c08: "close-up of Apple silicon chip glowing on dark motherboard, blue tones, vertical composition, no text",
  c11: "glowing API network nodes connecting apps, teal color scheme, dark background, vertical composition, no text",
};

const common =
  ", high quality, photorealistic render, dark background with room at bottom third for captions";

const assets = JSON.parse(readFileSync(join(root, "src/assets.json"), "utf8"));
for (const [id, prompt] of Object.entries(BROLL_PLAN)) {
  console.log(`生成中: ${id}`);
  const res = await falRun(MODEL, {
    prompt: prompt + common,
    image_size: { width: 1080, height: 1920 },
    num_images: 1,
    enable_safety_checker: true,
  });
  const url = res.images?.[0]?.url;
  if (!url) throw new Error(`${id}: 画像URLなし ${JSON.stringify(res)}`);
  await download(url, join(root, `public/broll/${id}.png`));
  if (!assets.broll.includes(id)) assets.broll.push(id);
  writeFileSync(join(root, "src/assets.json"), JSON.stringify(assets, null, 2));
  console.log(`保存: public/broll/${id}.png`);
}
console.log("Bロール生成完了");
