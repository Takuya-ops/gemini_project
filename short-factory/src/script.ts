// 承認待ち台本(2026-08-24 ドラフト) — LM Studio × Qwen ローカルAI 60秒ショート
// display: 画面に出すでかテロップ(英字表記OK) / reading: TTSに渡す読み(かな固定・読み事故防止)
// section: 背景プレースホルダとBロール差し替えの単位
// scene: "typo"(タイポグラフィ) | "broll"(fal画像が public/broll/<id>.png にあれば使用)

export type Cue = {
  id: string;
  section:
    | "hook"
    | "tools"
    | "privacy"
    | "cost"
    | "tips"
    | "api"
    | "outro";
  display: string; // \n で改行
  keywords: string[]; // ハイライトする語(display内に含まれる文字列)
  reading: string; // TTS読み上げ用(かな)
  se?: "don"; // キュー頭で鳴らすSE
  step?: number; // 設定のコツ ①②③
};

export const CUES: Cue[] = [
  {
    id: "c01",
    section: "hook",
    display: "チャットGPTみたいなAIを\nネットにつながず\nMacの中だけで動かせます",
    keywords: ["ネットにつながず"],
    reading:
      "チャットジーピーティーみたいなエーアイを、ネットにつながず、じぶんのマックのなかだけでうごかせます",
  },
  {
    id: "c02",
    section: "hook",
    display: "しかも利用料は\n0円です",
    keywords: ["0円"],
    reading: "しかもりようりょうは、ゼロえんです",
    se: "don",
  },
  {
    id: "c03",
    section: "tools",
    display: "無料アプリの LM Studio と\nオープンモデルの Qwen を使います",
    keywords: ["LM Studio", "Qwen"],
    reading:
      "つかうのは、むりょうアプリの、エルエムスタジオと、オープンモデルの、クウェンです",
  },
  {
    id: "c04",
    section: "privacy",
    display: "ローカルで動くから\n入力した内容は\n一切外に送信されません",
    keywords: ["一切外に送信されません"],
    reading:
      "ローカルでうごくから、にゅうりょくしたないようは、いっさいそとにそうしんされません",
  },
  {
    id: "c05",
    section: "privacy",
    display: "社外秘の資料も\n安心して読ませられます",
    keywords: ["社外秘"],
    reading: "しゃがいひのしりょうも、あんしんしてよませられます",
  },
  {
    id: "c06",
    section: "cost",
    display: "API料金もかからず\n何回使っても電気代だけ",
    keywords: ["電気代だけ"],
    reading:
      "エーピーアイりょうきんもかからず、なんかいつかっても、でんきだいだけです",
  },
  {
    id: "c07",
    section: "tips",
    display: "設定のコツは\n3つだけ",
    keywords: ["3つ"],
    reading: "せっていのコツは、みっつだけ",
    se: "don",
  },
  {
    id: "c08",
    section: "tips",
    step: 1,
    display: "Macなら\nフォーマットは MLX",
    keywords: ["MLX"],
    reading: "まず、マックなら、フォーマットは、エムエルエックスをえらびます",
  },
  {
    id: "c09",
    section: "tips",
    step: 2,
    display: "量子化は\nメモリが許すかぎり\n大きいビット数に",
    keywords: ["大きいビット数"],
    reading:
      "つぎに、りょうしかは、メモリがゆるすかぎり、おおきいビットすうにします",
  },
  {
    id: "c10",
    section: "tips",
    step: 3,
    display: "コンテキスト長は\n64K まで拡大",
    keywords: ["64K"],
    reading:
      "さいごに、コンテキストちょうは、ろくじゅうよんケーまでひろげておきます",
  },
  {
    id: "c11",
    section: "api",
    display: "OpenAI互換の\nAPIサーバーも標準搭載",
    keywords: ["OpenAI互換"],
    reading:
      "さらに、オープンエーアイごかんの、エーピーアイサーバーも、ひょうじゅんとうさい",
  },
  {
    id: "c12",
    section: "api",
    display: "接続先を変えるだけで\n手持ちのツールが\nそのまま動きます",
    keywords: ["そのまま動きます"],
    reading:
      "せつぞくさきをかえるだけで、てもちのツールが、そのままうごきます",
  },
  {
    id: "c13",
    section: "outro",
    display: "詳しい手順は\n概要欄の記事からどうぞ",
    keywords: ["概要欄"],
    reading: "くわしいてじゅんは、がいようらんのきじからどうぞ",
  },
  {
    id: "c14",
    section: "outro",
    display: "まずはモデルの\nダウンロードから\n始めましょう",
    keywords: ["ダウンロード"],
    reading: "まずは、モデルのダウンロードから、はじめましょう",
  },
];

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
// エンドCTAカードの長さ(フレーム)
export const END_CARD_FRAMES = 100;
