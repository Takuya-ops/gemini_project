# Sound OSS - 音声認識・音声合成ツール

Gemini API / Gemma 4 / Edge TTS を活用した音声処理ツールキット。
CLI と Web UI (Gradio) の両方で利用可能。

## 機能

| 機能 | エンジン | 説明 |
|---|---|---|
| 音声認識 (ASR) | Gemini 2.5 Flash / Gemma 4 | 音声 → テキスト変換 |
| 音声翻訳 (AST) | Gemini 2.5 Flash | 音声 → 他言語テキスト |
| 音声合成 (TTS) | Gemini 2.5 Flash TTS | テキスト → 音声 (30種類の声) |
| 音声合成 (TTS) | Edge TTS | テキスト → 音声 (APIキー不要) |
| 音声変換 | Gemini ASR + TTS | 音声 → 翻訳 → 翻訳音声 |

## セットアップ

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export GOOGLE_API_KEY="your-api-key"  # https://aistudio.google.com/ で取得
```

## 使い方

### Web UI (推奨)

```bash
python app.py
# ブラウザで http://localhost:7860 を開く
```

### CLI

```bash
# 音声認識
python main.py asr audio.wav
python main.py asr audio.wav --language english
python main.py asr audio.wav --translate --target-language english
python main.py asr audio.wav --json

# 音声合成 (Gemini)
python main.py tts "こんにちは" -o hello.wav
python main.py tts "こんにちは" --voice Aoede --style "ささやくように"

# 音声合成 (Edge TTS / APIキー不要)
python main.py tts "こんにちは" --engine edge -o hello.mp3
python main.py tts "こんにちは" --engine edge --voice-edge keita  # 男性

# 対話音声
python main.py dialogue "Taro: Hello\nHanako: Hi" -o chat.wav
```

### バッチ処理

```bash
# フォルダ内の全音声を一括書き起こし
python batch.py asr ./audio_files/ -o results.json

# CSV出力
python batch.py asr ./audio_files/ -o results.csv --format csv

# テキストファイルから一括音声合成 (1行=1音声)
python batch.py tts sentences.txt -o ./output_audio/

# Edge TTSで一括合成 (APIキー不要)
python batch.py tts sentences.txt -o ./output_audio/ --engine edge

# 一括翻訳 (日本語→英語)
python batch.py translate ./audio_files/ -o translations.json
```

### Docker

```bash
export GOOGLE_API_KEY="your-api-key"
docker compose up --build
# ブラウザで http://localhost:7860 を開く
```

## ファイル構成

```
sound_oss/
├── app.py              # Gradio Web UI
├── main.py             # CLI エントリポイント
├── batch.py            # バッチ処理 (一括ASR/TTS)
├── gemma4_api.py       # ASR - Gemini API 経由
├── gemma4_local.py     # ASR - Gemma 4 ローカル推論 (GPU用)
├── tts_gemini.py       # TTS - Gemini 2.5 Flash TTS
├── tts_edge.py         # TTS - Edge TTS (無料)
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

## Gemini TTS 利用可能な声

Achernar, Achird, Algenib, Algieba, Alnilam, Aoede, Autonoe, Callirrhoe, Charon, Despina, Enceladus, Erinome, Fenrir, Gacrux, Iapetus, **Kore** (デフォルト), Laomedeia, Leda, Orus, Puck, Pulcherrima, Rasalgethi, Sadachbia, Sadaltager, Schedar, Sulafat, Umbriel, Vindemiatrix, Zephyr, Zubenelgenubi

## 注意事項

- Gemma 4 ローカル推論 (`--mode local`) には Python 3.11+ / PyTorch 2.4+ / GPU 環境が必要
- API 経由の音声認識には Gemini を使用 (Gemma は API 上で音声非対応)
- Gemini TTS の日本語マルチスピーカーは現状 API 制限あり (シングルスピーカーにフォールバック)
