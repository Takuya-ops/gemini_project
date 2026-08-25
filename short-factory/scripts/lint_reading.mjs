// 読み事故リント: TTSに渡す reading に読み間違いリスクの高い表記が残っていないか検査する。
// - 漢字が含まれていないか(かな固定の原則)※許可リストの漢字は除外
// - 生の英単語(TTSが英語読みできない綴り)が残っていないか
// - 数字の生残り(読みが曖昧: 0, 3, 64 など)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/script.ts"), "utf8");

// 読みの中で使用を許可する漢字(誤読リスクが低く、かなにするとTTSが不自然になるもの)
const ALLOWED_KANJI = new Set([]);
// 読みの中で許可するカタカナ英語以外のASCII語
const ALLOWED_ASCII = new Set([]);

const cues = [...src.matchAll(/id:\s*"(c\d+)"[\s\S]*?reading:\s*\n?\s*"([^"]+)"/g)];
let issues = 0;

for (const [, id, reading] of cues) {
  for (const ch of reading) {
    if (/[一-鿿]/.test(ch) && !ALLOWED_KANJI.has(ch)) {
      console.log(`NG [${id}] 漢字が残っています: 「${ch}」 in "${reading}"`);
      issues++;
    }
  }
  const asciiWords = reading.match(/[A-Za-z0-9]+/g) ?? [];
  for (const w of asciiWords) {
    if (!ALLOWED_ASCII.has(w)) {
      console.log(`NG [${id}] 英数字が残っています: 「${w}」 in "${reading}"`);
      issues++;
    }
  }
}

if (issues > 0) {
  console.log(`\n読み事故リスク: ${issues}件。かな表記に修正してください。`);
  process.exit(1);
}
console.log(`OK: ${cues.length}キューすべて読み事故リスクなし(かな固定)`);
