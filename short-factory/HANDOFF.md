# short-factory 引き継ぎ書

LM Studio × Qwen「ローカルAIを0円で動かす」60秒ショート動画の制作パイプライン。
Remotion製。**プレビュー版(仮ビジュアル+推定タイミング・音声なし)は `out/short_preview.mp4` としてレンダ済み**(gitには含めていないので `npm run render` で再生成)。

## 現在の状態

- ✅ 台本確定(`src/script.ts`)— 読み事故リント済み(かな固定)、推定56.5秒+CTA
- ✅ Remotionコンポジション(`src/Short.tsx`)— 9:16 1080x1920/30fps、でかテロップ+キーワードハイライト、0円どどど演出、設定のコツ①②③バッジ、AI音声小表記、進行バー、エンドCTA
- ✅ SE「ドン」(`public/se_don.wav`、オフライン合成済み)
- ✅ 検収スクリプト一式(`scripts/`)
- ⛔ ナレーション音声(fal TTS)— **ネットワーク制限で未実施**
- ⛔ Bロール画像(fal flux)— 同上
- ⛔ 参照音声(YouTube @takuya_genai から取得)— 同上

## ブロッカー: ネットワーク

このセッションの環境は GitHub とパッケージレジストリ以外への接続がすべて遮断されている
(fal.run / queue.fal.run / rest.alpha.fal.ai / youtube.com すべて 403)。
再開するセッションでは以下に接続できる必要がある:

- `fal.run`, `queue.fal.run`, `rest.alpha.fal.ai`, `v3.fal.media`(fal API+CDN)
- `www.youtube.com`, `*.googlevideo.com`(参照音声の取得)
- `openaipublic.azureedge.net`(whisperモデルのDL)

→ 迷ったら「All domains / フルネットワークアクセス」の環境で新しいセッションを開始する。

## 再開手順(ネットワーク解放後)

```bash
cd short-factory
npm install                     # node_modulesは未コミット
mkdir -p assets
echo "<FAL_KEY>" > assets/.fal_key   # キーはユーザーに再依頼(gitには絶対入れない)

# 1. 参照音声: ユーザーのYouTube動画から音声を取得(要 yt-dlp: pip install yt-dlp)
#    対象: https://www.youtube.com/watch?v=5q-YRmDno6g (ユーザー本人のチャンネル @takuya_genai)
#    ※声のクローンは本人の声のみ可。本人確認済み(ユーザー申告)
yt-dlp -x --audio-format mp3 -o assets/reference_voice.mp3 "https://www.youtube.com/watch?v=5q-YRmDno6g"
#    BGMの少ないクリアな区間1〜2分に切り出すと品質が上がる

# 2. 読み事故リント(台本を変えたら都度)
node scripts/lint_reading.mjs

# 3. 声クローン+TTS → public/voice.mp3
node scripts/fal_tts.mjs

# 4. 音声検収: クリック検査+ラウドネス
node scripts/check_audio.mjs

# 5. ASR照合+タイミング実測化(要 pip install openai-whisper)
node scripts/asr_align.mjs      # src/timing.json を実測値で上書き

# 6. Bロール生成 → public/broll/*.png + assets.json更新
node scripts/fal_broll.mjs

# 7. 最終レンダ
npm run render                  # out/short_preview.mp4
```

## 実装メモ(この環境の制約)

- レンダは **プリインストールChromiumのheadless_shell** を使う
  (`remotion.config.ts` で設定済み。`playwright install` は実行しない)
- Playwright同梱ffmpeg(`/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux`)はH.264デコード不可。
  フレーム確認は `npx remotion still` を使う
- 日本語フォントは `@fontsource/noto-sans-jp`(npm)から woff2 を `public/fonts/` にコピー済み
- タイミングは `src/timing.json` が唯一の情報源。推定値(estimated:true)は
  `scripts/estimate_timing.mjs`、実測値は `scripts/asr_align.mjs` が書く
- fal TTSモデルは minimax voice-clone + speech-02-hd を既定にしている。
  SKILL.md指定が別モデルなら `scripts/fal_tts.mjs` の定数を差し替える

## 台本(確定版)

字幕表示は「LM Studio」「Qwen」「MLX」「64K」を英字表記、TTSの読みはかな固定。
構成: フック(ネット不要+0円・巨大数字型)→ 本編(ツール/プライバシー/コスト/設定のコツ3つ/API互換)→ 締め(概要欄誘導)。
全文は `src/script.ts` を参照。
