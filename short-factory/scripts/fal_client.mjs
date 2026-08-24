// fal.ai キューAPIの薄いクライアント(依存パッケージ不要)。
// キーは環境変数 FAL_KEY か、short-factory/assets/.fal_key(gitignore済み)から読む。
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const getFalKey = () => {
  if (process.env.FAL_KEY) return process.env.FAL_KEY.trim();
  const keyFile = join(root, "assets/.fal_key");
  if (existsSync(keyFile)) return readFileSync(keyFile, "utf8").trim();
  throw new Error(
    "FAL_KEY が見つかりません。環境変数 FAL_KEY を設定するか short-factory/assets/.fal_key に保存してください"
  );
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// queue.fal.run に投げて完了までポーリングし、レスポンスJSONを返す
export const falRun = async (model, input, { timeoutSec = 300 } = {}) => {
  const key = getFalKey();
  const headers = {
    Authorization: `Key ${key}`,
    "Content-Type": "application/json",
  };
  const submit = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  if (!submit.ok)
    throw new Error(`fal submit ${model}: ${submit.status} ${await submit.text()}`);
  const { status_url, response_url } = await submit.json();

  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    const st = await fetch(status_url, { headers });
    const stJson = await st.json();
    if (stJson.status === "COMPLETED") {
      const res = await fetch(response_url, { headers });
      if (!res.ok) throw new Error(`fal result: ${res.status} ${await res.text()}`);
      return res.json();
    }
    if (stJson.status === "FAILED" || stJson.status === "ERROR")
      throw new Error(`fal job failed: ${JSON.stringify(stJson)}`);
    await sleep(2000);
  }
  throw new Error(`fal job timeout after ${timeoutSec}s`);
};

export const download = async (url, outPath) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const { writeFileSync } = await import("node:fs");
  writeFileSync(outPath, buf);
  return outPath;
};
